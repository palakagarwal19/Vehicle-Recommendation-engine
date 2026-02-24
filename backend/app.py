import os
import json
from flask import Flask, request, jsonify
from engine import get_vehicle, calculate_lifecycle
from flask_cors import CORS

app = Flask(__name__)
CORS(app,resources={r"/*":{"origins":"*"}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

# -----------------------------
# VEHICLES ENDPOINT
# -----------------------------
@app.route("/vehicles")
def vehicles():
    path = os.path.join(PROJECT_ROOT, "data", "eu_vehicles_master.json")
    with open(path, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))

# -----------------------------
# COMPARE ENDPOINT
# -----------------------------
@app.route("/compare")
def compare():

    brand = request.args.get("brand")
    model = request.args.get("model")
    year = request.args.get("year")
    country = request.args.get("country")

    if not all([brand, model, year, country]):
        return jsonify({"error": "Missing parameters"})

    vehicles = get_vehicle({
        "brand": brand,
        "model": model,
        "Year": year
    })

    if len(vehicles) == 0:
        return jsonify({"error": "Vehicle not found"})

    vehicle = vehicles[0]

    result = calculate_lifecycle(vehicle, country, year)

    return jsonify(result)
if __name__ == "__main__":
    app.run(debug=True)