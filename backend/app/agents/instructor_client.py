"""Instructor-powered Structured Output Client for Gemini.

Guarantees that LLM outputs strictly conform to Pydantic models for:
1. Clinical Triage Assessment
2. Escalation Council Multi-Agent Votes
3. Clinical SOAP Documentation

Includes Langfuse / LangSmith observability hooks and 100% graceful fallback.
"""

import os
import logging
from typing import List, Optional, Type, TypeVar
from pydantic import BaseModel, Field

import instructor
import google.generativeai as genai

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize LangSmith if configured
if getattr(settings, "LANGSMITH_API_KEY", None) and getattr(settings, "LANGSMITH_TRACING", False):
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGSMITH_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = getattr(settings, "LANGSMITH_PROJECT", "outreach-platform")
    logger.info("LangSmith observability tracing enabled.")

# Initialize Langfuse client if credentials exist
_langfuse_client = None
def get_langfuse():
    global _langfuse_client
    if _langfuse_client is None and getattr(settings, "LANGFUSE_PUBLIC_KEY", None) and getattr(settings, "LANGFUSE_SECRET_KEY", None):
        try:
            from langfuse import Langfuse
            _langfuse_client = Langfuse(
                public_key=settings.LANGFUSE_PUBLIC_KEY,
                secret_key=settings.LANGFUSE_SECRET_KEY,
                host=getattr(settings, "LANGFUSE_HOST", "https://cloud.langfuse.com"),
            )
            logger.info("Langfuse observability client initialized.")
        except Exception as e:
            logger.warning(f"Could not initialize Langfuse: {e}")
    return _langfuse_client


# === STRUCTURED OUTPUT SCHEMAS =========================================

class ClinicalTriageSchema(BaseModel):
    """Guaranteed structured output for clinical triage assessment."""
    status: str = Field(description="One of: routine, concerning, urgent, critical")
    severity_score: int = Field(ge=1, le=10, description="Clinical severity from 1 (routine) to 10 (life threatening)")
    relevant_evidence: List[str] = Field(default_factory=list, description="Specific patient reported findings and symptoms")
    protocol_references: List[str] = Field(default_factory=list, description="Hospital protocols cited")
    risk_factors: List[str] = Field(default_factory=list, description="Identified risk factors")
    confidence: str = Field(default="high", description="high, moderate, or low")
    recommended_escalation: bool = Field(description="True if physician/nurse escalation is required")
    reasoning: str = Field(description="Clinical rationale for this triage decision")


class CouncilVoteSchema(BaseModel):
    """Guaranteed structured output for escalation council arbiter votes."""
    role: str = Field(description="Clinical arbiter role name")
    vote: str = Field(description="ESCALATE or ROUTINE_FOLLOW_UP")
    severity: str = Field(description="critical, high, moderate, or low")
    concerns: List[str] = Field(default_factory=list, description="Primary clinical concerns identified")
    rationale: str = Field(description="Clinical rationale for this vote")


class SOAPDocumentationSchema(BaseModel):
    """Guaranteed structured output for post-outreach SOAP clinical notes."""
    subjective: str = Field(description="Patient reported feelings, symptoms, and responses")
    objective: str = Field(description="Extracted vitals, adherence stats, and protocol metrics")
    assessment: str = Field(description="Clinical impression and risk evaluation")
    plan: str = Field(description="Follow-up cadence, medication reminders, or escalation orders")


# === INSTRUCTOR GEMINI CLIENT =========================================

INSTRUCTOR_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-3.5-flash-lite",
]

T = TypeVar("T", bound=BaseModel)

def call_instructor_gemini(
    response_model: Type[T],
    prompt: str,
    system_instruction: str = "You are a clinical AI specialist. Provide strict structured assessment.",
) -> Optional[T]:
    """Execute structured LLM call with Instructor, returning validated Pydantic model.
    
    Tries fast Gemini models in sequence. Returns None if all fail, allowing seamless fallback.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("No GEMINI_API_KEY set, skipping Instructor call.")
        return None

    genai.configure(api_key=settings.GEMINI_API_KEY)

    for model_name in INSTRUCTOR_MODELS:
        try:
            base_model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={"temperature": 0.1}
            )
            client = instructor.from_gemini(client=base_model, mode=instructor.Mode.GEMINI_JSON)

            # Trace with Langfuse if enabled
            lf = get_langfuse()
            trace = None
            if lf:
                try:
                    trace = lf.trace(name="clinical_structured_call", metadata={"model": model_name, "schema": response_model.__name__})
                except Exception:
                    pass

            result = client.chat.completions.create(
                response_model=response_model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt},
                ],
            )

            if trace:
                try:
                    trace.update(output=result.model_dump())
                except Exception:
                    pass

            return result

        except Exception as e:
            logger.warning(f"Instructor model {model_name} failed for {response_model.__name__} ({e}).")
            continue

    logger.warning("All Instructor Gemini models exhausted. Gracefully falling back.")
    return None
