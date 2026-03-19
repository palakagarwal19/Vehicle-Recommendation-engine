"""
impact_routes.py  —  CarbonWise Climate Impact Blueprint
=========================================================
Provides the /impact/projection endpoints consumed by ClimateProjection.jsx.

Register in app.py:
    from impact_routes import impact_bp
    app.register_blueprint(impact_bp)
"""

from flask import Blueprint, request, jsonify
from database import get_db_connection
from carbon_wallet import get_wallet, get_travel_log, get_yearly_stats
from datetime import datetime
import traceback

impact_bp = Blueprint("impact", __name__, url_prefix="/impact")

# ── Constants ──────────────────────────────────────────────────────────────
PETROL_G_PER_KM       = 210.0   # average petrol car lifecycle g CO₂/km
KG_PER_TREE_PER_YEAR  = 21.0    # kg CO₂ absorbed per mature tree per year
AVG_DRIVER_KG_PER_YEAR = 2400.0 # average UK/EU driver annual CO₂ (kg)
PETROL_KG_PER_LITRE   = 2.31    # kg CO₂ per litre petrol burned
TEMP_RISE_PER_TONNE   = 0.0000000015  # simplified climate sensitivity

# ── health check ──────────────────────────────────────────────────────────
@impact_bp.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "impact blueprint reachable"}), 200


def _build_projection(emissions_kg_per_trip: float,
                      distance_km_per_trip: float,
                      trips_per_week: int,
                      vehicle_name: str,
                      years: int = 10) -> dict:
    """
    Build a year-by-year CO₂ accumulation projection.
    Returns the full projection dict expected by ClimateProjection.jsx.
    """
    annual_emissions_kg  = emissions_kg_per_trip * trips_per_week * 52
    petrol_annual_kg     = (distance_km_per_trip * PETROL_G_PER_KM / 1000) * trips_per_week * 52
    base_year            = datetime.utcnow().year

    year_data = []
    for i in range(1, years + 1):
        cumulative      = annual_emissions_kg * i
        trees_this_year = cumulative / KG_PER_TREE_PER_YEAR
        year_data.append({
            "year":             base_year + i,
            "annual_co2_kg":    round(annual_emissions_kg, 2),
            "cumulative_co2_kg": round(cumulative, 2),
            "trees_absorbed":   round(trees_this_year, 1),
        })

    total_user_kg    = annual_emissions_kg * years
    total_petrol_kg  = petrol_annual_kg    * years
    saved_kg         = max(total_petrol_kg - total_user_kg, 0)
    temp_avoided     = saved_kg / 1000 * TEMP_RISE_PER_TONNE * 1e12  # simplified °C

    vs_baseline_pct  = round((annual_emissions_kg / AVG_DRIVER_KG_PER_YEAR) * 100, 1)
    petrol_litres    = round(saved_kg / PETROL_KG_PER_LITRE)

    # narrative sentence
    if saved_kg > 5000:
        narrative = (
            f"Over 10 years, driving {vehicle_name} instead of a petrol car prevents "
            f"{saved_kg/1000:.1f} tonnes of CO₂ — the equivalent of planting "
            f"{int(saved_kg/KG_PER_TREE_PER_YEAR):,} trees. "
            "That's a genuinely meaningful contribution to slowing climate change."
        )
    elif saved_kg > 0:
        narrative = (
            f"Switching to {vehicle_name} saves {saved_kg/1000:.1f} tonnes of CO₂ "
            f"over 10 years compared to a typical petrol car. "
            "Every kilometre driven makes a difference."
        )
    else:
        narrative = (
            f"{vehicle_name} produces similar emissions to a petrol baseline over this period. "
            "Consider a lower-carbon grid or a more efficient vehicle to increase savings."
        )

    return {
        "vehicle":             vehicle_name,
        "years":               year_data,
        "annual_emissions_kg": round(annual_emissions_kg, 2),
        "total_emissions_kg":  round(total_user_kg, 2),
        "total_petrol_kg":     round(total_petrol_kg, 2),
        "saved_kg":            round(saved_kg, 2),
        "trees_to_offset":     round(total_user_kg / KG_PER_TREE_PER_YEAR),
        "petrol_litres_equiv": petrol_litres,
        "temp_rise_avoided_c": round(temp_avoided, 6),
        "vs_baseline_pct":     vs_baseline_pct,
        "narrative":           narrative,
    }


# ══════════════════════════════════════════════════════════════════════════
# POST /impact/projection
# Body: { user_id, emissions_kg, distance_km, vehicle }
# Used by ClimateProjection.jsx when navigated from a specific trip
# ══════════════════════════════════════════════════════════════════════════

@impact_bp.route("/projection", methods=["POST"])
def projection_from_trip():
    data = request.json or {}

    emissions_kg  = data.get("emissions_kg")
    distance_km   = data.get("distance_km")
    vehicle       = data.get("vehicle", "Your vehicle")

    if emissions_kg is None or distance_km is None:
        return jsonify({"error": "emissions_kg and distance_km are required"}), 400

    try:
        emissions_kg = float(emissions_kg)
        distance_km  = float(distance_km)
        if emissions_kg < 0 or distance_km <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "emissions_kg and distance_km must be positive numbers"}), 400

    # Infer trip frequency: short trips (< 50 km) → ~5/week, longer → ~1/week
    trips_per_week = 1 if distance_km >= 50 else 5

    try:
        result = _build_projection(
            emissions_kg_per_trip = emissions_kg,
            distance_km_per_trip  = distance_km,
            trips_per_week        = trips_per_week,
            vehicle_name          = vehicle,
        )
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Projection failed: {e}"}), 500


# ══════════════════════════════════════════════════════════════════════════
# GET /impact/projection/<user_id>
# Used by ClimateProjection.jsx when visited directly (no trip state)
# Derives projection from the user's wallet travel history
# ══════════════════════════════════════════════════════════════════════════

@impact_bp.route("/projection/<user_id>", methods=["GET"])
def projection_from_wallet(user_id):
    try:
        uid = int(user_id)
        if uid <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": f"Invalid user_id: {user_id!r}"}), 400

    try:
        stats = get_yearly_stats(uid)
        trips = stats.get("trips", 0)

        if trips == 0:
            # No history — return a sensible default (average driver)
            result = _build_projection(
                emissions_kg_per_trip = AVG_DRIVER_KG_PER_YEAR / 52 / 5,
                distance_km_per_trip  = 15,
                trips_per_week        = 5,
                vehicle_name          = "Your vehicle",
            )
            result["note"] = "No trips logged yet — showing average driver estimate."
            return jsonify(result)

        total_km  = stats.get("total_km", 0)
        total_kg  = stats.get("total_emissions_kg", 0)

        avg_km_per_trip  = total_km / trips if trips else 15
        avg_kg_per_trip  = total_kg / trips if trips else AVG_DRIVER_KG_PER_YEAR / 260

        # Trips-per-week derived from annual count
        trips_per_week = max(1, round(trips / 52))

        result = _build_projection(
            emissions_kg_per_trip = avg_kg_per_trip,
            distance_km_per_trip  = avg_km_per_trip,
            trips_per_week        = trips_per_week,
            vehicle_name          = "Your vehicle",
        )
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Could not build projection: {e}"}), 500