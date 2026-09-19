import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_tenant_context, get_password_hash
from app.core.tenant import TenantContext
from app.models.user import User
from app.schemas.auth import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/users", tags=["users"])

@router.post("", response_model=UserResponse)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    if tenant_context.role not in ["platform_admin", "hospital_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to create users")
        
    if tenant_context.role == "hospital_admin":
        if user_in.tenant_id != tenant_context.tenant_id:
            raise HTTPException(status_code=403, detail="Can only create users for own hospital")
            
    hashed_password = get_password_hash(user_in.password)
    user_data = user_in.model_dump(exclude={"password"})
    user_data["hashed_password"] = hashed_password
    
    user = User(**user_data)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.get("", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    query = select(User)
    if tenant_context.role != "platform_admin":
        query = query.where(User.tenant_id == tenant_context.tenant_id)
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.tenant_id and not tenant_context.has_access_to(user.tenant_id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.tenant_id and not tenant_context.has_access_to(user.tenant_id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    update_data = user_in.model_dump(exclude_unset=True, exclude={"password"})
    if user_in.password:
        update_data["hashed_password"] = get_password_hash(user_in.password)
        
    for field, value in update_data.items():
        setattr(user, field, value)
        
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    if tenant_context.role not in ["platform_admin", "hospital_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete users")

    if user_id == tenant_context.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own active account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.tenant_id and not tenant_context.has_access_to(user.tenant_id):
        raise HTTPException(status_code=403, detail="Not authorized to delete users outside your tenant")

    await db.delete(user)
    await db.commit()
    return {"status": "deleted", "id": str(user_id)}

