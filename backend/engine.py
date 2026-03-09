import psycopg2
import os
from manufacturing import manufacturing_per_km

DB_URL = os.getenv("DB_URI")


def get_connection():
    return psycopg2.connect(DB_URL)


# =====================================================
# GREET WTW LOOKUP
# =====================================================

def get_greet_wtw(vehicle):

    conn = get_connection()
    cur = conn.cursor()

    vtype = vehicle.get("type")

    if vtype == "ICE":
        fuel = vehicle.get("fuel_type")

        cur.execute(
            """
            SELECT wtw_gpkm
            FROM fuel_upstream_emissions
            WHERE fuel_type = %s
            """,
            (fuel,)
        )

    elif vtype == "HEV":
        cur.execute(
            "SELECT wtw_gpkm FROM fuel_upstream_emissions WHERE fuel_type='hev_gasoline'"
        )

    elif vtype == "PHEV":
        cur.execute(
            "SELECT wtw_gpkm FROM fuel_upstream_emissions WHERE fuel_type='phev_gasoline'"
        )

    else:
        cur.close()
        conn.close()
        return None

    row = cur.fetchone()

    cur.close()
    conn.close()

    if row:
        return row[0]

    return None


# =====================================================
# VEHICLE SEARCH
# =====================================================

def get_vehicle(filters):

    conn = get_connection()
    cur = conn.cursor()

    query = "SELECT * FROM vehicles WHERE TRUE"
    params = []

    allowed_filters = {"brand", "model", "year", "type"}

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

    rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description]

    cur.close()
    conn.close()

    results = [dict(zip(columns, row)) for row in rows]

    return results


# =====================================================
# GRID LOOKUP
# =====================================================

COUNTRY_CODE_MAP = {
    "US": "USA",
    "DE": "DEU",
    "FR": "FRA",
    "UK": "GBR",
    "CN": "CHN",
    "JP": "JPN",
    "IN": "IND",
}

def get_grid_intensity(country_code, year):

    country_code = country_code.upper()

    if country_code in COUNTRY_CODE_MAP:
        country_code = COUNTRY_CODE_MAP[country_code]

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT corrected
        FROM grid_intensity
        WHERE country = %s AND year = %s
        """,
        (country_code, year)
    )

    result = cur.fetchone()

    cur.close()
    conn.close()

    if result:
        return result[0]

    return None


# =====================================================
# OPERATIONAL EMISSIONS
# =====================================================

def calculate_operational(vehicle, country_code=None, year=None, lifetime_km=278600):

    vtype = vehicle.get("type")

    if vtype in ["ICE", "HEV", "PHEV"]:

        greet_wtw = get_greet_wtw(vehicle)

        if greet_wtw is None:
            co2_wltp = vehicle.get("co2_wltp_gpkm")

            if co2_wltp is None:
                return {"error": "No emissions data available"}

            per_km = float(co2_wltp)

        else:
            per_km = float(greet_wtw)

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
        manuf_per_km = manufacturing_per_km(vehicle)
    except ValueError as e:
        return {"error": f"Manufacturing calculation failed: {str(e)}"}

    if manuf_per_km is None:
        return {"error": "Manufacturing emissions missing"}

    total_per_km = operational["operational_g_per_km"] + (manuf_per_km * 1000)

    return {
        "vehicle": vehicle["model"],
        "powertrain": vehicle["type"],
        "operational_g_per_km": operational["operational_g_per_km"],
        "manufacturing_g_per_km": round(manuf_per_km * 1000, 2),
        "total_g_per_km": round(total_per_km, 2)
    }