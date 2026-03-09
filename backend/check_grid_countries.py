#!/usr/bin/env python3
"""
Check which countries have grid data for 2023 (PostgreSQL version)
"""

import psycopg2
import os
import dotenv

dotenv.load_dotenv()

DB_URL = os.getenv("DB_URI")


def get_connection():
    return psycopg2.connect(DB_URL)


conn = get_connection()
cur = conn.cursor()

cur.execute("""
    SELECT DISTINCT country_code
    FROM grid_intensity
    WHERE year = 2023
    AND carbon_intensity_gco2_per_kwh IS NOT NULL
""")

rows = cur.fetchall()

countries_with_2023 = sorted([r[0] for r in rows])

cur.close()
conn.close()


print("Countries with 2023 grid data:")
print("=" * 60)

print(f"Total countries with valid 2023 data: {len(countries_with_2023)}")

print("\nFirst 50 countries:")
for country in countries_with_2023[:50]:
    print(f"  {country}")


print("\nCommon countries:")

common = ['USA','DEU','FRA','GBR','CHN','JPN','IND','CAN','AUS','BRA']

for country in common:
    if country in countries_with_2023:
        print(f"  ✓ {country} - Available")
    else:
        print(f"  ✗ {country} - NOT available")