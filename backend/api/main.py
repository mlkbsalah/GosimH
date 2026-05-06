"""
SecondLife — FastAPI bridge between the Next.js frontend and the existing
Python agents (object_identification.py + backend/phase3.py).

This file imports the existing modules but never modifies them. Run with:

    cd GosimH/backend/api
    uvicorn main:app --reload --port 8000

Endpoints:
    GET  /api/health    — check that env keys are loaded
    POST /api/identify  — multipart upload (photos[] + optional hint)
                          → wraps object_identification.identify()
    POST /api/diagnose  — JSON body matching phase3.run_phase3()
                          → returns triage + DIY/repair/replacement solution
                          → if decision == "reparateur" and a Google Places
                            (New) API key is set, the repairer list is
                            replaced with results from the v2 API.
"""

import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
#  Path & .env bootstrapping
# ---------------------------------------------------------------------------
HERE = Path(__file__).parent              # GosimH/backend/api/
BACKEND_DIR = HERE.parent                 # GosimH/backend/
ROOT = BACKEND_DIR.parent                 # GosimH/

# Make sibling modules importable without installing
sys.path.insert(0, str(ROOT))             # for object_identification.py at root
sys.path.insert(0, str(BACKEND_DIR))      # for phase3.py in backend/


def _load_env() -> Path:
    """Read GosimH/.env (or backend/.env) into os.environ, stripping whitespace.

    Required because object_identification.py reads os.environ at import time.
    """
    candidates = [BACKEND_DIR / ".env", ROOT / ".env"]
    for env_file in candidates:
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip())
            return env_file
    return Path("/dev/null")


_ENV_LOADED_FROM = _load_env()

# Now safe to import modules that read env at module-load time
import httpx                              # noqa: E402
import object_identification as oi       # noqa: E402
import phase2                             # noqa: E402
import phase3                             # noqa: E402

GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()


# ---------------------------------------------------------------------------
#  App
# ---------------------------------------------------------------------------
app = FastAPI(title="SecondLife API", version="0.1.0")

# CORS — Next.js dev server runs on :3000. Tighten in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
#  /api/health
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "env_loaded_from": str(_ENV_LOADED_FROM),
        "openrouter_key": bool(os.getenv("OPENROUTER_API_KEY")),
        "r9s_key": bool(os.getenv("R9S_API_KEY")),
        "google_places_key": bool(GOOGLE_PLACES_API_KEY),
        "vision_model": oi.MODEL,
        "agent_model": phase3.MODEL,
    }


# ---------------------------------------------------------------------------
#  /api/identify
# ---------------------------------------------------------------------------
@app.post("/api/identify")
async def identify(
    photos: list[UploadFile] = File(...),
    hint: Optional[str] = Form(None),
) -> dict[str, Any]:
    """Save uploaded photos to a temp dir, run identify(), return JSON.

    Front-end sends a multipart form with one or more `photos` files and an
    optional `hint` string. The hint is added to the user prompt to help
    disambiguate (e.g. "leaks at the door").
    """
    if not photos:
        raise HTTPException(status_code=400, detail="No photos provided")

    with tempfile.TemporaryDirectory() as td:
        paths: list[str] = []
        for i, photo in enumerate(photos[: oi.MAX_PHOTOS]):
            ext = Path(photo.filename or f"img{i}.jpg").suffix or ".jpg"
            dest = Path(td) / f"img_{i}{ext}"
            dest.write_bytes(await photo.read())
            paths.append(str(dest))

        try:
            result = oi.identify(paths, hints=[hint] if hint else None)
        except Exception as exc:  # the LLM call can fail in many ways
            return {"ok": False, "error": str(exc)}

    follow_up = oi.needs_more(result, len(photos))
    return {
        "ok": True,
        "result": result,
        "follow_up": follow_up,
    }


# ---------------------------------------------------------------------------
#  /api/diagnose
# ---------------------------------------------------------------------------
class DiagnoseRequest(BaseModel):
    """Full pipeline input — runs Phase 2 → Phase 3 server-side.

    `identification` is the Phase 1 output (from /api/identify) when photos
    were uploaded. When absent, we synthesise a minimal Phase-1-shaped dict
    from `free_text` so Phase 2 can still infer the appliance type.
    """
    identification: Optional[dict[str, Any]] = None
    free_text: str = ""
    age: Optional[str] = None
    tools: list[str] = Field(default_factory=list)
    location: str = ""
    budget: int = 0


@app.post("/api/diagnose")
def diagnose(req: DiagnoseRequest) -> dict[str, Any]:
    """Phase 2 (refine diagnosis) → Phase 3 (triage + path agent).

    Phase 1 is run separately by /api/identify; its output is passed back as
    `identification` so we don't double-call the vision model.
    """
    # ----- Build the Phase 1-shaped dict that Phase 2 expects ------------
    if req.identification:
        phase1 = dict(req.identification)
        # Append the user's free text as another visible symptom — it's
        # context the model didn't see in the photos.
        if req.free_text.strip():
            phase1.setdefault("visible_symptoms", []).append(req.free_text.strip())
    else:
        # No photos were uploaded — Phase 2 will infer the appliance type
        # from the user's free-text description.
        phase1 = {
            "type": "other",
            "brand": None,
            "model": None,
            "serial": None,
            "error_code": None,
            "visible_symptoms": [req.free_text] if req.free_text.strip() else [],
            "confidence": 0.5,
        }

    if not phase1.get("visible_symptoms"):
        raise HTTPException(
            status_code=400,
            detail="No symptoms to diagnose. Upload photos or describe the problem.",
        )

    # ----- Phase 2: refine diagnosis -------------------------------------
    try:
        phase2_result = phase2.run_phase2(phase1)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"phase2 error: {exc}")

    # The user knows the appliance's age better than the model can guess it.
    if req.age:
        phase2_result["year"] = req.age

    # ----- Phase 3: triage + solution ------------------------------------
    phase3_input = {
        **phase2_result,
        "tools": req.tools,
        "location": req.location,
        "budget": req.budget,
    }

    try:
        result = phase3.run_phase3(phase3_input)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"phase3 error: {exc}")

    # Surface intermediate steps so the frontend can display them if useful.
    result["phase2"] = phase2_result

    # Override Google Maps legacy results with Places API (New) when available.
    solution = result.get("solution", {})
    if (
        result.get("decision") == "repair"
        and GOOGLE_PLACES_API_KEY
        and solution.get("type") == "repair"
    ):
        query = solution.get("results", {}).get("query_used", "")
        if query:
            try:
                places = _places_v2_search(query)
                if places:
                    solution["results"]["shops"] = places
                    solution["results"]["source"] = "google_places_v2"
            except Exception as exc:
                # Keep phase3's fallback list; surface the error for debugging.
                solution["results"]["places_error"] = str(exc)

    return result


def _places_v2_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Call Google Places API (New) — POST :searchText.

    Doc: https://developers.google.com/maps/documentation/places/web-service/text-search

    Returns shop dicts with the same English keys used by phase3 v3 in
    `solution.results.shops`, so the override is transparent.
    """
    resp = httpx.post(
        "https://places.googleapis.com/v1/places:searchText",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
            # Keep the field mask minimal — costs scale per requested field.
            "X-Goog-FieldMask": (
                "places.displayName,"
                "places.formattedAddress,"
                "places.rating,"
                "places.userRatingCount,"
                "places.googleMapsUri,"
                "places.regularOpeningHours.openNow"
            ),
        },
        json={"textQuery": query, "maxResultCount": max_results},
        timeout=10.0,
    )
    resp.raise_for_status()
    data = resp.json()
    return [
        {
            "name": p.get("displayName", {}).get("text", ""),
            "address": p.get("formattedAddress", ""),
            "rating": p.get("rating"),
            "reviews": p.get("userRatingCount"),
            "open_now": p.get("regularOpeningHours", {}).get("openNow"),
            "google_maps_url": p.get("googleMapsUri", ""),
        }
        for p in data.get("places", [])
    ]
