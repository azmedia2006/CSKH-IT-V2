from pydantic import BaseModel, Field

class TriageResult(BaseModel):
    category_code: str = Field(description="One of: DEVICE, ACCOUNT_AUTH, SOFTWARE_BUG, NETWORK_INFRA, ACCESS_RESOURCE, TECH_GUIDE, UNCATEGORIZED")
    priority: str = Field(description="Suggested priority: P1, P2, P3, or P4")
    confidence_score: float = Field(description="Confidence score from 0.0 to 1.0")
    sentiment: str = Field(default="NEUTRAL", description="General sentiment: POSITIVE, NEUTRAL, NEGATIVE, or UNCLEAR")
    risk_level: str = Field(default="LOW", description="Risk level: LOW, MEDIUM, or HIGH")
    likely_exceeds_l1: bool = Field(default=False, description="True if the issue likely requires L2 or higher specialized support")
    rationale: str = Field(default="", description="Short rationale citing specific evidence from the ticket")
    missing_information: str = Field(default="", description="Any missing information needed to diagnose")

class CopilotResult(BaseModel):
    draft_reply: str = Field(description="The suggested draft reply for the agent to send to the customer")
    needs_more_info: bool = Field(description="True if the AI confidence was low and it asked the customer for more info")

class SummaryResult(BaseModel):
    core_issue: str = Field(description="The core problem the customer is facing")
    progress: str = Field(description="What has been done so far to resolve it")
    next_actions: str = Field(description="What needs to be done next")

class SentimentResult(BaseModel):
    sentiment: str = Field(description="One of: POSITIVE, NEUTRAL, NEGATIVE")
    confidence_score: float = Field(description="Confidence score from 0.0 to 1.0")
    reason: str = Field(description="Concise reason explaining why this sentiment was identified")
    evidence: str = Field(description="Exact excerpt or quote from the customer text demonstrating the sentiment")
    needs_attention: bool = Field(default=False, description="True if sentiment is negative or customer shows strong frustration/urgency")


class ScopeClassificationResult(BaseModel):
    is_in_scope: bool = Field(description="True if query is directly related to IT service desk / technical support, False if out of scope")
    is_mixed: bool = Field(default=False, description="True if query contains both IT support question and non-IT question")
    is_ambiguous: bool = Field(default=False, description="True if query is unclear whether it's related to IT")
    out_of_scope_topic: str = Field(default="", description="Short label of out-of-scope topic if any, e.g. 'món ăn', 'mua sách', 'du lịch'")
    it_question_part: str = Field(default="", description="The IT question portion extracted if mixed")


from typing import List, Optional
from app.schemas.rag import CitationItem

class ChatAssistantRequest(BaseModel):
    message: str = Field(..., description="Nội dung câu hỏi của người dùng")
    history: list[dict] = Field(default_factory=list, description="Lịch sử hội thoại gần đây (chỉ phiên hiện tại)")


class ChatAssistantResponse(BaseModel):
    reply: str = Field(..., description="Câu trả lời từ Trợ lý AI")
    status: str = Field(default="SUCCESS", description="Trạng thái: SUCCESS, OUT_OF_SCOPE, NEED_CLARIFICATION, ERROR")
    source: str = Field(default="AI_ASSISTANT", description="Nguồn tri thức hoặc loại phản hồi: RAG_DOCS, DATABASE_TICKETS, KB_FAQ, IT_GUIDE, OUT_OF_SCOPE, NEED_CLARIFICATION")
    is_out_of_scope: bool = Field(default=False)
    citations: List[CitationItem] = Field(default_factory=list, description="Danh sách trích dẫn nguồn RAG chính thức")
    has_unapproved_sources: bool = Field(default=False, description="True nếu có nguồn trích xuất ở trạng thái bản thảo chưa phê duyệt")
    unapproved_notice: Optional[str] = Field(default=None, description="Cảnh báo pháp lý khi dùng nguồn chưa ký duyệt")
    suggest_ticket_creation: bool = Field(default=False, description="True nếu không có nguồn phù hợp và khuyến nghị tạo ticket")


