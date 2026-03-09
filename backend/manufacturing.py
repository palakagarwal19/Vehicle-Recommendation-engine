import psycopg2
import os
import dotenv

dotenv.load_dotenv()

DB_URL = os.getenv("DB_URI")

LIFETIME_KM = 278600
LB_TO_KG = 0.453592


def get_connection():
    return psycopg2.connect(DB_URL)


# =====================================
# GREET BATTERY CHEMISTRY MAP
# =====================================

CHEMISTRY_MAP = {
    "ICE": "LeadAcid",
    "HEV": "NiMH",
    "PHEV": "LiIon",
    "EV": "LiIon",
    "FCV": "NiMH"
}


# =====================================
# BATTERY EMISSIONS
# =====================================

def battery_emissions(vehicle_type, conn):

    chemistry = CHEMISTRY_MAP.get(vehicle_type)

    if not chemistry:
        return 0

    cur = conn.cursor()

    cur.execute("""
        SELECT weight_lb
        FROM battery_weights
        WHERE vehicle_type = %s
        AND chemistry = %s
        AND structure = 'conventional'
    """, (vehicle_type, chemistry))

    weight_row = cur.fetchone()

    if not weight_row:
        cur.close()
        return 0

    weight_lb = weight_row[0]
    weight_kg = weight_lb * LB_TO_KG

    cur.execute("""
        SELECT kg_co2_per_kg
        FROM battery_emission_factors
        WHERE chemistry = %s
    """, (chemistry,))

    factor_row = cur.fetchone()

    cur.close()

    if not factor_row:
        return 0

    factor = factor_row[0]

    return weight_kg * factor


# =====================================
# FLUID EMISSIONS
# =====================================

def fluid_emissions(vehicle_type, conn):

    cur = conn.cursor()

    cur.execute("""
        SELECT grams_co2
        FROM fluids_weights
        WHERE vehicle_type = %s
    """, (vehicle_type,))

    row = cur.fetchone()

    cur.close()

    if not row:
        return 0

    return row[0] / 1000  # convert g → kg


# =====================================
# GLIDER EMISSIONS
# =====================================

def glider_emissions(vehicle_type, conn):

    cur = conn.cursor()

    cur.execute("""
        SELECT kg_co2
        FROM glider_emissions
        WHERE vehicle_type = %s
        AND structure = 'conventional'
    """, (vehicle_type,))

    row = cur.fetchone()

    cur.close()

    if not row:
        raise ValueError(f"No glider emissions for {vehicle_type}")

    return row[0]


# =====================================
# TOTAL MANUFACTURING
# =====================================

def manufacturing_kg(vehicle):

    vehicle_type = vehicle.get("vehicle_type")

    if not vehicle_type:
        raise ValueError("vehicle_type missing")

    conn = get_connection()

    glider = glider_emissions(vehicle_type, conn)
    battery = battery_emissions(vehicle_type, conn)
    fluids = fluid_emissions(vehicle_type, conn)

    conn.close()

    total = glider + battery + fluids

    return total


# =====================================
# MANUFACTURING PER KM
# =====================================

def manufacturing_per_km(vehicle):

    total = manufacturing_kg(vehicle)

    return total / LIFETIME_KM