"""
SECONDLIFE HACKATHON - PHASE 3
Solution Agent : Triage -> DIY / Repair / Replacement

Sponsor API : r9s (https://portal.routetokens.com/)
Model       : glm-5 (Zhipu AI)
"""

import os
import re
import sys
import json
import httpx
import time
from datetime import datetime
from pathlib import Path

# Fix Windows encoding: prevents crashes on special characters in prints
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# Manual .env loading (no need for python-dotenv)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

R9S_BASE_URL        = "https://api.r9s.ai/v1"
R9S_API_KEY         = os.getenv("R9S_API_KEY", "")
MODEL               = "glm-5"
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# API key check at startup
if not R9S_API_KEY:
    print("ERROR: R9S_API_KEY is not defined.")
    print("  -> Create a .env file with: R9S_API_KEY=your_key")
    print("  -> Or run: set R9S_API_KEY=your_key   (Windows)")
    print("  ->          export R9S_API_KEY=your_key (Linux/Mac)")
    sys.exit(1)


# ------------------------------------------------------------
#  UTILITY: LLM call via r9s
# ------------------------------------------------------------
def call_llm(system_prompt: str, user_message: str, max_tokens: int = 2000) -> str:
    payload = {
        "model": MODEL,
        "max_tokens": max_tokens,
        # Disable chain-of-thought / thinking to get direct JSON responses
        "thinking": {"type": "disabled"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
    }

    for attempt in range(3):
        try:
            response = httpx.post(
                f"{R9S_BASE_URL}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {R9S_API_KEY}",
                },
                json=payload,
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
    # Strategy 1: ```json ... ``` block
    match = re.search(r"```json\s*({.*?})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Strategy 2: first valid { ... } in the text (ignores any "thinking:" prefix)
    match = re.search(r"({.*})", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Strategy 3: simple cleanup
    try:
        cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw": text}


# ------------------------------------------------------------
#  UTILITY: LLM call with JSON retry loop
# ------------------------------------------------------------
def call_llm_json(system_prompt: str, user_message: str, max_tokens: int = 2000, max_retries: int = 3) -> dict:
    """
    Calls the LLM and guarantees a valid JSON output.
    If the model returns only a thinking block without JSON,
    retries with an explicit reminder to output JSON only.
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_message},
    ]

    for attempt in range(1, max_retries + 1):
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
        raw_text = response.json()["choices"][0]["message"]["content"]

        result = parse_json(raw_text)

        # Success: we have a real JSON (no lone "raw" key)
        if "raw" not in result:
            if attempt > 1:
                print(f"  -> JSON received on attempt {attempt}/{max_retries}")
            return result

        # Failure: model only thought without writing the JSON
        print(f"  -> Attempt {attempt}/{max_retries}: no JSON found, retrying...")
        messages.append({"role": "assistant", "content": raw_text})
        messages.append({"role": "user",      "content": "Now write ONLY the JSON as requested. No text before or after."})

    print(f"  -> Failed after {max_retries} attempts, returning raw")
    return {"raw": raw_text}


# ------------------------------------------------------------
#  AGENT 0 - TRIAGE
#  Decides between: "diy" | "repair" | "replacement"
# ------------------------------------------------------------
def agent_triage(context: dict) -> dict:
    system = """
You are an expert in home appliance repair.
Analyze the situation and decide the best solution among:
- "diy"         : can be fixed by the user with basic tools
- "repair"      : requires a professional technician
- "replacement" : not repairable OR not cost-effective (repair cost > 60% of new price)

Reply ONLY with valid JSON in this exact format, no text before or after:
{
  "decision": "diy" or "repair" or "replacement",
  "reason": "short explanation (1-2 sentences)",
  "difficulty": 1 to 5,
  "estimated_repair_cost": "X - Y euros",
  "estimated_new_price": "X euros"
}
"""
    user_msg = f"""
Appliance : {context['brand']} {context['appliance']} ({context['year']})
Diagnosis : {context['diagnosis']}
Available tools : {', '.join(context['tools'])}
Budget    : {context['budget']} euros
Location  : {context['location']}
"""
    print("Triage Agent running...")
    result = call_llm_json(system, user_msg)
    print("Decision:", result.get("decision"))
    return result


# ------------------------------------------------------------
#  AGENT 1 - DIY
#  Generates a step-by-step repair guide
# ------------------------------------------------------------
def agent_diy(context: dict, triage: dict) -> dict:
    system = """
You are a DIY home appliance repair expert.
Provide a detailed, clear, and structured repair guide specific to the model.

Reply ONLY with valid JSON, no text before or after:
{
  "title": "How to fix: [problem]",
  "estimated_duration": "X minutes",
  "difficulty": "Beginner / Intermediate / Advanced",
  "parts_needed": ["part name - approx price"],
  "tools_needed": ["list of required tools"],
  "steps": [
    {
      "number": 1,
      "title": "Step title",
      "description": "Detailed instructions",
      "warning": "Safety warning if applicable, otherwise null"
    }
  ],
  "tips": ["additional tips"],
  "sources": ["iFixit, manufacturer manual, etc."]
}
"""
    user_msg = f"""
Appliance       : {context['brand']} {context['appliance']} ({context['year']})
Problem         : {context['diagnosis']}
Available tools : {', '.join(context['tools'])}
Triage reason   : {triage.get('reason')}
"""
    print("DIY Agent running...")
    result = call_llm_json(system, user_msg, max_tokens=3000)
    print(f"DIY guide generated: {len(result.get('steps', []))} steps")
    return result


# ------------------------------------------------------------
#  AGENT 2 - REPAIR
#  Finds nearby repair shops via Google Maps
# ------------------------------------------------------------
def agent_repair(context: dict, triage: dict) -> dict:
    system = """
You help find home appliance repair shops.
Generate an optimal Google Maps search query and selection criteria.

Reply ONLY with valid JSON, no text before or after:
{
  "maps_query": "optimal Google Maps query (e.g. coffee machine repair Bosch Paris)",
  "required_skills": ["technical skills needed"],
  "max_repair_budget": "reasonable budget in euros",
  "questions_to_ask": ["questions to ask the technician before handing over the appliance"],
  "advice": "tips for choosing the right repair shop"
}
"""
    user_msg = f"""
Appliance : {context['brand']} {context['appliance']} ({context['year']})
Problem   : {context['diagnosis']}
Location  : {context['location']}
Budget    : {context['budget']} euros
"""
    print("Repair Agent: generating criteria...")
    criteria = call_llm_json(system, user_msg)

    shops = []
    query = criteria.get("maps_query", f"appliance repair {context['appliance']} {context['location']}")

    if GOOGLE_MAPS_API_KEY:
        try:
            maps_response = httpx.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                params={"query": query, "key": GOOGLE_MAPS_API_KEY},
                timeout=10.0,
            )
            maps_data = maps_response.json()
            for place in maps_data.get("results", [])[:5]:
                shops.append({
                    "name":           place["name"],
                    "address":        place.get("formatted_address", ""),
                    "rating":         place.get("rating"),
                    "reviews":        place.get("user_ratings_total"),
                    "open_now":       place.get("opening_hours", {}).get("open_now"),
                    "google_maps_url": f"https://www.google.com/maps/place/?q=place_id:{place['place_id']}",
                })
        except Exception as e:
            print("Google Maps error:", e)

    if not shops:
        shops = [{
            "name":           "Google Maps Search",
            "address":        f"Results for: {query}",
            "rating":         None,
            "reviews":        None,
            "open_now":       None,
            "google_maps_url": f"https://www.google.com/maps/search/{query.replace(' ', '+')}",
        }]

    print(f"Repair shops found: {len(shops)}")
    return {
        "shops":              shops,
        "required_skills":    criteria.get("required_skills", []),
        "max_budget":         criteria.get("max_repair_budget"),
        "questions_to_ask":   criteria.get("questions_to_ask", []),
        "advice":             criteria.get("advice"),
        "query_used":         query,
    }


# ------------------------------------------------------------
#  AGENT 3 - REPLACEMENT
#  Finds a replacement appliance within budget
# ------------------------------------------------------------
def agent_replacement(context: dict, triage: dict) -> dict:
    system = """
You help choose a replacement home appliance.
The user needs to replace a broken or uneconomical appliance.

Reply ONLY with valid JSON, no text before or after:
{
  "analysis": "why replacement is recommended",
  "criteria": ["important criteria for choosing the replacement"],
  "recommended_models": [
    {
      "brand": "...",
      "model": "...",
      "estimated_price": "X euros",
      "highlights": ["key strengths"],
      "leboncoin_query": "search query for second-hand",
      "amazon_query": "search query for new"
    }
  ],
  "buying_tips": ["tips for a smart purchase"]
}
"""
    user_msg = f"""
Broken appliance       : {context['brand']} {context['appliance']} ({context['year']})
Problem                : {context['diagnosis']}
Replacement budget     : {context['budget']} euros
Estimated repair cost  : {triage.get('estimated_repair_cost')}
Estimated new price    : {triage.get('estimated_new_price')}
"""
    print("Replacement Agent running...")
    result = call_llm_json(system, user_msg, max_tokens=3000)

    appliance_encoded = f"{context['appliance']}+{context['brand']}".replace(" ", "+")
    result["search_links"] = {
        "leboncoin": f"https://www.leboncoin.fr/recherche?text={appliance_encoded}",
        "fnac":      f"https://www.fnac.com/SearchResult/ResultList.aspx?Search={appliance_encoded}",
        "amazon":    f"https://www.amazon.fr/s?k={appliance_encoded}",
    }

    print(f"Recommended models: {len(result.get('recommended_models', []))}")
    return result


# ------------------------------------------------------------
#  MAIN ORCHESTRATOR - Phase 3
# ------------------------------------------------------------
def run_phase3(input_data: dict) -> dict:
    print("\n====================================")
    print("PHASE 3 - Starting")
    print("====================================")

    context = {
        # Phase 0
        "tools":      input_data.get("tools", []),
        "location":   input_data.get("location", ""),
        "budget":     input_data.get("budget", 0),
        # Phase 1
        "appliance":  input_data.get("appliance", ""),
        "brand":      input_data.get("brand", ""),
        "year":       input_data.get("year", ""),
        # Phase 2
        "diagnosis":  input_data.get("diagnosis", ""),
    }

    triage   = agent_triage(context)
    decision = triage.get("decision")

    if decision == "diy":
        solution = {
            "type":   "diy",
            "triage": triage,
            "guide":  agent_diy(context, triage),
        }
    elif decision == "repair":
        solution = {
            "type":    "repair",
            "triage":  triage,
            "results": agent_repair(context, triage),
        }
    else:
        solution = {
            "type":         "replacement",
            "triage":       triage,
            "alternatives": agent_replacement(context, triage),
        }

    output = {
        "status":    "success",
        "appliance": f"{context['brand']} {context['appliance']} ({context['year']})",
        "decision":  decision,
        "solution":  solution,
        "timestamp": datetime.now().isoformat(),
    }

    print("\n====================================")
    print("PHASE 3 - Done")
    print("====================================\n")

    return output


# ------------------------------------------------------------
#  QUICK TEST
# ------------------------------------------------------------
if __name__ == "__main__":
    test_input = {
        "tools":     ["no tools"],
        "location":  "Rennes",
        "budget":    100,
        "appliance": "microwave",
        "brand":     "Sharp",
        "year":      "2010",
        "diagnosis": "Microwave no longer heats. Magnetron is dead. Replacement magnetron estimated at 120 euros plus labor for a unit worth 80 euros new.",
    }

    result = run_phase3(test_input)
    print(json.dumps(result, ensure_ascii=False, indent=2))
