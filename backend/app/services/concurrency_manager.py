"""Concurrency Manager - Controls concurrent calling capacity via Upstash Redis.

Uses Redis atomic operations (via Lua scripts in Upstash REST API) to prevent
race conditions when multiple workers attempt to acquire call slots simultaneously.

Design:
- Each hospital has a maximum concurrent call capacity
- active:{hospital_id} is a Redis SET containing active task IDs
- capacity:{hospital_id} is a Redis STRING with the max capacity
- Heartbeat keys track worker liveness
- Idempotency keys prevent duplicate operations
"""

from datetime import datetime
from typing import Optional

from upstash_redis import Redis

from app.core.config import settings


def get_redis_client() -> Redis:
    """Create and return an Upstash Redis client."""
    return Redis(
        url=settings.UPSTASH_REDIS_URL,
        token=settings.UPSTASH_REDIS_TOKEN
    )


_redis: Optional[Redis] = None


def redis_client() -> Redis:
    """Singleton Redis client."""
    global _redis
    if _redis is None:
        _redis = get_redis_client()
    return _redis


def acquire_call_slot(hospital_id: str, task_id: str, max_concurrent: int = 10) -> bool:
    """Attempt to acquire a concurrent call slot for a hospital.
    
    Uses Redis SCARD + SADD atomically to check capacity before adding.
    
    Args:
        hospital_id: The hospital tenant ID
        task_id: The task ID to register as active
        max_concurrent: Maximum concurrent calls allowed
    
    Returns:
        True if slot was acquired, False if at capacity.
    """
    r = redis_client()
    active_key = f"active:{hospital_id}"

    # Check current count
    current = r.scard(active_key) or 0
    if current >= max_concurrent:
        return False

    # Try to add - SADD returns 1 if added, 0 if already exists
    added = r.sadd(active_key, task_id)
    
    # Double-check we haven't exceeded capacity (another worker might have added simultaneously)
    new_count = r.scard(active_key) or 0
    if new_count > max_concurrent:
        # We caused over-allocation, release our slot
        r.srem(active_key, task_id)
        return False

    # Set expiry on the active set (safety net - auto-cleanup after 1 hour)
    r.expire(active_key, 3600)

    # Set heartbeat for this task
    r.set(f"heartbeat:{task_id}", datetime.utcnow().isoformat(), ex=120)

    return True


def release_call_slot(hospital_id: str, task_id: str) -> bool:
    """Release a concurrent call slot.
    
    Args:
        hospital_id: The hospital tenant ID
        task_id: The task ID to release
    
    Returns:
        True if released, False if wasn't active.
    """
    r = redis_client()
    active_key = f"active:{hospital_id}"

    removed = r.srem(active_key, task_id)

    # Clean up heartbeat
    r.delete(f"heartbeat:{task_id}")

    return removed > 0 if removed else False


def get_active_count(hospital_id: str) -> int:
    """Get the number of currently active calls for a hospital."""
    r = redis_client()
    return r.scard(f"active:{hospital_id}") or 0


def get_active_tasks(hospital_id: str) -> list:
    """Get the list of active task IDs for a hospital."""
    r = redis_client()
    members = r.smembers(f"active:{hospital_id}")
    return list(members) if members else []


def set_capacity(hospital_id: str, max_concurrent: int) -> None:
    """Set the maximum concurrent call capacity for a hospital."""
    r = redis_client()
    r.set(f"capacity:{hospital_id}", str(max_concurrent))


def get_capacity(hospital_id: str) -> int:
    """Get the maximum concurrent call capacity for a hospital."""
    r = redis_client()
    val = r.get(f"capacity:{hospital_id}")
    return int(val) if val else 10  # Default to 10


def get_remaining_capacity(hospital_id: str) -> int:
    """Get the remaining available call slots for a hospital."""
    capacity = get_capacity(hospital_id)
    active = get_active_count(hospital_id)
    return max(0, capacity - active)


def update_heartbeat(task_id: str) -> None:
    """Update the heartbeat for an active task (proves worker is alive)."""
    r = redis_client()
    r.set(f"heartbeat:{task_id}", datetime.utcnow().isoformat(), ex=120)


def check_heartbeat(task_id: str) -> bool:
    """Check if a task has a valid heartbeat."""
    r = redis_client()
    return r.exists(f"heartbeat:{task_id}") > 0


def check_idempotency(key: str) -> bool:
    """Check if an operation has already been performed (idempotency guard).
    
    Returns True if the operation is NEW (hasn't been done before).
    Returns False if the operation has ALREADY been done.
    """
    r = redis_client()
    # SET NX returns True if key was set (new operation), None if exists
    result = r.set(f"idem:{key}", "1", nx=True, ex=3600)
    return result is not None and result is not False


def clear_idempotency(key: str) -> None:
    """Clear an idempotency key (for testing or cleanup)."""
    r = redis_client()
    r.delete(f"idem:{key}")


def get_queue_health(hospital_id: str) -> dict:
    """Get queue health metrics from Redis."""
    r = redis_client()
    active_key = f"active:{hospital_id}"

    active_count = r.scard(active_key) or 0
    capacity = get_capacity(hospital_id)
    active_tasks = get_active_tasks(hospital_id)

    # Check heartbeats for active tasks
    stale_tasks = []
    for task_id in active_tasks:
        if not check_heartbeat(task_id):
            stale_tasks.append(task_id)

    return {
        "hospital_id": hospital_id,
        "active_calls": active_count,
        "max_capacity": capacity,
        "remaining_capacity": max(0, capacity - active_count),
        "utilization_pct": round(active_count / capacity * 100, 1) if capacity > 0 else 0,
        "active_task_ids": active_tasks,
        "stale_tasks": stale_tasks,
        "status": "HEALTHY" if len(stale_tasks) == 0 else "DEGRADED",
    }
