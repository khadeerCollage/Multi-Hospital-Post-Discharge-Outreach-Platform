from datetime import datetime, timedelta
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_tenant_context
from app.core.tenant import TenantContext
from app.models.campaign import Campaign
from app.models.patient import Patient
from app.models.encounter import Encounter
from app.models.outreach_task import OutreachTask
from app.models.hospital import Hospital
from app.services.priority_engine import calculate_priority_score
from app.services.scheduler import register_campaign, unregister_campaign
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignResponse, CampaignMetrics

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

@router.post("", response_model=CampaignResponse)
async def create_campaign(
    campaign_in: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    target_tenant_id = tenant_context.tenant_id or campaign_in.tenant_id
    if not target_tenant_id:
        h_res = await db.execute(select(Hospital.id).where(Hospital.status == 'active').limit(1))
        target_tenant_id = h_res.scalar_one_or_none()
    if not target_tenant_id:
        raise HTTPException(status_code=400, detail="Tenant context required")

    campaign_data = campaign_in.model_dump(exclude_unset=True)
    campaign_data["tenant_id"] = target_tenant_id
    campaign_data["status"] = "DRAFT"
    campaign_data["created_by"] = tenant_context.user_id

    # Default follow_up windows if omitted
    now_naive = datetime.utcnow()
    if not campaign_data.get("follow_up_window_start"):
        campaign_data["follow_up_window_start"] = now_naive
    elif campaign_data["follow_up_window_start"].tzinfo:
        campaign_data["follow_up_window_start"] = campaign_data["follow_up_window_start"].replace(tzinfo=None)

    if not campaign_data.get("follow_up_window_end"):
        campaign_data["follow_up_window_end"] = now_naive + timedelta(days=3)
    elif campaign_data["follow_up_window_end"].tzinfo:
        campaign_data["follow_up_window_end"] = campaign_data["follow_up_window_end"].replace(tzinfo=None)

    campaign = Campaign(**campaign_data)
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign

@router.get("", response_model=List[CampaignResponse])
async def list_campaigns(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    query = select(Campaign)
    if tenant_context.role != "platform_admin":
        query = query.where(Campaign.tenant_id == tenant_context.tenant_id)
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{id}", response_model=CampaignResponse)
async def get_campaign(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == id))
    campaign = result.scalar_one_or_none()
    
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    return campaign

@router.put("/{id}", response_model=CampaignResponse)
async def update_campaign(
    id: uuid.UUID,
    campaign_in: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == id))
    campaign = result.scalar_one_or_none()
    
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if campaign.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Can only update DRAFT campaigns")
        
    update_data = campaign_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(campaign, field, value)
        
    await db.commit()
    await db.refresh(campaign)
    return campaign

@router.post("/{id}/prepare")
async def prepare_campaign(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == id))
    campaign = result.scalar_one_or_none()
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Check if tasks already exist for this campaign
    existing_tasks_res = await db.execute(
        select(func.count(OutreachTask.id)).where(OutreachTask.campaign_id == id)
    )
    existing_count = existing_tasks_res.scalar() or 0
    
    if existing_count == 0:
        # Fetch patients for this hospital tenant with communication consent
        query = select(Patient).where(
            Patient.tenant_id == campaign.tenant_id,
            Patient.communication_consent == True
        )
        if campaign.target_risk_levels and len(campaign.target_risk_levels) > 0:
            query = query.where(Patient.risk_level.in_(campaign.target_risk_levels))
            
        patients_res = await db.execute(query)
        patients = patients_res.scalars().all()
        
        now = datetime.utcnow()
        created_tasks = []
        for p in patients:
            # Find patient's latest encounter
            enc_res = await db.execute(
                select(Encounter).where(
                    Encounter.patient_id == p.id
                ).order_by(Encounter.admission_date.desc()).limit(1)
            )
            encounter = enc_res.scalar_one_or_none()
            
            cutoff_hours = encounter.follow_up_window_hours if encounter and encounter.follow_up_window_hours else 72
            base_time = (encounter.discharge_date if encounter and encounter.discharge_date else now)
            clinical_cutoff = base_time + timedelta(hours=cutoff_hours)
            if clinical_cutoff < now:
                clinical_cutoff = now + timedelta(hours=24)
                
            priority_score = calculate_priority_score(
                risk_level=p.risk_level,
                clinical_cutoff_at=clinical_cutoff,
                campaign_start=campaign.created_at or now,
                campaign_priority_boost=campaign.priority_boost or 0.0,
                now=now
            )
            
            task = OutreachTask(
                tenant_id=campaign.tenant_id,
                campaign_id=campaign.id,
                patient_id=p.id,
                encounter_id=encounter.id if encounter else None,
                status="PENDING",
                priority_score=priority_score,
                max_retries=campaign.max_retries or 5,
                clinical_cutoff_at=clinical_cutoff,
                idempotency_key=f"{campaign.id}_{p.id}",
            )
            created_tasks.append(task)
            db.add(task)
            
        await db.flush()
        campaign.total_eligible = len(created_tasks)
    else:
        campaign.total_eligible = existing_count
        
    campaign.status = "READY"
    await db.commit()
    return {"message": f"Campaign prepared with {campaign.total_eligible} tasks", "total_eligible": campaign.total_eligible}

@router.post("/{id}/start")
async def start_campaign(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == id))
    campaign = result.scalar_one_or_none()
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    campaign.status = "RUNNING"
    campaign.started_at = datetime.utcnow()
    await db.commit()
    
    # Register with background scheduler
    register_campaign(str(campaign.id), str(campaign.tenant_id), str(campaign.tenant_id))
    return {"message": "Campaign started and registered with queue scheduler"}

@router.post("/{id}/pause")
async def pause_campaign(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == id))
    campaign = result.scalar_one_or_none()
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    campaign.status = "PAUSED"
    campaign.paused_at = datetime.utcnow()
    await db.commit()
    
    unregister_campaign(str(campaign.id))
    return {"message": "Campaign paused"}

@router.post("/{id}/resume")
async def resume_campaign(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    return await start_campaign(id, db, tenant_context)

@router.post("/{id}/cancel")
async def cancel_campaign(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == id))
    campaign = result.scalar_one_or_none()
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    campaign.status = "CANCELLED"
    await db.commit()
    
    unregister_campaign(str(campaign.id))
    return {"message": "Campaign cancelled"}

@router.get("/{id}/metrics", response_model=CampaignMetrics)
async def get_campaign_metrics(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == id))
    campaign = result.scalar_one_or_none()
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    return {
        "total_eligible": campaign.total_eligible,
        "total_completed": campaign.total_completed,
        "contact_rate": 0.0 if campaign.total_eligible == 0 else campaign.total_completed / campaign.total_eligible,
        "escalation_rate": 0.0 if campaign.total_completed == 0 else campaign.total_escalated / campaign.total_completed
    }

@router.get("/{id}/eligible-patients")
async def get_eligible_patients(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    return {"items": [], "total": 0}
