import psycopg2
import os
from manufacturing import manufacturing_per_km
import dotenv

dotenv.load_dotenv()

DB_URL = os.getenv("DB_URI")


def get_connection():
    return psycopg2.connect(DB_URL)


# =====================================================
# CACHE TABLES (LOAD ONCE)
# =====================================================

FUEL_CACHE = {}
GRID_CACHE = {}


def load_caches():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT fuel_type, wtt_gco2_per_mj, energy_density_mj_per_l
        FROM fuel_upstream_emissions
    """)

    for fuel, wtt, density in cur.fetchall():
        FUEL_CACHE[fuel.lower()] = (wtt, density)

    cur.execute("""
        SELECT country_code, year, carbon_intensity_gco2_per_kwh
        FROM grid_intensity
    """)

    for country_code, year, value in cur.fetchall():
        GRID_CACHE[(country_code.upper(), year)] = value

    cur.close()
    conn.close()


load_caches()


# =====================================================
# CONSTANTS
# =====================================================

# Powertrain type sets — DB uses "BEV", legacy may use "EV"
ICE_TYPES  = {"ICE"}
HEV_TYPES  = {"HEV"}
PHEV_TYPES = {"PHEV"}
EV_TYPES   = {"EV", "BEV"}

# Direct combustion emission factors (g CO₂ per litre)
# Source: IPCC / GREET — full combustion, tank-to-wheel
FUEL_EF = {
    "gasoline": 2392,
    "petrol":   2392,   # alias
    "diesel":   2640,
    "e85":      1540,   # 85% ethanol blend
    "lpg":      1625,
    "cng":      2040,
}

# PHEV real-world electric driving share (utility factor)
# EU/ICCT real-world data: ~55-65% electric; we use 0.6
PHEV_ELECTRIC_SHARE = 0.6

# Default lifetime km for per-km amortisation of manufacturing
DEFAULT_LIFETIME_KM = 278_600


# =====================================================
# HELPERS
# =====================================================

def get_grid_intensity(country_code, year):
    """Return grid carbon intensity (g CO₂/kWh) for country + year."""

    COUNTRY_CODE_MAP = {
        "US": "USA", "DE": "DEU", "FR": "FRA",
        "UK": "GBR", "CN": "CHN", "JP": "JPN", "IN": "IND",
    }

    country_code = country_code.upper()

    if country_code in COUNTRY_CODE_MAP:
        country_code = COUNTRY_CODE_MAP[country_code]

    return GRID_CACHE.get((country_code, year))


def get_fuel_ef(fuel_type):
    """Return direct combustion emission factor (g CO₂/L) for a fuel type."""
    if not fuel_type:
        return None
    return FUEL_EF.get(fuel_type.lower().strip())


def fuel_emissions_per_km(vehicle):
    """
    ICE / HEV / PHEV fuel path:
        E_fuel/km = (Fuel_L/100km / 100) × EF_fuel  [g CO₂/km]

    Returns (value, error_string_or_None)
    """
    fuel_type   = vehicle.get("fuel_type")
    l_per_100km = vehicle.get("fuel_l_per_100km")
    model       = vehicle.get("model", "unknown")

    if l_per_100km is None:
        return None, f"fuel_l_per_100km missing for {model}"

    ef = get_fuel_ef(fuel_type)

    if ef is None:
        return None, (
            f"No emission factor for fuel_type='{fuel_type}' on {model}. "
            f"Known types: {list(FUEL_EF.keys())}"
        )

    return (float(l_per_100km) / 100) * ef, None


def electric_emissions_per_km(vehicle, grid_factor):
    """
    EV / PHEV electric path:
        E_elec/km = (Wh/km / 1000) × CI_grid  [g CO₂/km]

    Returns (value, error_string_or_None)
    """
    wh_per_km = vehicle.get("electric_wh_per_km")
    model     = vehicle.get("model", "unknown")

    if wh_per_km is None:
        return None, f"electric_wh_per_km missing for {model}"

    return (float(wh_per_km) / 1000) * float(grid_factor), None


# =====================================================
# VEHICLE SEARCH
# =====================================================

def get_vehicle(filters):

    conn = get_connection()
    cur = conn.cursor()

    query = "SELECT * FROM vehicles WHERE TRUE"
    params = []
    allowed_filters = {"brand", "model", "year", "vehicle_type"}

    for k, v in filters.items():
        if k not in allowed_filters:
            continue
        if k == "year":
            query += " AND year = %s"
            params.append(v)
        else:
            query += f" AND LOWER({k}) LIKE %s"
            params.append(f"%{v.lower()}%")

    cur.execute(query, params)
    rows    = cur.fetchall()
    columns = [desc[0] for desc in cur.description]

    cur.close()
    conn.close()

    return [dict(zip(columns, row)) for row in rows]


# =====================================================
# OPERATIONAL EMISSIONS
# =====================================================

def calculate_operational(vehicle, country_code=None, year=None,
                           lifetime_km=DEFAULT_LIFETIME_KM):
    """
    Returns operational_g_per_km using the correct formula per powertrain:

      ICE  : E = (L/km) × EF_fuel
      HEV  : E = (L/km) × EF_fuel          (no external grid charging)
      PHEV : E = Sev × E_elec + (1-Sev) × E_fuel    where Sev = 0.6
      BEV  : E = (Wh/km / 1000) × CI_grid
    """

    vtype = vehicle.get("vehicle_type")
    model = vehicle.get("model", "unknown")

    # ── ICE ──────────────────────────────────────────────────────────────────
    if vtype in ICE_TYPES:

        e_fuel, err = fuel_emissions_per_km(vehicle)
        if err:
            return {"error": err}

        per_km = e_fuel

    # ── HEV ──────────────────────────────────────────────────────────────────
    # HEV recovers energy via regenerative braking — no external grid charge.
    # Emissions still driven entirely by fuel consumption.
    elif vtype in HEV_TYPES:

        e_fuel, err = fuel_emissions_per_km(vehicle)
        if err:
            return {"error": err}

        per_km = e_fuel

    # ── PHEV ─────────────────────────────────────────────────────────────────
    # Weighted split: 60% electric driving, 40% fuel driving (ICCT utility factor)
    #   E_op/km = Sev × E_elec/km + (1 - Sev) × E_fuel/km
    elif vtype in PHEV_TYPES:

        if not country_code or not year:
            return {"error": "Country and year required for PHEV calculation"}

        grid_factor = get_grid_intensity(country_code, year)
        if grid_factor is None:
            return {"error": f"Grid intensity not found for country={country_code} year={year}"}

        e_elec, err = electric_emissions_per_km(vehicle, grid_factor)
        if err:
            return {"error": err}

        e_fuel, err = fuel_emissions_per_km(vehicle)
        if err:
            return {"error": err}

        sev    = PHEV_ELECTRIC_SHARE
        per_km = sev * e_elec + (1 - sev) * e_fuel

    # ── BEV / EV ─────────────────────────────────────────────────────────────
    elif vtype in EV_TYPES:

        if not country_code or not year:
            return {"error": "Country and year required for BEV calculation"}

        grid_factor = get_grid_intensity(country_code, year)
        if grid_factor is None:
            return {"error": f"Grid intensity not found for country={country_code} year={year}"}

        e_elec, err = electric_emissions_per_km(vehicle, grid_factor)
        if err:
            return {"error": err}

        per_km = e_elec

    else:
        return {
            "error": (
                f"Unknown vehicle_type='{vtype}' for {model}. "
                f"Expected one of: {ICE_TYPES | HEV_TYPES | PHEV_TYPES | EV_TYPES}"
            )
        }

    lifetime_kg = (per_km * lifetime_km) / 1000

    return {
        "vehicle":                 model,
        "vehicle_type":            vtype,
        "operational_g_per_km":    round(per_km, 2),
        "operational_lifetime_kg": round(lifetime_kg, 2),
    }


# =====================================================
# FULL LIFECYCLE
# =====================================================

def calculate_lifecycle(vehicle, country_code, year,
                         lifetime_km=DEFAULT_LIFETIME_KM):
    """
    Full lifecycle emissions.

    Per-km chart value (methodology section 7):
        E_total/km = E_op/km + (manufacturing_total_kg × 1000) / lifetime_km

    Returns per-km values for charts AND totals for distance-based calculations.
    """

    operational = calculate_operational(vehicle, country_code, year, lifetime_km)

    if "error" in operational:
        return operational

    try:
        manuf_per_km_kg = manufacturing_per_km(vehicle)  # kg CO₂/km
    except ValueError as e:
        return {"error": f"Manufacturing calculation failed: {str(e)}"}

    if manuf_per_km_kg is None:
        manuf_per_km_kg = 0

    op_g_per_km     = operational["operational_g_per_km"]
    manuf_g_per_km  = round(manuf_per_km_kg * 1000, 2)       # kg → g
    total_g_per_km  = round(op_g_per_km + manuf_g_per_km, 2)
    manuf_total_kg  = round(manuf_per_km_kg * lifetime_km, 2) # for distance slider

    return {
        # Identity — included so /compare-multiple can match by brand+model+year
        "vehicle":                  vehicle["model"],
        "brand":                    vehicle.get("brand", ""),
        "year":                     vehicle.get("year"),
        "vehicle_type":             vehicle["vehicle_type"],

        # Per-km (bar + donut charts)
        "operational_g_per_km":     op_g_per_km,
        "manufacturing_g_per_km":   manuf_g_per_km,
        "total_g_per_km":           total_g_per_km,

        # Totals (break-even + distance slider on frontend)
        "manufacturing_total_kg":   manuf_total_kg,
        "operational_lifetime_kg":  operational["operational_lifetime_kg"],
    }