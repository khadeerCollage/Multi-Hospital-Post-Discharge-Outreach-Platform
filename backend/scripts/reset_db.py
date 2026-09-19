"""Drop all tables and re-create them."""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, Base
import app.models  # noqa

async def reset():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        print("All tables dropped")
        await conn.run_sync(Base.metadata.create_all)
        print("All tables re-created")

if __name__ == "__main__":
    asyncio.run(reset())
