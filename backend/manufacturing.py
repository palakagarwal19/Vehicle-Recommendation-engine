import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data", "manufacturing")

LIFETIME_KM = 278_600

PT_MAP = {
    "ICE": "ICEV",
    "EV": "EV",
    "HEV": "HEV",
    "PHEV": "PHEV",
    "FCV": "FCV"
}
GREET_CHEMISTRY = {
    "ICEV": "LeadAcid",
    "HEV": "NiMH",
    "PHEV": "LiIon",
    "EV": "LiIon",
    "FCV": "NiMH"
}


def load_json(name):
    with open(os.path.join(DATA_DIR, name), "r") as f:
        return json.load(f)


glider = load_json("glider.json")
battery = load_json("battery_weights.json")
fluids = load_json("fluids_weights.json")
ef = load_json("emission_factors.json")

LB_TO_KG = 0.453592


# ----------------------------
# Battery emissions
# ----------------------------
def battery_emissions(pt):
    if pt not in battery:
        return 0

    chem = GREET_CHEMISTRY.get(pt)
    if chem is None:
        return 0

    lb = battery[pt]["conventional"].get(chem, 0)

    kg = lb * LB_TO_KG
    return kg * ef["battery"][chem]

# ----------------------------
# Fluid emissions
# ----------------------------
def fluid_emissions(pt):
    return fluids[pt] / 1000
# ----------------------------
# Manufacturing per vehicle
# ----------------------------
def manufacturing_kg(vehicle):

    raw_pt = vehicle.get("type")
    pt = PT_MAP.get(raw_pt)

    if pt is None or pt not in glider:
        raise ValueError(f"Manufacturing data not found for powertrain: {raw_pt}")

    glider_kg = glider[pt]["conventional"]

    batt_kg = battery_emissions(pt)
    fluid_kg = fluid_emissions(pt)
    print("Glider kg:", glider_kg)
    print("Battery kg:", batt_kg)
    print("Fluids kg:", fluid_kg)
    print("Total kg:", glider_kg + batt_kg + fluid_kg)
    return glider_kg + batt_kg + fluid_kg

def manufacturing_per_km(vehicle):
    return manufacturing_kg(vehicle) / LIFETIME_KM