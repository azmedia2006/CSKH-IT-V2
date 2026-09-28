import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class RAGDocument(BaseModel):
    __tablename__ = "rag_documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_hash = Column(String(64), nullable=False)  # SHA256 for idempotency
    version = Column(String(50), default="1.0-SAMPLE")
    status = Column(String(50), default="SAMPLE_NEEDS_APPROVAL")  # SAMPLE_NEEDS_APPROVAL, APPROVED, DRAFT, RETIRED
    owner = Column(String(255), default="Phòng CNTT - IT Service Desk")
    designated_signer = Column(String(255), default="Đoàn Minh Quân (Chờ xác nhận)")
    effective_date = Column(String(50), default="Chưa ban hành (Chờ ký duyệt)")
    review_date = Column(String(50), default="27/03/2027")
    chunk_count = Column(Integer, default=0)
    metadata_json = Column(JSON, nullable=True)  # Stores contradictions, unconfirmed items, contact points
    uploaded_by = Column(String(36), nullable=True)
    is_active = Column(Boolean, default=True)

    chunks = relationship("RAGChunk", back_populates="document", cascade="all, delete-orphan")


class RAGChunk(BaseModel):
    __tablename__ = "rag_chunks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("rag_documents.id", ondelete="CASCADE"), nullable=False)
    article_id = Column(String(50), nullable=False, index=True)  # e.g., POL-001, RUNBOOK-01, FLOOR-001, SLA-001
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False, index=True)   # e.g., POLICY, RUNBOOK, SLA, FLOOR_LAYOUT, ORG
    audience = Column(String(50), nullable=False, default="ALL") # REQUESTER, INTERNAL_STAFF, IT_L1, IT_L2, SECURITY_ADMINS, ALL
    visibility = Column(String(50), nullable=False, default="PUBLIC", index=True) # PUBLIC, INTERNAL, RESTRICTED
    status = Column(String(50), nullable=False, default="SAMPLE_NEEDS_APPROVAL") # SAMPLE_NEEDS_APPROVAL, APPROVED
    version = Column(String(50), default="1.0-SAMPLE")
    owner = Column(String(255), nullable=True)
    effective_date = Column(String(50), nullable=True)
    review_date = Column(String(50), nullable=True)
    chunk_index = Column(Integer, default=0)
    content = Column(Text, nullable=False)
    # JSON stores vectors portably in MySQL. Similarity is ranked in the RAG service.
    embedding = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    document = relationship("RAGDocument", back_populates="chunks")


class RAGAuditLog(BaseModel):
    __tablename__ = "rag_audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    action = Column(String(50), nullable=False)  # INGEST, REINDEX, DELETE, RETRIEVAL_QUERY, ESCALATION
    actor_id = Column(String(36), nullable=True)
    actor_email = Column(String(255), nullable=True)
    actor_role = Column(String(50), nullable=True)
    document_id = Column(String(36), nullable=True)
    article_id = Column(String(50), nullable=True)
    details = Column(JSON, nullable=True)  # Sanitized query info, match counts, audit records (no PII/secrets)
