# Export all models so Alembic can easily import them from a single place
from app.models.base import BaseModel
from app.models.role import Role
from app.models.user import User
from app.models.category import Category
from app.models.sla_policy import SLAPolicy
from app.models.ticket import Ticket
from app.models.comment import Comment
from app.models.attachment import Attachment
from app.models.knowledge_base import KnowledgeBase
from app.models.ai_log import AILog
from app.models.rag import RAGDocument, RAGChunk, RAGAuditLog

__all__ = [
    "BaseModel",
    "Role",
    "User",
    "Category",
    "SLAPolicy",
    "Ticket",
    "Comment",
    "Attachment",
    "KnowledgeBase",
    "AILog",
    "RAGDocument",
    "RAGChunk",
    "RAGAuditLog",
]

