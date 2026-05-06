import base64
import io
import json
import os
import sys
import time

from openai import OpenAI
from PIL import Image

MODEL = "z-ai/glm-5v-turbo"
MAX_PHOTOS = 4
MAX_IMAGE_SIDE = 1568
LOG_FILE = "session_log.jsonl"

PROMPT = """Identify this appliance from the photos. Reply with JSON only:
{
  "type": "dishwasher" | "washing_machine" | "dryer" | "fridge" | "freezer" | "oven" | "microwave" | "other",
  "brand": str | null,
  "model": str | null,
  "serial": str | null,
  "error_code": str | null,
  "visible_symptoms": [str],
  "confidence": 0.0-1.0
}
Use null for anything you can't read. Never invent model or serial numbers.
"confidence" is your overall confidence in 'type' and 'brand'."""


client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
)

def encode_image(path, max_side=1568):
    img = Image.open(path)
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}"

def _parse_json(text):
    return json.loads(text.strip("` \njson"))

def log_turn(photos, hints, result):
    entry = {"ts": time.time(), "photos": photos, "hints": hints, "result": result}
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def identify(photo_paths, hints=None):
    text = PROMPT
    if hints:
        text += "\n\nUser context:\n" + "\n".join(f"- {h}" for h in hints)

    image_blocks = [
        {"type": "image_url", "image_url": {"url": encode_image(p)}} for p in photo_paths
    ]

    content = [{"type": "text", "text": text}, *image_blocks]

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": content}],
        temperature=0.1,
        max_tokens=600,
        timeout=60,
    )
    
    return _parse_json(resp.choices[0].message.content)


REQUIRED_FIELDS = {"type", "brand", "confidence"}
CONFIDENCE_THRESHOLD = 0.5

def identify_batch(photo_paths):
    """One-shot identification from a set of photos. Returns the result dict on
    success (confident type + brand), or None if identification failed."""
    if not photo_paths:
        return None
    try:
        result = identify(photo_paths[:MAX_PHOTOS])
    except Exception:
        return None
    if (
        result.get("type") not in (None, "other")
        and (result.get("confidence") or 0) >= CONFIDENCE_THRESHOLD
        and result.get("brand")
    ):
        log_turn(photo_paths, [], result)
        return result
    return None


def next_step(result, n_photos):
    if "error" in result:
        return "Something went wrong on the last call. Try another photo or type 'skip'."
    if n_photos >= MAX_PHOTOS:
        return None
    if result.get("type") == "other" or (result.get("confidence") or 0) < 0.5:
        return ("I can't identify this clearly. Take a wide shot showing the whole "
                "appliance, or type the brand and model manually.")
    if not result.get("model"):
        return ("Photograph the rating plate (sticker on the door edge, side, or back). "
                "Type 'skip' if you can't find it.")
    return None


def _format_result(result):
    if "error" in result:
        return f"Something went wrong: {result['error']}"

    lines = []
    kind = result.get("type", "unknown").replace("_", " ")
    brand = result.get("brand") or "unknown brand"
    model = result.get("model")
    serial = result.get("serial")
    error_code = result.get("error_code")
    symptoms = result.get("visible_symptoms") or []
    confidence = result.get("confidence", 0)

    lines.append(f"I see a {brand} {kind}" + (f", model {model}" if model else "") + ".")
    if serial:
        lines.append(f"Serial number: {serial}")
    if error_code:
        lines.append(f"Error code on display: {error_code}")
    if symptoms:
        lines.append("Visible issues: " + ", ".join(symptoms) + ".")
    lines.append(f"(Confidence: {int(confidence * 100)}%)")
    return " ".join(lines)


def main():
    photo_paths = []
    hints = []
    result = None

    print("Appliance identifier — send a photo path to get started, or 'quit' to exit.")

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
            print(f"Assistant: Got it, analyzing {len(photo_paths)} photo(s)...")
            try:
                result = identify(photo_paths, hints or None)
            except Exception as e:
                result = {"error": str(e)}
            log_turn(photo_paths, hints, result)
            print(f"Assistant: {_format_result(result)}")
            follow_up = next_step(result, len(photo_paths))
            if follow_up:
                print(f"Assistant: {follow_up}")
        else:
            if not photo_paths:
                print("Assistant: Please send a photo path first.")
                continue
            hints.append(user_input)
            print(f"Assistant: Thanks, re-analyzing with your note...")
            try:
                result = identify(photo_paths, hints)
            except Exception as e:
                result = {"error": str(e)}
            log_turn(photo_paths, hints, result)
            print(f"Assistant: {_format_result(result)}")
            follow_up = next_step(result, len(photo_paths))
            if follow_up:
                print(f"Assistant: {follow_up}")


if __name__ == "__main__":
    main()
