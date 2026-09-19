import uuid
from datetime import datetime, timedelta, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, delete

from app.core.database import get_db
from app.core.security import get_tenant_context
from app.core.tenant import TenantContext
from app.models.patient import Patient
from app.models.encounter import Encounter
from app.models.observation import Observation
from app.models.care_plan import CarePlan
from app.models.hospital import Hospital
from app.models.escalation import Escalation
from app.models.call_record import CallRecord
from app.models.outreach_task import OutreachTask
from app.models.communication import Communication
from app.schemas.patient import (
    PatientCreate,
    PatientUpdate,
    PatientResponse,
    PatientListResponse,
    PatientDetail,
)

router = APIRouter(prefix="/patients", tags=["patients"])

def format_encounter_dict(enc: Encounter) -> Optional[dict]:
    if not enc:
        return None
    return {
        "id": enc.id,
        "encounter_type": enc.encounter_type,
        "status": enc.status,
        "admission_date": enc.admission_date,
        "discharge_date": enc.discharge_date,
        "discharge_disposition": enc.discharge_disposition,
        "primary_diagnosis": enc.primary_diagnosis,
        "diagnosis_codes": enc.diagnosis_codes or [],
        "care_setting": enc.care_setting,
        "attending_physician": enc.attending_physician,
        "procedure_name": enc.procedure_name,
        "procedure_type": enc.procedure_type,
        "surgical_team": enc.surgical_team or [],
        "medical_checkup": enc.medical_checkup or {},
    }

@router.get("", response_model=PatientListResponse)
async def list_patients(
    risk_level: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    if not tenant_context.tenant_id and tenant_context.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    query = select(Patient)
    count_query = select(func.count(Patient.id))
    
    if tenant_context.role != "platform_admin":
        query = query.where(Patient.tenant_id == tenant_context.tenant_id)
        count_query = count_query.where(Patient.tenant_id == tenant_context.tenant_id)
        
    if risk_level:
        query = query.where(Patient.risk_level == risk_level)
        count_query = count_query.where(Patient.risk_level == risk_level)
        
    if search:
        search_filter = or_(
            Patient.first_name.ilike(f"%{search}%"),
            Patient.last_name.ilike(f"%{search}%"),
            Patient.mrn.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
        
    query = query.order_by(Patient.created_at.desc())
    skip = (page - 1) * page_size
    query = query.offset(skip).limit(page_size)
    
    result = await db.execute(query)
    patients = result.scalars().all()
    
    count_result = await db.execute(count_query)
    total = count_result.scalar_one()

    # Batch fetch latest encounter for each patient
    patient_ids = [p.id for p in patients]
    encounters_map = {}
    if patient_ids:
        enc_query = (
            select(Encounter)
            .where(Encounter.patient_id.in_(patient_ids))
            .order_by(Encounter.discharge_date.desc().nullslast(), Encounter.created_at.desc())
        )
        enc_res = await db.execute(enc_query)
        for enc in enc_res.scalars().all():
            if enc.patient_id not in encounters_map:
                encounters_map[enc.patient_id] = format_encounter_dict(enc)

    items = []
    for p in patients:
        p_dict = {c.name: getattr(p, c.name) for c in p.__table__.columns}
        p_dict["latest_encounter"] = encounters_map.get(p.id)
        items.append(p_dict)
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_in: PatientCreate,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    tenant_id = tenant_context.tenant_id
    if not tenant_id:
        if tenant_context.role == "platform_admin":
            hosp_res = await db.execute(select(Hospital.id).order_by(Hospital.created_at.asc()).limit(1))
            tenant_id = hosp_res.scalar_one_or_none()
        if not tenant_id:
            raise HTTPException(status_code=400, detail="No active hospital exists to associate this patient with.")

    # Check for MRN collision within tenant
    clean_mrn = patient_in.mrn.strip().upper()
    existing = await db.execute(
        select(Patient).where(
            Patient.tenant_id == tenant_id,
            Patient.mrn == clean_mrn
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"A patient with MRN '{clean_mrn}' is already registered in this hospital facility."
        )

    # 1. Create Patient entity
    new_patient = Patient(
        tenant_id=tenant_id,
        mrn=clean_mrn,
        first_name=patient_in.first_name.strip(),
        last_name=patient_in.last_name.strip(),
        date_of_birth=patient_in.date_of_birth,
        gender=patient_in.gender.strip().lower(),
        phone=patient_in.phone.strip(),
        email=patient_in.email.strip() if patient_in.email else None,
        address=patient_in.address.strip() if patient_in.address else None,
        risk_level=patient_in.risk_level.lower(),
        communication_consent=patient_in.communication_consent,
        preferred_language=patient_in.preferred_language or "en",
    )
    db.add(new_patient)
    await db.flush()

    # 2. Create Initial Encounter for Post-Discharge Outreach
    discharge_dt = patient_in.discharge_date or datetime.utcnow()
    if discharge_dt and hasattr(discharge_dt, "tzinfo") and discharge_dt.tzinfo is not None:
        discharge_dt = discharge_dt.replace(tzinfo=None)
    admission_dt = discharge_dt - timedelta(days=2) if discharge_dt else datetime.utcnow() - timedelta(days=2)
    if admission_dt and hasattr(admission_dt, "tzinfo") and admission_dt.tzinfo is not None:
        admission_dt = admission_dt.replace(tzinfo=None)
    proc_name = patient_in.procedure_name or patient_in.primary_diagnosis or "General Surgical Care"
    doctor_name = patient_in.attending_physician or "Staff Attending, MD"

    encounter = Encounter(
        tenant_id=tenant_id,
        patient_id=new_patient.id,
        encounter_type="inpatient",
        status="discharged",
        admission_date=admission_dt,
        discharge_date=discharge_dt,
        discharge_disposition="home",
        primary_diagnosis=patient_in.primary_diagnosis or proc_name,
        diagnosis_codes=["Z48.81", "Z98.89"],
        care_setting="inpatient_surgical",
        attending_physician=doctor_name,
        procedure_name=proc_name,
        procedure_type="Post-Operative",
        surgical_team=[
            {"name": doctor_name, "role": "Lead Attending", "specialty": "Clinical Surgery"}
        ],
        medical_checkup={
            "discharge_vitals": {
                "blood_pressure": "120/80 mmHg",
                "heart_rate": "72 bpm",
                "temperature": "98.6 °F",
                "spo2": "99% on room air"
            },
            "incisions": "Clean, dry, intact",
            "mobility": "Ambulatory"
        },
        discharge_instructions="Follow standard post-operative wound care instructions and monitor for red flag symptoms.",
        follow_up_required=True,
        follow_up_window_hours=72,
    )
    db.add(encounter)
    await db.flush()

    # 3. Create initial CarePlan
    care_plan = CarePlan(
        tenant_id=tenant_id,
        patient_id=new_patient.id,
        encounter_id=encounter.id,
        status="active",
        instructions={"activity": "Light mobility, avoid heavy lifting > 10 lbs", "wound_care": "Keep incision clean and dry"},
        medications=[
            {"name": "Prescribed Antibiotic / Pain Management", "dosage": "As directed", "frequency": "Every 8 hours PRN"}
        ],
        follow_up_appointments=[
            {
                "date": (discharge_dt + timedelta(days=7)).strftime("%Y-%m-%d"),
                "provider": doctor_name,
                "location": "Surgical Outpatient Clinic"
            }
        ]
    )
    db.add(care_plan)

    # Pre-extract attributes before commit to avoid MissingGreenlet
    patient_dict = {c.name: getattr(new_patient, c.name) for c in new_patient.__table__.columns}
    patient_dict["latest_encounter"] = format_encounter_dict(encounter)

    await db.commit()
    return patient_dict

@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: uuid.UUID,
    patient_in: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not tenant_context.has_access_to(patient.tenant_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = patient_in.model_dump(exclude_unset=True)
    
    # Extract clinical encounter updates if any
    clinical_fields = ["primary_diagnosis", "procedure_name", "attending_physician"]
    clinical_updates = {f: update_data.pop(f) for f in clinical_fields if f in update_data}

    for field, val in update_data.items():
        if val is not None:
            if isinstance(val, str):
                val = val.strip()
            setattr(patient, field, val)
    patient.updated_at = datetime.utcnow()

    # Update latest encounter if clinical fields provided
    latest_enc = None
    enc_res = await db.execute(
        select(Encounter)
        .where(Encounter.patient_id == patient_id)
        .order_by(Encounter.discharge_date.desc().nullslast(), Encounter.created_at.desc())
        .limit(1)
    )
    latest_enc = enc_res.scalar_one_or_none()

    if clinical_updates:
        if latest_enc:
            for cf, cv in clinical_updates.items():
                if cv:
                    setattr(latest_enc, cf, cv.strip())
            if "attending_physician" in clinical_updates and clinical_updates["attending_physician"]:
                doc = clinical_updates["attending_physician"].strip()
                latest_enc.surgical_team = [{"name": doc, "role": "Lead Physician", "specialty": "Clinical Care"}]
        else:
            latest_enc = Encounter(
                tenant_id=patient.tenant_id,
                patient_id=patient.id,
                encounter_type="inpatient",
                status="discharged",
                admission_date=datetime.utcnow() - timedelta(days=2),
                discharge_date=datetime.utcnow(),
                discharge_disposition="home",
                primary_diagnosis=clinical_updates.get("primary_diagnosis") or "General Surgical Follow-Up",
                care_setting="inpatient_surgical",
                attending_physician=clinical_updates.get("attending_physician") or "Staff Physician",
                procedure_name=clinical_updates.get("procedure_name") or "Surgical Intervention",
                procedure_type="Post-Operative",
                surgical_team=[{"name": clinical_updates.get("attending_physician") or "Staff Physician", "role": "Lead Doctor", "specialty": "Clinical Care"}],
                follow_up_required=True,
                follow_up_window_hours=72
            )
            db.add(latest_enc)
            await db.flush()

    # Pre-extract attributes before commit
    patient_dict = {c.name: getattr(patient, c.name) for c in patient.__table__.columns}
    patient_dict["latest_encounter"] = format_encounter_dict(latest_enc) if latest_enc else None

    await db.commit()
    return patient_dict

@router.delete("/{patient_id}")
async def delete_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not tenant_context.has_access_to(patient.tenant_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    mrn = patient.mrn
    name = f"{patient.first_name} {patient.last_name}"

    # Cascading deletion of all dependent records
    # 1. Escalations
    await db.execute(delete(Escalation).where(Escalation.patient_id == patient_id))
    # 2. CallRecords
    await db.execute(delete(CallRecord).where(CallRecord.patient_id == patient_id))
    # 3. OutreachTasks
    await db.execute(delete(OutreachTask).where(OutreachTask.patient_id == patient_id))
    # 4. Observations
    await db.execute(delete(Observation).where(Observation.patient_id == patient_id))
    # 5. CarePlans
    await db.execute(delete(CarePlan).where(CarePlan.patient_id == patient_id))
    # 6. Communications
    await db.execute(delete(Communication).where(Communication.patient_id == patient_id))
    # 7. Encounters
    await db.execute(delete(Encounter).where(Encounter.patient_id == patient_id))
    # 8. Patient record
    await db.execute(delete(Patient).where(Patient.id == patient_id))

    await db.commit()
    return {
        "success": True,
        "message": f"Patient '{name}' (MRN: {mrn}) and all associated clinical records have been deleted.",
        "patient_id": str(patient_id)
    }

@router.get("/{patient_id}", response_model=PatientDetail)
async def get_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    if not tenant_context.has_access_to(patient.tenant_id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    encounters_result = await db.execute(
        select(Encounter)
        .where(Encounter.patient_id == patient_id)
        .order_by(Encounter.discharge_date.desc().nullslast(), Encounter.created_at.desc())
    )
    encounters = encounters_result.scalars().all()
    
    observations_result = await db.execute(select(Observation).where(Observation.patient_id == patient_id))
    observations = observations_result.scalars().all()

    care_plans_result = await db.execute(select(CarePlan).where(CarePlan.patient_id == patient_id))
    care_plans = care_plans_result.scalars().all()
    
    patient_dict = {
        c.name: getattr(patient, c.name) for c in patient.__table__.columns
    }
    
    formatted_encounters = [
        {
            "id": str(e.id),
            "encounter_type": e.encounter_type,
            "status": e.status,
            "admission_date": e.admission_date.isoformat() if e.admission_date else None,
            "discharge_date": e.discharge_date.isoformat() if e.discharge_date else None,
            "discharge_disposition": e.discharge_disposition,
            "primary_diagnosis": e.primary_diagnosis,
            "diagnosis_codes": e.diagnosis_codes or [],
            "care_setting": e.care_setting,
            "attending_physician": e.attending_physician,
            "procedure_name": e.procedure_name,
            "procedure_type": e.procedure_type,
            "surgical_team": e.surgical_team or [],
            "medical_checkup": e.medical_checkup or {},
            "discharge_instructions": e.discharge_instructions,
            "follow_up_window_hours": e.follow_up_window_hours,
        }
        for e in encounters
    ]
    
    patient_dict["encounters"] = formatted_encounters
    patient_dict["latest_encounter"] = formatted_encounters[0] if formatted_encounters else None
    patient_dict["observations"] = [
        {
            "id": str(o.id),
            "code": o.code,
            "display": o.display,
            "value_string": o.value_string,
            "value_numeric": o.value_numeric,
            "unit": o.unit,
            "interpretation": o.interpretation,
            "recorded_at": o.recorded_at.isoformat() if o.recorded_at else None,
        }
        for o in observations
    ]
    patient_dict["care_plans"] = [
        {
            "id": str(cp.id),
            "status": cp.status,
            "instructions": cp.instructions or {},
            "medications": cp.medications or [],
            "follow_up_appointments": cp.follow_up_appointments or [],
            "diet_restrictions": cp.diet_restrictions,
            "activity_restrictions": cp.activity_restrictions,
        }
        for cp in care_plans
    ]
    
    return patient_dict

@router.get("/{patient_id}/timeline")
async def get_patient_timeline(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    
    if not patient or not tenant_context.has_access_to(patient.tenant_id):
        raise HTTPException(status_code=404, detail="Patient not found")
        
    return {"timeline": []}
