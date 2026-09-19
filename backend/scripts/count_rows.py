"""Count rows in each table."""
import asyncio
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import async_session
from sqlalchemy import text

async def count():
    tables = ["hospitals","users","patients","encounters","care_plans","campaigns","clinical_protocols","outreach_tasks"]
    async with async_session() as s:
        for t in tables:
            r = await s.execute(text(f"SELECT COUNT(*) FROM {t}"))
            print(f"{t}: {r.scalar()}")

if __name__ == "__main__":
    asyncio.run(count())
