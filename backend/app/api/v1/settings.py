import time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api.deps import get_db, get_current_user, RoleChecker
from app.models.user import User
from app.models.category import Category
from app.models.sla_policy import SLAPolicy
from app.ai.key_manager import gemini_key_manager
from app.ai.gemini_client import gemini_client
from app.ai.groq_client import groq_client
from app.ai.cohere_client import cohere_client

router = APIRouter(dependencies=[Depends(RoleChecker(["ADMIN"]))])

# --- Request & Response Schemas ---

class KeyAddRequest(BaseModel):
    key: str = Field(..., description="API Key")
    name: Optional[str] = Field(None, description="Tên nhãn gợi nhớ cho Key")

class BatchKeysAddRequest(BaseModel):
    raw_keys: str = Field(..., description="Danh sách key cách nhau bởi dấu phẩy hoặc xuống dòng")

class KeyUpdateRequest(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None

class TestRawKeyRequest(BaseModel):
    key: str
    provider: Optional[str] = "google"
    model_name: Optional[str] = None

class PromptTestRequest(BaseModel):
    prompt: str = Field(..., description="Nội dung prompt thử nghiệm")
    system_instruction: Optional[str] = None
    temperature: Optional[float] = 0.2

class AISettingsUpdateRequest(BaseModel):
    provider: Optional[str] = None
    model_name: Optional[str] = None
    groq_model_name: Optional[str] = None
    cohere_model_name: Optional[str] = None
    groq_model_name: Optional[str] = None
    rotation_strategy: Optional[str] = None
    cooldown_seconds: Optional[int] = None
    timeout_seconds: Optional[int] = None
    confidence_threshold: Optional[float] = None
    auto_triage: Optional[bool] = None
    mask_pii: Optional[bool] = None
    sla_p1_response: Optional[int] = None
    sla_p1_resolve: Optional[int] = None
    email_alerts: Optional[bool] = None

# --- Endpoints ---

@router.get("/ai")
async def get_ai_settings(
    current_user: User = Depends(get_current_user)
):
    """Lấy toàn bộ cấu hình AI và danh sách Key Pool (Google Gemini & Groq)"""
    return gemini_key_manager.get_config()

@router.put("/ai")
async def update_ai_settings(
    request: AISettingsUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Cập nhật các thông số cài đặt AI & chuyển đổi Provider/Model"""
    updates = request.model_dump(exclude_unset=True)
    return gemini_key_manager.update_config(updates)

# --- GEMINI KEY ENDPOINTS ---

@router.post("/ai/keys")
async def add_gemini_key(
    request: KeyAddRequest,
    current_user: User = Depends(get_current_user)
):
    """Thêm một Gemini API Key mới vào Pool"""
    try:
        return gemini_key_manager.add_key(key_str=request.key, name=request.name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/ai/keys/batch")
async def add_batch_gemini_keys(
    request: BatchKeysAddRequest,
    current_user: User = Depends(get_current_user)
):
    """Thêm danh sách nhiều Gemini API Key cùng lúc"""
    return gemini_key_manager.add_batch_keys(raw_text=request.raw_keys)

@router.put("/ai/keys/{key_id}")
async def update_gemini_key(
    key_id: str,
    request: KeyUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Cập nhật trạng thái hoặc tên của Gemini Key"""
    updates = request.model_dump(exclude_unset=True)
    return gemini_key_manager.update_key(key_id=key_id, updates=updates)

@router.delete("/ai/keys/{key_id}")
async def delete_gemini_key(
    key_id: str,
    current_user: User = Depends(get_current_user)
):
    """Xóa một Gemini Key khỏi Pool"""
    return gemini_key_manager.delete_key(key_id=key_id)

@router.post("/ai/keys/reset-status")
async def reset_keys_status(
    current_user: User = Depends(get_current_user)
):
    """Mở khóa lại tất cả các Gemini Key đang bị tạm dừng / rate limited"""
    return gemini_key_manager.reset_all_statuses()

@router.post("/ai/keys/{key_id}/test")
async def test_existing_gemini_key(
    key_id: str,
    current_user: User = Depends(get_current_user)
):
    """Kiểm tra trực tiếp độ trễ và tính khả dụng của một Gemini key có trong pool"""
    raw_key = gemini_key_manager.get_raw_key_by_id(key_id)
    if not raw_key:
        raise HTTPException(status_code=404, detail="Không tìm thấy Key với ID đã cho")

    config = gemini_key_manager.get_config()
    model_name = config.get("model_name", "gemini-flash-latest")
    result = await gemini_client.test_key(api_key=raw_key, model_name=model_name)
    
    if result["success"]:
        gemini_key_manager.mark_key_success(key_id)
    elif result.get("error_type") == "RATE_LIMIT":
        gemini_key_manager.mark_key_rate_limited(key_id, result["message"])
    elif result.get("error_type") in ["API_ERROR", "INVALID_KEY"]:
        gemini_key_manager.mark_key_invalid(key_id, result["message"])

    return result

@router.post("/ai/test-key")
async def test_unsaved_key(
    request: TestRawKeyRequest,
    current_user: User = Depends(get_current_user)
):
    """Kiểm tra tính hợp lệ của một Gemini key thô trước khi lưu"""
    if not request.key or not request.key.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập API Key để kiểm tra")
    
    result = await gemini_client.test_key(
        api_key=request.key.strip(),
        model_name=request.model_name or "gemini-flash-latest"
    )
    return result

# --- GROQ KEY ENDPOINTS ---

@router.post("/ai/groq/keys")
async def add_groq_key(
    request: KeyAddRequest,
    current_user: User = Depends(get_current_user)
):
    """Thêm một Groq API Key mới vào Pool"""
    try:
        return gemini_key_manager.add_groq_key(key_str=request.key, name=request.name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/ai/groq/keys/batch")
async def add_batch_groq_keys(
    request: BatchKeysAddRequest,
    current_user: User = Depends(get_current_user)
):
    """Thêm danh sách nhiều Groq API Key cùng lúc"""
    return gemini_key_manager.add_batch_groq_keys(raw_text=request.raw_keys)

@router.put("/ai/groq/keys/{key_id}")
async def update_groq_key(
    key_id: str,
    request: KeyUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Cập nhật trạng thái hoặc tên của Groq Key"""
    updates = request.model_dump(exclude_unset=True)
    return gemini_key_manager.update_groq_key(key_id=key_id, updates=updates)

@router.delete("/ai/groq/keys/{key_id}")
async def delete_groq_key(
    key_id: str,
    current_user: User = Depends(get_current_user)
):
    """Xóa một Groq Key khỏi Pool"""
    return gemini_key_manager.delete_groq_key(key_id=key_id)

@router.post("/ai/groq/keys/reset-status")
async def reset_groq_keys_status(
    current_user: User = Depends(get_current_user)
):
    """Mở khóa lại tất cả các Groq Key đang bị rate limited"""
    return gemini_key_manager.reset_groq_statuses()

@router.post("/ai/groq/keys/{key_id}/test")
async def test_existing_groq_key(
    key_id: str,
    current_user: User = Depends(get_current_user)
):
    """Kiểm tra trực tiếp độ trễ và tính khả dụng của một Groq key có trong pool"""
    raw_key = gemini_key_manager.get_raw_groq_key_by_id(key_id)
    if not raw_key:
        raise HTTPException(status_code=404, detail="Không tìm thấy Groq Key với ID đã cho")

    config = gemini_key_manager.get_config()
    model_name = config.get("groq_model_name", "llama-3.3-70b-versatile")
    result = await groq_client.test_key(api_key=raw_key, model_name=model_name)
    
    if result["success"]:
        gemini_key_manager.mark_groq_key_success(key_id)
    elif result.get("error_type") == "RATE_LIMIT":
        gemini_key_manager.mark_groq_key_rate_limited(key_id, result["message"])
    elif result.get("error_type") in ["API_ERROR", "INVALID_KEY"]:
        gemini_key_manager.mark_groq_key_invalid(key_id, result["message"])

    return result

@router.post("/ai/groq/test-key")
async def test_unsaved_groq_key(
    request: TestRawKeyRequest,
    current_user: User = Depends(get_current_user)
):
    """Kiểm tra tính hợp lệ của một Groq key thô trước khi lưu"""
    if not request.key or not request.key.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập Groq API Key để kiểm tra")
    
    result = await groq_client.test_key(
        api_key=request.key.strip(),
        model_name=request.model_name or "openai/gpt-oss-120b"
    )
    return result

# --- COHERE KEY MANAGEMENT ---

@router.post("/ai/cohere/keys")
async def add_cohere_key(
    request: KeyAddRequest,
    current_user: User = Depends(get_current_user)
):
    """Thêm một Cohere API Key mới vào Key Pool"""
    try:
        return gemini_key_manager.add_cohere_key(key_str=request.key, name=request.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ai/cohere/keys/batch")
async def add_batch_cohere_keys(
    request: BatchKeysAddRequest,
    current_user: User = Depends(get_current_user)
):
    """Thêm hàng loạt Cohere API Keys vào Pool"""
    lines = [k.strip() for k in request.raw_keys.replace(",", "\n").split("\n") if k.strip()]
    if not lines:
        raise HTTPException(status_code=400, detail="Không tìm thấy Key hợp lệ để thêm")
    return gemini_key_manager.add_batch_cohere_keys(lines)

@router.put("/ai/cohere/keys/{key_id}")
async def update_cohere_key(
    key_id: str,
    request: KeyUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Cập nhật trạng thái hoặc tên của Cohere Key"""
    updates = request.model_dump(exclude_unset=True)
    return gemini_key_manager.update_cohere_key(key_id=key_id, updates=updates)

@router.delete("/ai/cohere/keys/{key_id}")
async def delete_cohere_key(
    key_id: str,
    current_user: User = Depends(get_current_user)
):
    """Xóa một Cohere Key khỏi Pool"""
    return gemini_key_manager.delete_cohere_key(key_id=key_id)

@router.post("/ai/cohere/keys/reset-status")
async def reset_cohere_keys_status(
    current_user: User = Depends(get_current_user)
):
    """Mở khóa lại tất cả các Cohere Key đang bị rate limited"""
    return gemini_key_manager.reset_cohere_statuses()

@router.post("/ai/cohere/keys/{key_id}/test")
async def test_existing_cohere_key(
    key_id: str,
    current_user: User = Depends(get_current_user)
):
    """Kiểm tra trực tiếp độ trễ và tính khả dụng của một Cohere key có trong pool"""
    raw_key = gemini_key_manager.get_raw_cohere_key_by_id(key_id)
    if not raw_key:
        raise HTTPException(status_code=404, detail="Không tìm thấy Cohere Key với ID đã cho")

    config = gemini_key_manager.get_config()
    model_name = config.get("cohere_model_name", "command-r-plus")
    result = await cohere_client.test_key(api_key=raw_key, model_name=model_name)
    
    if result["success"]:
        gemini_key_manager.mark_cohere_key_success(key_id)
    elif result.get("error_type") == "RATE_LIMIT":
        gemini_key_manager.mark_cohere_key_rate_limited(key_id, result["message"])
    elif result.get("error_type") in ["API_ERROR", "INVALID_KEY"]:
        gemini_key_manager.mark_cohere_key_invalid(key_id, result["message"])

    return result

@router.post("/ai/cohere/test-key")
async def test_unsaved_cohere_key(
    request: TestRawKeyRequest,
    current_user: User = Depends(get_current_user)
):
    """Kiểm tra tính hợp lệ của một Cohere key thô trước khi lưu"""
    if not request.key or not request.key.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập Cohere API Key để kiểm tra")
    
    result = await cohere_client.test_key(
        api_key=request.key.strip(),
        model_name=request.model_name or "command-r-plus"
    )
    return result

# --- LOGS & PLAYGROUND ---

@router.get("/ai/rotation-logs")
async def get_rotation_logs(
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách nhật ký luân chuyển key gần đây"""
    return gemini_key_manager.get_rotation_logs()

@router.post("/ai/prompt-test")
async def test_prompt_playground(
    request: PromptTestRequest,
    current_user: User = Depends(get_current_user)
):
    """Admin AI Playground: Gửi prompt thử nghiệm và xem kết quả từ Provider & Model đang kích hoạt"""
    from app.ai.unified_client import execute_ai_content
    config = gemini_key_manager.get_config()
    provider = config.get("provider", "auto")
    
    start_time = time.time()
    try:
        reply_text = await execute_ai_content(
            prompt=request.prompt,
            system_instruction=request.system_instruction,
            temperature=request.temperature or 0.2
        )
        latency_ms = round((time.time() - start_time) * 1000, 1)
        return {
            "success": True,
            "provider": provider,
            "model": config.get("groq_model_name" if provider == "groq" else "model_name"),
            "latency_ms": latency_ms,
            "response": reply_text,
            "stats": config.get("stats")
        }
    except Exception as e:
        latency_ms = round((time.time() - start_time) * 1000, 1)
        return {
            "success": False,
            "provider": provider,
            "model": config.get("groq_model_name" if provider == "groq" else "model_name"),
            "latency_ms": latency_ms,
            "error": str(e),
            "stats": config.get("stats")
        }

# --- GOOGLE OAUTH SETTINGS ---
import json
from pathlib import Path

GOOGLE_SETTINGS_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "google_settings.json"

class GoogleAuthSettingsRequest(BaseModel):
    enabled: Optional[bool] = False
    client_id: Optional[str] = ""
    client_secret: Optional[str] = ""
    redirect_uri: Optional[str] = ""

def load_google_settings() -> dict:
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

def save_google_settings(data: dict):
    GOOGLE_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(GOOGLE_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@router.get("/google")
async def get_google_auth_settings(
    current_user: User = Depends(get_current_user)
):
    """Lấy toàn bộ cấu hình Google OAuth (che client_secret)"""
    data = load_google_settings()
    masked = dict(data)
    if masked.get("client_secret"):
        masked["client_secret"] = "******"
    return masked

@router.put("/google")
async def update_google_auth_settings(
    request: GoogleAuthSettingsRequest,
    current_user: User = Depends(get_current_user)
):
    """Cập nhật cấu hình Google OAuth"""
    current = load_google_settings()
    updates = request.model_dump(exclude_unset=True)
    if "client_secret" in updates:
        if not updates["client_secret"] or updates["client_secret"] == "******":
            updates.pop("client_secret", None)
    current.update(updates)
    save_google_settings(current)
    masked = dict(current)
    if masked.get("client_secret"):
        masked["client_secret"] = "******"
    return masked


# --- CATEGORIES MANAGEMENT ---

class CategoryCreateRequest(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None


@router.get("/categories")
async def list_settings_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Danh sách danh mục sự cố hỗ trợ (Quản trị viên)"""
    res = await db.execute(select(Category).order_by(Category.created_at.asc()))
    cats = res.scalars().all()
    return [{"id": c.id, "name": c.name, "code": c.code, "description": c.description} for c in cats]


@router.post("/categories")
async def create_settings_category(
    request: CategoryCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Thêm danh mục mới (Chỉ Admin)"""
    code_clean = request.code.strip().upper()
    existing = await db.execute(select(Category).where(Category.code == code_clean))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail=f"Mã danh mục '{code_clean}' đã tồn tại.")
    new_cat = Category(
        name=request.name.strip(),
        code=code_clean,
        description=request.description.strip() if request.description else None
    )
    db.add(new_cat)
    await db.commit()
    await db.refresh(new_cat)
    return {"id": new_cat.id, "name": new_cat.name, "code": new_cat.code, "description": new_cat.description}


@router.put("/categories/{cat_id}")
async def update_settings_category(
    cat_id: str,
    request: CategoryUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chỉnh sửa thông tin danh mục (Chỉ Admin)"""
    res = await db.execute(select(Category).where(Category.id == cat_id))
    cat = res.scalars().first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục.")
    if request.name is not None:
        cat.name = request.name.strip()
    if request.description is not None:
        cat.description = request.description.strip()
    if request.code is not None:
        code_clean = request.code.strip().upper()
        if code_clean != cat.code:
            existing = await db.execute(select(Category).where(Category.code == code_clean, Category.id != cat_id))
            if existing.scalars().first():
                raise HTTPException(status_code=400, detail=f"Mã danh mục '{code_clean}' đã tồn tại.")
            cat.code = code_clean
    await db.commit()
    await db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "code": cat.code, "description": cat.description}


@router.delete("/categories/{cat_id}")
async def delete_settings_category(
    cat_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa danh mục (Chỉ Admin)"""
    res = await db.execute(select(Category).where(Category.id == cat_id))
    cat = res.scalars().first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục.")
    await db.delete(cat)
    await db.commit()
    return {"success": True, "message": "Đã xóa danh mục."}


# --- SLA POLICIES MANAGEMENT ---

class SLAPolicyItem(BaseModel):
    priority_level: str
    response_time_minutes: int
    resolve_time_minutes: int
    description: Optional[str] = None


class SLAPoliciesBatchUpdate(BaseModel):
    policies: List[SLAPolicyItem]


@router.get("/sla-policies")
async def get_sla_policies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách thiết lập SLA chuẩn cho P1, P2, P3, P4 từ Database"""
    res = await db.execute(select(SLAPolicy))
    policies = res.scalars().all()
    order = {"P1": 1, "P2": 2, "P3": 3, "P4": 4, "CRITICAL_P1": 1, "HIGH_P2": 2, "MEDIUM_P3": 3, "LOW_P4": 4}
    sorted_policies = sorted(policies, key=lambda p: order.get(p.priority_level, 99))
    return [
        {
            "id": p.id,
            "priority_level": p.priority_level,
            "response_time_minutes": p.response_time_minutes,
            "resolve_time_minutes": p.resolve_time_minutes,
            "description": p.description
        }
        for p in sorted_policies
    ]


@router.put("/sla-policies")
async def update_sla_policies(
    data: SLAPoliciesBatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật thời hạn SLA phản hồi và giải quyết cho P1, P2, P3, P4 vào Database"""
    for item in data.policies:
        res = await db.execute(select(SLAPolicy).where(SLAPolicy.priority_level == item.priority_level))
        policy = res.scalars().first()
        if policy:
            policy.response_time_minutes = item.response_time_minutes
            policy.resolve_time_minutes = item.resolve_time_minutes
            if item.description is not None:
                policy.description = item.description
        else:
            db.add(SLAPolicy(
                priority_level=item.priority_level,
                response_time_minutes=item.response_time_minutes,
                resolve_time_minutes=item.resolve_time_minutes,
                description=item.description
            ))
    await db.commit()
    return {"success": True, "message": "Đã cập nhật tiêu chuẩn SLA cho P1, P2, P3, P4 thành công."}

