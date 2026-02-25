#!/usr/bin/env python3
"""
Quick test to see if lifecycle calculation works
"""

from engine import get_vehicle, calculate_lifecycle

print("=" * 60)
print("Testing Vehicle Lifecycle Calculation")
print("=" * 60)

# Test 1: Find a vehicle
print("\n1. Searching for AM General DJ Po Vehicle 2WD (1984)...")
vehicles = get_vehicle({
    "brand": "AM General",
    "model": "DJ Po Vehicle 2WD",
    "Year": 1984
})

if not vehicles:
    print("❌ Vehicle not found!")
else:
    print(f"✓ Found vehicle: {vehicles[0].get('model')}")
    print(f"  Type: {vehicles[0].get('type')}")
    print(f"  Brand: {vehicles[0].get('brand')}")
    print(f"  Year: {vehicles[0].get('Year')}")
    print(f"  CO2 WLTP: {vehicles[0].get('co2_wltp_gpkm')}")
    
    # Test 2: Calculate lifecycle
    print("\n2. Calculating lifecycle for US 2023...")
    result = calculate_lifecycle(vehicles[0], "US", 2023)
    
    print("\nResult:")
    print(f"  {result}")
    
    if "error" in result:
        print(f"\n❌ ERROR: {result['error']}")
    else:
        print(f"\n✓ Success!")
        print(f"  Total: {result.get('total_g_per_km')} g/km")
        print(f"  Manufacturing: {result.get('manufacturing_g_per_km')} g/km")
        print(f"  Operational: {result.get('operational_g_per_km')} g/km")

print("\n" + "=" * 60)
print("Test Complete")
print("=" * 60)
