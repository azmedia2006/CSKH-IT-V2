import os
import math
import hashlib
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1536

class EmbeddingService:
    def __init__(self):
        self.provider = os.getenv("RAG_EMBEDDING_PROVIDER", "auto").lower()
        self.model_name = os.getenv("RAG_EMBEDDING_MODEL", "text-embedding-3-small")

    async def get_embedding(self, text: str) -> List[float]:
        """
        Sinh vector embedding 1536 chiều cho văn bản.
        Hỗ trợ:
        1. OpenAI embeddings (nếu có OPENAI_API_KEY)
        2. Google Gemini embeddings (nếu có GOOGLE_API_KEY)
        3. Local semantic projection fallback (hoạt động offline 100% không phụ thuộc internet)
        """
        clean_text = text.strip().replace("\n", " ")
        if not clean_text:
            return [0.0] * EMBEDDING_DIM

        # 1. Thử OpenAI nếu cấu hình cho phép
        if self.provider in ["auto", "openai"]:
            openai_key = os.getenv("OPENAI_API_KEY")
            if openai_key and not openai_key.startswith("your-"):
                try:
                    from openai import AsyncOpenAI
                    client = AsyncOpenAI(api_key=openai_key)
                    resp = await client.embeddings.create(
                        input=clean_text[:8000],
                        model=self.model_name if "text-embedding" in self.model_name else "text-embedding-3-small"
                    )
                    vec = resp.data[0].embedding
                    if len(vec) == EMBEDDING_DIM:
                        return vec
                    elif len(vec) < EMBEDDING_DIM:
                        return vec + [0.0] * (EMBEDDING_DIM - len(vec))
                    else:
                        return vec[:EMBEDDING_DIM]
                except Exception as e:
                    logger.warning(f"[OpenAI Embedding Fallback]: {e}")

        # 2. Thử Google Gemini
        if self.provider in ["auto", "google"]:
            google_key = os.getenv("GOOGLE_API_KEY")
            if google_key and not google_key.startswith("your-"):
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=google_key)
                    res = genai.embed_content(
                        model="models/text-embedding-004",
                        content=clean_text[:4000]
                    )
                    raw_vec = res.get("embedding", [])
                    if raw_vec:
                        # Project 768 dims to 1536 dims by repeating/interpolating
                        if len(raw_vec) == 768:
                            expanded = raw_vec + [x * 0.5 for x in raw_vec]
                            # Normalize vector
                            norm = math.sqrt(sum(x * x for x in expanded)) or 1.0
                            return [x / norm for x in expanded]
                        elif len(raw_vec) == EMBEDDING_DIM:
                            return raw_vec
                except Exception as e:
                    logger.warning(f"[Google Gemini Embedding Fallback]: {e}")

        # 3. Deterministic Local Semantic N-Gram Vector Fallback
        return self._generate_local_semantic_vector(clean_text)

    def _generate_local_semantic_vector(self, text: str) -> List[float]:
        """
        Tạo vector đơn vị 1536 chiều từ feature hashing của các từ và n-gram tiếng Việt/Anh.
        Đảm bảo tính nhất quán (deterministic), cosine similarity phản ánh đúng độ tương đồng ngữ nghĩa từ vựng.
        """
        vector = [0.0] * EMBEDDING_DIM
        words = text.lower().split()
        if not words:
            return vector

        # Trọng số cho n-gram đơn và đôi
        tokens = []
        for i, w in enumerate(words):
            tokens.append((w, 1.0))
            if i < len(words) - 1:
                tokens.append((f"{w}_{words[i+1]}", 1.5))

        for tok, weight in tokens:
            h = int(hashlib.sha256(tok.encode("utf-8")).hexdigest(), 16)
            idx = h % EMBEDDING_DIM
            sign = 1.0 if ((h >> 16) % 2 == 0) else -1.0
            vector[idx] += sign * weight

        # Chuẩn hóa về vector đơn vị L2 (unit norm)
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [x / norm for x in vector]
        return vector

embedding_service = EmbeddingService()
