import os
import uuid
import shutil
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.schemas.ticket import TicketCreate, TicketResponse, TicketUpdate
from app.schemas.comment import CommentCreate, CommentResponse
from app.schemas.ai import ChatAssistantRequest, ChatAssistantResponse
from app.ai.chat_assistant import process_chat_assistant_message
from app.models.user import User
from app.models.ticket import Ticket
from app.models.comment import Comment
from app.models.attachment import Attachment
from app.models.category import Category
from app.models.role import Role
from app.models.ai_log import AILog
from app.services import ticket_service
from app.services.email_service import send_ticket_notification_email
from app.ai.triage import ai_triage_ticket
from app.ai.copilot import ai_draft_reply
from app.ai.summarizer import ai_summarize_ticket
from app.ai.pii_masker import PIIMasker
from app.core.constants import (
    ALLOWED_ATTACHMENT_MIMES,
    ALLOWED_ATTACHMENT_EXTENSIONS,
    MAX_ATTACHMENT_SIZE_BYTES,
    MAX_ATTACHMENTS_PER_TICKET,
    FILE_MAGIC_BYTES,
    VALID_STATUS_TRANSITIONS,
)
from app.core.permissions import (
    apply_ticket_scope,
    check_ticket_access,
    verify_ticket_access_or_403,
    is_admin,
    is_team_lead,
    is_support_agent,
    is_requester,
    get_user_role,
)

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _validate_file_magic_bytes(header: bytes) -> str | None:
    """Kiểm tra chữ ký magic bytes của tệp để xác định MIME type thực sự."""
    for magic, mime in FILE_MAGIC_BYTES.items():
        if header.startswith(magic):
            return mime
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    return None


def _format_ticket_response(t: Ticket, current_user: Optional[User] = None) -> dict:
    """Chuyển đổi ORM Ticket sang dictionary tương thích TicketResponse, bảo mật dữ liệu AI nội bộ đối với REQUESTER."""
    user_is_requester = is_requester(current_user) if current_user else False
    now = datetime.utcnow()

    return {
        "id": t.id,
        "ticket_code": t.ticket_code,
        "title": t.title,
        "description": t.description,
        "category_id": t.category_id,
        "category_code": t.category.code if t.category else (t.category_id if t.category_id and '-' not in t.category_id else None),
        "category_name": t.category.name if t.category else None,
        "requester_id": t.requester_id,
        "requester_name": t.requester.full_name if t.requester else None,
        "assigned_agent_id": t.assigned_agent_id,
        "assigned_agent_name": t.assigned_agent.full_name if t.assigned_agent else None,
        "priority": t.priority,
        "is_escalated": bool(t.is_escalated) if not user_is_requester else False,
        "support_level": (t.support_level or "L1") if not user_is_requester else "L1",
        "risk_flag": (t.risk_flag or "NORMAL") if not user_is_requester else "NORMAL",
        "sentiment": t.sentiment if not user_is_requester else None,
        "sentiment_score": t.sentiment_score if not user_is_requester else None,
        "sentiment_reason": t.sentiment_reason if not user_is_requester else None,
        "sentiment_evidence": t.sentiment_evidence if not user_is_requester else None,
        "escalation_status": (t.escalation_status or "NONE") if not user_is_requester else "NONE",
        "escalated_at": t.escalated_at if not user_is_requester else None,
        "escalation_reason": t.escalation_reason if not user_is_requester else None,
        "previous_agent_id": t.previous_agent_id if not user_is_requester else None,
        "previous_agent_name": t.previous_agent.full_name if (t.previous_agent and not user_is_requester) else None,
        "ai_suggested_priority": t.ai_suggested_priority if not user_is_requester else None,
        "ai_confidence_score": t.ai_confidence_score if not user_is_requester else None,
        "status": t.status,
        "first_response_due_at": t.first_response_due_at,
        "first_responded_at": t.first_responded_at,
        "resolution_due_at": t.resolution_due_at,
        "resolved_at": t.resolved_at,
        "closed_at": t.closed_at,
        "ai_summary": t.ai_summary if not user_is_requester else None,
        "created_at": t.created_at or now,
        "updated_at": t.updated_at or t.created_at or now
    }


# ---------------------------------------------------------
# TICKET CRUD & SCOPING
# ---------------------------------------------------------

@router.post("/", response_model=TicketResponse)
async def create_ticket(
    ticket_in: TicketCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tạo ticket mới:
    - requester_id LUÔN được backend lấy từ tài khoản đang đăng nhập (current_user.id).
    - Tự động gán cho nhân viên L1 đang hoạt động phù hợp kỹ năng & cân bằng tải.
    - AI phân tích sentiment nội dung khởi tạo.
    """
    ticket = await ticket_service.create_ticket(db, ticket_in.model_dump(), current_user.id)
    ticket_url = f"https://azmedia247.com/tickets/{ticket['id']}"
    background_tasks.add_task(
        send_ticket_notification_email,
        current_user.email,
        f"Đã tiếp nhận yêu cầu {ticket['ticket_code']} - IT Service Desk",
        "Yêu cầu hỗ trợ của bạn đã được tiếp nhận",
        ticket["ticket_code"], ticket["title"], ticket_url,
    )

    # Notify active administrators and the assigned technician about new requests.
    staff_result = await db.execute(
        select(User.email).join(User.role).where(
            User.is_active.is_(True),
            Role.role_name == "ADMIN",
        )
    )
    staff_emails = set(staff_result.scalars().all())
    assigned_agent_id = ticket.get("assigned_agent_id")
    if assigned_agent_id:
        agent_result = await db.execute(
            select(User.email).where(User.id == assigned_agent_id, User.is_active.is_(True))
        )
        agent_email = agent_result.scalar_one_or_none()
        if agent_email:
            staff_emails.add(agent_email)
    staff_emails.discard(current_user.email)
    for email in staff_emails:
        background_tasks.add_task(
            send_ticket_notification_email,
            email,
            f"Yêu cầu mới {ticket['ticket_code']} - IT Service Desk",
            "Có yêu cầu hỗ trợ mới",
            ticket["ticket_code"], ticket["title"], ticket_url,
        )
    return ticket


@router.get("/", response_model=List[TicketResponse])
async def list_tickets(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    category_id: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_agent_id: Optional[str] = None,
    support_level: Optional[str] = None,
    risk_flag: Optional[str] = None,
    escalation_status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Danh sách ticket có phân quyền truy cập nghiêm ngặt tại Backend (Data Scoping):
    - REQUESTER: Chỉ xem ticket do chính mình tạo.
    - SUPPORT_AGENT L1: Chỉ xem ticket được giao HOẶC hàng đợi L1 chưa phân công.
    - SUPPORT_AGENT L2: Chỉ xem ticket được giao HOẶC hàng đợi L2 (chuyển cấp / chờ xử lý).
    - TEAM_LEAD: Xem danh sách trong phạm vi đội nhóm / hỗ trợ vận hành.
    - ADMIN: Toàn quyền xem mọi ticket.
    """
    query = select(Ticket).options(
        selectinload(Ticket.category),
        selectinload(Ticket.requester),
        selectinload(Ticket.assigned_agent),
        selectinload(Ticket.previous_agent)
    )

    # 1. Áp dụng RBAC Data Scope tại câu lệnh SQL
    query = apply_ticket_scope(query, current_user)

    # 2. Áp dụng các bộ lọc tìm kiếm
    if status and status != "ALL":
        query = query.where(Ticket.status == status)
    if category_id and category_id != "ALL":
        query = query.where(Ticket.category_id == category_id)
    if priority and priority != "ALL":
        query = query.where(Ticket.priority == priority)
    if assigned_agent_id and assigned_agent_id != "ALL":
        query = query.where(Ticket.assigned_agent_id == assigned_agent_id)
    if support_level and support_level != "ALL":
        query = query.where(Ticket.support_level == support_level)
    if risk_flag and risk_flag != "ALL":
        query = query.where(Ticket.risk_flag == risk_flag)
    if escalation_status and escalation_status != "ALL":
        if escalation_status == "ESCALATED":
            query = query.where(Ticket.is_escalated == True)
        else:
            query = query.where(Ticket.escalation_status == escalation_status)

    query = query.order_by(Ticket.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    tickets = result.scalars().all()

    return [_format_ticket_response(t, current_user=current_user) for t in tickets]


@router.get("/public-recent")
async def get_public_recent_tickets(
    db: AsyncSession = Depends(get_db)
):
    """
    Danh sách ticket công khai cho trang giới thiệu:
    - Ẩn hoàn toàn thông tin cá nhân (PII), tên khách hàng và tên Kỹ thuật viên cụ thể.
    - Không trả tiêu đề chi tiết nội bộ mà ẩn danh theo nhóm danh mục hỗ trợ.
    """
    query = (
        select(Ticket)
        .options(
            selectinload(Ticket.category)
        )
        .order_by(Ticket.created_at.desc())
        .limit(8)
    )
    result = await db.execute(query)
    tickets = result.scalars().all()

    response = []
    for t in tickets:
        cat_name = t.category.name if t.category else "Hỗ trợ Kỹ thuật"
        code_prefix = t.ticket_code[:8] if t.ticket_code else "TKT-2026"
        response.append({
            "id": t.id,
            "ticket_code": f"{code_prefix}****",
            "title": f"Yêu cầu hỗ trợ: {cat_name}",
            "category_name": cat_name,
            "priority": t.priority,
            "status": t.status,
            "assigned_agent_name": "Kỹ thuật viên IT",
            "resolution_due_at": t.resolution_due_at.isoformat() if t.resolution_due_at else None,
            "created_at": t.created_at.isoformat() if t.created_at else None
        })
    return response


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chi tiết ticket: Kiểm tra quyền đọc (read) theo RBAC."""
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.category),
            selectinload(Ticket.requester),
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.previous_agent)
        )
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    verify_ticket_access_or_403(ticket, current_user, "read")
    return _format_ticket_response(ticket, current_user=current_user)


@router.put("/{ticket_id}", response_model=TicketResponse)
@router.patch("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    ticket_in: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cập nhật ticket với danh sách trường cho phép (Allowlist) theo từng Role:
    - REQUESTER: Bị chặn hoàn toàn (403).
    - SUPPORT_AGENT (L1/L2):
        * Chỉ cập nhật ticket được giao cho mình (hoặc nhận ticket hợp lệ từ queue).
        * Chỉ được cập nhật: status, category_id, priority.
        * Không được thay đổi: requester_id, assigned_agent_id, support_level, SLA, cờ AI.
        * Mọi thay đổi category/priority được ghi nhận lịch sử xử lý.
    - TEAM_LEAD / ADMIN:
        * Phân công lại assigned_agent_id, điều chỉnh support_level, chuyển cấp, trạng thái.
    """
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.category),
            selectinload(Ticket.requester),
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.previous_agent)
        )
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    # 1. Kiểm tra quyền thao tác ghi chung
    verify_ticket_access_or_403(ticket, current_user, "update")

    # 2. Requester không được phép cập nhật ticket
    if is_requester(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Khách hàng không có quyền cập nhật thông tin ticket."
        )

    update_data = ticket_in.model_dump(exclude_unset=True)
    user_role = get_user_role(current_user)
    is_privileged = user_role in ["ADMIN", "TEAM_LEAD"]

    # 3. Tuyệt đối không cho phép đổi các trường hệ thống cốt lõi
    for immutable in ["id", "ticket_code", "requester_id", "created_at"]:
        update_data.pop(immutable, None)

    # 4. Kiểm tra quyền phân công và các trường nhạy cảm theo RBAC nghiệp vụ (UC-03, TC_BIZ_02)
    # QUY TẮC BẢO MẬT: CHỈ TEAM_LEAD mới được phân công thủ công.
    # SUPPORT_AGENT và REQUESTER tuyệt đối không được phân công (trả 403 theo TC_BIZ_02).
    # ADMIN không có quyền phân công ngầm nếu không được cấp vai trò TEAM_LEAD (trả 403).
    if "assigned_agent_id" in update_data:
        new_agent_id = update_data.pop("assigned_agent_id")
        if new_agent_id != ticket.assigned_agent_id:
            if user_role != "TEAM_LEAD":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Chỉ Trưởng nhóm (TEAM_LEAD) mới có quyền phân công nhân viên xử lý ticket. Kỹ thuật viên (SUPPORT_AGENT) và Quản trị viên (ADMIN) không có quyền phân công."
                )

            # Xử lý phân công hợp lệ bởi TEAM_LEAD
            old_agent_name = ticket.assigned_agent.full_name if ticket.assigned_agent else "Chưa phân công"
            
            if new_agent_id:
                agent_res = await db.execute(
                    select(User).options(selectinload(User.role)).where(User.id == new_agent_id, User.is_active == True)
                )
                new_agent = agent_res.scalars().first()
                if not new_agent:
                    raise HTTPException(
                        status_code=400,
                        detail="Nhân viên được phân công không tồn tại hoặc tài khoản đã bị vô hiệu hóa."
                    )
                new_agent_name = new_agent.full_name or "Kỹ thuật viên"
                
                ticket.previous_agent_id = ticket.assigned_agent_id
                ticket.assigned_agent_id = new_agent_id
                
                # Lưu đúng 1 bản ghi lịch sử nội bộ (is_internal=True)
                assign_history_note = Comment(
                    ticket_id=ticket.id,
                    user_id=current_user.id,
                    content=(
                        f"Trưởng nhóm {current_user.full_name or 'Team Lead'} đã phân công ticket cho: "
                        f"{new_agent_name} (Người xử lý trước: {old_agent_name})."
                    ),
                    is_internal=True,
                    is_ai_generated=False,
                    edited_by_agent=False
                )
                db.add(assign_history_note)
            else:
                ticket.previous_agent_id = ticket.assigned_agent_id
                ticket.assigned_agent_id = None
                assign_history_note = Comment(
                    ticket_id=ticket.id,
                    user_id=current_user.id,
                    content=(
                        f"Trưởng nhóm {current_user.full_name or 'Team Lead'} đã hủy phân công ticket "
                        f"(Người xử lý trước: {old_agent_name}). Ticket chuyển về hàng chờ."
                    ),
                    is_internal=True,
                    is_ai_generated=False,
                    edited_by_agent=False
                )
                db.add(assign_history_note)

    # 5. Kiểm tra quyền của Support Agent đối với các trường nhạy cảm còn lại
    if not is_privileged:
        restricted_agent_fields = [
            "support_level", "is_escalated", "escalation_status",
            "risk_flag", "sentiment", "sentiment_score", "sentiment_reason", "sentiment_evidence",
            "first_response_due_at", "resolution_due_at", "resolved_at", "closed_at"
        ]
        for f in restricted_agent_fields:
            if f in update_data and update_data[f] != getattr(ticket, f):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Kỹ thuật viên không có quyền thay đổi trường '{f}'. Chỉ Trưởng nhóm hoặc Quản trị viên mới được phép."
                )

    # 6. Kiểm tra chuyển trạng thái hợp lệ (Status Transition)
    if "status" in update_data and update_data["status"]:
        new_status = update_data["status"]
        current_status = ticket.status or "NEW"
        allowed = VALID_STATUS_TRANSITIONS.get(current_status, [])
        if new_status != current_status and new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Không thể chuyển trạng thái từ '{current_status}' sang '{new_status}'. Trạng thái hợp lệ: {', '.join(allowed)}"
            )
        now = datetime.utcnow()
        if new_status == "RESOLVED":
            ticket.resolved_at = now
        elif new_status == "CLOSED":
            ticket.closed_at = now
            if not ticket.resolved_at:
                ticket.resolved_at = now

    # 7. Xử lý thay đổi cấp hỗ trợ support_level hoặc hạ cấp L2 về L1
    if "support_level" in update_data or "is_escalated" in update_data:
        wants_l1 = (update_data.get("support_level") == "L1") or (update_data.get("is_escalated") is False)
        if (ticket.support_level == "L2" or ticket.is_escalated) and wants_l1:
            if not is_privileged:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Ticket đã ở cấp L2. Chỉ Quản trị viên hoặc Trưởng nhóm mới có quyền đưa ticket về L1."
                )

    # 8. Cập nhật Category nếu có và ghi nhận lịch sử
    category_changed = False
    if "category_id" in update_data and update_data["category_id"]:
        cat_val = str(update_data.pop("category_id")).strip()
        cat_res = await db.execute(
            select(Category).where(
                or_(
                    Category.id == cat_val,
                    Category.code == cat_val,
                    Category.code == cat_val.upper(),
                    Category.name == cat_val,
                    Category.code == cat_val.upper().replace(" ", "_")
                )
            )
        )
        matched_cat = cat_res.scalars().first()
        if matched_cat and matched_cat.id != ticket.category_id:
            ticket.category_id = matched_cat.id
            ticket.category = matched_cat
            category_changed = True

    # 9. Ghi nhận lịch sử nếu Agent thay đổi priority hoặc category
    priority_changed = False
    if "priority" in update_data and update_data["priority"] != ticket.priority:
        priority_changed = True

    if category_changed or priority_changed:
        audit_note = Comment(
            ticket_id=ticket.id,
            user_id=current_user.id,
            content=(
                f"Kỹ thuật viên {current_user.full_name or 'Hỗ trợ'} đã cập nhật: "
                f"{'Danh mục ' if category_changed else ''}"
                f"{'Mức ưu tiên ' if priority_changed else ''}của ticket."
            ),
            is_internal=True,
            is_ai_generated=False,
            edited_by_agent=True
        )
        db.add(audit_note)

    # 10. Áp dụng các trường hợp lệ còn lại theo allowlist
    allowed_update_fields = {
        "title", "description", "priority", "status", "support_level",
        "is_escalated", "escalation_status", "escalation_reason", "risk_flag"
    }
    for field, value in update_data.items():
        if field in allowed_update_fields and hasattr(ticket, field):
            setattr(ticket, field, value)

    ticket.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(ticket)

    return _format_ticket_response(ticket, current_user=current_user)


@router.post("/{ticket_id}/escalate", response_model=TicketResponse)
async def escalate_ticket_api(
    ticket_id: str,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chuyển cấp ticket lên Tuyến 2 (L2) phù hợp chuyên môn kỹ năng."""
    if is_requester(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Khách hàng không có quyền chuyển cấp trực tiếp."
        )

    # Kiểm tra quyền truy cập ticket của người dùng hiện tại
    t_res = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = t_res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")
    verify_ticket_access_or_403(ticket, current_user, "update")

    if not reason or not reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ghi chú nội bộ giải thích lý do chuyển cấp là bắt buộc."
        )

    try:
        return await ticket_service.escalate_ticket(db, ticket_id, reason=reason.strip(), escalated_by_user_id=current_user.id)
    except Exception as e:
        logger.error(f"[Escalate error]: {e}")
        raise HTTPException(status_code=500, detail=f"Escalate error: {type(e).__name__} - {str(e)}")


@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chỉ Quản trị viên (ADMIN) mới có quyền xóa ticket."""
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện thao tác này. Chỉ Quản trị viên (ADMIN) mới có quyền xóa ticket."
        )

    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalars().first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ticket để xóa.")

    ticket_code = ticket.ticket_code
    await db.delete(ticket)
    await db.commit()

    return {
        "success": True,
        "message": f"Đã xóa thành công ticket {ticket_code}",
        "ticket_id": ticket_id
    }


# ---------------------------------------------------------
# COMMENTS & AUDIT ENFORCEMENT
# ---------------------------------------------------------

@router.get("/{ticket_id}/comments", response_model=List[CommentResponse])
async def list_comments(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Xem danh sách bình luận trên ticket:
    - Kiểm tra quyền truy cập ticket cha (Requester chỉ xem ticket của mình, L1/L2 xem trong phạm vi).
    - Requester chỉ thấy bình luận công khai (is_internal == False).
    """
    t_res = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = t_res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    verify_ticket_access_or_403(ticket, current_user, "read")

    query = (
        select(Comment)
        .where(Comment.ticket_id == ticket_id)
        .options(selectinload(Comment.user).selectinload(User.role))
        .order_by(Comment.created_at.asc())
    )

    if is_requester(current_user):
        query = query.where(Comment.is_internal == False)

    result = await db.execute(query)
    comments = result.scalars().all()

    response = []
    for c in comments:
        user_name = c.user.full_name if c.user and c.user.full_name else "Người dùng"
        role_name = c.user.role.role_name if c.user and c.user.role else "User"

        response.append(CommentResponse(
            id=c.id,
            ticket_id=c.ticket_id,
            user_id=c.user_id,
            user_name=user_name,
            user_role=role_name,
            content=c.content,
            is_internal=bool(c.is_internal),
            is_ai_generated=bool(c.is_ai_generated),
            edited_by_agent=bool(c.edited_by_agent),
            created_at=c.created_at
        ))
    return response


@router.post("/{ticket_id}/comments", response_model=CommentResponse)
async def create_comment(
    ticket_id: str,
    comment_in: CommentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Thêm bình luận mới:
    - Kiểm tra quyền trên ticket cha: Requester chỉ bình luận ticket của mình, Staff bình luận ticket có quyền.
    - Requester KHÔNG được phép tạo ghi chú nội bộ (is_internal) hoặc giả mạo cờ kiểm toán (is_ai_generated, edited_by_agent).
    - Backend tự động xác định các cờ này dựa vào danh tính người dùng thực tế.
    """
    t_res = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = t_res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    verify_ticket_access_or_403(ticket, current_user, "comment")

    user_is_req = is_requester(current_user)

    if user_is_req:
        is_internal_flag = False
        is_ai_flag = False
        edited_by_agent_flag = False
    else:
        is_internal_flag = bool(comment_in.is_internal)
        is_ai_flag = bool(comment_in.is_ai_generated)
        edited_by_agent_flag = bool(comment_in.edited_by_agent) if is_ai_flag else False

    new_comment = Comment(
        ticket_id=ticket_id,
        user_id=current_user.id,
        content=comment_in.content,
        is_internal=is_internal_flag,
        is_ai_generated=is_ai_flag,
        edited_by_agent=edited_by_agent_flag
    )
    db.add(new_comment)

    # Nếu ticket đang ở trạng thái RESOLVED hoặc CLOSED, khách hàng phản hồi sẽ mở lại về PROCESSING
    if ticket.status in ["RESOLVED", "CLOSED"]:
        ticket.status = "PROCESSING"

    # Phân tích Sentiment AI trên phản hồi công khai của Requester
    if user_is_req and not is_internal_flag and comment_in.content and comment_in.content.strip():
        try:
            await ticket_service.evaluate_sentiment_and_auto_escalate(
                db,
                ticket=ticket,
                text_to_analyze=comment_in.content,
                source_type="REQUESTER_COMMENT"
            )
        except Exception as e:
            logger.error(f"[Sentiment on Comment Error]: {e}")

    await db.commit()
    await db.refresh(new_comment)

    # Internal notes stay inside the service desk and are never emailed to customers.
    if not is_internal_flag and comment_in.content and comment_in.content.strip():
        ticket_url = f"https://azmedia247.com/tickets/{ticket.id}"
        author_name = current_user.full_name or current_user.email
        if user_is_req:
            recipients = set()
            if ticket.assigned_agent_id:
                assigned_result = await db.execute(
                    select(User.email).where(
                        User.id == ticket.assigned_agent_id, User.is_active.is_(True)
                    )
                )
                assigned_email = assigned_result.scalar_one_or_none()
                if assigned_email:
                    recipients.add(assigned_email)
            admins_result = await db.execute(
                select(User.email).join(User.role).where(
                    User.is_active.is_(True), Role.role_name == "ADMIN"
                )
            )
            recipients.update(admins_result.scalars().all())
            recipients.discard(current_user.email)
            subject = f"Khách hàng phản hồi {ticket.ticket_code} - IT Service Desk"
            heading = "Khách hàng đã phản hồi yêu cầu"
        else:
            requester_result = await db.execute(
                select(User.email).where(
                    User.id == ticket.requester_id, User.is_active.is_(True)
                )
            )
            requester_email = requester_result.scalar_one_or_none()
            recipients = {requester_email} if requester_email else set()
            subject = f"Cập nhật mới cho yêu cầu {ticket.ticket_code} - IT Service Desk"
            heading = f"{author_name} đã phản hồi yêu cầu của bạn"

        for email in recipients:
            background_tasks.add_task(
                send_ticket_notification_email,
                email,
                subject,
                heading,
                ticket.ticket_code,
                ticket.title,
                ticket_url,
            )

    return CommentResponse(
        id=new_comment.id,
        ticket_id=new_comment.ticket_id,
        user_id=new_comment.user_id,
        user_name=current_user.full_name or "Người dùng",
        user_role=get_user_role(current_user),
        content=new_comment.content,
        is_internal=new_comment.is_internal,
        is_ai_generated=new_comment.is_ai_generated,
        edited_by_agent=new_comment.edited_by_agent,
        created_at=new_comment.created_at
    )


# ---------------------------------------------------------
# ATTACHMENTS WITH RBAC
# ---------------------------------------------------------

@router.post("/{ticket_id}/attachments")
async def upload_attachment(
    ticket_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tải tệp đính kèm: Kiểm tra quyền trên ticket cha, loại tệp, magic bytes và kích thước."""
    t_res = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = t_res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    # Requester chỉ upload ticket của mình; Agent upload ticket được giao/trong queue
    action = "comment" if is_requester(current_user) else "attachment"
    verify_ticket_access_or_403(ticket, current_user, action)

    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng file không được hỗ trợ. Chỉ chấp nhận: {', '.join(ALLOWED_ATTACHMENT_EXTENSIONS)}"
        )

    file_content = await file.read()
    if len(file_content) > MAX_ATTACHMENT_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File quá lớn. Kích thước tối đa cho phép: {MAX_ATTACHMENT_SIZE_BYTES // (1024*1024)} MB."
        )

    detected_mime = _validate_file_magic_bytes(file_content[:16])
    if detected_mime is None or detected_mime not in ALLOWED_ATTACHMENT_MIMES:
        raise HTTPException(
            status_code=400,
            detail="Nội dung file không khớp với định dạng ảnh hợp lệ (PNG/JPG/WEBP). File có thể bị đổi đuôi giả mạo."
        )

    count_q = await db.execute(
        select(func.count(Attachment.id)).where(Attachment.ticket_id == ticket_id)
    )
    current_count = count_q.scalar() or 0
    if current_count >= MAX_ATTACHMENTS_PER_TICKET:
        raise HTTPException(
            status_code=400,
            detail=f"Ticket này đã đạt giới hạn {MAX_ATTACHMENTS_PER_TICKET} ảnh đính kèm."
        )

    ticket_upload_dir = os.path.join(UPLOAD_DIR, ticket_id)
    os.makedirs(ticket_upload_dir, exist_ok=True)
    safe_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(ticket_upload_dir, safe_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(file_content)

    attachment = Attachment(
        ticket_id=ticket_id,
        uploader_id=current_user.id,
        file_name=file.filename or safe_filename,
        file_path=file_path,
        file_type=detected_mime,
        file_size=len(file_content),
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return {
        "id": attachment.id,
        "file_name": attachment.file_name,
        "file_type": attachment.file_type,
        "file_size": attachment.file_size,
    }


@router.get("/{ticket_id}/attachments")
async def list_attachments(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liệt kê danh sách ảnh đính kèm có kiểm tra quyền xem ticket."""
    t_res = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = t_res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    verify_ticket_access_or_403(ticket, current_user, "read")

    result = await db.execute(
        select(Attachment)
        .where(Attachment.ticket_id == ticket_id)
        .order_by(Attachment.created_at.asc())
    )
    attachments = result.scalars().all()
    return [
        {
            "id": a.id,
            "file_name": a.file_name,
            "file_type": a.file_type,
            "file_size": a.file_size,
            "created_at": a.created_at,
        }
        for a in attachments
    ]


@router.get("/{ticket_id}/attachments/{attachment_id}/file")
async def serve_attachment_file(
    ticket_id: str,
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Phục vụ file ảnh đính kèm: Kiểm tra quyền xem ticket cha trước khi gửi file."""
    t_res = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = t_res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    verify_ticket_access_or_403(ticket, current_user, "read")

    result = await db.execute(
        select(Attachment).where(
            Attachment.id == attachment_id,
            Attachment.ticket_id == ticket_id,
        )
    )
    attachment = result.scalars().first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh đính kèm.")

    if not os.path.isfile(attachment.file_path):
        raise HTTPException(status_code=404, detail="File ảnh không tồn tại trên máy chủ.")

    return FileResponse(
        path=attachment.file_path,
        media_type=attachment.file_type or "application/octet-stream",
        filename=attachment.file_name,
    )


# ---------------------------------------------------------
# AI ENDPOINTS: TẢI TRỰC TIẾP TỪ DB + CHE PII + RBAC
# ---------------------------------------------------------

class ClassifyRequest(BaseModel):
    description: Optional[str] = None

class SuggestReplyRequest(BaseModel):
    ticket_context: Optional[str] = None

class SummarizeRequest(BaseModel):
    comments: Optional[list[str]] = None


@router.post("/{ticket_id}/classify")
async def classify_ticket_api(
    ticket_id: str,
    request: Optional[ClassifyRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    AI Triage & Phân loại:
    - Backend tự tải thông tin ticket từ database sau khi kiểm tra quyền (verify_ticket_access_or_403).
    - Không nhận context tùy ý từ client để tránh vượt quyền.
    - Che PII trước khi gửi cho mô hình AI.
    """
    t_res = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = t_res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    verify_ticket_access_or_403(ticket, current_user, "ai")

    source_text = f"{ticket.title or ''}\n{ticket.description or ''}".strip()
    masked_text = PIIMasker.mask_text(source_text)
    has_pii = masked_text != source_text

    result = await ai_triage_ticket(masked_text)

    from app.ai.key_manager import gemini_key_manager
    config = gemini_key_manager.get_config()
    confidence_threshold = float(config.get("confidence_threshold", 0.80))

    # Nếu phát hiện cảm xúc tiêu cực gay gắt hoặc rủi ro cao, cập nhật cờ rủi ro cảnh báo cho nhân viên
    if result.sentiment == "negative" or result.risk_level == "high":
        ticket.risk_flag = "HIGH"
        ticket.sentiment = "NEGATIVE"
        if result.confidence_score is not None:
            ticket.sentiment_score = result.confidence_score
        if result.rationale:
            ticket.sentiment_reason = result.rationale
    elif (result.confidence_score is not None and result.confidence_score < confidence_threshold) or (result.risk_level == "medium" and ticket.risk_flag == "NORMAL"):
        ticket.risk_flag = "CHECK_REQUIRED"

    ai_log = AILog(
        ticket_id=ticket_id,
        task_type="CLASSIFY",
        model_name="gemini-2.5-flash",
        pii_detected=has_pii,
        agent_action="AGENT_RECLASSIFY"
    )
    db.add(ai_log)
    await db.commit()

    return {
        "category": result.category_code,
        "category_code": result.category_code,
        "priority": result.priority,
        "confidence_score": result.confidence_score,
        "sentiment": result.sentiment,
        "risk_level": result.risk_level,
        "likely_exceeds_l1": result.likely_exceeds_l1,
        "rationale": result.rationale,
        "missing_information": result.missing_information
    }


@router.post("/{ticket_id}/suggest-reply")
async def suggest_reply_api(
    ticket_id: str,
    request: Optional[SuggestReplyRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    AI Soạn thảo phản hồi gợi ý (Copilot):
    - Tải ticket và lịch sử trao đổi trực tiếp từ DB.
    - Truy xuất tài liệu kho tri thức và chính sách liên quan (RAG).
    - Kiểm tra quyền truy cập công cụ AI của nhân viên.
    - Che PII trước khi gửi cho AI.
    """
    t_res = await db.execute(
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(selectinload(Ticket.requester), selectinload(Ticket.assigned_agent))
    )
    ticket = t_res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    verify_ticket_access_or_403(ticket, current_user, "ai")

    # Lấy các bình luận liên quan từ DB, nạp thông tin user và role
    c_res = await db.execute(
        select(Comment)
        .where(Comment.ticket_id == ticket_id)
        .options(selectinload(Comment.user).selectinload(User.role))
        .order_by(Comment.created_at.asc())
    )
    comments = c_res.scalars().all()

    # Kiểm tra danh sách ảnh đính kèm từ quan hệ của ticket nếu có
    attachments_note = ""
    try:
        ticket_attachments = ticket.attachments if hasattr(ticket, 'attachments') and ticket.attachments else []
        if ticket_attachments:
            att_names = [f"'{getattr(a, 'file_name', 'ảnh lỗi')}'" for a in ticket_attachments]
            attachments_note = f" [Khách hàng có đính kèm {len(ticket_attachments)} ảnh chụp màn hình sự cố: {', '.join(att_names)}]"
    except Exception:
        pass

    req_name = ticket.requester.full_name if ticket.requester and ticket.requester.full_name else "Khách hàng"
    req_dept = ticket.requester.department if ticket.requester and ticket.requester.department else "Người dùng"
    
    conversation_parts = [
        f"[KHÁCH HÀNG - {req_name}] (Mô tả sự cố ban đầu): {ticket.description}{attachments_note}"
    ]

    public_comments = []
    agent_public_comments = []
    customer_comments = []

    for c in comments:
        is_req = (c.user_id == ticket.requester_id) or (c.user and c.user.role and c.user.role.role_name == "REQUESTER")
        author_name = c.user.full_name if c.user and c.user.full_name else ("Khách hàng" if is_req else "Kỹ thuật viên")
        
        if c.is_internal:
            conversation_parts.append(f"[GHI CHÚ NỘI BỘ IT] ({author_name}): {c.content}")
        else:
            public_comments.append(c)
            if is_req:
                customer_comments.append(c)
                conversation_parts.append(f"[KHÁCH HÀNG - {author_name}]: {c.content}")
            else:
                agent_public_comments.append(c)
                conversation_parts.append(f"[KỸ THUẬT VIÊN IT - {author_name}]: {c.content}")

    is_first_response = len(agent_public_comments) == 0

    if public_comments:
        last_comment = public_comments[-1]
        last_is_customer = (last_comment.user_id == ticket.requester_id) or (last_comment.user and last_comment.user.role and last_comment.user.role.role_name == "REQUESTER")
        last_author_name = last_comment.user.full_name if last_comment.user and last_comment.user.full_name else ("Khách hàng" if last_is_customer else "Kỹ thuật viên")
        latest_author = f"Khách hàng ({last_author_name})" if last_is_customer else f"Kỹ thuật viên ({last_author_name})"
        latest_text = last_comment.content
    else:
        last_is_customer = True
        latest_author = f"Khách hàng ({req_name})"
        latest_text = ticket.description

    # Tin nhắn khách hàng mới nhất (dùng để tra cứu RAG phù hợp nhất)
    latest_customer_text = customer_comments[-1].content if customer_comments else ticket.description

    # Tình trạng chuyển cấp
    if ticket.escalation_status in ["AUTO_ESCALATED", "MANUAL_ESCALATED"] or ticket.support_level == "L2":
        escalation_info = f"Ticket đã chuyển cấp lên {ticket.support_level or 'L2'} (Lý do: {ticket.escalation_reason or 'Vấn đề chuyên sâu hoặc khẩn cấp'})"
    else:
        escalation_info = f"Ticket đang xử lý ở cấp {ticket.support_level or 'L1'}"

    # Tra cứu cơ sở tri thức (RAG) phù hợp với diễn biến trao đổi mới nhất
    from app.ai.chat_assistant import _retrieve_knowledge_context
    rag_query = f"{ticket.title or ''} {latest_customer_text or ''}".strip()
    retrieval_res = await _retrieve_knowledge_context(db, rag_query, current_user=current_user)
    kb_context = retrieval_res[0] if (isinstance(retrieval_res, tuple) and len(retrieval_res) > 0) else ""

    full_context = "\n".join(conversation_parts)
    masked_history = PIIMasker.mask_text(full_context)
    masked_latest = PIIMasker.mask_text(latest_text)
    has_pii = (masked_history != full_context) or (masked_latest != latest_text)

    agent_name = current_user.full_name or "Kỹ thuật viên IT"

    result = await ai_draft_reply(
        description=masked_latest,
        kb_context=kb_context,
        ticket_code=ticket.ticket_code,
        title=ticket.title,
        customer_name=req_name,
        customer_dept=req_dept,
        agent_name=agent_name,
        support_level=ticket.support_level or "L1",
        status=ticket.status,
        escalation_info=escalation_info,
        conversation_history=masked_history,
        latest_message_author=latest_author,
        latest_message_text=masked_latest,
        is_first_response=is_first_response,
        last_is_customer=last_is_customer
    )

    ai_log = AILog(
        ticket_id=ticket_id,
        task_type="COPILOT",
        model_name="gemini-2.5-flash",
        pii_detected=has_pii,
        agent_action="DRAFT_SUGGESTED"
    )
    db.add(ai_log)
    await db.commit()

    import re
    cleaned_draft = result.draft_reply or ""
    cleaned_draft = re.sub(r'\*\*(.*?)\*\*', r'\1', cleaned_draft)
    cleaned_draft = re.sub(r'__(.*?)__', r'\1', cleaned_draft)
    cleaned_draft = re.sub(r'(?<!\*)\*(?!\s)(.*?)(?!\s)\*(?!\*)', r'\1', cleaned_draft).strip()

    return {
        "draft_reply": cleaned_draft,
        "suggested_reply": cleaned_draft,
        "needs_more_info": result.needs_more_info,
        "has_rag_context": bool(kb_context.strip())
    }


@router.post("/{ticket_id}/summarize")
async def summarize_history_api(
    ticket_id: str,
    request: Optional[SummarizeRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    AI Tóm tắt tiến trình xử lý ticket:
    - Tải toàn bộ trao đổi trực tiếp từ Database.
    - Che PII trước khi gọi AI Summarizer.
    - Cập nhật tóm tắt vào trường ai_summary của ticket.
    """
    t_res = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = t_res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    verify_ticket_access_or_403(ticket, current_user, "ai")

    c_res = await db.execute(
        select(Comment)
        .where(Comment.ticket_id == ticket_id)
        .order_by(Comment.created_at.asc())
    )
    comments = c_res.scalars().all()

    history_lines = [f"Mô tả: {ticket.description}"] + [c.content for c in comments if c.content]
    history_text = "\n".join(history_lines)

    masked_history = PIIMasker.mask_text(history_text)
    has_pii = masked_history != history_text

    result = await ai_summarize_ticket(masked_history)
    summary_formatted = f"• Vấn đề chính: {result.core_issue}\n• Tiến trình: {result.progress}\n• Hành động tiếp theo: {result.next_actions}"

    ai_log = AILog(
        ticket_id=ticket_id,
        task_type="SUMMARIZE",
        model_name="gemini-2.5-flash",
        pii_detected=has_pii,
        agent_action="SUMMARIZE_HISTORY"
    )
    db.add(ai_log)

    ticket.ai_summary = summary_formatted
    await db.commit()

    return {
        "core_issue": result.core_issue,
        "progress": result.progress,
        "next_actions": result.next_actions,
        "summary": summary_formatted
    }


# ---------------------------------------------------------
# REQUESTER AI ASSISTANT CHAT (SCOPED IT SUPPORT)
# ---------------------------------------------------------

@router.post("/assistant/chat", response_model=ChatAssistantResponse)
async def chat_with_assistant(
    request: ChatAssistantRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Trợ lý AI dành cho Requester / Người dùng:
    - Giới hạn chủ đề CNTT (Tài khoản, phần mềm, thiết bị, mạng, quyền truy cập, FAQ, SLA, tạo/theo dõi ticket).
    - Thực thi phân loại và chặn câu hỏi ngoài phạm vi trực tiếp ở backend (trả về OUT_OF_SCOPE).
    - Nạp ngữ cảnh từ FAQ và chính sách SLA chính thống trong DB.
    - Che PII trước khi gọi mô hình.
    """
    return await process_chat_assistant_message(
        db=db,
        user_query=request.message,
        history=request.history,
        current_user=current_user
    )


# ---------------------------------------------------------
# SYSTEM & TICKET NOTIFICATIONS ENDPOINT
# ---------------------------------------------------------

@router.get("/notifications/list")
async def get_user_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tự động truy xuất danh sách thông báo thực tế theo vai trò người dùng:
    - Ticket sắp vi phạm SLA hoặc đã quá hạn
    - Ticket vừa được AI phân loại hoặc vừa tạo mới
    - Ticket được cập nhật tiến độ / phản hồi mới
    """
    now = datetime.utcnow()
    query = select(Ticket).options(
        selectinload(Ticket.category),
        selectinload(Ticket.requester),
        selectinload(Ticket.assigned_agent)
    )
    query = apply_ticket_scope(query, current_user)
    query = query.order_by(Ticket.created_at.desc()).limit(15)
    
    result = await db.execute(query)
    tickets = result.scalars().all()
    
    notifications = []
    
    for t in tickets:
        cat_name = t.category.name if t.category else "Hỗ trợ Kỹ thuật"
        code = t.ticket_code or f"TCK-{str(t.id)[:6]}"
        
        # 1. Kiểm tra nguy cơ vi phạm SLA
        if t.status in ["NEW", "ASSIGNED", "IN_PROGRESS", "ESCALATED"] and t.resolution_due_at:
            time_left = t.resolution_due_at - now
            minutes_left = int(time_left.total_seconds() / 60)
            if minutes_left < 0:
                notifications.append({
                    "id": f"sla-breach-{t.id}",
                    "ticket_id": str(t.id),
                    "title": f"Cảnh báo vi phạm SLA: {code}",
                    "desc": f"Ticket '{t.title}' đã quá hạn giải quyết {abs(minutes_left)} phút! Vui lòng ưu tiên xử lý.",
                    "time": "Vừa xong",
                    "type": "danger",
                    "link": f"/tickets/{t.id}"
                })
            elif minutes_left <= 120:
                hours_left = max(1, round(minutes_left / 60))
                notifications.append({
                    "id": f"sla-warn-{t.id}",
                    "ticket_id": str(t.id),
                    "title": "Ticket sắp vi phạm SLA!",
                    "desc": f"Ticket {code} còn {hours_left} giờ trước thời hạn giải quyết ({cat_name}).",
                    "time": f"{min(59, max(1, 120 - minutes_left))} phút trước",
                    "type": "danger",
                    "link": f"/tickets/{t.id}"
                })
        
        # 2. Thông báo phân loại tự động AI hoặc tạo mới
        if t.created_at:
            age_min = int((now - t.created_at).total_seconds() / 60)
            if age_min < 1440:  # Trong vòng 24 giờ
                time_str = "Vừa xong" if age_min < 5 else f"{age_min} phút trước" if age_min < 60 else f"{int(age_min/60)} giờ trước"
                notifications.append({
                    "id": f"ai-triage-{t.id}",
                    "ticket_id": str(t.id),
                    "title": "Phân loại tự động thành công",
                    "desc": f"Ticket {code} đã được phân loại vào nhóm {cat_name} (Ưu tiên: {t.priority}).",
                    "time": time_str,
                    "type": "info",
                    "link": f"/tickets/{t.id}"
                })
                
        # 3. Thông báo ticket giải quyết thành công
        if t.status == "RESOLVED":
            notifications.append({
                "id": f"resolved-{t.id}",
                "ticket_id": str(t.id),
                "title": "Ticket đã được giải quyết",
                "desc": f"Kỹ thuật viên đã hoàn tất hỗ trợ cho ticket {code}.",
                "time": "Hôm nay",
                "type": "success",
                "link": f"/tickets/{t.id}"
            })

    # Giữ tối đa 10 thông báo mới nhất
    return notifications[:10]
