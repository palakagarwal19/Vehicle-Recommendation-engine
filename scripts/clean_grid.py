import pandas as pd
import json
# =====================================================
# LOAD EMBER GRID DATA
# =====================================================

df_grid = pd.read_csv("data/raw/yearly_full_release_long_format (1).csv")

# Step 1: Find rows where unit is gCO2/kWh
intensity_rows = df_grid[df_grid["Unit"] == "gCO2/kWh"]

print("Available intensity definitions:")
print(intensity_rows[["Category","Subcategory","Variable"]].drop_duplicates())

# Use ONLY unit filter (do NOT filter by category/variable yet)
df_grid = intensity_rows.copy()

# Rename columns
df_grid = df_grid.rename(columns={
    "Area": "country",
    "ISO 3 code": "iso3",
    "Year": "year",
    "Value": "grid_intensity_gpkwh"
})

df_grid = df_grid[["country", "iso3", "year", "grid_intensity_gpkwh"]]

df_grid = df_grid[df_grid["iso3"].notna()]
df_grid = df_grid[df_grid["iso3"].str.len() == 3]

print("Ember cleaned shape:", df_grid.shape)
# =====================================================
# 2️⃣ LOAD & CLEAN WORLD BANK T&D LOSS
# =====================================================

wb_path = "data/raw/API_EG.ELC.LOSS.ZS_DS2_en_csv_v2_5973.csv"
df_td = pd.read_csv(wb_path, skiprows=4)

# Keep only real countries
df_td = df_td[df_td["Country Code"].str.len() == 3]

# Identify year columns
year_cols = [col for col in df_td.columns if col.isdigit()]

df_td = df_td[["Country Name", "Country Code"] + year_cols]

# Wide → Long
df_td = df_td.melt(
    id_vars=["Country Name", "Country Code"],
    var_name="year",
    value_name="td_loss_percent"
)

# Clean
df_td = df_td.dropna()
df_td["year"] = df_td["year"].astype(int)
df_td["td_loss_percent"] = pd.to_numeric(df_td["td_loss_percent"])

# Convert % → decimal
df_td["td_loss"] = df_td["td_loss_percent"] / 100

df_td = df_td.rename(columns={
    "Country Name": "country",
    "Country Code": "iso3"
})

df_td = df_td[["country", "iso3", "year", "td_loss"]]

print("T&D cleaned shape:", df_td.shape)

# =====================================================
# 3️⃣ MERGE
# =====================================================

df_merged = df_grid.merge(
    df_td,
    on=["iso3", "year"],
    how="left"
)

# =====================================================
# 4️⃣ HANDLE MISSING T&D
# =====================================================

df_merged["td_loss"] = (
    df_merged.groupby("iso3")["td_loss"]
    .ffill()
)

# Use 8% fallback if completely missing
df_merged["td_loss"] = df_merged["td_loss"].fillna(0.08)

# =====================================================
# 5️⃣ COMPUTE CORRECTED GRID INTENSITY
# =====================================================

df_merged["grid_corrected_gpkwh"] = (
    df_merged["grid_intensity_gpkwh"] /
    (1 - df_merged["td_loss"])
)

# Round
df_merged["grid_intensity_gpkwh"] = df_merged["grid_intensity_gpkwh"].round(2)
df_merged["td_loss"] = df_merged["td_loss"].round(4)
df_merged["grid_corrected_gpkwh"] = df_merged["grid_corrected_gpkwh"].round(2)

# =====================================================
# 6️⃣ VALIDATION SAMPLE
# =====================================================

print("\nValidation Sample:")
print(
    df_merged[df_merged["iso3"].isin(["ALB", "IND", "DEU", "DZA"])]
    .sort_values(["iso3", "year"])
    .tail(8)
)

# =====================================================
# 7️⃣ EXPORT JSON (PRODUCTION FORMAT)
# =====================================================

grid_dict = {}

for _, row in df_merged.iterrows():
    iso = row["iso3"]
    year = str(int(row["year"]))

    if iso not in grid_dict:
        grid_dict[iso] = {}

    grid_dict[iso][year] = {
        "raw": float(row["grid_intensity_gpkwh"]),
        "td_loss": float(row["td_loss"]),
        "corrected": float(row["grid_corrected_gpkwh"])
    }

with open("grid_master_v2_2026.json", "w") as f:
    json.dump(grid_dict, f, indent=2)

print("\n✅ grid_master_v2_2026.json created successfully.")