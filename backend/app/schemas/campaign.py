import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_risk_levels: List[str] = ["critical", "high", "moderate", "low", "routine"]
    condition_filter: Optional[str] = None
    follow_up_window_start: datetime
    follow_up_window_end: datetime
    calling_hours_start: str = "09:00"
    calling_hours_end: str = "18:00"
    max_concurrent_calls: int = 10
    max_retries: int = 5
    priority_boost: float = 0.0

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_risk_levels: Optional[List[str]] = None
    condition_filter: Optional[str] = None

class CampaignResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: Optional[str]
    status: str
    target_risk_levels: List[str]
    condition_filter: Optional[str]
    follow_up_window_start: datetime
    follow_up_window_end: datetime
    calling_hours_start: str
    calling_hours_end: str
    max_concurrent_calls: int
    max_retries: int
    priority_boost: float
    created_by: uuid.UUID
    started_at: Optional[datetime]
    paused_at: Optional[datetime]
    completed_at: Optional[datetime]
    total_eligible: int
    total_completed: int
    total_escalated: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class CampaignMetrics(BaseModel):
    total_eligible: int
    total_completed: int
    contact_rate: float
    escalation_rate: float
