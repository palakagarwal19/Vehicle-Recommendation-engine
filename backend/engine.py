import json
import os

# Base directory of backend
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_json(filename):
    path = os.path.join(BASE_DIR, "data", filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_vehicle(filters):
    vehicles = load_json("eu_vehicles_master.json")

    results = vehicles

    for key, value in filters.items():
        results = [
            v for v in results
            if str(v.get(key)).lower() == str(value).lower()
        ]

    return results


def get_grid_intensity(country_code, year):
    grid = load_json("grid_intensity.json")

    match = next(
        (
            g for g in grid
            if g["iso3"] == country_code and g["Year"] == year
        ),
        None
    )

    return match["grid_intensity_gpkwh"] if match else None


def calculate_operational(vehicle, country_code=None, year=None, lifetime_km=150000):

    if vehicle["type"] == "ICE":
        per_km = vehicle["co2_wltp_gpkm"]

    else:
        grid_factor = get_grid_intensity(country_code, year)

        if grid_factor is None:
            return {"error": "Grid intensity not found"}

        wh_per_km = vehicle.get("electric_wh_per_km")

        if wh_per_km is None:
            return {"error": "Electric consumption missing in dataset"}

        per_km = (wh_per_km / 1000) * grid_factor

    lifetime = (per_km * lifetime_km) / 1000

    return {
        "vehicle": vehicle["model"],
        "type": vehicle["type"],
        "per_km_g": round(per_km, 2),
        "lifetime_kg": round(lifetime, 2)
    }