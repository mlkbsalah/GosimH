# SecondLife — Backend

> Hackathon project — AI-powered repair assistant for home appliances.

---

## Overview

The backend is split into two independent agents that run sequentially:

```
[Phase 1 - Malek]                     [Phase 0 - Aurélie]
Image analysis                         Web interface
→ appliance type, brand, model         → tools, location, budget
         │                                      │
         └──────────────┬───────────────────────┘
                        ▼
               [ Phase 2 — Diagnosis ]
               Analyzes symptoms
               → appliance, brand, year, diagnosis
                        │
                        ▼
               [ Phase 3 — Solution ]
               Decides the best action
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
        DIY           Repair      Replacement
    Step-by-step   Nearby shops   Alternatives
       guide       (Google Maps)  within budget
```

---

## Project Structure

```
backend/
├── phase2.py        # Diagnosis agent
├── phase3.py        # Solution agent
├── test_cases.py    # 34 test cases for Phase 3
├── .env             # API keys (never commit this)
└── README.md
```

---

## Setup

### 1. Requirements

Python 3.11+ and one dependency:

```bash
pip install httpx
```

### 2. Environment variables

Create a `.env` file at the root of the backend folder:

```env
R9S_API_KEY=your_r9s_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_key_here   # optional, Phase 3 repair agent only
```

The `.env` file is loaded automatically at startup — no need for `python-dotenv`.

### 3. API

Both agents use the **r9s** sponsor API with model `glm-5`:

| Provider    | Model | Used for      |
|-------------|-------|---------------|
| GLM (Zhipu) | glm-5 | Phase 2 and 3 |

Base URL: `https://api.r9s.ai/v1` — OpenAI-compatible format.

---

## Phase 2 — Diagnosis Agent

**File:** `phase2.py`

### What it does

Takes the structured output from Phase 1 (appliance recognition) and produces a plain-text diagnosis with the key facts needed by Phase 3.

### Input (from Phase 1)

```python
{
  "type":             "microwave",
  "brand":            "Sharp",
  "model":            "R-354",
  "serial":           None,
  "error_code":       None,
  "visible_symptoms": [
      "no longer heats food",
      "turntable still spins",
      "buzzing noise when running"
  ],
  "confidence": 0.75
}
```

### Output (fed into Phase 3)

```python
{
  "appliance": "microwave",
  "brand":     "Sharp",
  "year":      "2010",
  "diagnosis": "The magnetron is likely dead. The appliance runs (light, turntable, fan) but produces no heat and emits a buzzing sound, which is the classic magnetron failure signature. Replacement cost estimated at 120 euros plus labor."
}
```

### How it works — Confidence loop

The agent runs up to **3 iterations**. Each iteration, the model produces a diagnosis with a confidence score between 0.0 and 1.0. If confidence is below **0.80**, the model is asked to refine its answer based on the most common failure patterns for that appliance type — without needing more user input.

```
Iteration 1 → confidence: 55% → missing: ["serial number", "error code"]
              → ask model to refine using common failure patterns

Iteration 2 → confidence: 85% → threshold reached, stop
```

These two constants can be tuned at the top of `phase2.py`:

```python
CONFIDENCE_THRESHOLD = 0.80   # stop loop when reached
MAX_ITERATIONS       = 3      # hard cap on API calls
```

### Quick test

```bash
python phase2.py
```

---

## Phase 3 — Solution Agent

**File:** `phase3.py`

### What it does

Takes the output of Phase 2 (diagnosis) plus the user context from Phase 0 (tools, location, budget), and decides the best course of action among three options: **DIY**, **professional repair**, or **replacement**.

### Input (Phase 2 output + Phase 0 user context)

```python
{
  # From Phase 2
  "appliance": "microwave",
  "brand":     "Sharp",
  "year":      "2010",
  "diagnosis": "Magnetron dead. Repair estimated at 120 euros...",

  # From Phase 0 (frontend)
  "tools":    ["no tools"],
  "location": "Rennes",
  "budget":   100,
}
```

### Output

```python
{
  "status":    "success",
  "appliance": "Sharp microwave (2010)",
  "decision":  "replacement",
  "solution": {
    "type": "replacement",
    "triage": {
      "decision":             "replacement",
      "reason":               "Repair cost exceeds appliance value.",
      "difficulty":           4,
      "estimated_repair_cost":"110 - 150 euros",
      "estimated_new_price":  "80 euros"
    },
    "alternatives": {
      "analysis":           "...",
      "recommended_models": [...],
      "buying_tips":        [...],
      "search_links": {
        "leboncoin": "https://...",
        "fnac":      "https://...",
        "amazon":    "https://..."
      }
    }
  },
  "timestamp": "2026-05-06T12:00:00"
}
```

### The 4 internal agents

| Agent           | Role                                                      |
|-----------------|-----------------------------------------------------------|
| **Triage**      | Analyzes everything and picks DIY / repair / replacement  |
| **DIY**         | Generates a step-by-step repair guide for the exact model |
| **Repair**      | Queries Google Maps for nearby shops, returns rated list  |
| **Replacement** | Recommends alternatives within budget + search links      |

#### Decision logic (Triage agent)

```
repair cost > 60% of new price   →  replacement
multiple / complex failures       →  repair or replacement
simple maintenance task           →  diy
user has no tools                 →  repair
```

### Quick test

```bash
python phase3.py
```

---

## Connecting Phase 2 and Phase 3

```python
from phase2 import run_phase2
from phase3 import run_phase3

# Phase 2
phase2_result = run_phase2(phase1_json)
# → { "appliance": ..., "brand": ..., "year": ..., "diagnosis": ... }

# Merge with Phase 0 user context
phase3_input = {
    **phase2_result,
    "tools":    user_tools,
    "location": user_location,
    "budget":   user_budget,
}

# Phase 3
final_result = run_phase3(phase3_input)
```

---

## Testing Phase 3

**File:** `test_cases.py` — 34 test cases across 4 groups.

```bash
python test_cases.py               # run all 34 tests
python test_cases.py diy           # only DIY cases (8)
python test_cases.py repair        # only repair cases (8)
python test_cases.py replacement   # only replacement cases (8)
python test_cases.py edge          # only edge cases (10)
python test_cases.py single diy_01 # one specific test by ID
```

### Test groups

| Group         | Count | Description                                            |
|---------------|-------|--------------------------------------------------------|
| `diy`         | 8     | Simple maintenance: limescale, clogged filters, seals  |
| `repair`      | 8     | Electrical failures: heating elements, pumps, bearings |
| `replacement` | 8     | Dead compressors, obsolete parts, uneconomical repairs |
| `edge`        | 10    | Zero budget, warranty cases, pro tools, small towns... |

---

## Known Limitations

- **GLM-5 thinking mode** — the model sometimes outputs a reasoning block before the JSON. Handled automatically by the `call_llm_json()` retry loop in both files.
- **Google Maps** — if no API key is set, the repair agent falls back to a direct Google Maps search link.
- **Year detection** — if Phase 1 does not provide a manufacturing year, Phase 2 estimates it from the model number or returns `"Unknown"`.