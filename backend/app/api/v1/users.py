from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_
from pydantic import BaseModel, ConfigDict

from app.api.deps import get_db, get_current_user, RoleChecker
from app.models.user import User
from app.models.role import Role
from app.models.ticket import Ticket
from app.core.security import verify_password, get_password_hash

router = APIRouter()

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    department: str | None = None
    phone_number: str | None = None
    is_active: bool
    role_name: str | None = None
    support_level: str | None = None
    skill_group: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RequesterTicketSummary(BaseModel):
    id: str
    ticket_code: str
    title: str
    status: str
    priority: str
    created_at: Optional[datetime] = None


class RequesterProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    department: str | None = None
    phone_number: str | None = None
    is_active: bool
    role_name: str | None = None
    tickets: List[RequesterTicketSummary] = []
    recent_tickets: List[RequesterTicketSummary] = []
    total_tickets: int = 0
    open_tickets: int = 0
    closed_tickets: int = 0

class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    department: str | None = None
    phone_number: str | None = None
    current_password: str | None = None
    new_password: str | None = None

class CreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role_name: str = "REQUESTER"
    department: str | None = None
    phone_number: str | None = None
    is_active: bool = True
    support_level: str | None = None
    skill_group: str | None = None

class AdminUpdateUserRequest(BaseModel):
    email: str | None = None
    full_name: str | None = None
    role_name: str | None = None
    department: str | None = None
    phone_number: str | None = None
    is_active: bool | None = None
    new_password: str | None = None
    password: str | None = None
    support_level: str | None = None
    skill_group: str | None = None

@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current logged in user profile"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "department": current_user.department,
        "phone_number": current_user.phone_number,
        "is_active": current_user.is_active,
        "role_name": current_user.role.role_name if current_user.role else None,
        "support_level": current_user.support_level,
        "skill_group": current_user.skill_group
    }

@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update personal profile information"""
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.department is not None:
        current_user.department = data.department
    if data.phone_number is not None:
        current_user.phone_number = data.phone_number
        
    if data.new_password:
        if not data.current_password or not verify_password(data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu hiện tại không chính xác."
            )
        if len(data.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu mới phải có tối thiểu 6 ký tự."
            )
        current_user.hashed_password = get_password_hash(data.new_password)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "department": current_user.department,
        "phone_number": current_user.phone_number,
        "is_active": current_user.is_active,
        "role_name": current_user.role.role_name if current_user.role else None
    }

@router.get("/agents", response_model=List[UserResponse])
async def list_support_agents(
    category_id: Optional[str] = None,
    skill_group: Optional[str] = None,
    support_level: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "TEAM_LEAD", "SUPPORT_AGENT"]))
):
    """
    Lấy danh sách nhân viên kỹ thuật hỗ trợ (SUPPORT_AGENT) phục vụ phân bổ công việc:
    - Hỗ trợ lọc theo nhóm chuyên trách (skill_group / category_id) theo yêu cầu UC-03.
    - Không gộp Admin vào danh sách phân công nhân viên kỹ thuật.
    """
    from app.models.category import Category
    from sqlalchemy import or_

    query = (
        select(User)
        .options(selectinload(User.role))
        .join(Role, User.role_id == Role.id)
        .where(
            Role.role_name.in_(["SUPPORT_AGENT", "TEAM_LEAD"]),
            User.is_active == True
        )
    )

    effective_skill = skill_group
    if not effective_skill and category_id and category_id != "ALL":
        cat_res = await db.execute(
            select(Category).where(
                or_(Category.id == category_id, Category.code == category_id, Category.code == category_id.upper())
            )
        )
        cat_obj = cat_res.scalars().first()
        if cat_obj and cat_obj.code:
            effective_skill = cat_obj.code.strip().upper()

    if effective_skill and effective_skill != "ALL":
        query = query.where(User.skill_group == effective_skill)

    if support_level and support_level != "ALL":
        query = query.where(User.support_level == support_level)

    query = query.order_by(User.full_name.asc())
    result = await db.execute(query)
    agents = result.scalars().all()

    # Nếu không có nhân viên nào trong nhóm chuyên trách, lấy danh sách SUPPORT_AGENT khả dụng
    if not agents and effective_skill:
        fallback_q = (
            select(User)
            .options(selectinload(User.role))
            .join(Role, User.role_id == Role.id)
            .where(
                Role.role_name.in_(["SUPPORT_AGENT", "TEAM_LEAD"]),
                User.is_active == True
            )
            .order_by(User.full_name.asc())
        )
        if support_level and support_level != "ALL":
            fallback_q = fallback_q.where(User.support_level == support_level)
        fb_res = await db.execute(fallback_q)
        agents = fb_res.scalars().all()

    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "department": u.department,
            "phone_number": u.phone_number,
            "is_active": u.is_active,
            "role_name": u.role.role_name if u.role else None,
            "support_level": u.support_level,
            "skill_group": u.skill_group
        } for u in agents
    ]

@router.get("/requesters/{requester_id}", response_model=RequesterProfileResponse)
async def get_requester_profile(
    requester_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN", "TEAM_LEAD", "SUPPORT_AGENT"]))
):
    """Tra cứu hồ sơ liên hệ và lịch sử ticket của Requester phục vụ hỗ trợ kỹ thuật."""
    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.id == requester_id)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người yêu cầu.")

    # Lấy danh sách ticket liên quan của User này (cả trường hợp là Requester hoặc Agent phụ trách)
    t_result = await db.execute(
        select(Ticket)
        .where(or_(Ticket.requester_id == requester_id, Ticket.assigned_agent_id == requester_id))
        .order_by(Ticket.created_at.desc())
        .limit(50)
    )
    tickets = t_result.scalars().all()

    ticket_summaries = [
        RequesterTicketSummary(
            id=t.id,
            ticket_code=t.ticket_code,
            title=t.title,
            status=t.status,
            priority=t.priority,
            created_at=t.created_at
        )
        for t in tickets
    ]

    total_tickets = len(tickets)
    open_tickets = sum(1 for t in tickets if t.status in ["NEW", "ASSIGNED", "PROCESSING", "L2_WAITING", "PENDING"])
    closed_tickets = sum(1 for t in tickets if t.status in ["RESOLVED", "CLOSED"])

    return RequesterProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        department=user.department,
        phone_number=user.phone_number,
        is_active=user.is_active,
        role_name=user.role.role_name if user.role else None,
        tickets=ticket_summaries,
        recent_tickets=ticket_summaries,
        total_tickets=total_tickets,
        open_tickets=open_tickets,
        closed_tickets=closed_tickets
    )

@router.get("/", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    role_name: Optional[str] = None,
    support_level: Optional[str] = None,
    skill_group: Optional[str] = None,
    is_active: Optional[bool] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN"]))
):
    """Quản trị danh sách người dùng toàn hệ thống (Chỉ Admin)"""
    from sqlalchemy import or_
    query = select(User).options(selectinload(User.role))
    
    if role_name and role_name != "ALL":
        query = query.join(Role, User.role_id == Role.id).where(Role.role_name == role_name)
    if support_level and support_level != "ALL":
        query = query.where(User.support_level == support_level)
    if skill_group and skill_group != "ALL":
        query = query.where(User.skill_group == skill_group)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if department and department != "ALL":
        query = query.where(User.department.ilike(f"%{department}%"))
    if search:
        s = f"%{search.strip()}%"
        query = query.where(or_(User.full_name.ilike(s), User.email.ilike(s)))
        
    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "department": u.department,
            "phone_number": u.phone_number,
            "is_active": u.is_active,
            "role_name": u.role.role_name if u.role else None,
            "support_level": u.support_level,
            "skill_group": u.skill_group
        } for u in users
    ]

@router.post("/", response_model=UserResponse)
async def create_user(
    data: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN"]))
):
    """Tạo người dùng mới và phân quyền (Chỉ Admin)"""
    # Check if email exists
    exist_res = await db.execute(select(User).where(User.email == data.email))
    if exist_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{data.email}' đã tồn tại trong hệ thống."
        )

    # Find role
    role_res = await db.execute(select(Role).where(Role.role_name == data.role_name))
    role_obj = role_res.scalars().first()
    if not role_obj:
        # Fallback to REQUESTER
        role_res = await db.execute(select(Role).where(Role.role_name == "REQUESTER"))
        role_obj = role_res.scalars().first()

    if len(data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu phải có ít nhất 6 ký tự."
        )

    new_user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=get_password_hash(data.password),
        role_id=role_obj.id if role_obj else None,
        department=data.department or "Chung",
        phone_number=data.phone_number,
        is_active=data.is_active,
        support_level=data.support_level,
        skill_group=data.skill_group
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return {
        "id": new_user.id,
        "email": new_user.email,
        "full_name": new_user.full_name,
        "department": new_user.department,
        "phone_number": new_user.phone_number,
        "is_active": new_user.is_active,
        "role_name": role_obj.role_name if role_obj else "REQUESTER",
        "support_level": new_user.support_level,
        "skill_group": new_user.skill_group
    }

@router.put("/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: str,
    data: AdminUpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN"]))
):
    """Cập nhật thông tin tài khoản, role, cấp hỗ trợ L1/L2, kỹ năng và trạng thái (Chỉ Admin)"""
    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.id == user_id)
    )
    target_user = result.scalars().first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

    # Bảo vệ tài khoản Admin tổng không thể bị khóa hoặc hạ quyền
    if target_user.email == "admin@cskh.vn":
        if data.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Đây là tài khoản Quản trị viên tổng (Super Admin), không thể khóa tài khoản này!"
            )
        if data.role_name and data.role_name != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Đây là tài khoản Quản trị viên tổng (Super Admin), không thể hạ quyền!"
            )

    if data.email is not None and data.email.strip():
        new_email = data.email.strip().lower()
        if new_email != target_user.email:
            dup_res = await db.execute(select(User).where(User.email == new_email, User.id != user_id))
            if dup_res.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{new_email}' đã được sử dụng bởi tài khoản khác trong hệ thống."
                )
            target_user.email = new_email

    if data.full_name is not None:
        target_user.full_name = data.full_name
    if data.department is not None:
        target_user.department = data.department
    if data.phone_number is not None:
        target_user.phone_number = data.phone_number
    if data.is_active is not None:
        target_user.is_active = data.is_active
    if data.support_level is not None:
        target_user.support_level = data.support_level if data.support_level != "" else None
    if data.skill_group is not None:
        target_user.skill_group = data.skill_group if data.skill_group != "" else None

    if data.role_name:
        role_res = await db.execute(select(Role).where(Role.role_name == data.role_name))
        role_obj = role_res.scalars().first()
        if role_obj:
            target_user.role_id = role_obj.id

    pwd_to_set = data.new_password or data.password
    if pwd_to_set:
        if len(pwd_to_set) < 6:
            raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự.")
        target_user.hashed_password = get_password_hash(pwd_to_set)

    db.add(target_user)
    await db.commit()
    await db.refresh(target_user)

    # Re-fetch role
    r_res = await db.execute(select(Role).where(Role.id == target_user.role_id))
    r_obj = r_res.scalars().first()

    return {
        "id": target_user.id,
        "email": target_user.email,
        "full_name": target_user.full_name,
        "department": target_user.department,
        "phone_number": target_user.phone_number,
        "is_active": target_user.is_active,
        "role_name": r_obj.role_name if r_obj else None,
        "support_level": target_user.support_level,
        "skill_group": target_user.skill_group
    }

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN"]))
):
    """Delete a user (Admin only)"""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tự xóa tài khoản quản trị đang đăng nhập của chính mình."
        )

    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalars().first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

    if target_user.email == "admin@cskh.vn":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đây là tài khoản Quản trị viên tổng (Super Admin), không thể xóa tài khoản này!"
        )

    try:
        await db.delete(target_user)
        await db.commit()
        return {"message": "Đã xóa người dùng thành công."}
    except Exception:
        await db.rollback()
        target_user.is_active = False
        db.add(target_user)
        await db.commit()
        return {"message": "Người dùng đã có lịch sử dữ liệu trong hệ thống nên đã được chuyển sang trạng thái Tạm khóa để bảo toàn dữ liệu IT."}

@router.post("/seed-mock-agents")
async def seed_mock_agents_api(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ADMIN"]))
):
    """Seed 25 mock support agents (15 L1, 10 L2 across 5 skill groups) in dev/demo mode"""
    from scripts.seed_db import seed_support_agents
    created_count = await seed_support_agents(db)
    return {
        "success": True,
        "message": f"Hoàn tất nạp dữ liệu nhân viên hỗ trợ L1/L2. Đã tạo mới {created_count} tài khoản.",
        "created_count": created_count
    }
