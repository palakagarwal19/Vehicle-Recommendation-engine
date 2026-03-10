import psycopg2
import os
import dotenv

dotenv.load_dotenv()

LIFETIME_KM = 278_600
LB_TO_KG    = 0.453592

# ── GREET2 battery recycling (1,470,620 g/ton = 1.4706 kg CO2/kg battery) ───
BATTERY_RECYCLING_FACTOR = 1.4706  # kg CO2 per kg battery

# ── ELV material flow midpoints (from ELV recycling studies) ─────────────────
DISMANTLED_RATIO     = 0.625  # 55–70% of vehicle mass after dismantling
METAL_RECOVERY_RATIO = 0.53   # 36–70% metals recovered
ASR_RATIO            = 0.22   # 12–32% shredder residue (ASR)

# ── EoL scope: ICEV/HEV/FCV = 0 per GREET (metal credits offset dismantling)
# ── HEV/EV/PHEV battery recycling uses BATTERY_RECYCLING_FACTOR
EOL_ZERO_TYPES = {"ICEV", "HEV", "FCV"}


def get_connection():
    return psycopg2.connect(os.getenv("DB_URI"))


NORM = {
    "ICE": "ICEV", "BEV": "EV", "EV": "EV",
    "HEV": "HEV",  "PHEV": "PHEV", "FCV": "FCV",
}

def normalise(v): return NORM.get(v, v)


CHEMISTRY_MAP = {
    "ICEV": "LeadAcid",
    "HEV":  "NiMH",
    "PHEV": "LiIon",
    "EV":   "LiIon",
    "FCV":  "NiMH",
}


def _battery_weight_kg_from_db(vtype_norm, conn, structure="conventional"):
    chemistry = CHEMISTRY_MAP.get(vtype_norm)
    if not chemistry:
        return None
    cur = conn.cursor()
    cur.execute("""
        SELECT weight_lb FROM battery_weights
        WHERE vehicle_type=%s AND chemistry=%s AND structure=%s
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
        WHERE vehicle_type=%s AND chemistry=%s AND structure='conventional'
    """, (vtype, chemistry))
    w = cur.fetchone()
    if not w:
        cur.close(); return 0
    weight_kg = w[0] * LB_TO_KG
    cur.execute("SELECT kg_co2_per_kg FROM battery_emission_factors WHERE chemistry=%s", (chemistry,))
    f = cur.fetchone()
    cur.close()
    return (weight_kg * f[0]) if f else 0


def fluid_emissions(vehicle_type, conn):
    vtype = normalise(vehicle_type)
    cur   = conn.cursor()
    cur.execute("SELECT grams_co2 FROM fluids_weights WHERE vehicle_type=%s", (vtype,))
    row = cur.fetchone()
    cur.close()
    return (row[0] / 1000) if row else 0


def glider_emissions(vehicle_type, conn):
    vtype = normalise(vehicle_type)
    cur   = conn.cursor()
    cur.execute("""
        SELECT kg_co2 FROM glider_emissions
        WHERE vehicle_type=%s AND structure='conventional'
    """, (vtype,))
    row = cur.fetchone()
    cur.close()
    if not row:
        raise ValueError(f"No glider emissions for vehicle_type='{vehicle_type}' (looked up as '{vtype}')")
    return row[0]


def battery_recycling_emissions(vehicle, conn, method=None):
    """
    E_EOL = battery_weight_kg × 1.4706 kg CO2/kg  (GREET2)

    Applies to: EV, PHEV  (Li-ion pack)
    Zero for:   ICEV, HEV, FCV  — GREET: metal recycling credits offset all dismantling/shredding

    Battery weight:
      1. vehicles.battery_weight_kg  (if > 0)
      2. battery_weights table (GREET standard)
         EV   LiIon conventional = 938.3 lb = 425.7 kg  → 625.6 kg CO2
         PHEV LiIon conventional = 226.2 lb = 102.6 kg  → 150.9 kg CO2
    """
    ntype = normalise(vehicle.get("vehicle_type", ""))

    if ntype in EOL_ZERO_TYPES:
        return 0

    battery_weight_kg = vehicle.get("battery_weight_kg") or 0
    if battery_weight_kg <= 0:
        battery_weight_kg = _battery_weight_kg_from_db(ntype, conn) or 0

    if battery_weight_kg <= 0:
        return 0

    return battery_weight_kg * BATTERY_RECYCLING_FACTOR


def recycling_material_flow(vehicle_weight_kg):
    """
    ELV mass-balance (midpoints from ELV recycling studies):
      dismantled_mass = vehicle_weight × 0.625
      metal_recovered = vehicle_weight × 0.53
      asr_waste       = vehicle_weight × 0.22
    """
    if not vehicle_weight_kg or vehicle_weight_kg <= 0:
        raise ValueError("vehicle_weight_kg required for ELV material flow")
    w = float(vehicle_weight_kg)
    return {
        "dismantled_mass_kg": round(w * DISMANTLED_RATIO, 1),
        "metal_recovered_kg": round(w * METAL_RECOVERY_RATIO, 1),
        "asr_waste_kg":       round(w * ASR_RATIO, 1),
    }


def manufacturing_kg(vehicle):
    vehicle_type = vehicle.get("vehicle_type")
    if not vehicle_type:
        raise ValueError("vehicle_type missing")
    conn   = get_connection()
    result = glider_emissions(vehicle_type, conn) + battery_emissions(vehicle_type, conn) + fluid_emissions(vehicle_type, conn)
    conn.close()
    return result


def manufacturing_per_km(vehicle):
    return manufacturing_kg(vehicle) / LIFETIME_KM


def recycling_kg(vehicle, method=None):
    conn   = get_connection()
    result = battery_recycling_emissions(vehicle, conn)
    conn.close()
    return result