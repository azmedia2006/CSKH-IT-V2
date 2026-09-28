from pydantic import BaseModel, ConfigDict
from datetime import datetime

class TicketBase(BaseModel):
    title: str
    description: str
    category_id: str | None = None
    priority: str = "P3"
    is_escalated: bool = False

class TicketCreate(TicketBase):
    pass

class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    category_id: str | None = None
    assigned_agent_id: str | None = None
    is_escalated: bool | None = None
    support_level: str | None = None
    risk_flag: str | None = None

class TicketResponse(TicketBase):
    id: str
    ticket_code: str
    requester_id: str
    assigned_agent_id: str | None = None
    category_name: str | None = None
    category_code: str | None = None
    requester_name: str | None = None
    assigned_agent_name: str | None = None
    
    # L1 / L2 support level and smart escalation
    support_level: str | None = "L1"
    risk_flag: str | None = "NORMAL"
    sentiment: str | None = None
    sentiment_score: float | None = None
    sentiment_reason: str | None = None
    sentiment_evidence: str | None = None
    escalation_status: str | None = "NONE"
    escalated_at: datetime | None = None
    escalation_reason: str | None = None
    previous_agent_id: str | None = None
    previous_agent_name: str | None = None

    ai_suggested_priority: str | None = None
    ai_confidence_score: float | None = None
    status: str
    
    first_response_due_at: datetime | None = None
    first_responded_at: datetime | None = None
    resolution_due_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    
    ai_summary: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
