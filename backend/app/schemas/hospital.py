import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class HospitalCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    timezone: str = "America/New_York"
    calling_hours_start: str = "09:00"
    calling_hours_end: str = "18:00"
    max_concurrent_calls: int = 10

class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    calling_hours_start: Optional[str] = None
    calling_hours_end: Optional[str] = None
    max_concurrent_calls: Optional[int] = None

class HospitalResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    address: Optional[str]
    phone: Optional[str]
    timezone: str
    calling_hours_start: str
    calling_hours_end: str
    max_concurrent_calls: int
    status: str
    config: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class HospitalListResponse(BaseModel):
    items: List[HospitalResponse]
    total: int
