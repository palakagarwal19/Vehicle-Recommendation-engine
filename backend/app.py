import os
import json
from flask import Flask, request, jsonify
from engine import get_vehicle, calculate_lifecycle
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)


# --------------------------------------------------
# VEHICLE DETAIL
# --------------------------------------------------
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


# --------------------------------------------------
# MULTI VEHICLE COMPARE
# --------------------------------------------------
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


# --------------------------------------------------
# RECOMMENDATION ENGINE (TOP 3 + BUDGET FILTER)
# --------------------------------------------------
@app.route("/recommend", methods=["POST"])
def recommend():

    data = request.json
    country = data.get("country")
    year = data.get("year")
    filters = data.get("filters", {})

    if not all([country, year]):
        return jsonify({"error": "Missing parameters"})

    price_min = filters.get("priceMin")
    price_max = filters.get("priceMax")

    vehicles = get_vehicle(filters)

    results = []

    for v in vehicles:

        # Apply budget filtering safely
        if price_min and v.get("price") and v["price"] < price_min:
            continue
        if price_max and v.get("price") and v["price"] > price_max:
            continue

        lifecycle = calculate_lifecycle(v, country, year)

        if "error" not in lifecycle:
            results.append(lifecycle)

    if not results:
        return jsonify({"error": "No vehicles found"})

    # Sort by lowest lifecycle emissions
    results.sort(key=lambda x: x["total_g_per_km"])

    # Return top 3
    return jsonify({
        "recommended": results[:3],
        "total_vehicles_checked": len(results)
    })


# --------------------------------------------------
# METHODOLOGY
# --------------------------------------------------
@app.route("/methodology")
def methodology():

    return jsonify({
        "operational_model": "GREET1 Passenger WTW (ICE/HEV/PHEV) + Ember Grid (EV)",
        "manufacturing_model": "GREET2 2025 Vehicle-Cycle Model",
        "grid_data": "Ember Electricity Data + T&D Loss Correction",
        "lifetime_km": 278600
    })


if __name__ == "__main__":
    app.run(debug=True)