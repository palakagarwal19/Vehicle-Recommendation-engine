def carbon_score(total_g_per_km):

    # Scientific scaling
    # 0 g/km = 100 score
    # 300 g/km = 0 score

    score = max(0, 100 - (total_g_per_km / 3))

    if score >= 80:
        category = "Excellent"
    elif score >= 60:
        category = "Good"
    elif score >= 40:
        category = "Moderate"
    else:
        category = "High Emission"

    return {
        "score": round(score, 1),
        "category": category
    }