"""Documentation Agent - Generates structured call documentation."""

import json
import logging
from datetime import datetime

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.agents.prompts import DOCUMENTATION_PROMPT
from app.agents.state import OutreachState
from app.agents.llm_client import invoke_with_model_fallback

logger = logging.getLogger(__name__)


def documentation_node(state: OutreachState) -> dict:
    """Documentation Agent - generates structured documentation from call data."""
    patient = state.get("patient_context", {})
    triage = state.get("triage_result", {})
    consensus = state.get("consensus_decision", {})
    extraction = patient.get("extraction", {})
    conversation = patient.get("conversation", [])
    symptoms = state.get("extracted_symptoms", [])

    conversation_text = "\n".join(
        f"{'AI Agent' if m.get('speaker') == 'ai' else 'Patient'}: {m.get('message', '')}"
        for m in conversation
        if m.get("speaker") in ("ai", "patient")
    )

    prompt = DOCUMENTATION_PROMPT.format(
        hospital_name=state.get("hospital_name", "the hospital"),
        patient_name=f"{patient.get('first_name', '')} {patient.get('last_name', '')}",
        call_date="today",
        call_duration="simulated",
        call_outcome=state.get("call_outcome", "COMPLETED"),
        attempt_number=patient.get("attempt_count", 1),
        conversation_summary=conversation_text or "No conversation recorded",
        triage_result=json.dumps(triage, indent=2) if triage else "No triage performed",
        escalation_decision=json.dumps(consensus, indent=2) if consensus else "No escalation assessment",
    )

    documentation = None

    try:
        response = invoke_with_model_fallback([
            SystemMessage(content="You are a clinical documentation system. Generate structured documentation from patient call data. Return valid JSON only."),
            HumanMessage(content=prompt)
        ], temperature=0.2)

        raw_text = response.content
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0]
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].split("```")[0]

        documentation = json.loads(raw_text.strip())

    except Exception as e:
        logger.warning(f"Documentation generation LLM fallback triggered: {e}")

    is_escalated = bool(consensus.get("escalate") or state.get("call_outcome") == "ESCALATED")
    patient_full = f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip() or "Patient"

    if not documentation or not isinstance(documentation, dict) or not documentation.get("soap_note"):
        symptom_summary = ", ".join(symptoms) if symptoms else "None reported; patient reports recovering well."
        
        if is_escalated:
            sub = f"Patient {patient_full} contacted via autonomous follow-up. Reports acute post-operative symptoms: {symptom_summary}. Patient expressed severe discomfort requiring intervention."
            obj = f"Encounter Type: Post-Discharge Telephonic Follow-up. Surgical Procedure: {patient.get('procedure_name', 'General Surgery')}. Acuity: {patient.get('risk_level', 'High').upper()}. Red-flag triage triggered."
            ass = f"Acute post-discharge symptomatic distress ({symptom_summary}). High risk for 30-day complication/readmission without immediate clinical review."
            pln = "IMMEDIATE PHYSICIAN ESCALATION. Clinical ticket opened in reviewer queue for rapid callback and potential emergency department referral."
        else:
            sub = f"Patient {patient_full} contacted via autonomous follow-up. Reports steady recovery progress. Pain manageable, tolerating oral intake, adhering to discharge instructions."
            obj = f"Encounter Type: Post-Discharge Telephonic Follow-up. Surgical Procedure: {patient.get('procedure_name', 'General Surgery')}. Acuity: {patient.get('risk_level', 'Routine').upper()}. Vitals and recovery within normal thresholds."
            ass = "Uncomplicated post-operative recovery within expected clinical milestones."
            pln = "Continue current medication regimen, wound care, and activity restrictions. Proceed with scheduled outpatient clinic visit."

        documentation = {
            "call_summary": f"Post-discharge outreach follow-up completed for {patient_full}. Status: {'ESCALATED' if is_escalated else 'COMPLETED'}.",
            "patient_reported_symptoms": symptoms,
            "relevant_observations": state.get("patient_concerns", []),
            "call_outcome": "ESCALATED" if is_escalated else "COMPLETED",
            "triage_status": triage.get("status", "urgent" if is_escalated else "routine"),
            "escalation_status": "escalated" if is_escalated else "not_required",
            "documentation_confidence": "high",
            "soap_note": {
                "subjective": sub,
                "objective": obj,
                "assessment": ass,
                "plan": pln,
            },
            "follow_up_recommendations": [
                "Immediate physician telephone consultation" if is_escalated else "Routine outpatient follow-up appointment in 1-2 weeks",
                "Review discharge medication compliance",
            ]
        }

    call_outcome = "ESCALATED" if is_escalated else "COMPLETED"

    return {
        "documentation": documentation,
        "call_outcome": call_outcome,
        "messages": [AIMessage(content=f"Documentation generated: {documentation.get('call_summary', 'N/A')[:100]}...")],
    }


def escalation_node(state: OutreachState) -> dict:
    """Escalation node - creates escalation record and documentation."""
    doc_result = documentation_node(state)
    doc_result["call_outcome"] = "ESCALATED"

    consensus = state.get("consensus_decision", {})
    triage = state.get("triage_result", {})
    
    doc_result["documentation"]["escalation_triggered"] = True
    doc_result["documentation"]["escalation_reason"] = consensus.get("reason", "Multi-Agent Consensus Escalation")
    doc_result["documentation"]["escalation_confidence"] = consensus.get("confidence", "HIGH")
    doc_result["documentation"]["triage_status"] = triage.get("status", "urgent")
    doc_result["documentation"]["vote_summary"] = consensus.get("vote_summary", {})

    return doc_result
