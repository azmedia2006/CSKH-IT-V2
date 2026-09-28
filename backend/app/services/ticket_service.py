import uuid
import logging
import asyncio
from typing import Optional, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from app.models.ticket import Ticket
from app.models.user import User
from app.models.comment import Comment
from app.models.sla_policy import SLAPolicy
from app.models.ai_log import AILog
from app.core.exceptions import NotFoundException
from app.ai.key_manager import gemini_key_manager
from app.ai.sentiment import analyze_sentiment
from app.ai.pii_masker import PIIMasker

logger = logging.getLogger(__name__)

async def generate_ticket_code(db: AsyncSession) -> str:
    date_str = datetime.utcnow().strftime("%Y%m%d")
    unique_id = str(uuid.uuid4())[:4].upper()
    return f"TKT-{date_str}-{unique_id}"

async def assign_agent_by_skill_and_level(
    db: AsyncSession,
    category_id: str | None,
    level: str = "L1",
    exclude_agent_id: str | None = None,
    strict: bool = False
) -> str | None:
    """
    Quy tắc tự động phân công theo cấp hỗ trợ L1/L2 và nhóm kỹ năng:
    - Ticket mới: Gán cho nhân viên L1 có nhóm kỹ năng phù hợp với danh mục sự cố.
    - Escalation / Chuyển cấp: Gán cho nhân viên L2 có nhóm kỹ năng phù hợp.
    - Trong cùng nhóm đủ điều kiện: Phân công theo cơ chế cân bằng tải (người có ít ticket đang xử lý nhất).
    - Nếu strict=True: Chỉ tìm nhân viên đúng cấp level (dùng khi tìm L2). Nếu không có, trả về None (để đưa vào hàng chờ L2).
    - Nếu strict=False: Có fallback sang nhân viên cùng cấp khác hoặc Lead/Admin.
    """
    from app.models.role import Role
    from app.models.category import Category
    from sqlalchemy.orm import selectinload

    # 1. Xác định mã kỹ năng (skill group) từ Category
    category_code = None
    if category_id:
        cat_res = await db.execute(select(Category).where(or_(Category.id == category_id, Category.code == category_id)))
        cat_obj = cat_res.scalars().first()
        if cat_obj and cat_obj.code:
            category_code = cat_obj.code.strip().upper()

    candidates = []

    # 2. Tìm nhân viên Support Agent theo cấp L1/L2 và đúng nhóm kỹ năng
    if category_code:
        stmt = (
            select(User)
            .join(Role, User.role_id == Role.id)
            .options(selectinload(User.role))
            .where(
                Role.role_name == "SUPPORT_AGENT",
                User.is_active == True,
                User.support_level == level,
                User.skill_group == category_code
            )
        )
        if exclude_agent_id:
            stmt = stmt.where(User.id != exclude_agent_id)
        res = await db.execute(stmt)
        candidates = res.scalars().all()

    # 3. Fallback 1: Nếu chưa tìm thấy ai khớp kỹ năng, tìm mọi nhân viên SUPPORT_AGENT ở cấp level tương ứng
    if not candidates:
        stmt_fb1 = (
            select(User)
            .join(Role, User.role_id == Role.id)
            .options(selectinload(User.role))
            .where(
                Role.role_name == "SUPPORT_AGENT",
                User.is_active == True,
                User.support_level == level
            )
        )
        if exclude_agent_id:
            stmt_fb1 = stmt_fb1.where(User.id != exclude_agent_id)
        res_fb1 = await db.execute(stmt_fb1)
        candidates = res_fb1.scalars().all()

    # 4. Fallback 2: Nếu strict=False và vẫn chưa có, mở rộng sang toàn bộ nhân viên kỹ thuật khả dụng
    if not candidates and not strict:
        target_roles = ["SUPPORT_AGENT", "TEAM_LEAD", "ADMIN"] if level == "L1" else ["TEAM_LEAD", "ADMIN"]
        stmt_fb2 = (
            select(User)
            .join(Role, User.role_id == Role.id)
            .options(selectinload(User.role))
            .where(
                Role.role_name.in_(target_roles),
                User.is_active == True
            )
        )
        if exclude_agent_id:
            stmt_fb2 = stmt_fb2.where(User.id != exclude_agent_id)
        res_fb2 = await db.execute(stmt_fb2)
        candidates = res_fb2.scalars().all()

    if not candidates:
        return None

    # 5. Phân công theo cân bằng tải (Least-workload load balancing)
    workload = []
    for agent in candidates:
        cnt_q = await db.execute(
            select(func.count(Ticket.id))
            .where(
                Ticket.assigned_agent_id == agent.id,
                Ticket.status.in_(["NEW", "PROCESSING", "WAITING_CUSTOMER"])
            )
        )
        active_count = cnt_q.scalar() or 0
        workload.append((active_count, agent.id))

    workload.sort(key=lambda x: x[0])
    return workload[0][1]


async def evaluate_sentiment_and_auto_escalate(
    db: AsyncSession,
    ticket: Ticket,
    text_to_analyze: str,
    source_type: str = "INITIAL_DESCRIPTION",
    precomputed_sentiment: Optional[Any] = None
) -> dict:
    """
    Thực hiện phân tích Sentiment bằng AI trên nội dung công khai của Requester:
    - Che PII trước khi gửi cho AI.
    - Không dùng ghi chú nội bộ (is_internal) làm căn cứ.
    - Nếu confidence đạt ngưỡng (config.confidence_threshold, mặc định 0.70) và sentiment == 'NEGATIVE':
        1. Gắn cờ rủi ro HIGH, lưu sentiment, score, lý do & bằng chứng.
        2. Chuyển người phụ trách từ L1 sang nhân viên L2 đang hoạt động phù hợp danh mục/kỹ năng.
        3. Ghi lại người cũ, người mới, thời điểm, lý do vào audit log / ticket history.
        4. Tạo ghi chú nội bộ (is_internal=True) cho biết ticket được tự động chuyển cấp do sentiment tiêu cực; không hiển thị cho Requester.
        5. Gắn nhãn 'AI tự động chuyển cấp' (escalation_status = 'AUTO_ESCALATED').
        6. Nếu không có L2 phù hợp: đưa vào hàng chờ L2 ('L2_WAITING') và tạo ghi chú nội bộ cảnh báo Team Lead.
    - Nếu confidence thấp (< ngưỡng) hoặc kết quả không rõ ràng:
        Gắn nhãn 'Cần kiểm tra sentiment' (risk_flag = 'CHECK_REQUIRED'), KHÔNG tự động chuyển cấp.
    - Không chuyển cấp lặp lại cho cùng một ticket khi nhận nhiều bình luận liên tiếp sau khi đã là L2.
    """
    # Quy tắc an toàn: Không chuyển cấp lặp lại nếu ticket đã ở cấp L2 hoặc đã chuyển cấp
    if ticket.support_level == "L2" or ticket.is_escalated:
        logger.info(f"[Sentiment] Ticket {ticket.ticket_code} đã ở cấp L2, bỏ qua tự động chuyển cấp lặp lại.")
        return {"action": "SKIPPED_ALREADY_L2"}

    # Sử dụng kết quả đã tính toán trước (song song) hoặc gọi phân tích mới
    if precomputed_sentiment is not None:
        sentiment_res = precomputed_sentiment
    else:
        sentiment_res = await analyze_sentiment(text_to_analyze)
    config = gemini_key_manager.get_config()
    escalation_enabled = config.get("ai_sentiment_escalation_enabled", True)
    # Ngưỡng 0.82 là ngưỡng mẫu trong tài liệu DOCX, mang trạng thái SAMPLE_NEEDS_APPROVAL (chờ xác nhận)
    threshold = float(config.get("ai_sentiment_escalation_threshold", config.get("confidence_threshold", 0.82)))
    threshold_status = config.get("ai_sentiment_threshold_status", "SAMPLE_NEEDS_APPROVAL")

    # Ghi AI Log đầy đủ
    has_pii = PIIMasker.mask_text(text_to_analyze) != text_to_analyze
    ai_log = AILog(
        ticket_id=ticket.id,
        task_type="SENTIMENT_ANALYSIS",
        model_name="azmedia247-sentiment",
        pii_detected=has_pii,
        agent_action=f"SENTIMENT_{sentiment_res.sentiment}_{source_type}"
    )
    db.add(ai_log)

    ticket.sentiment = sentiment_res.sentiment
    ticket.sentiment_score = sentiment_res.confidence_score
    ticket.sentiment_reason = sentiment_res.reason
    ticket.sentiment_evidence = sentiment_res.evidence

    # Trường hợp 1: Sentiment tiêu cực VÀ độ tin cậy đạt ngưỡng cấu hình VÀ tính năng đang bật
    if escalation_enabled and sentiment_res.sentiment == "NEGATIVE" and sentiment_res.confidence_score >= threshold:
        logger.info(f"[Sentiment] Ticket {ticket.ticket_code} phát hiện sentiment tiêu cực (score: {sentiment_res.confidence_score} >= {threshold} [{threshold_status}]). Bắt đầu chuyển cấp L2...")

        ticket.risk_flag = "HIGH"
        ticket.is_escalated = True
        ticket.escalated_at = datetime.utcnow()
        ticket.escalation_reason = f"AI phát hiện Sentiment tiêu cực ({int(sentiment_res.confidence_score*100)}% độ tin cậy, ngưỡng demo {threshold} [{threshold_status}]): {sentiment_res.reason}"
        ticket.previous_agent_id = ticket.assigned_agent_id

        # Tìm nhân viên L2 phù hợp nhóm kỹ năng
        l2_agent_id = await assign_agent_by_skill_and_level(
            db,
            category_id=ticket.category_id,
            level="L2",
            exclude_agent_id=ticket.assigned_agent_id,
            strict=True
        )

        old_agent_name = "Chưa phân công"
        if ticket.assigned_agent_id:
            old_agent_res = await db.execute(select(User).where(User.id == ticket.assigned_agent_id))
            old_u = old_agent_res.scalars().first()
            if old_u:
                old_agent_name = old_u.full_name

        if l2_agent_id:
            ticket.assigned_agent_id = l2_agent_id
            ticket.support_level = "L2"
            ticket.escalation_status = "AUTO_ESCALATED"

            # Truy vấn tên nhân viên L2 mới
            new_agent_res = await db.execute(select(User).where(User.id == l2_agent_id))
            new_agent = new_agent_res.scalars().first()
            new_agent_name = new_agent.full_name if new_agent else "Nhân viên L2"

            # Tạo ghi chú nội bộ (is_internal=True) để thông báo, không hiển thị cho Requester
            internal_note = Comment(
                ticket_id=ticket.id,
                user_id=ticket.requester_id,
                content=(
                    f"🤖 [AI Tự động chuyển cấp sang Tuyến 2 - L2]\n"
                    f"• Lý do: Khách hàng có sentiment tiêu cực (Độ tin cậy: {int(sentiment_res.confidence_score*100)}%).\n"
                    f"• Bằng chứng: \"{sentiment_res.evidence or 'Nội dung phản hồi'}\"\n"
                    f"• Phân tích AI: {sentiment_res.reason}\n"
                    f"• Người xử lý trước: {old_agent_name} (L1)\n"
                    f"• Người tiếp nhận mới: {new_agent_name} (L2)\n"
                    f"• Cờ rủi ro: HIGH (Cần hỗ trợ ưu tiên)."
                ),
                is_internal=True,
                is_ai_generated=True
            )
            db.add(internal_note)

            return {
                "action": "AUTO_ESCALATED",
                "risk_flag": "HIGH",
                "new_agent_id": l2_agent_id,
                "new_agent_name": new_agent_name,
                "confidence_score": sentiment_res.confidence_score
            }
        else:
            # Không có nhân viên L2 phù hợp hoặc đang hoạt động -> Đưa vào hàng chờ L2 & cảnh báo Team Lead
            ticket.support_level = "L2"
            ticket.escalation_status = "L2_WAITING"

            internal_note = Comment(
                ticket_id=ticket.id,
                user_id=ticket.requester_id,
                content=(
                    f"⚠️ [CẢNH BÁO TEAM LEAD - HÀNG CHỜ L2]\n"
                    f"Ticket {ticket.ticket_code} được AI gắn cờ rủi ro HIGH do Sentiment tiêu cực ({int(sentiment_res.confidence_score*100)}%), "
                    f"tuy nhiên hiện tại chưa có Kỹ thuật viên Tuyến 2 (L2) phù hợp kỹ năng trực tuyến.\n"
                    f"• Ticket đã được đưa vào [Hàng chờ L2].\n"
                    f"• Yêu cầu Trưởng nhóm (Team Lead) tiếp nhận hoặc phân bổ khẩn cấp."
                ),
                is_internal=True,
                is_ai_generated=True
            )
            db.add(internal_note)

            return {
                "action": "L2_WAITING_ALERT",
                "risk_flag": "HIGH",
                "confidence_score": sentiment_res.confidence_score
            }

    # Trường hợp 2: Có dấu hiệu tiêu cực nhưng confidence thấp (< threshold) hoặc kết quả chưa rõ ràng
    elif sentiment_res.sentiment == "NEGATIVE" or (sentiment_res.confidence_score and sentiment_res.confidence_score >= 0.5 and sentiment_res.needs_attention):
        ticket.risk_flag = "CHECK_REQUIRED"
        logger.info(f"[Sentiment] Ticket {ticket.ticket_code}: Confidence {sentiment_res.confidence_score} thấp hơn ngưỡng {threshold}. Gắn nhãn 'Cần kiểm tra sentiment'.")
        return {
            "action": "FLAGGED_CHECK_REQUIRED",
            "risk_flag": "CHECK_REQUIRED",
            "confidence_score": sentiment_res.confidence_score
        }

    else:
        ticket.risk_flag = "NORMAL"
        return {
            "action": "NORMAL",
            "risk_flag": "NORMAL",
            "confidence_score": sentiment_res.confidence_score
        }


async def create_ticket(db: AsyncSession, ticket_data: dict, requester_id: str) -> Ticket:
    from app.ai.triage import ai_triage_ticket
    from app.models.category import Category
    from app.ai.key_manager import gemini_key_manager
    from app.ai.fallback import get_triage_fallback
    
    config = gemini_key_manager.get_config()
    confidence_threshold = float(config.get("confidence_threshold", 0.80))
    auto_triage_enabled = config.get("auto_triage", True)
    
    # 1. Chạy AI Triage và Phân tích Sentiment song song (Concurrent Execution) để loại bỏ độ trễ gấp đôi
    ai_processed = True
    ai_error_msg = None
    is_under_threshold = False
    sentiment_res = None
    desc_to_analyze = ticket_data.get("description", "")
    
    if auto_triage_enabled:
        try:
            # Chạy song song cả 2 tác vụ AI cùng lúc
            triage_coro = ai_triage_ticket(desc_to_analyze)
            sentiment_coro = analyze_sentiment(desc_to_analyze)
            raw_triage, raw_sentiment = await asyncio.gather(triage_coro, sentiment_coro, return_exceptions=True)
            
            if isinstance(raw_triage, Exception):
                logger.error(f"[AI Triage Exception on Ticket Create]: {raw_triage}")
                ai_processed = False
                ai_error_msg = str(raw_triage)
                ai_result = get_triage_fallback()
                suggested_priority = ticket_data.get("priority", "P3")
                category_code = "UNCATEGORIZED"
                is_under_threshold = True
            else:
                ai_result = raw_triage
                if ai_result.confidence_score >= confidence_threshold:
                    suggested_priority = ai_result.priority
                    category_code = ai_result.category_code
                    is_under_threshold = False
                else:
                    suggested_priority = ai_result.priority or "P3"
                    category_code = ai_result.category_code or "UNCATEGORIZED"
                    is_under_threshold = True
                    
            if not isinstance(raw_sentiment, Exception):
                sentiment_res = raw_sentiment
        except Exception as e:
            logger.error(f"[AI Parallel Tasks Exception]: {e}")
            ai_processed = False
            ai_error_msg = str(e)
            ai_result = get_triage_fallback()
            suggested_priority = ticket_data.get("priority", "P3")
            category_code = "UNCATEGORIZED"
            is_under_threshold = True
    else:
        # Tắt tự động phân loại: sử dụng ưu tiên và danh mục do người dùng/hệ thống cung cấp
        ai_processed = False
        ai_result = get_triage_fallback()
        suggested_priority = ticket_data.get("priority", "P3")
        category_code = "UNCATEGORIZED"
        is_under_threshold = False
        
    cat_query = await db.execute(select(Category).where(Category.code == category_code))
    category = cat_query.scalars().first()
    category_id = category.id if category else None
    
    priority_map = {
        "P1": "CRITICAL_P1",
        "P2": "HIGH_P2",
        "P3": "MEDIUM_P3",
        "P4": "LOW_P4"
    }
    db_priority = priority_map.get(suggested_priority, "MEDIUM_P3")
    
    # Calculate SLA
    sla_query = await db.execute(select(SLAPolicy).where(SLAPolicy.priority_level == db_priority))
    sla_policy = sla_query.scalars().first()
    
    now = datetime.utcnow()
    first_response_due = None
    resolution_due = None
    
    if sla_policy:
        first_response_due = now + timedelta(minutes=sla_policy.response_time_minutes)
        resolution_due = now + timedelta(minutes=sla_policy.resolve_time_minutes)
        
    ticket_code = await generate_ticket_code(db)
    
    # Phân công ban đầu: Tự động gán cho nhân viên L1 đang hoạt động, phù hợp kỹ năng (cân bằng tải)
    auto_assigned_agent_id = None
    try:
        if ticket_data.get("category_id"):
            explicit_cat = ticket_data.get("category_id")
            cat_q = await db.execute(select(Category).where(or_(Category.id == explicit_cat, Category.code == explicit_cat)))
            cat_obj = cat_q.scalars().first()
            if cat_obj:
                category_id = cat_obj.id

        auto_assigned_agent_id = await assign_agent_by_skill_and_level(db, category_id, level="L1")
    except Exception as e:
        logger.error(f"[AutoAssign L1 Error]: {e}")

    initial_risk_flag = "CHECK_REQUIRED" if is_under_threshold else "NORMAL"

    new_ticket = Ticket(
        ticket_code=ticket_code,
        requester_id=requester_id,
        assigned_agent_id=auto_assigned_agent_id,
        support_level="L1",
        risk_flag=initial_risk_flag,
        escalation_status="NONE",
        first_response_due_at=first_response_due,
        resolution_due_at=resolution_due,
        ai_suggested_priority=suggested_priority,
        ai_confidence_score=ai_result.confidence_score,
        priority=ticket_data.get("priority") if not auto_triage_enabled and ticket_data.get("priority") else suggested_priority,
        category_id=category_id,
        title=ticket_data.get("title", ""),
        description=ticket_data.get("description", ""),
    )
    db.add(new_ticket)
    await db.flush()
    
    # Ghi log quyết định phân công ban đầu
    has_pii = PIIMasker.mask_text(ticket_data.get("description", "")) != ticket_data.get("description", "")
    ai_log = AILog(
        ticket_id=new_ticket.id,
        task_type="TRIAGE",
        model_name="gemini-2.5-flash",
        pii_detected=has_pii,
        agent_action="AUTO_TRIAGE_AND_L1_ASSIGN" if ai_processed else "AUTO_TRIAGE_FALLBACK_L1_ASSIGN",
        error_message=ai_error_msg
    )
    db.add(ai_log)

    # Sau khi gán L1, AI phân tích nội dung ban đầu để phát hiện sentiment tiêu cực
    try:
        await evaluate_sentiment_and_auto_escalate(
            db,
            ticket=new_ticket,
            text_to_analyze=new_ticket.description,
            source_type="INITIAL_DESCRIPTION",
            precomputed_sentiment=sentiment_res
        )
    except Exception as e:
        logger.error(f"[Sentiment Error on Create]: {e}")
    
    await db.commit()
    return await get_ticket_by_id(db, new_ticket.id)


async def get_tickets(db: AsyncSession, skip: int = 0, limit: int = 100):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.category),
            selectinload(Ticket.requester),
            selectinload(Ticket.assigned_agent),
            selectinload(Ticket.previous_agent)
        )
        .order_by(Ticket.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


async def get_ticket_by_id(db: AsyncSession, ticket_id: str):
    from sqlalchemy.orm import selectinload
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
        raise NotFoundException("Ticket not found")
    
    t_dict = {c.name: getattr(ticket, c.name) for c in ticket.__table__.columns}
    t_dict["category_name"] = ticket.category.name if ticket.category else None
    t_dict["requester_name"] = ticket.requester.full_name if ticket.requester else None
    t_dict["assigned_agent_name"] = ticket.assigned_agent.full_name if ticket.assigned_agent else None
    t_dict["previous_agent_name"] = ticket.previous_agent.full_name if ticket.previous_agent else None
    return t_dict


async def get_dashboard_stats(
    db: AsyncSession,
    current_user: User | None = None,
    requester_id: str | None = None
) -> dict:
    from app.core.permissions import apply_ticket_scope
    now = datetime.utcnow()
    
    q_new = select(func.count(Ticket.id)).where(Ticket.status == "NEW")
    q_proc = select(func.count(Ticket.id)).where(Ticket.status == "PROCESSING")
    q_warn = (
        select(func.count(Ticket.id))
        .where(Ticket.status.notin_(["RESOLVED", "CLOSED"]))
        .where(Ticket.resolution_due_at > now)
        .where(Ticket.resolution_due_at <= now + timedelta(hours=2))
    )
    q_over = (
        select(func.count(Ticket.id))
        .where(Ticket.status.notin_(["RESOLVED", "CLOSED"]))
        .where(Ticket.resolution_due_at < now)
    )
    
    if current_user:
        q_new = apply_ticket_scope(q_new, current_user)
        q_proc = apply_ticket_scope(q_proc, current_user)
        q_warn = apply_ticket_scope(q_warn, current_user)
        q_over = apply_ticket_scope(q_over, current_user)
    elif requester_id:
        q_new = q_new.where(Ticket.requester_id == requester_id)
        q_proc = q_proc.where(Ticket.requester_id == requester_id)
        q_warn = q_warn.where(Ticket.requester_id == requester_id)
        q_over = q_over.where(Ticket.requester_id == requester_id)
        
    new_count = await db.scalar(q_new)
    processing_count = await db.scalar(q_proc)
    warning_count = await db.scalar(q_warn)
    overdue_count = await db.scalar(q_over)
    
    return {
        "new_tickets": new_count or 0,
        "processing_tickets": processing_count or 0,
        "sla_warning_tickets": warning_count or 0,
        "sla_overdue_tickets": overdue_count or 0
    }


async def escalate_ticket(
    db: AsyncSession,
    ticket_id: str,
    reason: str | None = None,
    escalated_by_user_id: str | None = None
) -> dict:
    """
    Quy trình chuyển cấp thủ công (Manual Escalation) do Team Lead hoặc Admin thực hiện:
    - Gán support_level = 'L2'
    - escalation_status = 'MANUAL_ESCALATED'
    - Tự động tìm và tái phân công cho nhân viên L2 có kỹ năng phù hợp danh mục
    - Ghi nhận comment nội bộ và audit log
    """
    from sqlalchemy.orm import selectinload

    ticket_res = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.category), selectinload(Ticket.assigned_agent))
        .where(Ticket.id == ticket_id)
    )
    ticket = ticket_res.scalars().first()
    if not ticket:
        raise NotFoundException("Ticket not found")

    old_agent_name = ticket.assigned_agent.full_name if ticket.assigned_agent else "Chưa phân công"
    ticket.previous_agent_id = ticket.assigned_agent_id

    # Tìm nhân viên L2 phù hợp kỹ năng
    l2_agent_id = await assign_agent_by_skill_and_level(
        db,
        ticket.category_id,
        level="L2",
        exclude_agent_id=ticket.assigned_agent_id,
        strict=False
    )
    new_agent_name = "Chưa gán"
    if l2_agent_id:
        ticket.assigned_agent_id = l2_agent_id
        agent_res = await db.execute(select(User).where(User.id == l2_agent_id))
        new_agent = agent_res.scalars().first()
        ticket.assigned_agent = new_agent
        new_agent_name = new_agent.full_name if new_agent else "Nhân viên L2"

    ticket.is_escalated = True
    ticket.support_level = "L2"
    ticket.escalation_status = "MANUAL_ESCALATED"
    ticket.escalated_at = datetime.utcnow()
    ticket.escalation_reason = reason or "Thủ công chuyển cấp lên Tuyến 2 (L2)"

    escalate_comment = Comment(
        ticket_id=ticket.id,
        user_id=escalated_by_user_id or ticket.requester_id,
        content=(
            f"👤 [Chuyển cấp thủ công lên Tuyến 2 - L2]\n"
            f"• Người chuyển cấp: Quản trị viên / Trưởng nhóm\n"
            f"• Người xử lý trước: {old_agent_name}\n"
            f"• Người tiếp nhận mới: {new_agent_name}\n"
            f"{f'• Lý do: {reason}' if reason else ''}"
        ),
        is_internal=True
    )
    db.add(escalate_comment)
    await db.commit()

    return await get_ticket_by_id(db, ticket.id)
