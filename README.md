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
  allergies, conditions, age, and medical history.
- **Medication information:** a curated prototype dataset of generic
  alternatives, active ingredients, warnings, contraindications, costs, and known
  interactions.
- **Recommendation engine:** This engine filters possible alternatives by cost, compatibility
    (patient allergies and conflicts with existing medication) and medication warning labels 
    in accordance with the FDA Drug Label Website.
- **PEP update messenger:** The messenger sends a packet of information containing the medical file 
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

The repository is the starting scaffold for the project:

- **Frontend:** React, TypeScript, and Vite. The current page displays
  “Hello, world!”.
- **Backend:** FastAPI. The current API provides `GET /`, and FastAPI's
  interactive docs are available at `/docs`.

The patient portal, medication dataset, recommendation logic, HCP workflow,
messenger, and prescription update flow are planned functionality and have not
yet been implemented.

## Requirements

- Node.js 20.19+ or 22.12+
- Python 3.10+

## Run locally

Start the API in one terminal:

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Start the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite to see the current starter page. The backend root
is at `http://127.0.0.1:8000/`; FastAPI's interactive docs are at
`http://127.0.0.1:8000/docs`.

## Checks

```powershell
cd frontend
npm run build
npm run lint
```