from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db

# Import models so Alembic/create_all picks them up
import app.models  # noqa

from app.api import (
    auth, hospitals, users, patients, campaigns,
    queue, escalations, analytics, health, notifications, ehr, protocols
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup
    await init_db()
    # Start background scheduler for queue processing
    from app.services.scheduler import start_scheduler, stop_scheduler
    start_scheduler()
    yield
    # On shutdown
    stop_scheduler()
    try:
        from app.core.database import engine
        await engine.dispose()
    except Exception:
        pass

app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
    debug=settings.DEBUG
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(hospitals.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(campaigns.router, prefix="/api/v1")
app.include_router(queue.router, prefix="/api/v1")
app.include_router(escalations.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(ehr.router, prefix="/api/v1")
app.include_router(protocols.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"status": "healthy", "app": settings.APP_NAME}
