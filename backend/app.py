import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from database import get_db_connection
from engine import calculate_lifecycle
from recommendation import recommend_vehicle
from break_even import break_even_km
from greenwashing import detect_greenwashing
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
def vehicles_list():

    limit = request.args.get("limit", 50, type=int)
    brand = request.args.get("brand")
    powertrain = request.args.get("powertrain")

    conn = get_db_connection()
    cur = conn.cursor()

    query = "SELECT * FROM vehicle_clean WHERE 1=1"
    params = []

    if brand:
        query += " AND brand = %s"
        params.append(brand)

    if powertrain:
        query += " AND powertrain = %s"
        params.append(powertrain)

    query += " LIMIT %s"
    params.append(limit)

    cur.execute(query, params)

    columns = [desc[0] for desc in cur.description]
    vehicles = [dict(zip(columns, row)) for row in cur.fetchall()]

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
        FROM vehicle_clean
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
        FROM vehicle_clean
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
            SELECT *
            FROM vehicle_clean
            WHERE brand=%s AND model=%s AND year=%s
            LIMIT 1
        """, (v["brand"], v["model"], v["year"]))

        row = cur.fetchone()

        if row:

            columns = [desc[0] for desc in cur.description]
            vehicle = dict(zip(columns, row))

            lifecycle = calculate_lifecycle(vehicle, country, year)

            if "error" not in lifecycle:
                results.append(lifecycle)

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
        powertrain=data.get("filters", {}).get("powertrain"),
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
        FROM vehicle_clean
        WHERE brand=%s AND model=%s AND year=%s
        LIMIT 1
    """, (ev["brand"], ev["model"], ev["year"]))

    ev_vehicle = cur.fetchone()

    cur.execute("""
        SELECT *
        FROM vehicle_clean
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

    if not lifecycle:
        return jsonify({"error": "Missing lifecycle data"}), 400

    result = detect_greenwashing(lifecycle, vehicle_meta)

    return jsonify(result)


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

@app.route("/grid-sensitivity", methods=["POST"])
def grid_sensitivity_route():

    data = request.json

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT *
        FROM vehicle_clean
        WHERE brand=%s AND model=%s AND year=%s
        LIMIT 1
    """, (data["brand"], data["model"], data["vehicle_year"]))

    row = cur.fetchone()

    if not row:
        return jsonify({"error": "Vehicle not found"}), 404

    columns = [desc[0] for desc in cur.description]
    vehicle = dict(zip(columns, row))

    cur.close()
    conn.close()

    result = grid_sensitivity(
        vehicle,
        data.get("countries"),
        data.get("year")
    )

    return jsonify(result)


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