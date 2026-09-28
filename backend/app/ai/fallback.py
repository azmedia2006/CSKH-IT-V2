import asyncio
import logging
from typing import Callable, Any
from app.schemas.ai import TriageResult
from app.config import settings

logger = logging.getLogger(__name__)

async def with_fallback(
    func: Callable, 
    fallback_value: Any, 
    timeout_seconds: int = settings.AI_TIMEOUT_SECONDS
) -> Any:
    """
    Executes an async function with a timeout. 
    If it times out or throws an error (e.g. AI offline), returns the fallback_value.
    """
    try:
        return await asyncio.wait_for(func(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        logger.error(f"AI Task timed out after {timeout_seconds}s. Using fallback.")
        return fallback_value
    except Exception as e:
        logger.error(f"AI Task failed: {str(e)}. Using fallback.")
        return fallback_value

def get_triage_fallback() -> TriageResult:
    return TriageResult(
        category_code=settings.AI_FALLBACK_CATEGORY,
        priority=settings.AI_FALLBACK_PRIORITY,
        confidence_score=0.0,
        sentiment="NEUTRAL",
        risk_level="LOW",
        likely_exceeds_l1=False,
        rationale="Hệ thống AI đang tạm thời gián đoạn hoặc ngoại tuyến; áp dụng giá trị mặc định để nhân viên xử lý thủ công.",
        missing_information="Chưa có dữ liệu phân tích từ AI."
    )
