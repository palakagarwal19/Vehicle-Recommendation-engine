import psycopg2
import os
import dotenv

dotenv.load_dotenv()

DB_URL = os.getenv("DB_URI")

LIFETIME_KM = 278_600
LB_TO_KG    = 0.453592


def get_connection():
    return psycopg2.connect(DB_URL)


# =====================================================
# TYPE NORMALISATION
# =====================================================
# vehicles table  →  manufacturing tables
#   "ICE"         →  "ICEV"
#   "BEV"         →  "EV"
#   "EV"          →  "EV"   (legacy alias)
#   HEV/PHEV/FCV  →  unchanged (same in both)

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


# =====================================================
# GREET BATTERY CHEMISTRY MAP
# =====================================================

CHEMISTRY_MAP = {
    "ICEV": "LeadAcid",
    "HEV":  "NiMH",
    "PHEV": "LiIon",
    "EV":   "LiIon",
    "FCV":  "NiMH",
}


# =====================================================
# BATTERY EMISSIONS
# =====================================================

def battery_emissions(vehicle_type, conn):

    vtype     = normalise(vehicle_type)
    chemistry = CHEMISTRY_MAP.get(vtype)

    if not chemistry:
        return 0

    cur = conn.cursor()

    cur.execute("""
        SELECT weight_lb
        FROM battery_weights
        WHERE vehicle_type = %s
          AND chemistry = %s
          AND structure = 'conventional'
    """, (vtype, chemistry))

    weight_row = cur.fetchone()

    if not weight_row:
        cur.close()
        return 0

    weight_kg = weight_row[0] * LB_TO_KG

    cur.execute("""
        SELECT kg_co2_per_kg
        FROM battery_emission_factors
        WHERE chemistry = %s
    """, (chemistry,))

    factor_row = cur.fetchone()
    cur.close()

    if not factor_row:
        return 0

    return weight_kg * factor_row[0]


# =====================================================
# FLUID EMISSIONS
# =====================================================

def fluid_emissions(vehicle_type, conn):

    vtype = normalise(vehicle_type)
    cur   = conn.cursor()

    cur.execute("""
        SELECT grams_co2
        FROM fluids_weights
        WHERE vehicle_type = %s
    """, (vtype,))

    row = cur.fetchone()
    cur.close()

    if not row:
        return 0

    return row[0] / 1000  # g → kg


# =====================================================
# GLIDER EMISSIONS
# =====================================================

def glider_emissions(vehicle_type, conn):

    vtype = normalise(vehicle_type)
    cur   = conn.cursor()

    cur.execute("""
        SELECT kg_co2
        FROM glider_emissions
        WHERE vehicle_type = %s
          AND structure = 'conventional'
    """, (vtype,))

    row = cur.fetchone()
    cur.close()

    if not row:
        raise ValueError(
            f"No glider emissions for vehicle_type='{vehicle_type}' "
            f"(looked up as '{vtype}')"
        )

    return row[0]


# =====================================================
# TOTAL MANUFACTURING
# =====================================================

def manufacturing_kg(vehicle):

    vehicle_type = vehicle.get("vehicle_type")

    if not vehicle_type:
        raise ValueError("vehicle_type missing from vehicle dict")

    conn = get_connection()

    glider  = glider_emissions(vehicle_type, conn)
    battery = battery_emissions(vehicle_type, conn)
    fluids  = fluid_emissions(vehicle_type, conn)

    conn.close()

    return glider + battery + fluids


# =====================================================
# MANUFACTURING PER KM
# =====================================================

def manufacturing_per_km(vehicle):

    total = manufacturing_kg(vehicle)

    return total / LIFETIME_KM