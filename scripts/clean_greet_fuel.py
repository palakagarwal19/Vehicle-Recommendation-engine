import pandas as pd
import json
import os

# ============================================
# CONFIG
# ============================================

GREET_FILE = "data/raw/greet_fuel.xlsx"
SHEET_NAME = 0   # change if needed

MILE_TO_KM = 1.60934  # exact SI conversion

# Passenger vehicle columns to extract
TARGET_COLUMNS = {
    "gasoline_ice": "Baseline Gasoline Vehicle: Gasoline",
    "diesel_ice": "CIDI Vehicle: Conventional and LS Diesel",
    "ev_us_grid": "Electric Vehicle, w/ charger",
    "hev_gasoline": "Grid-Independent SI HEV: Gasoline",
    "phev_gasoline_cd": "Grid-Connected SI PHEV: Gasoline, CD Combined",
    "phev_gasoline_cs": "Grid-Connected SI PHEV: Gasoline, CS Mode"
}

# ============================================
# LOAD GREET
# ============================================

print("Loading GREET1...")

df = pd.read_excel(
    GREET_FILE,
    sheet_name=SHEET_NAME,
    header=None,
    engine="openpyxl"
)

# ============================================
# FIND HEADER ROW (vehicle columns row)
# ============================================

header_row_index = None

for i in range(len(df)):
    row_values = df.iloc[i].astype(str).values
    if any("Baseline Gasoline Vehicle" in str(v) for v in row_values):
        header_row_index = i
        break

if header_row_index is None:
    raise Exception("Vehicle header row not found")

print(f"Vehicle header row found at: {header_row_index}")

df.columns = df.iloc[header_row_index]
df = df[header_row_index + 1:].reset_index(drop=True)

# ============================================
# FIND GHGs ROW
# ============================================

ghg_row = df[df.iloc[:, 0].astype(str).str.contains("GHGs", na=False)]

if ghg_row.empty:
    raise Exception("GHGs row not found")

ghg_row = ghg_row.iloc[0]

# ============================================
# EXTRACT VALUES
# ============================================

results = {}

for key, column_name in TARGET_COLUMNS.items():

    if column_name not in df.columns:
        print(f"Column not found: {column_name}")
        continue

    g_per_mile = float(ghg_row[column_name])
    g_per_km = g_per_mile / MILE_TO_KM

    results[key] = round(g_per_km, 4)

# ============================================
# EXPORT JSON
# ============================================

with open("greet_passenger_wtw.json", "w") as f:
    json.dump(results, f, indent=2)

print("\nExtraction Complete.")
print(json.dumps(results, indent=2))
print("\nSaved as greet_passenger_wtw.json")