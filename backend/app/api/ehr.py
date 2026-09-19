import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/ehr", tags=["ehr"])

@router.get("/patients/{patient_id}")
async def ehr_get_patient(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return {"id": str(patient_id), "resourceType": "Patient"}

@router.get("/encounters/{encounter_id}")
async def ehr_get_encounter(encounter_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return {"id": str(encounter_id), "resourceType": "Encounter"}

@router.get("/patients/{patient_id}/observations")
async def ehr_get_observations(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return {"resourceType": "Bundle", "entry": []}

@router.post("/communications")
async def ehr_create_communication(db: AsyncSession = Depends(get_db)):
    return {"status": "created", "resourceType": "Communication"}

@router.post("/observations")
async def ehr_create_observation(db: AsyncSession = Depends(get_db)):
    return {"status": "created", "resourceType": "Observation"}
