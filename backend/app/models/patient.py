import uuid
from datetime import date, datetime
from sqlalchemy import String, Boolean, DateTime, Date, text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'mrn', name='uix_tenant_id_mrn'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()'))
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=False, index=True)
    mrn: Mapped[str] = mapped_column(String, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    risk_level: Mapped[str] = mapped_column(String, nullable=False, index=True)
    communication_consent: Mapped[bool] = mapped_column(Boolean, default=True)
    preferred_language: Mapped[str] = mapped_column(String, default='en')
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text('now()'))
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=text('now()'), onupdate=datetime.utcnow)
