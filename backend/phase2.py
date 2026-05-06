"""
SECONDLIFE HACKATHON - PHASE 2
Diagnosis Agent : Analyzes symptoms and produces a diagnosis

Input  (from Phase 1):
{
  "type": "dishwasher" | "washing_machine" | "dryer" | "fridge" |
          "freezer" | "oven" | "microwave" | "other",
  "brand":            str | null,
  "model":            str | null,
  "serial":           str | null,
  "error_code":       str | null,
  "visible_symptoms": [str],
  "confidence":       0.0-1.0
}

Output (fed into Phase 3):
{
  "appliance": str,
  "brand":     str,
  "year":      str,
  "diagnosis": str
}
"""

import os
import re
import sys
import json
import httpx
import time
from pathlib import Path

# Fix Windows encoding
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# Manual .env loading
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

R9S_BASE_URL = "https://api.r9s.ai/v1"
R9S_API_KEY  = os.getenv("R9S_API_KEY", "")
MODEL        = "glm-5"

if not R9S_API_KEY:
    print("ERROR: R9S_API_KEY is not defined.")
    print("  -> Create a .env file with: R9S_API_KEY=your_key")
    sys.exit(1)


# ------------------------------------------------------------
#  UTILITY: LLM call via r9s
# ------------------------------------------------------------
def call_llm(messages: list, max_tokens: int = 2000) -> str:
    for attempt in range(3):
        try:
            response = httpx.post(
                f"{R9S_BASE_URL}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {R9S_API_KEY}",
                },
                json={
                    "model": MODEL,
                    "max_tokens": max_tokens,
                    "thinking": {"type": "disabled"},
                    "messages": messages,
                },
                timeout=60.0,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"LLM error (attempt {attempt+1}/3): {e}")
            if attempt == 2:
                raise
            time.sleep(1)


# ------------------------------------------------------------
#  UTILITY: Safe JSON parser
# ------------------------------------------------------------
def parse_json(text: str) -> dict:
    match = re.search(r"```json\s*({.*?})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    match = re.search(r"({.*})", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    try:
        cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw": text}


# ------------------------------------------------------------
#  UTILITY: LLM call with JSON retry loop
# ------------------------------------------------------------
def call_llm_json(messages: list, max_tokens: int = 2000, max_retries: int = 3) -> dict:
    for attempt in range(1, max_retries + 1):
        raw_text = call_llm(messages, max_tokens)
        result   = parse_json(raw_text)

        if "raw" not in result:
            if attempt > 1:
                print(f"  -> JSON received on attempt {attempt}/{max_retries}")
            return result

        print(f"  -> Attempt {attempt}/{max_retries}: no JSON found, retrying...")
        messages = messages + [
            {"role": "assistant", "content": raw_text},
            {"role": "user",      "content": "Now write ONLY the JSON as requested. No text before or after."},
        ]

    print(f"  -> Failed after {max_retries} attempts, returning raw")
    return {"raw": raw_text}


# ------------------------------------------------------------
#  AGENT: DIAGNOSIS
#
#  Loop until confidence >= threshold or max iterations reached.
#  Each iteration the model refines its diagnosis based on
#  the previous attempt and the original data.
# ------------------------------------------------------------
CONFIDENCE_THRESHOLD = 0.80
MAX_ITERATIONS       = 3

SYSTEM_PROMPT = """
You are an expert home appliance repair technician.
Given an appliance description and its symptoms, produce a precise diagnosis.

Reply ONLY with valid JSON in this exact format, no text before or after:
{
  "appliance":        "human-readable appliance type (e.g. coffee machine, washing machine)",
  "brand":            "brand name or Unknown",
  "year":             "manufacturing year or Unknown",
  "diagnosis":        "clear one-paragraph diagnosis: what is broken, why, estimated repair cost if known",
  "confidence":       0.0 to 1.0,
  "missing_info":     ["list of information that would improve the diagnosis, empty if none"]
}

Confidence scale:
  0.0 - 0.5 : too many unknowns, diagnosis unreliable
  0.5 - 0.8 : probable diagnosis, some uncertainty
  0.8 - 1.0 : confident diagnosis based on clear symptoms
"""


def agent_diagnosis(phase1_data: dict) -> dict:
    """
    Runs the diagnosis loop.
    Returns the final diagnosis dict when confidence >= threshold
    or after MAX_ITERATIONS attempts.
    """
    appliance_type   = phase1_data.get("type", "unknown")
    brand            = phase1_data.get("brand") or "Unknown"
    model            = phase1_data.get("model") or "Unknown"
    serial           = phase1_data.get("serial") or "Unknown"
    error_code       = phase1_data.get("error_code") or "None"
    visible_symptoms = phase1_data.get("visible_symptoms", [])
    phase1_confidence= phase1_data.get("confidence", 0.0)

    user_content = f"""
Appliance type    : {appliance_type}
Brand             : {brand}
Model             : {model}
Serial number     : {serial}
Error code        : {error_code}
Visible symptoms  : {', '.join(visible_symptoms) if visible_symptoms else 'None reported'}
Phase 1 confidence: {phase1_confidence:.0%}
"""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_content},
    ]

    last_result = {}

    for iteration in range(1, MAX_ITERATIONS + 1):
        print(f"Diagnosis Agent - iteration {iteration}/{MAX_ITERATIONS}...")

        result = call_llm_json(messages, max_tokens=1500)
        confidence = result.get("confidence", 0.0)

        print(f"  Confidence: {confidence:.0%}")

        if result.get("missing_info"):
            print(f"  Missing info: {result['missing_info']}")

        last_result = result

        # Confident enough — stop the loop
        if confidence >= CONFIDENCE_THRESHOLD:
            print(f"  -> Confidence threshold reached, stopping loop.")
            break

        # Not confident yet — ask the model to refine using its own missing_info
        if iteration < MAX_ITERATIONS:
            missing = result.get("missing_info", [])
            if missing:
                refine_msg = (
                    f"Your confidence is only {confidence:.0%}. "
                    f"The following information is unavailable: {', '.join(missing)}. "
                    "Based on the most common failure patterns for this type of appliance, "
                    "refine your diagnosis to the most likely cause. "
                    "Reply ONLY with the updated JSON."
                )
            else:
                refine_msg = (
                    f"Your confidence is only {confidence:.0%}. "
                    "Refine your diagnosis based on the most common failure patterns. "
                    "Reply ONLY with the updated JSON."
                )

            messages = messages + [
                {"role": "assistant", "content": json.dumps(result)},
                {"role": "user",      "content": refine_msg},
            ]

    return last_result


# ------------------------------------------------------------
#  MAIN: run_phase2
# ------------------------------------------------------------
def run_phase2(phase1_data: dict) -> dict:
    """
    Entry point for Phase 2.
    Takes Phase 1 JSON, returns the dict needed by Phase 3.
    """
    print("\n====================================")
    print("PHASE 2 - Starting")
    print("====================================")

    result = agent_diagnosis(phase1_data)

    # Build the Phase 3 input (tools/location/budget added by the frontend)
    output = {
        "appliance": result.get("appliance", phase1_data.get("type", "unknown")),
        "brand":     result.get("brand",     phase1_data.get("brand") or "Unknown"),
        "year":      result.get("year",      "Unknown"),
        "diagnosis": result.get("diagnosis", ""),
    }

    print("\n====================================")
    print("PHASE 2 - Done")
    print("====================================\n")

    return output


# ------------------------------------------------------------
#  QUICK TEST
# ------------------------------------------------------------
if __name__ == "__main__":
    test_input = {
        "type":             "microwave",
        "brand":            "Sharp",
        "model":            "R-354",
        "serial":           None,
        "error_code":       None,
        "visible_symptoms": [
            "no longer heats food",
            "turntable still spins",
            "light works",
            "makes a buzzing noise when running"
        ],
        "confidence": 0.75,
    }

    result = run_phase2(test_input)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("\n--- Phase 3 input would be: ---")
    phase3_input = {
        **result,
        "tools":    ["no tools"],
        "location": "Rennes",
        "budget":   100,
    }
    print(json.dumps(phase3_input, ensure_ascii=False, indent=2))