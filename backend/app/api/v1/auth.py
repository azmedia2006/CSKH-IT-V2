from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from redis.asyncio import Redis

from app.api.deps import get_db, oauth2_scheme, get_current_user_payload
from app.core.redis import get_redis_client
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import Token, LoginRequest, RegisterRequest, ForgotPasswordRequest, VerifyOtpRequest, ResetPasswordRequest
from app.config import settings
from app.services.email_service import send_otp_email, send_login_alert_email
import random

def mask_email(email: str) -> str:
    """Mask email for privacy protection (e.g., mp14122006pt@gmail.com -> mp***pt@gmail.com)"""
    if not email or "@" not in email:
        return email
    user, domain = email.split("@", 1)
    if len(user) <= 2:
        masked_user = user[0] + "***"
    elif len(user) <= 4:
        masked_user = user[0] + "***" + user[-1]
    else:
        masked_user = user[:2] + "***" + user[-2:]
    return f"{masked_user}@{domain}"

router = APIRouter()

@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == login_data.email.strip().lower()))
    user = result.scalars().first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Tài khoản đã bị tạm khóa")

    access_token = create_access_token(subject=user.id)

    # Lấy thông tin IP và Thiết bị đăng nhập
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "127.0.0.1"

    user_agent = request.headers.get("user-agent", "Trình duyệt web")

    # Gửi email cảnh báo đăng nhập ngầm trong Background Task (không làm chậm tốc độ phản hồi API)
    background_tasks.add_task(
        send_login_alert_email,
        to_email=user.email,
        user_name=user.full_name,
        ip_address=client_ip,
        user_agent=user_agent
    )

    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=Token)
async def register(
    register_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    from app.models.role import Role
    from app.core.security import get_password_hash
    
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == register_data.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã được sử dụng trong hệ thống."
        )

    # Get REQUESTER role
    role_res = await db.execute(select(Role).where(Role.role_name == "REQUESTER"))
    requester_role = role_res.scalars().first()

    new_user = User(
        email=register_data.email,
        hashed_password=get_password_hash(register_data.password),
        full_name=register_data.full_name or register_data.email.split('@')[0],
        role_id=requester_role.id if requester_role else None,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(subject=new_user.id)
    return {"access_token": access_token, "token_type": "bearer"}

# In-memory OTP storage fallback with timestamp (email -> (otp, expire_timestamp))
_memory_otp_store: dict[str, tuple[str, float]] = {}

@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client)
):
    import time
    import logging
    logger = logging.getLogger(__name__)
    
    # 1. Kiểm tra tài khoản có tồn tại trong hệ thống hay không
    result = await db.execute(select(User).where(User.email == data.email.strip().lower()))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Email '{data.email}' chưa được đăng ký trong hệ thống."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Tài khoản này đã bị tạm khóa. Vui lòng liên hệ quản trị viên."
        )

    # 2. Sinh mã OTP 6 chữ số
    otp = f"{random.randint(100000, 999999)}"
    
    # Lưu vào Redis (TTL 900 giây = 15 phút)
    if redis:
        try:
            await redis.setex(f"pwd_otp:{user.email}", 900, otp)
        except Exception:
            pass
    
    # Lưu vào in-memory store phòng khi không bật Redis
    _memory_otp_store[user.email] = (otp, time.time() + 900)

    # 3. Gửi email OTP thực tế qua SMTP
    email_sent = await send_otp_email(
        to_email=user.email,
        otp_code=otp,
        user_name=user.full_name
    )

    masked_email_str = mask_email(user.email)

    if not email_sent:
        logger.warning(f"[SECURITY/DEV] Email dispatch failed. Generated OTP for {user.email}: {otp}")
        return {
            "message": f"Mã xác thực OTP đã được tạo cho tài khoản {masked_email_str}. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam/Rác).",
            "masked_email": masked_email_str,
            "email_sent": False
        }

    return {
        "message": f"Mã xác thực OTP đã được gửi đến email {masked_email_str}. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam/Rác).",
        "masked_email": masked_email_str,
        "email_sent": True
    }

@router.post("/verify-otp")
async def verify_otp(
    data: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client)
):
    import time
    from datetime import datetime, timedelta, timezone
    from jose import jwt

    if not data.otp or not data.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập mã xác nhận OTP 6 chữ số."
        )

    email_clean = data.email.strip().lower()
    otp_input = data.otp.strip()

    # Kiểm tra tài khoản
    result = await db.execute(select(User).where(User.email == email_clean))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản người dùng tương ứng."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản này đã bị tạm khóa. Vui lòng liên hệ quản trị viên."
        )

    # Xác thực OTP qua Redis hoặc In-memory Store
    valid_otp = None
    if redis:
        try:
            valid_otp = await redis.get(f"pwd_otp:{email_clean}")
            if isinstance(valid_otp, bytes):
                valid_otp = valid_otp.decode()
        except Exception:
            pass

    if not valid_otp and email_clean in _memory_otp_store:
        cached_code, expires_at = _memory_otp_store[email_clean]
        if time.time() <= expires_at:
            valid_otp = cached_code
        else:
            _memory_otp_store.pop(email_clean, None)

    if not valid_otp or valid_otp != otp_input:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác nhận OTP không chính xác hoặc đã hết hạn (15 phút)."
        )

    # Invalidate OTP immediately to prevent replay attack
    if redis:
        try:
            await redis.delete(f"pwd_otp:{email_clean}")
        except Exception:
            pass
    _memory_otp_store.pop(email_clean, None)

    # Issue a secure, short-lived reset token (valid for 10 minutes)
    reset_payload = {
        "sub": str(user.id),
        "email": user.email,
        "type": "password_reset",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    reset_token = jwt.encode(reset_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    return {
        "valid": True,
        "message": "Xác thực mã OTP thành công. Vui lòng tạo mật khẩu mới.",
        "reset_token": reset_token,
        "masked_email": mask_email(user.email)
    }

@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client)
):
    import time
    from jose import jwt, JWTError
    from app.core.security import get_password_hash

    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới phải có ít nhất 6 ký tự."
        )

    user = None

    # Method 1: Secure reset_token verification (Preferred & Encrypted)
    if data.reset_token:
        try:
            payload = jwt.decode(data.reset_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("type") != "password_reset":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mã xác thực đặt lại mật khẩu không hợp lệ.")
            user_id = payload.get("sub")
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản người dùng.")
        except JWTError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mã xác thực đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.")

    # Method 2: Fallback to direct OTP verification for backward compatibility
    elif data.otp and data.email:
        email_clean = data.email.strip().lower()
        otp_input = data.otp.strip()

        result = await db.execute(select(User).where(User.email == email_clean))
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản người dùng tương ứng.")

        valid_otp = None
        if redis:
            try:
                valid_otp = await redis.get(f"pwd_otp:{email_clean}")
                if isinstance(valid_otp, bytes):
                    valid_otp = valid_otp.decode()
            except Exception:
                pass

        if not valid_otp and email_clean in _memory_otp_store:
            cached_code, expires_at = _memory_otp_store[email_clean]
            if time.time() <= expires_at:
                valid_otp = cached_code
            else:
                _memory_otp_store.pop(email_clean, None)

        if not valid_otp or valid_otp != otp_input:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã xác nhận OTP không chính xác hoặc đã hết hạn (15 phút)."
            )

        if redis:
            try:
                await redis.delete(f"pwd_otp:{email_clean}")
            except Exception:
                pass
        _memory_otp_store.pop(email_clean, None)

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thiếu thông tin xác thực đặt lại mật khẩu."
        )

    # Đổi mật khẩu mới
    user.hashed_password = get_password_hash(data.new_password)
    db.add(user)
    await db.commit()

    return {"message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới."}

@router.post("/logout")
async def logout(
    token: str = Depends(oauth2_scheme),
    payload: dict = Depends(get_current_user_payload),
    redis: Redis = Depends(get_redis_client)
):
    # Get token expiration to set TTL in Redis
    exp = payload.get("exp")
    if exp:
        import time
        ttl = max(0, int(exp - time.time()))
        if ttl > 0 and redis:
            try:
                await redis.setex(f"blacklist:{token}", ttl, "true")
            except Exception:
                pass
    
    return {"message": "Logged out successfully"}


# --- GOOGLE OAUTH ENDPOINTS ---
import httpx
import json
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from app.models.role import Role
from app.core.security import get_password_hash
import secrets

GOOGLE_SETTINGS_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "google_settings.json"

def get_google_auth_config() -> dict:
    if GOOGLE_SETTINGS_FILE.exists():
        try:
            with open(GOOGLE_SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "enabled": False,
        "client_id": "",
        "client_secret": "",
        "redirect_uri": ""
    }

class GoogleLoginPayload(BaseModel):
    credential: Optional[str] = None
    access_token: Optional[str] = None
    is_register: Optional[bool] = False

@router.get("/google-config")
async def get_google_public_config():
    """Lấy cấu hình công khai Google OAuth cho client"""
    cfg = get_google_auth_config()
    return {
        "enabled": bool(cfg.get("enabled", False) and cfg.get("client_id")),
        "client_id": cfg.get("client_id", ""),
        "redirect_uri": cfg.get("redirect_uri", "")
    }

@router.post("/google", response_model=Token)
async def login_with_google(
    payload: GoogleLoginPayload,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Xác thực người dùng từ Google Token, tự động tạo tài khoản nếu chưa tồn tại"""
    cfg = get_google_auth_config()
    if not cfg.get("enabled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đăng nhập Google hiện chưa được kích hoạt bởi Quản trị viên."
        )

    email = None
    full_name = None

    if payload.credential:
        # Verify Google ID Token via Google's tokeninfo API
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": payload.credential}
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Xác thực Google ID Token không thành công."
                )
            info = resp.json()
            # Verify aud if client_id is configured
            if cfg.get("client_id") and info.get("aud") != cfg.get("client_id"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google Client ID không khớp với hệ thống."
                )
            email = info.get("email")
            full_name = info.get("name") or email

    elif payload.access_token:
        # Verify Google Access Token via userinfo endpoint
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {payload.access_token}"}
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Xác thực Google Access Token không thành công."
                )
            info = resp.json()
            email = info.get("email")
            full_name = info.get("name") or email

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng cung cấp Google credential hoặc access_token."
        )

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể lấy địa chỉ email từ tài khoản Google."
        )

    email_clean = email.strip().lower()

    # Tìm user trong CSDL
    result = await db.execute(select(User).where(User.email == email_clean))
    user = result.scalars().first()

    # Nếu chưa có tài khoản
    if not user:
        if not payload.is_register:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tài khoản Google này chưa được đăng ký trong hệ thống. Vui lòng chuyển sang trang Đăng ký để tạo tài khoản mới."
            )
        # Nếu đang ở luồng Đăng ký (is_register=True), tạo mới với role REQUESTER
        role_res = await db.execute(select(Role).where(Role.role_name == "REQUESTER"))
        role = role_res.scalars().first()
        if not role:
            role = Role(role_name="REQUESTER", description="Default End User")
            db.add(role)
            await db.commit()
            await db.refresh(role)

        random_pw = secrets.token_urlsafe(16)
        user = User(
            email=email_clean,
            hashed_password=get_password_hash(random_pw),
            full_name=full_name or "Người dùng Google",
            role_id=role.id,
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Tài khoản đã bị tạm khóa.")

    access_token = create_access_token(subject=user.id)

    # Gửi email cảnh báo đăng nhập ngầm
    forwarded_for = request.headers.get("x-forwarded-for")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "127.0.0.1")
    user_agent = request.headers.get("user-agent", "Google OAuth Login")

    background_tasks.add_task(
        send_login_alert_email,
        to_email=user.email,
        user_name=user.full_name,
        ip_address=client_ip,
        user_agent=f"{user_agent} (Google OAuth)"
    )

    return {"access_token": access_token, "token_type": "bearer"}
