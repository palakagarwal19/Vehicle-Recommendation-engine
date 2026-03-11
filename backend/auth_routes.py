"""
auth_routes.py  —  CarbonWise Authentication Blueprint
=======================================================
Register this blueprint in app.py:

    from auth_routes import auth_bp
    app.register_blueprint(auth_bp)

Requires:
    pip install flask bcrypt
"""

from flask import Blueprint, request, jsonify
from database import get_db_connection
from carbon_wallet import create_wallet
import bcrypt
from datetime import datetime

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# ── helpers ────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ══════════════════════════════════════════════════════════════════════════════
# POST /auth/signup
# ══════════════════════════════════════════════════════════════════════════════

@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.json or {}

    name     = (data.get("name")     or "").strip()
    email    = (data.get("email")    or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not name or not email or not password:
        return jsonify({"error": "name, email, and password are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    password_hash = _hash_password(password)

    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        # Insert user
        cur.execute("""
            INSERT INTO users (name, email, password_hash)
            VALUES (%s, %s, %s)
            RETURNING id, name, email, created_at
        """, (name, email, password_hash))
        row = cur.fetchone()
        conn.commit()
    except Exception as e:
        conn.rollback()
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            return jsonify({"error": "An account with this email already exists"}), 409
        return jsonify({"error": "Signup failed — please try again"}), 500
    finally:
        cur.close()
        conn.close()

    user_id = row[0]

    # Create carbon wallet for current year
    try:
        create_wallet(user_id, datetime.utcnow().year)
    except Exception:
        pass  # non-fatal — wallet can be recreated later

    return jsonify({
        "message":  "Account created successfully",
        "user_id":  user_id,
        "name":     row[1],
        "email":    row[2],
        "created_at": row[3].isoformat() if row[3] else None,
    }), 201


# ══════════════════════════════════════════════════════════════════════════════
# POST /auth/login
# ══════════════════════════════════════════════════════════════════════════════

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json or {}

    email    = (data.get("email")    or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT id, name, email, password_hash
            FROM users
            WHERE email = %s
        """, (email,))
        row = cur.fetchone()
    finally:
        cur.close()
        conn.close()

    # Use a generic message to prevent user enumeration
    if not row or not _check_password(password, row[3]):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({
        "message": "Login successful",
        "user_id": row[0],
        "name":    row[1],
        "email":   row[2],
    }), 200


# ══════════════════════════════════════════════════════════════════════════════
# GET /auth/user/<user_id>  — lightweight profile fetch
# ══════════════════════════════════════════════════════════════════════════════

@auth_bp.route("/user/<int:user_id>", methods=["GET"])
def get_user(user_id):
    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT id, name, email, created_at
            FROM users WHERE id = %s
        """, (user_id,))
        row = cur.fetchone()
    finally:
        cur.close()
        conn.close()

    if not row:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "user_id":    row[0],
        "name":       row[1],
        "email":      row[2],
        "created_at": row[3].isoformat() if row[3] else None,
    })
