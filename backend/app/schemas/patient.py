import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel

class PatientCreate(BaseModel):
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    risk_level: str = "moderate"
    communication_consent: bool = True
    preferred_language: str = "en"
    # Optional clinical discharge context
    primary_diagnosis: Optional[str] = None
    procedure_name: Optional[str] = None
    discharge_date: Optional[datetime] = None
    attending_physician: Optional[str] = None

class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    risk_level: Optional[str] = None
    communication_consent: Optional[bool] = None
    preferred_language: Optional[str] = None
    primary_diagnosis: Optional[str] = None
    procedure_name: Optional[str] = None
    attending_physician: Optional[str] = None


class PatientResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    phone: str
    email: Optional[str]
    address: Optional[str]
    risk_level: str
    communication_consent: bool
    preferred_language: str
    created_at: datetime
    updated_at: datetime
    latest_encounter: Optional[dict] = None

    model_config = {"from_attributes": True}

class PatientDetail(PatientResponse):
    encounters: List[dict] = []
    observations: List[dict] = []
    care_plans: List[dict] = []

class PatientListResponse(BaseModel):
    items: List[PatientResponse]
    total: int
    page: int
    page_size: int
