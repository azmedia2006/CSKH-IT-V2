from pydantic import BaseModel

class DashboardStats(BaseModel):
    new_tickets: int
    processing_tickets: int
    sla_warning_tickets: int
    sla_overdue_tickets: int
