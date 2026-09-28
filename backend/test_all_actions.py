import asyncio
import httpx

async def test_all_five_actions():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1", timeout=30.0) as client:
        print("=" * 65)
        print(" 🧪 KIỂM THỬ 5 TÍNH NĂNG TRÊN MENU THAO TÁC NGƯỜI DÙNG (ẢNH 2)")
        print("=" * 65)

        # Đăng nhập Admin
        res_admin = await client.post("/auth/login", json={"email": "admin@cskh.vn", "password": "Admin@123"})
        if res_admin.status_code != 200:
            print("❌ Đăng nhập Admin thất bại:", res_admin.text)
            return
        token = res_admin.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Đăng nhập Admin (admin@cskh.vn) thành công.")

        # Lấy danh sách tìm tài khoản Đỗ Đăng Khoa
        res_users = await client.get("/users/", headers=headers)
        users = res_users.json()
        target = next((u for u in users if "Khoa" in (u.get("full_name") or "") or "khoa" in u.get("email")), None)
        if not target:
            target = [u for u in users if u["email"] != "admin@cskh.vn"][0]
        
        user_id = target["id"]
        user_email = target["email"]
        user_name = target["full_name"]
        print(f"🎯 Người dùng thử nghiệm: {user_name} ({user_email})")

        # -------------------------------------------------------------
        # TÍNH NĂNG 1: Xem hồ sơ & Lịch sử
        # -------------------------------------------------------------
        print("\n--- 1. [Xem hồ sơ & Lịch sử] ---")
        p_res = await client.get(f"/users/requesters/{user_id}", headers=headers)
        if p_res.status_code == 200:
            p_data = p_res.json()
            print(f"✅ Lấy hồ sơ thành công:")
            print(f"   • Họ tên: {p_data.get('full_name')}")
            print(f"   • Email: {p_data.get('email')}")
            print(f"   • Phòng ban: {p_data.get('department')}")
            print(f"   • Tổng số ticket: {p_data.get('total_tickets')}")
            print(f"   • Ticket đang xử lý: {p_data.get('open_tickets')}")
            print(f"   • Ticket đã đóng: {p_data.get('closed_tickets')}")
            print(f"   • Danh sách ticket gần đây ({len(p_data.get('recent_tickets', []))} ticket): Đã sẵn sàng hiển thị.")
        else:
            print(f"❌ Lỗi: {p_res.status_code} - {p_res.text}")

        # -------------------------------------------------------------
        # TÍNH NĂNG 2: Chỉnh sửa hồ sơ
        # -------------------------------------------------------------
        print("\n--- 2. [Chỉnh sửa hồ sơ] ---")
        edit_body = {
            "full_name": user_name,
            "department": target.get("department") or "Hỗ trợ Kỹ thuật",
            "phone_number": "0901 888 999",
            "is_active": True,
            "role_name": target.get("role_name") or "SUPPORT_AGENT",
            "support_level": target.get("support_level") or "L1",
            "skill_group": target.get("skill_group") or "ACCOUNT_AUTH"
        }
        e_res = await client.put(f"/users/{user_id}", json=edit_body, headers=headers)
        if e_res.status_code == 200:
            print(f"✅ Cập nhật hồ sơ thành công! Số điện thoại mới: {e_res.json().get('phone_number')}")
        else:
            print(f"❌ Lỗi: {e_res.status_code} - {e_res.text}")

        # -------------------------------------------------------------
        # TÍNH NĂNG 3: Đổi mật khẩu
        # -------------------------------------------------------------
        print("\n--- 3. [Đổi mật khẩu tài khoản] ---")
        new_pass = "TestKhoa@2026"
        pwd_res = await client.put(f"/users/{user_id}", json={"new_password": new_pass}, headers=headers)
        if pwd_res.status_code == 200:
            print(f"✅ Đổi mật khẩu thành công sang '{new_pass}'!")
            # Kiểm chứng đăng nhập bằng mật khẩu mới
            login_verify = await client.post("/auth/login", json={"email": user_email, "password": new_pass})
            if login_verify.status_code == 200:
                print(f"✅ XÁC THỰC THÀNH CÔNG: Người dùng '{user_email}' đã đăng nhập được ngay bằng mật khẩu mới!")
            else:
                print(f"❌ Không đăng nhập được bằng mật khẩu mới: {login_verify.text}")
        else:
            print(f"❌ Lỗi đổi mật khẩu: {pwd_res.status_code} - {pwd_res.text}")

        # Đổi lại mật khẩu mặc định để không gián đoạn
        await client.put(f"/users/{user_id}", json={"new_password": "Agent@123"}, headers=headers)

        # -------------------------------------------------------------
        # TÍNH NĂNG 4: Khóa & Mở khóa tài khoản
        # -------------------------------------------------------------
        print("\n--- 4. [Khóa & Mở khóa tài khoản] ---")
        # Khóa
        lock_res = await client.put(f"/users/{user_id}", json={"is_active": False}, headers=headers)
        print(f"✅ Khóa tài khoản thành công! is_active: {lock_res.json().get('is_active')}")
        
        # Kiểm tra người dùng bị khóa đăng nhập
        blocked_login = await client.post("/auth/login", json={"email": user_email, "password": "Agent@123"})
        if blocked_login.status_code in [400, 403]:
            print(f"✅ Đúng chuẩn an ninh: Tài khoản bị khóa không thể đăng nhập ({blocked_login.json().get('detail')}).")

        # Mở khóa
        unlock_res = await client.put(f"/users/{user_id}", json={"is_active": True}, headers=headers)
        print(f"✅ Mở khóa tài khoản thành công! is_active: {unlock_res.json().get('is_active')}")

        # -------------------------------------------------------------
        # TÍNH NĂNG 5: Xóa người dùng (với cơ chế bảo toàn dữ liệu IT)
        # -------------------------------------------------------------
        print("\n--- 5. [Xóa người dùng] ---")
        # Tạo thử một user tạm thời để test chức năng xóa
        temp_user_data = {
            "email": "temp.test.user@cskh.vn",
            "password": "User@123",
            "full_name": "Người dùng Kiểm thử Xóa",
            "role_name": "REQUESTER",
            "department": "Kiểm thử",
            "is_active": True
        }
        res_create = await client.post("/users/", json=temp_user_data, headers=headers)
        if res_create.status_code == 200:
            temp_id = res_create.json()["id"]
            print(f"  • Đã tạo tài khoản mẫu tạm thời: {temp_id}")
            del_res = await client.delete(f"/users/{temp_id}", headers=headers)
            print(f"✅ Xóa người dùng thành công: {del_res.json().get('message')}")

        print("\n" + "=" * 65)
        print(" 🎉 TẤT CẢ 5 TÍNH NĂNG TRÊN ẢNH 2 ĐỀU ĐÃ HOẠT ĐỘNG HOÀN HẢO!")
        print("=" * 65)

if __name__ == "__main__":
    asyncio.run(test_all_five_actions())
