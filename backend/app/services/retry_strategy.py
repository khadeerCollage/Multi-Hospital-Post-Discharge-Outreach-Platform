"""Retry Strategy with Exponential Backoff.

Different call outcomes have different retry behaviors:
- No Answer: 15 min initial, 2x exponential backoff, max 5 retries
- Busy: 5 min initial, 1.5x backoff, max 4 retries  
- Voicemail: 30 min initial, 2x backoff, max 3 retries
- Dropped: 2 min initial, linear +5min, max 3 retries
- Invalid Number: No retry, immediate MANUAL_FOLLOW_UP

Design rationale:
- No Answer: Patient may be unavailable; space out attempts
- Busy: Short-term unavailability; retry sooner with moderate backoff
- Voicemail: Patient not answering; longer waits between attempts
- Dropped: Technical issue; retry quickly but with increasing gaps
- Invalid Number: Data quality issue; requires human intervention
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class RetryConfig:
    initial_delay_minutes: float
    backoff_multiplier: float
    max_retries: int
    backoff_type: str  # 'exponential' or 'linear'
    linear_increment_minutes: float = 0.0


# Retry configuration per outcome type
RETRY_CONFIGS = {
    "NO_ANSWER": RetryConfig(
        initial_delay_minutes=15.0,
        backoff_multiplier=2.0,
        max_retries=5,
        backoff_type="exponential"
    ),
    "BUSY": RetryConfig(
        initial_delay_minutes=5.0,
        backoff_multiplier=1.5,
        max_retries=4,
        backoff_type="exponential"
    ),
    "VOICEMAIL": RetryConfig(
        initial_delay_minutes=30.0,
        backoff_multiplier=2.0,
        max_retries=3,
        backoff_type="exponential"
    ),
    "DROPPED": RetryConfig(
        initial_delay_minutes=2.0,
        backoff_multiplier=1.0,
        max_retries=3,
        backoff_type="linear",
        linear_increment_minutes=5.0
    ),
    "TECHNICAL_FAILURE": RetryConfig(
        initial_delay_minutes=5.0,
        backoff_multiplier=2.0,
        max_retries=3,
        backoff_type="exponential"
    ),
}

# No retry for these outcomes
NO_RETRY_OUTCOMES = {"INVALID_NUMBER", "PATIENT_DECLINED", "COMPLETED", "ESCALATED"}

# Maximum delay cap (prevent absurdly long waits)
MAX_DELAY_MINUTES = 120.0  # 2 hours


def calculate_retry_delay(outcome: str, attempt_count: int) -> Optional[float]:
    """Calculate the retry delay in minutes based on outcome and attempt count.
    
    Args:
        outcome: The call outcome (NO_ANSWER, BUSY, VOICEMAIL, DROPPED, etc.)
        attempt_count: Number of attempts already made (1-indexed)
    
    Returns:
        Delay in minutes before next retry, or None if no retry should be scheduled.
    """
    if outcome in NO_RETRY_OUTCOMES:
        return None

    config = RETRY_CONFIGS.get(outcome)
    if config is None:
        # Unknown outcome: use conservative defaults
        config = RETRY_CONFIGS["NO_ANSWER"]

    if attempt_count >= config.max_retries:
        return None  # Max retries exceeded

    if config.backoff_type == "exponential":
        delay = config.initial_delay_minutes * (config.backoff_multiplier ** (attempt_count - 1))
    elif config.backoff_type == "linear":
        delay = config.initial_delay_minutes + (config.linear_increment_minutes * (attempt_count - 1))
    else:
        delay = config.initial_delay_minutes

    return min(delay, MAX_DELAY_MINUTES)


def should_retry(outcome: str, attempt_count: int, max_retries: int = None) -> bool:
    """Determine if a call should be retried based on outcome and attempt count.
    
    Args:
        outcome: The call outcome
        attempt_count: Number of attempts already made
        max_retries: Override max retries (from campaign config)
    
    Returns:
        True if the call should be retried, False otherwise.
    """
    if outcome in NO_RETRY_OUTCOMES:
        return False

    config = RETRY_CONFIGS.get(outcome)
    if config is None:
        return False

    effective_max = max_retries if max_retries is not None else config.max_retries
    return attempt_count < effective_max


def get_retry_info(outcome: str, attempt_count: int) -> dict:
    """Get detailed retry information for an outcome.
    
    Returns:
        Dict with retry decision, delay, and explanation.
    """
    if outcome in NO_RETRY_OUTCOMES:
        return {
            "should_retry": False,
            "reason": f"Outcome '{outcome}' does not warrant retry",
            "delay_minutes": None,
            "next_attempt": None,
        }

    config = RETRY_CONFIGS.get(outcome)
    if config is None:
        return {
            "should_retry": False,
            "reason": f"Unknown outcome '{outcome}' - defaulting to no retry",
            "delay_minutes": None,
            "next_attempt": None,
        }

    if attempt_count >= config.max_retries:
        return {
            "should_retry": False,
            "reason": f"Maximum retries ({config.max_retries}) reached for outcome '{outcome}'",
            "delay_minutes": None,
            "next_attempt": None,
        }

    delay = calculate_retry_delay(outcome, attempt_count)

    return {
        "should_retry": True,
        "reason": f"Retry #{attempt_count + 1}/{config.max_retries} after {delay:.0f}min ({config.backoff_type} backoff)",
        "delay_minutes": delay,
        "next_attempt": attempt_count + 1,
        "backoff_type": config.backoff_type,
        "max_retries": config.max_retries,
    }
