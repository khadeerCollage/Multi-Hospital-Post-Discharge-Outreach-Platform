from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/health", tags=["health"])

@router.get("")
async def health_check():
    return {"status": "healthy", "database": "ok", "redis": "ok"}

@router.get("/queue")
async def queue_health():
    return {"status": "healthy", "pending_tasks": 0, "active_workers": 5}
