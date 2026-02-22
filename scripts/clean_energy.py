import pandas as pd

# Load energy dataset CSV
df = pd.read_csv("../data/raw/energy_dataset.csv")

# ---- Total power sector emissions ----
emissions = df[
    (df["Category"] == "Power sector emissions") &
    (df["Subcategory"] == "Total") &
    (df["Unit"] == "mtCO2")
]

emissions = emissions[["Area", "ISO 3 code", "Year", "Value"]]

emissions = emissions.rename(columns={
    "Area": "country",
    "ISO 3 code": "iso3",
    "Value": "total_power_emissions_mtco2"
})

emissions.to_json(
    "../backend/data/energy_master.json",
    orient="records",
    indent=4
)

print("Energy dataset cleaned successfully")


# ---- Grid CO2 intensity ----
intensity = df[
    (df["Category"] == "Power sector emissions") &
    (df["Subcategory"] == "CO2 intensity") &
    (df["Unit"] == "gCO2/kWh")
]

intensity = intensity[["Area", "ISO 3 code", "Year", "Value"]]

intensity = intensity.rename(columns={
    "Area": "country",
    "ISO 3 code": "iso3",
    "Value": "grid_intensity_gpkwh"
})

intensity.to_json(
    "../backend/data/grid_intensity.json",
    orient="records",
    indent=4
)

print("Grid intensity cleaned successfully")