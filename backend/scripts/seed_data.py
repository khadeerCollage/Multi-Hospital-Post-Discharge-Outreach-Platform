"""Seed Data Script - Populates the database with realistic demo data.

Creates:
- 3 hospitals (City General, Metro Heart Center, Valley Medical)
- 1 platform admin + 3 hospital admins + 3 campaign managers + 3 clinical reviewers
- 300 patients (100 per hospital) with varied risk levels and conditions
- 3 encounters per hospital (recent discharges)
- Clinical protocols per hospital
- Sample campaigns

Run: python -m scripts.seed_data
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta, date

from sqlalchemy import text

# Add parent directory to path for imports
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, async_session, init_db
from app.core.security import get_password_hash

# Import all models so they register with Base.metadata
import app.models  # noqa: F401


# ============================================================
# Hospital Data
# ============================================================
HOSPITALS = [
    {
        "name": "City General Hospital",
        "code": "CITY_GENERAL",
        "address": "100 Main Street, Springfield, IL 62701",
        "phone": "+1-555-100-0001",
        "timezone": "America/Chicago",
        "max_concurrent_calls": 10,
    },
    {
        "name": "Metro Heart Center",
        "code": "METRO_HEART",
        "address": "250 Cardiac Way, Springfield, IL 62702",
        "phone": "+1-555-200-0002",
        "timezone": "America/Chicago",
        "max_concurrent_calls": 8,
    },
    {
        "name": "Valley Medical Center",
        "code": "VALLEY_MEDICAL",
        "address": "500 Valley Road, Springfield, IL 62703",
        "phone": "+1-555-300-0003",
        "timezone": "America/Chicago",
        "max_concurrent_calls": 10,
    },
]

# ============================================================
# Patient Data Generators
# ============================================================
FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
    "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Christopher", "Karen", "Charles", "Lisa", "Daniel", "Nancy",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Dorothy", "Andrew", "Kimberly", "Paul", "Emily", "Joshua", "Donna",
    "Kenneth", "Michelle", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
    "Timothy", "Deborah",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
    "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen",
    "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera",
    "Campbell", "Mitchell", "Carter", "Roberts",
]

DIAGNOSES = {
    "CITY_GENERAL": [
        ("Laparoscopic Appendectomy", "general_surgery"),
        ("Inguinal Hernia Repair", "general_surgery"),
        ("Cholecystectomy", "general_surgery"),
        ("Knee Arthroscopy", "orthopedic"),
        ("Community Acquired Pneumonia", "respiratory"),
        ("Urinary Tract Infection", "general"),
        ("Cellulitis Treatment", "general"),
        ("Observation - Chest Pain Ruled Out", "cardiac"),
    ],
    "METRO_HEART": [
        ("Coronary Artery Bypass Graft", "cardiac"),
        ("Cardiac Stent Placement", "cardiac"),
        ("Heart Valve Replacement", "cardiac"),
        ("Cardiac Catheterization", "cardiac"),
        ("Heart Failure Exacerbation", "cardiac"),
        ("Atrial Fibrillation Management", "cardiac"),
        ("Pacemaker Implantation", "cardiac"),
        ("Aortic Aneurysm Repair", "cardiac"),
    ],
    "VALLEY_MEDICAL": [
        ("Total Hip Replacement", "orthopedic"),
        ("Total Knee Replacement", "orthopedic"),
        ("Spinal Fusion Surgery", "orthopedic"),
        ("Rotator Cuff Repair", "orthopedic"),
        ("Hip Fracture Repair", "orthopedic"),
        ("ACL Reconstruction", "orthopedic"),
        ("Carpal Tunnel Release", "orthopedic"),
        ("Lumbar Discectomy", "orthopedic"),
    ],
}

RISK_DISTRIBUTION = {
    "critical": 0.05,
    "high": 0.15,
    "moderate": 0.30,
    "low": 0.25,
    "routine": 0.25,
}

# ============================================================
# Clinical Protocols
# ============================================================
PROTOCOLS = {
    "CITY_GENERAL": {
        "name": "General Post-Surgical Follow-Up Protocol",
        "condition_type": "general_surgery",
        "follow_up_questions": [
            "How are you feeling since your discharge?",
            "Are you experiencing any pain? If so, how severe on a scale of 1-10?",
            "Have you noticed any redness, swelling, or drainage at your surgical site?",
            "Are you taking all your prescribed medications as directed?",
            "Have you had any fever or chills since you got home?",
            "Are you able to eat and drink normally?",
            "Have you been able to move around as instructed?",
            "Do you have any questions about your follow-up appointments?",
        ],
        "red_flag_symptoms": [
            "Fever over 101°F (38.3°C)",
            "Severe or worsening pain not controlled by medication",
            "Redness, swelling, or pus at surgical site",
            "Uncontrolled bleeding",
            "Difficulty breathing or shortness of breath",
            "Chest pain",
            "Persistent nausea or vomiting preventing medication compliance",
            "Signs of allergic reaction (rash, swelling, difficulty swallowing)",
        ],
        "escalation_indicators": [
            "Any red flag symptom reported",
            "Patient sounds confused or disoriented",
            "Patient reports taking wrong medication or wrong dose",
            "Patient unable to care for themselves safely",
            "Patient expressing severe distress or anxiety",
        ],
        "approved_guidance": [
            "Continue taking medications as prescribed by your doctor",
            "Keep your surgical site clean and dry",
            "Watch for signs of infection (redness, warmth, drainage)",
            "Contact your surgeon's office for non-urgent questions",
            "Go to the emergency room if you have severe symptoms",
            "Attend all scheduled follow-up appointments",
        ],
    },
    "METRO_HEART": {
        "name": "Cardiac Post-Discharge Follow-Up Protocol",
        "condition_type": "cardiac",
        "follow_up_questions": [
            "How are you feeling since your cardiac procedure?",
            "Are you experiencing any chest pain or discomfort?",
            "Have you noticed any shortness of breath or difficulty breathing?",
            "Are you taking all your heart medications as prescribed?",
            "Have you checked your blood pressure today? What was the reading?",
            "Have you noticed any swelling in your legs or ankles?",
            "Are you following your recommended diet (low sodium, etc.)?",
            "Have you been doing your cardiac rehabilitation exercises?",
            "Any dizziness, lightheadedness, or fainting episodes?",
        ],
        "red_flag_symptoms": [
            "Severe chest pain or pressure, especially radiating to arm, jaw, or back",
            "Sudden shortness of breath or difficulty breathing",
            "Heart racing, pounding, or irregular heartbeat",
            "Fainting or loss of consciousness",
            "Sudden severe headache",
            "Sudden weakness on one side of the body",
            "Rapid weight gain (more than 3 pounds in a day)",
            "Severe leg swelling or pain (possible blood clot)",
            "Bleeding that won't stop (if on blood thinners)",
            "Coughing up blood",
        ],
        "escalation_indicators": [
            "ANY cardiac red flag symptom",
            "Blood pressure significantly outside normal range",
            "Patient reporting medication non-compliance with critical cardiac drugs",
            "Patient sounds short of breath during conversation",
            "Patient reports syncopal episode",
            "New onset confusion or altered mental status",
        ],
        "approved_guidance": [
            "Take all heart medications exactly as prescribed",
            "Monitor your blood pressure and weight daily",
            "Follow your low-sodium diet plan",
            "Attend cardiac rehabilitation as scheduled",
            "Do not stop blood thinners without doctor approval",
            "Call 911 immediately for chest pain or stroke symptoms",
        ],
    },
    "VALLEY_MEDICAL": {
        "name": "Orthopedic Post-Surgical Follow-Up Protocol",
        "condition_type": "orthopedic",
        "follow_up_questions": [
            "How is your pain level since the surgery?",
            "Are you able to do your physical therapy exercises?",
            "Have you noticed any changes at the surgical site?",
            "Are you taking your pain medication as prescribed?",
            "Are you using your assistive devices (crutches, walker) as instructed?",
            "Have you noticed any swelling, redness, or warmth in your operated leg?",
            "Are you doing your deep breathing exercises to prevent blood clots?",
            "Have you been able to sleep comfortably?",
        ],
        "red_flag_symptoms": [
            "Severe pain not controlled by prescribed medication",
            "Wound opening, excessive bleeding, or pus drainage",
            "Fever over 101°F (38.3°C)",
            "Sudden calf swelling, pain, or warmth (possible DVT)",
            "Chest pain or sudden difficulty breathing (possible PE)",
            "Numbness or tingling beyond what was discussed",
            "Unable to bear weight as instructed",
            "Wound edges separating or breaking open",
        ],
        "escalation_indicators": [
            "ANY signs of deep vein thrombosis",
            "ANY signs of pulmonary embolism",
            "Wound infection signs",
            "Fall or injury to surgical area",
            "Medication error or overdose",
            "Patient unable to perform basic self-care",
        ],
        "approved_guidance": [
            "Ice the surgical area as directed (20 minutes on, 20 minutes off)",
            "Elevate the operated limb when resting",
            "Do your prescribed exercises regularly",
            "Use your walker or crutches as instructed",
            "Keep the surgical site clean and dry",
            "Wear compression stockings if prescribed",
        ],
    },
}


async def seed_database():
    """Main seed function - creates all demo data."""
    print("🏥 Starting database seeding...")

    # Initialize database (create tables)
    await init_db()
    print("✅ Database tables created")

    async with async_session() as session:
        # Check if already seeded
        result = await session.execute(text("SELECT COUNT(*) FROM hospitals"))
        count = result.scalar()
        if count and count > 0:
            print("⚠️ Database already seeded. Skipping...")
            return

        # ============================================================
        # Create Hospitals
        # ============================================================
        hospital_ids = {}
        for h in HOSPITALS:
            h_id = str(uuid.uuid4())
            hospital_ids[h["code"]] = h_id
            await session.execute(text("""
                INSERT INTO hospitals (id, name, code, address, phone, timezone,
                    calling_hours_start, calling_hours_end, max_concurrent_calls,
                    status, config, created_at, updated_at)
                VALUES (:id, :name, :code, :address, :phone, :timezone,
                    '09:00', '18:00', :max_calls, 'active', '{}', NOW(), NOW())
            """), {
                "id": h_id, "name": h["name"], "code": h["code"],
                "address": h["address"], "phone": h["phone"],
                "timezone": h["timezone"], "max_calls": h["max_concurrent_calls"],
            })
        await session.commit()
        print(f"✅ Created {len(HOSPITALS)} hospitals")

        # ============================================================
        # Create Users
        # ============================================================
        password_hash = get_password_hash("demo123")

        # Platform Admin
        admin_id = str(uuid.uuid4())
        await session.execute(text("""
            INSERT INTO users (id, tenant_id, email, hashed_password, full_name, role, is_active, created_at, updated_at)
            VALUES (:id, NULL, 'admin@platform.com', :pw, 'Platform Administrator', 'platform_admin', true, NOW(), NOW())
        """), {"id": admin_id, "pw": password_hash})

        # Hospital users
        for code, h_id in hospital_ids.items():
            short = code.lower().replace("_", "")

            # Hospital Admin
            await session.execute(text("""
                INSERT INTO users (id, tenant_id, email, hashed_password, full_name, role, is_active, created_at, updated_at)
                VALUES (:id, :tid, :email, :pw, :name, 'hospital_admin', true, NOW(), NOW())
            """), {
                "id": str(uuid.uuid4()), "tid": h_id,
                "email": f"admin@{short}.com", "pw": password_hash,
                "name": f"{code.replace('_', ' ').title()} Admin",
            })

            # Campaign Manager
            await session.execute(text("""
                INSERT INTO users (id, tenant_id, email, hashed_password, full_name, role, is_active, created_at, updated_at)
                VALUES (:id, :tid, :email, :pw, :name, 'campaign_manager', true, NOW(), NOW())
            """), {
                "id": str(uuid.uuid4()), "tid": h_id,
                "email": f"campaign@{short}.com", "pw": password_hash,
                "name": f"{code.replace('_', ' ').title()} Campaign Manager",
            })

            # Clinical Reviewer
            await session.execute(text("""
                INSERT INTO users (id, tenant_id, email, hashed_password, full_name, role, is_active, created_at, updated_at)
                VALUES (:id, :tid, :email, :pw, :name, 'clinical_reviewer', true, NOW(), NOW())
            """), {
                "id": str(uuid.uuid4()), "tid": h_id,
                "email": f"reviewer@{short}.com", "pw": password_hash,
                "name": f"Dr. {random.choice(LAST_NAMES)} (Clinical Reviewer)",
            })

        await session.commit()
        print("✅ Created 10 users (1 platform admin + 9 hospital staff)")

        # ============================================================
        # Create Patients (100 per hospital)
        # ============================================================
        risk_levels = []
        for risk, pct in RISK_DISTRIBUTION.items():
            risk_levels.extend([risk] * int(pct * 100))

        for code, h_id in hospital_ids.items():
            diagnoses = DIAGNOSES[code]

            for i in range(100):
                patient_id = str(uuid.uuid4())
                encounter_id = str(uuid.uuid4())
                risk = random.choice(risk_levels)
                diagnosis, condition_type = random.choice(diagnoses)
                first_name = random.choice(FIRST_NAMES)
                last_name = random.choice(LAST_NAMES)

                # Random DOB (20-85 years old)
                age = random.randint(20, 85)
                dob = date.today() - timedelta(days=age * 365)

                # Random discharge 1-5 days ago
                days_since_discharge = random.uniform(0.5, 4.5)
                discharge_time = datetime.utcnow() - timedelta(days=days_since_discharge)

                # Create patient
                await session.execute(text("""
                    INSERT INTO patients (id, tenant_id, mrn, first_name, last_name,
                        date_of_birth, gender, phone, email, risk_level,
                        communication_consent, preferred_language, created_at, updated_at)
                    VALUES (:id, :tid, :mrn, :fn, :ln, :dob, :gender, :phone, :email,
                        :risk, true, 'en', NOW(), NOW())
                """), {
                    "id": patient_id, "tid": h_id,
                    "mrn": f"MRN-{code[:4]}-{10000 + i}",
                    "fn": first_name, "ln": last_name,
                    "dob": dob, "gender": random.choice(["male", "female"]),
                    "phone": f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
                    "email": f"{first_name.lower()}.{last_name.lower()}{i}@email.com",
                    "risk": risk,
                })

                # Create encounter
                admission_time = discharge_time - timedelta(days=random.randint(1, 7))
                await session.execute(text("""
                    INSERT INTO encounters (id, tenant_id, patient_id, encounter_type,
                        status, admission_date, discharge_date, discharge_disposition,
                        primary_diagnosis, diagnosis_codes, care_setting,
                        attending_physician, discharge_instructions,
                        follow_up_required, follow_up_window_hours, created_at)
                    VALUES (:id, :tid, :pid, 'inpatient', 'discharged', :admit, :discharge,
                        'home', :diagnosis, :codes, :setting, :physician, :instructions,
                        true, :window, NOW())
                """), {
                    "id": encounter_id, "tid": h_id, "pid": patient_id,
                    "admit": admission_time, "discharge": discharge_time,
                    "diagnosis": diagnosis,
                    "codes": f'["{random.choice(["I25.1", "K80.0", "M17.1", "S72.0", "J18.9", "Z96.6"])}"]',
                    "setting": random.choice(["medical_ward", "surgical_ward", "cardiac_unit", "orthopedic_unit"]),
                    "physician": f"Dr. {random.choice(LAST_NAMES)}",
                    "instructions": f"Follow-up for {diagnosis}. Take medications as prescribed. Return if symptoms worsen.",
                    "window": 72,
                })

                # Create care plan
                await session.execute(text("""
                    INSERT INTO care_plans (id, tenant_id, patient_id, encounter_id,
                        status, instructions, medications, follow_up_appointments,
                        created_at)
                    VALUES (:id, :tid, :pid, :eid, 'active',
                        :instructions, :meds, :appts, NOW())
                """), {
                    "id": str(uuid.uuid4()), "tid": h_id,
                    "pid": patient_id, "eid": encounter_id,
                    "instructions": '{"general": "Rest, hydrate, take medications as prescribed"}',
                    "meds": '[{"name": "Acetaminophen", "dose": "500mg", "frequency": "every 6 hours as needed"}]',
                    "appts": '[{"type": "follow-up", "timeframe": "1-2 weeks"}]',
                })

            await session.commit()
            print(f"✅ Created 100 patients for {code}")

        # ============================================================
        # Create Clinical Protocols
        # ============================================================
        for code, protocol_data in PROTOCOLS.items():
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
                "id": str(uuid.uuid4()), "tid": h_id,
                "name": protocol_data["name"],
                "ctype": protocol_data["condition_type"],
                "desc": f"Standard {protocol_data['condition_type']} post-discharge protocol",
                "questions": str(protocol_data["follow_up_questions"]).replace("'", '"'),
                "red_flags": str(protocol_data["red_flag_symptoms"]).replace("'", '"'),
                "escalation": str(protocol_data["escalation_indicators"]).replace("'", '"'),
                "guidance": str(protocol_data["approved_guidance"]).replace("'", '"'),
            })
        await session.commit()
        print("✅ Created 3 clinical protocols")

        # ============================================================
        # Create Sample Campaigns
        # ============================================================
        now = datetime.utcnow()
        for code, h_id in hospital_ids.items():
            campaign_id = str(uuid.uuid4())

            # Get a user ID for created_by
            user_result = await session.execute(text(
                "SELECT id FROM users WHERE tenant_id = :tid AND role = 'campaign_manager' LIMIT 1"
            ), {"tid": h_id})
            user_row = user_result.fetchone()
            created_by = str(user_row.id) if user_row else admin_id

            await session.execute(text("""
                INSERT INTO campaigns (id, tenant_id, name, description, status,
                    target_risk_levels, follow_up_window_start, follow_up_window_end,
                    calling_hours_start, calling_hours_end, max_concurrent_calls,
                    max_retries, priority_boost, created_by, total_eligible,
                    created_at, updated_at)
                VALUES (:id, :tid, :name, :desc, 'DRAFT',
                    :risks, :start, :end, '09:00', '18:00', :max_calls,
                    5, 0.0, :created_by, 0, NOW(), NOW())
            """), {
                "id": campaign_id, "tid": h_id,
                "name": f"{code.replace('_', ' ').title()} - Post-Discharge Follow-Up (Batch {now.strftime('%b %d')})",
                "desc": f"Automated post-discharge outreach for {code.replace('_', ' ').title()} patients",
                "risks": '["critical", "high", "moderate", "low", "routine"]',
                "start": now - timedelta(hours=2),
                "end": now + timedelta(hours=70),
                "max_calls": HOSPITALS[[h["code"] for h in HOSPITALS].index(code)]["max_concurrent_calls"],
                "created_by": created_by,
            })
        await session.commit()
        print("✅ Created 3 draft campaigns")

    print("\n" + "=" * 60)
    print("🎉 DATABASE SEEDING COMPLETE!")
    print("=" * 60)
    print("\n📋 Demo Credentials (all passwords: demo123):")
    print(f"   Platform Admin: admin@platform.com")
    for code in hospital_ids:
        short = code.lower().replace("_", "")
        print(f"   {code} Admin: admin@{short}.com")
        print(f"   {code} Campaign: campaign@{short}.com")
        print(f"   {code} Reviewer: reviewer@{short}.com")
    print(f"\n📊 Data Summary:")
    print(f"   Hospitals: 3")
    print(f"   Users: 10")
    print(f"   Patients: 300 (100 per hospital)")
    print(f"   Encounters: 300")
    print(f"   Clinical Protocols: 3")
    print(f"   Draft Campaigns: 3")


if __name__ == "__main__":
    asyncio.run(seed_database())
