import asyncio
import httpx

async def test_suggest():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1", timeout=60.0) as client:
        login_res = await client.post("/auth/login", json={"email": "admin@cskh.vn", "password": "Admin@123"})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Lấy ticket TKT-20260928-DC4B
        tickets = (await client.get("/tickets/", headers=headers)).json()
        target = next((x for x in tickets if "DC4B" in x.get("ticket_code", "")), None)
        if not target:
            target = next((x for x in tickets if "MISA" in x.get("title", "")), tickets[0])
            
        ticket_id = target["id"]
        print(f"Testing on ticket: {target['ticket_code']} - {target['title']}")
        
        # Xem các comments hiện tại của ticket này
        comments = (await client.get(f"/tickets/{ticket_id}/comments", headers=headers)).json()
        print(f"Number of comments: {len(comments)}")
        for idx, c in enumerate(comments, 1):
            print(f"  Comment {idx} ({'INTERNAL' if c.get('is_internal') else 'PUBLIC'} by {c.get('user_name')}): {c.get('content')[:100]}...")
            
        # Gọi suggest-reply
        res = await client.post(f"/tickets/{ticket_id}/suggest-reply", headers=headers)
        print("\n--- AI DRAFT REPLY SUGGESTION ---")
        print("Status code:", res.status_code)
        print("Draft reply:\n", res.json().get("draft_reply"))

if __name__ == "__main__":
    asyncio.run(test_suggest())
