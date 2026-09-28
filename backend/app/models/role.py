import uuid
from sqlalchemy import Column, String
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Role(BaseModel):
    __tablename__ = "roles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    role_name = Column(String(50), unique=True, nullable=False)  # ADMIN, AGENT, CUSTOMER
    description = Column(String(255), nullable=True)

    users = relationship("User", back_populates="role")
