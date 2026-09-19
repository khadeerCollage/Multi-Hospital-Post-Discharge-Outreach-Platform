import uuid
from datetime import datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_tenant_context
from app.core.tenant import TenantContext
from app.models.escalation import Escalation
from app.models.patient import Patient
from app.models.campaign import Campaign
from app.models.call_record import CallRecord
from app.models.encounter import Encounter
from app.schemas.escalation import EscalationResponse, EscalationListResponse, EscalationResolve

router = APIRouter(prefix="/escalations", tags=["escalations"])

def _build_escalation_dict(
    esc: Escalation,
    patient: Optional[Patient] = None,
    campaign: Optional[Campaign] = None,
    call_record: Optional[CallRecord] = None,
    encounter: Optional[Encounter] = None
) -> dict:
    patient_name = f"{patient.first_name} {patient.last_name}".strip() if patient else None
    return {
        "id": esc.id,
        "tenant_id": esc.tenant_id,
        "patient_id": esc.patient_id,
        "campaign_id": esc.campaign_id,
        "call_record_id": esc.call_record_id,
        "trigger": esc.trigger,
        "clinical_indicators": esc.clinical_indicators or [],
        "triage_result": esc.triage_result or {},
        "consensus_result": esc.consensus_result or {},
        "priority": esc.priority,
        "status": esc.status,
        "assigned_to": esc.assigned_to,
        "resolution": esc.resolution,
        "resolution_notes": esc.resolution_notes,
        "resolved_at": esc.resolved_at,
        "resolved_by": esc.resolved_by,
        "acknowledged_at": esc.acknowledged_at,
        "created_at": esc.created_at,
        "updated_at": esc.updated_at,
        "patient_name": patient_name,
        "patient_mrn": patient.mrn if patient else None,
        "patient_phone": patient.phone if patient else None,
        "patient_risk_level": patient.risk_level if patient else None,
        "campaign_name": campaign.name if campaign else None,
        "encounter_diagnosis": encounter.primary_diagnosis if encounter else None,
        "procedure_name": getattr(encounter, "procedure_name", None) if encounter else None,
        "call_duration_seconds": call_record.duration_seconds if call_record else None,
        "call_started_at": call_record.start_time if call_record else None,
        "call_transcript": call_record.transcript if call_record else None,
        "soap_note": call_record.ai_outputs if call_record else None,
    }

@router.get("", response_model=EscalationListResponse)
async def list_escalations(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    query = (
        select(Escalation, Patient, Campaign)
        .outerjoin(Patient, Escalation.patient_id == Patient.id)
        .outerjoin(Campaign, Escalation.campaign_id == Campaign.id)
    )
    count_query = select(func.count(Escalation.id))
    
    if tenant_context.role != "platform_admin":
        query = query.where(Escalation.tenant_id == tenant_context.tenant_id)
        count_query = count_query.where(Escalation.tenant_id == tenant_context.tenant_id)
        
    if status:
        query = query.where(Escalation.status == status)
        count_query = count_query.where(Escalation.status == status)
        
    if priority:
        query = query.where(Escalation.priority == priority)
        count_query = count_query.where(Escalation.priority == priority)
        
    query = query.order_by(Escalation.created_at.desc())
    skip = (page - 1) * page_size
    query = query.offset(skip).limit(page_size)
    
    result = await db.execute(query)
    rows = result.all()
    
    count_result = await db.execute(count_query)
    total = count_result.scalar_one()

    items = [
        _build_escalation_dict(esc, patient, campaign)
        for esc, patient, campaign in rows
    ]
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/{id}", response_model=EscalationResponse)
async def get_escalation(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    query = (
        select(Escalation, Patient, Campaign, CallRecord)
        .outerjoin(Patient, Escalation.patient_id == Patient.id)
        .outerjoin(Campaign, Escalation.campaign_id == Campaign.id)
        .outerjoin(CallRecord, Escalation.call_record_id == CallRecord.id)
        .where(Escalation.id == id)
    )
    result = await db.execute(query)
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Escalation not found")
        
    esc, patient, campaign, call_record = row
    if not tenant_context.has_access_to(esc.tenant_id):
        raise HTTPException(status_code=404, detail="Escalation not found")
        
    encounter = None
    if patient:
        enc_res = await db.execute(
            select(Encounter)
            .where(Encounter.patient_id == patient.id)
            .order_by(Encounter.admission_date.desc())
            .limit(1)
        )
        encounter = enc_res.scalar_one_or_none()

    return _build_escalation_dict(esc, patient, campaign, call_record, encounter)

@router.put("/{id}/acknowledge")
async def acknowledge_escalation(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Escalation).where(Escalation.id == id))
    escalation = result.scalar_one_or_none()
    
    if not escalation or not tenant_context.has_access_to(escalation.tenant_id):
        raise HTTPException(status_code=404, detail="Escalation not found")
        
    now = datetime.utcnow()
    escalation.status = "ACKNOWLEDGED"
    escalation.acknowledged_at = now
    await db.commit()
    return {
        "message": "Escalation acknowledged",
        "id": str(id),
        "status": "ACKNOWLEDGED",
        "acknowledged_at": now.isoformat()
    }

@router.put("/{id}/resolve")
async def resolve_escalation(
    id: uuid.UUID,
    resolve_data: EscalationResolve,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Escalation).where(Escalation.id == id))
    escalation = result.scalar_one_or_none()
    
    if not escalation or not tenant_context.has_access_to(escalation.tenant_id):
        raise HTTPException(status_code=404, detail="Escalation not found")
        
    now = datetime.utcnow()
    escalation.status = "RESOLVED"
    escalation.resolution = resolve_data.resolution
    escalation.resolution_notes = resolve_data.resolution_notes
    escalation.resolved_by = tenant_context.user_id
    escalation.resolved_at = now
    await db.commit()
    return {
        "message": "Escalation resolved",
        "id": str(id),
        "status": "RESOLVED",
        "resolution": resolve_data.resolution,
        "resolution_notes": resolve_data.resolution_notes,
        "resolved_at": now.isoformat()
    }

@router.put("/{id}/assign")
async def assign_escalation(
    id: uuid.UUID,
    assigned_to: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Escalation).where(Escalation.id == id))
    escalation = result.scalar_one_or_none()
    
    if not escalation or not tenant_context.has_access_to(escalation.tenant_id):
        raise HTTPException(status_code=404, detail="Escalation not found")
        
    escalation.assigned_to = assigned_to
    await db.commit()
    return {"message": "Escalation assigned", "id": str(id), "assigned_to": str(assigned_to)}
