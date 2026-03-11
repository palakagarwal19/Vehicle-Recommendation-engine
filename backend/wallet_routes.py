"""
wallet_routes.py  —  CarbonWise Carbon Wallet Blueprint
========================================================
Register this blueprint in app.py:

    from wallet_routes import wallet_bp
    app.register_blueprint(wallet_bp)
"""

from flask import Blueprint, request, jsonify
from database import get_db_connection
from carbon_wallet import (
    get_wallet,
    spend_carbon_credits,
    get_travel_log,
    get_yearly_stats,
    create_wallet,
)
from datetime import datetime

wallet_bp = Blueprint("wallet", __name__, url_prefix="/wallet")


# ══════════════════════════════════════════════════════════════════════════════
# GET /wallet/<user_id>
# ══════════════════════════════════════════════════════════════════════════════

@wallet_bp.route("/<int:user_id>", methods=["GET"])
def wallet_balance(user_id):
    wallet = get_wallet(user_id)
    if not wallet:
        # Auto-create wallet if missing (e.g. legacy user)
        wallet = create_wallet(user_id, datetime.utcnow().year)

    stats = get_yearly_stats(user_id)
    used  = wallet["total_credits_kg"] - wallet["remaining_credits_kg"]

    return jsonify({
        "user_id":           user_id,
        "year":              wallet["year"],
        "total_credits":     wallet["total_credits_kg"],
        "remaining_credits": wallet["remaining_credits_kg"],
        "used_credits":      round(used, 3),
        "usage_pct":         round(min(used / wallet["total_credits_kg"] * 100, 100), 1),
        "stats":             stats,
    })


# ══════════════════════════════════════════════════════════════════════════════
# GET /wallet/<user_id>/log
# ══════════════════════════════════════════════════════════════════════════════

@wallet_bp.route("/<int:user_id>/log", methods=["GET"])
def travel_log(user_id):
    limit = min(int(request.args.get("limit", 50)), 200)
    trips = get_travel_log(user_id, limit=limit)
    return jsonify({"user_id": user_id, "trips": trips, "count": len(trips)})


# ══════════════════════════════════════════════════════════════════════════════
# POST /wallet/travel
# ══════════════════════════════════════════════════════════════════════════════

@wallet_bp.route("/travel", methods=["POST"])
def log_travel():
    data = request.json or {}

    user_id     = data.get("user_id")
    vehicle_id  = data.get("vehicle_id")
    distance_km = data.get("distance_km")

    if not all([user_id, vehicle_id, distance_km]):
        return jsonify({"error": "user_id, vehicle_id, and distance_km are required"}), 400

    try:
        distance_km = float(distance_km)
        if distance_km <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "distance_km must be a positive number"}), 400

    # Fetch vehicle from DB
    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        cur.execute("SELECT * FROM vehicles WHERE id = %s", (vehicle_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": f"Vehicle id={vehicle_id} not found"}), 404
        columns = [d[0] for d in cur.description]
        vehicle = dict(zip(columns, row))
    finally:
        cur.close()
        conn.close()

    # Spend credits
    try:
        result = spend_carbon_credits(int(user_id), vehicle, distance_km)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        return jsonify({"error": f"Could not log trip: {str(e)}"}), 500

    return jsonify(result), 200


# ══════════════════════════════════════════════════════════════════════════════
# POST /wallet/travel/by-name  (convenience: look up vehicle by brand/model/year)
# ══════════════════════════════════════════════════════════════════════════════

@wallet_bp.route("/travel/by-name", methods=["POST"])
def log_travel_by_name():
    data = request.json or {}

    user_id     = data.get("user_id")
    brand       = data.get("brand", "").strip()
    model       = data.get("model", "").strip()
    year        = data.get("year")
    distance_km = data.get("distance_km")

    if not all([user_id, brand, model, year, distance_km]):
        return jsonify({"error": "user_id, brand, model, year, and distance_km are required"}), 400

    try:
        distance_km = float(distance_km)
        if distance_km <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "distance_km must be a positive number"}), 400

    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT * FROM vehicles
            WHERE LOWER(brand) = LOWER(%s)
              AND LOWER(model) = LOWER(%s)
              AND year = %s
            LIMIT 1
        """, (brand, model, year))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": f"Vehicle '{brand} {model} {year}' not found"}), 404
        columns = [d[0] for d in cur.description]
        vehicle = dict(zip(columns, row))
    finally:
        cur.close()
        conn.close()

    try:
        result = spend_carbon_credits(int(user_id), vehicle, distance_km)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        return jsonify({"error": f"Could not log trip: {str(e)}"}), 500

    return jsonify(result), 200
