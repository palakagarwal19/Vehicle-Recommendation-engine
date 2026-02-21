import json

def load(path):
    with open(path) as f:
        return json.load(f)

vehicles = load("data/vehicles.json")
materials = load("data/materials.json")
grid = load("data/grid.json")
factors = load("data/emission_factors.json")

# -----------------------
def manufacturing_emissions(vehicle):
    profile = materials[vehicle["type"]]
    total = 0

    for mat, frac in profile.items():
        mass = vehicle["curb_weight"] * frac
        total += mass * factors[mat]

    if vehicle["type"] == "BEV":
        total += vehicle["battery_capacity"] * factors["battery"]

    total += factors["assembly"]
    return total

# -----------------------
def usage_emissions(vehicle, daily_km, years, country):
    km_total = daily_km * 365 * years

    if vehicle["type"] == "ICE":
        liters = km_total * (vehicle["fuel_consumption"] / 100)
        return liters * factors["fuel"]
    else:
        kwh = km_total * (vehicle["electric_consumption"] / 100)
        return kwh * grid[country]

# -----------------------
def total_emissions(vehicle, daily_km, years, country):
    return (
        manufacturing_emissions(vehicle)
        + usage_emissions(vehicle, daily_km, years, country)
        + factors["eol"]
    )
# -----------------------
def break_even_km(bev, ice, country):
    bev_m = manufacturing_emissions(bev)
    ice_m = manufacturing_emissions(ice)

    bev_rate = (bev["electric_consumption"]/100) * grid[country]
    ice_rate = (ice["fuel_consumption"]/100) * factors["fuel"]

    return (ice_m - bev_m) / (bev_rate - ice_rate)