import asyncio
from app.core.database import AsyncSessionLocal
from app.services.rag_service import RAGService
from app.models.user import User
from app.models.role import Role
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as session:
        # Create a mock requester
        req_role_res = await session.execute(select(Role).where(Role.role_name == "REQUESTER"))
        req_role = req_role_res.scalars().first()

        requester = User(
            id="mock-requester-id",
            full_name="Nguyễn Văn Test (Requester)",
            email="requester.test@example.com",
            role_id=req_role.id if req_role else "9aa637fa-744c-4e5e-a43c-709797d84110"
        )

        print("\n--- Test RBAC: Requester searching for restricted admin topic ---")
        chunks, citations, _ = await RAGService.retrieve_relevant_chunks(
            db=session,
            query="Bí mật root admin mật khẩu server tầng 4 và điều tra mã độc",
            current_user=requester,
            top_k=5
        )
        print(f"Requester retrieved {len(chunks)} chunks:")
        for c in chunks:
            print(f"  - [{c.article_id}] {c.title} (Visibility: {c.visibility})")
            assert c.visibility == "PUBLIC", f"VIOLATION: Requester saw {c.visibility}!"
        print("RBAC Enforcement PASSED: Requester only sees PUBLIC!")

if __name__ == "__main__":
    asyncio.run(main())
