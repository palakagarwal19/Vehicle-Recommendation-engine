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
    print(f"Recommendation request: daily_km={daily_km}, years={years}, powertrain={powertrain}, country={country}")
    
    vehicles = load_vehicles()
    print(f"Loaded {len(vehicles)} total vehicles")
    
    # Filter first to reduce calculations
    filtered = []
    for v in vehicles:
        # Powertrain filter
        if powertrain and v.get("type") != powertrain:
            continue
        # Skip vehicles without required data
        if v.get("type") == "EV" and v.get("electric_wh_per_km") is None:
            continue
        filtered.append(v)
    
    print(f"Filtered to {len(filtered)} vehicles after powertrain and data checks")
    
    # Calculate lifecycle for filtered vehicles (limit to 500 for performance)
    results = []
    processed = 0
    errors = 0
    
    for v in filtered[:500]:
        try:
            processed += 1
            if processed % 100 == 0:
                print(f"Processed {processed} vehicles...")
            
            # Calculate lifecycle
            lifecycle = calculate_lifecycle(v, country, grid_year)
            if "error" in lifecycle:
                errors += 1
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
            errors += 1
            continue
    
    print(f"Successfully calculated lifecycle for {len(results)} vehicles, {errors} errors")
    
    if not results:
        print("No valid results found")
        return []
    
    # Sort by total emissions (lowest first)
    results.sort(key=lambda x: x["total_g_per_km"])
    
    # Improved diversity algorithm - get best from each powertrain
    diverse_results = []
    powertrains_seen = set()
    
    # First pass: get the best vehicle from each powertrain type
    for result in results:
        pt = result["powertrain"]
        if pt not in powertrains_seen:
            diverse_results.append(result)
            powertrains_seen.add(pt)
            print(f"Added best {pt}: {result['vehicle']} - {result['total_g_per_km']:.1f} g/km")
        
        if len(diverse_results) >= top_n:
            break
    
    # Second pass: if we need more results, add the next best overall
    if len(diverse_results) < top_n:
        for result in results:
            if result not in diverse_results:
                diverse_results.append(result)
                print(f"Added additional: {result['vehicle']} - {result['total_g_per_km']:.1f} g/km")
            if len(diverse_results) >= top_n:
                break
    
    final_results = diverse_results[:top_n]
    print(f"Returning {len(final_results)} diverse recommendations")
    
    for i, result in enumerate(final_results):
        print(f"  #{i+1}: {result['vehicle']} ({result['powertrain']}) - {result['total_g_per_km']:.1f} g/km")
    
    return final_results
