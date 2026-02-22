import os
import pandas as pd
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

RAW_PATH = os.path.join(BASE_DIR, "..", "data", "raw", "vehicles.csv")
OUTPUT_PATH = os.path.join(BASE_DIR, "..", "data", "eu_vehicles_master.json")


def clean_dataset():
    df = pd.read_csv(RAW_PATH, low_memory=False)

    # Keep only useful columns
    df = df[[
        "make",
        "model",
        "year",
        "fuelType",
        "co2"
    ]]

    # Drop rows where CO2 is missing
    df = df.dropna(subset=["co2"])

    # Rename columns to match your engine expectations
    df = df.rename(columns={
        "make": "brand",
        "year": "Year",
        "fuelType": "fuel_type",
        "co2": "co2_wltp_gpkm"
    })

    # Add missing lifecycle columns
    df["mass_kg"] = 1500  # average vehicle mass assumption
    df["electric_wh_per_km"] = None

    # Classify vehicle type
    def classify(row):
        if "Electric" in str(row["fuel_type"]):
            return "BEV"
        else:
            return "ICE"

    df["type"] = df.apply(classify, axis=1)

    # Convert NaN to None for JSON compatibility
    df = df.where(pd.notnull(df), None)

    vehicles = df.to_dict(orient="records")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(vehicles, f, indent=2)

    print(f"Generated {len(vehicles)} vehicles successfully!")


if __name__ == "__main__":
    clean_dataset()