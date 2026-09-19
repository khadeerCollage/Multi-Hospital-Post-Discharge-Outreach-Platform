import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class ProtocolBase(BaseModel):
    name: str
    condition_type: str
    description: Optional[str] = ""
    follow_up_questions: List[str] = []
    red_flag_symptoms: List[str] = []
    escalation_indicators: List[str] = []
    approved_guidance: Optional[Any] = None
    contact_window_hours: int = 72
    priority_level: str = "standard"
    is_active: bool = True
    version: str = "1.0"

class ProtocolCreate(ProtocolBase):
    tenant_id: Optional[uuid.UUID] = None

class ProtocolUpdate(BaseModel):
    name: Optional[str] = None
    condition_type: Optional[str] = None
    description: Optional[str] = None
    follow_up_questions: Optional[List[str]] = None
    red_flag_symptoms: Optional[List[str]] = None
    escalation_indicators: Optional[List[str]] = None
    approved_guidance: Optional[Any] = None
    contact_window_hours: Optional[int] = None
    priority_level: Optional[str] = None
    is_active: Optional[bool] = None
    version: Optional[str] = None

class ProtocolResponse(ProtocolBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    hospital_name: Optional[str] = None

    model_config = {"from_attributes": True}

class ProtocolListResponse(BaseModel):
    items: List[ProtocolResponse]
    total: int
