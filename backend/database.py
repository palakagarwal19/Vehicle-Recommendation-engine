import json
from sqlalchemy import create_engine, text
import dotenv
import os
import pandas as pd

dotenv.load_dotenv()

DB_URL = dotenv.get_key(".env", "DB_URI")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(BASE_DIR, "..", "data")

engine = create_engine(DB_URL)

df = pd.read_csv(f"{BASE}/raw/vehicles.csv",low_memory=False)

with engine.begin() as conn:

    for _, row in df.iterrows():

        brand = row["make"]
        model = row["model"]
        year = row["year"]

        fuel_type = row["fuelType1"]

        engine_cc = None
        if pd.notnull(row["displ"]):
            engine_cc = row["displ"] * 1000

        fuel_l_per_100km = None
        if pd.notnull(row["comb08"]):
            fuel_l_per_100km = 235.215 / row["comb08"]

        co2 = None
        if pd.notnull(row["co2TailpipeGpm"]):
            co2 = row["co2TailpipeGpm"] / 1.609

        conn.execute(text("""
            UPDATE vehicles
            SET
                fuel_type = :fuel,
                engine_cc = :engine,
                fuel_l_per_100km = :fuel_l,
                co2_wltp_gpkm = :co2
            WHERE brand ILIKE :brand
            AND model ILIKE :model
            AND year = :year
        """), {
            "brand": brand,
            "model": model,
            "year": int(year),
            "fuel": fuel_type,
            "engine": engine_cc,
            "fuel_l": fuel_l_per_100km,
            "co2": co2
        })