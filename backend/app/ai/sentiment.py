from app.ai.pii_masker import PIIMasker
from app.ai.fallback import with_fallback
from app.schemas.ai import SentimentResult
from app.ai.key_manager import gemini_key_manager
from app.ai.unified_client import execute_ai_content

SENTIMENT_PROMPT = """
You are an IT Service Desk AI Customer Sentiment and Urgency Analysis module.
Analyze the following PUBLIC message sent by a customer/requester to the support desk.
Identify whether the sentiment is NEGATIVE, NEUTRAL, or POSITIVE, along with your confidence score (0.0 to 1.0).

Guidelines:
1. NEGATIVE Sentiment includes:
   - High frustration, anger, exasperation, complaints about slow resolution or repeated downtime.
   - Expressions like "rất thất vọng", "quá lâu rồi", "tại sao chưa sửa", "ảnh hưởng nghiêm trọng đến công việc", "sắp bị sếp mắng", "làm ăn tắc trách", "báo cáo giám đốc", "urgently need this now", etc.
   - Escalation demands, threats of cancellation or legal/management escalation.
2. NEUTRAL Sentiment includes:
   - Factual bug reports, polite status inquiries ("Cho mình hỏi tiến độ...", "Gửi thêm ảnh chụp màn hình", "Cảm ơn em").
   - Routine technical questions.
3. POSITIVE Sentiment includes:
   - Appreciation, praise, satisfaction with service.

Customer Message:
{text}

Return valid JSON conforming to:
- sentiment: "NEGATIVE" | "NEUTRAL" | "POSITIVE"
- confidence_score: float (0.0 to 1.0)
- reason: brief explanation in Vietnamese (1-2 sentences) of why this sentiment was chosen
- evidence: direct quote/keywords from the text that indicate this sentiment
- needs_attention: boolean (true if negative or high risk)
"""

def get_sentiment_fallback() -> SentimentResult:
    return SentimentResult(
        sentiment="NEUTRAL",
        confidence_score=0.5,
        reason="Hệ thống AI không phản hồi kịp thời, áp dụng trạng thái trung tính mặc định.",
        evidence="",
        needs_attention=False
    )

async def _run_sentiment(text: str) -> SentimentResult:
    prompt = SENTIMENT_PROMPT.format(text=text)
    return await execute_ai_content(
        prompt=prompt,
        response_model=SentimentResult,
        temperature=0.0
    )

async def analyze_sentiment(text: str) -> SentimentResult:
    """
    Analyzes sentiment of requester's public text (ticket initial description or public comment).
    Automatically masks PII before sending to AI.
    """
    if not text or not text.strip():
        return get_sentiment_fallback()

    config = gemini_key_manager.get_config()

    if config.get("mask_pii", True):
        masked_text = PIIMasker.mask_text(text)
    else:
        masked_text = text

    timeout_sec = min(float(config.get("timeout_seconds", 15)), 6.0)

    result = await with_fallback(
        func=lambda: _run_sentiment(masked_text),
        fallback_value=get_sentiment_fallback(),
        timeout_seconds=timeout_sec
    )
    return result
