import pandas as pd
import re

# load dataset
import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

file_path = os.path.join(
    BASE_DIR,
    "data",
    "raw",
    "cars_ds_final_2021.csv"
)

df = pd.read_csv(file_path)

print(df.head())

# select useful columns
cols_needed = [
    "Make",
    "Model",
    "Variant",
    "Ex-Showroom_Price",
    "Fuel_Type",
    "Displacement",
    "Kerb_Weight",
    "ARAI_Certified_Mileage",
    "Body_Type"
]

df = df[cols_needed]

# rename columns
df.columns = [
    "brand",
    "model",
    "variant",
    "price_inr",
    "fuel_type",
    "engine_cc",
    "kerb_weight_kg",
    "arai_mileage",
    "body_type"
]

# clean price (remove Rs., commas)
df["price_inr"] = df["price_inr"].astype(str)
df["price_inr"] = df["price_inr"].str.replace("Rs.", "", regex=False)
df["price_inr"] = df["price_inr"].str.replace(",", "")
df["price_inr"] = pd.to_numeric(df["price_inr"], errors="coerce")

# clean engine displacement
df["engine_cc"] = df["engine_cc"].astype(str)
df["engine_cc"] = df["engine_cc"].str.replace(" cc", "", regex=False)
df["engine_cc"] = pd.to_numeric(df["engine_cc"], errors="coerce")

# clean kerb weight
df["kerb_weight_kg"] = df["kerb_weight_kg"].astype(str)
df["kerb_weight_kg"] = df["kerb_weight_kg"].str.replace(" kg", "", regex=False)
df["kerb_weight_kg"] = pd.to_numeric(df["kerb_weight_kg"], errors="coerce")

# clean mileage
df["arai_mileage"] = df["arai_mileage"].astype(str)
df["arai_mileage"] = df["arai_mileage"].str.extract(r'(\d+\.?\d*)')
df["arai_mileage"] = pd.to_numeric(df["arai_mileage"], errors="coerce")

# standardize fuel types
df["fuel_type"] = df["fuel_type"].str.lower()
df["fuel_type"] = df["fuel_type"].replace({
    "petrol": "gasoline",
    "diesel": "diesel",
    "cng": "cng"
})

# drop rows without mileage
df = df.dropna(subset=["arai_mileage"])

# remove duplicates
df = df.drop_duplicates()

# save cleaned dataset
output_path = os.path.join(BASE_DIR, "data", "vehicles_india_clean.json")

os.makedirs(os.path.dirname(output_path), exist_ok=True)

df.to_json(output_path, orient="records", indent=2)
print("Dataset cleaned and saved.")
print(df.head())