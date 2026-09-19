import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.core.database import get_db
from app.core.security import get_tenant_context
from app.core.tenant import TenantContext
from app.models.clinical_protocol import ClinicalProtocol
from app.models.hospital import Hospital
from app.schemas.protocol import ProtocolCreate, ProtocolUpdate, ProtocolResponse, ProtocolListResponse

router = APIRouter(prefix="/protocols", tags=["protocols"])

@router.get("", response_model=ProtocolListResponse)
async def list_protocols(
    condition_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    if not tenant_context.tenant_id and tenant_context.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    query = select(ClinicalProtocol, Hospital.name.label("hospital_name")).outerjoin(
        Hospital, ClinicalProtocol.tenant_id == Hospital.id
    )

    if tenant_context.role != "platform_admin":
        query = query.where(ClinicalProtocol.tenant_id == tenant_context.tenant_id)

    if condition_type:
        query = query.where(ClinicalProtocol.condition_type == condition_type)

    if is_active is not None:
        query = query.where(ClinicalProtocol.is_active == is_active)

    query = query.order_by(ClinicalProtocol.created_at.asc())
    result = await db.execute(query)
    rows = result.all()

    items = []
    for protocol, hosp_name in rows:
        p_dict = {c.name: getattr(protocol, c.name) for c in protocol.__table__.columns}
        p_dict["hospital_name"] = hosp_name or "Hospital"
        items.append(p_dict)

    return {
        "items": items,
        "total": len(items)
    }

@router.get("/{protocol_id}", response_model=ProtocolResponse)
async def get_protocol(
    protocol_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    query = select(ClinicalProtocol, Hospital.name.label("hospital_name")).outerjoin(
        Hospital, ClinicalProtocol.tenant_id == Hospital.id
    ).where(ClinicalProtocol.id == protocol_id)
    
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Protocol not found")

    protocol, hosp_name = row
    if not tenant_context.has_access_to(protocol.tenant_id):
        raise HTTPException(status_code=403, detail="Not authorized to access this hospital's protocol")

    p_dict = {c.name: getattr(protocol, c.name) for c in protocol.__table__.columns}
    p_dict["hospital_name"] = hosp_name or "Hospital"
    return p_dict

@router.post("", response_model=ProtocolResponse)
async def create_protocol(
    payload: ProtocolCreate,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    target_tenant_id = tenant_context.tenant_id
    if tenant_context.role == "platform_admin" and payload.tenant_id:
        target_tenant_id = payload.tenant_id

    if not target_tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID is required to create a protocol")

    protocol = ClinicalProtocol(
        tenant_id=target_tenant_id,
        name=payload.name,
        condition_type=payload.condition_type,
        description=payload.description or "",
        follow_up_questions=payload.follow_up_questions,
        red_flag_symptoms=payload.red_flag_symptoms,
        escalation_indicators=payload.escalation_indicators,
        approved_guidance=payload.approved_guidance or {},
        contact_window_hours=payload.contact_window_hours,
        priority_level=payload.priority_level,
        is_active=payload.is_active,
        version=payload.version or "1.0",
    )
    db.add(protocol)
    await db.commit()
    await db.refresh(protocol)

    hosp_res = await db.execute(select(Hospital.name).where(Hospital.id == target_tenant_id))
    hosp_name = hosp_res.scalar_one_or_none()

    p_dict = {c.name: getattr(protocol, c.name) for c in protocol.__table__.columns}
    p_dict["hospital_name"] = hosp_name or "Hospital"
    return p_dict

@router.put("/{protocol_id}", response_model=ProtocolResponse)
async def update_protocol(
    protocol_id: uuid.UUID,
    payload: ProtocolUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    query = select(ClinicalProtocol).where(ClinicalProtocol.id == protocol_id)
    result = await db.execute(query)
    protocol = result.scalar_one_or_none()

    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    if not tenant_context.has_access_to(protocol.tenant_id):
        raise HTTPException(status_code=403, detail="Not authorized to edit this hospital's protocol")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(protocol, field, val)

    # Automatically increment minor version if not explicitly passed
    if "version" not in update_data:
        try:
            cur_v = float(protocol.version or "1.0")
            protocol.version = f"{cur_v + 0.1:.1f}"
        except Exception:
            protocol.version = "1.1"

    await db.commit()
    await db.refresh(protocol)

    hosp_res = await db.execute(select(Hospital.name).where(Hospital.id == protocol.tenant_id))
    hosp_name = hosp_res.scalar_one_or_none()

    p_dict = {c.name: getattr(protocol, c.name) for c in protocol.__table__.columns}
    p_dict["hospital_name"] = hosp_name or "Hospital"
    return p_dict

@router.delete("/{protocol_id}")
async def delete_protocol(
    protocol_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    query = select(ClinicalProtocol).where(ClinicalProtocol.id == protocol_id)
    result = await db.execute(query)
    protocol = result.scalar_one_or_none()

    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")

    if not tenant_context.has_access_to(protocol.tenant_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(protocol)
    await db.commit()
    return {"status": "deleted", "id": str(protocol_id)}
