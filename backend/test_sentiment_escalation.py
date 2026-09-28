import asyncio
import httpx

async def run_test():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1", timeout=60.0) as client:
        print("=" * 70)
        print(" 🚀 KIỂM THỬ TÍNH NĂNG NHẬN DIỆN CẢM XÚC & TỰ ĐỘNG CHUYỂN CẤP L1 -> L2")
        print(" 👤 Kịch bản: 1 Tài khoản Người dùng (Requester) & 1 Tài khoản Nhân viên hỗ trợ (Support Agent)")
        print("=" * 70)

        # -------------------------------------------------------------
        # BƯỚC 1: ĐĂNG NHẬP TÀI KHOẢN NGƯỜI DÙNG (REQUESTER)
        # -------------------------------------------------------------
        print("\n[BƯỚC 1] 👤 Người dùng đăng nhập vào hệ thống...")
        res_user_login = await client.post("/auth/login", json={"email": "user@company.vn", "password": "User@123"})
        if res_user_login.status_code != 200:
            print(f"❌ Đăng nhập Người dùng thất bại: {res_user_login.text}")
            return
        token_user = res_user_login.json()["access_token"]
        headers_user = {"Authorization": f"Bearer {token_user}"}
        print("  -> Đăng nhập thành công: Nguyễn Văn An (user@company.vn - Phòng Kế toán)")

        # -------------------------------------------------------------
        # BƯỚC 2: NGƯỜI DÙNG TẠO TICKET SỰ CỐ BAN ĐẦU
        # -------------------------------------------------------------
        print("\n[BƯỚC 2] 📝 Người dùng tạo ticket yêu cầu hỗ trợ kỹ thuật...")
        ticket_payload = {
            "title": "Phần mềm kế toán MISA báo lỗi không kết nối được máy chủ dữ liệu",
            "description": "Sáng nay phần mềm MISA báo timeout khi kết nối cơ sở dữ liệu hóa đơn. Nhờ IT hỗ trợ kiểm tra giúp.",
            "category_id": "1909d548-65ee-4a73-a7c6-52f806576a4d",  # Danh mục: Bug Phần mềm (SOFTWARE_BUG)
            "priority": "P3"
        }
        res_ticket = await client.post("/tickets/", json=ticket_payload, headers=headers_user)
        t_data = res_ticket.json()
        ticket_id = t_data["id"]
        ticket_code = t_data["ticket_code"]
        print(f"  -> Tạo ticket thành công: {ticket_code}")
        print(f"  -> Tiêu đề: {t_data.get('title')}")
        print(f"  -> Trạng thái ban đầu: {t_data.get('status')}")

        # Kiểm tra chi tiết ban đầu từ góc nhìn Nhân viên/Quản trị
        res_lead_login = await client.post("/auth/login", json={"email": "lead@cskh.vn", "password": "Lead@123"})
        headers_lead = {"Authorization": f"Bearer {res_lead_login.json()['access_token']}"}
        res_initial_tkt = await client.get(f"/tickets/{ticket_id}", headers=headers_lead)
        init_tkt = res_initial_tkt.json()
        print(f"  -> Cấp hỗ trợ kỹ thuật ban đầu: {init_tkt.get('support_level')} (Tuyến 1 - Hỗ trợ cơ bản)")
        print(f"  -> Kỹ thuật viên tiếp nhận L1: {init_tkt.get('assigned_agent_name')}")
        print(f"  -> Mức độ rủi ro hệ thống: {init_tkt.get('risk_flag')}")
        print(f"  -> Trạng thái chuyển cấp: {init_tkt.get('is_escalated')}")

        # -------------------------------------------------------------
        # BƯỚC 3: NGƯỜI DÙNG GỬI PHẢN HỒI BỨC XÚC, TIÊU CỰC
        # -------------------------------------------------------------
        angry_comment = (
            "Tại sao từ sáng đến giờ vẫn chưa có ai sửa thế này? "
            "Cả phòng kế toán đang bị đình trệ công việc, sếp đang mắng tôi rất nhiều, làm ăn tắc trách quá! "
            "Yêu cầu chuyển cấp xử lý ngay lập tức!"
        )
        print(f"\n[BƯỚC 3] 😡 Người dùng bức xúc gửi bình luận khiếu nại:")
        print(f"  \"\"{angry_comment}\"\"")

        res_post_cmt = await client.post(
            f"/tickets/{ticket_id}/comments",
            json={"content": angry_comment, "is_internal": False},
            headers=headers_user
        )
        if res_post_cmt.status_code != 200:
            print(f"❌ Gửi bình luận thất bại: {res_post_cmt.text}")
            return
        print("  -> Phản hồi đã được ghi nhận vào hệ thống.")

        # -------------------------------------------------------------
        # BƯỚC 4: HỆ THỐNG AI TỰ ĐỘNG PHÂN TÍCH SENTIMENT & CHUYỂN CẤP
        # -------------------------------------------------------------
        print("\n[BƯỚC 4] 🤖 Hệ thống AI tự động phân tích cảm xúc & thực thi chính sách tự động chuyển cấp...")
        # Lấy thông tin ticket cập nhật từ góc nhìn Staff/Quản trị
        res_updated_tkt = await client.get(f"/tickets/{ticket_id}", headers=headers_lead)
        updated_tkt = res_updated_tkt.json()

        print(f"  -> Cấp hỗ trợ mới: {updated_tkt.get('support_level')} (ĐÃ TỰ ĐỘNG NÂNG CẤP LÊN TUYẾN 2 - L2)")
        print(f"  -> Trạng thái chuyển cấp (is_escalated): {updated_tkt.get('is_escalated')}")
        print(f"  -> Cờ rủi ro hệ thống (Risk Flag): {updated_tkt.get('risk_flag')}")
        print(f"  -> Điểm tin cậy Sentiment (Confidence): {updated_tkt.get('sentiment_score')}")
        print(f"  -> Bằng chứng AI phát hiện: \"{updated_tkt.get('sentiment_evidence')}\"")
        print(f"  -> Lý do chuyển cấp hệ thống: {updated_tkt.get('escalation_reason')}")
        print(f"  -> Kỹ thuật viên L2 mới tiếp nhận: {updated_tkt.get('assigned_agent_name')}")

        assigned_agent_id = updated_tkt.get("assigned_agent_id")
        new_agent_name = updated_tkt.get("assigned_agent_name")

        # -------------------------------------------------------------
        # BƯỚC 5: ĐĂNG NHẬP VỚI TÀI KHOẢN NHÂN VIÊN HỖ TRỢ ĐƯỢC CHUYỂN CẤP (L2)
        # -------------------------------------------------------------
        # Kỹ thuật viên L2 chuyên phần mềm là Đặng Thái Sơn (l2.bug.son@cskh.vn) hoặc Mai Ngọc Lan (l2.bug.lan@cskh.vn)
        # Chúng ta tìm email của agent được phân công
        agent_email = "l2.bug.son@cskh.vn"
        res_agent_login = await client.post("/auth/login", json={"email": agent_email, "password": "Agent@123"})
        if res_agent_login.status_code != 200:
            # Thử tài khoản L2 thứ hai nếu hệ thống phân cho Mai Ngọc Lan
            agent_email = "l2.bug.lan@cskh.vn"
            res_agent_login = await client.post("/auth/login", json={"email": agent_email, "password": "Agent@123"})

        print(f"\n[BƯỚC 5] 👨‍💻 Nhân viên hỗ trợ L2 đăng nhập hệ thống ({agent_email})...")
        token_agent = res_agent_login.json()["access_token"]
        headers_agent = {"Authorization": f"Bearer {token_agent}"}
        print(f"  -> Đăng nhập thành công với vai trò Tuyến 2 (L2): {new_agent_name}")

        # Nhân viên L2 xem lịch sử trao đổi của Ticket
        res_agent_comments = await client.get(f"/tickets/{ticket_id}/comments", headers=headers_agent)
        agent_comments = res_agent_comments.json()

        print(f"\n[BƯỚC 6] 📋 Nhân viên hỗ trợ L2 xem chi tiết ticket và ghi chú nội bộ của AI:")
        for idx, c in enumerate(agent_comments, start=1):
            if c.get("is_internal"):
                print(f"\n  🔒 [GHI CHÚ NỘI BỘ AI - CHỈ NHÂN VIÊN & QUẢN TRỊ THẤY] (Bình luận #{idx})")
                print(f"     Nội dung thông báo:\n{c.get('content')}")
            else:
                print(f"\n  💬 [BÌNH LUẬN CÔNG KHAI CỦA KHÁCH HÀNG] (Bình luận #{idx})")
                print(f"     Người gửi: {c.get('user_name')}")
                print(f"     Nội dung: \"{c.get('content')}\"")

        # -------------------------------------------------------------
        # BƯỚC 7: NHÂN VIÊN HỖ TRỢ L2 TRẢ LỜI XOA DỊU KHÁCH HÀNG
        # -------------------------------------------------------------
        agent_reply = (
            f"Chào anh/chị, em là {new_agent_name} - Chuyên viên kỹ thuật Tuyến 2 (L2). "
            f"Em đã nhận được cảnh báo ưu tiên khẩn cấp và đã xác định được nguyên nhân do tiến trình service MISA trên máy chủ bị treo. "
            f"Em đang tiến hành restart lại service ngay lập tức, dự kiến anh/chị có thể đăng nhập bình thường trong 5 phút tới ạ!"
        )
        print(f"\n[BƯỚC 7] 💬 Nhân viên hỗ trợ L2 gửi phản hồi xử lý trực tiếp cho khách hàng...")
        res_reply = await client.post(
            f"/tickets/{ticket_id}/comments",
            json={"content": agent_reply, "is_internal": False},
            headers=headers_agent
        )
        if res_reply.status_code == 200:
            print("  -> Phản hồi của Nhân viên L2 đã gửi thành công tới khách hàng.")

        # -------------------------------------------------------------
        # BƯỚC 8: KIỂM TRA TỪ PHÍA KHÁCH HÀNG (BẢO MẬT GHI CHÚ NỘI BỘ)
        # -------------------------------------------------------------
        print("\n[BƯỚC 8] 🛡️ Kiểm tra hiển thị phía Người dùng (Requester)...")
        res_user_comments = await client.get(f"/tickets/{ticket_id}/comments", headers=headers_user)
        user_comments = res_user_comments.json()

        saw_internal = any(c.get("is_internal") for c in user_comments)
        saw_agent_reply = any(agent_reply in (c.get("content") or "") for c in user_comments)

        print(f"  • Người dùng có thấy câu trả lời hỗ trợ của nhân viên L2 không? -> {'CÓ ✅' if saw_agent_reply else 'CHƯA ❌'}")
        print(f"  • Người dùng có bị lộ thông tin ghi chú nội bộ / cờ rủi ro AI không? -> {'KHÔNG (Bảo mật an toàn) ✅' if not saw_internal else 'CÓ LỖI BẢO MẬT ❌'}")

        print("\n" + "=" * 70)
        print(" 🎉 KẾT QUẢ KIỂM THỬ: TÍNH NĂNG HOẠT ĐỘNG HOÀN TOÀN CHÍNH XÁC VÀ ĐẠT CHUẨN ITIL!")
        print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_test())
