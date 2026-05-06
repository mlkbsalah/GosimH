import base64
import io
import json
import os
import sys
import time

from ddgs import DDGS
from openai import OpenAI
from PIL import Image

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MODEL = "z-ai/glm-5v-turbo"
MAX_PHOTOS = 4
MAX_TOOL_ROUNDS = 5
CONFIDENCE_THRESHOLD = 0.5
LOG_FILE = "session_log.jsonl"

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
)

# ---------------------------------------------------------------------------
# Prompts & tool schema
# ---------------------------------------------------------------------------

_JSON_SCHEMA = """{
  "type": "dishwasher" | "washing_machine" | "dryer" | "fridge" | "freezer" | "oven" | "microwave" | "other",
  "brand": str | null,
  "model": str | null,
  "serial": str | null,
  "error_code": str | null,
  "visible_symptoms": [str],
  "confidence": 0.0-1.0
}"""

PROMPT = f"""Identify this appliance from the photos.
Strategy:
1. Read any visible text (brand, model, serial, error codes) from the photos.
2. Call lookup_product with the brand + model (or a visual description if no model is visible) to retrieve real product specs and confirm your reading. If location or purchase year are provided, include them in the query to target the right market and generation.
3. Once you have a brand and candidate model, call verify_model to confirm the model exists on the manufacturer's official website. If it doesn't exist, adjust the model number and try again.
4. Once confirmed, reply with JSON only — no other text:
{_JSON_SCHEMA}
Use null for anything you can't confirm. Never invent model or serial numbers.
"confidence" is your overall confidence in 'type' and 'brand'."""

BRAND_SITES = {
    "whirlpool":   "whirlpool.eu",
    "samsung":     "samsung.com",
    "lg":          "lg.com",
    "bosch":       "bosch-home.com",
    "siemens":     "siemens-home.bsh-group.com",
    "miele":       "miele.com",
    "aeg":         "aeg.com",
    "electrolux":  "electrolux.com",
    "hotpoint":    "hotpoint.eu",
    "indesit":     "indesit.com",
    "beko":        "beko.com",
    "haier":       "haier.com",
    "hisense":     "hisense.com",
}

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "lookup_product",
            "description": (
                "Search the web for an appliance model and return product page snippets "
                "with specs, capacity, energy rating, and full model name. "
                "Use this to narrow down a model from visible features when no model number is readable."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "e.g. 'Whirlpool front load 8kg A+++ 1400rpm washing machine model' or "
                            "'Whirlpool AWOD 8453 specs'"
                        ),
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "verify_model",
            "description": (
                "Check whether a specific model number exists on the manufacturer's official website. "
                "Call this after lookup_product gives you a candidate model number. "
                "Returns matching pages from the brand's site, or an empty list if the model isn't found."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "brand": {
                        "type": "string",
                        "description": "Brand name in lowercase, e.g. 'whirlpool'",
                    },
                    "model": {
                        "type": "string",
                        "description": "Model number to verify, e.g. 'AWOD 8453'",
                    },
                },
                "required": ["brand", "model"],
            },
        },
    },
]

# ---------------------------------------------------------------------------
# Image encoding
# ---------------------------------------------------------------------------

def encode_image(path, max_side=1568):
    img = Image.open(path)
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def _lookup_product(query):
    with DDGS() as ddgs:
        hits = list(ddgs.text(query, max_results=5))
    return [{"title": h.get("title"), "snippet": h.get("body"), "url": h.get("href")} for h in hits]


def _verify_model(brand, model):
    site = BRAND_SITES.get(brand.lower())
    query = f'site:{site} "{model}"' if site else f'{brand} official site "{model}"'
    with DDGS() as ddgs:
        hits = list(ddgs.text(query, max_results=5))
    return {
        "site": site or "unknown",
        "found": len(hits) > 0,
        "results": [{"title": h.get("title"), "snippet": h.get("body"), "url": h.get("href")} for h in hits],
    }

# ---------------------------------------------------------------------------
# Identification
# ---------------------------------------------------------------------------

def _parse_json(text):
    return json.loads(text.strip("` \njson"))


def identify(photo_paths, hints=None, location=None, year=None):
    """Agentic identification: model analyses photos and may call lookup_product
    and verify_model to cross-check its guess. Returns the parsed result dict."""
    text = PROMPT
    context = list(hints or [])
    if location:
        context.append(f"The appliance is located in / was sold in: {location}")
    if year:
        context.append(f"Approximate purchase year: {year}")
    if context:
        text += "\n\nUser context:\n" + "\n".join(f"- {c}" for c in context)

    image_blocks = [
        {"type": "image_url", "image_url": {"url": encode_image(p)}}
        for p in photo_paths[:MAX_PHOTOS]
    ]
    messages = [{"role": "user", "content": [{"type": "text", "text": text}, *image_blocks]}]

    for _ in range(MAX_TOOL_ROUNDS):
        resp = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.1,
            max_tokens=800,
            timeout=60,
        )
        choice = resp.choices[0]

        if choice.finish_reason == "tool_calls":
            messages.append(choice.message)
            for tc in choice.message.tool_calls:
                args = json.loads(tc.function.arguments)
                try:
                    if tc.function.name == "verify_model":
                        results = _verify_model(args["brand"], args["model"])
                    else:
                        results = _lookup_product(args["query"])
                except Exception as e:
                    results = {"error": str(e)}
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(results, ensure_ascii=False),
                })
        else:
            return _parse_json(choice.message.content)

    raise RuntimeError("Model did not produce a final answer within tool call limit")

# ---------------------------------------------------------------------------
# Result helpers
# ---------------------------------------------------------------------------

def log_turn(photos, hints, result):
    entry = {"ts": time.time(), "photos": photos, "hints": hints, "result": result}
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def format_result(result):
    if "error" in result:
        return f"Something went wrong: {result['error']}"

    kind = result.get("type", "unknown").replace("_", " ")
    brand = result.get("brand") or "unknown brand"
    model = result.get("model")
    serial = result.get("serial")
    error_code = result.get("error_code")
    symptoms = result.get("visible_symptoms") or []
    confidence = result.get("confidence", 0)

    parts = [f"I see a {brand} {kind}" + (f", model {model}" if model else "") + "."]
    if serial:
        parts.append(f"Serial number: {serial}.")
    if error_code:
        parts.append(f"Error code on display: {error_code}.")
    if symptoms:
        parts.append("Visible issues: " + ", ".join(symptoms) + ".")
    parts.append(f"(Confidence: {int(confidence * 100)}%)")
    return " ".join(parts)


def needs_more(result, n_photos):
    """Returns a follow-up prompt if more photos would help, else None."""
    if "error" in result or n_photos >= MAX_PHOTOS:
        return None
    if result.get("type") == "other" or (result.get("confidence") or 0) < CONFIDENCE_THRESHOLD:
        return ("I can't identify this clearly. Try a wide shot showing the whole appliance, "
                "or type the brand and model manually.")
    if not result.get("model"):
        return ("Photograph the rating plate (sticker on the door edge, side, or back). "
                "Type 'skip' if you can't find it.")
    return None

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    photo_paths = []
    hints = []

    print("Appliance identifier — enter a photo path or a text hint. 'quit' to exit.")

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye.")
            break

        if not user_input or user_input.lower() in ("quit", "exit"):
            print("Goodbye.")
            break

        if os.path.isfile(user_input):
            if len(photo_paths) >= MAX_PHOTOS:
                print(f"Assistant: Maximum of {MAX_PHOTOS} photos reached.")
                continue
            photo_paths.append(user_input)
        else:
            if not photo_paths:
                print("Assistant: Please provide a photo path first.")
                continue
            hints.append(user_input)

        print(f"Assistant: Analyzing {len(photo_paths)} photo(s)...")
        try:
            result = identify(photo_paths, hints or None)
        except Exception as e:
            result = {"error": str(e)}

        log_turn(photo_paths, hints, result)
        print(f"Assistant: {format_result(result)}")
        follow_up = needs_more(result, len(photo_paths))
        if follow_up:
            print(f"Assistant: {follow_up}")


if __name__ == "__main__":
    main()
