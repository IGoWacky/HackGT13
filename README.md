# HackGT13

React + Vite frontend with a FastAPI backend.

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

Open the URL printed by Vite to see the Home page. The backend's index route is at `http://127.0.0.1:8000/`. FastAPI's interactive docs are available at `http://127.0.0.1:8000/docs`.

## Checks

```powershell
cd frontend
npm run build
npm run lint
```