import os
import json
import pandas as pd

# -------------------------------
# Setup paths
# -------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

DATA_PATH = os.path.join(PROJECT_ROOT, "data", "raw","vehicles.csv")
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "data", "eu_vehicles_master.json")
print("Loading dataset...")

df = pd.read_csv(DATA_PATH, low_memory=False)

# -------------------------------
# Keep only needed columns
# -------------------------------
df = df[[
    "make",
    "model",
    "year",
    "co2TailpipeGpm",
    "combE",
    "fuelType1"
]]

# Convert numeric safely
df["co2TailpipeGpm"] = pd.to_numeric(df["co2TailpipeGpm"], errors="coerce")
df["combE"] = pd.to_numeric(df["combE"], errors="coerce")

# -------------------------------
# ICE Vehicles
# -------------------------------
ice = df[df["co2TailpipeGpm"] > 0].copy()

# Convert g/mile → g/km
ice["co2_wltp_gpkm"] = ice["co2TailpipeGpm"] / 1.60934
ice["electric_wh_per_km"] = None
ice["type"] = "ICE"

# -------------------------------
# EV Vehicles
# -------------------------------
ev = df[df["combE"] > 0].copy()

# Convert kWh/100mile → Wh/km
ev["electric_wh_per_km"] = (ev["combE"] * 1000) / (100 * 1.60934)
ev["co2_wltp_gpkm"] = None
ev["type"] = "EV"

# -------------------------------
# Merge ICE + EV
# -------------------------------
vehicles = pd.concat([ice, ev], ignore_index=True)

# -------------------------------
# Aggregate duplicates
# -------------------------------
vehicles = (
    vehicles
    .groupby(["make", "model", "year", "type"], as_index=False)
    .agg({
        "co2_wltp_gpkm": "mean",
        "electric_wh_per_km": "mean"
    })
)

# Round values
vehicles["co2_wltp_gpkm"] = vehicles["co2_wltp_gpkm"].round(2)
vehicles["electric_wh_per_km"] = vehicles["electric_wh_per_km"].round(2)

# Rename columns to match backend
vehicles = vehicles.rename(columns={
    "make": "brand",
    "year": "Year"
})

# -------------------------------
# Export JSON
# -------------------------------
vehicles.to_json(OUTPUT_PATH, orient="records", indent=2)

print("Done.")
print("Total vehicles exported:", len(vehicles))
print("Saved to:", OUTPUT_PATH)