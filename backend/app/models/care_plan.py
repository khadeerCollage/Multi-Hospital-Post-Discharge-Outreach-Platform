import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base

class CarePlan(Base):
    __tablename__ = "care_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()'))
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    encounter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    instructions: Mapped[dict] = mapped_column(JSONB, default=dict)
    medications: Mapped[list] = mapped_column(JSONB, default=list)
    follow_up_appointments: Mapped[list] = mapped_column(JSONB, default=list)
    diet_restrictions: Mapped[str | None] = mapped_column(String, nullable=True)
    activity_restrictions: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text('now()'))
