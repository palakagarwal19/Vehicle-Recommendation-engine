"""
wallet_routes.py  —  CarbonWise Carbon Wallet Blueprint
========================================================
Register this blueprint in app.py:

    from wallet_routes import wallet_bp
    app.register_blueprint(wallet_bp)

Make sure app.py does NOT have url_prefix on the blueprint itself
if it already lives inside a /wallet prefix here.
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
import traceback

wallet_bp = Blueprint("wallet", __name__, url_prefix="/wallet")


def _parse_user_id(raw):
    """Return (int_id, None) or (None, flask_error_tuple)."""
    try:
        uid = int(raw)
        if uid <= 0:
            raise ValueError
        return uid, None
    except (ValueError, TypeError):
        return None, (jsonify({"error": f"Invalid user_id: {raw!r} — must be a positive integer"}), 400)


# ── debug: confirm blueprint is alive ─────────────────────────────────────
@wallet_bp.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "wallet blueprint is registered and reachable"}), 200


# ══════════════════════════════════════════════════════════════════════════════
# GET /wallet/<user_id>
# ══════════════════════════════════════════════════════════════════════════════

@wallet_bp.route("/<user_id>", methods=["GET"])
def wallet_balance(user_id):
    uid, err = _parse_user_id(user_id)
    if err:
        return err

    try:
        wallet = get_wallet(uid)

        # Auto-create if missing — never return 404 for a valid user
        if not wallet:
            try:
                wallet = create_wallet(uid, datetime.utcnow().year)
            except Exception as create_err:
                traceback.print_exc()
                return jsonify({
                    "error": (
                        f"Wallet not found for user {uid} and auto-creation failed: "
                        f"{create_err}. "
                        "Check that the carbon_wallets table exists and the user id is valid."
                    )
                }), 500

        if not wallet:
            return jsonify({
                "error": (
                    f"No wallet found for user {uid} and create_wallet() returned None. "
                    "Verify the user exists in the database."
                )
            }), 500

        stats = get_yearly_stats(uid)
        used  = wallet["total_credits_kg"] - wallet["remaining_credits_kg"]

        return jsonify({
            "user_id":           uid,
            "year":              wallet["year"],
            "total_credits":     wallet["total_credits_kg"],
            "remaining_credits": wallet["remaining_credits_kg"],
            "used_credits":      round(used, 3),
            "usage_pct":         round(min(used / wallet["total_credits_kg"] * 100, 100), 1),
            "stats":             stats or {},
        })

    except KeyError as e:
        traceback.print_exc()
        return jsonify({"error": f"Wallet row is missing expected key: {e}. Check your DB schema."}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Unexpected error loading wallet: {e}"}), 500


# ══════════════════════════════════════════════════════════════════════════════
# GET /wallet/<user_id>/log
# ══════════════════════════════════════════════════════════════════════════════

@wallet_bp.route("/<user_id>/log", methods=["GET"])
def travel_log(user_id):
    uid, err = _parse_user_id(user_id)
    if err:
        return err

    try:
        limit = min(int(request.args.get("limit", 50)), 200)
    except (ValueError, TypeError):
        limit = 50

    try:
        trips = get_travel_log(uid, limit=limit)
        return jsonify({"user_id": uid, "trips": trips or [], "count": len(trips or [])})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Could not load travel log: {e}"}), 500


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

    uid, err = _parse_user_id(user_id)
    if err:
        return err

    try:
        distance_km = float(distance_km)
        if distance_km <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "distance_km must be a positive number"}), 400

    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        cur.execute("SELECT * FROM vehicles WHERE id = %s", (vehicle_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": f"Vehicle id={vehicle_id} not found"}), 404
        columns = [d[0] for d in cur.description]
        vehicle = dict(zip(columns, row))
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Database error fetching vehicle: {e}"}), 500
    finally:
        cur.close()
        conn.close()

    try:
        result = spend_carbon_credits(uid, vehicle, distance_km)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Could not log trip: {e}"}), 500

    return jsonify(result), 200


# ══════════════════════════════════════════════════════════════════════════════
# POST /wallet/travel/by-name
# ══════════════════════════════════════════════════════════════════════════════

@wallet_bp.route("/travel/by-name", methods=["POST"])
def log_travel_by_name():
    data = request.json or {}

    user_id     = data.get("user_id")
    brand       = (data.get("brand") or "").strip()
    model       = (data.get("model") or "").strip()
    year        = data.get("year")
    distance_km = data.get("distance_km")

    if not all([user_id, brand, model, year, distance_km]):
        return jsonify({"error": "user_id, brand, model, year, and distance_km are required"}), 400

    uid, err = _parse_user_id(user_id)
    if err:
        return err

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
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Database error: {e}"}), 500
    finally:
        cur.close()
        conn.close()

    try:
        result = spend_carbon_credits(uid, vehicle, distance_km)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Could not log trip: {e}"}), 500

    return jsonify(result), 200