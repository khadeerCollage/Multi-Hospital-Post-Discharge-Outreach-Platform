"""Background Scheduler - Manages queue processing, retries, and maintenance.

Uses APScheduler to run periodic tasks inside the FastAPI process.
No separate Celery workers needed.

Jobs:
1. process_queue: Every 10s - dispatches tasks up to capacity
2. process_retries: Every 30s - moves retry-eligible tasks back to PENDING
3. process_callbacks: Every 30s - activates callback-scheduled tasks
4. recover_stuck: Every 60s - releases tasks stuck in CALLING state
5. check_cutoffs: Every 60s - handles expired clinical windows
6. check_campaign_completion: Every 30s - completes finished campaigns
"""

import asyncio
import logging
import uuid
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.database import async_session, get_robust_session
from app.services.queue_engine import (
    acquire_next_tasks,
    release_task,
    schedule_retry,
    process_pending_retries,
    process_pending_callbacks,
    recover_stuck_tasks,
    check_clinical_cutoffs,
    get_queue_metrics,
)
from app.services.concurrency_manager import (
    acquire_call_slot,
    release_call_slot,
    get_remaining_capacity,
    get_capacity,
    update_heartbeat,
)
from app.services.call_simulator import (
    simulate_call_outcome,
    get_patient_scenario,
    simulate_call_duration,
)
from app.services.retry_strategy import should_retry

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler()

# Track running campaigns
_running_campaigns = set()


def register_campaign(campaign_id: str, tenant_id: str, hospital_id: str):
    """Register a campaign for queue processing."""
    _running_campaigns.add((campaign_id, tenant_id, hospital_id))
    logger.info(f"Registered campaign {campaign_id} for processing")


def unregister_campaign(campaign_id: str):
    """Unregister a campaign from queue processing."""
    _running_campaigns = {c for c in _running_campaigns if c[0] != campaign_id}
    logger.info(f"Unregistered campaign {campaign_id}")


async def process_queue():
    """Main queue processing loop - dispatches tasks up to available capacity."""
    if not _running_campaigns:
        return

    for campaign_id, tenant_id, hospital_id in list(_running_campaigns):
        try:
            remaining = get_remaining_capacity(hospital_id)
            if remaining <= 0:
                continue

            async with get_robust_session() as session:
                tasks = await acquire_next_tasks(
                    session, tenant_id, campaign_id,
                    batch_size=min(remaining, 3),  # Process in small batches
                    worker_id=f"scheduler-{uuid.uuid4().hex[:6]}"
                )

                for task in tasks:
                    # Try to acquire a call slot
                    max_cap = get_capacity(hospital_id)
                    if acquire_call_slot(hospital_id, task["id"], max_cap):
                        # Dispatch the call processing as a background task
                        asyncio.create_task(
                            process_single_call(task, hospital_id)
                        )
                    else:
                        # Couldn't get slot, release the task back
                        await release_task(session, task["id"], "TECHNICAL_FAILURE")

        except asyncio.CancelledError:
            return
        except Exception as e:
            logger.error(f"Queue processing error for campaign {campaign_id}: {e}")


async def process_single_call(task: dict, hospital_id: str):
    """Process a single outbound call - simulates the call and runs AI pipeline."""
    task_id = task["id"]
    
    try:
        # Update heartbeat
        update_heartbeat(task_id)

        # Simulate call outcome
        outcome = simulate_call_outcome(task.get("risk_level", "routine"))
        duration = simulate_call_duration(outcome)

        # Small delay to simulate call duration (scaled down for prototype)
        await asyncio.sleep(min(duration / 30, 5))  # Max 5 second delay

        update_heartbeat(task_id)

        async with get_robust_session() as session:
            if outcome == "ANSWERED":
                # Run the AI pipeline for answered calls
                await process_answered_call(task, session, hospital_id)
            else:
                # Handle non-answered outcomes
                await release_task(session, task_id, outcome, call_duration=duration)

                # Schedule retry if appropriate
                if should_retry(outcome, task.get("attempt_count", 1)):
                    await schedule_retry(session, task_id, outcome)

    except asyncio.CancelledError:
        return
    except Exception as e:
        logger.error(f"Call processing error for task {task_id}: {e}")
        try:
            async with async_session() as session:
                await release_task(session, task_id, "TECHNICAL_FAILURE")
        except Exception:
            pass
    finally:
        # Always release the call slot
        release_call_slot(hospital_id, task_id)


async def process_answered_call(task: dict, session, hospital_id: str):
    """Process an answered call through the AI pipeline."""
    from app.agents.graph import run_outreach_pipeline
    from sqlalchemy import text

    task_id = task["id"]

    try:
        # Get patient and protocol data
        patient_result = await session.execute(
            text("SELECT * FROM patients WHERE id = :pid"),
            {"pid": task["patient_id"]}
        )
        patient_row = patient_result.fetchone()

        if not patient_row:
            await release_task(session, task_id, "TECHNICAL_FAILURE")
            return

        # Get hospital protocol
        protocol_result = await session.execute(
            text("SELECT * FROM clinical_protocols WHERE tenant_id = :tid AND is_active = true LIMIT 1"),
            {"tid": task["tenant_id"]}
        )
        protocol_row = protocol_result.fetchone()

        # Get hospital name
        hospital_result = await session.execute(
            text("SELECT name FROM hospitals WHERE id = :hid"),
            {"hid": hospital_id}
        )
        hospital_row = hospital_result.fetchone()

        # Build patient context
        patient_context = {
            "first_name": patient_row.first_name if patient_row else "Patient",
            "last_name": patient_row.last_name if patient_row else "",
            "age": str((datetime.utcnow().date() - patient_row.date_of_birth).days // 365) if patient_row and patient_row.date_of_birth else "unknown",
            "risk_level": patient_row.risk_level if patient_row else "routine",
            "primary_diagnosis": "post-discharge follow-up",
            "discharge_date": "recently",
            "medications": [],
            "care_plan": {},
        }

        # Build protocol context
        protocol_context = {}
        if protocol_row:
            protocol_context = {
                "follow_up_questions": protocol_row.follow_up_questions or [],
                "red_flag_symptoms": protocol_row.red_flag_symptoms or [],
                "escalation_indicators": protocol_row.escalation_indicators or [],
                "approved_guidance": protocol_row.approved_guidance or [],
            }
        else:
            # Default protocol
            protocol_context = {
                "follow_up_questions": [
                    "How are you feeling since being discharged?",
                    "Are you experiencing any new or worsening symptoms?",
                    "Are you taking your medications as prescribed?",
                    "Do you have any questions about your care plan?",
                    "Have you been able to eat and drink normally?",
                ],
                "red_flag_symptoms": [
                    "Severe chest pain",
                    "Difficulty breathing or shortness of breath",
                    "High fever (over 101°F / 38.3°C)",
                    "Uncontrolled bleeding",
                    "Signs of stroke (sudden weakness, speech difficulty)",
                    "Severe abdominal pain",
                    "Loss of consciousness or fainting",
                    "Allergic reaction to medication",
                ],
                "escalation_indicators": [
                    "Patient reports any red flag symptom",
                    "Patient sounds confused or disoriented",
                    "Patient reports medication error",
                    "Patient expresses suicidal ideation",
                    "Patient requests emergency assistance",
                    "Vital signs outside normal range",
                ],
                "approved_guidance": [
                    "Follow your discharge instructions",
                    "Take medications as prescribed",
                    "Contact your doctor if symptoms worsen",
                    "Go to the emergency room if you have severe symptoms",
                ],
            }

        # Get patient scenario for simulation
        scenario = get_patient_scenario(patient_context["risk_level"])
        simulated_responses = scenario.get("responses", [])

        # Create call record
        call_id = str(uuid.uuid4())
        await session.execute(
            text("""
                INSERT INTO call_records (id, tenant_id, task_id, campaign_id, patient_id, 
                    attempt_number, status, start_time, created_at)
                VALUES (:id, :tenant_id, :task_id, :campaign_id, :patient_id,
                    :attempt, 'CONNECTED', NOW(), NOW())
            """),
            {
                "id": call_id,
                "tenant_id": task["tenant_id"],
                "task_id": task_id,
                "campaign_id": task["campaign_id"],
                "patient_id": task["patient_id"],
                "attempt": task.get("attempt_count", 1),
            }
        )
        await session.commit()

        # Run the AI pipeline
        result = await run_outreach_pipeline(
            tenant_id=task["tenant_id"],
            patient_id=task["patient_id"],
            campaign_id=task["campaign_id"],
            call_attempt_id=call_id,
            patient_context=patient_context,
            protocol_context=protocol_context,
            hospital_name=hospital_row.name if hospital_row else "Hospital",
            simulated_patient_responses=simulated_responses,
            encounter_id=task.get("encounter_id"),
        )

        # Update call record with results
        call_outcome = result.get("call_outcome", "COMPLETED")
        await session.execute(
            text("""
                UPDATE call_records
                SET status = 'COMPLETED',
                    end_time = NOW(),
                    outcome = :outcome,
                    transcript = :transcript,
                    ai_outputs = :ai_outputs,
                    triage_result = :triage,
                    escalation_decision = :escalation,
                    documentation_status = 'completed'
                WHERE id = :id
            """),
            {
                "id": call_id,
                "outcome": call_outcome,
                "transcript": str(result.get("conversation", [])),
                "ai_outputs": str(result.get("documentation", {})),
                "triage": str(result.get("triage_result", {})),
                "escalation": str(result.get("consensus_decision", {})),
            }
        )

        # Update task status
        await release_task(session, task_id, call_outcome)

        # Create escalation if needed
        if call_outcome == "ESCALATED":
            escalation_id = str(uuid.uuid4())
            consensus = result.get("consensus_decision", {})
            triage = result.get("triage_result", {})
            
            await session.execute(
                text("""
                    INSERT INTO escalations (id, tenant_id, patient_id, campaign_id,
                        call_record_id, trigger, clinical_indicators, triage_result,
                        consensus_result, priority, status, created_at, updated_at)
                    VALUES (:id, :tenant_id, :patient_id, :campaign_id,
                        :call_id, :trigger, :indicators, :triage,
                        :consensus, :priority, 'OPEN', NOW(), NOW())
                """),
                {
                    "id": escalation_id,
                    "tenant_id": task["tenant_id"],
                    "patient_id": task["patient_id"],
                    "campaign_id": task["campaign_id"],
                    "call_id": call_id,
                    "trigger": consensus.get("reason", "AI escalation"),
                    "indicators": str(result.get("extracted_symptoms", [])),
                    "triage": str(triage),
                    "consensus": str(consensus),
                    "priority": "critical" if triage.get("status") == "urgent" else "high",
                }
            )

        await session.commit()
        logger.info(f"Call processed: task={task_id}, outcome={call_outcome}")

    except Exception as e:
        logger.error(f"Answered call processing error: {e}")
        await release_task(session, task_id, "TECHNICAL_FAILURE")
        await session.commit()


async def process_retries_job():
    """Move retry-eligible tasks back to PENDING."""
    try:
        async with get_robust_session() as session:
            count = await process_pending_retries(session)
            if count > 0:
                logger.info(f"Moved {count} retry tasks to PENDING")
    except asyncio.CancelledError:
        return
    except Exception as e:
        logger.error(f"Retry processing error: {e}")


async def process_callbacks_job():
    """Activate callback-scheduled tasks."""
    try:
        async with get_robust_session() as session:
            count = await process_pending_callbacks(session)
            if count > 0:
                logger.info(f"Activated {count} callback tasks")
    except asyncio.CancelledError:
        return
    except Exception as e:
        logger.error(f"Callback processing error: {e}")


async def recover_stuck_job():
    """Release tasks stuck in CALLING state."""
    try:
        async with get_robust_session() as session:
            count = await recover_stuck_tasks(session)
            if count > 0:
                logger.warning(f"Recovered {count} stuck tasks")
    except asyncio.CancelledError:
        return
    except Exception as e:
        logger.error(f"Stuck task recovery error: {e}")


async def check_cutoffs_job():
    """Handle tasks past their clinical cutoff window."""
    try:
        async with get_robust_session() as session:
            count = await check_clinical_cutoffs(session)
            if count > 0:
                logger.info(f"Moved {count} expired tasks to MANUAL_FOLLOW_UP")
    except asyncio.CancelledError:
        return
    except Exception as e:
        logger.error(f"Cutoff check error: {e}")


async def check_campaign_completion():
    """Check if any running campaigns have completed."""
    from sqlalchemy import text

    for campaign_id, tenant_id, hospital_id in list(_running_campaigns):
        try:
            async with get_robust_session() as session:
                metrics = await get_queue_metrics(session, campaign_id)
                total = metrics.get("total", 0)
                total_final = metrics.get("total_final", 0)

                if total > 0 and total_final >= total:
                    # All tasks are in terminal state - campaign is complete
                    await session.execute(
                        text("""
                            UPDATE campaigns
                            SET status = 'COMPLETED',
                                completed_at = NOW(),
                                total_completed = :completed,
                                total_escalated = :escalated,
                                updated_at = NOW()
                            WHERE id = :id AND status = 'RUNNING'
                        """),
                        {
                            "id": campaign_id,
                            "completed": metrics.get("completed", 0),
                            "escalated": metrics.get("escalated", 0),
                        }
                    )
                    await session.commit()
                    _running_campaigns.discard((campaign_id, tenant_id, hospital_id))
                    logger.info(f"Campaign {campaign_id} completed")

        except asyncio.CancelledError:
            return
        except Exception as e:
            logger.error(f"Campaign completion check error: {e}")



def start_scheduler():
    """Start the background scheduler with all jobs."""
    scheduler.add_job(
        process_queue,
        IntervalTrigger(seconds=10),
        id="process_queue",
        replace_existing=True,
        name="Queue Processor",
    )
    scheduler.add_job(
        process_retries_job,
        IntervalTrigger(seconds=30),
        id="process_retries",
        replace_existing=True,
        name="Retry Processor",
    )
    scheduler.add_job(
        process_callbacks_job,
        IntervalTrigger(seconds=30),
        id="process_callbacks",
        replace_existing=True,
        name="Callback Processor",
    )
    scheduler.add_job(
        recover_stuck_job,
        IntervalTrigger(seconds=60),
        id="recover_stuck",
        replace_existing=True,
        name="Stuck Task Recovery",
    )
    scheduler.add_job(
        check_cutoffs_job,
        IntervalTrigger(seconds=60),
        id="check_cutoffs",
        replace_existing=True,
        name="Clinical Cutoff Monitor",
    )
    scheduler.add_job(
        check_campaign_completion,
        IntervalTrigger(seconds=30),
        id="check_completion",
        replace_existing=True,
        name="Campaign Completion Check",
    )

    scheduler.start()
    logger.info("Background scheduler started with 6 jobs")


def stop_scheduler():
    """Stop the background scheduler cleanly."""
    if scheduler.running:
        try:
            scheduler.shutdown(wait=False)
        except Exception:
            pass
        logger.info("Background scheduler stopped")
