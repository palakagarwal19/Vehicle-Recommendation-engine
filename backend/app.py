import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from auth_routes   import auth_bp
from wallet_routes import wallet_bp
from database import get_db_connection
from engine import calculate_lifecycle
from recommendation import recommend_vehicle
from break_even import break_even_km
from greenwashing import evaluate_claims
from carbon_index import carbon_score
from annual_impact import annual_emissions
from grid_sensitivity import grid_sensitivity
from greenwashing import evaluate_claims
from web_search import search_marketing_claims

import math

app = Flask(__name__)
CORS(app)


app.register_blueprint(auth_bp)
app.register_blueprint(wallet_bp)
# ==================================================
# HEALTH CHECK
# ==================================================

@app.route("/")
def home():
    return jsonify({
        "platform": "CarbonWise API",
        "status": "running"
    })


# ==================================================
# VEHICLE LIST  — updated route (replace in app.py)
# Adds optional ?vehicle_type= filter for parallel
# per-type initial loads on the frontend.
# ==================================================

@app.route("/vehicles")
def get_vehicles():
    import math

    page         = int(request.args.get("page", 1))
    limit        = int(request.args.get("limit", 200))
    vehicle_type = request.args.get("vehicle_type", "").strip().upper() or None
    offset       = (page - 1) * limit

    conn = get_db_connection()
    cur  = conn.cursor()

    if vehicle_type:
        # BEV and EV are stored as either — treat them as equivalent
        if vehicle_type == "EV":
            cur.execute(
                "SELECT COUNT(*) FROM vehicles WHERE vehicle_type IN ('EV','BEV')"
            )
            total = cur.fetchone()[0]
            cur.execute("""
                SELECT brand, model, year, vehicle_type
                FROM vehicles
                WHERE vehicle_type IN ('EV','BEV')
                ORDER BY brand, model
                LIMIT %s OFFSET %s
            """, (limit, offset))
        else:
            cur.execute(
                "SELECT COUNT(*) FROM vehicles WHERE vehicle_type = %s",
                (vehicle_type,)
            )
            total = cur.fetchone()[0]
            cur.execute("""
                SELECT brand, model, year, vehicle_type
                FROM vehicles
                WHERE vehicle_type = %s
                ORDER BY brand, model
                LIMIT %s OFFSET %s
            """, (vehicle_type, limit, offset))
    else:
        cur.execute("SELECT COUNT(*) FROM vehicles")
        total = cur.fetchone()[0]
        cur.execute("""
            SELECT brand, model, year, vehicle_type
            FROM vehicles
            ORDER BY brand, model
            LIMIT %s OFFSET %s
        """, (limit, offset))

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
        "pages": math.ceil(total / limit)
    })

# ==================================================
# VEHICLE DETAIL
# ==================================================

@app.route("/vehicle-detail")
def vehicle_detail():

    brand = request.args.get("brand")
    model = request.args.get("model")
    year = request.args.get("year")

    if not all([brand, model, year]):
        return jsonify({"error": "brand, model, year required"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT *
        FROM vehicles
        WHERE brand=%s AND model=%s AND year=%s
        LIMIT 1
    """, (brand, model, year))

    row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        return jsonify({"error": "Vehicle not found"}), 404

    columns = [desc[0] for desc in cur.description]

    return jsonify(dict(zip(columns, row)))


# ==================================================
# WINNER DETAIL  (image + specs from afdc_vehicles)
# Called in parallel with /ai-summary from the frontend
# ==================================================

@app.route("/winner-detail", methods=["POST"])
def winner_detail():
    """
    Given brand/model/year, returns:
      - image_url  : best available image from afdc_vehicles (or null)
      - specs      : { range_km, fuel_economy, manufacturer_url } (nulls if missing)

    Tries exact year first, then closest year fallback — same logic as ai_summary.py.
    """
    data  = request.json
    brand = data.get("brand", "")
    model = data.get("model", "")
    year  = data.get("year")

    if not brand or not model:
        return jsonify({"image_url": None, "specs": None}), 200

    conn = get_db_connection()
    cur  = conn.cursor()

    # Exact year first
    cur.execute("""
        SELECT image_url, manufacturer_url
        FROM afdc_vehicles
        WHERE LOWER(brand) = LOWER(%s)
          AND LOWER(model)  LIKE LOWER(%s)
          AND year = %s
          AND image_url IS NOT NULL
          AND image_url != 'NaN'
        LIMIT 1
    """, (brand, f"%{model}%", year))

    row = cur.fetchone()

    # Closest year fallback
    if not row:
        cur.execute("""
            SELECT image_url, manufacturer_url
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

    manufacturer_url = None
    if row:
        raw_image_url, manufacturer_url = row
        # Sanitise manufacturer_url
        if manufacturer_url and manufacturer_url.strip() in ("", "NaN"):
            manufacturer_url = None

    # Use full resolution chain: DB → Wikimedia (Gemini query) → Wikimedia (generic)
    # /winner-detail is called before Gemini responds, so no image_query yet — that's fine,
    # get_vehicle_image will fall through to the generic "<brand> <model> <year> car" query.
    image_url = get_vehicle_image(brand, model, year)

    specs = {"manufacturer_url": manufacturer_url}

    return jsonify({
        "image_url": image_url,
        "specs": specs
    })


# ==================================================
# LIFECYCLE ANALYSIS
# ==================================================

@app.route("/lifecycle", methods=["POST"])
def lifecycle():

    data = request.json

    brand = data.get("brand")
    model = data.get("model")
    year = data.get("vehicle_year")
    country = data.get("country")
    grid_year = data.get("grid_year")

    if not all([brand, model, year, country]):
        return jsonify({"error": "Missing parameters"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT *
        FROM vehicles
        WHERE brand=%s AND model=%s AND year=%s
        LIMIT 1
    """, (brand, model, year))

    row = cur.fetchone()

    if not row:
        return jsonify({"error": "Vehicle not found"}), 404

    columns = [desc[0] for desc in cur.description]
    vehicle = dict(zip(columns, row))

    cur.close()
    conn.close()

    result = calculate_lifecycle(vehicle, country, grid_year)

    return jsonify(result)


# ==================================================
# MULTI VEHICLE COMPARISON
# ==================================================

@app.route("/compare-multiple", methods=["POST"])
def compare_multiple():

    data = request.json

    country = data.get("country")
    year = data.get("year")
    distance_km = data.get("distance_km")
    vehicles_input = data.get("vehicles")

    if not vehicles_input:
        return jsonify({"error": "vehicles required"}), 400

    results = []

    conn = get_db_connection()
    cur = conn.cursor()

    for v in vehicles_input:

        cur.execute("""
            SELECT *
            FROM vehicles
            WHERE brand=%s AND model=%s AND year=%s
            LIMIT 1
        """, (v["brand"], v["model"], v["year"]))

        row = cur.fetchone()

        if not row:
            results.append({
                "brand": v["brand"],
                "model": v["model"],
                "year": v["year"],
                "error": "Vehicle not found in database"
            })
            continue

        columns = [desc[0] for desc in cur.description]
        vehicle = dict(zip(columns, row))

        lifecycle = calculate_lifecycle(vehicle, country, year, distance_km=distance_km)

        results.append({
            "brand": vehicle["brand"],
            "model": vehicle["model"],
            "year": vehicle["year"],
            **lifecycle
        })

    cur.close()
    conn.close()

    return jsonify(results)


# ==================================================
@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.json  # ← must be BEFORE any data.get() calls

    print(f"DEBUG recommend: daily_km={data.get('daily_km')}, years={data.get('years')}, filters={data.get('filters')}, country={data.get('country')}")

    results = recommend_vehicle(
        daily_km=data.get("daily_km"),
        years=data.get("years", 10),
        body_type=data.get("filters", {}).get("bodyType"),
        vehicle_type=data.get("filters", {}).get("vehicle_type"),
        country=data.get("country", "US"),
        grid_year=data.get("grid_year", 2023)
    )

    return jsonify(results)
# ==================================================
# BREAK EVEN ANALYSIS
# ==================================================
# ==================================================
# BREAK EVEN ANALYSIS  — fixed route (replace in app.py)
# ==================================================
# ==================================================
# BREAK EVEN ANALYSIS  — updated route (replace in app.py)
# Now accepts vehicle_a / vehicle_b (any powertrain)
# ==================================================

@app.route("/break-even", methods=["POST"])
def break_even():

    data = request.json

    va      = data.get("vehicle_a")
    vb      = data.get("vehicle_b")
    country = data.get("country")
    year    = data.get("grid_year") or data.get("year")

    if not va or not vb:
        return jsonify({"error": "vehicle_a and vehicle_b are required"}), 400

    conn = get_db_connection()
    cur  = conn.cursor()

    cur.execute("""
        SELECT * FROM vehicles
        WHERE brand=%s AND model=%s AND year=%s
        LIMIT 1
    """, (va["brand"], va["model"], va["year"]))
    row_a = cur.fetchone()

    cur.execute("""
        SELECT * FROM vehicles
        WHERE brand=%s AND model=%s AND year=%s
        LIMIT 1
    """, (vb["brand"], vb["model"], vb["year"]))
    row_b = cur.fetchone()

    if not row_a or not row_b:
        cur.close()
        conn.close()
        missing = []
        if not row_a: missing.append(f"{va['brand']} {va['model']} {va['year']}")
        if not row_b: missing.append(f"{vb['brand']} {vb['model']} {vb['year']}")
        return jsonify({"error": f"Vehicle(s) not found: {', '.join(missing)}"}), 404

    columns    = [desc[0] for desc in cur.description]
    vehicle_a  = dict(zip(columns, row_a))
    vehicle_b  = dict(zip(columns, row_b))

    cur.close()
    conn.close()

    result = break_even_km(vehicle_a, vehicle_b, country, year)
    return jsonify(result)

# ==================================================
# GREENWASHING DETECTION
# ==================================================
# ── Replace the /greenwashing route in app.py with this version ───────────────
#
# Imports needed at top of app.py (add if not already there):
#
#   from greenwashing import evaluate_claims, GreenwashingReport, RiskLevel
#   from web_search import search_marketing_claims
#
# The route:
#   1. Accepts lifecycle + vehicle_meta + optional proposed_claims from the frontend
#   2. If search_web=True, calls web_search to find REAL manufacturer claims
#      via Gemini grounded search, then runs them through evaluate_claims too
#   3. Returns a single unified JSON response with both claim sets

#==================================================
# GREENWASHING DETECTION
# ==================================================
RISK_ORDER = ["SAFE", "CAUTION", "WARNING", "VIOLATION"]

def _worst_risk(risks):
    ranked = [r for r in risks if r in RISK_ORDER]
    return max(ranked, key=lambda r: RISK_ORDER.index(r)) if ranked else "SAFE"

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

    # ── Normalise lifecycle keys ──────────────────────────────────────────────
    def _get(d, *keys, default=0.0):
        for k in keys:
            if k in d and d[k] is not None:
                try:
                    return float(d[k])
                except (TypeError, ValueError):
                    pass
        return float(default)

    lc = {
        # Per-km rates (used by rule engine for structural checks)
        "total_g_per_km":          _get(lifecycle, "total_g_per_km"),
        "operational_g_per_km":    _get(lifecycle, "operational_g_per_km"),
        "manufacturing_g_per_km":  _get(lifecycle, "manufacturing_g_per_km"),
        # Fixed one-time costs (source of truth — from engine.py)
        "manufacturing_total_kg":  _get(lifecycle, "manufacturing_total_kg"),
        "recycling_kg":            _get(lifecycle, "recycling_kg", default=0.0),
    }

    # ── Normalise vehicle_meta ────────────────────────────────────────────────
    raw_type = (
        vehicle_meta.get("vehicle_type") or
        vehicle_meta.get("type") or
        vehicle_meta.get("fuel_type") or "ICE"
    ).upper().strip()

    TYPE_MAP = {
        "BEV": "EV", "ELECTRIC": "EV", "BATTERY": "EV",
        "HYBRID": "HEV", "MILD_HYBRID": "HEV", "MHEV": "HEV",
        "PLUGIN": "PHEV", "PLUGIN_HYBRID": "PHEV", "PLUG_IN": "PHEV",
        "GASOLINE": "ICE", "PETROL": "ICE", "DIESEL": "ICE",
        "GAS": "ICE", "CONVENTIONAL": "ICE",
    }
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

    proposed_claims = data.get("claims", [])

    # ── Web search ────────────────────────────────────────────────────────────
    web_claims_raw   = []
    web_search_error = None
    if search_web:
        try:
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

    # ── Run rule engine ───────────────────────────────────────────────────────
    try:
        report = evaluate_claims(
            lifecycle       = lc,
            vehicle_meta    = vm,
            proposed_claims = proposed_claims or None,
        )
    except Exception as e:
        print(f"[greenwashing] evaluate_claims error: {e}")
        return jsonify({"error": str(e)}), 422

    # ── Evaluate web-found claims ─────────────────────────────────────────────
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

    # ── Combined risk + score ─────────────────────────────────────────────────
    all_risks    = [report.overall_risk.value] + [w["risk_level"] for w in web_findings]
    worst_risk   = _worst_risk(all_risks)

    web_penalty  = sum(
        25 if w["risk_level"] == "VIOLATION"
        else 15 if w["risk_level"] == "WARNING"
        else 5
        for w in web_findings
        if w["risk_level"] not in ("SAFE",) and not w.get("is_aspirational") and not w.get("is_unverified")
    )
    combined_score = max(10, report.transparency_score - web_penalty)

    return jsonify({
        "brand":                  vm["brand"],
        "model":                  vm["model"],
        "vehicle_type":           vm["vehicle_type"],

        # Lifecycle values — pass through fixed costs so frontend can display them
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
# ==================================================
# CARBON SCORE
# ==================================================

@app.route("/carbon-score", methods=["POST"])
def carbon_score_route():

    data = request.json
    emissions = data.get("total_g_per_km")

    if emissions is None:
        return jsonify({"error": "Missing emissions value"}), 400

    return jsonify(carbon_score(emissions))


# ==================================================
# ANNUAL IMPACT
# ==================================================

@app.route("/annual-impact", methods=["POST"])
def annual_impact_route():

    data = request.json

    emissions = data.get("total_g_per_km")
    annual_km = data.get("annual_km")

    if not emissions or not annual_km:
        return jsonify({"error": "Missing parameters"}), 400

    result = annual_emissions(emissions, annual_km)

    return jsonify(result)


# ==================================================
# GRID SENSITIVITY
# ==================================================
# ── Replace the /grid route in app.py with this version ──────────────────────
# Adds td_loss to the response so the frontend can show the exact DB value
# instead of back-calculating it from raw vs corrected.

@app.route("/grid")
def get_grid_data():
    conn = get_db_connection()
    cur  = conn.cursor()

    cur.execute("""
        SELECT country_code, year, raw_intensity, td_loss, carbon_intensity_gco2_per_kwh
        FROM grid_intensity
        ORDER BY country_code, year
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    grid = {}
    for country, year, raw, td_loss, corrected in rows:
        if country not in grid:
            grid[country] = {}
        grid[country][str(year)] = {
            "raw":       raw,
            "td_loss":   td_loss,   # e.g. 0.08  (fraction)
            "corrected": corrected
        }

    return jsonify(grid)
# ==================================================
# COUNTRIES (FROM GRID DATA)
# ==================================================

@app.route("/countries")
def countries():

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT country_code
        FROM grid_intensity
        ORDER BY country_code
    """)

    countries = [row[0] for row in cur.fetchall()]

    cur.close()
    conn.close()

    return jsonify(countries)


@app.route("/vehicle-search")
def vehicle_search():

    q = request.args.get("q", "")

    if len(q) < 2:
        return jsonify([])

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT brand, model, year, vehicle_type
        FROM vehicles
        WHERE
            LOWER(brand) LIKE %s
            OR LOWER(model) LIKE %s
        ORDER BY brand, model
        LIMIT 30
    """, (f"%{q.lower()}%", f"%{q.lower()}%"))

    rows = cur.fetchall()

    vehicles = [
        {
            "brand": r[0],
            "model": r[1],
            "year": r[2],
            "vehicle_type": r[3]
        }
        for r in rows
    ]

    cur.close()
    conn.close()

    return jsonify(vehicles)


# ==================================================
# GRID DATA
# ==================================================

@app.route("/grid-data")
def grid_data():
    import json
    
    grid_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'grid_master_v2_2026_clean.json')
    
    try:
        with open(grid_file, 'r') as f:
            grid_data = json.load(f)
        return jsonify(grid_data)
    except FileNotFoundError:
        return jsonify({"error": "Grid data file not found"}), 404
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid grid data format"}), 500


# ==================================================
# AI SUMMARY  (Gemini)
# ==================================================

from ai_summary import generate_summary, get_vehicle_image

@app.route("/ai-summary", methods=["POST"])
def ai_summary():
    data = request.json
    vehicles = data.get("vehicles", [])
    distance_km = data.get("distance_km", 100)
    if not vehicles:
        return jsonify({"error": "No vehicles provided"}), 400
    try:
        result = generate_summary(vehicles, distance_km)
        return jsonify(result)
    except Exception as e:
        print(f"[ai_summary] ERROR: {e}")
        return jsonify({"error": str(e)}), 500

# ── Add this to app.py ────────────────────────────────────────────────────────
# Place after the existing /grid route.
# Import at top of app.py:  from forecast import forecast_country, forecast_all

from forecast import forecast_country, forecast_all

@app.route("/forecast", methods=["POST"])
def grid_forecast():
    """
    GPR-based grid carbon intensity forecast.

    Request body (JSON):
      {
        "country":  "USA",          // single country — returns one forecast
        "horizon":  10              // optional, default 10 years
      }
      OR
      {
        "all":      true,           // forecast every country in DB
        "horizon":  10
      }

    Response (single country):
      {
        "country":      "USA",
        "years":        [2024, 2025, ..., 2033],
        "mean":         [380.1, 365.4, ...],
        "lower":        [340.2, 320.1, ...],   // 95% CI lower
        "upper":        [420.0, 410.7, ...],   // 95% CI upper
        "last_year":    2023,
        "last_actual":  395.2,
        "trend":        "improving",
        "model_score":  0.964,
        "horizon":      10
      }
    """
    data    = request.json or {}
    horizon = int(data.get("horizon", 10))

    conn = get_db_connection()
    cur  = conn.cursor()

    if data.get("all"):
        # Fetch all grid data then forecast all countries
        cur.execute("""
            SELECT country_code, year, raw_intensity, carbon_intensity_gco2_per_kwh
            FROM grid_intensity ORDER BY country_code, year
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()

        grid = {}
        for cc, yr, raw, corr in rows:
            grid.setdefault(cc, {})[str(yr)] = {"raw": raw, "corrected": corr}

        results = forecast_all(grid, horizon)
        return jsonify(results)

    # Single country
    country = data.get("country", "").upper()
    if not country:
        return jsonify({"error": "country or all=true required"}), 400

    cur.execute("""
        SELECT year, raw_intensity, carbon_intensity_gco2_per_kwh
        FROM grid_intensity
        WHERE country_code = %s
        ORDER BY year
    """, (country,))
    rows = cur.fetchall()
    cur.close(); conn.close()

    if not rows:
        return jsonify({"error": f"No grid data for country: {country}"}), 404

    years  = [r[0] for r in rows]
    values = [r[2] if r[2] is not None else r[1] for r in rows]

    result = forecast_country(years, values, horizon)
    if "error" in result:
        return jsonify(result), 422

    return jsonify({"country": country, **result})
# ==================================================
# RUN SERVER
# ==================================================

if __name__ == "__main__":
    app.run(debug=True)