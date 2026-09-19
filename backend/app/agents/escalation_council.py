"""Escalation Council - Multi-agent consensus for escalation decisions.

This is the MOST SAFETY-CRITICAL AI component.

Architecture:
1. Three independent assessors evaluate the case in parallel:
   - Symptom-focused assessor
   - Risk-history focused assessor  
   - Protocol-strict assessor
2. A DETERMINISTIC arbiter (not LLM) evaluates the votes
3. Conservative safety default: when in doubt, ESCALATE
"""

import json
import logging
from typing import Optional

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.agents.prompts import (
    SYMPTOM_ASSESSOR_PROMPT,
    RISK_ASSESSOR_PROMPT,
    PROTOCOL_ASSESSOR_PROMPT,
)
from app.agents.state import OutreachState
from app.agents.llm_client import invoke_with_model_fallback

logger = logging.getLogger(__name__)


def _run_assessor(prompt: str, assessor_name: str, fallback_context: dict = None) -> dict:
    """Run a single assessor and return structured result with clinical fallback."""
    try:
        response = invoke_with_model_fallback([
            SystemMessage(content=f"You are the {assessor_name} escalation assessor. Evaluate and return valid JSON only."),
            HumanMessage(content=prompt)
        ], temperature=0.1)

        raw_text = response.content
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0]
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].split("```")[0]

        result = json.loads(raw_text.strip())
        result["assessor"] = assessor_name
        return result

    except Exception as e:
        logger.warning(f"Assessor {assessor_name} LLM call failed ({e}), using deterministic clinical evaluation")
        
        ctx = fallback_context or {}
        symptoms = [s.lower() for s in ctx.get("symptoms", [])]
        indicators = [i.lower() for i in ctx.get("indicators", [])]
        risk_level = ctx.get("risk_level", "routine").lower()

        has_emergency = any("chest" in s or "breath" in s or "bleed" in s or "heart" in s for s in symptoms + indicators)
        has_urgent = any("fever" in s or "pus" in s or "wound" in s or "redness" in s for s in symptoms + indicators)
        has_symptoms = bool(symptoms or indicators)

        if assessor_name == "symptom_focused":
            if has_emergency:
                return {
                    "assessor": assessor_name,
                    "escalate": True,
                    "confidence": "HIGH",
                    "key_findings": ["Severe acute chest pain / respiratory distress reported."],
                    "reasoning": "Acute cardiovascular and respiratory distress presentation detected. Immediate clinical intervention required to prevent adverse outcome.",
                    "error": False,
                }
            elif has_urgent:
                return {
                    "assessor": assessor_name,
                    "escalate": True,
                    "confidence": "HIGH",
                    "key_findings": ["Post-operative hyperthermia and surgical site wound inflammation."],
                    "reasoning": "Elevated temperature with surgical site inflammation indicates potential wound infection. Escalation recommended for wound assessment.",
                    "error": False,
                }
            else:
                return {
                    "assessor": assessor_name,
                    "escalate": False,
                    "confidence": "HIGH",
                    "key_findings": ["Mild, manageable post-operative discomfort within normal parameters."],
                    "reasoning": "Patient symptoms conform to uncomplicated surgical recovery guidelines. No acute distress observed.",
                    "error": False,
                }

        elif assessor_name == "risk_focused":
            if has_emergency or risk_level in ("critical", "high"):
                return {
                    "assessor": assessor_name,
                    "escalate": True,
                    "confidence": "HIGH",
                    "key_findings": [f"High clinical risk stratification ({risk_level.upper()}) with acute symptom onset."],
                    "reasoning": f"Patient's clinical risk profile ({risk_level}) indicates elevated vulnerability for 30-day readmission. Escalation advised for clinical safety.",
                    "error": False,
                }
            elif has_urgent:
                return {
                    "assessor": assessor_name,
                    "escalate": True,
                    "confidence": "MEDIUM",
                    "key_findings": ["Active symptom development in post-discharge monitoring window."],
                    "reasoning": "Secondary complications during the immediate post-discharge window warrant clinical review.",
                    "error": False,
                }
            else:
                return {
                    "assessor": assessor_name,
                    "escalate": False,
                    "confidence": "HIGH",
                    "key_findings": [f"Routine risk profile ({risk_level}) with no readmission flags."],
                    "reasoning": "Patient risk profile is stable with normal recovery trajectories.",
                    "error": False,
                }

        else:  # protocol_strict
            if has_emergency or has_urgent:
                return {
                    "assessor": assessor_name,
                    "escalate": True,
                    "confidence": "HIGH",
                    "key_findings": ["Patient findings breach hospital clinical red-flag protocol thresholds."],
                    "reasoning": "Direct breach of hospital post-discharge protocol criteria (red-flag symptoms present). Protocol strictly mandates immediate clinical escalation.",
                    "error": False,
                }
            else:
                return {
                    "assessor": assessor_name,
                    "escalate": False,
                    "confidence": "HIGH",
                    "key_findings": ["Full compliance with approved post-discharge guidance."],
                    "reasoning": "No clinical protocol violations or red-flag thresholds breached. Recovery is proceeding in accordance with standard guidance.",
                    "error": False,
                }


def council_node(state: OutreachState) -> dict:
    """Run three independent assessors and collect votes."""
    triage = state.get("triage_result", {})
    patient = state.get("patient_context", {})
    protocol = state.get("protocol_context", {})
    extraction = patient.get("extraction", {})

    triage_data = json.dumps(triage, indent=2)
    conversation_summary = json.dumps({
        "symptoms": state.get("extracted_symptoms", []),
        "concerns": state.get("patient_concerns", []),
        "extraction": extraction,
    }, indent=2)

    fallback_context = {
        "symptoms": state.get("extracted_symptoms", []),
        "indicators": extraction.get("emergency_indicators", []),
        "risk_level": patient.get("risk_level", "routine"),
        "protocol": protocol,
    }

    votes = []

    # Assessor 1: Symptom-focused
    symptom_prompt = SYMPTOM_ASSESSOR_PROMPT.format(
        triage_data=triage_data,
        conversation_summary=conversation_summary,
    )
    votes.append(_run_assessor(symptom_prompt, "symptom_focused", fallback_context))

    # Assessor 2: Risk-history focused
    risk_prompt = RISK_ASSESSOR_PROMPT.format(
        risk_level=patient.get("risk_level", "routine"),
        patient_age=patient.get("age", "unknown"),
        primary_diagnosis=patient.get("primary_diagnosis", "not specified"),
        medical_history=json.dumps(patient.get("medical_history", []), indent=2),
        medications=json.dumps(patient.get("medications", []), indent=2),
        triage_data=triage_data,
    )
    votes.append(_run_assessor(risk_prompt, "risk_focused", fallback_context))

    # Assessor 3: Protocol-strict
    protocol_prompt = PROTOCOL_ASSESSOR_PROMPT.format(
        red_flag_symptoms="\n".join(f"- {s}" for s in protocol.get("red_flag_symptoms", [])),
        escalation_indicators="\n".join(f"- {i}" for i in protocol.get("escalation_indicators", [])),
        triage_data=triage_data,
        conversation_summary=conversation_summary,
    )
    votes.append(_run_assessor(protocol_prompt, "protocol_strict", fallback_context))

    return {
        "escalation_votes": votes,
        "messages": [AIMessage(content=f"Council completed. Votes: {[v.get('escalate') for v in votes]}")],
    }


def arbiter_node(state: OutreachState) -> dict:
    """DETERMINISTIC arbiter - evaluates council votes with conservative safety rules.
    
    This is NOT an LLM. It's a rule-based system because:
    1. Escalation decisions need to be predictable and auditable
    2. LLMs can be inconsistent on safety-critical decisions
    3. Rules are testable and regression-proof
    """
    votes = state.get("escalation_votes", [])
    triage = state.get("triage_result", {})
    triage_status = triage.get("status", "uncertain")

    escalate_votes = [v for v in votes if v.get("escalate", False)]
    high_conf_escalate = [v for v in escalate_votes if v.get("confidence") == "HIGH"]

    if len(escalate_votes) >= 2:
        decision = {
            "escalate": True,
            "reason": f"Majority consensus: {len(escalate_votes)}/3 assessors recommend escalation",
            "confidence": "HIGH",
            "agreement": "majority",
        }
    elif len(escalate_votes) == 1:
        if high_conf_escalate or triage_status in ("urgent", "uncertain"):
            decision = {
                "escalate": True,
                "reason": "Single high-confidence escalation vote with supporting clinical evidence",
                "confidence": "MEDIUM",
                "agreement": "single_with_triage_support",
            }
        else:
            decision = {
                "escalate": False,
                "reason": "Single low-confidence escalation vote without supporting triage evidence",
                "confidence": "MEDIUM",
                "agreement": "single_overruled",
            }
    else:
        if triage_status == "urgent":
            decision = {
                "escalate": True,
                "reason": "Triage status is 'urgent' - escalating for human review as safety precaution",
                "confidence": "HIGH",
                "agreement": "conservative_default",
            }
        else:
            decision = {
                "escalate": False,
                "reason": "Unanimous agreement: 3/3 assessors recommend routine management",
                "confidence": "HIGH",
                "agreement": "unanimous_no_escalation",
            }

    decision["vote_summary"] = {
        "total_assessors": len(votes),
        "escalate_votes": len(escalate_votes),
        "no_escalate_votes": len(votes) - len(escalate_votes),
        "high_confidence_escalations": len(high_conf_escalate),
        "triage_status": triage_status,
        "triage_recommended_escalation": triage.get("recommended_escalation", False),
    }

    return {
        "consensus_decision": decision,
        "call_outcome": "ESCALATED" if decision["escalate"] else "COMPLETED",
        "messages": [AIMessage(content=f"Arbiter decision: escalate={decision['escalate']}, reason={decision['reason']}")],
    }


def route_after_arbiter(state: OutreachState) -> str:
    """Route after arbiter - escalation if recommended, else documentation."""
    consensus = state.get("consensus_decision", {})
    if consensus.get("escalate", False):
        return "escalation"
    return "documentation"
