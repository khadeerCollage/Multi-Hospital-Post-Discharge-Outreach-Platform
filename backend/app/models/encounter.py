import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, text, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base

class Encounter(Base):
    __tablename__ = "encounters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()'))
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    encounter_type: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    admission_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    discharge_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    discharge_disposition: Mapped[str | None] = mapped_column(String, nullable=True)
    primary_diagnosis: Mapped[str] = mapped_column(String, nullable=False)
    diagnosis_codes: Mapped[list] = mapped_column(JSONB, default=list)
    care_setting: Mapped[str] = mapped_column(String, nullable=False)
    attending_physician: Mapped[str | None] = mapped_column(String, nullable=True)
    procedure_name: Mapped[str | None] = mapped_column(String, nullable=True)
    procedure_type: Mapped[str | None] = mapped_column(String, nullable=True)
    surgical_team: Mapped[list] = mapped_column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    medical_checkup: Mapped[dict] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    discharge_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_required: Mapped[bool] = mapped_column(Boolean, default=True)
    follow_up_window_hours: Mapped[int] = mapped_column(Integer, default=72)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text('now()'))
