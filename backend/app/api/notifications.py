import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_tenant_context
from app.core.tenant import TenantContext
from app.models.notification import Notification
# We can create a quick schema here or just return dicts. Let's return dicts for brevity.

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    query = select(Notification).where(Notification.user_id == tenant_context.user_id)
    result = await db.execute(query)
    notifications = result.scalars().all()
    return {"items": notifications}

@router.put("/{id}/read")
async def mark_read(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(Notification).where(Notification.id == id, Notification.user_id == tenant_context.user_id))
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notification.is_read = True
    await db.commit()
    return {"message": "Notification marked as read"}

@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    query = select(func.count(Notification.id)).where(
        Notification.user_id == tenant_context.user_id,
        Notification.is_read == False
    )
    result = await db.execute(query)
    count = result.scalar_one()
    return {"count": count}
