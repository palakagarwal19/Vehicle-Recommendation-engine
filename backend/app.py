import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from database import get_db_connection
from engine import calculate_lifecycle
from recommendation import recommend_vehicle
from break_even import break_even_km
from greenwashing import evaluate_claims
from carbon_index import carbon_score
from annual_impact import annual_emissions
from grid_sensitivity import grid_sensitivity
import math

app = Flask(__name__)
CORS(app)


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
# VEHICLE LIST
# ==================================================
@app.route("/vehicles")
def get_vehicles():
    import math

    page  = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 200))
    offset = (page - 1) * limit

    conn = get_db_connection()
    cur  = conn.cursor()

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
        "page": page,
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

@app.route("/break-even", methods=["POST"])
def break_even():

    data = request.json

    ev = data.get("ev")
    ice = data.get("ice")
    country = data.get("country")
    year = data.get("year")

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT *
        FROM vehicles
        WHERE brand=%s AND model=%s AND year=%s
        LIMIT 1
    """, (ev["brand"], ev["model"], ev["year"]))

    ev_vehicle = cur.fetchone()

    cur.execute("""
        SELECT *
        FROM vehicles
        WHERE brand=%s AND model=%s AND year=%s
        LIMIT 1
    """, (ice["brand"], ice["model"], ice["year"]))

    ice_vehicle = cur.fetchone()

    if not ev_vehicle or not ice_vehicle:
        return jsonify({"error": "Vehicle not found"}), 404

    columns = [desc[0] for desc in cur.description]

    ev_vehicle = dict(zip(columns, ev_vehicle))
    ice_vehicle = dict(zip(columns, ice_vehicle))

    cur.close()
    conn.close()

    result = break_even_km(ev_vehicle, ice_vehicle, country, year)

    return jsonify(result)


# ==================================================
# GREENWASHING DETECTION
# ==================================================
@app.route("/greenwashing", methods=["POST"])
def greenwashing():

    data = request.json

    lifecycle = data.get("lifecycle")
    vehicle_meta = data.get("vehicle")
    claims = data.get("claims", [])

    if not lifecycle:
        return jsonify({"error": "Missing lifecycle data"}), 400

    result = evaluate_claims(lifecycle, vehicle_meta, claims)

    return jsonify({
        "brand": result.brand,
        "model": result.model,
        "vehicle_type": result.vehicle_type,
        "total_g_per_km": result.total_g_per_km,
        "operational_g_per_km": result.operational_g_per_km,
        "manufacturing_g_per_km": result.manufacturing_g_per_km,
        "overall_risk": result.overall_risk.value,
        "structural_flags": result.structural_flags,
        "findings": [
            {
                "claim": f.claim,
                "risk_level": f.risk_level.value,
                "reason": f.reason,
                "suggestion": f.suggestion
            }
            for f in result.findings
        ]
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
@app.route("/grid")
def get_grid_data():

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT country_code, year, raw_intensity, carbon_intensity_gco2_per_kwh
        FROM grid_intensity
        ORDER BY country_code, year
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    grid = {}

    for country, year, raw, corrected in rows:

        if country not in grid:
            grid[country] = {}

        grid[country][str(year)] = {
            "raw": raw,
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


# ==================================================
# RUN SERVER
# ==================================================

if __name__ == "__main__":
    app.run(debug=True)