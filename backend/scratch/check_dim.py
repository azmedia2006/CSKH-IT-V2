import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("""
            SELECT atttypmod
            FROM pg_attribute
            WHERE attrelid = 'rag_chunks'::regclass
            AND attname = 'embedding';
        """))
        row = res.fetchone()
        print("Embedding atttypmod (dimension):", row[0] if row else "None")

if __name__ == "__main__":
    asyncio.run(main())
