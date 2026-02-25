from engine import calculate_lifecycle


def grid_sensitivity(vehicle, country_list, year):

    results = []

    for country in country_list:
        lc = calculate_lifecycle(vehicle, country, year)

        if "error" not in lc:
            results.append({
                "country": country,
                "total_g_per_km": lc["total_g_per_km"]
            })

    results.sort(key=lambda x: x["total_g_per_km"])

    return results