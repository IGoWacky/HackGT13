# RxRescue synthetic demo database

This package is ready to copy into the `backend/` directory of the React/Vite + FastAPI project. It uses SQLite and the Python standard library. No actual patients, prescriptions, prices, insurance coverage, manufacturers, or sponsorships are represented here.

## Quick start on macOS

From the project root:

```bash
cp -R /path/to/rxrescue_demo backend/
cd backend/rxrescue_demo
python3 seed_demo_db.py
python3 demo_packet.py REQ1
```

`rxrescue_demo.sqlite3` is already included. Run the seed script to recreate it deterministically. To inspect requests REQ1 through REQ5, change the final command's request ID. The JSON output can feed a clinician alert screen or a FastAPI endpoint. For example, within your FastAPI code:

```python
import sqlite3
from pathlib import Path
from rxrescue_demo.demo_packet import packet

DB_PATH = Path(__file__).resolve().parents[1] / "rxrescue_demo" / "rxrescue_demo.sqlite3"

@app.get("/api/demo/requests/{request_id}")
def get_demo_request(request_id: str):
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        try:
            return packet(db, request_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Demo request not found")
```

This snippet assumes it is placed in `backend/app/main.py`, that `app` exists, and that you add `from fastapi import HTTPException`. Adjust `DB_PATH` if your directory layout differs. Do not expose this sample route to real patient data without access controls.

## Included scenarios

| Request | Prescribed product | Test outcome |
| --- | --- | --- |
| REQ1 | Lipitor 20 mg | Same-ingredient generic has a lower example price; still needs review. |
| REQ2 | Norvasc 5 mg | Recorded amlodipine allergy blocks the proposed generic. |
| REQ3 | Glucophage 500 mg | Synthetic eGFR 24 flags the metformin contraindication. |
| REQ4 | Prinivil 10 mg | Pregnancy flag blocks an automatic lisinopril switch and requires prompt review. |
| REQ5 | Cozaar 50 mg | Two same-ingredient generics; the sponsored option costs more and is disclosed, after the lower-priced offer. |

The candidate list is limited to products with the same active ingredient, strength, dosage form, and route. A matching row is **not** a determination of FDA therapeutic equivalence, clinical compatibility, or formulary coverage. A clinician and pharmacist must check the actual product and the entire patient chart. REQ2–REQ4 are intentionally unsafe inputs to verify the demo does not present a cheaper price as a reason to bypass a warning.

## Tables

| Area | Tables | Contents |
| --- | --- | --- |
| Medical file | `patients`, `conditions`, `allergies`, `observations`, `medication_history` | Identity, preferred pharmacy, pregnancy status, history, medications, recent lab values. |
| Drug reference | `medications`, `medication_warnings`, `interaction_flags` | Ingredients, brand/generic, form, strength, descriptions, maker, source URL, warning summaries. |
| Prescription and prices | `prescriptions`, `pharmacy_offers`, `pharmacies` | Prescribed product, quantity, synthetic price by pharmacy, synthetic coverage and PA flags. |
| Alert workflow | `clinicians`, `affordability_requests`, `candidate_reviews` | Who to notify, patient cost report, review state and reasoning. |
| Sponsorship | `sponsors`, `sponsored_placements` | Paid placement disclosure stored separately from clinical status and prices. |

`demo_patient_price_cents` and `reported_price_cents` are in U.S. cents, so `16500` means an invented $165.00. `manufacturer_is_synthetic=1` and `is_synthetic=1` identify fabricated fields. No patient or clinician communication address is real (`example.invalid`). The medication labels are references to example product labels; the label URLs must be rechecked in any real use.

## Example SQL

```sql
SELECT p.full_name, r.id AS request_id, m.display_name AS prescribed,
       r.reported_price_cents
FROM affordability_requests r
JOIN prescriptions rx ON rx.id = r.prescription_id
JOIN patients p ON p.id = rx.patient_id
JOIN medications m ON m.id = rx.medication_id;
```

```sql
SELECT cr.request_id, m.display_name, cr.preliminary_status,
       o.demo_patient_price_cents, sp.disclosure AS sponsored
FROM candidate_reviews cr
JOIN medications m ON m.id = cr.candidate_medication_id
JOIN affordability_requests r ON r.id = cr.request_id
JOIN prescriptions rx ON rx.id = r.prescription_id
LEFT JOIN pharmacy_offers o ON o.medication_id = m.id
    AND o.pharmacy_id = r.pharmacy_id AND o.quantity = rx.quantity
LEFT JOIN sponsored_placements sp ON sp.medication_id = m.id
ORDER BY cr.request_id, o.demo_patient_price_cents;
```

## Data provenance and limits

- Warning and indication summaries are abbreviated from the linked [NIH DailyMed labels](https://dailymed.nlm.nih.gov/dailymed/), as checked September 26, 2026. The full product labeling should be consulted for current details. The [openFDA labeling API](https://open.fda.gov/apis/drug/label/) offers a future path to refresh label text and structured sections.
- The [FDA Orange Book](https://www.fda.gov/drugs/drug-approvals-and-databases/approved-drug-products-therapeutic-equivalence-evaluations-orange-book) is the proper starting point for checking drug product equivalence; the synthetic manufacturer names here have no actual approvals or TE codes.
- Prices, insurance tiers, prior authorization flags, availability, and sponsorship are invented for UI testing. Never treat a demo offer as a live pharmacy quote.
- The database has one illustrative interaction flag, so absence of a stored flag never means absence of an interaction. Screening for medication interactions, allergies, renal status, pregnancy, and other safety issues requires a validated clinical source and professional review.
- No service authentication, audit trail, electronic prescribing, consent handling, or production PHI protections are implemented.
