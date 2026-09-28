import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        docs = await conn.execute(text("SELECT id, filename, title, version, status, chunk_count, file_hash FROM rag_documents"))
        print("Documents:")
        for d in docs.fetchall():
            print(" ", d)

        chunks = await conn.execute(text("SELECT id, article_id, title, category, audience, visibility, status FROM rag_chunks LIMIT 5"))
        print("Sample chunks:")
        for c in chunks.fetchall():
            print(" ", c)

        audits = await conn.execute(text("SELECT id, action, actor_role, document_id, details FROM rag_audit_logs LIMIT 5"))
        print("Audits:")
        for a in audits.fetchall():
            print(" ", a)

if __name__ == "__main__":
    asyncio.run(main())
