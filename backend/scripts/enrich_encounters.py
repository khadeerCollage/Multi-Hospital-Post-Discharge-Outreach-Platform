"""Enrich Encounters Script - Populates existing encounters with rich surgical & medical checkup data.
"""

import asyncio
import json
import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import select, update, text
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import async_session
from app.models.encounter import Encounter

PROCEDURE_MAPPINGS = {
    # General / City General
    "Laparoscopic Appendectomy": {
        "procedure": "Laparoscopic Appendectomy with Mesoappendix Ligation",
        "type": "Minimally Invasive Abdominal Surgery",
        "lead_specialty": "General & Laparoscopic Surgery",
        "setting": "surgical_ward",
        "incision": "Three small puncture ports clean, dry, subcuticular sutures intact, minimal localized tenderness",
        "pain": "2/10 (Mild, managed with oral analgesics)",
        "mobility": "Ambulating independently without assistance",
    },
    "Inguinal Hernia Repair": {
        "procedure": "Open Lichtenstein Inguinal Hernioplasty with Mesh Placement",
        "type": "General Surgery / Hernia Repair",
        "lead_specialty": "General Surgery",
        "setting": "surgical_ward",
        "incision": "Right groin incision closed with Dermabond, dressing intact, no swelling or hematoma",
        "pain": "3/10 (Mild to moderate, well controlled)",
        "mobility": "Ambulating with gentle gait, avoid heavy lifting > 10 lbs",
    },
    "Cholecystectomy": {
        "procedure": "Elective 4-Port Laparoscopic Cholecystectomy with Cholangiography",
        "type": "Minimally Invasive Gastrointestinal Surgery",
        "lead_specialty": "Gastrointestinal & Laparoscopic Surgery",
        "setting": "surgical_ward",
        "incision": "Umbilical and subcostal port sites dry and intact, Steri-Strips secure, zero discharge",
        "pain": "2/10 (Mild incisional discomfort, resolving)",
        "mobility": "Independent ambulation, tolerating low-fat oral diet",
    },
    "Knee Arthroscopy": {
        "procedure": "Right Knee Arthroscopy with Partial Meniscectomy & Chondroplasty",
        "type": "Sports Medicine & Arthroscopic Surgery",
        "lead_specialty": "Orthopedic Surgery",
        "setting": "orthopedic_unit",
        "incision": "Anterolateral and anteromedial portals clean, Ace bandage wrap snug, no joint effusion",
        "pain": "2/10 (Controlled with ice therapy and oral NSAIDs)",
        "mobility": "Weight-bearing as tolerated with straight knee sleeve and crutches",
    },
    "Community Acquired Pneumonia": {
        "procedure": "Inpatient Pulmonary Stabilization & Targeted IV Antibiotic Course",
        "type": "Acute Pulmonary & Internal Medicine Care",
        "lead_specialty": "Pulmonary Medicine & Critical Care",
        "setting": "medical_ward",
        "incision": "No surgical wounds; peripheral IV site removed, site clean and dry",
        "pain": "0/10 (No chest or pleuritic pain)",
        "mobility": "Ambulating room air with SpO2 97% without supplemental oxygen",
    },
    "Urinary Tract Infection": {
        "procedure": "Acute Pyelonephritis Inpatient Management & Urosepsis Prophylaxis",
        "type": "Internal Medicine / Nephrology Care",
        "lead_specialty": "Internal Medicine & Infectious Disease",
        "setting": "medical_ward",
        "incision": "Non-surgical; Foley catheter successfully discontinued, voiding spontaneously",
        "pain": "1/10 (Dysuria resolved)",
        "mobility": "Independent mobility, afebrile for > 48 hours",
    },
    "Cellulitis Treatment": {
        "procedure": "Lower Extremity Cellulitis Demarcation & IV Antimicrobial Therapy",
        "type": "Infectious Disease & Dermatology Care",
        "lead_specialty": "Internal Medicine",
        "setting": "medical_ward",
        "incision": "Erythema margin noticeably regressed by > 6 cm, warmth decreased, zero bullae",
        "pain": "1/10 (Significantly improved from admission)",
        "mobility": "Ambulating with leg elevated during prolonged sitting",
    },
    "Observation - Chest Pain Ruled Out": {
        "procedure": "Emergency Observation Protocol, Serial Troponin Panel & Stress Echocardiogram",
        "type": "Diagnostic Cardiology & Emergency Observation",
        "lead_specialty": "Cardiology & Emergency Medicine",
        "setting": "cardiac_unit",
        "incision": "Non-invasive diagnostic evaluation; antecubital venipuncture sites clean",
        "pain": "0/10 (Asymptomatic, serial cardiac enzymes flat and negative)",
        "mobility": "Full independent ambulation, cleared for outpatient cardiology follow-up",
    },

    # Metro Heart Center
    "Coronary Artery Bypass Graft": {
        "procedure": "Quadruple Coronary Artery Bypass Graft (CABG x4: LIMA-LAD, SVG-OM1, SVG-Diag, SVG-PDA)",
        "type": "Cardiothoracic Open-Heart Surgery",
        "lead_specialty": "Cardiothoracic Surgery",
        "setting": "cardiac_unit",
        "incision": "Median sternotomy stable, sternal wire closure intact, saphenous harvest leg incision clean & dry",
        "pain": "3/10 (Managed with scheduled oral analgesics, sternal precautions reinforced)",
        "mobility": "Ambulating 300+ feet in hallway with physical therapy assist, no dyspnea",
    },
    "Cardiac Stent Placement": {
        "procedure": "Percutaneous Coronary Intervention (PCI) with 2 Drug-Eluting Stents (DES to Mid-LAD & RCA)",
        "type": "Interventional Cardiology",
        "lead_specialty": "Interventional Cardiology",
        "setting": "cardiac_unit",
        "incision": "Right radial artery access site sealed with TR Band, puncture site dry with zero hematoma",
        "pain": "1/10 (Radial site slightly sore, no active angina)",
        "mobility": "Independent ambulation, dual antiplatelet therapy (DAPT) protocol verified",
    },
    "Heart Valve Replacement": {
        "procedure": "Minimally Invasive Aortic Valve Replacement (AVR) with 23mm Edwards Bovine Pericardial Valve",
        "type": "Cardiovascular Valve Reconstruction",
        "lead_specialty": "Cardiothoracic Surgery",
        "setting": "cardiac_unit",
        "incision": "Right mini-thoracotomy incision clean and approximated, chest tubes discontinued 24h prior",
        "pain": "2/10 (Mild pleuritic incisional discomfort)",
        "mobility": "Independent transfers and corridor ambulation with cardiac rehab",
    },
    "Cardiac Catheterization": {
        "procedure": "Diagnostic Left Heart Catheterization, Coronary Angiography & Left Ventriculography",
        "type": "Diagnostic Interventional Cardiology",
        "lead_specialty": "Interventional Cardiology",
        "setting": "cardiac_unit",
        "incision": "Right femoral arteriotomy closed with Angio-Seal vascular closure device, distal pulses 2+",
        "pain": "1/10 (Mild groin stiffness)",
        "mobility": "Bedrest completed, ambulating independently, groin site soft without bruit",
    },
    "Heart Failure Exacerbation": {
        "procedure": "Acute Decompensated Heart Failure (ADHF) Diuresis & Guideline-Directed Medical Therapy (GDMT)",
        "type": "Advanced Heart Failure Management",
        "lead_specialty": "Advanced Heart Failure & Transplant Cardiology",
        "setting": "cardiac_unit",
        "incision": "Non-surgical; euvolemic dry weight reached (-4.2 kg net fluid balance), JVP normal",
        "pain": "0/10 (Zero chest discomfort, orthopnea resolved)",
        "mobility": "Ambulating comfortably on room air, daily weights and sodium restriction reviewed",
    },
    "Atrial Fibrillation Management": {
        "procedure": "Elective Synchronized Direct-Current Cardioversion (DCCV) & Antiarrhythmic Titration",
        "type": "Electrophysiology & Cardiac Rhythm Management",
        "lead_specialty": "Cardiac Electrophysiology",
        "setting": "cardiac_unit",
        "incision": "External pad contact sites examined, no skin irritation, NSR maintained on telemetry",
        "pain": "0/10 (No chest wall tenderness)",
        "mobility": "Full independent mobility, anticoagulation regimen confirmed",
    },
    "Pacemaker Implantation": {
        "procedure": "Permanent Transvenous Dual-Chamber (DDD) Pacemaker Implantation (Medtronic Azure)",
        "type": "Cardiac Electrophysiology Surgery",
        "lead_specialty": "Cardiac Electrophysiology",
        "setting": "cardiac_unit",
        "incision": "Left subclavicular prepectoral pocket incision closed with subcuticular Monocryl, pressure dressing clean",
        "pain": "2/10 (Mild pectoral tightness)",
        "mobility": "Independent ambulation; left arm sling worn, arm elevation restricted below 90 degrees",
    },
    "Aortic Aneurysm Repair": {
        "procedure": "Endovascular Aneurysm Repair (EVAR) of Infrarenal Abdominal Aortic Aneurysm with Gore Excluder Stent",
        "type": "Endovascular & Vascular Surgery",
        "lead_specialty": "Vascular & Endovascular Surgery",
        "setting": "cardiac_unit",
        "incision": "Bilateral percutaneous femoral puncture sites dry and intact, zero pulsatile masses",
        "pain": "2/10 (Mild bilateral groin tenderness)",
        "mobility": "Ambulating well, post-procedure CTA confirmed excellent stent apposition without endoleak",
    },

    # Valley Medical Center (Orthopedics)
    "Total Hip Replacement": {
        "procedure": "Direct Anterior Approach Total Hip Arthroplasty (THA) with Stryker Ceramic-on-Polyethylene",
        "type": "Complex Orthopedic Joint Reconstruction",
        "lead_specialty": "Adult Joint Reconstruction Orthopedics",
        "setting": "orthopedic_unit",
        "incision": "Anterior hip incision closed with waterproof Aquacel dressing, dry and intact, zero drainage",
        "pain": "2/10 (Controlled with multi-modal oral analgesia)",
        "mobility": "Ambulating 150+ feet with rolling walker, ascending/descending 4 stairs safely with PT",
    },
    "Total Knee Replacement": {
        "procedure": "Robotic-Assisted (Mako) Right Total Knee Arthroplasty (TKA) with Cruciate-Retaining Implant",
        "type": "Robotic Orthopedic Arthroplasty",
        "lead_specialty": "Adult Joint Reconstruction Orthopedics",
        "setting": "orthopedic_unit",
        "incision": "Anterior midline knee incision clean, dry, staples intact, Cryo-cuff cold therapy active",
        "pain": "3/10 (Mild post-op soreness, active range of motion 0 to 95 degrees flexion)",
        "mobility": "Ambulating with front-wheeled walker, safely completed post-op PT clearance checklist",
    },
    "Spinal Fusion Surgery": {
        "procedure": "Transforaminal Lumbar Interbody Fusion (L4-L5 TLIF) with Pedicle Screw Fixation & PEEK Cage",
        "type": "Spine & Reconstructive Neurosurgery",
        "lead_specialty": "Orthopedic Spine Surgery",
        "setting": "orthopedic_unit",
        "incision": "Midline lumbar incision closed with staples, dry, intact silver dressing, zero CSF leak",
        "pain": "3/10 (Incisional ache, radicular nerve pain significantly resolved)",
        "mobility": "Ambulating with lumbar corset brace and rolling walker, log-roll technique demonstrated",
    },
    "Rotator Cuff Repair": {
        "procedure": "Arthroscopic Double-Row Supraspinatus Tendon Repair with Biceps Tenodesis & Acromioplasty",
        "type": "Shoulder & Sports Medicine Surgery",
        "lead_specialty": "Orthopedic Sports Medicine",
        "setting": "orthopedic_unit",
        "incision": "Four shoulder arthroscopy portals dry and sealed with waterproof dressings, no swelling",
        "pain": "2/10 (Controlled with oral analgesics and cold therapy sleeve)",
        "mobility": "Immobilized in shoulder abduction sling at all times, pendulum exercises instructed",
    },
    "Hip Fracture Repair": {
        "procedure": "Intramedullary Nailing (Trochanteric Fixation Nail) of Left Intertrochanteric Femur Fracture",
        "type": "Orthopedic Trauma Surgery",
        "lead_specialty": "Orthopedic Trauma Surgery",
        "setting": "orthopedic_unit",
        "incision": "Lateral proximal thigh puncture incisions clean and dry, staple line intact without drainage",
        "pain": "3/10 (Managed with oral multimodal pain regimen)",
        "mobility": "Partial weight-bearing with walker, occupational therapy cleared home safety plan",
    },
    "ACL Reconstruction": {
        "procedure": "Arthroscopic All-Inside Anterior Cruciate Ligament (ACL) Reconstruction with Quad Tendon Autograft",
        "type": "Sports Medicine Knee Reconstruction",
        "lead_specialty": "Orthopedic Sports Medicine",
        "setting": "orthopedic_unit",
        "incision": "Arthroscopic knee portals clean, donor harvest incision dry and intact, zero hemarthrosis",
        "pain": "2/10 (Well-controlled on oral NSAID and cryotherapy)",
        "mobility": "Ambulating with locked hinged knee brace and bilateral axillary crutches",
    },
    "Carpal Tunnel Release": {
        "procedure": "Endoscopic Transverse Carpal Ligament Release under Tumescent Local Anesthesia",
        "type": "Hand & Microvascular Surgery",
        "lead_specialty": "Hand & Upper Extremity Surgery",
        "setting": "orthopedic_unit",
        "incision": "Palmar wrist portal incision dry, Steri-Strips secure, light soft dressing applied",
        "pain": "1/10 (Mild tingling resolving, grip sensations intact)",
        "mobility": "Full active finger extension and gentle thumb opposition encouraged, sling not needed",
    },
    "Lumbar Discectomy": {
        "procedure": "Minimally Invasive Microdiscectomy (L5-S1) with Tubular Retractor & Operative Microscope",
        "type": "Minimally Invasive Spine Surgery",
        "lead_specialty": "Orthopedic Spine Surgery",
        "setting": "orthopedic_unit",
        "incision": "1-inch paramedian lumbar incision closed with subcuticular sutures, waterproof dressing dry",
        "pain": "2/10 (Pre-op sciatica pain fully resolved, mild incisional stiffness only)",
        "mobility": "Independent ambulation without assistive device, no bending/twisting/lifting > 10 lbs",
    },
}

SURGEONS_POOL = [
    ("Dr. Sarah Jenkins, MD, FACS", "Chief of Surgery & Laparoscopic Specialist"),
    ("Dr. Marcus Vance, MD, FACC", "Lead Cardiothoracic Surgeon"),
    ("Dr. Arthur Pendelton, MD, FAAOS", "Chief of Orthopedic Joint Reconstruction"),
    ("Dr. Emily Davis, DO, FACS", "Minimally Invasive General Surgeon"),
    ("Dr. Robert Sterling, MD, FACC", "Senior Interventional Cardiologist"),
    ("Dr. Helena Martinez, MD, FAAOS", "Spine & Neuro-Orthopedic Surgeon"),
    ("Dr. Christopher Lee, MD, FACS", "Vascular & Endovascular Surgeon"),
    ("Dr. Diane Thornton, MD, FAAOS", "Orthopedic Sports Medicine Specialist"),
]

PHYSICIANS_POOL = [
    ("Dr. James Wilson, MD", "Attending Hospitalist & Internal Medicine"),
    ("Dr. Sophia Zhang, MD", "Attending Inpatient Physician"),
    ("Dr. Michael Patel, MD", "Attending Cardiology Specialist"),
    ("Dr. Rachel Greenberg, MD", "Attending Orthopedic Hospitalist"),
]

ANESTHESIOLOGISTS_POOL = [
    ("Dr. David K. Miller, MD", "Staff Anesthesiologist & Critical Care"),
    ("Dr. Amanda Clark, MD", "Lead Cardiovascular Anesthesiologist"),
    ("Dr. Brian Taylor, DO", "Regional & Orthopedic Anesthesiologist"),
]

SURGICAL_ASSISTANTS_POOL = [
    ("Elena Rostova, PA-C", "Senior Surgical Physician Assistant"),
    ("Marcus Brody, CSFA", "Certified Surgical First Assistant"),
    ("Samantha Hayes, PA-C", "Cardiovascular Surgical Assistant"),
    ("Jason Rivera, PA-C", "Orthopedic Surgical Physician Assistant"),
]

async def enrich_encounters():
    print("[*] Starting encounter enrichment for all patients...")
    async with async_session() as session:
        # 1. Add columns to encounters table if they do not exist
        print("[*] Ensuring columns exist on encounters table...")
        await session.execute(text("""
            ALTER TABLE encounters 
            ADD COLUMN IF NOT EXISTS procedure_name VARCHAR,
            ADD COLUMN IF NOT EXISTS procedure_type VARCHAR,
            ADD COLUMN IF NOT EXISTS surgical_team JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS medical_checkup JSONB DEFAULT '{}'::jsonb;
        """))
        await session.commit()
        print("[+] Columns verified on encounters table")

        # 2. Query all existing encounters using ORM
        res = await session.execute(select(Encounter))
        encounters = res.scalars().all()
        print(f"[*] Found {len(encounters)} encounters to enrich")

        for enc in encounters:
            diagnosis = enc.primary_diagnosis or "Observation"

            # Find matching procedure profile
            profile = PROCEDURE_MAPPINGS.get(diagnosis)
            if not profile:
                for k, v in PROCEDURE_MAPPINGS.items():
                    if k.lower() in diagnosis.lower() or diagnosis.lower() in k.lower():
                        profile = v
                        break
            if not profile:
                profile = PROCEDURE_MAPPINGS["Observation - Chest Pain Ruled Out"]

            proc_name = profile["procedure"]
            proc_type = profile["type"]

            lead_surgeon, surgeon_spec = random.choice(SURGEONS_POOL)
            anesthesiologist, anesth_spec = random.choice(ANESTHESIOLOGISTS_POOL)
            assistant, asst_spec = random.choice(SURGICAL_ASSISTANTS_POOL)
            attending_doc, att_spec = random.choice(PHYSICIANS_POOL)

            surgical_team = [
                {"role": "Lead Operating Surgeon", "name": lead_surgeon, "specialty": surgeon_spec},
                {"role": "Attending Inpatient Physician", "name": attending_doc, "specialty": att_spec},
                {"role": "Lead Anesthesiologist", "name": anesthesiologist, "specialty": anesth_spec},
                {"role": "Surgical Assistant / First Assist", "name": assistant, "specialty": asst_spec},
            ]

            sys_bp = random.randint(110, 126)
            dia_bp = random.randint(70, 82)
            pulse = random.randint(64, 80)
            temp = round(random.uniform(98.1, 98.6), 1)

            medical_checkup = {
                "discharge_vitals": {
                    "blood_pressure": f"{sys_bp}/{dia_bp} mmHg",
                    "heart_rate": f"{pulse} bpm",
                    "spo2": "99% on room air",
                    "temperature": f"{temp} F (Afebrile)",
                    "respiratory_rate": "16 breaths/min",
                },
                "surgical_site_status": profile["incision"],
                "pain_level_at_discharge": profile["pain"],
                "mobility_status": profile["mobility"],
                "lab_clearance": "Post-op CBC normal (WBC 6.8k, Hgb 13.2 g/dL), Electrolytes balanced, renal panel normal",
                "clearing_physician": lead_surgeon,
                "discharge_status": "Clinically Cleared for Home Outreach",
            }

            enc.procedure_name = proc_name
            enc.procedure_type = proc_type
            enc.attending_physician = lead_surgeon
            enc.surgical_team = surgical_team
            enc.medical_checkup = medical_checkup

        await session.commit()
        print(f"[SUCCESS] Successfully enriched all {len(encounters)} encounters with surgical data, doctors team, and medical checkups!")

if __name__ == "__main__":
    asyncio.run(enrich_encounters())
