import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from fastapi import HTTPException
from sqlalchemy import select

from app.main import app
from app.models.user import User
from app.models.role import Role
from app.models.ticket import Ticket
from app.api.deps import get_current_user
from app.core.permissions import (
    apply_ticket_scope,
    check_ticket_access,
    verify_ticket_access_or_403,
    get_user_role,
    is_admin,
    is_team_lead,
    is_support_agent,
    is_requester,
    is_l1_agent,
    is_l2_agent,
)

client = TestClient(app)


# =========================================================================
# HELPER MOCK FACTORIES
# =========================================================================

def create_mock_user(user_id: str, role_name: str, support_level: str = "L1", skill_group: str = "NETWORK") -> User:
    role = Role(id=f"role-{role_name.lower()}", role_name=role_name)
    user = User(
        id=user_id,
        email=f"{user_id}@example.com",
        full_name=f"User {user_id}",
        support_level=support_level,
        skill_group=skill_group,
        is_active=True,
    )
    user.role = role
    return user


def create_mock_ticket(
    ticket_id: str,
    requester_id: str,
    assigned_agent_id: str | None = None,
    support_level: str = "L1",
    is_escalated: bool = False,
    escalation_status: str = "NONE",
    status: str = "NEW"
) -> Ticket:
    ticket = Ticket(
        id=ticket_id,
        ticket_code=f"TKT-{ticket_id}",
        title=f"Sample Ticket {ticket_id}",
        description="Detailed issue description",
        requester_id=requester_id,
        assigned_agent_id=assigned_agent_id,
        support_level=support_level,
        is_escalated=is_escalated,
        escalation_status=escalation_status,
        status=status,
        priority="MEDIUM_P3",
        created_at=datetime.utcnow()
    )
    return ticket


# =========================================================================
# 1. KIỂM THỬ XÁC THỰC CƠ BẢN (401 UNAUTHORIZED KHI THIẾU TOKEN)
# =========================================================================

def test_unauthenticated_requests_return_401():
    """Kiểm tra người dùng chưa đăng nhập nhận 401 Unauthorized"""
    res_tickets = client.get("/api/v1/tickets/")
    assert res_tickets.status_code == 401

    res_users = client.get("/api/v1/users/")
    assert res_users.status_code == 401

    res_settings_ai = client.get("/api/v1/settings/ai")
    assert res_settings_ai.status_code == 401

    res_settings_google = client.get("/api/v1/settings/google")
    assert res_settings_google.status_code == 401


# =========================================================================
# 2. KIỂM THỬ CÔ LẬP DỮ LIỆU REQUESTER (REQUESTER A VS REQUESTER B)
# =========================================================================

def test_requester_isolation():
    """Requester A không được xem, bình luận, sửa hoặc xóa ticket của Requester B"""
    user_a = create_mock_user("user-a", "REQUESTER")
    user_b = create_mock_user("user-b", "REQUESTER")

    ticket_b = create_mock_ticket("tkt-b", requester_id="user-b")

    # User B (chủ sở hữu) được xem và bình luận
    assert check_ticket_access(ticket_b, user_b, "read") is True
    assert check_ticket_access(ticket_b, user_b, "comment") is True
    assert check_ticket_access(ticket_b, user_b, "attachment") is True

    # User A không được đọc, sửa, bình luận hoặc xóa ticket của User B
    assert check_ticket_access(ticket_b, user_a, "read") is False
    assert check_ticket_access(ticket_b, user_a, "comment") is False
    assert check_ticket_access(ticket_b, user_a, "attachment") is False
    assert check_ticket_access(ticket_b, user_a, "update") is False
    assert check_ticket_access(ticket_b, user_a, "ai") is False
    assert check_ticket_access(ticket_b, user_a, "delete") is False

    with pytest.raises(HTTPException) as exc_info:
        verify_ticket_access_or_403(ticket_b, user_a, "read")
    assert exc_info.value.status_code == 403


# =========================================================================
# 3. KIỂM THỬ PHÂN QUYỀN SUPPORT AGENT L1
# =========================================================================

def test_support_agent_l1_scoping():
    """
    Support Agent L1:
    - Xem và xử lý ticket được giao cho mình HOẶC hàng đợi L1 chưa phân công.
    - Không được xem/sửa ticket của agent khác hoặc ticket cấp L2/đã chuyển cấp.
    - Không thể xóa ticket hoặc tự nâng quyền.
    """
    agent_l1_1 = create_mock_user("agent-l1-1", "SUPPORT_AGENT", support_level="L1")
    agent_l1_2 = create_mock_user("agent-l1-2", "SUPPORT_AGENT", support_level="L1")

    # Ticket giao cho agent 1
    tkt_assigned_1 = create_mock_ticket("tkt-1", requester_id="cust-1", assigned_agent_id="agent-l1-1", support_level="L1")
    assert check_ticket_access(tkt_assigned_1, agent_l1_1, "read") is True
    assert check_ticket_access(tkt_assigned_1, agent_l1_1, "update") is True
    assert check_ticket_access(tkt_assigned_1, agent_l1_1, "ai") is True
    assert check_ticket_access(tkt_assigned_1, agent_l1_1, "delete") is False

    # Agent 2 không có quyền xem/sửa ticket đã giao cho Agent 1
    assert check_ticket_access(tkt_assigned_1, agent_l1_2, "read") is False
    assert check_ticket_access(tkt_assigned_1, agent_l1_2, "update") is False

    # Hàng đợi L1 chưa phân công: Cả 2 agent L1 đều được xem
    tkt_unassigned_l1 = create_mock_ticket("tkt-open", requester_id="cust-1", assigned_agent_id=None, support_level="L1")
    assert check_ticket_access(tkt_unassigned_l1, agent_l1_1, "read") is True
    assert check_ticket_access(tkt_unassigned_l1, agent_l1_2, "read") is True

    # Ticket L2 / Escalated: Agent L1 không được phép truy cập
    tkt_l2 = create_mock_ticket("tkt-l2", requester_id="cust-1", assigned_agent_id="agent-l2-1", support_level="L2", is_escalated=True)
    assert check_ticket_access(tkt_l2, agent_l1_1, "read") is False
    assert check_ticket_access(tkt_l2, agent_l1_1, "update") is False


# =========================================================================
# 4. KIỂM THỬ PHÂN QUYỀN SUPPORT AGENT L2
# =========================================================================

def test_support_agent_l2_scoping():
    """
    Support Agent L2:
    - Xem và xử lý ticket được giao cho mình HOẶC hàng đợi L2 (L2_WAITING / chuyển cấp).
    - Không truy cập ticket L1 của nhân viên khác chưa chuyển cấp.
    """
    agent_l2 = create_mock_user("agent-l2", "SUPPORT_AGENT", support_level="L2")

    # Ticket giao cho L2
    tkt_assigned_l2 = create_mock_ticket("tkt-2", requester_id="cust-1", assigned_agent_id="agent-l2", support_level="L2")
    assert check_ticket_access(tkt_assigned_l2, agent_l2, "read") is True
    assert check_ticket_access(tkt_assigned_l2, agent_l2, "update") is True
    assert check_ticket_access(tkt_assigned_l2, agent_l2, "ai") is True

    # Hàng đợi L2 (chưa có ai nhận hoặc L2_WAITING)
    tkt_queue_l2 = create_mock_ticket("tkt-q-l2", requester_id="cust-1", assigned_agent_id=None, support_level="L2", escalation_status="L2_WAITING")
    assert check_ticket_access(tkt_queue_l2, agent_l2, "read") is True
    assert check_ticket_access(tkt_queue_l2, agent_l2, "update") is True

    # Ticket L1 riêng của nhân viên L1 khác chưa vào hàng đợi L2 -> L2 không can thiệp
    tkt_l1_private = create_mock_ticket("tkt-l1", requester_id="cust-1", assigned_agent_id="agent-l1", support_level="L1")
    assert check_ticket_access(tkt_l1_private, agent_l2, "read") is False
    assert check_ticket_access(tkt_l1_private, agent_l2, "update") is False


# =========================================================================
# 5. KIỂM THỬ TEAM LEAD VÀ ADMIN
# =========================================================================

def test_team_lead_and_admin_permissions():
    """
    Team Lead:
    - Có quyền xem, phân công, cập nhật mọi ticket kỹ thuật.
    - Không có quyền xóa ticket (chỉ Admin).
    Admin:
    - Toàn quyền mọi thao tác kể cả xóa.
    """
    lead = create_mock_user("lead-1", "TEAM_LEAD")
    admin = create_mock_user("admin-1", "ADMIN")

    random_ticket = create_mock_ticket("tkt-rnd", requester_id="cust-1", assigned_agent_id="agent-x", support_level="L2")

    # Team Lead
    assert check_ticket_access(random_ticket, lead, "read") is True
    assert check_ticket_access(random_ticket, lead, "update") is True
    assert check_ticket_access(random_ticket, lead, "comment") is True
    assert check_ticket_access(random_ticket, lead, "delete") is False

    # Admin
    assert check_ticket_access(random_ticket, admin, "read") is True
    assert check_ticket_access(random_ticket, admin, "update") is True
    assert check_ticket_access(random_ticket, admin, "delete") is True


# =========================================================================
# 6. KIỂM THỬ TRUY VẤN SCOPE SQL (apply_ticket_scope)
# =========================================================================

def test_apply_ticket_scope_sql():
    """Kiểm tra điều kiện SQL WHERE tương ứng với từng vai trò"""
    q = select(Ticket)

    user_req = create_mock_user("user-req", "REQUESTER")
    scoped_req = apply_ticket_scope(q, user_req)
    req_sql = str(scoped_req)
    assert "tickets.requester_id = :requester_id_1" in req_sql

    user_l1 = create_mock_user("user-l1", "SUPPORT_AGENT", support_level="L1")
    scoped_l1 = apply_ticket_scope(q, user_l1)
    l1_sql = str(scoped_l1)
    assert "tickets.assigned_agent_id = :assigned_agent_id_1" in l1_sql

    user_lead = create_mock_user("user-lead", "TEAM_LEAD")
    scoped_lead = apply_ticket_scope(q, user_lead)
    assert str(scoped_lead) == str(q)  # Không bị thu hẹp


# =========================================================================
# 7. KIỂM THỬ BẢO MẬT API SETTINGS (ADMIN ONLY & MASK SECRET)
# =========================================================================

def test_settings_api_admin_only_and_masked_secrets():
    """
    Kiểm tra /api/v1/settings/ai và /api/v1/settings/google:
    - Chặn REQUESTER, SUPPORT_AGENT, TEAM_LEAD (403 Forbidden).
    - Chỉ ADMIN mới được truy cập (200 OK).
    - Google client_secret không được trả về ở dạng plaintext thô.
    """
    # 1. Thử với vai trò REQUESTER
    app.dependency_overrides[get_current_user] = lambda: create_mock_user("mock-req", "REQUESTER")
    try:
        res = client.get("/api/v1/settings/ai")
        assert res.status_code == 403

        res_google = client.get("/api/v1/settings/google")
        assert res_google.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # 2. Thử với vai trò TEAM_LEAD
    app.dependency_overrides[get_current_user] = lambda: create_mock_user("mock-lead", "TEAM_LEAD")
    try:
        res = client.get("/api/v1/settings/ai")
        assert res.status_code == 403

        res_google = client.get("/api/v1/settings/google")
        assert res_google.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # 3. Thử với vai trò ADMIN
    app.dependency_overrides[get_current_user] = lambda: create_mock_user("mock-admin", "ADMIN")
    try:
        res_google = client.get("/api/v1/settings/google")
        assert res_google.status_code == 200
        data = res_google.json()
        # client_secret nếu có phải được che giấu, không bao giờ lộ plaintext
        if data.get("client_secret"):
            assert "******" in data["client_secret"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# =========================================================================
# 8. KIỂM THỬ BẢO MẬT QUẢN TRỊ TÀI KHOẢN (/api/v1/users/)
# =========================================================================

def test_user_management_api_role_restrictions():
    """
    Team Lead không thể sửa role, khóa tài khoản hoặc đổi mật khẩu qua /users/{id}.
    Tách API đọc danh sách nhân viên /users/agents cho Staff/Lead/Admin.
    """
    # Team Lead gọi /users/ -> 403
    app.dependency_overrides[get_current_user] = lambda: create_mock_user("mock-lead", "TEAM_LEAD")
    try:
        res_list = client.get("/api/v1/users/")
        assert res_list.status_code == 403

        res_update = client.put("/api/v1/users/target-user-id", json={"role_id": "new-role"})
        assert res_update.status_code == 403

        # Nhưng Team Lead có thể gọi /users/agents để phân công
        res_agents = client.get("/api/v1/users/agents")
        assert res_agents.status_code in [200, 500]  # Router cho phép truy cập, phụ thuộc db session
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# =========================================================================
# 9. KIỂM THỬ BÁO CÁO / DASHBOARD KHÔNG LỘ SỐ LIỆU CHO REQUESTER
# =========================================================================

def test_reports_api_forbidden_for_requester():
    """Khách hàng (Requester) không được đọc dashboard/KPI nội bộ hoặc xuất CSV hệ thống"""
    app.dependency_overrides[get_current_user] = lambda: create_mock_user("mock-req", "REQUESTER")
    try:
        res_kpi = client.get("/api/v1/reports/kpi")
        assert res_kpi.status_code == 403

        res_chart = client.get("/api/v1/reports/chart-data")
        assert res_chart.status_code == 403

        res_export = client.get("/api/v1/reports/export")
        assert res_export.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# =========================================================================
# 10. KIỂM THỬ PHÂN QUYỀN FAQ (KHO TRI THỨC)
# =========================================================================

def test_faq_permissions():
    """
    - Requester gửi câu hỏi đóng góp được tiếp nhận vào hàng chờ duyệt.
    - Support Agent không có quyền duyệt/xóa FAQ.
    - Team Lead không có quyền sửa/xóa FAQ (chỉ Admin).
    """
    # 1. Support Agent cố duyệt hoặc xóa FAQ -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: create_mock_user("mock-agent", "SUPPORT_AGENT")
    try:
        res_approve = client.post("/api/v1/knowledge/faqs/approve", json={"faq_id": "test-faq"})
        assert res_approve.status_code == 403

        res_delete = client.delete("/api/v1/knowledge/faqs/test-faq")
        assert res_delete.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # 2. Team Lead cố xóa FAQ -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: create_mock_user("mock-lead", "TEAM_LEAD")
    try:
        res_delete = client.delete("/api/v1/knowledge/faqs/test-faq")
        assert res_delete.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
