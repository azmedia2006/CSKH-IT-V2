import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def update_emails():
    async with AsyncSessionLocal() as session:
        await session.execute(text("UPDATE users SET email = REPLACE(email, '@example.test', '@cskh.vn') WHERE email LIKE '%@example.test';"))
        await session.commit()
        print("User emails updated to @cskh.vn successfully!")

if __name__ == "__main__":
    asyncio.run(update_emails())
