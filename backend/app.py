import os
import math
import json
import re

from flask import Flask, request, jsonify
from flask_cors import CORS

from database import get_db_connection
from engine import calculate_lifecycle
from recommendation import recommend_vehicle
from break_even import break_even_km
from greenwashing import evaluate_claims
from carbon_index import carbon_score
from annual_impact import annual_emissions
from ai_summary import generate_summary, get_vehicle_image
from wallet_routes import wallet_bp
from impact_routes import impact_bp          # ← ADD THIS

app = Flask(__name__)
CORS(app)
app.register_blueprint(wallet_bp)
app.register_blueprint(impact_bp)            # ← ADD THIS


# ─────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────

RISK_ORDER = ["SAFE", "CAUTION", "WARNING", "VIOLATION"]

def _worst_risk(risks):
    ranked = [r for r in risks if r in RISK_ORDER]
    return max(ranked, key=lambda r: RISK_ORDER.index(r)) if ranked else "SAFE"

def _get(d, *keys, default=0.0):
    for k in keys:
        if k in d and d[k] is not None:
            try:
                return float(d[k])
            except (TypeError, ValueError):
                pass
    return float(default)

def _fetch_vehicle(cur, brand, model, year):
    cur.execute(
        "SELECT * FROM vehicles WHERE brand=%s AND model=%s AND year=%s LIMIT 1",
        (brand, model, year),
    )
    row = cur.fetchone()
    if not row:
        return None
    columns = [desc[0] for desc in cur.description]
    return dict(zip(columns, row))


# ─────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return jsonify({"platform": "CarbonWise API", "status": "running"})


# ─────────────────────────────────────────────────────────────────
# VEHICLE LIST
# ─────────────────────────────────────────────────────────────────

@app.route("/vehicles")
def get_vehicles():
    page         = int(request.args.get("page", 1))
    limit        = int(request.args.get("limit", 200))
    vehicle_type = request.args.get("vehicle_type", "")
    offset       = (page - 1) * limit

    conn = get_db_connection()
    cur  = conn.cursor()

    if vehicle_type:
        if vehicle_type.upper() == "EV":
            cur.execute("SELECT COUNT(*) FROM vehicles WHERE vehicle_type IN ('EV','BEV')")
        else:
            cur.execute("SELECT COUNT(*) FROM vehicles WHERE vehicle_type=%s", (vehicle_type,))
    else:
        cur.execute("SELECT COUNT(*) FROM vehicles")
    total = cur.fetchone()[0]

    if vehicle_type:
        if vehicle_type.upper() == "EV":
            cur.execute(
                "SELECT brand, model, year, vehicle_type FROM vehicles "
                "WHERE vehicle_type IN ('EV','BEV') ORDER BY brand, model LIMIT %s OFFSET %s",
                (limit, offset),
            )
        else:
            cur.execute(
                "SELECT brand, model, year, vehicle_type FROM vehicles "
                "WHERE vehicle_type=%s ORDER BY brand, model LIMIT %s OFFSET %s",
                (vehicle_type, limit, offset),
            )
    else:
        cur.execute(
            "SELECT brand, model, year, vehicle_type FROM vehicles "
            "ORDER BY brand, model LIMIT %s OFFSET %s",
            (limit, offset),
        )

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify({
        "vehicles": [
            {"brand": r[0], "model": r[1], "year": r[2], "vehicle_type": r[3]}
            for r in rows
        ],
        "total": total,
        "page":  page,
        "pages": math.ceil(total / limit),
    })


# ─────────────────────────────────────────────────────────────────
# VEHICLE SEARCH
# ─────────────────────────────────────────────────────────────────

@app.route("/vehicle-search")
def vehicle_search():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify([])

    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute(
        "SELECT brand, model, year, vehicle_type FROM vehicles "
        "WHERE LOWER(brand) LIKE %s OR LOWER(model) LIKE %s "
        "ORDER BY brand, model LIMIT 30",
        (f"%{q.lower()}%", f"%{q.lower()}%"),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify([
        {"brand": r[0], "model": r[1], "year": r[2], "vehicle_type": r[3]}
        for r in rows
    ])


# ─────────────────────────────────────────────────────────────────
# VEHICLE DETAIL
# ─────────────────────────────────────────────────────────────────

@app.route("/vehicle-detail")
def vehicle_detail():
    brand = request.args.get("brand")
    model = request.args.get("model")
    year  = request.args.get("year")

    if not all([brand, model, year]):
        return jsonify({"error": "brand, model, year required"}), 400

    conn    = get_db_connection()
    cur     = conn.cursor()
    vehicle = _fetch_vehicle(cur, brand, model, year)
    cur.close()
    conn.close()

    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404
    return jsonify(vehicle)


# ─────────────────────────────────────────────────────────────────
# WINNER DETAIL
# ─────────────────────────────────────────────────────────────────

@app.route("/winner-detail", methods=["POST"])
def winner_detail():
    data  = request.json or {}
    brand = data.get("brand", "")
    model = data.get("model", "")
    year  = data.get("year")

    if not brand or not model:
        return jsonify({"image_url": None, "specs": None}), 200

    conn = get_db_connection()
    cur  = conn.cursor()

    cur.execute(
        "SELECT image_url, manufacturer_url FROM afdc_vehicles "
        "WHERE LOWER(brand)=LOWER(%s) AND LOWER(model) LIKE LOWER(%s) "
        "AND year=%s AND image_url IS NOT NULL AND image_url != 'NaN' LIMIT 1",
        (brand, f"%{model}%", year),
    )
    row = cur.fetchone()

    if not row:
        cur.execute(
            "SELECT image_url, manufacturer_url FROM afdc_vehicles "
            "WHERE LOWER(brand)=LOWER(%s) AND LOWER(model) LIKE LOWER(%s) "
            "AND image_url IS NOT NULL AND image_url != 'NaN' "
            "ORDER BY ABS(year - %s) LIMIT 1",
            (brand, f"%{model}%", year),
        )
        row = cur.fetchone()

    cur.close()
    conn.close()

    manufacturer_url = None
    if row:
        _, raw_mfr = row
        if raw_mfr and raw_mfr.strip() not in ("", "NaN"):
            manufacturer_url = raw_mfr

    return jsonify({
        "image_url": get_vehicle_image(brand, model, year),
        "specs":     {"manufacturer_url": manufacturer_url},
    })


# ─────────────────────────────────────────────────────────────────
# LIFECYCLE ANALYSIS
# ─────────────────────────────────────────────────────────────────

@app.route("/lifecycle", methods=["POST"])
def lifecycle():
    data      = request.json or {}
    brand     = data.get("brand")
    model     = data.get("model")
    year      = data.get("vehicle_year")
    country   = data.get("country")
    grid_year = data.get("grid_year")

    if not all([brand, model, year, country]):
        return jsonify({"error": "Missing parameters"}), 400

    conn    = get_db_connection()
    cur     = conn.cursor()
    vehicle = _fetch_vehicle(cur, brand, model, year)
    cur.close()
    conn.close()

    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404

    return jsonify(calculate_lifecycle(vehicle, country, grid_year))


# ─────────────────────────────────────────────────────────────────
# MULTI-VEHICLE COMPARISON
# ─────────────────────────────────────────────────────────────────

@app.route("/compare-multiple", methods=["POST"])
def compare_multiple():
    data           = request.json or {}
    country        = data.get("country")
    year           = data.get("year")
    distance_km    = data.get("distance_km")
    vehicles_input = data.get("vehicles")

    if not vehicles_input:
        return jsonify({"error": "vehicles required"}), 400

    conn    = get_db_connection()
    cur     = conn.cursor()
    results = []

    for v in vehicles_input:
        vehicle = _fetch_vehicle(cur, v["brand"], v["model"], v["year"])
        if not vehicle:
            results.append({
                "brand": v["brand"], "model": v["model"], "year": v["year"],
                "error": "Vehicle not found in database",
            })
            continue
        lc = calculate_lifecycle(vehicle, country, year, distance_km=distance_km)
        results.append({
            "brand": vehicle["brand"],
            "model": vehicle["model"],
            "year":  vehicle["year"],
            **lc,
        })

    cur.close()
    conn.close()
    return jsonify(results)


# ─────────────────────────────────────────────────────────────────
# RECOMMENDATION ENGINE
# ─────────────────────────────────────────────────────────────────

@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.json or {}
    return jsonify(recommend_vehicle(
        daily_km     = data.get("daily_km"),
        years        = data.get("years"),
        body_type    = data.get("filters", {}).get("bodyType"),
        vehicle_type = data.get("filters", {}).get("vehicle_type"),
        country      = data.get("country", "US"),
        grid_year    = data.get("grid_year", 2023),
    ))


# ─────────────────────────────────────────────────────────────────
# BREAK-EVEN ANALYSIS
# ─────────────────────────────────────────────────────────────────

@app.route("/break-even", methods=["POST"])
def break_even():
    data      = request.json or {}
    v_a       = data.get("vehicle_a")
    v_b       = data.get("vehicle_b")
    country   = data.get("country", "US")
    grid_year = data.get("grid_year", 2023)

    if not v_a or not v_b:
        return jsonify({"error": "vehicle_a and vehicle_b are required"}), 400

    conn      = get_db_connection()
    cur       = conn.cursor()
    vehicle_a = _fetch_vehicle(cur, v_a["brand"], v_a["model"], v_a["year"])
    vehicle_b = _fetch_vehicle(cur, v_b["brand"], v_b["model"], v_b["year"])
    cur.close()
    conn.close()

    if not vehicle_a or not vehicle_b:
        return jsonify({"error": "One or both vehicles not found"}), 404

    return jsonify(break_even_km(vehicle_a, vehicle_b, country, grid_year))


# ─────────────────────────────────────────────────────────────────
# GREENWASHING DETECTION
# ─────────────────────────────────────────────────────────────────

@app.route("/greenwashing", methods=["POST"])
def greenwashing():
    data         = request.json or {}
    lifecycle    = data.get("lifecycle")
    vehicle_meta = data.get("vehicle") or data.get("vehicle_meta") or {}
    search_web   = bool(data.get("search_web", False))

    if not lifecycle:
        return jsonify({"error": "lifecycle is required"}), 400
    if not vehicle_meta:
        return jsonify({"error": "vehicle is required"}), 400

    lc = {
        "total_g_per_km":         _get(lifecycle, "total_g_per_km"),
        "operational_g_per_km":   _get(lifecycle, "operational_g_per_km"),
        "manufacturing_g_per_km": _get(lifecycle, "manufacturing_g_per_km"),
        "manufacturing_total_kg": _get(lifecycle, "manufacturing_total_kg"),
        "recycling_kg":           _get(lifecycle, "recycling_kg", default=0.0),
    }

    TYPE_MAP = {
        "BEV": "EV",  "ELECTRIC": "EV",      "BATTERY": "EV",
        "HYBRID": "HEV", "MILD_HYBRID": "HEV", "MHEV": "HEV",
        "PLUGIN": "PHEV", "PLUGIN_HYBRID": "PHEV", "PLUG_IN": "PHEV",
        "GASOLINE": "ICE", "PETROL": "ICE",   "DIESEL": "ICE",
        "GAS": "ICE",  "CONVENTIONAL": "ICE",
    }
    raw_type = (
        vehicle_meta.get("vehicle_type") or
        vehicle_meta.get("type") or
        vehicle_meta.get("fuel_type") or "ICE"
    ).upper().strip()
    vtype = TYPE_MAP.get(raw_type, raw_type)
    if vtype not in ("EV", "HEV", "PHEV", "ICE"):
        vtype = "ICE"

    vm = {
        "brand":        str(vehicle_meta.get("brand") or "Unknown"),
        "model":        str(vehicle_meta.get("model") or "Unknown"),
        "year":         vehicle_meta.get("year"),
        "vehicle_type": vtype,
        "electric":     vtype in ("EV", "PHEV"),
    }

    proposed_claims  = data.get("claims", [])
    web_claims_raw   = []
    web_search_error = None

    if search_web:
        try:
            from greenwashing import search_marketing_claims
            web_claims_raw = search_marketing_claims(
                brand                = vm["brand"],
                model                = vm["model"],
                year                 = vm.get("year"),
                actual_total         = lc["total_g_per_km"],
                actual_operational   = lc["operational_g_per_km"],
                actual_manufacturing = lc["manufacturing_g_per_km"],
                vehicle_type         = vm["vehicle_type"],
            )
        except Exception as e:
            print(f"[greenwashing] web_search error: {e}")
            web_search_error = str(e)

    try:
        report = evaluate_claims(
            lifecycle       = lc,
            vehicle_meta    = vm,
            proposed_claims = proposed_claims or None,
        )
    except Exception as e:
        print(f"[greenwashing] evaluate_claims error: {e}")
        return jsonify({"error": str(e)}), 422

    web_findings = []
    if web_claims_raw:
        try:
            web_report = evaluate_claims(
                lifecycle       = lc,
                vehicle_meta    = vm,
                proposed_claims = [c["claim_text"] for c in web_claims_raw],
            )
            for finding, meta in zip(web_report.findings, web_claims_raw):
                web_findings.append({
                    "claim":           finding.claim,
                    "risk_level":      finding.risk_level.value,
                    "reason":          finding.reason,
                    "suggestion":      finding.suggestion,
                    "is_aspirational": finding.is_aspirational,
                    "is_unverified":   finding.is_unverified,
                    "source":          meta["source"],
                    "source_url":      meta["source_url"],
                    "claim_type":      meta["claim_type"],
                    "context":         meta["context"],
                })
        except Exception as e:
            web_search_error = (web_search_error or "") + f" | Rule engine: {e}"

    all_risks  = [report.overall_risk.value] + [w["risk_level"] for w in web_findings]
    worst_risk = _worst_risk(all_risks)
    web_penalty = sum(
        25 if w["risk_level"] == "VIOLATION"
        else 15 if w["risk_level"] == "WARNING"
        else 5
        for w in web_findings
        if w["risk_level"] not in ("SAFE",)
        and not w.get("is_aspirational")
        and not w.get("is_unverified")
    )
    combined_score = max(10, report.transparency_score - web_penalty)

    return jsonify({
        "brand":                  vm["brand"],
        "model":                  vm["model"],
        "vehicle_type":           vm["vehicle_type"],
        "total_g_per_km":         lc["total_g_per_km"],
        "operational_g_per_km":   lc["operational_g_per_km"],
        "manufacturing_g_per_km": lc["manufacturing_g_per_km"],
        "manufacturing_total_kg": lc["manufacturing_total_kg"],
        "recycling_kg":           lc["recycling_kg"],
        "overall_risk":           worst_risk,
        "transparency_score":     combined_score,
        "structural_flags":       report.structural_flags,
        "misleading_claims":      report.misleading_claims,
        "findings": [
            {
                "claim":           f.claim,
                "risk_level":      f.risk_level.value,
                "reason":          f.reason,
                "suggestion":      f.suggestion,
                "is_aspirational": f.is_aspirational,
                "is_unverified":   f.is_unverified,
            }
            for f in report.findings
        ],
        "web_findings":     web_findings,
        "web_search_error": web_search_error,
        "web_search_ran":   search_web,
    })


# ─────────────────────────────────────────────────────────────────
# CARBON SCORE
# ─────────────────────────────────────────────────────────────────

@app.route("/carbon-score", methods=["POST"])
def carbon_score_route():
    data      = request.json or {}
    emissions = data.get("total_g_per_km")
    if emissions is None:
        return jsonify({"error": "Missing emissions value"}), 400
    return jsonify(carbon_score(emissions))


# ─────────────────────────────────────────────────────────────────
# ANNUAL IMPACT
# ─────────────────────────────────────────────────────────────────

@app.route("/annual-impact", methods=["POST"])
def annual_impact_route():
    data      = request.json or {}
    emissions = data.get("total_g_per_km")
    annual_km = data.get("annual_km")
    if not emissions or not annual_km:
        return jsonify({"error": "Missing parameters"}), 400
    return jsonify(annual_emissions(emissions, annual_km))


# ─────────────────────────────────────────────────────────────────
# GRID DATA
# ─────────────────────────────────────────────────────────────────

@app.route("/grid")
def get_grid_data():
    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute(
        "SELECT country_code, year, raw_intensity, carbon_intensity_gco2_per_kwh "
        "FROM grid_intensity ORDER BY country_code, year"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    grid = {}
    for country, year, raw, corrected in rows:
        grid.setdefault(country, {})[str(year)] = {"raw": raw, "corrected": corrected}
    return jsonify(grid)


@app.route("/grid-data")
def grid_data():
    grid_file = os.path.join(
        os.path.dirname(__file__), "..", "data", "grid_master_v2_2026_clean.json"
    )
    try:
        with open(grid_file) as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        return jsonify({"error": "Grid data file not found"}), 404
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid grid data format"}), 500


# ─────────────────────────────────────────────────────────────────
# COUNTRIES
# ─────────────────────────────────────────────────────────────────

@app.route("/countries")
def countries():
    conn = get_db_connection()
    cur  = conn.cursor()
    cur.execute("SELECT DISTINCT country_code FROM grid_intensity ORDER BY country_code")
    result = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(result)


# ─────────────────────────────────────────────────────────────────
# AI SUMMARY  (Gemini)
# ─────────────────────────────────────────────────────────────────

@app.route("/ai-summary", methods=["POST"])
def ai_summary():
    data        = request.json or {}
    vehicles    = data.get("vehicles", [])
    distance_km = data.get("distance_km", 100)
    if not vehicles:
        return jsonify({"error": "No vehicles provided"}), 400
    try:
        return jsonify(generate_summary(vehicles, distance_km))
    except Exception as e:
        print(f"[ai_summary] ERROR: {e}")
        return jsonify({"error": str(e)}), 500


# ==================================================
# OCR CLAIM — Screenshot → Gemini Vision → Verdict
# ==================================================

@app.route("/ocr-claim", methods=["POST"])
def ocr_claim():
    import requests as req_lib

    data      = request.json or {}
    image_b64 = data.get("image_b64", "")
    mime_type = data.get("mime_type", "image/png")

    if not image_b64:
        return jsonify({"error": "No image provided"}), 400

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        return jsonify({"error": "GEMINI_API_KEY not configured"}), 500

    payload = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": mime_type, "data": image_b64}},
                {"text": _OCR_PROMPT},
            ]
        }],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1000},
    }

    try:
        resp = req_lib.post(
            f"{_GEMINI_VISION_URL}?key={gemini_key}",
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        raw = resp.json()

        text = "".join(
            p.get("text", "")
            for p in raw.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [])
        ).strip()

        print(f"[ocr-claim] Gemini raw: {text}")

        text = text.replace("```json", "").replace("```", "").strip()

        try:
            return jsonify(json.loads(text))
        except json.JSONDecodeError:
            pass

        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            fragment = match.group(0)
            if fragment.count("{") > fragment.count("}"):
                fragment += "}"
            if fragment.count('"') % 2 == 1:
                fragment += '"'
            try:
                return jsonify(json.loads(fragment))
            except json.JSONDecodeError:
                pass

        print("[ocr-claim] JSON recovery failed")
        return jsonify({
            "found":       False,
            "claim_text":  "",
            "risk_level":  None,
            "verdict":     "Unable to analyse screenshot",
            "explanation": "The AI response was malformed or truncated.",
            "suggestion":  None,
        })

    except Exception as e:
        print(f"[ocr-claim] ERROR: {e}")
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True)