import json
from manufacturing import manufacturing_kg
from manufacturing import LIFETIME_KM

# ---------------------------------
# Official GREET Manufacturing Totals (grams per vehicle lifetime)
# From Summary Section 3
# ---------------------------------
GREET_OFFICIAL = {
    "ICE": 4826550 + 31451 + 19308,      # glider + battery + fluids
    "HEV": 4994420 + 336804 + 19308,
    "PHEV": 4968210 + 1195019 + 19308,
    "EV": 4565440 + 4892083 + 19308,
    "FCV": 6054580 + 527302 + 19308
}

THRESHOLD_PERCENT = 1.0


def percent_error(model, official):
    return abs(model - official) / official * 100


def validate():
    print("\n===== CarbonWise Manufacturing Validation =====\n")

    for pt in GREET_OFFICIAL.keys():

        vehicle = {"type": pt}

        model_kg = manufacturing_kg(vehicle)
        model_g = model_kg * 1000

        official_g = GREET_OFFICIAL[pt]

        error = percent_error(model_g, official_g)

        status = "PASS" if error <= THRESHOLD_PERCENT else "FAIL"

        print(f"Powertrain: {pt}")
        print(f"  Model Lifetime (g):    {model_g:,.0f}")
        print(f"  GREET Official (g):    {official_g:,.0f}")
        print(f"  Percent Error:         {error:.3f}%")
        print(f"  Status:                {status}")
        print("-" * 50)


if __name__ == "__main__":
    validate()