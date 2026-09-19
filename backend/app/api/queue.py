from datetime import datetime, timedelta
from typing import Optional, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.core.security import get_tenant_context
from app.core.tenant import TenantContext
from app.models.campaign import Campaign
from app.models.patient import Patient
from app.models.encounter import Encounter
from app.models.outreach_task import OutreachTask
from app.models.call_record import CallRecord
from app.models.escalation import Escalation
from app.models.clinical_protocol import ClinicalProtocol
from app.models.hospital import Hospital
from app.services.queue_engine import get_queue_metrics, get_queue_tasks, release_task
from app.services.concurrency_manager import get_capacity, get_remaining_capacity
from app.services.priority_engine import calculate_priority_score
from app.agents.graph import run_outreach_pipeline

router = APIRouter(prefix="/queue", tags=["queue"])



class SimulateCallRequest(BaseModel):
    patient_id: Optional[uuid.UUID] = None
    scenario_type: str = "emergency"  # "emergency" | "urgent" | "routine"


class SimulateBatchRequest(BaseModel):
    scenario_type: str = "mixed"   # "mixed" | "emergency" | "urgent" | "routine"
    batch_size: int = 10           # How many patients in this batch (max 10)
    batch_offset: int = 0          # Which batch number (0 = first batch of top-priority patients)



@router.get("/{campaign_id}/status")
async def get_queue_status(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")

    metrics = await get_queue_metrics(db, str(campaign_id))
    
    tenant_id_str = str(campaign.tenant_id)
    cap_total = get_capacity(tenant_id_str)
    cap_rem = get_remaining_capacity(tenant_id_str)
    cap_in_use = max(0, cap_total - cap_rem)

    return {
        "metrics": {
            "pending": metrics.get("pending", 0),
            "calling": metrics.get("calling", 0),
            "retrying": metrics.get("retrying", 0),
            "completed": metrics.get("completed", 0),
            "escalated": metrics.get("escalated", 0),
            "failed": metrics.get("failed", 0),
        },
        "capacity_total": cap_total,
        "capacity_in_use": cap_in_use,
        "active_calls": metrics.get("active_calls", 0),
        "scheduled": metrics.get("scheduled", 0),
        "callbacks": metrics.get("callbacks", 0),
        "manual_follow_up": metrics.get("manual_follow_up", 0),
        "total": metrics.get("total", 0),
        "completion_rate": metrics.get("completion_rate", 0),
        "contact_rate": metrics.get("contact_rate", 0),
        "escalation_rate": metrics.get("escalation_rate", 0),
        "avg_attempts": metrics.get("avg_attempts", 0),
    }


@router.get("/{campaign_id}/tasks")
async def list_queue_tasks(
    campaign_id: uuid.UUID,
    status: Optional[str] = None,
    sort: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")

    tasks_data = await get_queue_tasks(db, str(campaign_id), status=status, page=page, page_size=page_size)
    return tasks_data


@router.post("/{campaign_id}/reprioritize")
async def reprioritize_queue(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")

    tasks_res = await db.execute(
        select(OutreachTask).where(
            OutreachTask.campaign_id == campaign_id,
            OutreachTask.status == "PENDING"
        )
    )
    tasks = tasks_res.scalars().all()
    now = datetime.utcnow()

    for task in tasks:
        p_res = await db.execute(select(Patient).where(Patient.id == task.patient_id))
        patient = p_res.scalar_one_or_none()
        if patient:
            task.priority_score = calculate_priority_score(
                risk_level=patient.risk_level,
                clinical_cutoff_at=task.clinical_cutoff_at,
                campaign_start=campaign.created_at or now,
                attempt_count=task.attempt_count,
                waiting_since=task.created_at,
                campaign_priority_boost=campaign.priority_boost or 0.0,
                now=now
            )

    await db.commit()
    return {"message": f"Reprioritized {len(tasks)} tasks", "count": len(tasks)}


@router.post("/{campaign_id}/simulate-call")
async def simulate_single_call(
    campaign_id: uuid.UUID,
    request: SimulateCallRequest = SimulateCallRequest(),
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")

    patient = None
    task = None

    if request.patient_id:
        p_res = await db.execute(
            select(Patient).where(
                Patient.id == request.patient_id,
                Patient.tenant_id == campaign.tenant_id
            )
        )
        patient = p_res.scalar_one_or_none()
        if patient:
            t_res = await db.execute(
                select(OutreachTask).where(
                    OutreachTask.campaign_id == campaign_id,
                    OutreachTask.patient_id == patient.id
                )
            )
            task = t_res.scalar_one_or_none()

    if not patient:
        t_res = await db.execute(
            select(OutreachTask).where(
                OutreachTask.campaign_id == campaign_id
            ).order_by(OutreachTask.priority_score.desc()).limit(1)
        )
        task = t_res.scalar_one_or_none()
        if task:
            p_res = await db.execute(select(Patient).where(Patient.id == task.patient_id))
            patient = p_res.scalar_one_or_none()

    if not patient:
        p_res = await db.execute(
            select(Patient).where(
                Patient.tenant_id == campaign.tenant_id
            ).limit(1)
        )
        patient = p_res.scalar_one_or_none()

    if not patient:
        raise HTTPException(status_code=400, detail="No eligible patient found for simulation")

    now = datetime.utcnow()
    if not task:
        task = OutreachTask(
            tenant_id=campaign.tenant_id,
            campaign_id=campaign.id,
            patient_id=patient.id,
            status="PENDING",
            priority_score=100.0,
            clinical_cutoff_at=now + timedelta(hours=72),
            idempotency_key=f"sim_{campaign.id}_{patient.id}_{uuid.uuid4().hex[:6]}",
        )
        db.add(task)
        await db.flush()

    enc_res = await db.execute(
        select(Encounter).where(
            Encounter.patient_id == patient.id
        ).order_by(Encounter.admission_date.desc()).limit(1)
    )
    encounter = enc_res.scalar_one_or_none()

    hosp_res = await db.execute(select(Hospital).where(Hospital.id == campaign.tenant_id))
    hospital = hosp_res.scalar_one_or_none()
    hospital_name = hospital.name if hospital else "CareReach Hospital"

    proto_res = await db.execute(
        select(ClinicalProtocol).where(
            ClinicalProtocol.tenant_id == campaign.tenant_id,
            ClinicalProtocol.is_active == True
        ).limit(1)
    )
    protocol = proto_res.scalar_one_or_none()

    protocol_context = {}
    if protocol:
        protocol_context = {
            "follow_up_questions": protocol.follow_up_questions or [],
            "red_flag_symptoms": protocol.red_flag_symptoms or [],
            "escalation_indicators": protocol.escalation_indicators or [],
            "approved_guidance": protocol.approved_guidance or [],
        }
    else:
        protocol_context = {
            "follow_up_questions": [
                "How are you feeling since being discharged?",
                "Are you experiencing any new or worsening symptoms?",
                "Are you taking your prescribed medications on schedule?",
                "Do you have any questions about your care instructions?",
            ],
            "red_flag_symptoms": [
                "Severe chest pain",
                "Difficulty breathing or shortness of breath",
                "High fever (> 101°F / 38.3°C)",
                "Uncontrolled wound bleeding or purulent drainage",
                "Signs of stroke (sudden weakness, facial droop)",
                "Severe dizziness or loss of consciousness",
            ],
            "escalation_indicators": [
                "Patient reports any red-flag symptom",
                "Patient expresses severe acute pain",
                "Patient confused or disoriented",
            ],
            "approved_guidance": [
                "Follow post-operative discharge instructions",
                "Take medications strictly as prescribed",
                "Contact clinical team immediately if red-flag symptoms occur",
            ],
        }

    age_years = (now.date() - patient.date_of_birth).days // 365 if patient.date_of_birth else 65
    patient_context = {
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "age": str(age_years),
        "gender": patient.gender,
        "risk_level": patient.risk_level,
        "primary_diagnosis": encounter.primary_diagnosis if encounter else "Post-Operative Recovery",
        "discharge_date": encounter.discharge_date.strftime("%B %d, %Y") if encounter and encounter.discharge_date else "recently",
        "procedure_name": encounter.procedure_name if encounter and encounter.procedure_name else "Surgical Procedure",
        "attending_physician": encounter.attending_physician if encounter else "Dr. Attending",
        "medications": [],
        "care_plan": {},
    }

    scenario = request.scenario_type.lower()
    if "emergency" in scenario or "cardiac" in scenario or "red_flag" in scenario:
        simulated_responses = [
            f"Yes, this is {patient.first_name}. What is this regarding?",
            "I'm not doing well at all. I woke up with severe, crushing chest pain that radiates into my left shoulder and arm. I'm also having trouble catching my breath and I'm sweating heavily.",
            "The pain started about two hours ago and it's getting worse. It is a 9 out of 10. I am feeling dizzy and nauseous."
        ]
    elif "urgent" in scenario or "wound" in scenario or "infection" in scenario:
        simulated_responses = [
            f"Hello, yes speaking.",
            "I've been having concerns since yesterday. My surgical wound is throbbing, very red, swollen, and looks like there is yellowish pus leaking out. My thermometer shows 101.6 degrees.",
            "I took Tylenol but the fever hasn't dropped. I feel very weak and shaky when I try to stand."
        ]
    else:
        simulated_responses = [
            f"Hi, yes this is {patient.first_name}.",
            "I am doing really well, thank you! The incision is healing nicely with just a little mild tenderness. I've been taking my medications on time and walking around without issues.",
            "No fever or concerns at all. Thank you so much for calling to check in on me."
        ]

    call_id = uuid.uuid4()
    task.status = "CALLING"
    task.last_attempt_at = now
    call_record = CallRecord(
        id=call_id,
        tenant_id=campaign.tenant_id,
        task_id=task.id,
        campaign_id=campaign.id,
        patient_id=patient.id,
        attempt_number=task.attempt_count + 1,
        status="CONNECTED",
        start_time=now,
    )
    db.add(call_record)
    await db.commit()

    pipeline_result = await run_outreach_pipeline(
        tenant_id=str(campaign.tenant_id),
        patient_id=str(patient.id),
        campaign_id=str(campaign.id),
        call_attempt_id=str(call_id),
        patient_context=patient_context,
        protocol_context=protocol_context,
        hospital_name=hospital_name,
        simulated_patient_responses=simulated_responses,
        encounter_id=str(encounter.id) if encounter else None,
    )

    call_outcome = pipeline_result.get("call_outcome", "COMPLETED")
    end_time = datetime.utcnow()
    duration = int((end_time - now).total_seconds())

    call_record.status = "COMPLETED"
    call_record.end_time = end_time
    call_record.duration_seconds = max(duration, 45)
    call_record.outcome = call_outcome
    call_record.transcript = pipeline_result.get("conversation", [])
    call_record.ai_outputs = pipeline_result.get("documentation", {})
    call_record.triage_result = pipeline_result.get("triage_result", {})
    call_record.escalation_decision = pipeline_result.get("consensus_decision", {})
    call_record.documentation_status = "completed"

    task.status = call_outcome
    task.call_outcome = call_outcome
    task.last_attempt_at = end_time
    task.attempt_count += 1
    task.call_duration_seconds = call_record.duration_seconds

    if call_outcome == "ESCALATED":
        campaign.total_escalated = (campaign.total_escalated or 0) + 1
    else:
        campaign.total_completed = (campaign.total_completed or 0) + 1

    escalation_id = None
    if call_outcome == "ESCALATED":
        escalation_id = uuid.uuid4()
        consensus = pipeline_result.get("consensus_decision", {})
        triage = pipeline_result.get("triage_result", {})
        priority = "critical" if triage.get("status") == "urgent" or "emergency" in scenario else "high"

        escalation = Escalation(
            id=escalation_id,
            tenant_id=campaign.tenant_id,
            patient_id=patient.id,
            campaign_id=campaign.id,
            call_record_id=call_id,
            trigger=consensus.get("reason", "AI Multi-Agent Escalation Flag"),
            clinical_indicators=pipeline_result.get("extracted_symptoms", []),
            triage_result=triage,
            consensus_result=consensus,
            priority=priority,
            status="OPEN",
            created_at=now,
            updated_at=now,
        )
        db.add(escalation)

    await db.commit()

    return {
        "success": True,
        "call_id": str(call_id),
        "task_id": str(task.id),
        "patient_id": str(patient.id),
        "patient_name": f"{patient.first_name} {patient.last_name}",
        "mrn": patient.mrn or "MRN-UNKNOWN",
        "patient_mrn": patient.mrn or "MRN-UNKNOWN",
        "patient_risk_level": patient.risk_level,
        "procedure_name": patient_context.get("procedure_name"),
        "scenario_type": scenario,
        "call_outcome": call_outcome,
        "duration_seconds": call_record.duration_seconds,
        "conversation": pipeline_result.get("conversation", []),
        "extracted_symptoms": pipeline_result.get("extracted_symptoms", []),
        "triage_result": pipeline_result.get("triage_result", {}),
        "escalation_votes": pipeline_result.get("escalation_votes", []),
        "consensus_decision": pipeline_result.get("consensus_decision", {}),
        "documentation": pipeline_result.get("documentation", {}),
        "escalation_id": str(escalation_id) if escalation_id else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# BATCH SIMULATION — Process up to 10 patients in one request.
# Simulates how the real scheduler dispatches batches of calls based on
# priority score. Each patient in the batch gets a full AI pipeline run.
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/{campaign_id}/simulate-batch")
async def simulate_batch_calls(
    campaign_id: uuid.UUID,
    request: SimulateBatchRequest = SimulateBatchRequest(),
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context),
):
    """
    Simulate a full batch of up to 10 outreach calls, ordered by priority score.
    Returns results for each patient including transcript, symptoms, escalation status.
    This mirrors how the real scheduler processes patients in batches of max_concurrent_calls.
    """
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign or not tenant_context.has_access_to(campaign.tenant_id):
        raise HTTPException(status_code=404, detail="Campaign not found")

    batch_size = min(max(request.batch_size, 1), 10)
    offset = max(request.batch_offset, 0) * batch_size

    # Load hospital & protocol once for the whole batch
    hosp_res = await db.execute(select(Hospital).where(Hospital.id == campaign.tenant_id))
    hospital = hosp_res.scalar_one_or_none()
    hospital_name = hospital.name if hospital else "CareReach Hospital"

    proto_res = await db.execute(
        select(ClinicalProtocol).where(
            ClinicalProtocol.tenant_id == campaign.tenant_id,
            ClinicalProtocol.is_active == True
        ).limit(1)
    )
    protocol = proto_res.scalar_one_or_none()

    default_protocol = {
        "follow_up_questions": [
            "How are you feeling since being discharged?",
            "Are you experiencing any new or worsening symptoms?",
            "Are you taking your prescribed medications on schedule?",
            "Do you have any questions about your care instructions?",
        ],
        "red_flag_symptoms": [
            "Severe chest pain",
            "Difficulty breathing or shortness of breath",
            "High fever (> 101°F / 38.3°C)",
            "Uncontrolled wound bleeding or purulent drainage",
            "Signs of stroke (sudden weakness, facial droop)",
        ],
        "escalation_indicators": [
            "Patient reports any red-flag symptom",
            "Patient expresses severe acute pain",
        ],
        "approved_guidance": [
            "Follow post-operative discharge instructions",
            "Take medications strictly as prescribed",
        ],
    }
    protocol_context = {
        "follow_up_questions": protocol.follow_up_questions if protocol else default_protocol["follow_up_questions"],
        "red_flag_symptoms": protocol.red_flag_symptoms if protocol else default_protocol["red_flag_symptoms"],
        "escalation_indicators": protocol.escalation_indicators if protocol else default_protocol["escalation_indicators"],
        "approved_guidance": protocol.approved_guidance if protocol else default_protocol["approved_guidance"],
    }

    # Fetch top-priority patients for this batch window
    tasks_res = await db.execute(
        select(OutreachTask).where(
            OutreachTask.campaign_id == campaign_id
        ).order_by(OutreachTask.priority_score.desc()).limit(batch_size).offset(offset)
    )
    batch_tasks = tasks_res.scalars().all()

    if not batch_tasks:
        # Fallback: grab any patients from the hospital
        patients_res = await db.execute(
            select(Patient).where(Patient.tenant_id == campaign.tenant_id).limit(batch_size)
        )
        fallback_patients = patients_res.scalars().all()
        now = datetime.utcnow()
        batch_tasks = []
        for p in fallback_patients:
            t = OutreachTask(
                tenant_id=campaign.tenant_id,
                campaign_id=campaign.id,
                patient_id=p.id,
                status="PENDING",
                priority_score=50.0,
                clinical_cutoff_at=now + timedelta(hours=72),
                idempotency_key=f"batch_sim_{campaign.id}_{p.id}_{uuid.uuid4().hex[:4]}",
            )
            db.add(t)
            batch_tasks.append(t)
        await db.flush()

    # Process each patient in the batch
    batch_results = []
    now = datetime.utcnow()

    # Scenario assignment for mixed batches — distribute across real-world scenarios
    SCENARIOS = {
        "emergency": ["emergency", "urgent", "routine", "routine", "routine",
                      "urgent", "routine", "routine", "emergency", "routine"],
        "urgent":    ["urgent"] * 10,
        "routine":   ["routine"] * 10,
        "mixed":     ["emergency", "urgent", "routine", "routine", "urgent",
                      "routine", "routine", "emergency", "routine", "urgent"],
    }
    scenario_key = request.scenario_type.lower()
    if scenario_key not in SCENARIOS:
        scenario_key = "mixed"
    scenario_list = SCENARIOS[scenario_key]

    for slot_idx, task in enumerate(batch_tasks):
        patient_res = await db.execute(select(Patient).where(Patient.id == task.patient_id))
        patient = patient_res.scalar_one_or_none()
        if not patient:
            continue

        enc_res = await db.execute(
            select(Encounter).where(Encounter.patient_id == patient.id)
            .order_by(Encounter.admission_date.desc()).limit(1)
        )
        encounter = enc_res.scalar_one_or_none()

        age_years = (now.date() - patient.date_of_birth).days // 365 if patient.date_of_birth else 65
        patient_context = {
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "age": str(age_years),
            "gender": patient.gender,
            "risk_level": patient.risk_level,
            "primary_diagnosis": encounter.primary_diagnosis if encounter else "Post-Operative Recovery",
            "discharge_date": encounter.discharge_date.strftime("%B %d, %Y") if encounter and encounter.discharge_date else "recently",
            "procedure_name": getattr(encounter, "procedure_name", None) if encounter else "Surgical Procedure",
            "attending_physician": encounter.attending_physician if encounter else "Dr. Attending",
            "medications": [],
            "care_plan": {},
        }

        # Assign scenario for this slot
        slot_scenario = scenario_list[slot_idx % len(scenario_list)]
        # Override: critical/high risk patients always get more urgent scenario
        if patient.risk_level in ("critical",) and slot_scenario == "routine":
            slot_scenario = "urgent"

        if "emergency" in slot_scenario:
            simulated_responses = [
                f"Yes, this is {patient.first_name}.",
                "I woke up with severe crushing chest pain radiating to my left arm. I cannot breathe properly. I am sweating heavily.",
                "The pain is 9 out of 10 and getting worse. I feel very dizzy.",
            ]
        elif "urgent" in slot_scenario:
            simulated_responses = [
                f"Hello, yes this is {patient.first_name}.",
                "My surgical wound has been throbbing all morning, it looks very red and swollen. My thermometer shows 101.8 degrees.",
                "I took Tylenol but the fever is not going down and I feel very weak.",
            ]
        else:
            simulated_responses = [
                f"Hi yes, {patient.first_name} speaking.",
                "I am doing well, thank you! The incision is healing nicely. I have been taking my medications on time.",
                "No fever, no issues. Just a little tired but that is expected. Thank you for calling!",
            ]

        # Create call record
        call_id = uuid.uuid4()
        call_record = CallRecord(
            id=call_id,
            tenant_id=campaign.tenant_id,
            task_id=task.id,
            campaign_id=campaign.id,
            patient_id=patient.id,
            attempt_number=task.attempt_count + 1,
            status="CONNECTED",
            start_time=now,
        )
        db.add(call_record)
        await db.commit()

        pipeline_result = await run_outreach_pipeline(
            tenant_id=str(campaign.tenant_id),
            patient_id=str(patient.id),
            campaign_id=str(campaign.id),
            call_attempt_id=str(call_id),
            patient_context=patient_context,
            protocol_context=protocol_context,
            hospital_name=hospital_name,
            simulated_patient_responses=simulated_responses,
            encounter_id=str(encounter.id) if encounter else None,
        )

        call_outcome = pipeline_result.get("call_outcome", "COMPLETED")
        end_time = datetime.utcnow()
        duration = max(int((end_time - now).total_seconds()), 30)

        call_record.status = "COMPLETED"
        call_record.end_time = end_time
        call_record.duration_seconds = duration
        call_record.outcome = call_outcome
        call_record.transcript = pipeline_result.get("conversation", [])
        call_record.ai_outputs = pipeline_result.get("documentation", {})
        call_record.triage_result = pipeline_result.get("triage_result", {})
        call_record.escalation_decision = pipeline_result.get("consensus_decision", {})
        call_record.documentation_status = "completed"

        task.status = call_outcome
        task.call_outcome = call_outcome
        task.last_attempt_at = end_time
        task.attempt_count += 1
        task.call_duration_seconds = duration

        escalation_id = None
        if call_outcome == "ESCALATED":
            escalation_id = uuid.uuid4()
            consensus = pipeline_result.get("consensus_decision", {})
            triage = pipeline_result.get("triage_result", {})
            priority = "critical" if slot_scenario == "emergency" else "high"
            escalation = Escalation(
                id=escalation_id,
                tenant_id=campaign.tenant_id,
                patient_id=patient.id,
                campaign_id=campaign.id,
                call_record_id=call_id,
                trigger=consensus.get("reason", "AI Multi-Agent Escalation Flag"),
                clinical_indicators=pipeline_result.get("extracted_symptoms", []),
                triage_result=triage,
                consensus_result=consensus,
                priority=priority,
                status="OPEN",
                created_at=now,
                updated_at=now,
            )
            db.add(escalation)

        await db.commit()

        batch_results.append({
            "slot": slot_idx + 1,
            "patient_id": str(patient.id),
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "patient_risk_level": patient.risk_level,
            "mrn": patient.mrn,
            "age": age_years,
            "gender": patient.gender,
            "primary_diagnosis": patient_context.get("primary_diagnosis"),
            "procedure_name": patient_context.get("procedure_name"),
            "attending_physician": patient_context.get("attending_physician"),
            "discharge_date": patient_context.get("discharge_date"),
            "priority_score": float(task.priority_score or 0),
            "scenario_type": slot_scenario,
            "call_outcome": call_outcome,
            "duration_seconds": duration,
            "conversation": pipeline_result.get("conversation", []),
            "extracted_symptoms": pipeline_result.get("extracted_symptoms", []),
            "triage_result": pipeline_result.get("triage_result", {}),
            "escalation_votes": pipeline_result.get("escalation_votes", []),
            "consensus_decision": pipeline_result.get("consensus_decision", {}),
            "documentation": pipeline_result.get("documentation", {}),
            "escalation_id": str(escalation_id) if escalation_id else None,
            "call_id": str(call_id),
        })

    escalated_count = sum(1 for r in batch_results if r["call_outcome"] == "ESCALATED")
    completed_count = sum(1 for r in batch_results if r["call_outcome"] in ("COMPLETED", "ROUTINE"))

    campaign.total_completed = (campaign.total_completed or 0) + completed_count
    campaign.total_escalated = (campaign.total_escalated or 0) + escalated_count
    await db.commit()

    return {
        "success": True,
        "batch_number": request.batch_offset + 1,
        "batch_size": batch_size,
        "total_in_batch": len(batch_results),
        "escalated": escalated_count,
        "completed": completed_count,
        "hospital_name": hospital_name,
        "campaign_name": campaign.name,
        "results": batch_results,
    }
