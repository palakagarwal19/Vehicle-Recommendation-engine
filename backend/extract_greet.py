import os
import pandas as pd
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

DATA_PATH = os.path.join(PROJECT_ROOT, "data", "raw", "R&D GREET2_2025.xlsm")
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "data", "greet_master.json")

LIFETIME_KM = 200_000

df = pd.read_excel(DATA_PATH, sheet_name="Vehi_Sum")

master = {}
df = pd.read_excel(DATA_PATH, sheet_name="TEC_Results")



df = pd.read_excel(DATA_PATH, sheet_name="Vehi_Comp_Sum")
df = pd.read_excel(DATA_PATH, sheet_name="Mat_Sum")

for i in range(0, 80):
    print(i, "=>", df.iloc[i,0])
    
with open(OUTPUT_PATH, "w") as f:
    json.dump(master, f, indent=2)

print("✅ GREET manufacturing JSON generated successfully")