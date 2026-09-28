---
description: Thiết kế lại giao diện frontend hướng đến người dùng cuối, áp dụng design skills của workspace và kiểm thử sau khi code.
---

# Quy trình thiết kế giao diện frontend

Khi tôi gọi workflow `/design`, hãy thiết kế và sửa trực tiếp giao diện frontend theo yêu cầu tôi gửi.

## Trước khi code
- Kiểm tra cấu trúc dự án và xác định đúng trang/component cần sửa.
- Tìm thư mục `.agents/skills` và đọc `SKILL.md` phù hợp. Ưu tiên `ui-ux-pro-max`, `design`, `design-system`, `ui-styling`. Làm theo nội dung thực tế trong skill; không bịa nếu không tìm thấy.
- Xác định người dùng và mục tiêu chính của màn hình. Với IT Service Desk, ưu tiên requester/người dùng cuối.

## Nguyên tắc giao diện
- Viết ngắn, rõ, hướng người dùng đến hành động. Tránh đoạn văn dài, chữ giải thích như tài liệu hướng dẫn và thuật ngữ nội bộ.
- Với giao diện công khai/requester, không đưa thẻ ADMIN, TEAM_LEAD, SUPPORT_AGENT, REQUESTER; commits/GitHub; Swagger; KPI quản trị hoặc thông tin kỹ thuật lên trang.
- Ưu tiên các việc người dùng cần làm như gửi ticket, theo dõi ticket và tìm trợ giúp.
- Không hiển thị dữ liệu giả như dữ liệu thật. Không để bảng, chữ hoặc nút bị cắt hay tràn.
- Không bo góc quá nhiều; ưu tiên bán kính 4–10 px.
- Đảm bảo responsive trên desktop, tablet và mobile, đồng thời giữ khả năng truy cập cơ bản.

## Khi triển khai
- Sửa code thật theo framework, component và thư viện sẵn có. Không chỉ trả lời bằng kế hoạch hoặc mockup.
- Giữ nguyên API, đăng nhập, phân quyền và luồng nghiệp vụ không thuộc phạm vi thiết kế.
- Không thêm dependency mới nếu không cần.
- Sau khi sửa, chạy build, lint, type-check và test hiện có phù hợp với dự án. Nếu kiểm tra lỗi, sửa rồi chạy lại.
- Chỉ báo cáo những kiểm tra đã thực sự chạy; nêu rõ phần nào chưa kiểm tra được.
- lưu ý :thiết kế cho người dùng nhìn chứ đừng có hướng dẫn gì hết và bỏ mấy phàn thừa đi.

Cuối cùng, tóm tắt giao diện đã sửa, chức năng được giữ nguyên và kết quả kiểm thử.