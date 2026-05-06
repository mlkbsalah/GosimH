# GosimH — SecondLife / Slaï

AI-powered appliance diagnosis assistant. Upload photos of a broken appliance, describe the problem, and get an honest answer: fix it yourself, call a pro, or replace it smartly.

```
Photo(s) → Phase 1 (identify) → Phase 2 (diagnose) → Phase 3 (triage + solution)
```

---

## Project structure

```
GosimH/
  object_identification.py   — Phase 1: vision agent (identifies appliance from photos)
  backend/
    phase2.py                — Phase 2: diagnosis agent (refines the fault)
    phase3.py                — Phase 3: solution agent (DIY / repair / replacement)
    main.py                  — Standalone test runner (no HTTP)
    api/
      main.py                — FastAPI server (bridge between frontend and agents)
      requirements.txt       — Python dependencies
  frontend/
    src/app/page.tsx         — Landing page
    src/app/diagnostic/      — 4-screen diagnostic flow
```

---

## Quick start

### 1. Python backend

**Requirements:** Python 3.10+

```bash
cd GosimH/backend/api
pip install -r requirements.txt
```

Create `GosimH/backend/.env`:

```ini
OPENROUTER_API_KEY=your_key    # Phase 1 vision model
R9S_API_KEY=your_key           # Phase 2 & 3 diagnosis model
GOOGLE_PLACES_API_KEY=your_key # Optional — live repair shop results
```

Start the API server:

```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend

**Requirements:** Node.js 18+

```bash
cd GosimH/frontend
npm install
npm run dev
```

App available at `http://localhost:3000`.

### 3. Both at once

```bash
cd GosimH/frontend
npm run dev:all
```

---

## Detailed documentation

- [Object identification (Phase 1)](object_identification.py) — see module docstring and `README.md`
- [Backend — phases 2, 3, and API](backend/README.md)
- [Frontend — Next.js app](frontend/README.md)

---

## Object identification (Phase 1)

`object_identification.py` identifies the appliance type, brand, model, serial number, error codes, and visible symptoms from up to 4 photos. It uses an agentic loop with two tools:

- `lookup_product` — DuckDuckGo search to resolve model names from visual features
- `verify_model` — checks that the candidate model exists on the manufacturer's official site

**Requirements:**

```bash
pip install openai pillow duckduckgo-search
export OPENROUTER_API_KEY=your_key
```

**As a module:**

```python
from object_identification import identify, format_result

result = identify(["front.jpg", "label.jpg"], hints=["bought in 2019"], location="France")
print(format_result(result))
# → I see a Whirlpool washing machine, model AWOD 8453. (Confidence: 91%)
```

**CLI:**

```bash
python object_identification.py
```

Enter a file path to add a photo, free text to add a hint, or `quit` to exit.

---

## API overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Check that env keys are loaded |
| `/api/identify` | POST | Upload photos → Phase 1 identification |
| `/api/diagnose` | POST | Phase 1 output + user details → Phase 2 diagnosis + Phase 3 solution |

Full API docs: `http://localhost:8000/docs` (Swagger UI, available when the server is running).
