import psycopg2
from database import get_db_connection
from engine import calculate_lifecycle


# ==============================
# CARBON SCORE
# ==============================

def carbon_score(total_g_per_km):
    score = max(0, 100 - (total_g_per_km / 4))
    return round(score, 1)


# ==============================
# FETCH VEHICLES FROM DATABASE
# ==============================

def fetch_vehicles(body_type=None, powertrain=None):

    conn = get_db_connection()
    cur = conn.cursor()

    query = "SELECT * FROM vehicle_clean WHERE 1=1"
    params = []

    if powertrain:
        query += " AND powertrain = %s"
        params.append(powertrain)

    if body_type:
        query += " AND body_type = %s"
        params.append(body_type)

    cur.execute(query, params)

    columns = [desc[0] for desc in cur.description]
    vehicles = [dict(zip(columns, row)) for row in cur.fetchall()]

    cur.close()
    conn.close()

    return vehicles


# ==============================
# RECOMMENDATION ENGINE
# ==============================

def recommend_vehicle(
    daily_km,
    years,
    body_type=None,
    powertrain=None,
    top_n=3,
    country="US",
    grid_year=2023,
    baseline_vehicle=None
):

    print("\nRecommendation request")
    print(f"daily_km={daily_km}, years={years}, powertrain={powertrain}, country={country}")

    vehicles = fetch_vehicles(body_type, powertrain)

    print(f"Fetched {len(vehicles)} vehicles from DB")

    if not vehicles:
        return []

    annual_km = daily_km * 365
    lifetime_km = annual_km * years

    baseline_total = None

    if baseline_vehicle:
        lifecycle = calculate_lifecycle(baseline_vehicle, country, grid_year)
        baseline_total = (lifecycle["total_g_per_km"] * lifetime_km) / 1000

    results = []

    for v in vehicles:

        try:

            lifecycle = calculate_lifecycle(v, country, grid_year)

            if "error" in lifecycle:
                continue

            total_g_per_km = lifecycle["total_g_per_km"]

            total_kg = (total_g_per_km * lifetime_km) / 1000

            score = carbon_score(total_g_per_km)

            savings = None
            if baseline_total:
                savings = round(baseline_total - total_kg, 2)

            results.append({
                "vehicle": f"{v['brand']} {v['model']} ({v['year']})",
                "brand": v["brand"],
                "model": v["model"],
                "year": v["year"],
                "powertrain": v["powertrain"],

                "operational_g_per_km": lifecycle["operational_g_per_km"],
                "manufacturing_g_per_km": lifecycle["manufacturing_g_per_km"],
                "total_g_per_km": total_g_per_km,

                "personalized_total_kg": round(total_kg, 2),

                "carbon_score": score,

                "carbon_savings_vs_baseline": savings
            })

        except Exception as e:
            print("Error processing vehicle:", e)

    if not results:
        return []

    # ==============================
    # SORT BY IMPACT
    # ==============================

    results.sort(
        key=lambda x: (
            x["personalized_total_kg"],
            x["total_g_per_km"]
        )
    )

    # ==============================
    # POWERTRAIN DIVERSITY
    # ==============================

    diverse = []
    powertrains_seen = set()

    for r in results:

        pt = r["powertrain"]

        if pt not in powertrains_seen:
            diverse.append(r)
            powertrains_seen.add(pt)

        if len(diverse) >= top_n:
            break

    if len(diverse) < top_n:

        for r in results:

            if r not in diverse:
                diverse.append(r)

            if len(diverse) >= top_n:
                break

    final = diverse[:top_n]

    print("\nTop Recommendations")

    for i, r in enumerate(final):
        print(
            f"{i+1}. {r['vehicle']} | "
            f"{r['powertrain']} | "
            f"{r['total_g_per_km']:.1f} g/km | "
            f"{r['carbon_score']} score"
        )

    return final