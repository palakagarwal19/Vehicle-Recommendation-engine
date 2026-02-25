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

# Country code mapping: 2-letter to 3-letter ISO codes
COUNTRY_CODE_MAP = {
    "US": "USA",
    "DE": "DEU",
    "FR": "FRA",
    "UK": "GBR",
    "CN": "CHN",
    "JP": "JPN",
    "IN": "IND",
    "CA": "CAN",
    "AU": "AUS",
    "BR": "BRA",
    "IT": "ITA",
    "ES": "ESP",
    "MX": "MEX",
    "KR": "KOR",
    "ID": "IDN",
    "NL": "NLD",
    "SA": "SAU",
    "TR": "TUR",
    "CH": "CHE",
    "PL": "POL",
    "BE": "BEL",
    "SE": "SWE",
    "NO": "NOR",
    "AT": "AUT",
    "DK": "DNK",
    "FI": "FIN",
    "PT": "PRT",
    "GR": "GRC",
    "CZ": "CZE",
    "RO": "ROU",
    "NZ": "NZL",
    "IE": "IRL",
    "SG": "SGP",
    "MY": "MYS",
    "TH": "THA",
    "PH": "PHL",
    "VN": "VNM",
    "PK": "PAK",
    "BD": "BGD",
    "EG": "EGY",
    "ZA": "ZAF",
    "NG": "NGA",
    "AR": "ARG",
    "CL": "CHL",
    "CO": "COL",
    "PE": "PER",
    "VE": "VEN",
}

def get_grid_intensity(country_code, year, use_corrected=True):

    grid = load_json("grid_master_v2_2026_clean.json")

    # Convert 2-letter to 3-letter code if needed
    original_code = country_code
    country_code = country_code.upper()
    if country_code in COUNTRY_CODE_MAP:
        country_code = COUNTRY_CODE_MAP[country_code]
    
    year = str(year)

    if country_code not in grid:
        print(f"Country code '{original_code}' (mapped to '{country_code}') not found in grid data")
        return None

    if year not in grid[country_code]:
        available_years = sorted(grid[country_code].keys())
        if not available_years:
            return None
        year = available_years[-1]
        print(f"Year {year} not found, using latest: {available_years[-1]}")

    value = grid[country_code][year]["corrected"] if use_corrected else grid[country_code][year]["raw"]
    
    # Handle None values (from NaN in data)
    if value is None:
        return None
    
    return value



# =====================================================
# OPERATIONAL EMISSIONS
# =====================================================

def calculate_operational(vehicle, country_code=None, year=None, lifetime_km=278600):

    vtype = vehicle.get("type")

    # ---------------- ICE ----------------
    if vtype in ["ICE", "HEV", "PHEV"]:

        greet_wtw = get_greet_wtw(vehicle)

        if greet_wtw is None:
            # Fallback: use CO2 WLTP value if available
            co2_wltp = vehicle.get("co2_wltp_gpkm")
            if co2_wltp is not None:
                per_km = float(co2_wltp)
            else:
                return {"error": "GREET WTW value not found and no CO2 WLTP data available"}
        else:
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

    try:
        manuf_per_km = manufacturing_per_km(vehicle)  # kg/km from GREET2
    except ValueError as e:
        return {"error": f"Manufacturing calculation failed: {str(e)}"}
    
    if manuf_per_km is None:
        return {"error": "Manufacturing emissions could not be calculated"}

    total_per_km = operational["operational_g_per_km"] + (manuf_per_km * 1000)

    return {
        "vehicle": vehicle["model"],
        "powertrain": vehicle["type"],
        "operational_g_per_km": operational["operational_g_per_km"],
        "manufacturing_g_per_km": round(manuf_per_km * 1000, 2),
        "total_g_per_km": round(total_per_km, 2)
    }