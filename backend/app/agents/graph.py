"""LangGraph Graph Assembly - Connects all agent nodes into the outreach pipeline.

Pipeline flow:
  intake → triage → council → arbiter → documentation/escalation

Each node has clear responsibility:
- Voice Intake: Conducts conversation, extracts symptoms
- Clinical Triage: Assesses clinical status against protocols
- Council: 3 independent escalation assessors
- Arbiter: Deterministic consensus decision (NOT an LLM)
- Documentation: Generates structured call documentation
- Escalation: Handles escalated cases with documentation
"""

from langgraph.graph import StateGraph, END

from app.agents.state import OutreachState
from app.agents.voice_intake import voice_intake_node, route_after_intake
from app.agents.clinical_triage import clinical_triage_node, route_after_triage
from app.agents.escalation_council import council_node, arbiter_node, route_after_arbiter
from app.agents.documentation_agent import documentation_node, escalation_node


def build_outreach_graph():
    """Build and compile the LangGraph outreach pipeline.
    
    Graph structure:
    
    intake ──→ triage ──→ council ──→ arbiter ──→ documentation ──→ END
                │                        │
                └──→ documentation       └──→ escalation ──→ END
                     (routine only)           (urgent cases)
    
    In practice, ALL cases go through triage for safety.
    Triage routes to council for non-routine cases.
    Council + arbiter determine escalation.
    """
    builder = StateGraph(OutreachState)

    # Add all nodes
    builder.add_node("intake", voice_intake_node)
    builder.add_node("triage", clinical_triage_node)
    builder.add_node("council", council_node)
    builder.add_node("arbiter", arbiter_node)
    builder.add_node("documentation", documentation_node)
    builder.add_node("escalation", escalation_node)

    # Set entry point
    builder.set_entry_point("intake")

    # Add edges with conditional routing
    builder.add_conditional_edges(
        "intake",
        route_after_intake,
        {
            "triage": "triage",
            "documentation": "documentation",
        }
    )

    builder.add_conditional_edges(
        "triage",
        route_after_triage,
        {
            "council": "council",
            "documentation": "documentation",
        }
    )

    # Council always goes to arbiter
    builder.add_edge("council", "arbiter")

    # Arbiter routes to escalation or documentation
    builder.add_conditional_edges(
        "arbiter",
        route_after_arbiter,
        {
            "escalation": "escalation",
            "documentation": "documentation",
        }
    )

    # Terminal nodes
    builder.add_edge("documentation", END)
    builder.add_edge("escalation", END)

    # Compile the graph
    graph = builder.compile()
    return graph


# Singleton graph instance
_graph = None


def get_outreach_graph():
    """Get or create the outreach graph singleton."""
    global _graph
    if _graph is None:
        _graph = build_outreach_graph()
    return _graph


async def run_outreach_pipeline(
    tenant_id: str,
    patient_id: str,
    campaign_id: str,
    call_attempt_id: str,
    patient_context: dict,
    protocol_context: dict,
    hospital_name: str,
    simulated_patient_responses: list = None,
    previous_call_context: dict = None,
    encounter_id: str = None,
) -> dict:
    """Run the full outreach pipeline for a patient call.
    
    Args:
        tenant_id: Hospital tenant ID
        patient_id: Patient UUID
        campaign_id: Campaign UUID
        call_attempt_id: Call record UUID
        patient_context: Patient data from EHR
        protocol_context: Hospital clinical protocol
        hospital_name: Hospital display name
        simulated_patient_responses: Pre-generated patient responses for simulation
        previous_call_context: Context from prior call attempts
        encounter_id: Encounter UUID if available
    
    Returns:
        dict with pipeline results including:
        - call_outcome: COMPLETED/ESCALATED
        - triage_result: structured triage assessment
        - consensus_decision: escalation decision with vote summary
        - documentation: structured call documentation
        - extracted_symptoms: list of symptoms
        - conversation: list of conversation messages
    """
    graph = get_outreach_graph()

    initial_state = {
        "tenant_id": tenant_id,
        "patient_id": patient_id,
        "campaign_id": campaign_id,
        "call_attempt_id": call_attempt_id,
        "encounter_id": encounter_id,
        "patient_context": patient_context,
        "protocol_context": protocol_context,
        "previous_call_context": previous_call_context or {},
        "hospital_name": hospital_name,
        "messages": [],
        "simulated_patient_responses": simulated_patient_responses or [],
        "extracted_symptoms": [],
        "patient_concerns": [],
        "medication_understanding": None,
        "care_plan_adherence": None,
        "requires_callback": False,
        "callback_time": None,
        "triage_result": {},
        "escalation_votes": [],
        "consensus_decision": {},
        "documentation": {},
        "call_outcome": "",
        "error": None,
    }

    try:
        # Run the graph
        result = graph.invoke(initial_state)

        return {
            "success": True,
            "call_outcome": result.get("call_outcome", "COMPLETED"),
            "triage_result": result.get("triage_result", {}),
            "consensus_decision": result.get("consensus_decision", {}),
            "escalation_votes": result.get("escalation_votes", []),
            "documentation": result.get("documentation", {}),
            "extracted_symptoms": result.get("extracted_symptoms", []),
            "patient_concerns": result.get("patient_concerns", []),
            "requires_callback": result.get("requires_callback", False),
            "callback_time": result.get("callback_time"),
            "conversation": result.get("patient_context", {}).get("conversation", []),
            "extraction": result.get("patient_context", {}).get("extraction", {}),
        }

    except Exception as e:
        return {
            "success": False,
            "call_outcome": "FAILED",
            "error": str(e),
            "triage_result": {},
            "consensus_decision": {},
            "documentation": {},
            "extracted_symptoms": [],
        }
