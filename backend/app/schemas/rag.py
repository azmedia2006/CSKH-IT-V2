from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class CitationItem(BaseModel):
    article_id: str = Field(..., description="Mã bài viết (VD: POL-001, RUNBOOK-01)")
    title: str = Field(..., description="Tiêu đề quy trình / chính sách")
    category: str = Field(default="GENERAL", description="Danh mục nghiệp vụ")
    document_name: str = Field(default="So-tay-RAG.docx", description="Tên tài liệu nguồn")
    version: Optional[str] = Field(default="1.0-SAMPLE", description="Phiên bản tài liệu")
    status: str = Field(default="SAMPLE_NEEDS_APPROVAL", description="Trạng thái phê duyệt")
    is_sample_unapproved: bool = Field(default=True, description="True nếu là tài liệu mẫu chưa ký phê duyệt chính thức")
    disclaimer: Optional[str] = Field(
        default="Lưu ý: Quy tắc/hướng dẫn này thuộc bản thảo đang chờ phê duyệt (SAMPLE_NEEDS_APPROVAL), chưa phải chính sách chính thức.",
        description="Cảnh báo pháp lý / ranh giới áp dụng"
    )

class RAGChunkResponse(BaseModel):
    id: str
    article_id: str
    title: str
    category: str
    audience: str
    visibility: str
    status: str
    version: Optional[str] = None
    content: str
    similarity_score: Optional[float] = None
    effective_date: Optional[str] = None
    review_date: Optional[str] = None
    chunk_index: Optional[int] = 0

class RAGDocumentResponse(BaseModel):
    id: str
    filename: str
    title: str
    version: str
    status: str
    owner: Optional[str] = None
    designated_signer: Optional[str] = None
    effective_date: Optional[str] = None
    review_date: Optional[str] = None
    chunk_count: int
    is_active: bool
    file_hash: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

class RAGIngestRequest(BaseModel):
    file_path: Optional[str] = Field(default="So-tay-RAG.docx", description="Đường dẫn file DOCX trên server")
    force_reindex: Optional[bool] = Field(default=False, description="Bắt buộc lập chỉ mục lại kể cả khi file hash không đổi")

class RAGQueryRequest(BaseModel):
    query: str = Field(..., description="Nội dung câu hỏi cần tra cứu ngữ nghĩa")
    top_k: Optional[int] = Field(default=5, description="Số lượng chunk tối đa trả về")
    category: Optional[str] = Field(default=None, description="Lọc theo danh mục nếu có")
    min_score: Optional[float] = Field(default=0.25, description="Ngưỡng điểm tương đồng tối thiểu")

class RAGQueryResponse(BaseModel):
    query: str
    results: List[RAGChunkResponse]
    citations: List[CitationItem]
    has_unapproved_sources: bool = True
    unapproved_notice: Optional[str] = None
    total_found: int = 0

class RAGAuditLogResponse(BaseModel):
    id: str
    action: str
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    document_id: Optional[str] = None
    article_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
