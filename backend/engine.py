import json
import os
from manufacturing import manufacturing_per_km

# =====================================================
# BASE PATH
# =====================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_json(filename):
    path = os.path.join(BASE_DIR, "..", "data", filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
# =====================================================
# GREET PASSENGER WTW LOOKUP
# =====================================================
GREET_WTW = load_json("greet_passenger_wtw.json")

def get_greet_wtw(vehicle):

    vtype = vehicle.get("type")

    if vtype == "ICE":
        fuel = vehicle.get("fuel_type", "").lower()

        if fuel in ["gasoline", "petrol"]:
            return GREET_WTW.get("gasoline_ice")

        if fuel == "diesel":
            return GREET_WTW.get("diesel_ice")

    if vtype == "HEV":
        return GREET_WTW.get("hev_gasoline")

    if vtype == "PHEV":
        return GREET_WTW.get("phev_gasoline_cs")

    return None
# =====================================================
# VEHICLE SEARCH
# =====================================================

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


# =====================================================
# GRID LOOKUP (EMBER + T&D Corrected)
# =====================================================

def get_grid_intensity(country_code, year, use_corrected=True):

    grid = load_json("grid_master_v2_2026.json")

    country_code = country_code.upper()
    year = str(year)

    if country_code not in grid:
        return None

    if year not in grid[country_code]:
        available_years = sorted(grid[country_code].keys())
        if not available_years:
            return None
        year = available_years[-1]

    if use_corrected:
        return grid[country_code][year]["corrected"]
    else:
        return grid[country_code][year]["raw"]



# =====================================================
# OPERATIONAL EMISSIONS
# =====================================================

def calculate_operational(vehicle, country_code=None, year=None, lifetime_km=278600):

    vtype = vehicle.get("type")

    # ---------------- ICE ----------------
    if vtype in ["ICE", "HEV", "PHEV"]:

        greet_wtw = get_greet_wtw(vehicle)

        if greet_wtw is None:
            return {"error": "GREET WTW value not found"}

        per_km = float(greet_wtw)

    # ---------------- EV / HEV / PHEV ----------------
    elif vtype == "EV":

        if not country_code or not year:
            return {"error": "Country and year required"}

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


# =====================================================
# FULL LIFECYCLE
# =====================================================

def calculate_lifecycle(vehicle, country_code, year):

    operational = calculate_operational(vehicle, country_code, year)

    if "error" in operational:
        return operational

    manuf_per_km = manufacturing_per_km(vehicle)  # kg/km from GREET2

    total_per_km = operational["operational_g_per_km"] + (manuf_per_km * 1000)

    return {
        "vehicle": vehicle["model"],
        "powertrain": vehicle["type"],
        "operational_g_per_km": operational["operational_g_per_km"],
        "manufacturing_g_per_km": round(manuf_per_km * 1000, 2),
        "total_g_per_km": round(total_per_km, 2)
    }