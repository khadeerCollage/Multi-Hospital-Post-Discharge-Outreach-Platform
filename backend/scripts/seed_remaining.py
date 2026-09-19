"""Seed Protocols and Sample Campaigns into the existing database."""
import asyncio
import json
import random
import uuid
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import async_session
from scripts.seed_data import PROTOCOLS, HOSPITALS

async def seed_remaining():
    print("🏥 Checking and seeding clinical protocols and campaigns...")
    async with async_session() as session:
        # Get existing hospitals
        result = await session.execute(text("SELECT id, code FROM hospitals"))
        hospitals = result.fetchall()
        if not hospitals:
            print("❌ No hospitals found. Run seed_data first.")
            return
        hospital_ids = {h.code: str(h.id) for h in hospitals}

        # Check protocols count
        p_count = (await session.execute(text("SELECT COUNT(*) FROM clinical_protocols"))).scalar()
        if p_count == 0:
            print("📝 Seeding clinical protocols...")
            for code, protocol_data in PROTOCOLS.items():
                if code not in hospital_ids:
                    continue
                h_id = hospital_ids[code]
                await session.execute(text("""
                    INSERT INTO clinical_protocols (id, tenant_id, name, condition_type,
                        description, follow_up_questions, red_flag_symptoms,
                        escalation_indicators, approved_guidance,
                        contact_window_hours, priority_level, is_active, version,
                        created_at, updated_at)
                    VALUES (:id, :tid, :name, :ctype, :desc, :questions, :red_flags,
                        :escalation, :guidance, 72, 'standard', true, '1.0', NOW(), NOW())
                """), {
                    "id": str(uuid.uuid4()),
                    "tid": h_id,
                    "name": protocol_data["name"],
                    "ctype": protocol_data["condition_type"],
                    "desc": f"Standard {protocol_data['condition_type']} post-discharge protocol",
                    "questions": json.dumps(protocol_data["follow_up_questions"]),
                    "red_flags": json.dumps(protocol_data["red_flag_symptoms"]),
                    "escalation": json.dumps(protocol_data["escalation_indicators"]),
                    "guidance": json.dumps(protocol_data["approved_guidance"]),
                })
            await session.commit()
            print("✅ 3 Clinical protocols created successfully!")
        else:
            print(f"ℹ️ Clinical protocols already exist ({p_count})")

        # Check campaigns count
        c_count = (await session.execute(text("SELECT COUNT(*) FROM campaigns"))).scalar()
        if c_count == 0:
            print("📢 Seeding sample campaigns...")
            now = datetime.utcnow()
            for code, h_id in hospital_ids.items():
                campaign_id = str(uuid.uuid4())
                user_result = await session.execute(text(
                    "SELECT id FROM users WHERE tenant_id = :tid AND role = 'campaign_manager' LIMIT 1"
                ), {"tid": h_id})
                user_row = user_result.fetchone()
                created_by = str(user_row.id) if user_row else None

                # Find max concurrent calls
                h_match = next((h for h in HOSPITALS if h["code"] == code), {"max_concurrent_calls": 10})
                max_calls = h_match["max_concurrent_calls"]

                await session.execute(text("""
                    INSERT INTO campaigns (id, tenant_id, name, description, status,
                        target_risk_levels, follow_up_window_start, follow_up_window_end,
                        calling_hours_start, calling_hours_end, max_concurrent_calls,
                        max_retries, priority_boost, created_by, total_eligible,
                        total_completed, total_escalated, created_at, updated_at)
                    VALUES (:id, :tid, :name, :desc, 'DRAFT',
                        :risks, :start, :end, '09:00', '18:00', :max_calls,
                        5, 0.0, :created_by, 100, 0, 0, NOW(), NOW())
                """), {
                    "id": campaign_id,
                    "tid": h_id,
                    "name": f"{code.replace('_', ' ').title()} - Post-Discharge Follow-Up",
                    "desc": f"Automated post-discharge outreach for {code.replace('_', ' ').title()} patients",
                    "risks": json.dumps(["critical", "high", "moderate", "low", "routine"]),
                    "start": now - timedelta(hours=2),
                    "end": now + timedelta(hours=70),
                    "max_calls": max_calls,
                    "created_by": created_by,
                })
            await session.commit()
            print("✅ Sample campaigns created successfully!")
        else:
            print(f"ℹ️ Campaigns already exist ({c_count})")

if __name__ == "__main__":
    asyncio.run(seed_remaining())
