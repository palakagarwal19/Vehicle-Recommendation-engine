from database import get_db_connection

COUNTRY_CODE_MAP = {
    "US": "USA", "DE": "DEU", "FR": "FRA", "UK": "GBR",
    "CN": "CHN", "JP": "JPN", "IN": "IND", "CA": "CAN",
    "AU": "AUS", "BR": "BRA",
}

LIFETIME_KM = 278_600


def generate_reasons(r, rank, all_results, lifetime_km, annual_km, grid_ci):
    reasons = []
    vtype = r["vehicle_type"]
    ops   = r["operational_g_per_km"]
    mfg   = r["manufacturing_total_kg"]
    total = r["personalized_total_kg"]

    if len(all_results) > 1:
        worst = max(all_results, key=lambda x: x["personalized_total_kg"])
        saved = round(worst["personalized_total_kg"] - total)
        years = round(lifetime_km / annual_km) if annual_km else 10
        if saved > 0:
            reasons.append(f"Saves ~{saved:,} kg CO2 vs the least efficient option over {years} years")

    if vtype == "BEV":
        if grid_ci < 200:
            reasons.append(f"Your grid is very clean ({grid_ci:.0f} g/kWh) - BEV operational emissions are just {ops:.1f} g/km")
        elif grid_ci < 400:
            reasons.append(f"On a {grid_ci:.0f} g/kWh grid, {ops:.1f} g/km operational rate beats most ICE vehicles")
        else:
            reasons.append(f"Even on a {grid_ci:.0f} g/kWh grid, high mileage makes BEV lifecycle lower than ICE")
        if annual_km > 20000:
            reasons.append(f"High annual distance ({annual_km:,.0f} km/yr) lets BEVs recover manufacturing carbon faster")
    elif vtype == "HEV":
        reasons.append(f"Hybrid drivetrain gives {ops:.0f} g/km without needing charging infrastructure")
        if annual_km < 15000:
            reasons.append(f"At {annual_km:,.0f} km/yr the lower manufacturing cost outweighs BEV's operational advantage")
    elif vtype == "PHEV":
        reasons.append(f"Blended {ops:.0f} g/km from 60% electric + 40% petrol operation")
        reasons.append("Flexibility for long trips without range anxiety while staying efficient daily")
    elif vtype == "ICE":
        reasons.append(f"Low operational emissions of {ops:.0f} g/km - among the most efficient combustion engines")

    reasons.append(f"Produces ~{r['annual_co2_kg']:.0f} kg CO2/year at {annual_km:,.0f} km/yr")

    mfg_share = round(mfg / total * 100) if total > 0 else 0
    ops_share = 100 - mfg_share
    if mfg_share > 60:
        reasons.append(f"Manufacturing is {mfg_share}% of total lifecycle - worth driving more km to amortise it")
    elif ops_share > 75:
        reasons.append(f"Operational emissions dominate ({ops_share}% of total) - low running rate is key at this distance")

    return reasons[:4]


def recommend_vehicle(
    daily_km,
    years=10,
    body_type=None,
    vehicle_type=None,
    top_n=3,
    country="US",
    grid_year=2023,
    baseline_vehicle=None,
):
    """
    Recycling weight resolution (mirrors manufacturing.py):
      1. vehicles.battery_weight_kg   -- vehicle-specific if non-null and > 0
      2. battery_weights table        -- GREET standard (EV/LiIon/conventional = 938.3 lb ~ 425.7 kg)
    battery_chemistry is NOT in vehicles table -- always use NMC622 default.
    """
    annual_km   = int(daily_km * 365)
    lifetime_km = int(annual_km * years)
    country3    = COUNTRY_CODE_MAP.get(country, country)

    conn = get_db_connection()
    cur  = conn.cursor()

    cur.execute("""
        SELECT carbon_intensity_gco2_per_kwh
        FROM   grid_intensity
        WHERE  country_code = %s AND year = %s
        LIMIT  1
    """, (country3, grid_year))
    row = cur.fetchone()
    if not row:
        cur.execute("SELECT AVG(carbon_intensity_gco2_per_kwh) FROM grid_intensity WHERE year = %s", (grid_year,))
        row = cur.fetchone()
    grid_ci = float(row[0]) if row and row[0] else 400.0

    extra_where = ""
    params = [grid_ci, grid_ci]

    if vehicle_type:
        extra_where += " AND v.vehicle_type = %s"
        params.append(vehicle_type)
    if body_type:
        extra_where += " AND v.body_type = %s"
        params.append(body_type)

    params += [LIFETIME_KM, LIFETIME_KM, LIFETIME_KM, LIFETIME_KM, top_n]

    query = f"""
        WITH norm AS (
            SELECT
                v.brand, v.model, v.year, v.vehicle_type,
                v.co2_wltp_gpkm,
                v.electric_wh_per_km,
                v.battery_weight_kg          AS vehicle_battery_kg,
                CASE v.vehicle_type
                    WHEN 'ICE' THEN 'ICEV'
                    WHEN 'BEV' THEN 'EV'
                    ELSE v.vehicle_type
                END AS mtype,
                CASE v.vehicle_type
                    WHEN 'BEV'  THEN (v.electric_wh_per_km / 1000.0) * %s
                    WHEN 'PHEV' THEN 0.6 * (v.electric_wh_per_km / 1000.0) * %s
                                   + 0.4 * COALESCE(v.co2_wltp_gpkm, 0)
                    ELSE COALESCE(v.co2_wltp_gpkm, 0)
                END AS operational_g_per_km
            FROM vehicles v
            WHERE
                (v.vehicle_type NOT IN ('BEV','PHEV') AND v.co2_wltp_gpkm > 0)
                OR (v.vehicle_type IN ('BEV','PHEV') AND v.electric_wh_per_km > 0)
            {extra_where}
        ),

        mfg AS (
            SELECT
                n.*,
                COALESCE(g.kg_co2, 0)                                        AS glider_kg,
                COALESCE(bw_mfg.weight_lb, 0) * 0.453592
                    * COALESCE(bf.kg_co2_per_kg, 0)                          AS battery_kg,
                COALESCE(fl.grams_co2, 0) / 1000.0                           AS fluids_kg,
                COALESCE(g.kg_co2, 0)
                    + COALESCE(bw_mfg.weight_lb, 0) * 0.453592
                      * COALESCE(bf.kg_co2_per_kg, 0)
                    + COALESCE(fl.grams_co2, 0) / 1000.0                     AS manufacturing_kg,

                -- Recycling: vehicle-specific weight first, then GREET standard fallback
                -- battery_chemistry not in vehicles table, so always use NMC622
                CASE WHEN n.mtype IN ('EV', 'PHEV')
                     THEN
                         COALESCE(
                             NULLIF(n.vehicle_battery_kg, 0),
                             bw_recycle.weight_lb * 0.453592
                         )
                         * COALESCE(rc.ghg_kg_per_kg_battery, 1.545665)
                     ELSE 0
                END                                                           AS recycling_kg

            FROM norm n

            LEFT JOIN glider_emissions g
                ON g.vehicle_type = n.mtype AND g.structure = 'conventional'

            LEFT JOIN battery_weights bw_mfg
                ON  bw_mfg.vehicle_type = n.mtype
                AND bw_mfg.structure    = 'conventional'
                AND bw_mfg.chemistry    = CASE n.mtype
                                              WHEN 'ICEV' THEN 'LeadAcid'
                                              WHEN 'HEV'  THEN 'NiMH'
                                              WHEN 'PHEV' THEN 'LiIon'
                                              WHEN 'EV'   THEN 'LiIon'
                                              WHEN 'FCV'  THEN 'NiMH'
                                              ELSE 'LiIon'
                                          END

            LEFT JOIN battery_emission_factors bf
                ON  bf.chemistry = CASE n.mtype
                                       WHEN 'ICEV' THEN 'LeadAcid'
                                       WHEN 'HEV'  THEN 'NiMH'
                                       WHEN 'PHEV' THEN 'LiIon'
                                       WHEN 'EV'   THEN 'LiIon'
                                       WHEN 'FCV'  THEN 'NiMH'
                                       ELSE 'LiIon'
                                   END

            LEFT JOIN fluids_weights fl
                ON fl.vehicle_type = n.mtype

            -- Recycling fallback weight from battery_weights (LiIon only for EV/PHEV)
            LEFT JOIN battery_weights bw_recycle
                ON  bw_recycle.vehicle_type = n.mtype
                AND bw_recycle.structure    = 'conventional'
                AND bw_recycle.chemistry    = CASE n.mtype
                                                  WHEN 'EV'   THEN 'LiIon'
                                                  WHEN 'PHEV' THEN 'LiIon'
                                                  ELSE NULL
                                              END

            -- Recycling factor: always NMC622/pyro (no battery_chemistry column)
            LEFT JOIN battery_recycling_factors rc
                ON  rc.chemistry        = 'NMC622'
                AND rc.recycling_method = 'pyro'
        ),

        scored AS (
            SELECT
                brand, model, year, vehicle_type,
                ROUND(operational_g_per_km::numeric, 2)              AS operational_g_per_km,
                recycling_kg,
                ROUND(manufacturing_kg::numeric, 2)                  AS manufacturing_total_kg,
                ROUND((manufacturing_kg * 1000.0 / %s)::numeric, 2) AS manufacturing_g_per_km,
                ROUND((operational_g_per_km
                       + manufacturing_kg * 1000.0 / %s
                       + recycling_kg     * 1000.0 / %s)::numeric, 2) AS total_g_per_km,
                ROUND((recycling_kg * 1000.0 / %s)::numeric, 2)     AS recycling_g_per_km,
                ROUND((manufacturing_kg
                       + operational_g_per_km * {lifetime_km} / 1000.0
                       + recycling_kg)::numeric, 1)                  AS rank_total_kg,
                ROUND((operational_g_per_km * {lifetime_km} / 1000.0)::numeric, 1)
                                                                      AS operational_total_kg,
                ROUND((manufacturing_kg
                       + operational_g_per_km * {lifetime_km} / 1000.0
                       + recycling_kg)::numeric, 1)                  AS total_for_distance_kg
            FROM mfg
            WHERE operational_g_per_km > 0
        ),

        deduped AS (
            SELECT DISTINCT ON (brand)
                brand, model, year, vehicle_type,
                operational_g_per_km, manufacturing_g_per_km, manufacturing_total_kg,
                recycling_g_per_km, recycling_kg, total_g_per_km,
                rank_total_kg, operational_total_kg, total_for_distance_kg
            FROM scored
            ORDER BY brand, rank_total_kg ASC
        )

        SELECT
            brand, model, year, vehicle_type,
            operational_g_per_km, manufacturing_g_per_km, manufacturing_total_kg,
            total_g_per_km, rank_total_kg, operational_total_kg, total_for_distance_kg,
            recycling_g_per_km, recycling_kg,
            ROUND((operational_g_per_km * {annual_km} / 1000.0)::numeric, 1) AS annual_co2_kg,
            ROUND((100 - total_g_per_km / 4.0)::numeric, 1)                  AS carbon_score
        FROM deduped
        ORDER BY rank_total_kg ASC
        LIMIT %s
    """

    cur.execute(query, params)
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    cur.close()
    conn.close()

    results = []
    for row in rows:
        r = dict(zip(cols, row))
        results.append({
            "vehicle":                f"{r['brand']} {r['model']} ({r['year']})",
            "brand":                  r["brand"],
            "model":                  r["model"],
            "year":                   r["year"],
            "vehicle_type":           r["vehicle_type"],
            "operational_g_per_km":   float(r["operational_g_per_km"]),
            "manufacturing_g_per_km": float(r["manufacturing_g_per_km"]),
            "manufacturing_total_kg": float(r["manufacturing_total_kg"]),
            "total_g_per_km":         float(r["total_g_per_km"]),
            "operational_total_kg":   float(r["operational_total_kg"]),
            "total_for_distance_kg":  float(r["total_for_distance_kg"]),
            "recycling_kg":           float(r["recycling_kg"]),
            "recycling_g_per_km":     float(r["recycling_g_per_km"]),
            "annual_co2_kg":          float(r["annual_co2_kg"]),
            "personalized_total_kg":  float(r["rank_total_kg"]),
            "carbon_score":           float(r["carbon_score"]),
        })

    for i, r in enumerate(results):
        r["reasons"] = generate_reasons(
            r, rank=i, all_results=results,
            lifetime_km=lifetime_km, annual_km=annual_km, grid_ci=grid_ci
        )

    print(f"RESULTS ({lifetime_km:,} km lifetime, {country3}, {grid_ci:.0f} g/kWh):")
    for i, r in enumerate(results):
        print(f"  #{i+1} {r['brand']} {r['model']} [{r['vehicle_type']}]"
              f" ops={r['operational_g_per_km']} g/km"
              f" mfg={r['manufacturing_total_kg']} kg"
              f" recycling={r['recycling_kg']} kg"
              f" total={r['personalized_total_kg']} kg")

    return results