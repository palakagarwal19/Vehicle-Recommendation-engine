import json
import os

from database import get_db_connection


# -----------------------------
# DATABASE CONNECTION
# -----------------------------

conn = get_db_connection()
cur= conn.cursor()



# -------------------------
# BATTERY WEIGHTS
# -------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR,"..", "..", "data", "manufacturing")
with open(f"{DATA_DIR}/battery_weights.json") as f:
    data = json.load(f)

for pt, structures in data.items():
    for structure, chems in structures.items():
        for chem, value in chems.items():
            cur.execute("""
                INSERT INTO battery_weights
                VALUES (%s,%s,%s,%s)
            """, (pt, structure, chem, value))

# -------------------------
# EMISSION FACTORS
# -------------------------

with open(f"{DATA_DIR}/emission_factors.json") as f:
    data = json.load(f)

for chem, value in data["battery"].items():
    cur.execute("""
        INSERT INTO battery_emission_factors
        VALUES (%s,%s)
    """, (chem, value))

# -------------------------
# FLUID WEIGHTS
# -------------------------

with open(f"{DATA_DIR}/fluids_weights.json") as f:
    data = json.load(f)

for pt, value in data.items():
    cur.execute("""
        INSERT INTO fluids_weights
        VALUES (%s,%s)
    """, (pt, value))

# -------------------------
# GLIDER EMISSIONS
# -------------------------

with open(f"{DATA_DIR}/glider.json") as f:
    data = json.load(f)

for pt, structures in data.items():
    for structure, value in structures.items():
        cur.execute("""
            INSERT INTO glider_emissions
            VALUES (%s,%s,%s)
        """, (pt, structure, value))

conn.commit()
cur.close()
conn.close()