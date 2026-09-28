import uuid
from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class AILog(BaseModel):
    __tablename__ = "ai_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(36), ForeignKey("tickets.id"), nullable=True)
    
    task_type = Column(String(50), nullable=False) # e.g., TRIAGE, COPILOT, SUMMARIZE
    model_name = Column(String(100), nullable=False)
    
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    latency_ms = Column(Float, nullable=True)
    
    pii_detected = Column(Boolean, default=False)
    agent_action = Column(String(50), nullable=True) # e.g., ACCEPTED, EDITED, DISMISSED
    error_message = Column(Text, nullable=True)

    ticket = relationship("Ticket", back_populates="ai_logs")
