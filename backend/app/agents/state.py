"""LangGraph State Definition for the AI Agent Pipeline.

The state flows through: Voice Intake → Clinical Triage → Escalation Council → Documentation
Each node reads from and writes to this shared state.
"""

from typing import Annotated, TypedDict, Optional
from langgraph.graph import add_messages


class OutreachState(TypedDict):
    """Shared state for the outreach call agent pipeline."""
    # Identifiers
    tenant_id: str
    patient_id: str
    campaign_id: str
    call_attempt_id: str
    encounter_id: Optional[str]

    # Context (loaded before pipeline starts)
    patient_context: dict          # Patient info from EHR
    protocol_context: dict         # Hospital-specific clinical protocol
    previous_call_context: dict    # Context from prior call attempts (for dropped call recovery)
    hospital_name: str

    # Conversation
    messages: Annotated[list, add_messages]
    simulated_patient_responses: list  # Pre-generated patient responses for simulation

    # Voice Intake outputs
    extracted_symptoms: list
    patient_concerns: list
    medication_understanding: Optional[str]
    care_plan_adherence: Optional[str]
    requires_callback: bool
    callback_time: Optional[str]

    # Clinical Triage outputs
    triage_result: dict

    # Escalation Council outputs
    escalation_votes: list
    consensus_decision: dict

    # Documentation outputs
    documentation: dict

    # Final outcome
    call_outcome: str
    error: Optional[str]
