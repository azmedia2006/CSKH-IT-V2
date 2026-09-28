import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.main import app
from app.models.user import User
from app.models.role import Role
from app.models.ticket import Ticket
from app.models.comment import Comment
from app.models.category import Category
from app.api.deps import get_current_user, get_db
from app.core.permissions import check_ticket_access, verify_ticket_access_or_403

client = TestClient(app)


# =========================================================================
# FIXTURES VÀ DỮ LIỆU KIỂM THỬ ĐỘC LẬP (KHÔNG ĐỤNG TỚI DỮ LIỆU THẬT)
# =========================================================================

def make_role(name: str) -> Role:
    return Role(id=f"role-{name.lower()}", role_name=name)

def make_requester(user_id: str = "req-test-1") -> User:
    u = User(
        id=user_id,
        email=f"{user_id}@example.test",
        full_name="Nguyễn Văn Requester",
        is_active=True
    )
    u.role = make_role("REQUESTER")
    return u

def make_other_requester(user_id: str = "req-test-other") -> User:
    u = User(
        id=user_id,
        email=f"{user_id}@example.test",
        full_name="Lê Thị Người Khác",
        is_active=True
    )
    u.role = make_role("REQUESTER")
    return u

def make_agent_l1(user_id: str = "agent-l1-test") -> User:
    u = User(
        id=user_id,
        email=f"{user_id}@example.test",
        full_name="Vũ Kỹ Thuật L1",
        support_level="L1",
        skill_group="NETWORK_INFRA",
        is_active=True
    )
    u.role = make_role("SUPPORT_AGENT")
    return u

def make_team_lead(user_id: str = "lead-test-1") -> User:
    u = User(
        id=user_id,
        email=f"{user_id}@example.test",
        full_name="Trần Trưởng Nhóm",
        is_active=True
    )
    u.role = make_role("TEAM_LEAD")
    return u

def make_admin(user_id: str = "admin-test-1") -> User:
    u = User(
        id=user_id,
        email=f"{user_id}@example.test",
        full_name="Hoàng Quản Trị Viên",
        is_active=True
    )
    u.role = make_role("ADMIN")
    return u

def make_ticket(
    ticket_id: str = "tkt-test-100",
    requester_id: str = "req-test-1",
    assigned_agent_id: str = "agent-l1-test",
    support_level: str = "L1"
) -> Ticket:
    t = Ticket(
        id=ticket_id,
        ticket_code="TCK-TEST-100",
        title="Không thể truy cập mạng nội bộ",
        description="Mạng rớt từ sáng, không ping được gateway văn phòng",
        category_id="NETWORK_INFRA",
        priority="P2",
        status="PROCESSING",
        support_level=support_level,
        risk_flag="HIGH",
        sentiment="NEGATIVE",
        sentiment_score=0.91,
        sentiment_reason="Khách hàng bức xúc vì gián đoạn công việc",
        sentiment_evidence="Không làm việc được gì cả!",
        ai_suggested_priority="P2",
        ai_confidence_score=0.88,
        ai_summary="• Vấn đề chính: Lỗi gateway\n• Tiến trình: Đang xử lý\n• Tiếp theo: Thay switch",
        is_escalated=False,
        escalation_status="NONE",
        requester_id=requester_id,
        assigned_agent_id=assigned_agent_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    t.category = Category(id="NETWORK_INFRA", code="NETWORK_INFRA", name="Hạ tầng Mạng & VPN")
    t.requester = make_requester(requester_id)
    t.assigned_agent = make_agent_l1(assigned_agent_id)
    return t


# =========================================================================
# PHẦN A: KIỂM THỬ BẰNG REQUESTER
# =========================================================================

def test_a1_requester_view_own_ticket_and_public_comments():
    """
    A.1: Requester xem được nội dung ticket của mình, danh mục hiện tại, trạng thái
    và chỉ xem được các trao đổi công khai (is_internal == False).
    """
    req_user = make_requester("req-owner")
    ticket = make_ticket("tkt-a1", requester_id="req-owner", assigned_agent_id="agent-1")
    
    pub_comment = Comment(
        id="c-pub",
        ticket_id="tkt-a1",
        user_id="req-owner",
        content="Tôi đang cần gấp tài liệu!",
        is_internal=False,
        created_at=datetime.utcnow()
    )
    pub_comment.user = req_user
    
    internal_comment = Comment(
        id="c-secret",
        ticket_id="tkt-a1",
        user_id="agent-1",
        content="Ghi chú nội bộ: Có thể phải thay thiết bị mạng tại tủ rack.",
        is_internal=True,
        created_at=datetime.utcnow()
    )
    internal_comment.user = make_agent_l1("agent-1")

    # Mock DB session
    mock_db = AsyncMock()
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket

    mock_comments_res = MagicMock()
    # Khi là requester, query lọc where(Comment.is_internal == False) -> chỉ trả pub_comment
    mock_comments_res.scalars.return_value.all.return_value = [pub_comment]

    mock_db.execute.side_effect = [mock_ticket_res, mock_ticket_res, mock_comments_res]

    app.dependency_overrides[get_current_user] = lambda: req_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        # 1. Requester xem chi tiết ticket
        res = client.get("/api/v1/tickets/tkt-a1")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == "tkt-a1"
        assert data["title"] == "Không thể truy cập mạng nội bộ"
        assert data["category_id"] == "NETWORK_INFRA"
        assert data["status"] == "PROCESSING"

        # 2. Requester xem danh sách trao đổi
        res_comments = client.get("/api/v1/tickets/tkt-a1/comments")
        assert res_comments.status_code == 200
        comments_data = res_comments.json()
        assert len(comments_data) == 1
        assert comments_data[0]["content"] == "Tôi đang cần gấp tài liệu!"
        assert comments_data[0]["is_internal"] is False
    finally:
        app.dependency_overrides.clear()


def test_a2_requester_category_is_read_only_and_cannot_modify():
    """
    A.2: Danh mục chỉ hiển thị; Requester không thể sửa danh mục hoặc thuộc tính ticket qua API.
    """
    req_user = make_requester("req-owner")
    ticket = make_ticket("tkt-a2", requester_id="req-owner")

    mock_db = AsyncMock()
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket
    mock_db.execute.return_value = mock_ticket_res

    app.dependency_overrides[get_current_user] = lambda: req_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        # Requester cố gắng gọi PUT/PATCH để đổi category
        res_put = client.put("/api/v1/tickets/tkt-a2", json={"category_id": "SOFTWARE_BUG"})
        assert res_put.status_code == 403
        assert "không có quyền" in res_put.json()["detail"].lower()

        res_patch = client.patch("/api/v1/tickets/tkt-a2", json={"priority": "P1"})
        assert res_patch.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_a3_a4_requester_cannot_call_internal_ai_and_staff_apis():
    """
    A.3 & A.4: Requester bị chặn hoàn toàn ở cấp API đối với các thao tác nội bộ:
    - AI Triage (classify)
    - Gợi ý AI (suggest-reply)
    - Tóm tắt (summarize)
    - Chuyển cấp (escalate)
    - Xem ticket của người khác
    """
    req_user = make_requester("req-owner")
    ticket_own = make_ticket("tkt-own", requester_id="req-owner")
    ticket_other = make_ticket("tkt-other", requester_id="req-stranger")

    mock_db = AsyncMock()
    mock_own_res = MagicMock()
    mock_own_res.scalars.return_value.first.return_value = ticket_own
    mock_other_res = MagicMock()
    mock_other_res.scalars.return_value.first.return_value = ticket_other

    app.dependency_overrides[get_current_user] = lambda: req_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        # 1. Gọi AI Classify -> 403
        mock_db.execute.return_value = mock_own_res
        res_classify = client.post("/api/v1/tickets/tkt-own/classify")
        assert res_classify.status_code == 403
        assert "không có quyền" in res_classify.json()["detail"].lower()

        # 2. Gọi AI Suggest Reply -> 403
        mock_db.execute.return_value = mock_own_res
        res_suggest = client.post("/api/v1/tickets/tkt-own/suggest-reply")
        assert res_suggest.status_code == 403

        # 3. Gọi AI Summarize -> 403
        mock_db.execute.return_value = mock_own_res
        res_sum = client.post("/api/v1/tickets/tkt-own/summarize")
        assert res_sum.status_code == 403

        # 4. Gọi Escalate -> 403
        mock_db.execute.return_value = mock_own_res
        res_esc = client.post("/api/v1/tickets/tkt-own/escalate", params={"reason": "Lên L2 đi"})
        assert res_esc.status_code == 403

        # 5. Xem ticket của người khác -> 403
        mock_db.execute.return_value = mock_other_res
        res_other = client.get("/api/v1/tickets/tkt-other")
        assert res_other.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_a5_internal_notes_and_ai_data_redacted_for_requester():
    """
    A.5: Ghi chú nội bộ và dữ liệu AI dành cho nhân viên (sentiment, risk_flag,
    ai_summary, v.v.) không bị lộ qua API chi tiết ticket hay lịch sử cho Requester.
    """
    req_user = make_requester("req-owner")
    ticket = make_ticket("tkt-redact", requester_id="req-owner")
    # Đảm bảo ticket có các trường AI nhạy cảm
    assert ticket.sentiment == "NEGATIVE"
    assert ticket.risk_flag == "HIGH"
    assert ticket.ai_summary is not None

    mock_db = AsyncMock()
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket
    mock_db.execute.return_value = mock_ticket_res

    app.dependency_overrides[get_current_user] = lambda: req_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.get("/api/v1/tickets/tkt-redact")
        assert res.status_code == 200
        data = res.json()

        # Dữ liệu AI nội bộ PHẢI bị ẩn đi (redacted) đối với Requester
        assert data["sentiment"] is None
        assert data["sentiment_score"] is None
        assert data["sentiment_reason"] is None
        assert data["sentiment_evidence"] is None
        assert data["risk_flag"] == "NORMAL"
        assert data["ai_suggested_priority"] is None
        assert data["ai_confidence_score"] is None
        assert data["ai_summary"] is None
        assert data["escalation_reason"] is None
    finally:
        app.dependency_overrides.clear()


# =========================================================================
# PHẦN B: KIỂM THỬ BẰNG SUPPORT AGENT / L1
# =========================================================================

def test_b1_agent_ai_triage_returns_proposals():
    """
    B.1: Support Agent có quyền chạy AI Triage; AI trả về đề xuất danh mục,
    mức ưu tiên, confidence score và căn cứ phân loại (rationale).
    """
    agent = make_agent_l1("agent-1")
    ticket = make_ticket("tkt-b1", requester_id="req-1", assigned_agent_id="agent-1")

    mock_db = AsyncMock()
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket
    mock_db.execute.return_value = mock_ticket_res

    app.dependency_overrides[get_current_user] = lambda: agent
    app.dependency_overrides[get_db] = lambda: mock_db

    fake_triage_res = MagicMock(
        category_code="NETWORK_INFRA",
        priority="P2",
        confidence_score=0.95,
        sentiment="negative",
        risk_level="high",
        likely_exceeds_l1=False,
        rationale="Sự cố mất kết nối mạng nội bộ ảnh hưởng phòng kế toán",
        missing_information=None
    )

    try:
        with patch("app.api.v1.tickets.ai_triage_ticket", return_value=fake_triage_res):
            res = client.post("/api/v1/tickets/tkt-b1/classify")
            assert res.status_code == 200
            data = res.json()
            assert data["category_code"] == "NETWORK_INFRA"
            assert data["priority"] == "P2"
            assert data["confidence_score"] == 0.95
            assert "mất kết nối" in data["rationale"].lower()
    finally:
        app.dependency_overrides.clear()


def test_b2_triage_is_proposal_only_not_applied_automatically():
    """
    B.2: Kết quả phân loại chỉ là đề xuất. Sau khi gọi /classify, danh mục và ưu tiên
    của ticket trong DB KHÔNG bị thay đổi tự động.
    """
    agent = make_agent_l1("agent-1")
    # Ticket ban đầu có priority là P3, category là TECH_GUIDE
    ticket = make_ticket("tkt-b2", requester_id="req-1", assigned_agent_id="agent-1")
    ticket.priority = "P3"
    ticket.category_id = "TECH_GUIDE"

    mock_db = AsyncMock()
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket
    mock_db.execute.return_value = mock_ticket_res

    app.dependency_overrides[get_current_user] = lambda: agent
    app.dependency_overrides[get_db] = lambda: mock_db

    fake_triage_res = MagicMock(
        category_code="NETWORK_INFRA",
        priority="P1",  # Đề xuất nâng lên P1
        confidence_score=0.92,
        sentiment="negative",
        risk_level="high",
        likely_exceeds_l1=False,
        rationale="Khẩn cấp vì sập switch",
        missing_information=None
    )

    try:
        with patch("app.api.v1.tickets.ai_triage_ticket", return_value=fake_triage_res):
            res = client.post("/api/v1/tickets/tkt-b2/classify")
            assert res.status_code == 200

            # Xác nhận ticket TRONG DB vẫn giữ nguyên giá trị ban đầu (chưa bị đổi)
            assert ticket.priority == "P3"
            assert ticket.category_id == "TECH_GUIDE"
    finally:
        app.dependency_overrides.clear()


def test_b3_agent_change_category_saves_and_records_audit_note():
    """
    B.3: Đổi danh mục qua PUT/PATCH lưu đúng và tự động ghi chú nội bộ (Comment audit).
    """
    agent = make_agent_l1("agent-1")
    ticket = make_ticket("tkt-b3", requester_id="req-1", assigned_agent_id="agent-1")
    ticket.category_id = "TECH_GUIDE"

    mock_db = AsyncMock()
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket

    # Category matching
    target_cat = Category(id="cat-net-id", code="NETWORK_INFRA", name="Hạ tầng Mạng & VPN")
    mock_cat_res = MagicMock()
    mock_cat_res.scalars.return_value.first.return_value = target_cat

    mock_db.execute.side_effect = [mock_ticket_res, mock_cat_res]

    app.dependency_overrides[get_current_user] = lambda: agent
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.put(
            "/api/v1/tickets/tkt-b3",
            json={"category_id": "NETWORK_INFRA"}
        )
        assert res.status_code == 200

        # Kiểm tra category_id đã được cập nhật
        assert ticket.category_id == "cat-net-id"

        # Kiểm tra Comment audit được thêm vào db
        added_objs = [call[0][0] for call in mock_db.add.call_args_list]
        audit_comments = [obj for obj in added_objs if isinstance(obj, Comment)]
        assert len(audit_comments) >= 1
        audit = audit_comments[0]
        assert audit.is_internal is True
        assert audit.edited_by_agent is True
        assert "cập nhật" in audit.content.lower()
        assert "danh mục" in audit.content.lower()
    finally:
        app.dependency_overrides.clear()


def test_b4_suggest_reply_is_draft_only_and_never_auto_sent():
    """
    B.4: Có nút 'Gợi ý AI'. Kết quả trả về draft_reply; tuyệt đối không tự động
    gửi đi hay tạo Comment mới cho Requester trong DB.
    """
    agent = make_agent_l1("agent-1")
    ticket = make_ticket("tkt-b4", requester_id="req-1", assigned_agent_id="agent-1")

    mock_db = AsyncMock()
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket

    mock_comments_res = MagicMock()
    mock_comments_res.scalars.return_value.all.return_value = []

    mock_db.execute.side_effect = [mock_ticket_res, mock_comments_res]

    app.dependency_overrides[get_current_user] = lambda: agent
    app.dependency_overrides[get_db] = lambda: mock_db

    fake_copilot_res = MagicMock(
        draft_reply="Chào bạn, bạn thử cắm lại dây LAN hoặc khởi động lại modem nhé.",
        relevant_faq_ids=[],
        confidence_score=0.9,
        needs_more_info=False
    )

    try:
        with patch("app.api.v1.tickets.ai_draft_reply", return_value=fake_copilot_res):
            res = client.post("/api/v1/tickets/tkt-b4/suggest-reply")
            assert res.status_code == 200
            data = res.json()
            assert "cắm lại dây LAN" in data["draft_reply"]

            # Xác nhận TUYỆT ĐỐI không có comment nào được tự động add vào db
            added_comments = [
                call[0][0] for call in mock_db.add.call_args_list 
                if isinstance(call[0][0], Comment)
            ]
            assert len(added_comments) == 0
    finally:
        app.dependency_overrides.clear()


def test_b5_summarize_history_with_long_and_short_threads():
    """
    B.5: Có nút 'Tóm tắt':
    - Với ticket có trao đổi dài (>= 3 trao đổi), AI tóm tắt thành các ý chính:
      core_issue, progress, next_actions, và cập nhật ai_summary của ticket.
    - Với ticket chưa đủ lịch sử (< 3 trao đổi), trên UI nút tóm tắt bị disabled
      với tooltip giải thích (comments.length < 3).
    """
    agent = make_agent_l1("agent-1")
    ticket = make_ticket("tkt-b5", requester_id="req-1", assigned_agent_id="agent-1")

    # Giả lập 3 bình luận trao đổi
    c1 = Comment(id="c1", ticket_id="tkt-b5", content="Máy in không nhận lệnh in", is_internal=False)
    c2 = Comment(id="c2", ticket_id="tkt-b5", content="Bạn đã cắm nguồn máy in chưa?", is_internal=False)
    c3 = Comment(id="c3", ticket_id="tkt-b5", content="Nguồn đã bật, đèn vàng nhấp nháy", is_internal=False)

    mock_db = AsyncMock()
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket

    mock_comments_res = MagicMock()
    mock_comments_res.scalars.return_value.all.return_value = [c1, c2, c3]

    mock_db.execute.side_effect = [mock_ticket_res, mock_comments_res]

    app.dependency_overrides[get_current_user] = lambda: agent
    app.dependency_overrides[get_db] = lambda: mock_db

    fake_summary_res = MagicMock(
        core_issue="Máy in HP nhấp nháy đèn vàng, kẹt giấy hoặc hết mực",
        progress="Kỹ thuật viên đã hỏi tình trạng nguồn, khách xác nhận đèn vàng",
        next_actions="Cần nhân viên trực tiếp qua kiểm tra khay mực tầng 2"
    )

    try:
        with patch("app.api.v1.tickets.ai_summarize_ticket", return_value=fake_summary_res):
            res = client.post("/api/v1/tickets/tkt-b5/summarize")
            assert res.status_code == 200
            data = res.json()
            assert "kẹt giấy" in data["core_issue"]
            assert "khay mực" in data["next_actions"]
            assert "• Vấn đề chính:" in data["summary"]

            # Xác nhận ticket.ai_summary trong DB được cập nhật
            assert ticket.ai_summary is not None
            assert "Máy in HP" in ticket.ai_summary
    finally:
        app.dependency_overrides.clear()


# =========================================================================
# PHẦN C: KIỂM THỬ PHÂN CÔNG TICKET THEO BÁO CÁO NGHIỆP VỤ (UC-03, TC_BIZ_02)
# =========================================================================

def test_tc_biz_02_agent_cannot_assign_ticket_returns_403():
    """
    TC_BIZ_02: SUPPORT_AGENT gọi API phân công ticket trả về HTTP 403 Forbidden.
    (Không cho phép Kỹ thuật viên tự phân công lại ticket cho người khác).
    """
    agent = make_agent_l1("agent-1")
    ticket = make_ticket("tkt-assign-1", requester_id="req-1", assigned_agent_id="agent-1")

    mock_db = AsyncMock()
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket
    mock_db.execute.return_value = mock_ticket_res

    app.dependency_overrides[get_current_user] = lambda: agent
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.put("/api/v1/tickets/tkt-assign-1", json={"assigned_agent_id": "agent-2"})
        assert res.status_code == 403
        assert "Chỉ Trưởng nhóm (TEAM_LEAD) mới có quyền phân công" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_admin_cannot_assign_ticket_without_team_lead_role_returns_403():
    """
    RBAC theo báo cáo: ADMIN không được tự suy diễn quyền phân công nếu không được cấp vai trò TEAM_LEAD.
    API từ chối với HTTP 403 Forbidden.
    """
    admin = make_admin("admin-1")
    ticket = make_ticket("tkt-assign-2", requester_id="req-1", assigned_agent_id="agent-1")

    mock_db = AsyncMock()
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket
    mock_db.execute.return_value = mock_ticket_res

    app.dependency_overrides[get_current_user] = lambda: admin
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.put("/api/v1/tickets/tkt-assign-2", json={"assigned_agent_id": "agent-2"})
        assert res.status_code == 403
        assert "Chỉ Trưởng nhóm (TEAM_LEAD) mới có quyền phân công" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_team_lead_can_assign_ticket_and_records_internal_history_note():
    """
    UC-03 & RBAC: TEAM_LEAD được phép phân công Agent phù hợp.
    Khi phân công thành công:
    - Cập nhật ticket.assigned_agent_id và ticket.previous_agent_id
    - Tạo ĐÚNG 1 bản ghi lịch sử nội bộ (Comment có is_internal=True) ghi lại người thực hiện, thời gian, agent cũ, agent mới.
    """
    lead = make_team_lead("lead-1")
    ticket = make_ticket("tkt-assign-3", requester_id="req-1", assigned_agent_id="agent-1")
    target_agent = make_agent_l1("agent-2")
    target_agent.full_name = "Lê Kỹ Thuật L1 Mới"

    mock_db = AsyncMock()
    # Lần 1: tìm ticket, Lần 2: tìm target_agent
    mock_ticket_res = MagicMock()
    mock_ticket_res.scalars.return_value.first.return_value = ticket

    mock_agent_res = MagicMock()
    mock_agent_res.scalars.return_value.first.return_value = target_agent

    mock_db.execute.side_effect = [mock_ticket_res, mock_agent_res]

    app.dependency_overrides[get_current_user] = lambda: lead
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.put("/api/v1/tickets/tkt-assign-3", json={"assigned_agent_id": "agent-2"})
        assert res.status_code == 200
        assert ticket.assigned_agent_id == "agent-2"
        assert ticket.previous_agent_id == "agent-1"

        # Kiểm tra bản ghi lịch sử nội bộ đã được tạo đúng 1 bản
        added_objs = [call.args[0] for call in mock_db.add.call_args_list if isinstance(call.args[0], Comment)]
        assert len(added_objs) == 1
        history_comment = added_objs[0]
        assert history_comment.is_internal is True
        assert "Trưởng nhóm" in history_comment.content
        assert "Lê Kỹ Thuật L1 Mới" in history_comment.content
    finally:
        app.dependency_overrides.clear()

