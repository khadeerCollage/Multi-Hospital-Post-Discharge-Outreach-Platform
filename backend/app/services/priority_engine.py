"""Priority Scoring Engine for the Outbound Call Queue.

Calculates a priority score for each outreach task based on:
- Clinical risk level
- Time urgency (approaching clinical cutoff)
- Window progress (last third of window gets boosted)
- Anti-starvation aging boost
- Attempt penalty (avoid over-retrying one patient)
- Campaign priority boost

This algorithm ensures:
1. Critical patients are called first
2. Patients near cutoff get urgency boost
3. No patient starves in the queue forever
4. Patients with many failed attempts don't block others
"""

from datetime import datetime


# Risk level weights - higher = more urgent
RISK_WEIGHTS = {
    "critical": 100,
    "high": 70,
    "moderate": 40,
    "low": 20,
    "routine": 10,
}


def calculate_priority_score(
    risk_level: str,
    clinical_cutoff_at: datetime,
    campaign_start: datetime,
    attempt_count: int = 0,
    waiting_since: datetime = None,
    campaign_priority_boost: float = 0.0,
    callback_requested: bool = False,
    now: datetime = None,
) -> float:
    """Calculate the priority score for a patient outreach task.
    
    Higher score = higher priority = gets called sooner.
    
    Components:
    - Base risk weight (0-100): From patient's clinical risk level
    - Time urgency (0-50): Increases as clinical cutoff approaches
    - Window boost (+30): Applied in the last third of the follow-up window
    - Aging boost (0-15): Grows the longer a patient waits in queue
    - Attempt penalty (-5 per attempt): Reduces priority for frequently retried patients
    - Campaign boost: Additional boost from campaign configuration
    - Callback boost (+20): Patients who requested callbacks get priority
    
    Returns:
        float: Priority score (higher = more urgent, typically 10-200)
    """
    if now is None:
        now = datetime.utcnow()

    # 1. Base risk weight
    base_score = RISK_WEIGHTS.get(risk_level, 10)

    # 2. Time urgency: exponentially increases as cutoff approaches
    hours_until_cutoff = max(0, (clinical_cutoff_at - now).total_seconds() / 3600)
    if hours_until_cutoff <= 0:
        time_urgency = 50  # Maximum urgency - already past cutoff
    else:
        time_urgency = min(50, 50.0 / (hours_until_cutoff + 1))

    # 3. Window progress boost
    if campaign_start:
        total_window = (clinical_cutoff_at - campaign_start).total_seconds()
        elapsed = (now - campaign_start).total_seconds()
        if total_window > 0:
            window_progress = elapsed / total_window
            window_boost = 30.0 if window_progress > 0.66 else (10.0 if window_progress > 0.33 else 0.0)
        else:
            window_boost = 0.0
    else:
        window_boost = 0.0

    # 4. Anti-starvation aging boost
    if waiting_since:
        waiting_minutes = (now - waiting_since).total_seconds() / 60
        aging_boost = min(waiting_minutes * 0.2, 15.0)
    else:
        aging_boost = 0.0

    # 5. Attempt penalty (diminishing returns on retries)
    attempt_penalty = attempt_count * 5.0

    # 6. Callback boost - patients who asked to be called back deserve priority
    cb_boost = 20.0 if callback_requested else 0.0

    # Final score
    score = (
        base_score
        + time_urgency
        + window_boost
        + aging_boost
        - attempt_penalty
        + campaign_priority_boost
        + cb_boost
    )

    return round(max(0, score), 2)


def explain_priority_score(
    risk_level: str,
    clinical_cutoff_at: datetime,
    campaign_start: datetime,
    attempt_count: int = 0,
    waiting_since: datetime = None,
    campaign_priority_boost: float = 0.0,
    callback_requested: bool = False,
    now: datetime = None,
) -> dict:
    """Calculate priority score with a breakdown explanation.
    
    Returns a dict with the score and component breakdown, useful for
    answering evaluator questions like:
    'Why was this patient called before that patient?'
    """
    if now is None:
        now = datetime.utcnow()

    base_score = RISK_WEIGHTS.get(risk_level, 10)

    hours_until_cutoff = max(0, (clinical_cutoff_at - now).total_seconds() / 3600)
    time_urgency = min(50, 50.0 / (hours_until_cutoff + 1)) if hours_until_cutoff > 0 else 50.0

    total_window = (clinical_cutoff_at - campaign_start).total_seconds() if campaign_start else 0
    elapsed = (now - campaign_start).total_seconds() if campaign_start else 0
    window_progress = elapsed / total_window if total_window > 0 else 0
    window_boost = 30.0 if window_progress > 0.66 else (10.0 if window_progress > 0.33 else 0.0)

    waiting_minutes = (now - waiting_since).total_seconds() / 60 if waiting_since else 0
    aging_boost = min(waiting_minutes * 0.2, 15.0)

    attempt_penalty = attempt_count * 5.0
    cb_boost = 20.0 if callback_requested else 0.0

    total = base_score + time_urgency + window_boost + aging_boost - attempt_penalty + campaign_priority_boost + cb_boost

    return {
        "total_score": round(max(0, total), 2),
        "breakdown": {
            "risk_weight": {"value": base_score, "reason": f"Risk level: {risk_level}"},
            "time_urgency": {"value": round(time_urgency, 2), "reason": f"{hours_until_cutoff:.1f}h until cutoff"},
            "window_boost": {"value": window_boost, "reason": f"Window {window_progress:.0%} complete"},
            "aging_boost": {"value": round(aging_boost, 2), "reason": f"Waiting {waiting_minutes:.0f} minutes"},
            "attempt_penalty": {"value": -attempt_penalty, "reason": f"{attempt_count} previous attempts"},
            "campaign_boost": {"value": campaign_priority_boost, "reason": "Campaign priority setting"},
            "callback_boost": {"value": cb_boost, "reason": "Patient requested callback" if callback_requested else "No callback"},
        },
        "hours_until_cutoff": round(hours_until_cutoff, 1),
        "window_progress_pct": round(window_progress * 100, 1),
    }
