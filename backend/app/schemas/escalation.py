import uuid
from datetime import datetime
from typing import Optional, List, Any, Union
from pydantic import BaseModel

class EscalationResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    patient_id: uuid.UUID
    campaign_id: uuid.UUID
    call_record_id: uuid.UUID
    trigger: str
    clinical_indicators: List[Any]
    triage_result: dict
    consensus_result: dict
    priority: str
    status: str
    assigned_to: Optional[uuid.UUID]
    resolution: Optional[str]
    resolution_notes: Optional[str]
    resolved_at: Optional[datetime]
    resolved_by: Optional[uuid.UUID]
    acknowledged_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    # Enriched Patient & Clinical Context
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_risk_level: Optional[str] = None
    campaign_name: Optional[str] = None
    encounter_diagnosis: Optional[str] = None
    procedure_name: Optional[str] = None
    call_duration_seconds: Optional[int] = None
    call_started_at: Optional[datetime] = None
    call_transcript: Optional[List[Any]] = None
    soap_note: Optional[dict] = None

    model_config = {"from_attributes": True}

class EscalationResolve(BaseModel):
    resolution: str
    resolution_notes: Optional[str] = None

class EscalationListResponse(BaseModel):
    items: List[EscalationResponse]
    total: int
    page: int
    page_size: int
