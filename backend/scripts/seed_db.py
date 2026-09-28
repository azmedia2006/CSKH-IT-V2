import asyncio
import os
import sys
import uuid

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.future import select
from app.core.database import AsyncSessionLocal
from app.models.role import Role
from app.models.category import Category
from app.models.sla_policy import SLAPolicy
from app.models.user import User
from app.core.security import get_password_hash
from app.config import settings

# 5 Nhóm kỹ năng chuẩn theo danh mục hệ thống
SKILL_GROUPS = {
    "ACCOUNT_AUTH": "Tài khoản & Xác thực",
    "SOFTWARE_BUG": "Bug Phần mềm",
    "NETWORK_INFRA": "Hạ tầng Mạng",
    "ACCESS_RESOURCE": "Cấp quyền & Tài nguyên",
    "TECH_GUIDE": "Hướng dẫn Kỹ thuật"
}

# 25 Tài khoản Support Agent giả lập (15 L1 và 10 L2: Mỗi nhóm có đúng 3 L1 và 2 L2)
MOCK_SUPPORT_AGENTS = [
    # -------------------------------------------------------------
    # 1. Tài khoản & Xác thực (ACCOUNT_AUTH) - 3 L1, 2 L2
    # -------------------------------------------------------------
    {
        "id": "c0100001-0000-4000-8000-000000000001",
        "full_name": "Nguyễn Hải Phong",
        "email": "l1.auth.phong@cskh.vn",
        "support_level": "L1",
        "skill_group": "ACCOUNT_AUTH",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0901 112 001",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0100001-0000-4000-8000-000000000002",
        "full_name": "Lê Thu Trang",
        "email": "l1.auth.trang@cskh.vn",
        "support_level": "L1",
        "skill_group": "ACCOUNT_AUTH",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0901 112 002",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0100001-0000-4000-8000-000000000003",
        "full_name": "Đỗ Đăng Khoa",
        "email": "l1.auth.khoa@cskh.vn",
        "support_level": "L1",
        "skill_group": "ACCOUNT_AUTH",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0901 112 003",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0100002-0000-4000-8000-000000000004",
        "full_name": "Trần Nhật Minh",
        "email": "l2.auth.minh@cskh.vn",
        "support_level": "L2",
        "skill_group": "ACCOUNT_AUTH",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0901 112 004",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0100002-0000-4000-8000-000000000005",
        "full_name": "Vũ Thu Hằng",
        "email": "l2.auth.hang@cskh.vn",
        "support_level": "L2",
        "skill_group": "ACCOUNT_AUTH",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0901 112 005",
        "password": "Agent@123",
        "is_active": True
    },

    # -------------------------------------------------------------
    # 2. Bug Phần mềm (SOFTWARE_BUG) - 3 L1, 2 L2
    # -------------------------------------------------------------
    {
        "id": "c0200001-0000-4000-8000-000000000006",
        "full_name": "Hoàng Phương Nam",
        "email": "l1.bug.nam@cskh.vn",
        "support_level": "L1",
        "skill_group": "SOFTWARE_BUG",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0902 223 006",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0200001-0000-4000-8000-000000000007",
        "full_name": "Bùi Lệ Quyên",
        "email": "l1.bug.quyen@cskh.vn",
        "support_level": "L1",
        "skill_group": "SOFTWARE_BUG",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0902 223 007",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0200001-0000-4000-8000-000000000008",
        "full_name": "Ngô Gia Huy",
        "email": "l1.bug.huy@cskh.vn",
        "support_level": "L1",
        "skill_group": "SOFTWARE_BUG",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0902 223 008",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0200002-0000-4000-8000-000000000009",
        "full_name": "Đặng Thái Sơn",
        "email": "l2.bug.son@cskh.vn",
        "support_level": "L2",
        "skill_group": "SOFTWARE_BUG",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0902 223 009",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0200002-0000-4000-8000-000000000010",
        "full_name": "Mai Ngọc Lan",
        "email": "l2.bug.lan@cskh.vn",
        "support_level": "L2",
        "skill_group": "SOFTWARE_BUG",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0902 223 010",
        "password": "Agent@123",
        "is_active": True
    },

    # -------------------------------------------------------------
    # 3. Hạ tầng Mạng (NETWORK_INFRA) - 3 L1, 2 L2
    # -------------------------------------------------------------
    {
        "id": "c0300001-0000-4000-8000-000000000011",
        "full_name": "Vũ Anh Tuấn",
        "email": "l1.net.tuan@cskh.vn",
        "support_level": "L1",
        "skill_group": "NETWORK_INFRA",
        "department": "Hạ tầng IT",
        "phone_number": "0903 334 011",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0300001-0000-4000-8000-000000000012",
        "full_name": "Đinh Khánh Huyền",
        "email": "l1.net.huyen@cskh.vn",
        "support_level": "L1",
        "skill_group": "NETWORK_INFRA",
        "department": "Hạ tầng IT",
        "phone_number": "0903 334 012",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0300001-0000-4000-8000-000000000013",
        "full_name": "Phạm Tùng Lâm",
        "email": "l1.net.lam@cskh.vn",
        "support_level": "L1",
        "skill_group": "NETWORK_INFRA",
        "department": "Hạ tầng IT",
        "phone_number": "0903 334 013",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0300002-0000-4000-8000-000000000014",
        "full_name": "Trịnh Quốc Cường",
        "email": "l2.net.cuong@cskh.vn",
        "support_level": "L2",
        "skill_group": "NETWORK_INFRA",
        "department": "Hạ tầng IT",
        "phone_number": "0903 334 014",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0300002-0000-4000-8000-000000000015",
        "full_name": "Hà Mai Phương",
        "email": "l2.net.phuong@cskh.vn",
        "support_level": "L2",
        "skill_group": "NETWORK_INFRA",
        "department": "Hạ tầng IT",
        "phone_number": "0903 334 015",
        "password": "Agent@123",
        "is_active": True
    },

    # -------------------------------------------------------------
    # 4. Cấp quyền & Tài nguyên (ACCESS_RESOURCE) - 3 L1, 2 L2
    # -------------------------------------------------------------
    {
        "id": "c0400001-0000-4000-8000-000000000016",
        "full_name": "Lý Khánh Duy",
        "email": "l1.acc.duy@cskh.vn",
        "support_level": "L1",
        "skill_group": "ACCESS_RESOURCE",
        "department": "An ninh & Hệ thống",
        "phone_number": "0904 445 016",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0400001-0000-4000-8000-000000000017",
        "full_name": "Phan Như Thảo",
        "email": "l1.acc.thao@cskh.vn",
        "support_level": "L1",
        "skill_group": "ACCESS_RESOURCE",
        "department": "An ninh & Hệ thống",
        "phone_number": "0904 445 017",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0400001-0000-4000-8000-000000000018",
        "full_name": "Dương Quốc Việt",
        "email": "l1.acc.viet@cskh.vn",
        "support_level": "L1",
        "skill_group": "ACCESS_RESOURCE",
        "department": "An ninh & Hệ thống",
        "phone_number": "0904 445 018",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0400002-0000-4000-8000-000000000019",
        "full_name": "Cao Tiến Thành",
        "email": "l2.acc.thanh@cskh.vn",
        "support_level": "L2",
        "skill_group": "ACCESS_RESOURCE",
        "department": "An ninh & Hệ thống",
        "phone_number": "0904 445 019",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0400002-0000-4000-8000-000000000020",
        "full_name": "Lương Thanh Nga",
        "email": "l2.acc.nga@cskh.vn",
        "support_level": "L2",
        "skill_group": "ACCESS_RESOURCE",
        "department": "An ninh & Hệ thống",
        "phone_number": "0904 445 020",
        "password": "Agent@123",
        "is_active": True
    },

    # -------------------------------------------------------------
    # 5. Hướng dẫn Kỹ thuật (TECH_GUIDE) - 3 L1, 2 L2
    # -------------------------------------------------------------
    {
        "id": "c0500001-0000-4000-8000-000000000021",
        "full_name": "Tạ Hoàng Long",
        "email": "l1.tech.long@cskh.vn",
        "support_level": "L1",
        "skill_group": "TECH_GUIDE",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0905 556 021",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0500001-0000-4000-8000-000000000022",
        "full_name": "Trương Tuyết Mai",
        "email": "l1.tech.mai@cskh.vn",
        "support_level": "L1",
        "skill_group": "TECH_GUIDE",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0905 556 022",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0500001-0000-4000-8000-000000000023",
        "full_name": "Chu Xuân Bắc",
        "email": "l1.tech.bac@cskh.vn",
        "support_level": "L1",
        "skill_group": "TECH_GUIDE",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0905 556 023",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0500002-0000-4000-8000-000000000024",
        "full_name": "Võ Minh Trí",
        "email": "l2.tech.tri@cskh.vn",
        "support_level": "L2",
        "skill_group": "TECH_GUIDE",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0905 556 024",
        "password": "Agent@123",
        "is_active": True
    },
    {
        "id": "c0500002-0000-4000-8000-000000000025",
        "full_name": "Nghiêm Thùy Vân",
        "email": "l2.tech.van@cskh.vn",
        "support_level": "L2",
        "skill_group": "TECH_GUIDE",
        "department": "Hỗ trợ Kỹ thuật",
        "phone_number": "0905 556 025",
        "password": "Agent@123",
        "is_active": True
    }
]

async def ensure_user_columns(session: AsyncSession):
    """Đảm bảo bảng users có cột support_level và skill_group (Idempotent)"""
    try:
        await session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS support_level VARCHAR(10);"))
        await session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_group VARCHAR(50);"))
        await session.commit()
    except Exception as e:
        await session.rollback()
        print(f"Notice during column check: {e}")

async def seed_roles(session: AsyncSession):
    roles = [
        {"role_name": "ADMIN", "description": "System Administrator"},
        {"role_name": "TEAM_LEAD", "description": "Support Team Lead"},
        {"role_name": "SUPPORT_AGENT", "description": "Support Agent"},
        {"role_name": "REQUESTER", "description": "End User / Requester"},
    ]
    
    for r in roles:
        result = await session.execute(select(Role).filter_by(role_name=r["role_name"]))
        if not result.scalars().first():
            role = Role(**r)
            session.add(role)
    await session.commit()
    print("Roles seeded.")

async def seed_categories(session: AsyncSession):
    categories = [
        {"name": "Tài khoản & Xác thực", "code": "ACCOUNT_AUTH", "description": "Lỗi đăng nhập, mất mật khẩu, 2FA"},
        {"name": "Bug Phần mềm", "code": "SOFTWARE_BUG", "description": "Lỗi phần mềm nội bộ"},
        {"name": "Hạ tầng Mạng", "code": "NETWORK_INFRA", "description": "Mất kết nối mạng, VPN"},
        {"name": "Cấp quyền & Tài nguyên", "code": "ACCESS_RESOURCE", "description": "Xin cấp quyền truy cập hệ thống"},
        {"name": "Hướng dẫn Kỹ thuật", "code": "TECH_GUIDE", "description": "Hỏi đáp, hướng dẫn sử dụng"},
        {"name": "Thiết bị & Phần cứng", "code": "DEVICE", "description": "Hỏng máy tính, chuột, bàn phím, máy in, thiết bị ngoại vi"},
        {"name": "Chưa phân loại", "code": "UNCATEGORIZED", "description": "Fallback cho AI Triage"},
    ]
    
    for c in categories:
        result = await session.execute(select(Category).filter_by(code=c["code"]))
        if not result.scalars().first():
            cat = Category(**c)
            session.add(cat)
    await session.commit()
    print("Categories seeded.")

async def seed_sla_policies(session: AsyncSession):
    policies = [
        {"priority_level": "CRITICAL_P1", "response_time_minutes": settings.SLA_P1_RESPONSE, "resolve_time_minutes": settings.SLA_P1_RESOLVE, "description": "Tác động nghiêm trọng, toàn hệ thống"},
        {"priority_level": "HIGH_P2", "response_time_minutes": settings.SLA_P2_RESPONSE, "resolve_time_minutes": settings.SLA_P2_RESOLVE, "description": "Tác động lớn, nhiều người bị ảnh hưởng"},
        {"priority_level": "MEDIUM_P3", "response_time_minutes": settings.SLA_P3_RESPONSE, "resolve_time_minutes": settings.SLA_P3_RESOLVE, "description": "Tác động vừa, 1 cá nhân hoặc nhóm nhỏ"},
        {"priority_level": "LOW_P4", "response_time_minutes": settings.SLA_P4_RESPONSE, "resolve_time_minutes": settings.SLA_P4_RESOLVE, "description": "Yêu cầu dịch vụ thông thường, không gấp"},
    ]
    
    for p in policies:
        result = await session.execute(select(SLAPolicy).filter_by(priority_level=p["priority_level"]))
        if not result.scalars().first():
            pol = SLAPolicy(**p)
            session.add(pol)
    await session.commit()
    print("SLA Policies seeded.")

async def seed_users(session: AsyncSession):
    """Giữ nguyên và nạp các tài khoản cơ bản hệ thống (Admin, Lead, Agent mặc định, Requester)"""
    role_records = (await session.execute(select(Role))).scalars().all()
    roles_map = {r.role_name: r.id for r in role_records}

    users_to_seed = [
        {
            "email": "admin@cskh.vn",
            "password": "Admin@123",
            "full_name": "Quản trị viên Hệ thống (Admin)",
            "role_name": "ADMIN"
        },
        {
            "email": "lead@cskh.vn",
            "password": "Lead@123",
            "full_name": "Phạm Quốc Tuấn (IT Team Lead)",
            "role_name": "TEAM_LEAD"
        },
        {
            "email": "agent@cskh.vn",
            "password": "Agent@123",
            "full_name": "Lê Hoàng Nam (Support Agent)",
            "role_name": "SUPPORT_AGENT",
            "support_level": "L1",
            "skill_group": "ACCOUNT_AUTH"
        },
        {
            "email": "user@company.vn",
            "password": "User@123",
            "full_name": "Nguyễn Văn An (Kế toán - Requester)",
            "role_name": "REQUESTER"
        },
        {
            "email": "mai.tran@company.vn",
            "password": "User@123",
            "full_name": "Trần Thị Mai (Marketing - Requester)",
            "role_name": "REQUESTER"
        }
    ]

    for u in users_to_seed:
        result = await session.execute(select(User).filter_by(email=u["email"]))
        existing = result.scalars().first()
        if not existing:
            role_id = roles_map.get(u["role_name"])
            if role_id:
                user = User(
                    email=u["email"],
                    hashed_password=get_password_hash(u["password"]),
                    full_name=u["full_name"],
                    role_id=role_id,
                    is_active=True,
                    support_level=u.get("support_level"),
                    skill_group=u.get("skill_group")
                )
                session.add(user)
                print(f"Created standard account: {u['email']} [{u['role_name']}]")
        else:
            # Nếu tài khoản đã tồn tại, bảo lưu thông tin và bổ sung thuộc tính nếu còn trống
            if "support_level" in u and not existing.support_level:
                existing.support_level = u["support_level"]
            if "skill_group" in u and not existing.skill_group:
                existing.skill_group = u["skill_group"]
            print(f"User {u['email']} already exists. Preserved.")
            
    await session.commit()
    print("Standard users checked and preserved.")

async def seed_support_agents(session: AsyncSession) -> int:
    """
    Nạp 25 tài khoản Support Agent giả lập (15 L1, 10 L2 qua 5 nhóm kỹ năng).
    - Idempotent: Chạy nhiều lần không tạo tài khoản trùng và không xóa dữ liệu người dùng đã có.
    - An toàn: Chỉ nạp ở môi trường phát triển / demo (DEBUG=True hoặc ENV in ['development', 'demo', 'test']).
    - Cấp hỗ trợ L1/L2 được lưu dưới dạng thuộc tính nhân viên (support_level), vai trò giữ nguyên SUPPORT_AGENT.
    """
    await ensure_user_columns(session)

    # Kiểm tra môi trường: Chỉ chạy ở dev/demo
    is_dev = settings.DEBUG or os.getenv("ENVIRONMENT", "development").lower() in ["development", "dev", "demo", "test"]
    if not is_dev:
        print("Skipping mock support agents seed: Not in development or demo environment.")
        return 0

    role_res = await session.execute(select(Role).filter_by(role_name="SUPPORT_AGENT"))
    agent_role = role_res.scalars().first()
    if not agent_role:
        print("Error: Role SUPPORT_AGENT not found. Seed roles first.")
        return 0

    created_count = 0
    updated_count = 0

    for agent_data in MOCK_SUPPORT_AGENTS:
        result = await session.execute(select(User).filter_by(email=agent_data["email"]))
        existing = result.scalars().first()

        if not existing:
            # Tạo mới tài khoản với UUID cố định hoặc sinh ngẫu nhiên an toàn
            new_agent = User(
                id=agent_data.get("id") or str(uuid.uuid4()),
                email=agent_data["email"],
                hashed_password=get_password_hash(agent_data["password"]),
                full_name=agent_data["full_name"],
                role_id=agent_role.id,
                department=agent_data["department"],
                phone_number=agent_data["phone_number"],
                is_active=agent_data["is_active"],
                support_level=agent_data["support_level"],
                skill_group=agent_data["skill_group"]
            )
            session.add(new_agent)
            created_count += 1
        else:
            # Đồng bộ thuộc tính cấp độ và kỹ năng nếu chưa có mà không ghi đè mật khẩu của người dùng
            changed = False
            if existing.support_level != agent_data["support_level"]:
                existing.support_level = agent_data["support_level"]
                changed = True
            if existing.skill_group != agent_data["skill_group"]:
                existing.skill_group = agent_data["skill_group"]
                changed = True
            if changed:
                updated_count += 1

    await session.commit()
    print(f"Mock support agents seeded: {created_count} created, {updated_count} updated. Total 25 L1/L2 accounts ready.")
    return created_count

async def main():
    async with AsyncSessionLocal() as session:
        await ensure_user_columns(session)
        await seed_roles(session)
        await seed_categories(session)
        await seed_sla_policies(session)
        await seed_users(session)
        await seed_support_agents(session)
        print("Database seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(main())
