from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user, RoleChecker
from app.schemas.dashboard import DashboardStats
from app.models.user import User
from app.models.ai_log import AILog
from app.models.ticket import Ticket
from app.services import ticket_service

router = APIRouter()

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await ticket_service.get_dashboard_stats(db, current_user=current_user)


@router.get("/ai-activities")
async def get_recent_ai_activities(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "TEAM_LEAD", "SUPPORT_AGENT"]))
):
    """Lấy danh sách 5 hoạt động AI gần nhất từ cơ sở dữ liệu thật."""
    stmt = (
        select(AILog)
        .options(selectinload(AILog.ticket).selectinload(Ticket.category))
        .order_by(AILog.created_at.desc())
        .limit(6)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    action_label_map = {
        "TRIAGE": "Phân loại tự động",
        "CLASSIFY": "Phân loại tự động",
        "TRIAGE_RECLASSIFY": "Phân loại lại",
        "COPILOT": "Gợi ý phản hồi AI Copilot",
        "SUMMARIZE": "Tóm tắt tiến trình",
        "SENTIMENT_ANALYSIS": "Đánh giá cảm xúc & Rủi ro",
    }

    activities = []
    for idx, log in enumerate(logs):
        ticket = log.ticket
        ticket_code = ticket.ticket_code if ticket else "N/A"
        category_name = ticket.category.name if ticket and ticket.category else "Chung"
        priority = ticket.priority if ticket else "P3"
        conf = f"{int(ticket.ai_confidence_score * 100)}%" if (ticket and ticket.ai_confidence_score is not None) else "90%"
        action = action_label_map.get(log.task_type, log.task_type or "AI xử lý")

        activities.append({
            "id": log.id or str(idx),
            "ticket": ticket_code,
            "action": action,
            "category": category_name,
            "priority": priority,
            "confidence": conf,
            "time": log.created_at.strftime("%H:%M %d/%m") if log.created_at else "Gần đây"
        })

    return activities

