import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class User(BaseModel):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    role_id = Column(String(36), ForeignKey("roles.id"), nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    phone_number = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    support_level = Column(String(10), nullable=True)  # 'L1', 'L2' or None
    skill_group = Column(String(50), nullable=True)    # e.g. 'ACCOUNT_AUTH', 'SOFTWARE_BUG' or None

    role = relationship("Role", back_populates="users")
    
    # We will define back_populates for tickets later in the Ticket model
    tickets_requested = relationship("Ticket", foreign_keys="[Ticket.requester_id]", back_populates="requester")
    tickets_assigned = relationship("Ticket", foreign_keys="[Ticket.assigned_agent_id]", back_populates="assigned_agent")
    comments = relationship("Comment", back_populates="user")
