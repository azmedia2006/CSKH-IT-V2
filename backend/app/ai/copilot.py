from app.ai.gemini_client import gemini_client
from app.ai.pii_masker import PIIMasker
from app.ai.fallback import with_fallback
from app.schemas.ai import CopilotResult
from app.ai.key_manager import gemini_key_manager
from app.ai.unified_client import execute_ai_content

COPILOT_SYSTEM_PROMPT = """
Bạn là Trợ lý AI Copilot cao cấp hỗ trợ Kỹ thuật viên IT Service Desk (AZ Media 247) soạn thảo phản hồi cho Khách hàng / Người dùng nội bộ.
Mục tiêu của bạn là giúp Kỹ thuật viên trả lời chuyên nghiệp, chuẩn mực, đồng cảm và giải quyết ĐÚNG TRỌNG TÂM theo từng diễn biến trao đổi thực tế của ticket.

THÔNG TIN TICKET:
- Mã ticket: {ticket_code}
- Tiêu đề sự cố: {title}
- Khách hàng yêu cầu: {customer_name} ({customer_dept})
- Kỹ thuật viên phụ trách: {agent_name} (Cấp hỗ trợ: {support_level})
- Trạng thái ticket: {status}
- Tình trạng chuyển cấp / ưu tiên: {escalation_info}

LỊCH SỬ TRAO ĐỔI (Thứ tự thời gian từ cũ đến mới):
{conversation_history}

TIN NHẮN GẦN NHẤT CẦN XỬ LÝ:
Người gửi: {latest_message_author}
Nội dung: {latest_message_text}

TÀI LIỆU CƠ SỞ TRI THỨC (RAG / KB) LIÊN QUAN:
{kb_context}

NGUYÊN TẮC SOẠN THẢO BẮT BUỘC:
1. XÁC ĐỊNH CHÍNH XÁC BỐI CẢNH LƯỢT TRAO ĐỔI:
{turn_instructions}

2. VỀ NỘI DUNG VÀ TÍNH CHÍNH XÁC:
- Nếu khách hàng có gửi kèm ảnh chụp màn hình sự cố: Ghi nhận và đề cập việc kỹ thuật viên đã tiếp nhận hình ảnh chụp lỗi của khách hàng để tiến hành phân tích, không hỏi lại những lỗi đã thể hiện rõ trên ảnh.
- TUYỆT ĐỐI KHÔNG hỏi lại những câu hỏi hoặc thông tin mà khách hàng đã trả lời ở các tin nhắn trước.
- Tuyệt đối không để placeholder chung chung như "[Mã ticket]", hãy sử dụng chính xác mã {ticket_code}.
- Các nội dung có nhãn [GHI CHÚ NỘI BỘ] là trao đổi bảo mật của đội ngũ IT; KHÔNG ĐƯỢC để lộ nguyên văn hoặc quy trình nội bộ nhạy cảm cho khách hàng.

3. VĂN PHONG VÀ ĐỊNH DẠNG:
- Tiếng Việt chuẩn mực, hỗ trợ tận tâm, lịch sự, chuyên nghiệp.
- Định dạng văn bản thuần tự nhiên (Plain Text): TUYỆT ĐỐI KHÔNG dùng ký tự cú pháp Markdown in đậm hai dấu sao (**từ khóa** hoặc __từ khóa__). Viết từ ngữ bình thường, mạch lạc, tự nhiên như thư phản hồi hỗ trợ khách hàng, không chèn bất kỳ ký tự định dạng mã nguồn Markdown nào như ** hoặc *.
- Sử dụng gạch đầu dòng (-) rõ ràng khi liệt kê các bước hoặc phương án xử lý.
- Ký tên chuẩn cuối thư:
Trân trọng,
{agent_name}
Đội ngũ IT Service Desk – AZ Media 247
"""

def strip_markdown_decorations(text: str) -> str:
    """Loại bỏ sạch các ký tự markdown như **text**, *text*, __text__ để text thuần tự nhiên."""
    if not text:
        return ""
    import re
    cleaned = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    cleaned = re.sub(r'__(.*?)__', r'\1', cleaned)
    cleaned = re.sub(r'(?<!\*)\*(?!\s)(.*?)(?!\s)\*(?!\*)', r'\1', cleaned)
    return cleaned.strip()

async def _run_copilot(
    description: str,
    kb_context: str,
    ticket_code: str = "",
    title: str = "",
    customer_name: str = "",
    customer_dept: str = "",
    agent_name: str = "",
    support_level: str = "L1",
    status: str = "PROCESSING",
    escalation_info: str = "Bình thường",
    conversation_history: str = "",
    latest_message_author: str = "",
    latest_message_text: str = "",
    is_first_response: bool = True,
    last_is_customer: bool = True
) -> CopilotResult:
    # Xác định hướng dẫn theo lượt hội thoại
    if is_first_response:
        turn_instructions = f"""- ĐÂY LÀ PHẢN HỒI ĐẦU TIÊN CỦA KỸ THUẬT VIÊN:
  + Chào khách hàng ({customer_name or 'anh/chị'}), xác nhận IT đã tiếp nhận xử lý ticket {ticket_code or ''}.
  + Nếu khách hàng phản ánh chậm trễ hoặc bức xúc: Thành thật xin lỗi về sự chậm trễ/bất tiện, trấn an khách hàng rằng ticket đã được ưu tiên xử lý khẩn.
  + Nếu cơ sở tri thức đã có giải pháp cho lỗi này: Hướng dẫn các bước khắc phục cụ thể, rõ ràng.
  + Nếu chưa đủ dữ liệu kỹ thuật: Đề nghị khách hàng cung cấp ngắn gọn các thông tin then chốt còn thiếu, hoặc đề xuất kết nối hỗ trợ từ xa (UltraViewer/TeamViewer/AnyDesk)."""
    elif last_is_customer:
        turn_instructions = f"""- ĐÂY LÀ PHẢN HỒI TIẾP THEO (Kỹ thuật viên đã từng trao đổi trước đó và khách hàng vừa gửi phản hồi mới):
  + TUYỆT ĐỐI KHÔNG chào hỏi lặp lại như vừa mới tiếp nhận ticket (KHÔNG nói 'Kính chào anh/chị, IT đã ghi nhận ticket...', KHÔNG giới thiệu lại từ đầu).
  + Chào ngắn gọn thân mật (ví dụ: 'Chào anh/chị {customer_name or ''},' hoặc 'Cảm ơn anh/chị {customer_name or ''} đã phản hồi,').
  + TẬP TRUNG XỬ LÝ TRỰC TIẾP NỘI DUNG MỚI NHẤT MÀ KHÁCH HÀNG VỪA GỬI:
    * Nếu khách hàng vừa cung cấp thông tin/trả lời câu hỏi trước đó: Ghi nhận thông tin, phân tích lỗi dựa trên các thông số khách vừa cung cấp và đưa ra giải pháp/hướng dẫn khắc phục tiếp theo, hoặc thông báo bước kỹ thuật mà IT đang tiến hành xử lý tiếp.
    * Nếu khách hàng phản ánh phàn nàn/chờ lâu: Lắng nghe, xin lỗi chân thành, cập nhật tiến độ xử lý và hành động cụ thể ngay lập tức.
    * Nếu khách hàng thông báo sự cố đã được giải quyết: Cảm ơn và hướng dẫn đóng ticket hoặc hỏi thăm nếu cần hỗ trợ gì thêm."""
    else:
        turn_instructions = f"""- ĐÂY LÀ PHẢN HỒI THEO DÕI / NHẮC NHẸ (Kỹ thuật viên đã gửi tin nhắn trước đó và đang chờ khách hàng):
  + TUYỆT ĐỐI KHÔNG gửi lại email mở đầu tiếp nhận ticket.
  + Nhắn tin ngắn gọn, lịch sự hỏi thăm xem khách hàng đã nhận được thông tin / đã thử các bước hướng dẫn chưa, hoặc đề xuất lịch hẹn kết nối UltraViewer/TeamViewer nếu khách hàng cần IT thao tác trực tiếp."""

    hist = conversation_history.strip() or description.strip()
    latest_msg = latest_message_text.strip() or description.strip()
    latest_author = latest_message_author or ("Khách hàng" if last_is_customer else "Kỹ thuật viên")

    prompt = COPILOT_SYSTEM_PROMPT.format(
        ticket_code=ticket_code or "[Mã ticket]",
        title=title or "Sự cố kỹ thuật",
        customer_name=customer_name or "Khách hàng",
        customer_dept=customer_dept or "Nội bộ",
        agent_name=agent_name or "Kỹ thuật viên IT",
        support_level=support_level or "L1",
        status=status or "PROCESSING",
        escalation_info=escalation_info or "Bình thường",
        conversation_history=hist or "Chưa có trao đổi nào.",
        latest_message_author=latest_author,
        latest_message_text=latest_msg or "Không có nội dung mới.",
        kb_context=kb_context or "Không tìm thấy bài viết kho tri thức phù hợp.",
        turn_instructions=turn_instructions
    )

    res = await execute_ai_content(
        prompt=prompt,
        response_model=CopilotResult,
        temperature=0.2
    )
    if res and getattr(res, "draft_reply", None):
        res.draft_reply = strip_markdown_decorations(res.draft_reply)
    return res

async def ai_draft_reply(
    description: str = "",
    kb_context: str = "",
    ticket_code: str = "",
    title: str = "",
    customer_name: str = "",
    customer_dept: str = "",
    agent_name: str = "",
    support_level: str = "L1",
    status: str = "PROCESSING",
    escalation_info: str = "Bình thường",
    conversation_history: str = "",
    latest_message_author: str = "",
    latest_message_text: str = "",
    is_first_response: bool = True,
    last_is_customer: bool = True
) -> CopilotResult:
    config = gemini_key_manager.get_config()
    if config.get("mask_pii", True):
        masked_desc = PIIMasker.mask_text(description)
        masked_kb = PIIMasker.mask_text(kb_context)
        masked_hist = PIIMasker.mask_text(conversation_history) if conversation_history else ""
        masked_latest = PIIMasker.mask_text(latest_message_text) if latest_message_text else ""
    else:
        masked_desc = description
        masked_kb = kb_context
        masked_hist = conversation_history
        masked_latest = latest_message_text
    
    timeout_sec = max(config.get("timeout_seconds", 20), 15)
    
    # Fallback dự phòng
    if is_first_response:
        fallback_text = (
            f"Chào {customer_name or 'anh/chị'},\n\n"
            f"IT đã tiếp nhận ticket {ticket_code or ''} và đang tiến hành kiểm tra xử lý. "
            "Chúng tôi sẽ cập nhật tiến độ sớm nhất có thể.\n\n"
            f"Trân trọng,\n{agent_name or 'Đội ngũ IT Service Desk – AZ Media 247'}"
        )
    else:
        fallback_text = (
            f"Chào {customer_name or 'anh/chị'},\n\n"
            "IT đã nhận được phản hồi của anh/chị và đang tiếp tục kiểm tra xử lý sự cố. "
            "Chúng tôi sẽ phản hồi lại ngay khi có kết quả.\n\n"
            f"Trân trọng,\n{agent_name or 'Đội ngũ IT Service Desk – AZ Media 247'}"
        )
        
    fallback_val = CopilotResult(
        draft_reply=fallback_text,
        needs_more_info=False
    )
    
    result = await with_fallback(
        func=lambda: _run_copilot(
            description=masked_desc,
            kb_context=masked_kb,
            ticket_code=ticket_code,
            title=title,
            customer_name=customer_name,
            customer_dept=customer_dept,
            agent_name=agent_name,
            support_level=support_level,
            status=status,
            escalation_info=escalation_info,
            conversation_history=masked_hist,
            latest_message_author=latest_message_author,
            latest_message_text=masked_latest,
            is_first_response=is_first_response,
            last_is_customer=last_is_customer
        ),
        fallback_value=fallback_val,
        timeout_seconds=timeout_sec
    )
    if result and getattr(result, "draft_reply", None):
        result.draft_reply = strip_markdown_decorations(result.draft_reply)
    return result

