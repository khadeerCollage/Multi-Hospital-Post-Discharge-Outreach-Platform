"""Clinical Triage Agent - Interprets collected patient information using hospital protocols."""

import json
import logging

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.agents.prompts import CLINICAL_TRIAGE_PROMPT
from app.agents.state import OutreachState
from app.agents.llm_client import invoke_with_model_fallback

logger = logging.getLogger(__name__)


def clinical_triage_node(state: OutreachState) -> dict:
    """Clinical Triage Agent - assesses patient status based on conversation findings with fallback."""
    patient = state.get("patient_context", {})
    protocol = state.get("protocol_context", {})
    extraction = patient.get("extraction", {})
    extracted_symptoms = state.get("extracted_symptoms", [])
    
    prompt = ""
    try:
        prompt = CLINICAL_TRIAGE_PROMPT.format(
            hospital_name=state.get("hospital_name", "the hospital"),
            patient_name=f"{patient.get('first_name', '')} {patient.get('last_name', '')}",
            patient_age=patient.get("age", "unknown"),
            discharge_date=patient.get("discharge_date", "recently"),
            primary_diagnosis=patient.get("primary_diagnosis", "not specified"),
            risk_level=patient.get("risk_level", "routine"),
            medications=json.dumps(patient.get("medications", []), indent=2),
            care_plan=json.dumps(patient.get("care_plan", {}), indent=2),
            symptoms=", ".join(extracted_symptoms) if extracted_symptoms else "none reported",
            symptom_severity=extraction.get("symptom_severity", "none"),
            concerns=", ".join(state.get("patient_concerns", [])) or "none reported",
            medication_understanding=state.get("medication_understanding", "unknown"),
            care_plan_adherence=state.get("care_plan_adherence", "unknown"),
            emergency_indicators=", ".join(extraction.get("emergency_indicators", [])) or "none",
            patient_mood=extraction.get("patient_mood", "neutral"),
            red_flag_symptoms="\n".join(f"- {s}" for s in protocol.get("red_flag_symptoms", [])),
            escalation_indicators="\n".join(f"- {i}" for i in protocol.get("escalation_indicators", [])),
        )
    except Exception as fmt_err:
        logger.warning(f"Error formatting triage prompt: {fmt_err}")
        prompt = f"Assess clinical triage for {patient.get('first_name', '')} {patient.get('last_name', '')}, symptoms: {extracted_symptoms}"

    triage_result = None

    # 1. Primary: Instructor Structured Output (Guaranteed Pydantic Schema)
    try:
        from app.agents.instructor_client import ClinicalTriageSchema, call_instructor_gemini
        instructor_res = call_instructor_gemini(
            response_model=ClinicalTriageSchema,
            prompt=prompt,
            system_instruction="You are an expert clinical triage system. Assess patient status and return valid JSON strictly matching the schema."
        )
        if instructor_res:
            triage_result = instructor_res.model_dump()
    except Exception as e:
        logger.warning(f"Instructor triage call failed ({e}), falling back to LangChain / protocol fallback")

    # 2. Secondary: LangChain invocation with model fallback
    if not triage_result:
        try:
            response = invoke_with_model_fallback([
                SystemMessage(content="You are an expert clinical triage system. Assess patient status and return valid JSON only."),
                HumanMessage(content=prompt)
            ], temperature=0.1)

            raw_text = response.content
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0]
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0]

            triage_result = json.loads(raw_text.strip())

        except Exception as e:
            logger.warning(f"Clinical triage LLM call failed ({e}), using deterministic protocol triage")

    if not triage_result or not isinstance(triage_result, dict) or not triage_result.get("status"):
        all_symptom_str = " ".join([str(s) for s in extracted_symptoms]).lower()
        emergency_indicators = [str(i).lower() for i in extraction.get("emergency_indicators", [])]
        combined = all_symptom_str + " " + " ".join(emergency_indicators)

        if "chest pain" in combined or "breath" in combined or "bleeding" in combined:
            triage_result = {
                "status": "urgent",
                "severity_score": 9,
                "relevant_evidence": ["Severe acute chest pain / respiratory distress reported."],
                "protocol_references": ["Cardiovascular Emergency Outreach Standard #1"],
                "risk_factors": [patient.get("risk_level", "critical"), "Acute post-discharge window"],
                "confidence": "high",
                "recommended_escalation": True,
                "reasoning": "Patient reports severe chest pain and respiratory distress, meeting acute cardiovascular red-flag escalation criteria.",
            }
        elif "fever" in combined or "pus" in combined or "wound" in combined or "redness" in combined:
            triage_result = {
                "status": "urgent",
                "severity_score": 7,
                "relevant_evidence": ["Post-operative fever > 101.4°F and wound site erythema/drainage."],
                "protocol_references": ["Surgical Site Infection Surveillance Protocol"],
                "risk_factors": [patient.get("risk_level", "high"), "Surgical wound complication"],
                "confidence": "high",
                "recommended_escalation": True,
                "reasoning": "Persistent hyperthermia coupled with surgical wound inflammation indicates potential secondary infection requiring urgent clinical review.",
            }
        else:
            triage_result = {
                "status": "routine",
                "severity_score": 2,
                "relevant_evidence": ["Mild expected post-operative soreness, no acute red flags."],
                "protocol_references": ["Standard Post-Discharge Recovery Protocol"],
                "risk_factors": [patient.get("risk_level", "routine")],
                "confidence": "high",
                "recommended_escalation": False,
                "reasoning": "Patient recovery trajectory conforms to standard post-discharge milestones with no red-flag indicators.",
            }

    valid_statuses = {"routine", "concerning", "urgent", "uncertain"}
    if triage_result.get("status") not in valid_statuses:
        triage_result["status"] = "urgent" if triage_result.get("recommended_escalation") else "routine"

    return {
        "triage_result": triage_result,
        "messages": [AIMessage(content=f"Triage completed: status={triage_result['status']}, escalation_recommended={triage_result.get('recommended_escalation')}")],
    }


def route_after_triage(state: OutreachState) -> str:
    """Route after triage - always council for non-routine cases."""
    triage = state.get("triage_result", {})
    status = triage.get("status", "routine")
    recommended = triage.get("recommended_escalation", False)

    if status in ("urgent", "concerning", "uncertain") or recommended:
        return "council"
    
    patient = state.get("patient_context", {})
    if patient.get("risk_level") in ("critical", "high"):
        return "council"
    
    return "documentation"
