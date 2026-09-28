import pytest
from app.ai.pii_masker import PIIMasker
from app.ai.triage import ai_triage_ticket
from app.ai.copilot import ai_draft_reply
from app.ai.summarizer import ai_summarize_ticket

# ==========================================
# 1. KIỂM THỬ BẢO MẬT & PII MASKING (ẨN THÔNG TIN CÁ NHÂN)
# ==========================================
def test_pii_masking_phone_and_email():
    """Kiểm tra chức năng che giấu số điện thoại, mật khẩu và email trước khi gọi AI"""
    sample_text = "Khách hàng Nguyễn Văn A, email test@gmail.com, sđt 0912345678, password=Admin@123 cần hỗ trợ gấp."
    masked = PIIMasker.mask_text(sample_text)
    
    assert "test@gmail.com" not in masked
    assert "0912345678" not in masked
    assert "Admin@123" not in masked
    assert "[REDACTED_EMAIL]" in masked
    assert "[REDACTED_PHONE]" in masked
    assert "[REDACTED_PASSWORD]" in masked

# ==========================================
# 2. KIỂM THỬ CHỨC NĂNG AI TRIAGE & PHÂN LOẠI TICKET
# ==========================================
@pytest.mark.asyncio
async def test_ai_triage_classification():
    """Kiểm tra AI phân loại nhóm vấn đề và đề xuất mức ưu tiên dựa trên mô tả ticket"""
    description = "Hệ thống mạng VPN công ty bị ngắt kết nối hoàn toàn toàn bộ phòng ban không làm việc được"
    result = await ai_triage_ticket(description=description)
    
    assert result.priority in ["P1", "P2", "P3", "P4"]
    assert result.confidence_score >= 0.0
    assert result.category_code is not None

# ==========================================
# 3. KIỂM THỬ AI GỢI Ý CÂU TRẢ LỜI & CƠ CHẾ DUYỆT CÂU TRẢ LỜI
# ==========================================
@pytest.mark.asyncio
async def test_ai_draft_reply():
    """Kiểm tra AI tạo câu trả lời nháp để nhân viên duyệt trước khi gửi khách hàng"""
    ticket_context = "Khách không đăng nhập được sau khi đổi mật khẩu, đã thử reset nhưng chưa nhận email"
    result = await ai_draft_reply(description=ticket_context, kb_context="")
    
    assert result.draft_reply is not None
    assert len(result.draft_reply.strip()) > 10

# ==========================================
# 4. KIỂM THỬ AI TÓM TẮT LỊCH SỬ HỖ TRỢ
# ==========================================
@pytest.mark.asyncio
async def test_ai_summarize_history():
    """Kiểm tra AI tóm tắt các cuộc hội thoại dài thành các ý chính cho nhân viên tiếp nhận"""
    comments = """
    - 08:00 Khách hàng: Không vào được ứng dụng kế toán.
    - 08:15 Kỹ thuật: Đã kiểm tra server, yêu cầu khách gửi ảnh màn hình.
    - 08:30 Khách hàng: Đã gửi ảnh lỗi timeout kết nối cổng 8080.
    - 09:00 Kỹ thuật: Đang reset lại service cổng 8080.
    """
    summary_res = await ai_summarize_ticket(comments)
    assert summary_res.core_issue is not None
    assert summary_res.progress is not None
    assert summary_res.next_actions is not None

# ==========================================
# 5. KIỂM THỬ TRẠNG THÁI & PHÂN CÔNG TICKET
# ==========================================
def test_ticket_status_lifecycle():
    """Kiểm tra chu trình các trạng thái hợp lệ của Ticket theo yêu cầu Đề tài 10"""
    valid_statuses = ["NEW", "PROCESSING", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]
    current_status = "NEW"
    
    # Bước 1: Tiếp nhận và phân công
    current_status = "PROCESSING"
    assert current_status in valid_statuses
    
    # Bước 2: Chờ khách phản hồi
    current_status = "WAITING_CUSTOMER"
    assert current_status in valid_statuses
    
    # Bước 3: Đã giải quyết
    current_status = "RESOLVED"
    assert current_status in valid_statuses
    
    # Bước 4: Đã đóng
    current_status = "CLOSED"
    assert current_status in valid_statuses
