import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import async_session_maker, engine
from app.core.security import get_password_hash
from app.models.role import Role
from app.models.category import Category
from app.models.sla_policy import SLAPolicy
from app.models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    async with async_session_maker() as db:
        # 1. Seed Roles
        roles = ["ADMIN", "TEAM_LEAD", "SUPPORT_AGENT", "REQUESTER"]
        for role_name in roles:
            result = await db.execute(select(Role).where(Role.role_name == role_name))
            if not result.scalars().first():
                db.add(Role(role_name=role_name, description=f"{role_name} Access"))
        
        # 2. Seed Categories
        categories = [
            {"code": "ACCOUNT_AUTH", "name": "Tài khoản & Đăng nhập"},
            {"code": "SOFTWARE_BUG", "name": "Lỗi phần mềm"},
            {"code": "NETWORK_INFRA", "name": "Mạng & Hệ thống"},
            {"code": "ACCESS_RESOURCE", "name": "Quyền truy cập"},
            {"code": "TECH_GUIDE", "name": "Hướng dẫn kỹ thuật"},
            {"code": "DEVICE", "name": "Thiết bị & Phần cứng"},
            {"code": "UNCATEGORIZED", "name": "Khác"},
        ]
        for cat in categories:
            result = await db.execute(select(Category).where(Category.code == cat["code"]))
            if not result.scalars().first():
                db.add(Category(**cat))

        # 3. Seed SLA Policies (ITIL Standard)
        slas = [
            {"priority": "P1", "resp": 15, "res": 240, "desc": "Critical - Company-wide"},
            {"priority": "P2", "resp": 30, "res": 480, "desc": "High - Department-wide"},
            {"priority": "P3", "resp": 240, "res": 1440, "desc": "Medium - Single User"},
            {"priority": "P4", "resp": 1440, "res": 4320, "desc": "Low - General Info"},
        ]
        for sla in slas:
            result = await db.execute(select(SLAPolicy).where(SLAPolicy.priority_level == sla["priority"]))
            if not result.scalars().first():
                db.add(SLAPolicy(
                    priority_level=sla["priority"], 
                    response_time_minutes=sla["resp"], 
                    resolve_time_minutes=sla["res"],
                    description=sla["desc"]
                ))
        
        await db.commit()
        
        # 4. Seed Admin User
        admin_role_result = await db.execute(select(Role).where(Role.role_name == "ADMIN"))
        admin_role = admin_role_result.scalars().first()
        
        if admin_role:
            user_result = await db.execute(select(User).where(User.email == "admin@company.com"))
            if not user_result.scalars().first():
                admin_user = User(
                    role_id=admin_role.id,
                    full_name="System Admin",
                    email="admin@company.com",
                    hashed_password=get_password_hash("admin123"),
                    department="IT Operations"
                )
                db.add(admin_user)
                await db.commit()
                logger.info("Admin user 'admin@company.com' created with password 'admin123'")
        
        logger.info("Database Initialization completed!")

if __name__ == "__main__":
    asyncio.run(init_db())
