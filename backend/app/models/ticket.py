import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Ticket(BaseModel):
    __tablename__ = "tickets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_code = Column(String(20), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    
    requester_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_agent_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    is_escalated = Column(Boolean, default=False)
    
    # Cấp hỗ trợ hiện tại của Ticket: 'L1', 'L2'
    support_level = Column(String(10), nullable=True, default="L1")
    
    # Cờ rủi ro & Sentiment do AI phân tích
    risk_flag = Column(String(20), nullable=True, default="NORMAL") # 'HIGH', 'CHECK_REQUIRED', 'NORMAL'
    sentiment = Column(String(20), nullable=True)                  # 'NEGATIVE', 'NEUTRAL', 'POSITIVE'
    sentiment_score = Column(Float, nullable=True)
    sentiment_reason = Column(Text, nullable=True)
    sentiment_evidence = Column(Text, nullable=True)
    
    # Trạng thái chuyển cấp
    escalation_status = Column(String(50), nullable=True, default="NONE") # 'NONE', 'AUTO_ESCALATED', 'MANUAL_ESCALATED', 'L2_WAITING'
    escalated_at = Column(DateTime, nullable=True)
    escalation_reason = Column(Text, nullable=True)
    previous_agent_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    priority = Column(String(20), nullable=False, default="P3")
    ai_suggested_priority = Column(String(20), nullable=True)
    ai_confidence_score = Column(Float, nullable=True)
    
    status = Column(String(50), nullable=False, default="NEW")
    
    # SLA Tracking
    first_response_due_at = Column(DateTime, nullable=True)
    first_responded_at = Column(DateTime, nullable=True)
    resolution_due_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    ai_summary = Column(Text, nullable=True)

    requester = relationship("User", foreign_keys=[requester_id], back_populates="tickets_requested")
    assigned_agent = relationship("User", foreign_keys=[assigned_agent_id], back_populates="tickets_assigned")
    previous_agent = relationship("User", foreign_keys=[previous_agent_id])
    category = relationship("Category", back_populates="tickets")
    comments = relationship("Comment", back_populates="ticket", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="ticket", cascade="all, delete-orphan")
    ai_logs = relationship("AILog", back_populates="ticket")
