#!/usr/bin/env python3
"""
Check which countries have grid data for 2023
"""

import json
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
grid_path = os.path.join(base_dir, "..", "data", "grid_master_v2_2026_clean.json")

with open(grid_path, 'r') as f:
    grid_data = json.load(f)

print("Countries with 2023 grid data:")
print("=" * 60)

countries_with_2023 = []
for country, years in grid_data.items():
    if '2023' in years:
        data = years['2023']
        if data.get('corrected') is not None:
            countries_with_2023.append(country)

print(f"Total countries with valid 2023 data: {len(countries_with_2023)}")
print("\nFirst 50 countries:")
for country in sorted(countries_with_2023)[:50]:
    print(f"  {country}")

print("\nCommon countries:")
common = ['US', 'DE', 'FR', 'UK', 'CN', 'JP', 'IN', 'CA', 'AU', 'BR']
for country in common:
    if country in countries_with_2023:
        print(f"  ✓ {country} - Available")
    else:
        print(f"  ✗ {country} - NOT available")
