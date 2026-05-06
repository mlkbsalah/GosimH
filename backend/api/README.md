# SecondLife API

FastAPI bridge between the Next.js frontend and the existing Python agents
(`object_identification.py` and `backend/phase3.py`).

## Run

```bash
cd GosimH/backend/api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then open http://localhost:8000/docs for the interactive Swagger UI.

## Endpoints

- `GET  /api/health` — env keys loaded? models?
- `POST /api/identify` — `multipart/form-data` with `photos[]` files and
  optional `hint` text. Wraps `object_identification.identify()`.
- `POST /api/diagnose` — JSON body matching `phase3.run_phase3()`. Returns
  the triage decision and the corresponding solution (DIY / repair /
  replacement). When `decision == "reparateur"` and `GOOGLE_PLACES_API_KEY`
  is set, the repairer list is replaced with Google Places (New / v2) data.

## Environment

Reads `GosimH/backend/.env` (symlink to `GosimH/.env`) at startup. Required:

- `OPENROUTER_API_KEY` — vision model (`object_identification.py`)
- `R9S_API_KEY` — agent model (`phase3.py`)

Optional:

- `GOOGLE_PLACES_API_KEY` — Places API (New). If absent, falls back to the
  Google Maps Search URL produced by `phase3.py`.
