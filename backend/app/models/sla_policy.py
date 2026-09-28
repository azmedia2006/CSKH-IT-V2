import uuid
from sqlalchemy import Column, String, Integer
from app.models.base import BaseModel

class SLAPolicy(BaseModel):
    __tablename__ = "sla_policies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    priority_level = Column(String(20), unique=True, nullable=False)  # P1, P2, P3, P4
    response_time_minutes = Column(Integer, nullable=False)
    resolve_time_minutes = Column(Integer, nullable=False)
    description = Column(String(255), nullable=True)
