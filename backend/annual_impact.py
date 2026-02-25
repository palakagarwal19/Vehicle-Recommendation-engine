def annual_emissions(total_g_per_km, annual_km):

    total_kg = (total_g_per_km * annual_km) / 1000

    return {
        "annual_kg": round(total_kg, 1),
        "annual_tons": round(total_kg / 1000, 3)
    }