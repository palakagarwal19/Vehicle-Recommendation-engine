#!/usr/bin/env python3
"""
Test EV with grid data
"""

from engine import get_vehicle, calculate_lifecycle

print("Testing EV with US grid data...")
print("=" * 60)

# Find an EV with electric consumption data
vehicles = get_vehicle({"type": "EV"})
ev_with_data = None

for v in vehicles[:100]:
    if v.get("electric_wh_per_km") is not None:
        ev_with_data = v
        break

if not ev_with_data:
    print("❌ No EV found with electric consumption data")
else:
    print(f"✓ Found EV: {ev_with_data['brand']} {ev_with_data['model']} ({ev_with_data['Year']})")
    print(f"  Electric consumption: {ev_with_data['electric_wh_per_km']} Wh/km")
    
    print("\nCalculating lifecycle for US 2023...")
    result = calculate_lifecycle(ev_with_data, "US", 2023)
    
    print(f"\nResult: {result}")
    
    if "error" in result:
        print(f"\n❌ ERROR: {result['error']}")
    else:
        print(f"\n✓ Success!")
        print(f"  Total: {result['total_g_per_km']} g/km")
        print(f"  Manufacturing: {result['manufacturing_g_per_km']} g/km")
        print(f"  Operational: {result['operational_g_per_km']} g/km")
