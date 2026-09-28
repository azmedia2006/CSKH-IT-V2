from app.ai.gemini_client import gemini_client
from app.ai.pii_masker import PIIMasker
from app.ai.fallback import with_fallback
from app.schemas.ai import SummaryResult
from app.ai.key_manager import gemini_key_manager

SUMMARY_PROMPT = """
You are an AI assistant helping to summarize a long IT Support Ticket conversation.
Read the conversation history and summarize it in Vietnamese into 3 strict bullet points:
1. Core Issue: What is the primary problem?
2. Progress: What troubleshooting steps have been taken so far?
3. Next Actions: What is pending or needs to be done next?

Conversation History:
{history}
"""

from app.ai.unified_client import execute_ai_content

async def _run_summarizer(history: str) -> SummaryResult:
    prompt = SUMMARY_PROMPT.format(history=history)
    return await execute_ai_content(
        prompt=prompt,
        response_model=SummaryResult,
        temperature=0.1
    )

async def ai_summarize_ticket(history: str) -> SummaryResult:
    config = gemini_key_manager.get_config()
    if config.get("mask_pii", True):
        masked_history = PIIMasker.mask_text(history)
    else:
        masked_history = history
    
    timeout_sec = max(config.get("timeout_seconds", 20), 15)
    
    fallback_val = SummaryResult(
        core_issue="Chưa xác định được vấn đề cốt lõi do lỗi AI xử lý.",
        progress="Chưa ghi nhận tiến trình cụ thể.",
        next_actions="Vui lòng đọc lại lịch sử trao đổi của ticket."
    )
    
    result = await with_fallback(
        func=lambda: _run_summarizer(masked_history),
        fallback_value=fallback_val,
        timeout_seconds=timeout_sec
    )
    return result
