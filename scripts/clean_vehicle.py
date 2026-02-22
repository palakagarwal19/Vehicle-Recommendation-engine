import os
import pandas as pd

# Load raw dataset
df = pd.read_csv("../data/raw/yearly_full_release_long_format.csv")

# Keep required columns
required_cols = [
    "make", "model", "year", "fuelType",
    "comb08", "combE"
]

df = df[required_cols]

# -----------------------------
# Convert MPG → L/100km
# -----------------------------
df["comb_l_per_100km"] = 235.215 / df["comb08"]

# -----------------------------
# Convert kWh/100 miles → kWh/100km
# -----------------------------
df["elec_kwh_per_100km"] = df["combE"] * 0.621371

# -----------------------------
# Add vehicle type
# -----------------------------
df["type"] = df["fuelType"].apply(
    lambda x: "BEV" if "Electric" in str(x) else "ICE"
)

# -----------------------------
# Standardize column names
# -----------------------------
df = df.rename(columns={
    "make": "brand"
})

# -----------------------------
# Add lifecycle fields
# -----------------------------
df["fuel_consumption"] = df["comb_l_per_100km"]
df["electric_consumption"] = df["elec_kwh_per_100km"]
df["mass_kg"] = 1500  # placeholder

# -----------------------------
# Final dataset columns
# -----------------------------
final_cols = [
    "brand",
    "model",
    "year",
    "type",
    "fuel_consumption",
    "electric_consumption",
    "mass_kg"
]

df = df[final_cols]

# Remove duplicates
df = df.drop_duplicates(subset=["brand", "model", "year", "type"])

# -----------------------------
# Save JSON
# -----------------------------
os.makedirs("../backend/data", exist_ok=True)

df.to_json(
    "../backend/data/vehicles_master.json",
    orient="records",
    indent=4
)

print("✅ Clean dataset saved successfully")