import os
import json
from engine import calculate_lifecycle


BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_vehicles():
    path = os.path.join(BASE_DIR, "..", "data", "eu_vehicles_master.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ============================================
# PURE SUSTAINABILITY RECOMMENDATION
# ============================================

def recommend_vehicle(
    daily_km,
    years,
    body_type=None,
    powertrain=None,
    top_n=3,
    country="US",
    grid_year=2023
):

    vehicles = load_vehicles()
    
    # Filter first to reduce calculations
    filtered = []
    for v in vehicles:
        # Powertrain filter (body_type filter removed since vehicles don't have this field)
        if powertrain and v.get("type") != powertrain:
            continue
        filtered.append(v)
    
    print(f"Filtered to {len(filtered)} vehicles")
    
    # Limit to first 1000 to avoid timeout
    results = []
    for v in filtered[:1000]:
        try:
            # For EVs, check if they have required data
            if v.get("type") == "EV" and v.get("electric_wh_per_km") is None:
                continue
            
            # Calculate lifecycle
            lifecycle = calculate_lifecycle(v, country, grid_year)
            if "error" in lifecycle:
                # Skip vehicles with errors
                continue
                
            total_g_per_km = lifecycle["total_g_per_km"]
            annual_km = daily_km * 365
            lifetime_km = annual_km * years
            total_kg = (total_g_per_km * lifetime_km) / 1000
            
            results.append({
                "vehicle": f"{v['brand']} {v['model']} ({v['Year']})",
                "brand": v["brand"],
                "model": v["model"],
                "year": v["Year"],
                "powertrain": v["type"],
                "operational_g_per_km": lifecycle["operational_g_per_km"],
                "manufacturing_g_per_km": lifecycle["manufacturing_g_per_km"],
                "total_g_per_km": total_g_per_km,
                "personalized_total_kg": round(total_kg, 2)
            })
        except Exception as e:
            # Skip vehicles that cause errors
            continue
    
    if not results:
        return []
    
    # Sort by total emissions
    results.sort(key=lambda x: x["total_g_per_km"])
    
    # Get diverse recommendations (different powertrains)
    diverse_results = []
    powertrains_seen = set()
    
    for result in results:
        pt = result["powertrain"]
        # Add vehicle if we haven't seen this powertrain yet, or if we need more results
        if pt not in powertrains_seen or len(diverse_results) < top_n:
            diverse_results.append(result)
            powertrains_seen.add(pt)
        
        if len(diverse_results) >= top_n:
            break
    
    # If we don't have enough diverse results, fill with best remaining
    if len(diverse_results) < top_n:
        for result in results:
            if result not in diverse_results:
                diverse_results.append(result)
            if len(diverse_results) >= top_n:
                break
    
    print(f"Returning {len(diverse_results)} diverse recommendations")
    return diverse_results[:top_n]
