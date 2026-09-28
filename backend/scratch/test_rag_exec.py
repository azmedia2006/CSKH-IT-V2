import asyncio
from app.core.database import AsyncSessionLocal
from app.services.rag_service import RAGService
from app.models.user import User
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as session:
        # Find admin user if exists
        user_res = await session.execute(select(User).limit(1))
        user = user_res.scalars().first()

        print("Testing RAG Ingestion on /app/data/So-tay-RAG.docx...")
        doc, contradictions, unconfirmed = await RAGService.ingest_document(
            db=session,
            file_path="/app/data/So-tay-RAG.docx",
            actor_user=user,
            force_reindex=True
        )

        print(f"Document Ingested: ID={doc.id}, Title={doc.title}, Chunks={doc.chunk_count}, Status={doc.status}")
        print("Contradictions detected:")
        for c in contradictions:
            print("  *", c)
        print("Unconfirmed items:")
        for u in unconfirmed:
            print("  *", u)

        # Test retrieval query
        print("\n--- Test Retrieval 1: In-scope IT (WiFi) ---")
        chunks, citations, notice = await RAGService.retrieve_relevant_chunks(
            db=session,
            query="Làm sao để kết nối mạng wifi văn phòng?",
            current_user=user,
            top_k=3
        )
        print(f"Found {len(chunks)} chunks, {len(citations)} citations")
        for cit in citations:
            print(f"  [Citation] {cit.article_id}: {cit.title} (Status: {cit.status})")

        print("\n--- Test Retrieval 2: Unapproved item / Notice ---")
        print("Unapproved notice:", notice)

if __name__ == "__main__":
    asyncio.run(main())
