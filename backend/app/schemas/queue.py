import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class OutreachTaskResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    campaign_id: uuid.UUID
    patient_id: uuid.UUID
    encounter_id: Optional[uuid.UUID]
    status: str
    priority_score: float
    attempt_count: int
    max_retries: int
    next_retry_at: Optional[datetime]
    callback_requested_at: Optional[datetime]
    clinical_cutoff_at: datetime
    locked_at: Optional[datetime]
    locked_by: Optional[str]
    call_outcome: Optional[str]
    call_duration_seconds: Optional[int]
    last_attempt_at: Optional[datetime]
    idempotency_key: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class QueueMetrics(BaseModel):
    pending: int
    calling: int
    retrying: int
    completed: int
    escalated: int
    failed: int

class QueueStatusResponse(BaseModel):
    metrics: QueueMetrics
    capacity_total: int
    capacity_in_use: int
