"""
web_search.py — Gemini grounded search for real manufacturer marketing claims.
"""

import os
import json
import re
import requests
import dotenv

dotenv.load_dotenv()

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)


def _repair_json(text: str) -> dict:
    """
    Multi-strategy JSON repair for truncated Gemini responses.
    Tries in order:
      1. Direct parse
      2. Strip markdown fences
      3. Close open arrays/objects then parse
      4. Regex-extract claims array and reconstruct minimal valid object
    """
    # Strategy 1 — direct
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2 — strip fences
    clean = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # Strategy 3 — balance braces/brackets then parse
    def balance(s):
        open_braces   = s.count('{') - s.count('}')
        open_brackets = s.count('[') - s.count(']')
        # Close any open string (find last unmatched quote)
        # Simple heuristic: truncate at last complete value boundary
        # Find last complete claim object
        last_obj = s.rfind('},')
        if last_obj == -1:
            last_obj = s.rfind('}')
        truncated = s[:last_obj + 1] if last_obj != -1 else s
        # Re-count after truncation
        ob = truncated.count('{') - truncated.count('}')
        br = truncated.count('[') - truncated.count(']')
        return truncated + (']' * max(0, br)) + ('}' * max(0, ob))

    try:
        return json.loads(balance(clean))
    except json.JSONDecodeError:
        pass

    # Strategy 4 — extract whatever complete claim objects exist
    claim_objects = re.findall(
        r'\{[^{}]*"claim_text"\s*:\s*"[^"]*"[^{}]*\}',
        clean,
        re.DOTALL
    )
    if claim_objects:
        claims = []
        for c in claim_objects:
            try:
                claims.append(json.loads(c))
            except json.JSONDecodeError:
                pass
        if claims:
            return {
                "claims_found":  claims,
                "search_summary": "Partial results recovered from truncated response",
            }

    raise ValueError(f"Cannot repair JSON. Raw (first 400): {text[:400]}")


def _call_gemini_search(prompt: str) -> dict:
    if not GEMINI_KEY:
        raise ValueError("GEMINI_API_KEY not set in .env")

    response = requests.post(
        f"{GEMINI_URL}?key={GEMINI_KEY}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {
                "temperature":     0.1,
                "maxOutputTokens": 4096,   # raised from 2048 — claims JSON can be large
            }
        },
        timeout=45                         # raised: grounded search takes longer
    )

    if not response.ok:
        raise ValueError(f"Gemini API error {response.status_code}: {response.text[:200]}")

    data       = response.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise ValueError(f"Gemini returned no candidates. Feedback: {data.get('promptFeedback', {})}")

    finish = candidates[0].get("finishReason", "")
    if finish not in ("STOP", "MAX_TOKENS", ""):
        raise ValueError(f"Gemini finish reason: {finish}")

    text = candidates[0]["content"]["parts"][0]["text"].strip()
    print(f"[web_search] Gemini raw ({len(text)} chars, first 300): {text[:300]}")

    return _repair_json(text)


def _build_prompt(brand, model, year, actual_total, actual_operational,
                  actual_manufacturing, vehicle_type):
    vehicle_name = f"{brand} {model}" + (f" {year}" if year else "")
    return f"""You are a greenwashing researcher. Search the web for REAL marketing claims 
made by {brand} about the {vehicle_name} ({vehicle_type}).

Find claims from: official website, press releases, TV/digital ads, eco-labels.
Only report claims you actually find. Do NOT invent or infer.

Lifecycle context (do not fabricate claims from this):
  Type: {vehicle_type} | Total: {actual_total:.1f} g CO₂/km
  Operational: {actual_operational:.1f} | Manufacturing: {actual_manufacturing:.1f}

Respond ONLY with raw JSON — no markdown, no prose, no code fences.

Required structure:
{{
  "vehicle": "{vehicle_name}",
  "search_summary": "one sentence",
  "claims_found": [
    {{
      "claim_text": "verbatim claim (max 120 chars)",
      "source": "source name (max 80 chars)",
      "source_url": "URL or null",
      "claim_type": "emissions|environmental|comparison|certification|other",
      "context": "where/how used (max 120 chars)"
    }}
  ]
}}

Rules:
- Maximum 5 claims. Fewer is fine if that is all you find.
- claim_text must be verbatim or near-verbatim
- Empty array if no real claims found
- No purely factual specs ("200 hp", "400 mile range")
"""


def search_marketing_claims(brand, model, year, actual_total,
                             actual_operational, actual_manufacturing,
                             vehicle_type) -> list[dict]:
    """
    Search for real manufacturer marketing claims via Gemini grounded search.
    Returns list of dicts: claim_text, source, source_url, claim_type, context.
    """
    vehicle_name = f"{brand} {model}" + (f" {year}" if year else "")
    print(f"[web_search] Searching: {vehicle_name}")

    try:
        result = _call_gemini_search(
            _build_prompt(brand, model, year, actual_total,
                          actual_operational, actual_manufacturing, vehicle_type)
        )
    except Exception as e:
        print(f"[web_search] Failed: {e}")
        return []

    raw    = result.get("claims_found", [])
    summary = result.get("search_summary", "")
    print(f"[web_search] {len(raw)} claims. {summary}")

    out = []
    for c in raw:
        text = (c.get("claim_text") or "").strip()
        if not text:
            continue
        out.append({
            "claim_text":  text,
            "source":      (c.get("source") or "Unknown").strip(),
            "source_url":  c.get("source_url") or None,
            "claim_type":  (c.get("claim_type") or "other").strip(),
            "context":     (c.get("context") or "").strip(),
        })

    return out