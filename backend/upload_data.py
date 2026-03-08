import pandas as pd
import os
import dotenv
from sqlalchemy import create_engine, text

dotenv.load_dotenv()

DB_URL = os.getenv("DB_URI")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(BASE_DIR, "..", "data")

engine = create_engine(DB_URL)

df = pd.read_csv(f"{BASE}/raw/vehicles.csv",low_memory=False)

print("Loading EPA dataset...")

# -----------------------------
# Vehicle classification
# -----------------------------
def classify_vehicle(row):

    # Battery Electric Vehicle
    if row["fuelType1"] == "Electricity":
        return "BEV"

    # Plug-in Hybrid
    elif row["phevBlended"] == True:
        return "PHEV"

    # Hybrid Electric (gasoline + electricity)
    elif row["fuelType2"] == "Electricity":
        return "HEV"

    # Fallback for older EPA hybrid records
    elif "Hybrid" in str(row["eng_dscr"]):
        return "HEV"

    # Regular combustion
    else:
        return "ICE"


df["vehicle_type"] = df.apply(classify_vehicle, axis=1)

# -----------------------------
# Basic fields
# -----------------------------

df["brand"] = df["make"]
df["fuel_type"] = df["fuelType1"]
df["vehicle_class"] = df["VClass"]

# -----------------------------
# Engine displacement
# -----------------------------

df["engine_cc"] = df["displ"] * 1000

# -----------------------------
# Cylinders
# -----------------------------

df["cylinders"] = df["cylinders"]

# -----------------------------
# Power estimation
# -----------------------------

df["power_kw"] = df["displ"] * 55
df["power_hp"] = df["power_kw"] * 1.341

# -----------------------------
# Fuel consumption
# MPG → L/100km
# -----------------------------

df["fuel_l_per_100km"] = 235.215 / df["comb08"]

# -----------------------------
# Electric consumption
# Wh/mi → Wh/km
# -----------------------------

df["electric_wh_per_km"] = df["combE"] / 1.609

# -----------------------------
# CO2
# g/mile → g/km
# -----------------------------

df["co2_wltp_gpkm"] = df["co2TailpipeGpm"] / 1.609

# -----------------------------
# EV fixes
# -----------------------------

df.loc[df["vehicle_type"] == "BEV", "engine_cc"] = None
df.loc[df["vehicle_type"] == "BEV", "fuel_l_per_100km"] = None
df.loc[df["vehicle_type"] == "BEV", "co2_wltp_gpkm"] = 0

# -----------------------------
# Select final columns
# -----------------------------

df = df[
[
"brand",
"model",
"year",
"vehicle_type",
"fuel_type",
"engine_cc",
"cylinders",
"power_kw",
"power_hp",
"fuel_l_per_100km",
"electric_wh_per_km",
"co2_wltp_gpkm",
"vehicle_class"
]
]

df = df.dropna(subset=["brand","model","year"])

print("Uploading vehicles to database...")

df.to_sql(
    "vehicles",
    engine,
    if_exists="append",
    index=False,
    method="multi",
    chunksize=5000
)

print("Vehicle database built successfully.")