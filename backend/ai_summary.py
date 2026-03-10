import os
import json
import requests
import psycopg2
import dotenv

dotenv.load_dotenv()

DB_URL      = os.getenv("DB_URI")
GEMINI_KEY  = os.getenv("GEMINI_API_KEY")
GEMINI_URL  = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)


def get_connection():
    return psycopg2.connect(DB_URL)

 
# =====================================================
# FETCH IMAGE URL FROM afdc_vehicles
# =====================================================

def get_vehicle_image_db(brand, model, year):
    """
    Look up image_url from afdc_vehicles.
    Tries exact year first, then any year for that brand+model.
    Returns None if not found or URL is 'NaN'.
    """
    conn = get_connection()
    cur  = conn.cursor()

    cur.execute("""
        SELECT image_url
        FROM afdc_vehicles
        WHERE LOWER(brand) = LOWER(%s)
          AND LOWER(model)  LIKE LOWER(%s)
          AND year = %s
          AND image_url IS NOT NULL
          AND image_url != 'NaN'
        LIMIT 1
    """, (brand, f"%{model}%", year))

    row = cur.fetchone()

    if not row:
        cur.execute("""
            SELECT image_url
            FROM afdc_vehicles
            WHERE LOWER(brand) = LOWER(%s)
              AND LOWER(model)  LIKE LOWER(%s)
              AND image_url IS NOT NULL
              AND image_url != 'NaN'
            ORDER BY ABS(year - %s)
            LIMIT 1
        """, (brand, f"%{model}%", year))
        row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        return None

    url = row[0]
    return url if url and url.strip() and url.strip() != "NaN" else None


# =====================================================
# WIKIMEDIA COMMONS IMAGE FALLBACK
# Free, no API key, clean car images
# =====================================================

WIKI_HEADERS = {
    "User-Agent": "CarbonWise/1.0 (vehicle lifecycle emissions platform; contact@carbonwise.app) python-requests"
}

def get_wikimedia_image(query):
    """
    Search Wikimedia Commons for a vehicle image using the provided query string.
    Returns the best image URL (thumb ~640px wide) or None if nothing found.
    """
    try:
        search_url = "https://en.wikipedia.org/w/api.php"
        search_params = {
            "action":      "query",
            "list":        "search",
            "srsearch":    query,
            "srnamespace": 0,
            "srlimit":     3,
            "format":      "json",
        }

        search_res = requests.get(search_url, params=search_params, headers=WIKI_HEADERS, timeout=8)
        search_res.raise_for_status()
        search_data = search_res.json()

        hits = search_data.get("query", {}).get("search", [])
        if not hits:
            print(f"[ai_summary] Wikimedia: no search results for '{query}'")
            return None

        # Try each result until we find one with a page image
        for hit in hits:
            page_title = hit["title"]

            image_res = requests.get(search_url, params={
                "action":      "query",
                "titles":      page_title,
                "prop":        "pageimages",
                "pithumbsize": 640,
                "format":      "json",
            }, headers=WIKI_HEADERS, timeout=8)
            image_res.raise_for_status()
            image_data = image_res.json()

            pages = image_data.get("query", {}).get("pages", {})
            for page in pages.values():
                thumb = page.get("thumbnail", {}).get("source")
                if thumb:
                    print(f"[ai_summary] Wikimedia fallback image: {thumb}")
                    return thumb

        print(f"[ai_summary] Wikimedia: no page image found for '{query}'")
        return None

    except Exception as e:
        print(f"[ai_summary] Wikimedia fallback failed: {e}")
        return None


def get_vehicle_image(brand, model, year, image_query=None):
    """
    1. Try afdc_vehicles DB  (fast, reliable)
    2. If None, try Wikimedia Commons using Gemini-supplied image_query
    3. If still None, try a generic fallback query  '<brand> <model> <year> car'
    """
    # Step 1 — DB
    url = get_vehicle_image_db(brand, model, year)
    if url:
        return url

    # Step 2 — Wikimedia with Gemini query
    if image_query:
        url = get_wikimedia_image(image_query)
        if url:
            return url

    # Step 3 — Wikimedia with generic query
    fallback_query = f"{brand} {model} {year} car"
    url = get_wikimedia_image(fallback_query)
    return url  # may still be None


# =====================================================
# BUILD GEMINI PROMPT
# =====================================================

def build_prompt(vehicles_data, distance_km):

    vehicle_lines = []

    for v in vehicles_data:
        lc = v["lifecycle"]
        vehicle_lines.append(
            f"- {v['brand']} {v['model']} ({v['year']}) [{v['vehicle_type']}]\n"
            f"  operational_g_per_km: {lc.get('operational_g_per_km')} g/km\n"
            f"  manufacturing_total_kg: {lc.get('manufacturing_total_kg')} kg CO₂\n"
            f"  total_for_distance_kg: {lc.get('total_for_distance_kg')} kg CO₂ over {distance_km} km\n"
            f"  total_g_per_km: {lc.get('total_g_per_km')} g/km"
        )

    vehicles_str = "\n".join(vehicle_lines)

    return f"""You are an expert automotive lifecycle emissions analyst.

The user is comparing these vehicles over {distance_km} km:

{vehicles_str}

Analyze these vehicles and respond ONLY with a valid JSON object — no markdown, no explanation, no code fences.

The JSON must have exactly this structure:
{{
  "winner": "Brand Model Year",
  "winner_type": "BEV|ICE|HEV|PHEV",
  "winner_image_query": "Brand Model Year car Wikipedia",
  "verdict": "One sentence explaining why this vehicle wins overall",
  "reasons": [
    "Specific reason 1 with data",
    "Specific reason 2 with data",
    "Specific reason 3 with data"
  ],
  "breakdown": [
    {{
      "name": "Brand Model Year",
      "type": "BEV|ICE|HEV|PHEV",
      "total_kg": 1234.5,
      "rate_g_per_km": 45.2,
      "is_winner": true,
      "image_query": "Brand Model Year car Wikipedia",
      "note": "One sentence assessment of this specific vehicle"
    }}
  ]
}}

STRICT RULES — violating any will break the parser:
- respond with raw JSON ONLY, no markdown, no backticks, no prose before or after
- verdict: MAX 120 characters
- each reason: MAX 100 characters
- each note: MAX 80 characters
- winner_image_query: a good Wikipedia search string for the winner vehicle, e.g. "Tesla Model 3 2023 electric car"
- each breakdown image_query: a good Wikipedia search string for that vehicle
- winner = vehicle with lowest total_for_distance_kg
- breakdown must include ALL vehicles listed above
"""


# =====================================================
# CALL GEMINI
# =====================================================

def call_gemini(prompt):

    if not GEMINI_KEY:
        raise ValueError("GEMINI_API_KEY not set in environment — add it to your .env file")

    print(f"[ai_summary] Calling Gemini API...")

    try:
        response = requests.post(
            f"{GEMINI_URL}?key={GEMINI_KEY}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature":     0.2,
                    "maxOutputTokens": 4096,
                }
            },
            timeout=30
        )
    except requests.exceptions.Timeout:
        raise ValueError("Gemini API timed out after 30s")
    except requests.exceptions.ConnectionError as e:
        raise ValueError(f"Cannot reach Gemini API: {e}")

    if not response.ok:
        print(f"[ai_summary] Gemini HTTP {response.status_code}: {response.text[:500]}")
        raise ValueError(f"Gemini API error {response.status_code}: {response.text[:200]}")

    data = response.json()
    print(f"[ai_summary] Gemini response keys: {list(data.keys())}")

    candidates = data.get("candidates", [])
    if not candidates:
        feedback = data.get("promptFeedback", {})
        raise ValueError(f"Gemini returned no candidates. Feedback: {feedback}")

    candidate = candidates[0]
    finish_reason = candidate.get("finishReason", "")
    if finish_reason not in ("STOP", "MAX_TOKENS", ""):
        raise ValueError(f"Gemini finish reason: {finish_reason}")

    text = (
        candidate["content"]["parts"][0]["text"]
        .strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )

    print(f"[ai_summary] Raw Gemini text (first 300 chars): {text[:300]}")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"[ai_summary] JSON parse failed, attempting repair...")
        try:
            last_brace = text.rfind("}")
            if last_brace != -1:
                repaired = text[:last_brace + 1]
                return json.loads(repaired)
        except json.JSONDecodeError:
            pass
        raise ValueError(f"Gemini response is not valid JSON even after repair.\nRaw: {text[:500]}")


# =====================================================
# MAIN ENTRY POINT
# =====================================================

def generate_summary(vehicles_data, distance_km):
    """
    vehicles_data: list of { brand, model, year, vehicle_type, lifecycle }
    distance_km:   int

    Returns enriched summary dict with image URLs attached.
    Image resolution order per vehicle:
      1. afdc_vehicles DB
      2. Wikimedia Commons via Gemini-supplied image_query
      3. Wikimedia Commons via generic fallback query
    """
    prompt  = build_prompt(vehicles_data, distance_km)
    summary = call_gemini(prompt)

    winner_name        = summary.get("winner", "")
    winner_image_query = summary.get("winner_image_query")

    # Build a quick lookup: full_name -> image_query from breakdown
    breakdown_queries = {
        b.get("name"): b.get("image_query")
        for b in summary.get("breakdown", [])
    }

    for v in vehicles_data:
        full_name = f"{v['brand']} {v['model']} {v['year']}"

        # Prefer breakdown-level query, fall back to winner_image_query for winner
        image_query = breakdown_queries.get(full_name)
        if not image_query and full_name == winner_name:
            image_query = winner_image_query

        img = get_vehicle_image(v["brand"], v["model"], v["year"], image_query=image_query)

        if full_name == winner_name:
            summary["winner_image_url"] = img

        for b in summary.get("breakdown", []):
            if b.get("name") == full_name:
                b["image_url"] = img

    summary.setdefault("winner_image_url", None)

    return summary