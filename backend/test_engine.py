from engine import get_vehicle, calculate_operational

vehicles = get_vehicle({
    "brand": "TOYOTA",
    "model": "TOYOTA C-HR",
    "Year": 2024
})

if vehicles:
    result = calculate_operational(
        vehicles[0],
        country_code="POL",  # from your dataset (PL)
        year=2024
    )
    print(result)
else:
    print("Vehicle not found")