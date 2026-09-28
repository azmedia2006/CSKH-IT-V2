from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.config import settings
from app.core.database import get_db
from app.core.redis import get_redis_client
from app.core.exceptions import UnauthorizedException
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False)

async def get_current_user_payload(
    token: str = Depends(oauth2_scheme),
    redis: Redis = Depends(get_redis_client)
) -> dict:
    try:
        # Check if token is blacklisted in Redis
        is_blacklisted = await redis.get(f"blacklist:{token}")
        if is_blacklisted:
            raise UnauthorizedException(detail="Token has been revoked/logged out")
            
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise UnauthorizedException(detail="Invalid token payload")
        return payload
    except (JWTError, ValidationError):
        raise UnauthorizedException(detail="Could not validate credentials")

async def get_current_user(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
) -> User:
    from sqlalchemy.future import select
    from sqlalchemy.orm import selectinload
    
    user_id = payload.get("sub")
    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.id == user_id)
    )
    user = result.scalars().first()
    if not user:
        raise UnauthorizedException(detail="User not found")
    if not user.is_active:
        raise UnauthorizedException(detail="Tài khoản đã bị tạm khóa")
    return user

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_user)):
        role_name = user.role.role_name if user.role else "REQUESTER"
        if role_name not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Thao tác này chỉ dành cho người dùng có quyền phù hợp."
            )
        return user


async def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client)
) -> User | None:
    if not token:
        return None
    try:
        if redis:
            is_blacklisted = await redis.get(f"blacklist:{token}")
            if is_blacklisted:
                return None
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if not user_id:
            return None
        from sqlalchemy.future import select
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(User).options(selectinload(User.role)).where(User.id == user_id)
        )
        user = result.scalars().first()
        if user and user.is_active:
            return user
        return None
    except Exception:
        return None


