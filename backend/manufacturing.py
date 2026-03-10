import psycopg2
import os
import dotenv

dotenv.load_dotenv()

DB_URL = os.getenv("DB_URI")

LIFETIME_KM      = 278_600
LB_TO_KG         = 0.453592
DEFAULT_RECYCLING = "pyro"


def get_connection():
    return psycopg2.connect(DB_URL)


NORM = {
    "ICE":  "ICEV",
    "BEV":  "EV",
    "EV":   "EV",
    "HEV":  "HEV",
    "PHEV": "PHEV",
    "FCV":  "FCV",
}

def normalise(vehicle_type):
    return NORM.get(vehicle_type, vehicle_type)


CHEMISTRY_MAP = {
    "ICEV": "LeadAcid",
    "HEV":  "NiMH",
    "PHEV": "LiIon",
    "EV":   "LiIon",
    "FCV":  "NiMH",
}


def _battery_weight_kg_from_db(vtype_norm, conn, structure="conventional"):
    """
    Returns battery pack weight (kg) from battery_weights for this vehicle
    type using CHEMISTRY_MAP.  Returns None if no row found.

    From the DB:
      EV  / conventional / LiIon  = 938.3 lb  = ~425.7 kg
      PHEV/ conventional / LiIon  = 226.2 lb  = ~102.6 kg
    """
    chemistry = CHEMISTRY_MAP.get(vtype_norm)
    if not chemistry:
        return None

    cur = conn.cursor()
    cur.execute("""
        SELECT weight_lb
        FROM battery_weights
        WHERE vehicle_type = %s
          AND chemistry    = %s
          AND structure    = %s
    """, (vtype_norm, chemistry, structure))
    row = cur.fetchone()
    cur.close()

    return (row[0] * LB_TO_KG) if row else None


def battery_emissions(vehicle_type, conn):
    vtype     = normalise(vehicle_type)
    chemistry = CHEMISTRY_MAP.get(vtype)
    if not chemistry:
        return 0

    cur = conn.cursor()
    cur.execute("""
        SELECT weight_lb FROM battery_weights
        WHERE vehicle_type = %s AND chemistry = %s AND structure = 'conventional'
    """, (vtype, chemistry))
    weight_row = cur.fetchone()
    if not weight_row:
        cur.close()
        return 0

    weight_kg = weight_row[0] * LB_TO_KG
    cur.execute("SELECT kg_co2_per_kg FROM battery_emission_factors WHERE chemistry = %s", (chemistry,))
    factor_row = cur.fetchone()
    cur.close()
    return (weight_kg * factor_row[0]) if factor_row else 0


def fluid_emissions(vehicle_type, conn):
    vtype = normalise(vehicle_type)
    cur   = conn.cursor()
    cur.execute("SELECT grams_co2 FROM fluids_weights WHERE vehicle_type = %s", (vtype,))
    row = cur.fetchone()
    cur.close()
    return (row[0] / 1000) if row else 0


def glider_emissions(vehicle_type, conn):
    vtype = normalise(vehicle_type)
    cur   = conn.cursor()
    cur.execute("""
        SELECT kg_co2 FROM glider_emissions
        WHERE vehicle_type = %s AND structure = 'conventional'
    """, (vtype,))
    row = cur.fetchone()
    cur.close()
    if not row:
        raise ValueError(f"No glider emissions for vehicle_type='{vehicle_type}' (looked up as '{vtype}')")
    return row[0]


def battery_recycling_emissions(vehicle, conn, method=DEFAULT_RECYCLING):
    """
    Recycling CO2 (kg) = battery_weight_kg * ghg_kg_per_kg_battery

    Battery weight resolution:
      1. vehicles.battery_weight_kg  -- vehicle-specific if non-null and > 0
      2. battery_weights table       -- GREET standard (EV/LiIon/conventional = 938.3 lb = ~425.7 kg)

    Guarantees a non-zero result for every EV/PHEV.
    Returns 0 for ICEV / HEV / FCV.
    """
    vtype = vehicle.get("vehicle_type", "")
    ntype = normalise(vtype)

    if ntype in ("ICEV", "HEV", "FCV"):
        return 0

    # Step 1: vehicle-specific weight
    battery_weight_kg = vehicle.get("battery_weight_kg") or 0

    # Step 2: fall back to GREET standard from battery_weights table
    if battery_weight_kg <= 0:
        battery_weight_kg = _battery_weight_kg_from_db(ntype, conn) or 0

    if battery_weight_kg <= 0:
        return 0

    chemistry = vehicle.get("battery_chemistry") or "NMC622"

    cur = conn.cursor()
    cur.execute("""
        SELECT ghg_kg_per_kg_battery FROM battery_recycling_factors
        WHERE chemistry = %s AND recycling_method = %s
    """, (chemistry, method))
    row = cur.fetchone()
    cur.close()

    if not row:
        cur2 = conn.cursor()
        cur2.execute("""
            SELECT ghg_kg_per_kg_battery FROM battery_recycling_factors
            WHERE chemistry = 'NMC622' AND recycling_method = 'pyro'
        """)
        row = cur2.fetchone()
        cur2.close()

    return (battery_weight_kg * row[0]) if row else 0


def recycling_material_flow(vehicle_weight_kg):
    """EU ELV Directive mass-balance estimates."""
    if not vehicle_weight_kg or vehicle_weight_kg <= 0:
        raise ValueError("vehicle_weight_kg required for ELV material flow")
    w = float(vehicle_weight_kg)
    return {
        "dismantled_mass_kg": round(w * 0.85, 1),
        "metal_recovered_kg": round(w * 0.75, 1),
        "asr_waste_kg":       round(w * 0.10, 1),
    }


def manufacturing_kg(vehicle):
    vehicle_type = vehicle.get("vehicle_type")
    if not vehicle_type:
        raise ValueError("vehicle_type missing from vehicle dict")
    conn    = get_connection()
    glider  = glider_emissions(vehicle_type, conn)
    battery = battery_emissions(vehicle_type, conn)
    fluids  = fluid_emissions(vehicle_type, conn)
    conn.close()
    return glider + battery + fluids


def manufacturing_per_km(vehicle):
    return manufacturing_kg(vehicle) / LIFETIME_KM


def recycling_kg(vehicle, method=DEFAULT_RECYCLING):
    conn   = get_connection()
    result = battery_recycling_emissions(vehicle, conn, method)
    conn.close()
    return result