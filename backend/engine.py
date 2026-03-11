import psycopg2
import os
from manufacturing import manufacturing_kg as get_manufacturing_kg, recycling_kg
import dotenv

dotenv.load_dotenv()

DB_URL = os.getenv("DB_URI")


def get_connection():
    return psycopg2.connect(DB_URL)


# =====================================================
# CACHE TABLES (LOAD ONCE)
# =====================================================

GRID_CACHE = {}


def load_caches():
    conn = get_connection()
    cur  = conn.cursor()
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

ICE_TYPES  = {"ICE"}
HEV_TYPES  = {"HEV"}
PHEV_TYPES = {"PHEV"}
EV_TYPES   = {"EV", "BEV"}

PHEV_ELECTRIC_SHARE = 0.6
DEFAULT_LIFETIME_KM = 278_600

COUNTRY_CODE_MAP = {
    "US": "USA", "DE": "DEU", "FR": "FRA",
    "UK": "GBR", "CN": "CHN", "JP": "JPN", "IN": "IND",
}


# =====================================================
# HELPERS
# =====================================================

def get_grid_intensity(country_code, year):
    code = country_code.upper()
    if code in COUNTRY_CODE_MAP:
        code = COUNTRY_CODE_MAP[code]
    return GRID_CACHE.get((code, year))


def electric_emissions_per_km(vehicle, grid_factor):
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
    cur  = conn.cursor()

    query  = "SELECT * FROM vehicles WHERE TRUE"
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
    vtype = vehicle.get("vehicle_type")
    model = vehicle.get("model", "unknown")

    if vtype in ICE_TYPES:
        tailpipe = vehicle.get("co2_wltp_gpkm")
        if tailpipe is None:
            return {"error": f"co2_wltp_gpkm missing for ICE vehicle {model}"}
        per_km = float(tailpipe)

    elif vtype in HEV_TYPES:
        tailpipe = vehicle.get("co2_wltp_gpkm")
        if tailpipe is None:
            return {"error": f"co2_wltp_gpkm missing for HEV vehicle {model}"}
        per_km = float(tailpipe)

    elif vtype in PHEV_TYPES:
        if not country_code or not year:
            return {"error": "Country and year required for PHEV calculation"}
        grid_factor = get_grid_intensity(country_code, year)
        if grid_factor is None:
            return {"error": f"Grid intensity not found for country={country_code} year={year}"}
        e_elec, err = electric_emissions_per_km(vehicle, grid_factor)
        if err:
            return {"error": err}
        tailpipe = vehicle.get("co2_wltp_gpkm")
        if tailpipe is None:
            return {"error": f"co2_wltp_gpkm missing for PHEV vehicle {model}"}
        per_km = PHEV_ELECTRIC_SHARE * e_elec + (1 - PHEV_ELECTRIC_SHARE) * float(tailpipe)

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
# FULL LIFECYCLE  (cradle-to-grave)
# =====================================================

def calculate_lifecycle(vehicle, country_code, year,
                         lifetime_km=DEFAULT_LIFETIME_KM,
                         distance_km=None,
                         recycling_method="pyro"):
    """
    Full cradle-to-grave lifecycle emissions.

    E_total = manufacturing_total_kg
            + operational_total_kg       (scales with distance_km)
            + recycling_kg               (end-of-life battery, fixed)

    Per-km rates amortised over lifetime_km (278,600 km standard).
    distance_km is the user-requested distance for total calculations.
    """
    d = distance_km if distance_km is not None else lifetime_km

    # ── Operational ──────────────────────────────────────────────────────────
    operational = calculate_operational(vehicle, country_code, year, lifetime_km)
    if "error" in operational:
        return operational

    # ── Manufacturing (fixed one-time cost — source of truth) ───────────────
    # Always computed as a fixed kg value first; per-km rate is derived,
    # never the other way around.
    try:
        manuf_total_kg = round(get_manufacturing_kg(vehicle), 2)
    except ValueError as e:
        return {"error": f"Manufacturing calculation failed: {str(e)}"}

    # ── Recycling (fixed end-of-life cost) ───────────────────────────────────
    recycle_kg_val = recycling_kg(vehicle, method=recycling_method)

    # ── Per-km rates (amortised over standard lifetime — for display only) ───
    op_g_per_km      = operational["operational_g_per_km"]
    manuf_g_per_km   = round(manuf_total_kg * 1000 / lifetime_km, 2)   # fixed kg -> g/km
    recycle_g_per_km = round(recycle_kg_val  * 1000 / lifetime_km, 2)
    total_g_per_km   = round(op_g_per_km + manuf_g_per_km + recycle_g_per_km, 2)

    # ── Distance-scaled totals ────────────────────────────────────────────────
    op_total_kg    = round((op_g_per_km * d) / 1000, 2)
    # manufacturing and recycling are fixed one-time costs — never scaled by d
    total_for_d_kg = round(manuf_total_kg + op_total_kg + recycle_kg_val, 2)

    return {
        # Identity
        "vehicle":                  vehicle["model"],
        "model":                    vehicle["model"],
        "brand":                    vehicle.get("brand", ""),
        "year":                     vehicle.get("year"),
        "vehicle_type":             vehicle["vehicle_type"],

        # Per-km rates (for charts — amortised over standard lifetime_km)
        "operational_g_per_km":     op_g_per_km,
        "manufacturing_g_per_km":   manuf_g_per_km,
        "recycling_g_per_km":       recycle_g_per_km,
        "total_g_per_km":           total_g_per_km,

        # Fixed / one-time costs
        "manufacturing_total_kg":   manuf_total_kg,
        "recycling_kg":             round(recycle_kg_val, 2),

        # Distance-based totals (change with distance_km)
        "distance_km":              d,
        "operational_total_kg":     op_total_kg,
        "total_for_distance_kg":    total_for_d_kg,
    }