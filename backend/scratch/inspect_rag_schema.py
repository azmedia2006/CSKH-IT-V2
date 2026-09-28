import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        for table in ['rag_documents', 'rag_chunks', 'rag_audit_logs']:
            res = await conn.execute(text(f"""
                SELECT column_name, data_type, character_maximum_length, is_nullable
                FROM information_schema.columns
                WHERE table_name = '{table}'
                ORDER BY ordinal_position;
            """))
            print(f"=== {table} ===")
            for row in res.fetchall():
                print(f"  {row[0]}: {row[1]} ({row[2]}), nullable={row[3]}")

if __name__ == "__main__":
    asyncio.run(main())
