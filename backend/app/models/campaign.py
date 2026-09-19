import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Integer, text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base

class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()'))
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    target_risk_levels: Mapped[list] = mapped_column(JSONB, default=["critical", "high", "moderate", "low", "routine"])
    condition_filter: Mapped[str | None] = mapped_column(String, nullable=True)
    follow_up_window_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    follow_up_window_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    calling_hours_start: Mapped[str] = mapped_column(String, default="09:00")
    calling_hours_end: Mapped[str] = mapped_column(String, default="18:00")
    max_concurrent_calls: Mapped[int] = mapped_column(Integer, default=10)
    max_retries: Mapped[int] = mapped_column(Integer, default=5)
    priority_boost: Mapped[float] = mapped_column(Float, default=0.0)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    total_eligible: Mapped[int] = mapped_column(Integer, default=0)
    total_completed: Mapped[int] = mapped_column(Integer, default=0)
    total_escalated: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text('now()'))
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=text('now()'), onupdate=datetime.utcnow)
