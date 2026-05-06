"""
Ablation study: effect of each pipeline element on identification accuracy.

Pipeline elements tested:
  A  Vision only          (no tools, plain prompt)
  B  + lookup_product     (web text search)
  C  + verify_model       (manufacturer site check)
  D  + location           (France)
  E  + location + year    (France, 2018)

Photo sets:
  W/O  without washing1_2.jpeg  (no serial/rating plate)
  W/   with    washing1_2.jpeg  (serial + rating plate visible)

Ground truth: Whirlpool AWOD 8453, serial 859202629013
"""

import json
import time

from object_identification import (
    BRAND_SITES,
    MODEL,
    TOOLS,
    _lookup_product,
    _parse_json,
    _verify_model,
    client,
    encode_image,
)

# ---------------------------------------------------------------------------
# Ground truth
# ---------------------------------------------------------------------------

GT_BRAND  = "whirlpool"
GT_MODEL  = "AWOD 8453"
GT_SERIAL = "859202629013"

WITHOUT_SERIAL = ["washing1_1.jpeg", "washing1_3.jpeg", "washing1_4.jpeg"]
WITH_SERIAL    = ["washing1_1.jpeg", "washing1_2.jpeg", "washing1_3.jpeg", "washing1_4.jpeg"]

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_JSON_SCHEMA = """{
  "type": "...",
  "brand": str | null,
  "model": str | null,
  "serial": str | null,
  "error_code": str | null,
  "visible_symptoms": [str],
  "confidence": 0.0-1.0
}"""

PROMPT_PLAIN = f"""Identify this appliance from the photos.
Reply with JSON only — no other text:
{_JSON_SCHEMA}
Use null for anything you can't read. Never invent model or serial numbers."""

PROMPT_WITH_LOOKUP = f"""Identify this appliance from the photos.
Strategy:
1. Read any visible text (brand, model, serial, error codes) from the photos.
2. Call lookup_product to retrieve real product specs and confirm your reading.
3. Reply with JSON only — no other text:
{_JSON_SCHEMA}
Use null for anything you can't confirm. Never invent model or serial numbers."""

PROMPT_WITH_BOTH = f"""Identify this appliance from the photos.
Strategy:
1. Read any visible text (brand, model, serial, error codes) from the photos.
2. Call lookup_product to retrieve real product specs and confirm your reading.
3. Call verify_model to confirm the model exists on the manufacturer's official website.
4. Reply with JSON only — no other text:
{_JSON_SCHEMA}
Use null for anything you can't confirm. Never invent model or serial numbers."""

TOOLS_LOOKUP_ONLY = [TOOLS[0]]   # lookup_product
TOOLS_BOTH        = TOOLS         # lookup_product + verify_model

# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_variant(photos, prompt, tools=None, location=None, year=None, max_rounds=5):
    context = []
    if location:
        context.append(f"Appliance location / market: {location}")
    if year:
        context.append(f"Approximate purchase year: {year}")

    text = prompt
    if context:
        text += "\n\nUser context:\n" + "\n".join(f"- {c}" for c in context)

    image_blocks = [
        {"type": "image_url", "image_url": {"url": encode_image(p)}} for p in photos
    ]
    messages = [{"role": "user", "content": [{"type": "text", "text": text}, *image_blocks]}]

    tool_calls_made = []

    for _ in range(max_rounds):
        kwargs = dict(
            model=MODEL,
            messages=messages,
            temperature=0.1,
            max_tokens=800,
            timeout=60,
        )
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        resp = client.chat.completions.create(**kwargs)
        choice = resp.choices[0]

        if tools and choice.finish_reason == "tool_calls":
            messages.append(choice.message)
            for tc in choice.message.tool_calls:
                args = json.loads(tc.function.arguments)
                tool_calls_made.append(tc.function.name)
                try:
                    if tc.function.name == "verify_model":
                        result = _verify_model(args["brand"], args["model"])
                    else:
                        result = _lookup_product(args["query"])
                except Exception as e:
                    result = {"error": str(e)}
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })
        else:
            try:
                parsed = _parse_json(choice.message.content)
            except Exception:
                parsed = {"error": "parse_failed", "raw": choice.message.content}
            return parsed, tool_calls_made

    return {"error": "no_final_answer"}, tool_calls_made


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score(result):
    brand_ok  = (result.get("brand") or "").lower() == GT_BRAND
    model_val = (result.get("model") or "").upper().replace(" ", "")
    gt_model  = GT_MODEL.upper().replace(" ", "")
    model_ok  = model_val == gt_model
    model_close = gt_model in model_val or model_val in gt_model or (
        sum(a != b for a, b in zip(model_val, gt_model)) <= 1 and len(model_val) == len(gt_model)
    )
    serial_ok = result.get("serial") == GT_SERIAL
    conf      = result.get("confidence", 0)
    return brand_ok, model_ok, model_close, serial_ok, conf


# ---------------------------------------------------------------------------
# Study
# ---------------------------------------------------------------------------

VARIANTS = [
    ("A  Vision only",           PROMPT_PLAIN,       None,             None,     None),
    ("B  + lookup_product",      PROMPT_WITH_LOOKUP,  TOOLS_LOOKUP_ONLY, None,   None),
    ("C  + verify_model",        PROMPT_WITH_BOTH,    TOOLS_BOTH,        None,   None),
    ("D  + location",            PROMPT_WITH_BOTH,    TOOLS_BOTH,       "France", None),
    ("E  + location + year",     PROMPT_WITH_BOTH,    TOOLS_BOTH,       "France", "2018"),
]

PHOTO_SETS = [
    ("W/O serial photo", WITHOUT_SERIAL),
    ("W/  serial photo", WITH_SERIAL),
]

def fmt_bool(b):
    return "✓" if b else "✗"

def run_study():
    header = f"{'Variant':<26} {'Photos':<18} {'Brand':^6} {'Model':^7} {'~Model':^7} {'Serial':^7} {'Conf':^6} {'Tools called'}"
    print(header)
    print("-" * len(header))

    for label, prompt, tools, location, year in VARIANTS:
        for set_label, photos in PHOTO_SETS:
            result, calls = run_variant(photos, prompt, tools, location, year)
            brand_ok, model_ok, model_close, serial_ok, conf = score(result)
            calls_str = ", ".join(calls) if calls else "—"
            print(
                f"{label:<26} {set_label:<18} "
                f"{fmt_bool(brand_ok):^6} {fmt_bool(model_ok):^7} {fmt_bool(model_close):^7} "
                f"{fmt_bool(serial_ok):^7} {conf:^6.0%} {calls_str}"
            )
            time.sleep(2)   # avoid DDG rate-limiting between runs
        print()

    print("\nLegend: Brand=brand correct  Model=exact  ~Model=off by ≤1 char  Serial=serial found")
    print(f"Ground truth: {GT_BRAND.title()} {GT_MODEL}  serial {GT_SERIAL}")


if __name__ == "__main__":
    run_study()
