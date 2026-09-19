import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base

class ClinicalProtocol(Base):
    __tablename__ = "clinical_protocols"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()'))
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    condition_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[str] = mapped_column(String, nullable=False)
    follow_up_questions: Mapped[list] = mapped_column(JSONB, default=list)
    red_flag_symptoms: Mapped[list] = mapped_column(JSONB, default=list)
    escalation_indicators: Mapped[list] = mapped_column(JSONB, default=list)
    approved_guidance: Mapped[dict] = mapped_column(JSONB, default=dict)
    contact_window_hours: Mapped[int] = mapped_column(Integer, default=72)
    priority_level: Mapped[str] = mapped_column(String, default="standard")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[str] = mapped_column(String, default="1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text('now()'))
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=text('now()'), onupdate=datetime.utcnow)
