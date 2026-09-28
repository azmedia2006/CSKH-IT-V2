import asyncio
import httpx

async def test_user_actions():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1", timeout=30.0) as client:
        # 1. Login as Admin
        admin_login = await client.post("/auth/login", json={"email": "admin@cskh.vn", "password": "Admin@123"})
        print("Admin login status:", admin_login.status_code)
        if admin_login.status_code != 200:
            print("Admin login failed:", admin_login.text)
            return
        token = admin_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Get list of users to find Đỗ Đăng Khoa
        users_res = await client.get("/users/", headers=headers)
        print("List users status:", users_res.status_code)
        users = users_res.json()
        target_user = None
        for u in users:
            if "Khoa" in (u.get("full_name") or "") or "khoa" in u.get("email"):
                target_user = u
                break

        if not target_user:
            print("Could not find Đỗ Đăng Khoa, taking first non-admin user")
            target_user = [u for u in users if u["email"] != "admin@cskh.vn"][0]

        user_id = target_user["id"]
        user_email = target_user["email"]
        print(f"Target user: {target_user.get('full_name')} ({user_email}), ID: {user_id}")

        # 3. Test Action 1: Xem hồ sơ & Lịch sử
        profile_res = await client.get(f"/users/requesters/{user_id}", headers=headers)
        print("1. Xem hồ sơ & Lịch sử status:", profile_res.status_code)
        if profile_res.status_code != 200:
            print("   Error profile:", profile_res.text)
        else:
            print("   Profile tickets count:", len(profile_res.json().get("tickets", [])))

        # 4. Test Action 2: Chỉnh sửa hồ sơ
        edit_payload = {
            "full_name": target_user.get("full_name"),
            "department": target_user.get("department") or "Hỗ trợ Kỹ thuật",
            "phone_number": "0988777666",
            "is_active": True,
            "role_name": target_user.get("role_name") or "SUPPORT_AGENT",
            "support_level": target_user.get("support_level") or "L1",
            "skill_group": target_user.get("skill_group") or "ACCOUNT_AUTH"
        }
        edit_res = await client.put(f"/users/{user_id}", json=edit_payload, headers=headers)
        print("2. Chỉnh sửa hồ sơ status:", edit_res.status_code)
        if edit_res.status_code != 200:
            print("   Error edit:", edit_res.text)

        # 5. Test Action 3: Đổi mật khẩu
        pwd_payload = {"new_password": "NewSecretPass@123"}
        pwd_res = await client.put(f"/users/{user_id}", json=pwd_payload, headers=headers)
        print("3. Đổi mật khẩu status:", pwd_res.status_code)
        if pwd_res.status_code != 200:
            print("   Error reset password:", pwd_res.text)
        else:
            # Verify login with new password
            print("   Verifying login with new password for:", user_email)
            verify_login = await client.post("/auth/login", json={"email": user_email, "password": "NewSecretPass@123"})
            print("   Login with new password status:", verify_login.status_code)
            if verify_login.status_code != 200:
                print("   Login failed:", verify_login.text)

        # 6. Test Action 4: Khóa tài khoản / Mở khóa
        lock_res = await client.put(f"/users/{user_id}", json={"is_active": False}, headers=headers)
        print("4. Khóa tài khoản status:", lock_res.status_code)
        if lock_res.status_code == 200:
            print("   Is active after lock:", lock_res.json().get("is_active"))
        unlock_res = await client.put(f"/users/{user_id}", json={"is_active": True}, headers=headers)
        print("   Mở khóa tài khoản status:", unlock_res.status_code)

if __name__ == "__main__":
    asyncio.run(test_user_actions())
