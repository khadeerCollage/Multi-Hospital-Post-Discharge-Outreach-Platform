import ssl
import asyncio
import logging
from urllib.parse import unquote
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

logger = logging.getLogger(__name__)

# Create SSL context for Neon PostgreSQL
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Process DATABASE_URL:
# 1. URL-decode %20 -> spaces in db name
# 2. Strip ssl= param (handled via connect_args)
db_url = unquote(settings.DATABASE_URL)
if "?ssl=require" in db_url:
    db_url = db_url.replace("?ssl=require", "")
elif "&ssl=require" in db_url:
    db_url = db_url.replace("&ssl=require", "")

# ── Neon Serverless & PgBouncer-Optimized Engine ─────────────────────────────
# Key optimizations for Neon serverless PostgreSQL:
# 1. pool_pre_ping=True: Tests connections before checkout; discards dead/suspended sockets.
# 2. pool_recycle=180: Re-creates connections every 3 minutes, preventing stale connection timeouts from Neon auto-suspend.
# 3. pool_size=10, max_overflow=10: Sized for concurrent outreach worker tasks and UI requests.
# 4. timeout=30.0: Increases asyncpg connect/auth timeout from 10s to 30s so Neon compute wake-up has sufficient time.
# 5. statement_cache_size=0: REQUIRED for Neon PgBouncer pooler mode (avoids prepared statement collisions).
# 6. command_timeout=60.0: Prevents hung queries.
engine = create_async_engine(
    db_url,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,
    pool_recycle=180,
    pool_size=10,
    max_overflow=10,
    pool_timeout=30.0,
    connect_args={
        "ssl": ssl_context,
        "timeout": 30.0,
        "command_timeout": 60.0,
        "statement_cache_size": 0,
        "server_settings": {
            "application_name": "mhpdop-backend"
        }
    }
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an AsyncSession.
    Automatically retries once if a Neon cold-start / wake-up timeout occurs.
    """
    max_retries = 2
    for attempt in range(max_retries):
        try:
            async with async_session() as session:
                yield session
                return
        except Exception as exc:
            err_msg = str(exc)
            is_neon_disconnect = (
                "Authentication timed out" in err_msg
                or "ProtocolViolationError" in err_msg
                or "Connection reset" in err_msg
                or "SSL connection has been closed" in err_msg
                or "server closed the connection" in err_msg
                or "connection was closed" in err_msg
            )
            if is_neon_disconnect and attempt < max_retries - 1:
                logger.warning(
                    f"Neon DB connection dropped or cold-start (attempt {attempt + 1}). "
                    "Disposing pool and retrying..."
                )
                await engine.dispose()
                await asyncio.sleep(1.5)
                continue
            raise


@asynccontextmanager
async def get_robust_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for background jobs (scheduler, workers) with cold-start retry.
    """
    max_retries = 2
    for attempt in range(max_retries):
        try:
            async with async_session() as session:
                yield session
                return
        except Exception as exc:
            err_msg = str(exc)
            is_neon_disconnect = (
                "Authentication timed out" in err_msg
                or "ProtocolViolationError" in err_msg
                or "Connection reset" in err_msg
                or "SSL connection has been closed" in err_msg
                or "server closed the connection" in err_msg
                or "connection was closed" in err_msg
            )
            if is_neon_disconnect and attempt < max_retries - 1:
                logger.warning(
                    f"Neon DB connection dropped in background task (attempt {attempt + 1}). Retrying..."
                )
                await engine.dispose()
                await asyncio.sleep(1.5)
                continue
            raise


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
