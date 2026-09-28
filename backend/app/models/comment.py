import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Comment(BaseModel):
    __tablename__ = "comments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(36), ForeignKey("tickets.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    
    is_internal = Column(Boolean, default=False, nullable=False)
    is_ai_generated = Column(Boolean, default=False, nullable=False)
    edited_by_agent = Column(Boolean, default=False, nullable=False)

    ticket = relationship("Ticket", back_populates="comments")
    user = relationship("User", back_populates="comments")
    attachments = relationship("Attachment", back_populates="comment", cascade="all, delete-orphan")
