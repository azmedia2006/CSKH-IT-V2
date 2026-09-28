from sqlalchemy import or_, and_
from fastapi import HTTPException, status
from app.models.user import User
from app.models.ticket import Ticket


def get_user_role(user: User) -> str:
    """Trả về role_name chuẩn của user ('ADMIN', 'TEAM_LEAD', 'SUPPORT_AGENT', 'REQUESTER')."""
    if not user:
        return "ANONYMOUS"
    if hasattr(user, "role") and user.role and hasattr(user.role, "role_name"):
        return user.role.role_name or "REQUESTER"
    return getattr(user, "role_name", None) or "REQUESTER"


def is_admin(user: User) -> bool:
    return get_user_role(user) == "ADMIN"


def is_team_lead(user: User) -> bool:
    return get_user_role(user) == "TEAM_LEAD"


def is_support_agent(user: User) -> bool:
    return get_user_role(user) == "SUPPORT_AGENT"


def is_requester(user: User) -> bool:
    return get_user_role(user) == "REQUESTER"


def is_l1_agent(user: User) -> bool:
    if not is_support_agent(user):
        return False
    return (user.support_level or "L1") == "L1"


def is_l2_agent(user: User) -> bool:
    if not is_support_agent(user):
        return False
    return user.support_level == "L2"


def is_staff(user: User) -> bool:
    return get_user_role(user) in ["ADMIN", "TEAM_LEAD", "SUPPORT_AGENT"]


def apply_ticket_scope(query, user: User):
    """
    Áp dụng phạm vi truy cập dữ liệu Ticket theo đúng phân quyền (RBAC):
    - Requester: Chỉ xem được ticket do chính mình tạo.
    - Support Agent L1: Chỉ xem ticket được giao hoặc hàng đợi L1 chưa gán.
    - Support Agent L2: Chỉ xem ticket được giao hoặc hàng đợi L2 (L2_WAITING / đã chuyển cấp).
    - Team Lead: Xem toàn bộ ticket trong phạm vi quản lý vận hành kỹ thuật.
    - Admin: Toàn quyền xem mọi ticket trên hệ thống.
    """
    role = get_user_role(user)

    if role == "REQUESTER":
        return query.where(Ticket.requester_id == user.id)

    if role == "SUPPORT_AGENT":
        if is_l2_agent(user):
            # L2: Ticket được giao HOẶC hàng đợi L2 (L2_WAITING / chưa có ai nhận / đã chuyển cấp)
            return query.where(
                or_(
                    Ticket.assigned_agent_id == user.id,
                    and_(
                        Ticket.support_level == "L2",
                        or_(
                            Ticket.escalation_status == "L2_WAITING",
                            Ticket.assigned_agent_id == None,
                            Ticket.is_escalated == True
                        )
                    )
                )
            )
        else:
            # L1: Ticket được giao HOẶC hàng đợi L1 chưa phân công
            return query.where(
                or_(
                    Ticket.assigned_agent_id == user.id,
                    and_(
                        or_(Ticket.support_level == "L1", Ticket.support_level == None),
                        Ticket.assigned_agent_id == None
                    )
                )
            )

    # TEAM_LEAD & ADMIN xem toàn bộ danh sách ticket hỗ trợ
    return query


def check_ticket_access(ticket: Ticket, user: User, action: str = "read") -> bool:
    """
    Kiểm tra quyền truy cập trên một bản ghi Ticket cụ thể.
    action: 'read', 'update', 'comment', 'attachment', 'ai', 'delete', 'assign'
    
    Quy tắc phân quyền (RBAC theo báo cáo nghiệp vụ UC-03 & TC_BIZ_02):
    - 'assign' (phân công): CHỈ TEAM_LEAD được phân công thủ công.
      ADMIN không tự suy diễn quyền phân công nếu không được cấp vai trò TEAM_LEAD.
      SUPPORT_AGENT và REQUESTER tuyệt đối không có quyền phân công (trả về 403).
    """
    if not ticket or not user:
        return False

    role = get_user_role(user)

    # 1. Thao tác Phân công (Assign): CHỈ DÀNH RIÊNG CHO TEAM_LEAD
    if action == "assign":
        return role == "TEAM_LEAD"

    # 2. ADMIN có toàn quyền các tác vụ quản trị hệ thống (trừ 'assign' đã được tách riêng ở trên)
    if role == "ADMIN":
        return True

    # 3. Xóa ticket chỉ dành cho ADMIN
    if action == "delete":
        return False

    # 4. REQUESTER
    if role == "REQUESTER":
        if action in ["read", "comment", "attachment"]:
            return ticket.requester_id == user.id
        # Requester không được update trực tiếp hoặc gọi AI nội bộ
        return False

    # 5. SUPPORT AGENT L2
    if role == "SUPPORT_AGENT" and is_l2_agent(user):
        if action == "read":
            return (
                ticket.assigned_agent_id == user.id
                or (
                    ticket.support_level == "L2"
                    and (
                        ticket.escalation_status == "L2_WAITING"
                        or ticket.assigned_agent_id is None
                        or ticket.is_escalated is True
                    )
                )
            )
        if action == "update":
            # Có thể cập nhật ticket được giao cho mình HOẶC nhận ticket từ hàng đợi L2
            return (
                ticket.assigned_agent_id == user.id
                or (ticket.support_level == "L2" and ticket.assigned_agent_id is None)
            )
        if action in ["comment", "attachment", "ai"]:
            return (
                ticket.assigned_agent_id == user.id
                or (
                    ticket.support_level == "L2"
                    and (
                        ticket.escalation_status == "L2_WAITING"
                        or ticket.assigned_agent_id is None
                        or ticket.is_escalated is True
                    )
                )
            )

    # 6. SUPPORT AGENT L1
    if role == "SUPPORT_AGENT" and is_l1_agent(user):
        if action == "read":
            return (
                ticket.assigned_agent_id == user.id
                or (
                    (ticket.support_level in ["L1", None])
                    and ticket.assigned_agent_id is None
                )
            )
        if action == "update":
            # L1 chỉ được cập nhật ticket ĐƯỢC GIAO cho chính mình
            return ticket.assigned_agent_id == user.id
        if action in ["comment", "attachment", "ai"]:
            return (
                ticket.assigned_agent_id == user.id
                or (
                    (ticket.support_level in ["L1", None])
                    and ticket.assigned_agent_id is None
                )
            )

    # 7. TEAM LEAD
    if role == "TEAM_LEAD":
        # Team lead có quyền xem, phân công, cập nhật, phản hồi ticket kỹ thuật
        return True

    return False


def verify_ticket_access_or_403(ticket: Ticket, user: User, action: str = "read"):
    """Ném lỗi 403 Forbidden nếu user không đủ quyền truy cập ticket."""
    if not check_ticket_access(ticket, user, action):
        action_names = {
            "read": "xem thông tin",
            "update": "cập nhật",
            "comment": "bình luận trên",
            "attachment": "thao tác tệp đính kèm trên",
            "ai": "sử dụng công cụ AI cho",
            "delete": "xóa",
            "assign": "phân công nhân viên xử lý"
        }
        name = action_names.get(action, action)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Bạn không có quyền {name} ticket này."
        )
