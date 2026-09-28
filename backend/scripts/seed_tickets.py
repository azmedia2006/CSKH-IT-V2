import asyncio
import os
import sys
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.category import Category
from app.models.ticket import Ticket
from sqlalchemy.future import select

async def seed_tickets():
    async with AsyncSessionLocal() as session:
        # Get users
        admin_res = await session.execute(select(User).filter_by(email="admin@cskh.vn"))
        admin = admin_res.scalars().first()
        
        user_res = await session.execute(select(User).filter_by(email="user@company.vn"))
        user = user_res.scalars().first() or admin

        mai_res = await session.execute(select(User).filter_by(email="mai.tran@company.vn"))
        mai = mai_res.scalars().first() or user
        
        agent_res = await session.execute(select(User).filter_by(email="agent@cskh.vn"))
        agent = agent_res.scalars().first()

        # Get categories
        cat_res = await session.execute(select(Category))
        categories = cat_res.scalars().all()
        cat_dict = {c.code: c.id for c in categories}
        
        now = datetime.utcnow()

        tickets_data = [
            {
                "ticket_code": "TCK-1001",
                "title": "Không đăng nhập được vào hệ thống CRM",
                "description": "Tôi nhập đúng mật khẩu nhưng hệ thống báo sai. Xin hỗ trợ gấp vì tôi cần lấy data cho sếp.",
                "requester_id": user.id,
                "assigned_agent_id": agent.id if agent else None,
                "category_id": cat_dict.get("ACCOUNT_AUTH"),
                "priority": "P1",
                "status": "PROCESSING",
                "ai_confidence_score": 0.95,
                "ai_suggested_priority": "P1",
                "is_escalated": True,
                "resolution_due_at": now - timedelta(hours=1), # Breached SLA
                "first_response_due_at": now - timedelta(hours=2),
                "created_at": now - timedelta(days=1)
            },
            {
                "ticket_code": "TCK-1002",
                "title": "Cần cấp quyền truy cập thư mục MKT",
                "description": "Tôi mới chuyển qua phòng Marketing, cần xin quyền truy cập Sharepoint MKT.",
                "requester_id": mai.id,
                "assigned_agent_id": agent.id if agent else None,
                "category_id": cat_dict.get("ACCESS_RESOURCE"),
                "priority": "P3",
                "status": "NEW",
                "ai_confidence_score": 0.88,
                "ai_suggested_priority": "P3",
                "is_escalated": False,
                "resolution_due_at": now + timedelta(hours=24),
                "created_at": now - timedelta(hours=2)
            },
            {
                "ticket_code": "TCK-1003",
                "title": "Lỗi phần mềm kế toán lúc xuất báo cáo",
                "description": "Khi bấm xuất Excel, phần mềm cứ quay đều rồi văng ra màn hình chính.",
                "requester_id": user.id,
                "assigned_agent_id": agent.id if agent else None,
                "category_id": cat_dict.get("SOFTWARE_BUG"),
                "priority": "P2",
                "status": "RESOLVED",
                "ai_confidence_score": 0.75,
                "ai_suggested_priority": "P2",
                "is_escalated": False,
                "resolution_due_at": now + timedelta(hours=5),
                "created_at": now - timedelta(days=2)
            },
            {
                "ticket_code": "TCK-1004",
                "title": "Hướng dẫn sử dụng máy in mới",
                "description": "Cho tôi xin file hướng dẫn cài driver máy in tầng 4.",
                "requester_id": user.id,
                "assigned_agent_id": agent.id if agent else None,
                "category_id": cat_dict.get("TECH_GUIDE"),
                "priority": "P4",
                "status": "NEW",
                "ai_confidence_score": 0.92,
                "ai_suggested_priority": "P4",
                "is_escalated": False,
                "resolution_due_at": now + timedelta(hours=48),
                "created_at": now - timedelta(minutes=30)
            },
            {
                "ticket_code": "TCK-1005",
                "title": "Mất kết nối WiFi văn phòng tầng 3",
                "description": "WiFi chập chờn liên tục từ sáng, không load được mail công ty.",
                "requester_id": mai.id,
                "assigned_agent_id": agent.id if agent else None,
                "category_id": cat_dict.get("NETWORK_INFRA"),
                "priority": "P2",
                "status": "PROCESSING",
                "ai_confidence_score": 0.91,
                "ai_suggested_priority": "P2",
                "is_escalated": False,
                "resolution_due_at": now + timedelta(hours=3),
                "created_at": now - timedelta(hours=1)
            }
        ]

        for t_data in tickets_data:
            res = await session.execute(select(Ticket).filter_by(ticket_code=t_data["ticket_code"]))
            existing = res.scalars().first()
            if existing:
                for k, v in t_data.items():
                    setattr(existing, k, v)
            else:
                ticket = Ticket(**t_data)
                session.add(ticket)
        
        await session.commit()
        print("Mock tickets seeded successfully.")

if __name__ == "__main__":
    asyncio.run(seed_tickets())
