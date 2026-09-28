import asyncio
from typing import Dict, List, Any

async def classify_ticket(description: str) -> Dict[str, Any]:
    """
    Mock AI function to classify a ticket based on its description.
    Returns suggested priority, category, and confidence score.
    """
    await asyncio.sleep(1) # Simulate network delay
    
    description_lower = description.lower()
    
    if "đăng nhập" in description_lower or "mật khẩu" in description_lower or "login" in description_lower:
        return {
            "priority": "P2",
            "category": "Tài khoản & Truy cập",
            "confidence_score": 0.95
        }
    elif "thanh toán" in description_lower or "tiền" in description_lower or "refund" in description_lower:
        return {
            "priority": "P1",
            "category": "Thanh toán & Hóa đơn",
            "confidence_score": 0.88
        }
    elif "chậm" in description_lower or "lỗi" in description_lower or "error" in description_lower:
        return {
            "priority": "P2",
            "category": "Lỗi kỹ thuật",
            "confidence_score": 0.75
        }
    else:
        return {
            "priority": "P3",
            "category": "Hỗ trợ chung",
            "confidence_score": 0.60
        }

async def suggest_reply(ticket_context: str) -> str:
    """
    Mock AI function to suggest a reply based on ticket description and history.
    """
    await asyncio.sleep(1.5)
    
    context_lower = ticket_context.lower()
    
    if "đăng nhập" in context_lower or "mật khẩu" in context_lower:
        return "Chào bạn,\n\nCảm ơn bạn đã liên hệ. Bạn vui lòng thử sử dụng tính năng 'Quên mật khẩu' trên trang chủ và kiểm tra email (bao gồm cả mục Spam) để nhận link đặt lại mật khẩu nhé.\n\nNếu vẫn không được, vui lòng cung cấp thêm thông tin để chúng tôi hỗ trợ.\n\nTrân trọng,"
    
    return "Chào bạn,\n\nCảm ơn bạn đã liên hệ bộ phận hỗ trợ. Chúng tôi đã tiếp nhận yêu cầu của bạn và đang tiến hành kiểm tra. Chúng tôi sẽ phản hồi lại bạn trong thời gian sớm nhất.\n\nTrân trọng,"

async def summarize_history(comments: List[str]) -> str:
    """
    Mock AI function to summarize ticket history.
    """
    await asyncio.sleep(1)
    
    if not comments:
        return "Chưa có lịch sử trao đổi nào để tóm tắt."
        
    return f"Tóm tắt ({len(comments)} tin nhắn):\n- Khách hàng báo lỗi, yêu cầu hỗ trợ.\n- CSKH đã tiếp nhận và đang xử lý.\n- Cần thêm thông tin từ bộ phận kỹ thuật để giải quyết dứt điểm."
