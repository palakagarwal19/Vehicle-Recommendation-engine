from psycopg2.extras import RealDictCursor

from claim_scraper import ClaimScraper, DuckDuckGoBackend
from greenwashing import evaluate_claims
from engine import calculate_lifecycle

from database import get_db_connection


# -----------------------------
# DATABASE CONNECTION
# -----------------------------

conn = get_db_connection()
cursor = conn.cursor(cursor_factory=RealDictCursor)


# -----------------------------
# SCRAPER SETUP
# -----------------------------

scraper = ClaimScraper(
    backend=DuckDuckGoBackend(),
    max_results_per_query=6,
    request_delay_s=1.5
)


# -----------------------------
# POWERTRAIN INFERENCE
# -----------------------------

def infer_powertrain(vehicle):

    fuel = vehicle.get("fuel_type")
    electricity = vehicle.get("electric_wh_per_km")

    # Battery EV
    if electricity and electricity > 0:
        return "EV", True

    if fuel:
        f = fuel.lower()

        if "plug" in f:
            return "PHEV", False

        if "hybrid" in f:
            return "HEV", False

    return "ICE", False


# -----------------------------
# FETCH VEHICLES
# -----------------------------

def get_vehicles(limit=50):

    cursor.execute("""
        SELECT
            id,
            brand,
            model,
            fuel_type,
            electric_wh_per_km,
            fuel_l_per_100km,
            kerb_weight_kg,
            battery_weight_kg
        FROM vehicles_clean
        WHERE brand IS NOT NULL
        AND model IS NOT NULL
        LIMIT %s
    """, (limit,))

    return cursor.fetchall()


# -----------------------------
# SAVE SCRAPED CLAIMS
# -----------------------------

def save_scraped_claims(vehicle_id, claims):

    for c in claims:

        cursor.execute("""
            INSERT INTO scraped_claims
            (vehicle_id, claim_text, category, source_url, snippet, confidence)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            vehicle_id,
            c.text,
            c.category,
            c.source_url,
            c.source_snippet,
            c.confidence
        ))

    conn.commit()


# -----------------------------
# SAVE GREENWASHING RESULTS
# -----------------------------

def save_greenwashing_results(vehicle_id, report):

    for finding in report.findings:

        cursor.execute("""
            INSERT INTO greenwashing_results
            (vehicle_id, claim, risk_level, reason, suggestion)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            vehicle_id,
            finding.claim,
            finding.risk_level.value,
            finding.reason,
            finding.suggestion
        ))

    conn.commit()


# -----------------------------
# PROCESS ONE VEHICLE
# -----------------------------

def process_vehicle(vehicle):

    powertrain, electric = infer_powertrain(vehicle)

    vehicle_meta = {
        "brand": vehicle["brand"],
        "model": vehicle["model"],
        "powertrain": powertrain,
        "electric": electric
    }

    print(f"\nProcessing: {vehicle_meta['brand']} {vehicle_meta['model']} ({powertrain})")

    # Lifecycle emissions (EU grid 2023 default)
    lifecycle = calculate_lifecycle(vehicle, "EU", 2023)

    # Scrape claims
    scraped_claims = scraper.fetch(vehicle_meta)

    # Save claims
    save_scraped_claims(vehicle["id"], scraped_claims)

    claim_texts = [c.text for c in scraped_claims]

    # Evaluate greenwashing
    report = evaluate_claims(
        lifecycle,
        vehicle_meta,
        proposed_claims=claim_texts
    )

    # Save results
    save_greenwashing_results(vehicle["id"], report)

    print(f"Claims found: {len(scraped_claims)}")
    print(f"Overall risk: {report.overall_risk.value}")


# -----------------------------
# BATCH RUNNER
# -----------------------------

def run_batch():

    vehicles = get_vehicles(limit=50)

    print(f"Vehicles to process: {len(vehicles)}")

    for vehicle in vehicles:

        try:
            process_vehicle(vehicle)

        except Exception as e:
            print(f"Error processing vehicle {vehicle['id']}: {e}")

    print("\nBatch completed")


# -----------------------------
# ENTRY POINT
# -----------------------------

if __name__ == "__main__":
    run_batch()