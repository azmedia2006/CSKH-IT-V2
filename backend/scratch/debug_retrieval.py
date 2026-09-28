import asyncio
from app.core.database import AsyncSessionLocal
from app.models.rag import RAGChunk
from app.models.user import User
from app.services.embedding_service import embedding_service
from sqlalchemy.future import select
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as session:
        user_res = await session.execute(select(User).limit(1))
        user = user_res.scalars().first()
        from app.services.rag_service import _get_safe_role
        print("User email:", user.email if user else "None", "Role:", _get_safe_role(user))

        vis_counts = await session.execute(text("SELECT visibility, count(*) FROM rag_chunks GROUP BY visibility;"))
        print("Chunk visibilities:", vis_counts.fetchall())

        query = "Làm sao để kết nối mạng wifi văn phòng?"
        query_vec = await embedding_service.get_embedding(query)

        # Let's check distance to top 5 chunks
        top_chunks = await session.execute(text("""
            SELECT article_id, title, visibility, (embedding <=> :vec) as distance
            FROM rag_chunks
            ORDER BY distance ASC
            LIMIT 5;
        """), {"vec": str(query_vec)})
        print("Top 5 by distance:")
        for row in top_chunks.fetchall():
            print(f"  {row[0]}: {row[1]} (visibility={row[2]}, distance={row[3]})")

if __name__ == "__main__":
    asyncio.run(main())
