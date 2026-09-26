"""Print a clinician alert packet from the synthetic demo database as JSON.

Usage: python3 demo_packet.py REQ1 [database-path]
"""

import json
import sqlite3
import sys
from pathlib import Path

DEFAULT_DB = Path(__file__).with_name("rxrescue_demo.sqlite3")


def rows(db, query, params=()):
    return [dict(row) for row in db.execute(query, params)]


def packet(db, request_id):
    request = db.execute("""
        SELECT r.id, r.created_at, r.patient_message, r.reported_price_cents,
               r.desired_max_cents, r.status, r.pharmacy_id, p.id AS patient_id,
               p.full_name, p.date_of_birth, p.pregnancy_status, p.clinical_notes,
               ph.name AS pharmacy_name, ph.phone AS pharmacy_phone,
               c.name AS clinician_name, c.demo_inbox,
               rx.id AS prescription_id, rx.quantity, rx.sig, rx.prescribed_at,
               m.id AS prescribed_product_id, m.display_name AS prescribed_product,
               m.active_ingredient AS prescribed_ingredient
        FROM affordability_requests r
        JOIN prescriptions rx ON rx.id = r.prescription_id
        JOIN patients p ON p.id = rx.patient_id
        JOIN pharmacies ph ON ph.id = r.pharmacy_id
        JOIN clinicians c ON c.id = rx.clinician_id
        JOIN medications m ON m.id = rx.medication_id
        WHERE r.id = ?
    """, (request_id,)).fetchone()
    if request is None:
        raise ValueError(f"No demo request named {request_id}")
    req = dict(request)
    patient_id = req["patient_id"]
    candidates = rows(db, """
        SELECT cr.candidate_medication_id AS medication_id, m.display_name,
               m.active_ingredient, m.strength, m.dosage_form, m.route,
               m.plain_description, m.manufacturer, m.label_url,
               cr.matching_basis, cr.preliminary_status, cr.reason,
               cr.clinician_decision, o.demo_patient_price_cents,
               o.coverage_status, o.prior_authorization,
               sp.disclosure AS sponsorship_disclosure
        FROM candidate_reviews cr
        JOIN medications m ON m.id = cr.candidate_medication_id
        LEFT JOIN pharmacy_offers o
          ON o.medication_id = m.id AND o.pharmacy_id = ?
          AND o.quantity = ?
        LEFT JOIN sponsored_placements sp
          ON sp.medication_id = m.id
          AND date(?) BETWEEN date(sp.starts_at) AND date(sp.ends_at)
        WHERE cr.request_id = ?
        ORDER BY CASE WHEN cr.preliminary_status = 'blocked' THEN 1 ELSE 0 END,
                 COALESCE(o.demo_patient_price_cents, 99999999), m.id
    """, (req["pharmacy_id"], req["quantity"], req["created_at"], request_id))
    for candidate in candidates:
        candidate["label_warnings"] = rows(db, """
            SELECT warning_type, summary, label_section
            FROM medication_warnings WHERE medication_id = ?
        """, (candidate["medication_id"],))
        candidate["possible_savings_cents"] = (
            req["reported_price_cents"] - candidate["demo_patient_price_cents"]
            if candidate["demo_patient_price_cents"] is not None else None
        )
    return {
        "synthetic_demo_only": True,
        "clinical_status": "Pending clinician and pharmacist review; no auto substitution",
        "request": {k: req[k] for k in (
            "id", "created_at", "patient_message", "reported_price_cents",
            "desired_max_cents", "status", "pharmacy_name", "pharmacy_phone")},
        "patient": {k: req[k] for k in (
            "patient_id", "full_name", "date_of_birth", "pregnancy_status", "clinical_notes")},
        "clinician": {k: req[k] for k in ("clinician_name", "demo_inbox")},
        "prescription": {k: req[k] for k in (
            "prescription_id", "prescribed_at", "prescribed_product_id",
            "prescribed_product", "prescribed_ingredient", "quantity", "sig")},
        "conditions": rows(db, "SELECT condition_name, status FROM conditions WHERE patient_id=?", (patient_id,)),
        "allergies": rows(db, "SELECT substance, reaction, severity, recorded_at FROM allergies WHERE patient_id=?", (patient_id,)),
        "recent_observations": rows(db, "SELECT observation_name, value_numeric, unit, observed_at, source FROM observations WHERE patient_id=? ORDER BY observed_at DESC", (patient_id,)),
        "medication_history": rows(db, """
            SELECT m.display_name, m.active_ingredient, h.dose_instructions, h.status,
                   h.start_date, h.end_date
            FROM medication_history h JOIN medications m ON m.id=h.medication_id
            WHERE h.patient_id=? ORDER BY h.status, h.start_date DESC
        """, (patient_id,)),
        "candidate_products": candidates,
    }


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        raise SystemExit("Usage: python3 demo_packet.py REQ1 [database-path]")
    db_path = Path(sys.argv[2]) if len(sys.argv) == 3 else DEFAULT_DB
    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        print(json.dumps(packet(connection, sys.argv[1]), indent=2))
