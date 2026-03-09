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

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT brand, model, year, vehicle_type
        FROM vehicles
        ORDER BY brand, model
    """)

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
    vehicles_input = data.get("vehicles")

    if not vehicles_input:
        return jsonify({"error": "vehicles required"}), 400

    results = []
    conn = get_db_connection()
    cur = conn.cursor()

    for v in vehicles_input:
        cur.execute("""
            SELECT * FROM vehicles
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

        print(f"[compare] {v['brand']} {v['model']} fields: fuel_type={vehicle.get('fuel_type')}, co2_wltp_gpkm={vehicle.get('co2_wltp_gpkm')}, fuel_l_per_100km={vehicle.get('fuel_l_per_100km')}")

        lifecycle = calculate_lifecycle(vehicle, country, year)

        # Always append — include error field if calculation failed
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
# RECOMMENDATION ENGINE
# ==================================================

@app.route("/recommend", methods=["POST"])
def recommend():

    data = request.json

    results = recommend_vehicle(
        daily_km=data.get("daily_km"),
        years=data.get("years"),
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
    """
    Get grid intensity data for all countries
    Returns the grid_master_v2_2026_clean.json file
    """
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
# RUN SERVER
# ==================================================

if __name__ == "__main__":
    app.run(debug=True)