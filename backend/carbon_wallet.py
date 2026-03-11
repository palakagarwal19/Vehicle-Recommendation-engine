"""
carbon_wallet.py  —  CarbonWise Carbon Wallet business logic
=============================================================
Manages per-user yearly carbon budgets and travel emission logging.
Uses the existing get_db_connection() — does NOT touch the lifecycle engine.
"""

from database import get_db_connection
from datetime import datetime

# ── Constants ──────────────────────────────────────────────────────────────
YEARLY_BUDGET_KG = 2300.0   # default annual CO₂ allowance per user (kg)


# ══════════════════════════════════════════════════════════════════════════════
# WALLET CRUD
# ══════════════════════════════════════════════════════════════════════════════

def create_wallet(user_id: int, year: int | None = None) -> dict:
    """
    Initialise a fresh wallet for user_id / year.
    Raises ValueError if wallet already exists.
    """
    if year is None:
        year = datetime.utcnow().year

    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO carbon_wallet (user_id, year, total_credits_kg, remaining_credits_kg)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id) DO NOTHING
            RETURNING user_id
        """, (user_id, year, YEARLY_BUDGET_KG, YEARLY_BUDGET_KG))
        row = cur.fetchone()
        conn.commit()
        if not row:
            # Already existed — just return current state
            return get_wallet(user_id)
        return {
            "user_id":           user_id,
            "year":              year,
            "total_credits_kg":     YEARLY_BUDGET_KG,
            "remaining_credits_kg": YEARLY_BUDGET_KG,
        }
    finally:
        cur.close()
        conn.close()


def get_wallet(user_id: int) -> dict | None:
    """Return wallet dict for user_id, or None if not found."""
    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT user_id, year, total_credits_kg, remaining_credits_kg
            FROM carbon_wallet
            WHERE user_id = %s
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            return None
        return {
            "user_id":              row[0],
            "year":                 row[1],
            "total_credits_kg":     row[2],
            "remaining_credits_kg": row[3],
        }
    finally:
        cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════════
# EMISSION CALCULATION  (no lifecycle engine dependency)
# ══════════════════════════════════════════════════════════════════════════════

def _operational_g_per_km(vehicle: dict) -> float | None:
    """
    Return the operational emissions rate (g CO₂/km) for a vehicle row.
    Mirrors engine.py logic for ICE/HEV (tailpipe) only — EV/PHEV rates
    require a grid factor that isn't available here, so we use stored
    co2_wltp_gpkm for those too as the best static approximation.
    """
    vtype     = (vehicle.get("vehicle_type") or "").upper()
    tailpipe  = vehicle.get("co2_wltp_gpkm")
    wh_per_km = vehicle.get("electric_wh_per_km")

    if vtype in ("ICE", "HEV"):
        return float(tailpipe) if tailpipe is not None else None

    if vtype in ("EV", "BEV"):
        # wh_per_km × 0.233 kgCO₂/kWh (EU average grid) as a reasonable default
        if wh_per_km is not None:
            return float(wh_per_km) * 0.233 / 1000 * 1000  # → g/km
        return None

    if vtype == "PHEV":
        # Blend: 60 % electric, 40 % ICE (mirrors engine.py PHEV_ELECTRIC_SHARE)
        if tailpipe is not None and wh_per_km is not None:
            elec_g_km = float(wh_per_km) * 0.233 / 1000 * 1000
            return 0.6 * elec_g_km + 0.4 * float(tailpipe)
        if tailpipe is not None:
            return float(tailpipe)
        return None

    return float(tailpipe) if tailpipe is not None else None


# ══════════════════════════════════════════════════════════════════════════════
# SPEND  (core wallet operation)
# ══════════════════════════════════════════════════════════════════════════════

def spend_carbon_credits(user_id: int, vehicle: dict, distance_km: float) -> dict:
    """
    1. Calculate emissions_kg for the trip.
    2. Deduct from remaining_credits_kg (floor at 0 — allow overdraft tracking).
    3. Insert row into travel_log.
    4. Return updated wallet + trip details.

    Raises:
        ValueError  if vehicle has no usable emissions data.
        LookupError if wallet not found for user_id.
    """
    rate_g_per_km = _operational_g_per_km(vehicle)
    if rate_g_per_km is None:
        raise ValueError(
            f"No emissions data available for vehicle "
            f"'{vehicle.get('brand')} {vehicle.get('model')}'"
        )

    emissions_kg = (rate_g_per_km * float(distance_km)) / 1000.0

    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        # Deduct from wallet — allow going negative (overdraft visible to user)
        cur.execute("""
            UPDATE carbon_wallet
            SET remaining_credits_kg = remaining_credits_kg - %s
            WHERE user_id = %s
            RETURNING year, total_credits_kg, remaining_credits_kg
        """, (emissions_kg, user_id))
        wallet_row = cur.fetchone()
        if not wallet_row:
            raise LookupError(f"No wallet found for user_id={user_id}")

        # Log the trip
        cur.execute("""
            INSERT INTO travel_log (user_id, vehicle_id, distance_km, emissions_kg)
            VALUES (%s, %s, %s, %s)
            RETURNING id, created_at
        """, (user_id, vehicle.get("id"), float(distance_km), emissions_kg))
        log_row = cur.fetchone()

        conn.commit()

        return {
            "trip": {
                "log_id":       log_row[0],
                "vehicle":      f"{vehicle.get('brand', '')} {vehicle.get('model', '')}".strip(),
                "vehicle_type": vehicle.get("vehicle_type"),
                "distance_km":  round(float(distance_km), 2),
                "emissions_kg": round(emissions_kg, 3),
                "logged_at":    log_row[1].isoformat(),
            },
            "wallet": {
                "user_id":              user_id,
                "year":                 wallet_row[0],
                "total_credits_kg":     wallet_row[1],
                "remaining_credits_kg": round(wallet_row[2], 3),
            },
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════════
# TRAVEL LOG HISTORY
# ══════════════════════════════════════════════════════════════════════════════

def get_travel_log(user_id: int, limit: int = 50) -> list[dict]:
    """Return the most recent `limit` trips for user_id."""
    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT
                tl.id,
                tl.distance_km,
                tl.emissions_kg,
                tl.created_at,
                v.brand,
                v.model,
                v.year,
                v.vehicle_type
            FROM travel_log tl
            LEFT JOIN vehicles v ON v.id = tl.vehicle_id
            WHERE tl.user_id = %s
            ORDER BY tl.created_at DESC
            LIMIT %s
        """, (user_id, limit))
        rows = cur.fetchall()
        return [
            {
                "log_id":       r[0],
                "distance_km":  r[1],
                "emissions_kg": r[2],
                "logged_at":    r[3].isoformat() if r[3] else None,
                "vehicle":      f"{r[4] or ''} {r[5] or ''}".strip() or None,
                "year":         r[6],
                "vehicle_type": r[7],
            }
            for r in rows
        ]
    finally:
        cur.close()
        conn.close()


def get_yearly_stats(user_id: int) -> dict:
    """Aggregate stats for the current calendar year."""
    year = datetime.utcnow().year
    conn = get_db_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT
                COUNT(*)            AS trips,
                COALESCE(SUM(distance_km),  0) AS total_km,
                COALESCE(SUM(emissions_kg), 0) AS total_emissions_kg
            FROM travel_log
            WHERE user_id = %s
              AND EXTRACT(YEAR FROM created_at) = %s
        """, (user_id, year))
        row = cur.fetchone()
        return {
            "year":                year,
            "trips":               row[0],
            "total_km":            round(row[1], 1),
            "total_emissions_kg":  round(row[2], 3),
        }
    finally:
        cur.close()
        conn.close()
