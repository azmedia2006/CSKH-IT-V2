from app.ai.gemini_client import gemini_client
from app.ai.pii_masker import PIIMasker
from app.ai.fallback import with_fallback, get_triage_fallback
from app.schemas.ai import TriageResult
from app.ai.key_manager import gemini_key_manager

TRIAGE_PROMPT = """
Bạn là hệ thống AI Triage của IT Service Desk.
Hãy phân tích nội dung ticket hỗ trợ kỹ thuật và phân loại chính xác Danh mục, Mức ưu tiên P1-P4, cùng các đánh giá chuyên sâu.

Danh mục hợp lệ (Categories allowed):
- DEVICE (máy in, máy scan, thiết bị văn phòng, kẹt giấy, hỏng phần cứng)
- ACCOUNT_AUTH (đăng nhập, mật khẩu, xác thực 2FA/OTP, khóa tài khoản)
- SOFTWARE_BUG (lỗi phần mềm, ứng dụng crash, lỗi tính toán, treo ứng dụng, xuất báo cáo)
- NETWORK_INFRA (WiFi, LAN, mạng internet, VPN, DNS, kết nối máy chủ)
- ACCESS_RESOURCE (cấp quyền, truy cập thư mục, SharePoint, Drive, tài nguyên nội bộ)
- TECH_GUIDE (hướng dẫn kỹ thuật, cài đặt phần mềm, tài liệu sử dụng)
- UNCATEGORIZED (không có chi tiết kỹ thuật hoặc quá mập mờ)

Mức ưu tiên (Priorities):
- P1 (Khẩn cấp): Sập hệ thống diện rộng toàn công ty, tài khoản VIP bị khóa khẩn.
- P2 (Cao): Lỗi phòng ban, nhiều người dùng bị chặn công việc.
- P3 (Trung bình): Sự cố cá nhân ảnh hưởng công việc hàng ngày.
- P4 (Thấp): Hỏi đáp thông tin chung, yêu cầu tư vấn.

Đánh giá thêm:
- sentiment: POSITIVE, NEUTRAL, NEGATIVE, hoặc UNCLEAR
- risk_level: LOW, MEDIUM, hoặc HIGH (dựa trên mức độ khẩn cấp, cảm xúc giận dữ gay gắt hoặc ảnh hưởng diện rộng)
- likely_exceeds_l1: true nếu vấn đề cần quyền chuyên gia/hạ tầng cấp cao (L2+), false nếu L1 xử lý được.
- rationale: lý do ngắn gọn, dẫn chứng cụ thể từ nội dung ticket.
- missing_information: thông tin kỹ thuật còn thiếu cần hỏi thêm Requester (nếu có).

Quy tắc:
- Không bịa đặt hoặc đoán mò khi thiếu dữ liệu.
- Không tăng mức ưu tiên chỉ vì người gửi dùng từ ngữ mạnh nếu sự cố chỉ là cá nhân.

Nội dung ticket:
\"\"\"{description}\"\"\"

Hãy phân tích và trả về đối tượng JSON theo đúng cấu trúc yêu cầu.
"""

from app.ai.unified_client import execute_ai_content

async def _run_triage(description: str) -> TriageResult:
    prompt = TRIAGE_PROMPT.format(description=description)
    return await execute_ai_content(
        prompt=prompt,
        response_model=TriageResult,
        temperature=0.0
    )

async def ai_triage_ticket(description: str) -> TriageResult:
    config = gemini_key_manager.get_config()
    if not config.get("auto_triage", True):
        return get_triage_fallback()

    if config.get("mask_pii", True):
        masked_desc = PIIMasker.mask_text(description)
    else:
        masked_desc = description
    
    timeout_sec = min(float(config.get("timeout_seconds", 15)), 6.0)
    
    result = await with_fallback(
        func=lambda: _run_triage(masked_desc),
        fallback_value=get_triage_fallback(),
        timeout_seconds=timeout_sec
    )
    return result
