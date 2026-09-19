import logging
from typing import List, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings

logger = logging.getLogger(__name__)

# Preferred models in order of priority (Fastest 1-second lite models first, zero-delay failover)
MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.7-flash",
]

def get_llm(temperature: float = 0.2, model_idx: int = 0) -> ChatGoogleGenerativeAI:
    """Get ChatGoogleGenerativeAI instance with configured model."""
    model_name = MODELS[min(model_idx, len(MODELS) - 1)]
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=settings.GEMINI_API_KEY,
        temperature=temperature,
        max_retries=0,
        request_timeout=10.0,
    )

def invoke_with_model_fallback(messages: list, temperature: float = 0.2):
    """Invoke LLM with automatic fast fallback to secondary models without retry lag."""
    last_error = None
    for idx, model_name in enumerate(MODELS):
        try:
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=settings.GEMINI_API_KEY,
                temperature=temperature,
                max_retries=0,
                request_timeout=10.0,
            )
            return llm.invoke(messages)
        except Exception as e:
            err_str = str(e).lower()
            logger.warning(f"Model {model_name} failed: {e}")
            last_error = e
            if "429" in err_str or "quota" in err_str or "not found" in err_str or "404" in err_str or "timeout" in err_str or "resourceexhausted" in err_str:
                continue
            else:
                break
    raise last_error
