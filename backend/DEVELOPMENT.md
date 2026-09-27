# Local demo report reset

The dashboard has a **Developer tools → Reset reports** control. It appears in
Vite development mode when the local API enables the reset feature. The sample
“Explore the demo” session can clear its in-memory reports without an API.

## Enable for a local demo

Start the backend from its folder. On macOS/Linux:

```bash
source .venv/bin/activate
RXRESCUE_ENABLE_DEMO_RESET=1 python -m uvicorn app.main:app --reload
```

On Windows PowerShell:

```powershell
$env:RXRESCUE_ENABLE_DEMO_RESET = "1"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Run `npm run dev` in the frontend folder, log in, and open **Overview**. Near the
bottom, click **Reset reports**, then **Delete reports** to confirm. Reload the
page after enabling the backend feature if the control was previously hidden.

This removes all reports for the current patient, including their saved status
history. It preserves the patient account, prescriptions, and other patients’
reports. Logging out and back in does not restore deleted reports. Sample-mode
reports are different: they return when starting another sample session.

Restart the backend without the environment flag to disable deletion. In
PowerShell, first run `Remove-Item Env:RXRESCUE_ENABLE_DEMO_RESET`. The control is
also omitted from production frontend builds. This helper is for local demos;
it does not add authentication to the existing patient-ID-based API.

## How it works

1. The frontend checks `GET /reports/developer/status` through the Vite proxy.
2. Confirmation sends `DELETE /reports/developer/{patient_id}` using the patient
   ID returned at login or signup.
3. FastAPI checks the explicit environment flag and a loopback client address.
4. SQLAlchemy deletes rows from `prescription_issue_reports` filtered by that
   patient ID, commits the change, and returns `deleted_count`.
5. The frontend clears report state only after a successful response. Summary
   counts derive from that same state, so they update immediately.

No report creation, prescription, account, or message-data schema is changed.

## Check the reset behavior

From the backend folder:

```bash
.venv/bin/python -m unittest discover -s tests -v
```

The tests use isolated in-memory SQLite databases and do not delete development
reports. They cover patient isolation, persistence across sessions, repeated
resets, disabled/nonlocal access, missing patients, and rollback on failure.
