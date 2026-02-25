#!/usr/bin/env python3
"""
Test all backend modules to ensure they work
"""

from engine import get_vehicle, calculate_lifecycle
from reccomendation import recommend_vehicle
from break_even import break_even_km
from greenwashing import detect_greenwashing
from carbon_index import carbon_score
from annual_impact import annual_emissions
from grid_sensitivity import grid_sensitivity

print("=" * 70)
print("TESTING ALL CARBONWISE MODULES")
print("=" * 70)

# Get a test vehicle
vehicles = get_vehicle({"brand": "Toyota", "model": "Camry", "Year": 2023})
if not vehicles:
    print("❌ No Toyota Camry 2023 found, trying another vehicle...")
    vehicles = get_vehicle({"type": "ICE"})
    if not vehicles:
        print("❌ No vehicles found at all!")
        exit(1)

test_vehicle = vehicles[0]
print(f"\n✓ Using test vehicle: {test_vehicle['brand']} {test_vehicle['model']} ({test_vehicle['Year']})")
print(f"  Type: {test_vehicle['type']}")

# Test 1: Lifecycle Calculation
print("\n" + "=" * 70)
print("1. LIFECYCLE CALCULATION")
print("=" * 70)
try:
    lifecycle = calculate_lifecycle(test_vehicle, "US", 2023)
    if "error" in lifecycle:
        print(f"❌ Error: {lifecycle['error']}")
    else:
        print(f"✓ Success!")
        print(f"  Total: {lifecycle['total_g_per_km']} g/km")
        print(f"  Manufacturing: {lifecycle['manufacturing_g_per_km']} g/km")
        print(f"  Operational: {lifecycle['operational_g_per_km']} g/km")
except Exception as e:
    print(f"❌ Exception: {e}")

# Test 2: Recommendations
print("\n" + "=" * 70)
print("2. RECOMMENDATIONS")
print("=" * 70)
try:
    recommendations = recommend_vehicle(
        daily_km=40,  # ~15,000 km/year
        years=10,
        body_type=None,
        powertrain=None,
        top_n=3
    )
    if isinstance(recommendations, dict) and "error" in recommendations:
        print(f"❌ Error: {recommendations['error']}")
    else:
        print(f"✓ Success! Found {len(recommendations)} recommendations")
        for i, rec in enumerate(recommendations[:3], 1):
            print(f"  {i}. {rec['vehicle']} - {rec['total_g_per_km']} g/km")
except Exception as e:
    print(f"❌ Exception: {e}")

# Test 3: Break-Even (need EV and ICE)
print("\n" + "=" * 70)
print("3. BREAK-EVEN ANALYSIS")
print("=" * 70)
try:
    ev_vehicles = get_vehicle({"type": "EV"})
    ice_vehicles = get_vehicle({"type": "ICE"})
    
    if ev_vehicles and ice_vehicles:
        ev = ev_vehicles[0]
        ice = ice_vehicles[0]
        print(f"  EV: {ev['brand']} {ev['model']}")
        print(f"  ICE: {ice['brand']} {ice['model']}")
        
        result = break_even_km(ev, ice, "US", 2023)
        if "error" in result:
            print(f"❌ Error: {result['error']}")
        else:
            print(f"✓ Success!")
            print(f"  Break-even: {result.get('break_even_km', 'N/A')} km")
    else:
        print("❌ Could not find EV or ICE vehicles")
except Exception as e:
    print(f"❌ Exception: {e}")

# Test 4: Greenwashing Detection
print("\n" + "=" * 70)
print("4. GREENWASHING DETECTION")
print("=" * 70)
try:
    if "error" not in lifecycle:
        vehicle_meta = {
            "type": test_vehicle["type"],
            "brand": test_vehicle["brand"],
            "model": test_vehicle["model"]
        }
        result = detect_greenwashing(lifecycle, vehicle_meta)
        print(f"✓ Success!")
        print(f"  Risk: {result['is_greenwashing_risk']}")
        print(f"  Flags: {len(result['flags'])}")
        for flag in result['flags']:
            print(f"    - {flag}")
    else:
        print("⚠ Skipped (lifecycle failed)")
except Exception as e:
    print(f"❌ Exception: {e}")

# Test 5: Carbon Score
print("\n" + "=" * 70)
print("5. CARBON SCORE")
print("=" * 70)
try:
    if "error" not in lifecycle:
        result = carbon_score(lifecycle['total_g_per_km'])
        print(f"✓ Success!")
        print(f"  Score: {result.get('score', 'N/A')}/100")
        print(f"  Rating: {result.get('rating', 'N/A')}")
    else:
        print("⚠ Skipped (lifecycle failed)")
except Exception as e:
    print(f"❌ Exception: {e}")

# Test 6: Annual Impact
print("\n" + "=" * 70)
print("6. ANNUAL IMPACT")
print("=" * 70)
try:
    if "error" not in lifecycle:
        result = annual_emissions(lifecycle['total_g_per_km'], 15000)
        print(f"✓ Success!")
        print(f"  Annual: {result.get('annual_kg', 'N/A')} kg CO2/year")
    else:
        print("⚠ Skipped (lifecycle failed)")
except Exception as e:
    print(f"❌ Exception: {e}")

# Test 7: Grid Sensitivity
print("\n" + "=" * 70)
print("7. GRID SENSITIVITY")
print("=" * 70)
try:
    countries = ["US", "DE", "FR", "UK", "CN"]
    result = grid_sensitivity(test_vehicle, countries, 2023)
    if isinstance(result, dict) and "error" in result:
        print(f"❌ Error: {result['error']}")
    else:
        print(f"✓ Success! Tested {len(result)} countries")
        for item in result[:3]:
            print(f"  {item['country']}: {item['total_g_per_km']} g/km")
except Exception as e:
    print(f"❌ Exception: {e}")

print("\n" + "=" * 70)
print("ALL TESTS COMPLETE")
print("=" * 70)
