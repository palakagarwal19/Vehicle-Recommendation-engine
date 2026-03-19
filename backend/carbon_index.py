def carbon_score(total_g_per_km):

    # Scientific scaling: 0 g/km = 100, 300 g/km = 0
    score = max(0, 100 - (total_g_per_km / 3))

    if score >= 80:
        grade    = "A"
        label    = "Excellent"
        category = "Excellent"
    elif score >= 60:
        grade    = "B"
        label    = "Good"
        category = "Good"
    elif score >= 40:
        grade    = "C"
        label    = "Moderate"
        category = "Moderate"
    elif score >= 20:
        grade    = "D"
        label    = "High Emission"
        category = "High Emission"
    else:
        grade    = "F"
        label    = "Very High Emission"
        category = "Very High Emission"

    return {
        "score":    round(score, 1),
        "grade":    grade,          # ← frontend reads this for the badge letter
        "label":    label,          # ← frontend reads this for the caption
        "category": category,       # ← keep for any other consumers
    }