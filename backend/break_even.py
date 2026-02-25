from engine import calculate_lifecycle
from manufacturing import manufacturing_kg


def break_even_km(ev_vehicle, ice_vehicle, country, year):

    # Validate EV has required data
    if ev_vehicle.get("type") != "EV":
        return {"error": "First vehicle must be an EV"}
    
    if ice_vehicle.get("type") not in ["ICE", "HEV", "PHEV"]:
        return {"error": "Second vehicle must be ICE, HEV, or PHEV"}
    
    # Check if EV has electric consumption data
    if ev_vehicle.get("electric_wh_per_km") is None:
        return {"error": "EV vehicle missing electric consumption data"}

    ev_lc = calculate_lifecycle(ev_vehicle, country, year)
    ice_lc = calculate_lifecycle(ice_vehicle, country, year)

    if "error" in ev_lc:
        return {"error": f"EV lifecycle calculation failed: {ev_lc['error']}"}
    
    if "error" in ice_lc:
        return {"error": f"ICE lifecycle calculation failed: {ice_lc['error']}"}

    # Get TOTAL manufacturing emissions (kg CO₂)
    try:
        ev_manuf_total_kg = manufacturing_kg(ev_vehicle)
        ice_manuf_total_kg = manufacturing_kg(ice_vehicle)
    except ValueError as e:
        return {"error": f"Manufacturing calculation failed: {str(e)}"}

    # Operational emissions (g/km)
    ev_op = ev_lc["operational_g_per_km"]
    ice_op = ice_lc["operational_g_per_km"]

    # Convert total manufacturing to g for consistency
    ev_manuf_total_g = ev_manuf_total_kg * 1000
    ice_manuf_total_g = ice_manuf_total_kg * 1000

    # Break-even calculation:
    # delta_manuf (g) = difference in total manufacturing emissions
    # delta_operational (g/km) = difference in operational emissions per km
    delta_manuf = ev_manuf_total_g - ice_manuf_total_g
    delta_operational = ice_op - ev_op

    print(f"Break-even calculation:")
    print(f"  EV: manuf_total={ev_manuf_total_kg:.2f} kg, op={ev_op:.2f} g/km, total={ev_lc['total_g_per_km']:.2f} g/km")
    print(f"  ICE: manuf_total={ice_manuf_total_kg:.2f} kg, op={ice_op:.2f} g/km, total={ice_lc['total_g_per_km']:.2f} g/km")
    print(f"  Delta manuf: {delta_manuf:.2f} g (EV - ICE)")
    print(f"  Delta operational: {delta_operational:.2f} g/km (ICE - EV)")

    if delta_operational <= 0:
        return {
            "break_even_km": None,
            "message": "EV does not outperform ICE operationally in this grid",
            "ev_manufacturing_g_per_km": ev_lc["manufacturing_g_per_km"],
            "ev_operational_g_per_km": ev_op,
            "ev_total_g_per_km": ev_lc["total_g_per_km"],
            "ice_manufacturing_g_per_km": ice_lc["manufacturing_g_per_km"],
            "ice_operational_g_per_km": ice_op,
            "ice_total_g_per_km": ice_lc["total_g_per_km"]
        }

    # Break-even km = total manufacturing difference / operational difference per km
    km = delta_manuf / delta_operational
    print(f"  Break-even: {km:.0f} km")

    return {
        "break_even_km": round(km, 0),
        "manufacturing_difference_g_per_km": round(delta_manuf / 278600, 2),  # For display purposes
        "operational_advantage_g_per_km": round(delta_operational, 2),
        "ev_manufacturing_g_per_km": ev_lc["manufacturing_g_per_km"],
        "ev_operational_g_per_km": ev_op,
        "ev_total_g_per_km": ev_lc["total_g_per_km"],
        "ice_manufacturing_g_per_km": ice_lc["manufacturing_g_per_km"],
        "ice_operational_g_per_km": ice_op,
        "ice_total_g_per_km": ice_lc["total_g_per_km"]
    }