import uuid
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class KnowledgeBase(BaseModel):
    __tablename__ = "knowledge_base"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=False)
    embedding = Column(JSON, nullable=True)
    is_published = Column(Boolean, default=True, nullable=False)

    category = relationship("Category", back_populates="kb_articles")
