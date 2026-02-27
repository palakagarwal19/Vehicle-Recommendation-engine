import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from engine import get_vehicle, calculate_lifecycle
from reccomendation import recommend_vehicle
from break_even import break_even_km
from greenwashing import detect_greenwashing
from carbon_index import carbon_score
from annual_impact import annual_emissions
from grid_sensitivity import grid_sensitivity

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


# ==================================================
# HEALTH CHECK
# ==================================================
@app.route("/")
def home():
    return jsonify({"status": "CarbonWise API Running"})


# ==================================================
# VEHICLE DETAIL
# ==================================================
# ==================================================
# GET ALL VEHICLES (FOR FRONTEND LIST)
# ==================================================
@app.route("/vehicles")
def vehicles_list():

    vehicles = get_vehicle({})  # empty filter = all vehicles

    return jsonify(vehicles)
@app.route("/vehicle-detail")
def vehicle_detail():

    brand = request.args.get("brand")
    model = request.args.get("model")
    year = request.args.get("year")

    if not all([brand, model, year]):
        return jsonify({"error": "Missing parameters"})

    vehicles = get_vehicle({
        "brand": brand,
        "model": model,
        "Year": year
    })

    if not vehicles:
        return jsonify({"error": "Vehicle not found"})

    return jsonify(vehicles[0])


# ==================================================
# LIFECYCLE CALCULATION
# ==================================================
@app.route("/lifecycle", methods=["POST"])
def lifecycle():

    data = request.json
    brand = data.get("brand")
    model = data.get("model")
    year_vehicle = data.get("vehicle_year")
    country = data.get("country")
    grid_year = data.get("grid_year")

    print(f"Lifecycle request: brand={brand}, model={model}, year={year_vehicle}, country={country}, grid_year={grid_year}")

    if not all([brand, model, year_vehicle, country, grid_year]):
        return jsonify({"error": "Missing parameters"})

    vehicles = get_vehicle({
        "brand": brand,
        "model": model,
        "Year": year_vehicle
    })

    if not vehicles:
        print(f"Vehicle not found: {brand} {model} {year_vehicle}")
        return jsonify({"error": "Vehicle not found"})

    print(f"Found vehicle: {vehicles[0].get('model')} - Type: {vehicles[0].get('type')}")
    
    result = calculate_lifecycle(vehicles[0], country, grid_year)
    
    print(f"Lifecycle result: {result}")

    return jsonify(result)


# ==================================================
# MULTI VEHICLE COMPARE
# ==================================================
@app.route("/compare-multiple", methods=["POST"])
def compare_multiple():

    data = request.json
    country = data.get("country")
    year = data.get("year")
    vehicles_input = data.get("vehicles")

    if not all([country, year, vehicles_input]):
        return jsonify({"error": "Missing parameters"})

    results = []

    for item in vehicles_input:

        vehicles = get_vehicle({
            "brand": item.get("brand"),
            "model": item.get("model"),
            "Year": item.get("year")
        })

        if vehicles:
            result = calculate_lifecycle(vehicles[0], country, year)

            if "error" not in result:
                results.append(result)

    return jsonify(results)


# ==================================================
# RECOMMENDATION MODULE
# ==================================================
@app.route("/recommend", methods=["POST"])
def recommend():

    data = request.json

    result = recommend_vehicle(
        daily_km=data.get("daily_km"),
        years=data.get("years"),
        body_type=data.get("filters", {}).get("bodyType"),
        powertrain=data.get("filters", {}).get("powertrain"),
        country=data.get("country", "US"),
        grid_year=data.get("grid_year", 2023)
    )

    return jsonify(result)


# ==================================================
# BREAK EVEN MODULE
# ==================================================
@app.route("/break-even", methods=["POST"])
def break_even():

    data = request.json

    country = data.get("country")
    year = data.get("year")

    ev_input = data.get("ev")
    ice_input = data.get("ice")

    if not all([country, year, ev_input, ice_input]):
        return jsonify({"error": "Missing parameters"})

    ev_vehicle = get_vehicle(ev_input)
    ice_vehicle = get_vehicle(ice_input)

    if not ev_vehicle or not ice_vehicle:
        return jsonify({"error": "Vehicle not found"})

    result = break_even_km(
        ev_vehicle[0],
        ice_vehicle[0],
        country,
        year
    )

    return jsonify(result)


# ==================================================
# GREENWASHING ANALYSIS
# ==================================================
@app.route("/greenwashing", methods=["POST"])
def greenwashing():

    data = request.json

    lifecycle = data.get("lifecycle")
    vehicle_meta = data.get("vehicle")

    if not all([lifecycle, vehicle_meta]):
        return jsonify({"error": "Missing parameters"})

    result = detect_greenwashing(lifecycle, vehicle_meta)

    return jsonify(result)


# ==================================================
# CARBON SCORE MODULE
# ==================================================
@app.route("/carbon-score", methods=["POST"])
def carbon_score_route():

    data = request.json
    total_g_per_km = data.get("total_g_per_km")

    if total_g_per_km is None:
        return jsonify({"error": "Missing emissions value"})

    result = carbon_score(total_g_per_km)

    return jsonify(result)


# ==================================================
# ANNUAL IMPACT MODULE
# ==================================================
@app.route("/annual-impact", methods=["POST"])
def annual_impact():

    data = request.json

    total_g_per_km = data.get("total_g_per_km")
    annual_km = data.get("annual_km")

    if not all([total_g_per_km, annual_km]):
        return jsonify({"error": "Missing parameters"})

    result = annual_emissions(total_g_per_km, annual_km)

    return jsonify(result)


# ==================================================
# GRID SENSITIVITY MODULE
# ==================================================
@app.route("/grid-sensitivity", methods=["POST"])
def grid_sensitivity_route():

    data = request.json

    brand = data.get("brand")
    model = data.get("model")
    vehicle_year = data.get("vehicle_year")
    countries = data.get("countries")
    year = data.get("year")

    if not all([brand, model, vehicle_year, countries, year]):
        return jsonify({"error": "Missing parameters"})

    vehicles = get_vehicle({
        "brand": brand,
        "model": model,
        "Year": vehicle_year
    })

    if not vehicles:
        return jsonify({"error": "Vehicle not found"})

    result = grid_sensitivity(
        vehicles[0],
        countries,
        year
    )

    return jsonify(result)


# ==================================================
# GET AVAILABLE COUNTRIES (FOR DROPDOWNS)
# ==================================================
@app.route("/countries")
def countries_list():
    # Return a curated list of major countries
    countries = [
        {"code": "US", "name": "United States"},
        {"code": "DE", "name": "Germany"},
        {"code": "FR", "name": "France"},
        {"code": "UK", "name": "United Kingdom"},
        {"code": "CN", "name": "China"},
        {"code": "JP", "name": "Japan"},
        {"code": "IN", "name": "India"},
        {"code": "CA", "name": "Canada"},
        {"code": "AU", "name": "Australia"},
        {"code": "BR", "name": "Brazil"},
        {"code": "IT", "name": "Italy"},
        {"code": "ES", "name": "Spain"},
        {"code": "MX", "name": "Mexico"},
        {"code": "KR", "name": "South Korea"},
        {"code": "NL", "name": "Netherlands"},
        {"code": "CH", "name": "Switzerland"},
        {"code": "PL", "name": "Poland"},
        {"code": "BE", "name": "Belgium"},
        {"code": "SE", "name": "Sweden"},
        {"code": "NO", "name": "Norway"},
        {"code": "AT", "name": "Austria"},
        {"code": "DK", "name": "Denmark"},
        {"code": "FI", "name": "Finland"},
        {"code": "PT", "name": "Portugal"},
        {"code": "GR", "name": "Greece"},
        {"code": "CZ", "name": "Czech Republic"},
        {"code": "NZ", "name": "New Zealand"},
        {"code": "IE", "name": "Ireland"},
        {"code": "SG", "name": "Singapore"},
        {"code": "TH", "name": "Thailand"},
        {"code": "ZA", "name": "South Africa"},
        {"code": "AR", "name": "Argentina"},
        {"code": "CL", "name": "Chile"}
    ]
    
    return jsonify(countries)


# ==================================================
# METHODOLOGY
# ==================================================
@app.route("/methodology")
def methodology():

    return jsonify({
        "platform": "CarbonWise Lifecycle Intelligence",
        "operational_model": "GREET1 Passenger WTW + Ember Grid",
        "manufacturing_model": "GREET2 Vehicle-Cycle Model",
        "ranking_basis": "Lifecycle CO2e",
        "financial_factors": "Excluded"
    })


# ==================================================
# GRID DATA (FOR GRID INSIGHTS PAGE)
# ==================================================
@app.route("/grid-data")
def grid_data():

    import json
    import os

    # Load cleaned grid master data
    base_dir = os.path.dirname(os.path.abspath(__file__))
    grid_path = os.path.join(base_dir, "..", "data", "grid_master_v2_2026_clean.json")
    
    try:
        with open(grid_path, "r", encoding="utf-8") as f:
            grid_data = json.load(f)
        return jsonify(grid_data)
    except FileNotFoundError:
        # Fallback to original file if clean file doesn't exist
        grid_path = os.path.join(base_dir, "..", "data", "grid_master_v2_2026.json")
        with open(grid_path, "r", encoding="utf-8") as f:
            content = f.read()
            # Replace NaN with null for valid JSON
            content = content.replace(': NaN', ': null')
            content = content.replace(':NaN', ':null')
            grid_data = json.loads(content)
        return jsonify(grid_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)