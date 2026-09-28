import uuid
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Attachment(BaseModel):
    __tablename__ = "attachments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(36), ForeignKey("tickets.id"), nullable=False)
    comment_id = Column(String(36), ForeignKey("comments.id"), nullable=True)
    uploader_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    file_name = Column(String(255), nullable=False)
    file_path = Column(String(1024), nullable=False)
    file_type = Column(String(100), nullable=True)   # MIME type e.g. image/png
    file_size = Column(Integer, nullable=False)       # bytes
    # Legacy fields are retained during the PostgreSQL-to-MySQL data migration.
    file_url = Column(String(1024), nullable=True)
    file_size_kb = Column(Integer, nullable=True)

    ticket = relationship("Ticket", back_populates="attachments")
    comment = relationship("Comment", back_populates="attachments")
    uploader = relationship("User", foreign_keys=[uploader_id])
