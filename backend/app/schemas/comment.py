from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class CommentCreate(BaseModel):
    content: str
    is_internal: bool = False
    is_ai_generated: bool = False
    edited_by_agent: bool = False

class CommentResponse(BaseModel):
    id: str
    ticket_id: str
    user_id: str
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    content: str
    is_internal: bool
    is_ai_generated: bool
    edited_by_agent: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
