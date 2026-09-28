from pydantic import BaseModel, EmailStr
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    department: str | None = None
    phone_number: str | None = None
    is_active: bool = True
    support_level: str | None = None
    skill_group: str | None = None

class UserCreate(UserBase):
    password: str
    role_id: str

class UserResponse(UserBase):
    id: str
    role_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
