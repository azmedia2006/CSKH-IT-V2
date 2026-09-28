import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        doc_count = await conn.scalar(text("SELECT count(*) FROM rag_documents"))
        chunk_count = await conn.scalar(text("SELECT count(*) FROM rag_chunks"))
        audit_count = await conn.scalar(text("SELECT count(*) FROM rag_audit_logs"))
        print(f"rag_documents: {doc_count}, rag_chunks: {chunk_count}, rag_audit_logs: {audit_count}")

if __name__ == "__main__":
    asyncio.run(main())
