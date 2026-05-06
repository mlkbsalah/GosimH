# SecondLife — Backend

Three-phase Python pipeline that identifies a broken appliance from photos, diagnoses the fault, and recommends a solution.

```
Photo(s) → Phase 1 (identify) → Phase 2 (diagnose) → Phase 3 (triage + solution)
```

---

## Architecture

| File | Role |
|---|---|
| `api/main.py` | FastAPI server — entry point for the frontend |
| `phase2.py` | Diagnosis agent — refines the fault from Phase 1 output |
| `phase3.py` | Solution agent — triage → DIY / repair / replacement |
| `main.py` | Standalone test runner (no HTTP) |
| `../object_identification.py` | Phase 1 — vision agent, lives at the project root |

---

## Requirements

Python 3.10+

Install all dependencies:

```bash
cd backend/api
pip install -r requirements.txt
```

| Package | Purpose |
|---|---|
| `fastapi` | HTTP framework |
| `uvicorn[standard]` | ASGI server |
| `python-multipart` | Multipart file uploads |
| `httpx` | HTTP client for LLM and Google API calls |
| `openai` | OpenRouter client (Phase 1 vision model) |
| `Pillow` | Image resizing and encoding |
| `pydantic` | Request/response validation |
| `ddgs` | DuckDuckGo search (Phase 1 tool calls) |

---

## Environment variables

Create a `.env` file in `backend/` (or at the project root). The server loads it automatically — no `python-dotenv` needed.

```ini
# Required
OPENROUTER_API_KEY=your_openrouter_key   # Phase 1 — vision model (z-ai/glm-5v-turbo)
R9S_API_KEY=your_r9s_key                 # Phase 2 & 3 — diagnosis model (glm-5 via r9s.ai)

# Optional
GOOGLE_PLACES_API_KEY=your_key           # Enables live repair shop search in Phase 3
```

Where to get keys:
- **OpenRouter** — [openrouter.ai](https://openrouter.ai)
- **r9s** — [portal.routetokens.com](https://portal.routetokens.com)
- **Google Places** — Google Cloud Console → enable "Places API (New)"

---

## Launching the API server

```bash
cd GosimH/backend/api
uvicorn main:app --reload --port 8000
```

The server starts at `http://localhost:8000`.  
Remove `--reload` for production.

Verify it is running:

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "openrouter_key": true,
  "r9s_key": true,
  "google_places_key": false,
  "vision_model": "z-ai/glm-5v-turbo",
  "agent_model": "glm-5"
}
```

Interactive Swagger docs are available at `http://localhost:8000/docs`.

---

## API endpoints

### `GET /api/health`

Returns key loading status and active model names. Use this to confirm the server has read your `.env` correctly.

---

### `POST /api/identify`

Identifies an appliance from photos (Phase 1).

**Request** — `multipart/form-data`:

| Field | Type | Required | Description |
|---|---|---|---|
| `photos` | file(s) | Yes | One to four appliance images |
| `hint` | string | No | Free-text context, e.g. "leaks at the door" |

**Response:**

```json
{
  "ok": true,
  "result": {
    "type": "washing_machine",
    "brand": "Whirlpool",
    "model": "AWOD 8453",
    "serial": null,
    "error_code": "F06",
    "visible_symptoms": ["door seal discoloured"],
    "confidence": 0.91
  },
  "follow_up": null
}
```

`follow_up` is a non-null string asking for more photos when confidence is below threshold or the model number could not be read.

---

### `POST /api/diagnose`

Runs Phase 2 (diagnosis) → Phase 3 (triage + solution).

Pass the `result` object from `/api/identify` as `identification`, or omit it and rely on `free_text` alone.

**Request body (JSON):**

| Field | Type | Required | Description |
|---|---|---|---|
| `identification` | object | No | Output of `/api/identify` |
| `free_text` | string | No | User description of the problem |
| `age` | string | No | Approximate purchase year |
| `tools` | string[] | No | Tools the user has available |
| `location` | string | No | City / region for repair shop search |
| `budget` | integer | No | Max repair budget in euros |

**Response — decision `"diy"`:**

```json
{
  "decision": "diy",
  "solution": {
    "type": "diy",
    "triage": { "reason": "...", "difficulty": 2, "estimated_repair_cost": "20–40 euros" },
    "guide": {
      "title": "How to fix: ...",
      "steps": [{ "number": 1, "title": "...", "description": "...", "warning": null }],
      "parts_needed": ["door seal – ~25 euros"],
      "tools_needed": ["flat screwdriver"]
    }
  }
}
```

**Response — decision `"repair"`:**

```json
{
  "decision": "repair",
  "solution": {
    "type": "repair",
    "triage": { "..." : "..." },
    "results": {
      "shops": [{ "name": "...", "address": "...", "rating": 4.5, "google_maps_url": "..." }],
      "questions_to_ask": ["Do you stock Whirlpool parts?"],
      "advice": "..."
    }
  }
}
```

When `GOOGLE_PLACES_API_KEY` is set, the shop list is replaced with live Google Places (New) results. Without the key it falls back to a plain Google Maps search link.

**Response — decision `"replacement"`:**

```json
{
  "decision": "replacement",
  "solution": {
    "type": "replacement",
    "triage": { "..." : "..." },
    "alternatives": {
      "recommended_models": [{ "brand": "Bosch", "model": "WAN28281GB", "estimated_price": "400 euros" }],
      "search_links": { "amazon": "...", "leboncoin": "...", "fnac": "..." }
    }
  }
}
```

---

## Running without the HTTP server (test mode)

Full Phase 1 → 2 → 3 pipeline from the command line:

```bash
cd GosimH/backend
python main.py
```

This uses a hard-coded Sharp R-354 microwave fixture and prints Phase 2 and Phase 3 JSON to stdout.

Test Phase 2 or Phase 3 in isolation (each has a built-in fixture):

```bash
python phase2.py
python phase3.py
```

---

## Notes

- CORS is pre-configured for `http://localhost:3000` (Next.js dev server). Tighten `allow_origins` in `api/main.py` before deploying.
- If `GOOGLE_PLACES_API_KEY` is absent, the repair path falls back to a generated Google Maps search link.
- The `.env` file is read at startup by the API server; Phase 2 and Phase 3 also load it directly when run standalone.
