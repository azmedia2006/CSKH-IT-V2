Hệ thống quản lý hỗ trợ khách hàng có tích hợp AI
1. Mô tả bài toán

Doanh nghiệp cung cấp dịch vụ cần quản lý yêu cầu hỗ trợ, khách hàng, nhân viên xử lý, trạng thái ticket và lịch sử trao đổi. Nếu xử lý qua email hoặc tin nhắn rời rạc, ticket dễ bị bỏ sót, khó ưu tiên và mất thời gian đọc lại lịch sử. Đề tài yêu cầu xây dựng hệ thống quản lý hỗ trợ khách hàng có tích hợp AI phân loại ticket, gợi ý câu trả lời và tóm tắt lịch sử hỗ trợ.
2. Mục tiêu

- Xây dựng hệ thống quản lý khách hàng, ticket, trạng thái xử lý, lịch sử trao đổi và báo cáo SLA cơ bản.
- Tích hợp AI để phân loại ticket, gợi ý phản hồi và tóm tắt lịch sử trao đổi.
- Sử dụng AI trong SDLC để phân tích nghiệp vụ hỗ trợ, thiết kế CSDL, sinh mã, kiểm thử và tài liệu.
- Hỗ trợ nhân viên xử lý ticket nhanh hơn nhưng vẫn yêu cầu con người duyệt nội dung AI.
3. Yêu cầu chức năng
3.1. Chức năng quản lý
1. Đăng nhập và phân quyền quản trị viên, nhân viên hỗ trợ, quản lý nhóm.
2. Quản lý khách hàng và thông tin liên hệ.
3. Tạo ticket, cập nhật tiêu đề, mô tả, mức ưu tiên, trạng thái.
4. Phân công ticket cho nhân viên xử lý.
5. Quản lý lịch sử trao đổi và file đính kèm ở mức mô tả.
6. Theo dõi trạng thái: mới, đang xử lý, chờ khách, đã đóng.
7. Tìm kiếm/lọc ticket theo khách hàng, trạng thái, mức ưu tiên, thời gian.
8. Thống kê số ticket, thời gian xử lý, nhóm vấn đề thường gặp.
3.2. Chức năng AI
1. AI phân loại ticket theo nhóm vấn đề và mức ưu tiên gợi ý.
2. AI gợi ý câu trả lời dựa trên mô tả ticket và lịch sử trao đổi.
3. AI tóm tắt lịch sử hỗ trợ dài thành các ý chính cho nhân viên mới tiếp nhận.
4. Yêu cầu kỹ thuật

- Backend: FastAPI/Flask/Django.
- Frontend: React/Vue/HTML template.
- CSDL: PostgreSQL/MySQL/SQLite.
- AI Engine: OpenAI/Gemini/Claude/Hugging Face/Ollama.
- Khuyến khích RAG nếu dùng kho tri thức FAQ/hướng dẫn sản phẩm.
- Có cơ chế nhân viên duyệt câu trả lời AI trước khi gửi.
- Có test cho ticket, phân công, trạng thái và chức năng AI.
5. Dữ liệu đầu vào, đầu ra và dữ liệu hệ thống

- Dữ liệu chính: khách hàng, ticket, nhân viên, trạng thái, bình luận, lịch sử xử lý, FAQ.
- Đầu vào quản lý: thông tin ticket, khách hàng, phản hồi, trạng thái xử lý.
- Đầu vào AI: mô tả ticket, lịch sử trao đổi đã lọc, FAQ hoặc hướng dẫn liên quan.
- Đầu ra quản lý: danh sách ticket, chi tiết xử lý, dashboard hỗ trợ.
- Đầu ra AI: nhãn phân loại, mức ưu tiên gợi ý, câu trả lời nháp, tóm tắt lịch sử.

Ví dụ dữ liệu mẫu: `Ticket 105: Khách không đăng nhập được sau khi đổi mật khẩu, đã thử reset nhưng chưa nhận email`.

Prompt mẫu:

System: Bạn là trợ lý hỗ trợ khách hàng. Chỉ tạo câu trả lời nháp để nhân viên duyệt. Không hứa hoàn tiền, không cam kết chính sách nếu dữ liệu không cung cấp.
User: Dựa trên ticket và lịch sử sau: {{ticket_context}}. Hãy phân loại vấn đề, gợi ý mức ưu tiên và viết câu trả lời nháp lịch sự.

Ẩn thông tin cá nhân không cần thiết trước khi gửi lịch sử trao đổi cho AI.
6. Hướng dẫn sử dụng AI trong từng giai đoạn SDLC

 Giai đoạn 1: Phân tích yêu cầu và thiết kế hệ thống (Bài KT1)

- Dùng AI phân tích quy trình tiếp nhận, phân công, xử lý và đóng ticket.
- Dùng AI thiết kế actor, use case và ERD.
- Dùng AI xác định chức năng AI phân loại, gợi ý câu trả lời, tóm tắt lịch sử.
- Dùng AI sinh wireframe màn hình danh sách ticket và chi tiết ticket.
- Dùng AI gợi ý yêu cầu phi chức năng về bảo mật và thời gian phản hồi.

 Giai đoạn 2: Xây dựng chức năng quản lý (Bài KT2)

- Dùng AI sinh model/API cho khách hàng, ticket, bình luận, phân công.
- Dùng AI sinh giao diện lọc ticket và cập nhật trạng thái.
- Dùng AI sinh truy vấn thống kê ticket theo trạng thái và thời gian xử lý.
- Dùng AI debug lỗi phân quyền giữa nhân viên và quản lý nhóm.

 Giai đoạn 3: Tích hợp AI, tối ưu prompt và kiểm thử (Bài KT3)

- Dùng AI thiết kế prompt gợi ý câu trả lời có cơ chế duyệt.
- Dùng AI sinh code tóm tắt lịch sử và phân loại ticket.
- Dùng AI tạo test case cho ticket thiếu dữ liệu, khách giận dữ, yêu cầu ngoài chính sách.
- Nếu dùng RAG, dùng AI hỗ trợ xây dựng FAQ và kiểm thử truy xuất.

 Giai đoạn 4: Hoàn thiện, triển khai và báo cáo (Bài thi cuối kỳ)

- Dùng AI sinh README và kịch bản demo hỗ trợ khách hàng.
- Dùng AI review bảo mật dữ liệu khách hàng và log gọi AI.
- Dùng AI tạo báo cáo kỹ thuật về chất lượng AI và giới hạn câu trả lời nháp.
- Dùng AI hỗ trợ triển khai local/cloud.
7. Mức độ khó

Trung bình: Nghiệp vụ ticket rõ ràng nhưng yêu cầu kiểm soát nội dung AI và dữ liệu cá nhân. Có thể nâng lên mức nâng cao nếu tích hợp RAG với kho tri thức sản phẩm.
