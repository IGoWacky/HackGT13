"""Build a deterministic, synthetic SQLite database for RxRescue demos.

Usage: python3 seed_demo_db.py [output-path]
Requires only the Python standard library.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

DEFAULT_PATH = Path(__file__).with_name("rxrescue_demo.sqlite3")

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE pharmacies (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, street TEXT NOT NULL,
  phone TEXT NOT NULL
);
CREATE TABLE clinicians (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, specialty TEXT NOT NULL,
  demo_inbox TEXT NOT NULL
);
CREATE TABLE patients (
  id TEXT PRIMARY KEY, full_name TEXT NOT NULL, date_of_birth TEXT NOT NULL,
  preferred_pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  clinician_id TEXT NOT NULL REFERENCES clinicians(id),
  pregnancy_status TEXT NOT NULL CHECK(pregnancy_status IN ('yes','no','unknown')),
  clinical_notes TEXT NOT NULL
);
CREATE TABLE conditions (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
  condition_name TEXT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE allergies (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
  substance TEXT NOT NULL, reaction TEXT NOT NULL, severity TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE TABLE observations (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
  observation_name TEXT NOT NULL, value_numeric REAL NOT NULL,
  unit TEXT NOT NULL, observed_at TEXT NOT NULL, source TEXT NOT NULL
);
CREATE TABLE medications (
  id TEXT PRIMARY KEY, active_ingredient TEXT NOT NULL, display_name TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK(product_type IN ('brand','generic')),
  strength TEXT NOT NULL, dosage_form TEXT NOT NULL, route TEXT NOT NULL,
  therapeutic_class TEXT NOT NULL, plain_description TEXT NOT NULL,
  manufacturer TEXT NOT NULL, manufacturer_is_synthetic INTEGER NOT NULL CHECK(manufacturer_is_synthetic IN (0,1)),
  label_url TEXT NOT NULL, label_checked_date TEXT NOT NULL
);
CREATE TABLE medication_warnings (
  id INTEGER PRIMARY KEY, medication_id TEXT NOT NULL REFERENCES medications(id),
  warning_type TEXT NOT NULL, summary TEXT NOT NULL, label_section TEXT NOT NULL,
  requires_clinician_review INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE interaction_flags (
  id INTEGER PRIMARY KEY, ingredient_a TEXT NOT NULL, ingredient_b TEXT NOT NULL,
  summary TEXT NOT NULL, evidence_url TEXT NOT NULL,
  UNIQUE(ingredient_a, ingredient_b)
);
CREATE TABLE medication_history (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
  medication_id TEXT NOT NULL REFERENCES medications(id),
  dose_instructions TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','stopped')),
  start_date TEXT NOT NULL, end_date TEXT, source TEXT NOT NULL
);
CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
  clinician_id TEXT NOT NULL REFERENCES clinicians(id),
  medication_id TEXT NOT NULL REFERENCES medications(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0), refills INTEGER NOT NULL,
  sig TEXT NOT NULL, prescribed_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('at_pharmacy','awaiting_review','resolved'))
);
CREATE TABLE pharmacy_offers (
  id INTEGER PRIMARY KEY, pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  medication_id TEXT NOT NULL REFERENCES medications(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  demo_patient_price_cents INTEGER NOT NULL CHECK(demo_patient_price_cents >= 0),
  coverage_status TEXT NOT NULL, prior_authorization INTEGER NOT NULL CHECK(prior_authorization IN (0,1)),
  updated_at TEXT NOT NULL, is_synthetic INTEGER NOT NULL DEFAULT 1,
  UNIQUE(pharmacy_id, medication_id, quantity)
);
CREATE TABLE sponsors (
  id TEXT PRIMARY KEY, company_name TEXT NOT NULL, is_synthetic INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE sponsored_placements (
  id INTEGER PRIMARY KEY, sponsor_id TEXT NOT NULL REFERENCES sponsors(id),
  medication_id TEXT NOT NULL REFERENCES medications(id),
  disclosure TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
  UNIQUE(sponsor_id, medication_id)
);
CREATE TABLE affordability_requests (
  id TEXT PRIMARY KEY, prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  reported_price_cents INTEGER NOT NULL, desired_max_cents INTEGER,
  patient_message TEXT NOT NULL, created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('new','needs_clinician_review','closed'))
);
CREATE TABLE candidate_reviews (
  id INTEGER PRIMARY KEY, request_id TEXT NOT NULL REFERENCES affordability_requests(id),
  candidate_medication_id TEXT NOT NULL REFERENCES medications(id),
  matching_basis TEXT NOT NULL,
  preliminary_status TEXT NOT NULL CHECK(preliminary_status IN ('unreviewed','blocked','needs_review')),
  reason TEXT NOT NULL, clinician_decision TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(request_id, candidate_medication_id)
);
CREATE INDEX idx_conditions_patient ON conditions(patient_id);
CREATE INDEX idx_allergies_patient ON allergies(patient_id);
CREATE INDEX idx_history_patient_status ON medication_history(patient_id, status);
CREATE INDEX idx_offers_pharmacy_med ON pharmacy_offers(pharmacy_id, medication_id);
CREATE INDEX idx_reviews_request ON candidate_reviews(request_id);
"""

LABELS = {
    "atorvastatin": "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=173474b6-26b4-46f2-a12a-64753ae5e905",
    "amlodipine": "https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=e5bc1507-3241-4b7d-be3f-cc365d436bbf&type=display",
    "metformin": "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=836f3647-bfef-40d1-b475-c0d240241a67",
    "lisinopril": "https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=fbbff4eb-a641-b083-e053-6294a90a404a",
    "losartan": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9501dfaa-c8cf-46d6-8bec-936c4fd8fe03",
}


def add_many(db: sqlite3.Connection, table: str, columns: str, rows: list[tuple]) -> None:
    fields = [field.strip() for field in columns.split(",")]
    placeholders = ",".join("?" for _ in fields)
    db.executemany(
        f"INSERT INTO {table} ({columns}) VALUES ({placeholders})", rows
    )


def populate(db: sqlite3.Connection) -> None:
    add_many(db, "metadata", "key,value", [
        ("dataset", "RXRESCUE_SYNTHETIC_DEMO_ONLY"),
        ("created", "2026-09-26"),
        ("price_notice", "All prices, coverage, sponsors, identities, and manufacturers are invented."),
        ("clinical_notice", "No medication is approved as safe or interchangeable by this database. A licensed clinician and pharmacist must review all changes."),
    ])
    add_many(db, "pharmacies", "id,name,street,phone", [
        ("PH1", "Demo Midtown Pharmacy", "100 Example Ave, Atlanta, GA", "555-010-1001"),
        ("PH2", "Demo Campus Pharmacy", "200 Sample St, Atlanta, GA", "555-010-1002"),
    ])
    add_many(db, "clinicians", "id,name,specialty,demo_inbox", [
        ("C1", "Dr. Avery Chen (fictional)", "Primary care", "clinician1@example.invalid"),
        ("C2", "Dr. Morgan Ellis (fictional)", "Primary care", "clinician2@example.invalid"),
    ])
    add_many(db, "patients", "id,full_name,date_of_birth,preferred_pharmacy_id,clinician_id,pregnancy_status,clinical_notes", [
        ("P1", "Alex Morgan (fictional)", "1985-04-12", "PH1", "C1", "unknown", "Routine cost alert; allergy to penicillin recorded."),
        ("P2", "Jordan Lee (fictional)", "1977-11-23", "PH2", "C2", "unknown", "Recorded amlodipine allergy; review prescription before dispensing."),
        ("P3", "Sam Rivera (fictional)", "1966-02-05", "PH1", "C1", "unknown", "Recent eGFR value is 24; needs urgent prescribing review."),
        ("P4", "Taylor Brooks (fictional)", "1995-08-19", "PH2", "C2", "yes", "Pregnancy flag; review lisinopril prescription immediately."),
        ("P5", "Casey Patel (fictional)", "1989-06-28", "PH1", "C1", "no", "Two generic losartan offers illustrate sponsorship disclosure."),
    ])
    add_many(db, "conditions", "patient_id,condition_name,status", [
        ("P1", "High cholesterol", "active"), ("P1", "Hypertension", "active"),
        ("P2", "Hypertension", "active"),
        ("P3", "Type 2 diabetes", "active"), ("P3", "Chronic kidney disease", "active"),
        ("P4", "Hypertension", "active"), ("P5", "Hypertension", "active"),
    ])
    add_many(db, "allergies", "patient_id,substance,reaction,severity,recorded_at", [
        ("P1", "penicillin", "rash", "moderate", "2026-06-11"),
        ("P2", "amlodipine", "facial swelling (patient reported)", "severe", "2026-07-02"),
    ])
    add_many(db, "observations", "patient_id,observation_name,value_numeric,unit,observed_at,source", [
        ("P3", "eGFR", 24, "mL/min/1.73 m2", "2026-09-24", "synthetic lab result"),
        ("P1", "eGFR", 92, "mL/min/1.73 m2", "2026-09-20", "synthetic lab result"),
    ])
    specs = [
        ("atorvastatin", "Lipitor", "20 mg", "HMG-CoA reductase inhibitor", "Used to lower LDL cholesterol and reduce cardiovascular risk."),
        ("amlodipine", "Norvasc", "5 mg", "Calcium channel blocker", "Used for hypertension and certain forms of angina."),
        ("metformin", "Glucophage", "500 mg", "Biguanide", "Used to improve blood glucose control in type 2 diabetes."),
        ("lisinopril", "Prinivil", "10 mg", "ACE inhibitor", "Used to lower blood pressure and for certain other cardiovascular indications."),
        ("losartan", "Cozaar", "50 mg", "Angiotensin II receptor blocker", "Used to lower blood pressure and for certain other indications."),
    ]
    medication_rows = []
    for ingredient, brand, strength, drug_class, description in specs:
        for suffix, display, product_type, maker in [
            ("brand", brand, "brand", "Demo Originator Co."),
            ("generic_a", ingredient.title(), "generic", "Example Generics A LLC"),
            ("generic_b", ingredient.title(), "generic", "Example Generics B LLC"),
        ]:
            if suffix == "generic_b" and ingredient != "losartan":
                continue
            medication_rows.append((f"{ingredient}_{suffix}", ingredient, display,
                product_type, strength, "immediate-release tablet", "oral", drug_class,
                description, maker, 1, LABELS[ingredient], "2026-09-26"))
    add_many(db, "medications", "id,active_ingredient,display_name,product_type,strength,dosage_form,route,therapeutic_class,plain_description,manufacturer,manufacturer_is_synthetic,label_url,label_checked_date", medication_rows)
    warnings = {
        "atorvastatin": [("precaution", "Muscle injury, including rare rhabdomyolysis, is a labeled risk.", "Warnings and Precautions"),
                         ("interaction", "Some medicines raise atorvastatin exposure; review the full interaction table.", "Drug Interactions")],
        "amlodipine": [("contraindication", "Known sensitivity to amlodipine is a contraindication.", "Contraindications"),
                       ("precaution", "Symptomatic low blood pressure is possible.", "Warnings and Precautions")],
        "metformin": [("boxed_warning", "Lactic acidosis is a boxed warning.", "Boxed Warning"),
                      ("contraindication", "Severe renal impairment (eGFR below 30) is a contraindication.", "Contraindications")],
        "lisinopril": [("boxed_warning", "Can cause fetal harm; review promptly when pregnancy is known.", "Boxed Warning"),
                       ("contraindication", "History of ACE inhibitor related angioedema is a contraindication.", "Contraindications")],
        "losartan": [("boxed_warning", "Can cause fetal harm; review promptly when pregnancy is known.", "Boxed Warning"),
                      ("interaction", "Potassium raising medicines or supplements need review.", "Drug Interactions")],
    }
    add_many(db, "medication_warnings", "medication_id,warning_type,summary,label_section,requires_clinician_review", [
        (row[0], kind, summary, section, 1)
        for row in medication_rows for kind, summary, section in warnings[row[1]]
    ])
    add_many(db, "interaction_flags", "ingredient_a,ingredient_b,summary,evidence_url", [
        ("losartan", "potassium supplement", "May increase risk of elevated potassium; clinician review required.", LABELS["losartan"]),
    ])
    add_many(db, "medication_history", "patient_id,medication_id,dose_instructions,status,start_date,end_date,source", [
        ("P1", "lisinopril_generic_a", "10 mg daily", "active", "2024-05-03", None, "synthetic patient chart"),
        ("P1", "atorvastatin_generic_a", "20 mg daily", "stopped", "2025-06-01", "2025-08-01", "synthetic patient chart"),
        ("P2", "metformin_generic_a", "500 mg twice daily", "active", "2024-09-10", None, "synthetic patient chart"),
        ("P3", "amlodipine_generic_a", "5 mg daily", "active", "2025-01-14", None, "synthetic patient chart"),
        ("P5", "atorvastatin_generic_a", "20 mg daily", "active", "2026-02-01", None, "synthetic patient chart"),
    ])
    add_many(db, "prescriptions", "id,patient_id,clinician_id,medication_id,quantity,refills,sig,prescribed_at,status", [
        ("RX1", "P1", "C1", "atorvastatin_brand", 30, 2, "20 mg by mouth daily", "2026-09-26T13:00:00-04:00", "at_pharmacy"),
        ("RX2", "P2", "C2", "amlodipine_brand", 30, 1, "5 mg by mouth daily", "2026-09-26T13:05:00-04:00", "awaiting_review"),
        ("RX3", "P3", "C1", "metformin_brand", 60, 1, "500 mg by mouth twice daily", "2026-09-26T13:10:00-04:00", "awaiting_review"),
        ("RX4", "P4", "C2", "lisinopril_brand", 30, 1, "10 mg by mouth daily", "2026-09-26T13:15:00-04:00", "awaiting_review"),
        ("RX5", "P5", "C1", "losartan_brand", 30, 2, "50 mg by mouth daily", "2026-09-26T13:20:00-04:00", "at_pharmacy"),
    ])
    add_many(db, "pharmacy_offers", "pharmacy_id,medication_id,quantity,demo_patient_price_cents,coverage_status,prior_authorization,updated_at", [
        ("PH1", "atorvastatin_brand", 30, 16500, "nonpreferred", 0, "2026-09-26"),
        ("PH1", "atorvastatin_generic_a", 30, 1200, "preferred", 0, "2026-09-26"),
        ("PH2", "amlodipine_brand", 30, 8900, "nonpreferred", 0, "2026-09-26"),
        ("PH2", "amlodipine_generic_a", 30, 700, "preferred", 0, "2026-09-26"),
        ("PH1", "metformin_brand", 60, 9700, "nonpreferred", 0, "2026-09-26"),
        ("PH1", "metformin_generic_a", 60, 900, "preferred", 0, "2026-09-26"),
        ("PH2", "lisinopril_brand", 30, 8500, "nonpreferred", 1, "2026-09-26"),
        ("PH2", "lisinopril_generic_a", 30, 800, "preferred", 0, "2026-09-26"),
        ("PH1", "losartan_brand", 30, 11200, "nonpreferred", 0, "2026-09-26"),
        ("PH1", "losartan_generic_a", 30, 1100, "preferred", 0, "2026-09-26"),
        ("PH1", "losartan_generic_b", 30, 1600, "preferred", 0, "2026-09-26"),
        ("PH2", "losartan_generic_a", 30, 1300, "preferred", 0, "2026-09-26"),
    ])
    add_many(db, "sponsors", "id,company_name", [("S1", "Example Generics B LLC")])
    add_many(db, "sponsored_placements", "sponsor_id,medication_id,disclosure,starts_at,ends_at", [
        ("S1", "losartan_generic_b", "Sponsored placement; synthetic example; shown after clinical review and alongside the lower price.", "2026-01-01", "2026-12-31")
    ])
    add_many(db, "affordability_requests", "id,prescription_id,pharmacy_id,reported_price_cents,desired_max_cents,patient_message,created_at,status", [
        ("REQ1", "RX1", "PH1", 16500, 3000, "I'm at the pharmacy and this is more than I can afford.", "2026-09-26T14:00:00-04:00", "needs_clinician_review"),
        ("REQ2", "RX2", "PH2", 8900, 2000, "I cannot afford this prescription.", "2026-09-26T14:05:00-04:00", "needs_clinician_review"),
        ("REQ3", "RX3", "PH1", 9700, 2000, "Could there be a lower cost option?", "2026-09-26T14:10:00-04:00", "needs_clinician_review"),
        ("REQ4", "RX4", "PH2", 8500, 1500, "This costs too much.", "2026-09-26T14:15:00-04:00", "needs_clinician_review"),
        ("REQ5", "RX5", "PH1", 11200, 3000, "I need a lower cost option.", "2026-09-26T14:20:00-04:00", "needs_clinician_review"),
    ])
    add_many(db, "candidate_reviews", "request_id,candidate_medication_id,matching_basis,preliminary_status,reason", [
        ("REQ1", "atorvastatin_generic_a", "same ingredient, strength, form, and route", "needs_review", "No demo hard stop identified; verify product equivalence and patient chart."),
        ("REQ2", "amlodipine_generic_a", "same ingredient, strength, form, and route", "blocked", "Recorded allergy to amlodipine; clinician and pharmacist must review."),
        ("REQ3", "metformin_generic_a", "same ingredient, strength, form, and route", "blocked", "Recorded eGFR of 24 is below the labeled contraindication threshold."),
        ("REQ4", "lisinopril_generic_a", "same ingredient, strength, form, and route", "blocked", "Pregnancy status recorded as yes; fetal harm warning requires prompt review."),
        ("REQ5", "losartan_generic_a", "same ingredient, strength, form, and route", "needs_review", "Lower price; verify product equivalence and patient chart."),
        ("REQ5", "losartan_generic_b", "same ingredient, strength, form, and route", "needs_review", "Sponsored and higher priced; verify product equivalence and patient chart."),
    ])


def build(path: Path) -> None:
    if path.exists():
        path.unlink()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as db:
        db.executescript(SCHEMA)
        populate(db)
        violations = db.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            raise RuntimeError(f"Foreign key failures: {violations}")
        db.commit()
    print(f"Created {path.resolve()}")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PATH)
