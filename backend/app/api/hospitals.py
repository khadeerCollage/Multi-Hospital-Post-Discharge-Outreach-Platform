import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import require_role, get_tenant_context
from app.core.tenant import TenantContext
from app.models.hospital import Hospital
from app.schemas.hospital import HospitalCreate, HospitalUpdate, HospitalResponse, HospitalListResponse

router = APIRouter(prefix="/hospitals", tags=["hospitals"])

@router.post("", response_model=HospitalResponse)
async def create_hospital(
    hospital_in: HospitalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["platform_admin"]))
):
    hospital = Hospital(**hospital_in.model_dump())
    db.add(hospital)
    await db.commit()
    await db.refresh(hospital)
    return hospital

@router.get("", response_model=HospitalListResponse)
async def list_hospitals(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    query = select(Hospital)
    if tenant_context.role != "platform_admin":
        query = query.where(Hospital.id == tenant_context.tenant_id)
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    hospitals = result.scalars().all()
    
    # In a real app we'd do a count query here
    return {"items": hospitals, "total": len(hospitals)}

@router.get("/{hospital_id}", response_model=HospitalResponse)
async def get_hospital(
    hospital_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    if not tenant_context.has_access_to(hospital_id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = result.scalar_one_or_none()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return hospital

@router.put("/{hospital_id}", response_model=HospitalResponse)
async def update_hospital(
    hospital_id: uuid.UUID,
    hospital_in: HospitalUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    if not tenant_context.has_access_to(hospital_id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = result.scalar_one_or_none()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    update_data = hospital_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(hospital, field, value)
        
    await db.commit()
    await db.refresh(hospital)
    return hospital
