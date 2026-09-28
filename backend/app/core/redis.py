from typing import AsyncGenerator
import redis.asyncio as redis
from app.config import settings

# Global redis connection pool
redis_client: redis.Redis | None = None

async def get_redis_client() -> AsyncGenerator[redis.Redis, None]:
    """Dependency to get redis client"""
    global redis_client
    if redis_client is None:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    yield redis_client
