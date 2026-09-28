import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Dict, Any

from app.api.deps import get_db, get_current_user
from app.models.ticket import Ticket
from app.models.user import User
from app.core.permissions import apply_ticket_scope, is_requester

router = APIRouter()

@router.get("/kpi")
async def get_kpi(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Số liệu KPI Service Desk:
    - Chặn khách hàng (Requester) truy cập số liệu nội bộ.
    - Áp dụng phạm vi dữ liệu theo Role (L1 xem L1, L2 xem L2, Lead/Admin xem toàn diện).
    """
    if is_requester(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Khách hàng không có quyền truy cập số liệu KPI nội bộ."
        )

    # Total tickets
    total_q = apply_ticket_scope(select(func.count(Ticket.id)), current_user)
    total_result = await db.execute(total_q)
    total_tickets = total_result.scalar_one()

    # Open tickets
    open_q = select(func.count(Ticket.id)).where(Ticket.status.in_(["NEW", "OPEN", "PENDING", "PROCESSING", "WAITING_CUSTOMER"]))
    open_q = apply_ticket_scope(open_q, current_user)
    open_result = await db.execute(open_q)
    open_tickets = open_result.scalar_one()

    # Closed tickets
    closed_q = select(func.count(Ticket.id)).where(Ticket.status.in_(["RESOLVED", "CLOSED"]))
    closed_q = apply_ticket_scope(closed_q, current_user)
    closed_result = await db.execute(closed_q)
    closed_tickets = closed_result.scalar_one()

    # AI Handled (where confidence > 0.4)
    ai_q = select(func.count(Ticket.id)).where(Ticket.ai_confidence_score > 0.4)
    ai_q = apply_ticket_scope(ai_q, current_user)
    ai_result = await db.execute(ai_q)
    ai_handled = ai_result.scalar_one()
    
    # SLA Breached (escalated)
    breached_q = select(func.count(Ticket.id)).where(Ticket.is_escalated == True)
    breached_q = apply_ticket_scope(breached_q, current_user)
    breached_result = await db.execute(breached_q)
    sla_breached = breached_result.scalar_one()

    # Calculate MTTFR (Mean Time to First Response) & MTTR (Mean Time to Resolve) & SLA Compliance Rate
    time_q = select(
        Ticket.created_at,
        Ticket.first_responded_at,
        Ticket.resolved_at,
        Ticket.resolution_due_at,
        Ticket.is_escalated,
        Ticket.status
    )
    time_q = apply_ticket_scope(time_q, current_user)
    time_res = await db.execute(time_q)
    rows = time_res.all()

    first_response_diffs = []
    resolve_diffs = []
    resolved_count = 0
    sla_met_count = 0

    for r in rows:
        created, first_resp, resolved, due, escalated, status_val = r[0], r[1], r[2], r[3], r[4], r[5]

        if created and first_resp:
            diff = (first_resp - created).total_seconds() / 60.0
            if diff >= 0:
                first_response_diffs.append(diff)

        if created and resolved:
            diff = (resolved - created).total_seconds() / 60.0
            if diff >= 0:
                resolve_diffs.append(diff)

        if status_val in ["RESOLVED", "CLOSED"] or resolved is not None:
            resolved_count += 1
            if resolved and due and resolved <= due:
                sla_met_count += 1
            elif not escalated:
                sla_met_count += 1

    mttfr_minutes = round(sum(first_response_diffs) / len(first_response_diffs), 1) if first_response_diffs else 0.0
    mttr_minutes = round(sum(resolve_diffs) / len(resolve_diffs), 1) if resolve_diffs else 0.0
    sla_compliance_rate = round((sla_met_count / resolved_count) * 100, 1) if resolved_count > 0 else 100.0

    return {
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "closed_tickets": closed_tickets,
        "ai_handled": ai_handled,
        "sla_breached": sla_breached,
        "mttfr_minutes": mttfr_minutes,
        "mttr_minutes": mttr_minutes,
        "sla_compliance_rate": sla_compliance_rate
    }

@router.get("/chart-data")
async def get_chart_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Biểu đồ phân phối trạng thái & độ ưu tiên (chặn Requester)."""
    if is_requester(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Khách hàng không có quyền truy cập biểu đồ nội bộ."
        )

    status_q = apply_ticket_scope(select(Ticket.status, func.count(Ticket.id)), current_user)
    priority_q = apply_ticket_scope(select(Ticket.priority, func.count(Ticket.id)), current_user)

    # Status distribution
    status_result = await db.execute(status_q.group_by(Ticket.status))
    status_distribution = [{"name": row[0], "value": row[1]} for row in status_result.fetchall()]

    # Priority distribution
    priority_result = await db.execute(priority_q.group_by(Ticket.priority))
    priority_distribution = [{"name": row[0], "value": row[1]} for row in priority_result.fetchall()]

    return {
        "status_distribution": status_distribution,
        "priority_distribution": priority_distribution
    }

@router.get("/export")
async def export_tickets_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xuất danh sách ticket ra CSV theo phạm vi được phân quyền (chặn Requester)."""
    if is_requester(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Khách hàng không có quyền xuất dữ liệu báo cáo hệ thống."
        )

    q = (
        select(Ticket)
        .options(
            selectinload(Ticket.category),
            selectinload(Ticket.requester),
            selectinload(Ticket.assigned_agent),
        )
        .order_by(Ticket.created_at.desc())
    )
    q = apply_ticket_scope(q, current_user)

    result = await db.execute(q)
    tickets = result.scalars().all()

    output = io.StringIO()
    # Write UTF-8 BOM so Excel opens Vietnamese characters correctly
    output.write("\ufeff")

    writer = csv.writer(output)
    writer.writerow([
        "Mã Ticket",
        "Tiêu đề",
        "Trạng thái",
        "Độ ưu tiên",
        "Danh mục",
        "Người yêu cầu",
        "Kỹ thuật viên",
        "Thời hạn phản hồi",
        "Thời hạn xử lý",
        "Phản hồi đầu tiên lúc",
        "Giải quyết lúc",
        "Đóng lúc",
        "Bị trễ SLA (Escalated)",
        "Điểm tin cậy AI",
        "Ngày tạo"
    ])

    for t in tickets:
        writer.writerow([
            t.ticket_code or "",
            t.title or "",
            t.status or "",
            t.priority or "",
            t.category.name if t.category else "",
            t.requester.full_name if t.requester else (t.requester.email if t.requester else ""),
            t.assigned_agent.full_name if t.assigned_agent else (t.assigned_agent.email if t.assigned_agent else "Chưa phân công"),
            t.first_response_due_at.strftime("%Y-%m-%d %H:%M:%S") if t.first_response_due_at else "",
            t.resolution_due_at.strftime("%Y-%m-%d %H:%M:%S") if t.resolution_due_at else "",
            t.first_responded_at.strftime("%Y-%m-%d %H:%M:%S") if t.first_responded_at else "",
            t.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if t.resolved_at else "",
            t.closed_at.strftime("%Y-%m-%d %H:%M:%S") if t.closed_at else "",
            "Có" if t.is_escalated else "Không",
            f"{t.ai_confidence_score:.2f}" if t.ai_confidence_score is not None else "",
            t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else ""
        ])

    csv_data = output.getvalue().encode("utf-8-sig")

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="bao_cao_tickets.csv"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
