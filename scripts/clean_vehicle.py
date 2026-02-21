import pandas as pd

# Load raw dataset
df = pd.read_csv("../data/raw/vehicles.csv")

required_cols = [
    "make", "model", "year", "fuelType",
    "city08", "highway08", "comb08",
    "combE", "co2TailpipeGpm",
    "trany", "VClass"
]

df = df[required_cols]

# MPG → L/100km
df["comb_l_per_100km"] = 235.215 / df["comb08"]

# kWh/100 miles → kWh/100km
df["elec_kwh_per_100km"] = df["combE"] * 0.621371

df.to_csv("../data/processed/vehicles_clean.csv", index=False)

print("✅ Clean dataset saved successfully")