#!/usr/bin/env python3
"""
Check what data the vehicle has
"""

from engine import get_vehicle, get_greet_wtw
import json

print("Checking vehicle data...")

vehicles = get_vehicle({
    "brand": "AM General",
    "model": "DJ Po Vehicle 2WD",
    "Year": 1984
})

if vehicles:
    vehicle = vehicles[0]
    print("\nVehicle data:")
    print(json.dumps(vehicle, indent=2))
    
    print("\n" + "=" * 60)
    print("Checking GREET WTW lookup...")
    print(f"Vehicle type: {vehicle.get('type')}")
    print(f"Fuel type: {vehicle.get('fuel_type')}")
    
    wtw = get_greet_wtw(vehicle)
    print(f"GREET WTW result: {wtw}")
    
    if wtw is None:
        print("\n❌ GREET WTW is None!")
        print("This vehicle is missing fuel_type information")
        print("\nFor ICE vehicles, we need:")
        print("  - fuel_type: 'gasoline', 'petrol', or 'diesel'")
