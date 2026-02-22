import pandas as pd
import json

with open("../data/raw/eu_wltp_raw.json", "r", encoding="utf-8") as f:
    data = json.load(f)

df = pd.DataFrame(data["results"])

required_cols = [
    "Mk",
    "Cn",
    "Year",
    "Ft",
    "M (kg)",
    "Ewltp (g/km)",
    "Z (Wh/km)"
]

df = df[[col for col in required_cols if col in df.columns]]

df = df.rename(columns={
    "Mk": "brand",
    "Cn": "model",
    "Ft": "fuel_type",
    "M (kg)": "mass_kg",
    "Ewltp (g/km)": "co2_wltp_gpkm",
    "Z (Wh/km)": "electric_wh_per_km"
})

def classify_vehicle(fuel):
    fuel = str(fuel).lower()
    if "electric" in fuel and "petrol" not in fuel and "diesel" not in fuel:
        return "BEV"
    elif "electric" in fuel:
        return "Hybrid"
    else:
        return "ICE"

df["type"] = df["fuel_type"].apply(classify_vehicle)

df = df[df["co2_wltp_gpkm"].notna()]
df = df.drop_duplicates(subset=["brand", "model", "Year", "type"])

df.to_json("../backend/data/eu_vehicles_master.json", orient="records", indent=4)

print("✅ EU dataset cleaned successfully")