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
        {"type": "image_url", "image_url": {"url": encode(p)}} for p in photo_paths
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