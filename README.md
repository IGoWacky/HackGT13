# RxRescue

RxRescue is a patient-specific prescription decision-support concept for
healthcare professionals (HCPs). When a pharmacy cannot fulfill a prescription,
RxRescue is designed to help an HCP review relevant generic alternatives using
the patient's known information, with clear explanations for each result.

The HCP remains responsible for the final clinical decision. RxRescue is a
hackathon prototype concept, not a prescribing system or a source of medical
advice.

## The Problem

A prescription issue can require an HCP to gather and compare information about
alternative medications, the patient's profile, and relevant warnings. A
generic list alone does not show whether an option is appropriate for a
particular patient or why it should be considered.

RxRescue aims to bring that context together at the point of need, helping the
HCP assess options without replacing their judgment.

## Planned Workflow

1. A patient/pharmacy reports that a prescription cannot be fulfilled.
2. The platform uses the relevant patient medical data and prescription details to
   assess available alternatives.
3. Alternatives with a known safety concern, such as a documented allergy,
   are marked ineligible rather than merely ranked lower. Other concerns are
   surfaced for HCP review.
4. Eligible alternatives are presented with the patent's medical file, and a list of
    of generic alternatives. Our website will also rank partnered pharmaceutical companies 
    higher on the lit that the HCP recieves which gives another avenue for advertisement.
5. The HCP reviews the information, makes the decision, creates an e-prescription through 
    docupdate, and then sends that information to the pharmacy that the patient is waiting at.

The intended experience is decision support: the platform informs the HCP, and
the HCP decides what to do next.

## Planned Components

- **Patient profile:** relevant details such as current medications, known
  allergies, conditions, and medical history.
- **Medication information:** a curated prototype dataset of generic
  alternatives, active ingredients, warnings, contraindications, costs, and known
  interactions.
- **Recommendation engine:** This engine filters possible alternatives by cost, compatibility
    (patient allergies and conflicts with existing medication) and medication warning labels 
    in accordance with the FDA Drug Label Website.
- **RxRescue update messenger:** The messenger sends a packet of information containing the medical file 
    of the patient in question, and a list of the top 3 partnered generic matches and the top 3 non-partnered generic options, all sorted by patient compatibility.
- **Prescription follow-through:** a prototype workflow for recording the
  HCP's selected alternative and representing the updated prescription.

For the hackathon, clinical and medication data should be curated for
demonstration. Recommendations are not validated for real-world clinical use.

## Impiricus Track

RxRescue applies the idea of timely, relevant HCP engagement to a prescription
event. Instead of sending a generic medication message, the concept gives the
HCP information tied to the specific patient and issue, along with a clear
next action. This connects to Impiricus's public focus on personalized,
trigger-based HCP resources and enabling action at the moment it is useful.

- [Impiricus products](https://impiricus.com/our-products)
- [Impiricus solutions](https://impiricus.com/our-solutions/)

## Current Implementation

The repository currently contains:

- **Frontend:** A React, TypeScript, and Vite patient-portal preview with local
  sample requests.
- **Backend:** FastAPI and SQLAlchemy, with `POST /patients` for signup plus
  `GET /patients/{patient_id}` and `GET /prescriptions/{patient_id}` routes.
  Interactive API docs are at `/docs`.

Signup stores a local demo account with a one-way password hash, and login
verifies those credentials against the local database. The patient-specific
recommendation engine and clinical workflow are still in development.

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

Open the URL printed by Vite to see the current starter page. The backend root
is at `http://127.0.0.1:8000/`; FastAPI's interactive docs are at
`http://127.0.0.1:8000/docs`.

## Quick start on Windows

Install Node.js 20.19+ (or 22.12+) and Python 3.10+ first. Open two PowerShell
terminals in the project root.

### Start the backend

In the first terminal, install the Python dependencies and start FastAPI:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The API is at `http://127.0.0.1:8000/`; its interactive docs are at
`http://127.0.0.1:8000/docs`. The included `backend/patients.db` is used by the
API.

### Start the frontend

In the second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. The signup form sends profile details to
FastAPI through Vite's `/api` development proxy.

### Run a synthetic demo packet

From a separate terminal at the project root, the demo database is included.
To recreate it with deterministic synthetic data and print a clinician packet,
run:

```powershell
py .\seed_demo_db.py
py .\demo_packet.py REQ1
```

Change `REQ1` to `REQ2`, `REQ3`, `REQ4`, or `REQ5` to inspect another scenario.
The scripts use only Python's standard library, so no package installation is
needed for the standalone packet demo.

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
