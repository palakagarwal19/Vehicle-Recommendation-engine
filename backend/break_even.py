from engine import calculate_lifecycle
from manufacturing import manufacturing_kg

LIFETIME_KM = 278_600

# All powertrain types the engine supports
VALID_TYPES = {"EV", "BEV", "HEV", "PHEV", "ICE"}

# Types that need grid/country to calculate operational emissions
GRID_DEPENDENT = {"EV", "BEV", "PHEV"}


def break_even_km(vehicle_a, vehicle_b, country, year):
    """
    Generic break-even between any two powertrains (EV, BEV, HEV, PHEV, ICE).
    vehicle_a is the 'cleaner' candidate; vehicle_b is the baseline.
    Direction is determined automatically from operational emissions.
    """
    type_a = vehicle_a.get("vehicle_type", "")
    type_b = vehicle_b.get("vehicle_type", "")
    if type_a not in VALID_TYPES:
        return {"error": f"Vehicle A has unsupported vehicle_type '{type_a}'"}
    if type_b not in VALID_TYPES:
        return {"error": f"Vehicle B has unsupported vehicle_type '{type_b}'"}

    # EVs and PHEVs need electric_wh_per_km
    if type_a in GRID_DEPENDENT and vehicle_a.get("electric_wh_per_km") is None:
        return {"error": f"Vehicle A ({vehicle_a.get('model')}) is missing electric_wh_per_km"}
    if type_b in GRID_DEPENDENT and vehicle_b.get("electric_wh_per_km") is None:
        return {"error": f"Vehicle B ({vehicle_b.get('model')}) is missing electric_wh_per_km"}

    lc_a = calculate_lifecycle(vehicle_a, country, year)
    lc_b = calculate_lifecycle(vehicle_b, country, year)

    if "error" in lc_a:
        return {"error": f"Vehicle A lifecycle failed: {lc_a['error']}"}
    if "error" in lc_b:
        return {"error": f"Vehicle B lifecycle failed: {lc_b['error']}"}

    try:
        manuf_a_kg = manufacturing_kg(vehicle_a)
        manuf_b_kg = manufacturing_kg(vehicle_b)
    except ValueError as e:
        return {"error": f"Manufacturing calculation failed: {str(e)}"}

    op_a = lc_a["operational_g_per_km"]
    op_b = lc_b["operational_g_per_km"]

    manuf_a_g = manuf_a_kg * 1000
    manuf_b_g = manuf_b_kg * 1000

    # delta > 0 means A has higher manufacturing cost (typical for EV vs ICE)
    # delta_op > 0 means B has higher operational cost (A is cleaner to run)
    delta_manuf = manuf_a_g - manuf_b_g
    delta_op    = op_b - op_a

    print(f"Break-even calculation:")
    print(f"  A ({type_a}): manuf={manuf_a_kg:.1f} kg, op={op_a:.2f} g/km")
    print(f"  B ({type_b}): manuf={manuf_b_kg:.1f} kg, op={op_b:.2f} g/km")
    print(f"  Δ manuf={delta_manuf:.0f} g  Δ op={delta_op:.2f} g/km")

    base = {
        "a_brand":                   vehicle_a.get("brand", ""),
        "a_model":                   vehicle_a.get("model", ""),
        "a_year":                    vehicle_a.get("year"),
        "a_vehicle_type":            type_a,
        "a_manufacturing_total_kg":  round(manuf_a_kg, 2),
        "a_manufacturing_g_per_km":  lc_a["manufacturing_g_per_km"],
        "a_operational_g_per_km":    op_a,
        "a_total_g_per_km":          lc_a["total_g_per_km"],
        "b_brand":                   vehicle_b.get("brand", ""),
        "b_model":                   vehicle_b.get("model", ""),
        "b_year":                    vehicle_b.get("year"),
        "b_vehicle_type":            type_b,
        "b_manufacturing_total_kg":  round(manuf_b_kg, 2),
        "b_manufacturing_g_per_km":  lc_b["manufacturing_g_per_km"],
        "b_operational_g_per_km":    op_b,
        "b_total_g_per_km":          lc_b["total_g_per_km"],
    }

    # A has no operational advantage over B
    if delta_op <= 0:
        return {
            **base,
            "break_even_km": None,
            "operational_advantage_g_per_km": round(delta_op, 2),
            "manufacturing_difference_g_per_km": round(delta_manuf / LIFETIME_KM, 2),
            "message": (
                f"{vehicle_a.get('brand')} {vehicle_a.get('model')} ({type_a}) does not have "
                f"lower operational emissions than {vehicle_b.get('brand')} {vehicle_b.get('model')} "
                f"({type_b}) on this grid — no break-even point exists."
            ),
        }

    # A has higher manufacturing cost AND lower operational — classic break-even
    if delta_manuf > 0:
        km = delta_manuf / delta_op
        print(f"  Break-even: {km:.0f} km")
        return {
            **base,
            "break_even_km": round(km, 0),
            "operational_advantage_g_per_km":    round(delta_op, 2),
            "manufacturing_difference_g_per_km": round(delta_manuf / LIFETIME_KM, 2),
        }

    # A has LOWER manufacturing AND lower operational — already ahead from km 0
    return {
        **base,
        "break_even_km": 0,
        "operational_advantage_g_per_km":    round(delta_op, 2),
        "manufacturing_difference_g_per_km": round(delta_manuf / LIFETIME_KM, 2),
        "message": (
            f"{vehicle_a.get('brand')} {vehicle_a.get('model')} ({type_a}) has lower emissions "
            f"in both manufacturing and operation — it wins from kilometre zero."
        ),
    }