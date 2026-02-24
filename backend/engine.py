import json
import os
from manufacturing import manufacturing_per_km

# Base directory of backend
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_json(filename):
    path = os.path.join(BASE_DIR, "..", "data", filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def get_vehicle(filters):
    vehicles = load_json("eu_vehicles_master.json")
    results = []

    for v in vehicles:
        match = True
        for k, val in filters.items():
            if k not in v:
                match = False
                break

            if str(val).lower() not in str(v[k]).lower():
                match = False
                break

        if match:
            results.append(v)

    return results

def get_grid_intensity(country_code, year):
    grid = load_json("grid_intensity.json")

    for g in grid:

        iso = g.get("iso3")
        yr = g.get("Year")

        if iso is None or yr is None:
            continue

        if iso.upper() == country_code.upper() and int(yr) == int(year):
            return g.get("grid_intensity_gpkwh")

    return None

def calculate_operational(vehicle, country_code=None, year=None, lifetime_km=278600):

    vtype = vehicle.get("type")

    # ICE VEHICLES
    if vtype == "ICE":

        g_per_km = vehicle.get("co2_wltp_gpkm")

        if g_per_km is None:
            return {"error": "ICE CO2 per km missing in dataset"}

        per_km = float(g_per_km)

    # ELECTRIC / HYBRID VEHICLES
    elif vtype in ["EV", "HEV", "PHEV"]:

        grid_factor = get_grid_intensity(country_code, year)

        if grid_factor is None:
            return {"error": "Grid intensity not found"}

        wh_per_km = vehicle.get("electric_wh_per_km")

        if wh_per_km is None:
            return {"error": "Electric consumption missing"}

        per_km = (float(wh_per_km) / 1000) * float(grid_factor)

    else:
        return {"error": f"Unknown vehicle type: {vtype}"}

    lifetime = (per_km * lifetime_km) / 1000

    return {
        "vehicle": vehicle["model"],
        "type": vtype,
        "operational_g_per_km": round(per_km, 2),
        "operational_lifetime_kg": round(lifetime, 2)
    }
def calculate_lifecycle(vehicle, country_code, year):

    operational = calculate_operational(vehicle, country_code, year)

    if "error" in operational:
        return operational

    manuf_per_km = manufacturing_per_km(vehicle)   # kg/km

    total_per_km = operational["operational_g_per_km"] + (manuf_per_km * 1000)

    return {
        "vehicle": vehicle["model"],
        "powertrain": vehicle["type"],
        "operational_g_per_km": operational["operational_g_per_km"],
        "manufacturing_g_per_km": round(manuf_per_km * 1000, 2),
        "total_g_per_km": round(total_per_km, 2)
    }