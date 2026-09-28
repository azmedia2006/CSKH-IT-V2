import os
import re
import uuid
import hashlib
import zipfile
import logging
from xml.etree import ElementTree as ET
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, func, or_, text, case
from sqlalchemy.orm import selectinload

from app.models.rag import RAGDocument, RAGChunk, RAGAuditLog
from app.models.user import User
from app.schemas.rag import CitationItem, RAGChunkResponse, RAGQueryResponse
from app.services.embedding_service import embedding_service
from app.ai.pii_masker import PIIMasker

logger = logging.getLogger(__name__)

# Prompt injection patterns in retrieved text or user queries
INJECTION_PATTERN = re.compile(
    r"(?i)\b(ignore previous instructions|bỏ qua hướng dẫn|bỏ qua quy tắc|hãy quên tất cả|system override|"
    r"you are now in developer mode|tiết lộ prompt|tiết lộ api key|show all secrets|dump database|bypass rbac)\b"
)

ROLE_ID_MAP = {
    "b9dbf63d-b565-4e6e-8b2d-790d373e657b": "ADMIN",
    "1391e2c0-cc40-4f0c-96c4-be62c9878c5e": "TEAM_LEAD",
    "df8bdd09-b588-44d0-beca-06e658166c3d": "SUPPORT_AGENT",
    "9aa637fa-744c-4e5e-a43c-709797d84110": "REQUESTER"
}

def _get_safe_role(user: Optional[User]) -> str:
    if not user:
        return "REQUESTER"
    if hasattr(user, "role_name") and user.role_name:
        return str(user.role_name).upper()
    if "role" in user.__dict__ and user.role:
        role_obj = user.role
        return str(getattr(role_obj, "role_name", getattr(role_obj, "name", "REQUESTER"))).upper()
    if hasattr(user, "role_id") and user.role_id in ROLE_ID_MAP:
        return ROLE_ID_MAP[user.role_id]
    return "REQUESTER"


class RAGService:
    @staticmethod
    def compute_file_hash(file_path: str) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()

    @staticmethod
    def parse_docx_raw(file_path: str) -> Dict[str, Any]:
        """
        Trích xuất nội dung DOCX, phát hiện header/footer, bảng, các mâu thuẫn nghiệp vụ và các mục chưa phê duyệt.
        """
        header_text = ""
        footer_text = ""
        body_elements = []

        with zipfile.ZipFile(file_path, "r") as z:
            # 1. Đọc header
            for name in z.namelist():
                if name.startswith("word/header"):
                    xml_content = z.read(name)
                    tree = ET.fromstring(xml_content)
                    texts = [node.text for node in tree.iter() if node.tag.endswith("t") and node.text]
                    header_text += " ".join(texts) + " "

            # 2. Đọc footer
            for name in z.namelist():
                if name.startswith("word/footer"):
                    xml_content = z.read(name)
                    tree = ET.fromstring(xml_content)
                    texts = [node.text for node in tree.iter() if node.tag.endswith("t") and node.text]
                    footer_text += " ".join(texts) + " "

            # 3. Đọc body
            doc_xml = z.read("word/document.xml")
            tree = ET.fromstring(doc_xml)

            # Namespace map
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

            body = tree.find("w:body", ns)
            if body is not None:
                for elem in body:
                    tag = elem.tag.split("}")[-1]
                    if tag == "p":
                        p_texts = [node.text for node in elem.iter() if node.tag.endswith("t") and node.text]
                        line = "".join(p_texts).strip()
                        if line:
                            body_elements.append({"type": "paragraph", "text": line})
                    elif tag == "tbl":
                        rows_data = []
                        for row in elem.findall("w:tr", ns):
                            row_cells = []
                            for cell in row.findall("w:tc", ns):
                                c_texts = [node.text for node in cell.iter() if node.tag.endswith("t") and node.text]
                                row_cells.append(" ".join("".join(c_texts).split()))
                            if any(row_cells):
                                rows_data.append(row_cells)
                        if rows_data:
                            body_elements.append({"type": "table", "rows": rows_data})

        # Phát hiện mâu thuẫn & mục chưa phê duyệt
        contradictions = []
        unconfirmed_items = []

        if "AN PHÚC" in header_text and any("AZ Media 247" in elem.get("text", "") for elem in body_elements if elem["type"] == "paragraph"):
            contradictions.append(
                "Mâu thuẫn tên pháp nhân: Header tài liệu ghi 'AN PHÚC | SAMPLE NEEDS APPROVAL' trong khi nội dung các quy trình ghi 'AZ Media 247'."
            )

        unconfirmed_items.extend([
            "4 nhân sự (Thân Phú Cường, Nguyễn Văn An, Trần Văn Tư, Nguyễn Văn Phước) chỉ là đầu mối mẫu được nêu trong tài liệu, chưa có chức danh hoặc quyền phê duyệt chính thức.",
            "Người ký 'Đoàn Minh Quân' được chỉ định trên bản thảo, chức danh và thẩm quyền thực tế đang chờ xác nhận.",
            "Ngưỡng sentiment L1->L2 (0.82), cam kết SLA P1-P4, sơ đồ 5 tầng văn phòng, thiết bị, email, hotline và URL chưa được ban hành chính thức (trạng thái SAMPLE_NEEDS_APPROVAL)."
        ])

        return {
            "header": header_text.strip(),
            "footer": footer_text.strip(),
            "elements": body_elements,
            "contradictions": contradictions,
            "unconfirmed_items": unconfirmed_items,
        }

    @classmethod
    def chunk_document_elements(cls, parsed_doc: Dict[str, Any], doc_id: str, source_file: str, file_hash: str) -> List[Dict[str, Any]]:
        """
        Phân mảnh (chunking) theo ranh giới bài viết (article_id, heading), giữ nguyên quan hệ bảng và ranh giới an toàn.
        """
        elements = parsed_doc.get("elements", [])
        chunks = []

        current_article_id = "ORG-000"
        current_title = "Giới thiệu tài liệu và quy tắc vận hành IT Service Desk"
        current_category = "ORGANIZATION"
        current_visibility = "PUBLIC"
        current_audience = "ALL"
        current_lines = []

        heading_regex = re.compile(r"^([A-Z0-9_\-]+)\s*(?:—|:|-)\s*(.+)$")

        def flush_chunk():
            nonlocal current_lines
            if not current_lines:
                return
            content = "\n".join(current_lines).strip()
            if not content:
                return

            # Xác định category từ article_id
            cat = "GENERAL"
            pfx = current_article_id.split("-")[0]
            if pfx in ["POL"]:
                cat = "POLICY"
            elif pfx in ["ORG"]:
                cat = "ORGANIZATION"
            elif pfx in ["FLOOR"]:
                cat = "FLOOR_LAYOUT"
            elif pfx in ["TIER"]:
                cat = "SUPPORT_TIERS"
            elif pfx in ["SLA"]:
                cat = "SLA_RULES"
            elif pfx in ["AI"]:
                cat = "AI_GOVERNANCE"
            elif pfx in ["RAG"]:
                cat = "RAG_ARCHITECTURE"
            elif pfx in ["FORM"]:
                cat = "FORMS_TEMPLATES"
            elif pfx in ["ACC"]:
                cat = "RUNBOOK_ACCOUNT"
            elif pfx in ["HW"]:
                cat = "RUNBOOK_HARDWARE"
            elif pfx in ["SW"]:
                cat = "RUNBOOK_SOFTWARE"
            elif pfx in ["NET"]:
                cat = "RUNBOOK_NETWORK"
            elif pfx in ["SEC"]:
                cat = "RUNBOOK_SECURITY"
            elif pfx in ["OPS"]:
                cat = "RUNBOOK_OPERATIONS"
            elif pfx in ["L1", "L2"]:
                cat = "RUNBOOK_KNOWLEDGE"

            # Phân định visibility & audience:
            # 1. RESTRICTED: admin credentials, root secrets, điều tra mã độc, ban điều hành tầng 5, phòng server hạn chế
            if pfx in ["SEC"] and any(k in current_title.lower() for k in ["admin", "root", "bí mật", "điều tra", "mã độc", "containment", "incident response"]):
                vis = "RESTRICTED"
                aud = "SECURITY_ADMINS"
            elif pfx in ["FLOOR"] and any(k in current_title.lower() for k in ["tầng 4", "tầng 5", "hạn chế", "ban điều hành", "phòng máy chủ"]):
                vis = "RESTRICTED"
                aud = "IT_ADMINS"
            # 2. INTERNAL: Quy trình kỹ thuật chuyên sâu nội bộ L2/L3, vận hành hạ tầng core
            elif pfx in ["L2", "OPS"]:
                vis = "INTERNAL"
                aud = "INTERNAL_STAFF"
            # 3. PUBLIC: Tất cả cẩm nang hướng dẫn CNTT, tài khoản, thiết bị, phần mềm, mạng, chính sách (ACC, HW, SW, NET, L1, POL, SLA, FORM, KB)
            else:
                vis = "PUBLIC"
                aud = "ALL"

            chunks.append({
                "document_id": doc_id,
                "article_id": current_article_id,
                "title": current_title,
                "category": cat,
                "audience": aud,
                "visibility": vis,
                "status": "SAMPLE_NEEDS_APPROVAL",
                "version": "1.0-SAMPLE",
                "owner": "Phòng CNTT - IT Service Desk",
                "effective_date": "Chưa ban hành",
                "review_date": "27/03/2027",
                "chunk_index": len(chunks),
                "content": content,
                "metadata_json": {
                    "source_file": source_file,
                    "source_hash": file_hash,
                    "is_sample_unapproved": True,
                    "disclaimer": "Lưu ý: Nội dung đang ở trạng thái bản thảo (SAMPLE_NEEDS_APPROVAL), chưa ký ban hành chính thức."
                }
            })
            current_lines = []

        for item in elements:
            if item["type"] == "paragraph":
                line = item["text"]
                m = heading_regex.match(line)
                if m:
                    flush_chunk()
                    current_article_id = m.group(1).strip()
                    current_title = m.group(2).strip()
                    current_lines.append(f"### {current_article_id} — {current_title}")
                else:
                    current_lines.append(line)
            elif item["type"] == "table":
                rows = item["rows"]
                if rows:
                    current_lines.append("\n[BẢNG DỮ LIỆU ĐI KÈM]:")
                    headers = rows[0]
                    for r_idx, row in enumerate(rows[1:], 1):
                        row_parts = []
                        for c_idx, cell in enumerate(row):
                            h_label = headers[c_idx] if c_idx < len(headers) else f"Cột {c_idx+1}"
                            row_parts.append(f"{h_label}: {cell}")
                        current_lines.append(" | ".join(row_parts))
                    current_lines.append("")

        flush_chunk()
        return chunks

    @classmethod
    async def ingest_document(
        cls,
        db: AsyncSession,
        file_path: str,
        actor_user: Optional[User] = None,
        force_reindex: bool = False
    ) -> Tuple[RAGDocument, List[str], List[str]]:
        """
        Nạp DOCX vào cơ sở dữ liệu: Idempotent qua SHA-256 file_hash.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Không tìm thấy file nguồn: {file_path}")

        file_hash = cls.compute_file_hash(file_path)
        filename = os.path.basename(file_path)

        # Kiểm tra xem file đã từng nạp chưa
        stmt = select(RAGDocument).where(RAGDocument.file_hash == file_hash)
        res = await db.execute(stmt)
        existing_doc = res.scalars().first()

        if existing_doc and not force_reindex:
            logger.info(f"[RAG Ingest] File {filename} (hash {file_hash[:8]}) đã tồn tại, bỏ qua reindex (idempotent).")
            return existing_doc, [], []

        parsed = cls.parse_docx_raw(file_path)
        contradictions = parsed.get("contradictions", [])
        unconfirmed = parsed.get("unconfirmed_items", [])

        doc_id = existing_doc.id if existing_doc else str(uuid.uuid4())

        # Nếu đã có, xóa các chunk cũ để reindex sạch sẽ
        if existing_doc:
            await db.execute(delete(RAGChunk).where(RAGChunk.document_id == existing_doc.id))
            target_doc = existing_doc
            target_doc.filename = filename
            target_doc.file_path = file_path
            target_doc.updated_at = datetime.utcnow()
        else:
            target_doc = RAGDocument(
                id=doc_id,
                filename=filename,
                title="Sổ tay RAG IT Service Desk - Quy tắc vận hành và tri thức hỗ trợ",
                file_path=file_path,
                file_hash=file_hash,
                version="1.0-SAMPLE",
                status="SAMPLE_NEEDS_APPROVAL",
                owner="Phòng CNTT - IT Service Desk",
                designated_signer="Đoàn Minh Quân (Chờ xác nhận)",
                effective_date="Chưa ban hành (Chờ ký duyệt)",
                review_date="27/03/2027",
                uploaded_by=actor_user.id if actor_user else None,
                is_active=True,
                metadata_json={
                    "contradictions": contradictions,
                    "unconfirmed_items": unconfirmed,
                    "header": parsed.get("header"),
                    "footer": parsed.get("footer"),
                    "contact_points": [
                        "Thân Phú Cường",
                        "Nguyễn Văn An",
                        "Trần Văn Tư",
                        "Nguyễn Văn Phước"
                    ]
                }
            )
            db.add(target_doc)

        await db.flush()

        raw_chunks = cls.chunk_document_elements(parsed, target_doc.id, file_path, file_hash)
        target_doc.chunk_count = len(raw_chunks)

        # Lưu các chunk và sinh embedding
        for c in raw_chunks:
            # Sinh vector embedding 1536 chiều
            embed_vec = await embedding_service.get_embedding(f"{c['article_id']} {c['title']} {c['content'][:1500]}")
            chunk_obj = RAGChunk(
                id=str(uuid.uuid4()),
                document_id=target_doc.id,
                article_id=c["article_id"],
                title=c["title"],
                category=c["category"],
                audience=c["audience"],
                visibility=c["visibility"],
                status=c["status"],
                version=c["version"],
                owner=c["owner"],
                effective_date=c["effective_date"],
                review_date=c["review_date"],
                chunk_index=c["chunk_index"],
                content=c["content"],
                embedding=embed_vec,
                metadata_json=c["metadata_json"]
            )
            db.add(chunk_obj)

        actor_role = _get_safe_role(actor_user)
        audit = RAGAuditLog(
            id=str(uuid.uuid4()),
            action="INGEST" if not existing_doc else "REINDEX",
            actor_id=actor_user.id if actor_user else None,
            actor_email=actor_user.email if actor_user else "system@azmedia247.com",
            actor_role=actor_role,
            document_id=target_doc.id,
            details={
                "filename": filename,
                "file_hash": file_hash,
                "chunks_created": len(raw_chunks),
                "conflicts_count": len(contradictions),
                "unconfirmed_count": len(unconfirmed)
            }
        )
        db.add(audit)
        await db.commit()

        logger.info(f"[RAG Ingest] Thành công: Nạp {len(raw_chunks)} chunks cho {filename} (status: {target_doc.status}).")
        return target_doc, contradictions, unconfirmed

    @classmethod
    async def reindex_document(cls, db: AsyncSession, document_id: str, actor_user: Optional[User] = None) -> RAGDocument:
        stmt = select(RAGDocument).where(RAGDocument.id == document_id)
        res = await db.execute(stmt)
        doc = res.scalars().first()
        if not doc:
            raise ValueError(f"Không tìm thấy tài liệu có id: {document_id}")

        doc, _, _ = await cls.ingest_document(db, doc.file_path, actor_user=actor_user, force_reindex=True)
        return doc

    @classmethod
    async def delete_document(cls, db: AsyncSession, document_id: str, actor_user: Optional[User] = None) -> bool:
        stmt = select(RAGDocument).where(RAGDocument.id == document_id)
        res = await db.execute(stmt)
        doc = res.scalars().first()
        if not doc:
            return False

        # Xóa chunks và document
        await db.execute(delete(RAGChunk).where(RAGChunk.document_id == document_id))
        await db.delete(doc)

        actor_role = _get_safe_role(actor_user)
        audit = RAGAuditLog(
            id=str(uuid.uuid4()),
            action="DELETE",
            actor_id=actor_user.id if actor_user else None,
            actor_email=actor_user.email if actor_user else "admin@azmedia247.com",
            actor_role=actor_role,
            document_id=document_id,
            details={"filename": doc.filename, "deleted_at": datetime.utcnow().isoformat()}
        )
        db.add(audit)
        await db.commit()
        return True

    @classmethod
    async def retrieve_relevant_chunks(
        cls,
        db: AsyncSession,
        query: str,
        current_user: Optional[User] = None,
        top_k: int = 5,
        min_score: float = 0.25
    ) -> Tuple[List[RAGChunkResponse], List[CitationItem], str]:
        """
        Truy xuất ngữ nghĩa kết hợp lọc RBAC chặt chẽ:
        - Lọc trước khi retrieval (Server-side Pre-Retrieval RBAC Filtering)
        - REQUESTER: Chỉ truy xuất bài PUBLIC
        - SUPPORT_AGENT: Truy xuất PUBLIC + INTERNAL
        - TEAM_LEAD / ADMIN: Truy xuất PUBLIC + INTERNAL + RESTRICTED
        - Chống Prompt Injection: Nội dung trích xuất là dữ liệu thuần túy
        - Gắn cờ cảnh báo nếu tài liệu ở trạng thái SAMPLE_NEEDS_APPROVAL
        """
        # Che PII trong query
        sanitized_query = PIIMasker.mask_text(query).strip()

        # 1. Xác định quyền truy cập của người dùng
        user_role = _get_safe_role(current_user)


        if user_role in ["REQUESTER", "CUSTOMER"]:
            allowed_visibilities = ["PUBLIC"]
        elif user_role in ["SUPPORT_AGENT", "AGENT"]:
            allowed_visibilities = ["PUBLIC", "INTERNAL"]
        else:  # TEAM_LEAD, ADMIN
            allowed_visibilities = ["PUBLIC", "INTERNAL", "RESTRICTED"]

        # 2. Sinh vector embedding cho câu hỏi
        query_vec = await embedding_service.get_embedding(sanitized_query)

        # 3. Tìm mã bài viết cụ thể nếu có trong câu hỏi (Boost exact match)
        code_matches = re.findall(r"\b([A-Z0-9_\-]+-\d+)\b", sanitized_query.upper())

        # Trích xuất các từ khóa có nghĩa để tìm kiếm hỗn hợp (hybrid search)
        stop_words = {"cho", "tôi", "mình", "làm", "sao", "được", "không", "như", "thế", "nào", "hãy", "cần", "giúp", "với", "các", "một", "trong", "đang", "gặp"}
        raw_words = [w for w in re.findall(r"[\w\-]+", sanitized_query.lower()) if len(w) >= 2 and w not in stop_words]

        # 4. Truy vấn Vector Similarity kết hợp Keyword Match
        # Sử dụng pgvector cosine distance: (embedding <=> query_vec)
        # Điểm tương đồng: 1 - cosine_distance
        cosine_dist_expr = RAGChunk.embedding.cosine_distance(query_vec)

        # Base statement có lọc RBAC
        stmt = (
            select(
                RAGChunk,
                (1.0 - cosine_dist_expr).label("similarity")
            )
            .where(
                RAGChunk.visibility.in_(allowed_visibilities)
            )
        )

        match_conditions = []
        if code_matches:
            match_conditions.append(RAGChunk.article_id.in_(code_matches))

        for w in raw_words[:6]:
            match_conditions.append(RAGChunk.title.ilike(f"%{w}%"))
            match_conditions.append(RAGChunk.content.ilike(f"%{w}%"))

        match_conditions.append(cosine_dist_expr < 0.95)

        stmt = stmt.where(or_(*match_conditions))

        # Sắp xếp: ưu tiên tuyệt đối mã bài viết khớp chính xác, sau đó theo độ tương đồng cao nhất
        order_clauses = []
        if code_matches:
            order_clauses.append(case((RAGChunk.article_id.in_(code_matches), 1), else_=0).desc())
        order_clauses.append(text("similarity DESC"))
        stmt = stmt.order_by(*order_clauses).limit(top_k * 2)

        res = await db.execute(stmt)
        rows = res.all()

        results = []
        citations = []
        seen_articles = set()
        has_sample_unapproved = False

        for chunk_obj, score in rows:
            # Prompt injection defense trên nội dung chunk
            safe_content = INJECTION_PATTERN.sub("[CẢNH BÁO: ĐÃ LOẠI BỎ LỆNH ĐỘC HẠI]", chunk_obj.content)

            score_val = float(score) if score is not None else 0.5
            if chunk_obj.article_id in code_matches:
                score_val = max(score_val, 0.95)

            results.append(
                RAGChunkResponse(
                    id=chunk_obj.id,
                    article_id=chunk_obj.article_id,
                    title=chunk_obj.title,
                    category=chunk_obj.category,
                    audience=chunk_obj.audience,
                    visibility=chunk_obj.visibility,
                    status=chunk_obj.status,
                    version=chunk_obj.version,
                    content=safe_content,
                    similarity_score=round(score_val, 3),
                    effective_date=chunk_obj.effective_date,
                    review_date=chunk_obj.review_date,
                    chunk_index=chunk_obj.chunk_index
                )
            )

            if chunk_obj.article_id not in seen_articles:
                seen_articles.add(chunk_obj.article_id)
                is_unapproved = chunk_obj.status == "SAMPLE_NEEDS_APPROVAL"
                if is_unapproved:
                    has_sample_unapproved = True

                disclaimer_text = (
                    "Lưu ý: Quy trình này thuộc bản thảo đang chờ phê duyệt (SAMPLE_NEEDS_APPROVAL), chưa phải chính sách chính thức."
                    if is_unapproved else None
                )

                citations.append(
                    CitationItem(
                        article_id=chunk_obj.article_id,
                        title=chunk_obj.title,
                        category=chunk_obj.category,
                        document_name="So-tay-RAG.docx",
                        version=chunk_obj.version or "1.0-SAMPLE",
                        status=chunk_obj.status,
                        is_sample_unapproved=is_unapproved,
                        disclaimer=disclaimer_text
                    )
                )

            if len(results) >= top_k:
                break

        # Ghi audit log cho lượt truy vấn
        try:
            audit = RAGAuditLog(
                id=str(uuid.uuid4()),
                action="RETRIEVAL_QUERY",
                actor_id=current_user.id if current_user else None,
                actor_email=current_user.email if current_user else "anonymous",
                actor_role=user_role,
                details={
                    "query_length": len(sanitized_query),
                    "allowed_visibilities": allowed_visibilities,
                    "retrieved_count": len(results),
                    "retrieved_articles": list(seen_articles)
                }
            )
            db.add(audit)
            await db.commit()
        except Exception as e:
            logger.warning(f"[RAG Audit Log Warning]: {e}")

        unapproved_notice = (
            "LƯU Ý QUAN TRỌNG: Các tài liệu tham khảo được trích xuất đang ở trạng thái 'Bản mẫu chờ phê duyệt' (SAMPLE_NEEDS_APPROVAL). "
            "Các thông tin này chỉ mang tính tham khảo kỹ thuật, không dùng làm cam kết chính thức."
            if has_sample_unapproved else ""
        )

        return results, citations, unapproved_notice
