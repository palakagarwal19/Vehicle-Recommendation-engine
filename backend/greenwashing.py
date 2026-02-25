def detect_greenwashing(vehicle_lifecycle, vehicle_meta):

    flags = []

    powertrain = vehicle_meta.get("type")
    total = vehicle_lifecycle.get("total_g_per_km")
    operational = vehicle_lifecycle.get("operational_g_per_km")
    manufacturing = vehicle_lifecycle.get("manufacturing_g_per_km")

    # Handle None values
    if total is None or operational is None or manufacturing is None:
        return {
            "is_greenwashing_risk": False,
            "risk_level": "low",
            "indicators": ["Insufficient data for greenwashing analysis"],
            "findings": ["Insufficient data for greenwashing analysis"],
            "transparency_score": 50
        }

    print(f"Greenwashing analysis: type={powertrain}, total={total}, op={operational}, manuf={manufacturing}")

    # 1. EV with high lifecycle emissions (should be < 100 g/km in clean grids)
    if powertrain == "EV" and total > 100:
        flags.append(f"High lifecycle emissions ({total:.0f} g/km) despite zero tailpipe marketing")

    # 2. High manufacturing burden (EVs typically 40-60 g/km)
    if powertrain == "EV" and manufacturing > 50:
        flags.append(f"High manufacturing emissions ({manufacturing:.0f} g/km) - battery production impact")
    
    # 3. Grid dependent emissions (clean grids should be < 50 g/km operational)
    if powertrain == "EV" and operational > 80:
        flags.append(f"High grid intensity ({operational:.0f} g/km) - EV not clean in this region")

    # 4. Hybrid underperformance (should be better than average ICE ~200 g/km)
    if powertrain in ["HEV", "PHEV"] and total > 150:
        flags.append(f"Hybrid lifecycle ({total:.0f} g/km) not significantly better than ICE")

    # 5. ICE marketed as "efficient" but high emissions
    if powertrain == "ICE" and total > 250:
        flags.append(f"High ICE emissions ({total:.0f} g/km) - inefficient combustion")

    # 6. Manufacturing dominates lifecycle (should be < 30% for ICE, < 50% for EV)
    manuf_percentage = (manufacturing / total) * 100 if total > 0 else 0
    if powertrain == "EV" and manuf_percentage > 60:
        flags.append(f"Manufacturing dominates lifecycle ({manuf_percentage:.0f}%) - battery impact too high")
    elif powertrain in ["ICE", "HEV", "PHEV"] and manuf_percentage > 40:
        flags.append(f"Unusually high manufacturing share ({manuf_percentage:.0f}%)")

    # Calculate risk level
    risk_level = "low"
    if len(flags) >= 3:
        risk_level = "high"
    elif len(flags) >= 1:
        risk_level = "medium"
    
    # Calculate transparency score (100 - 15 per flag)
    transparency_score = max(0, 100 - (len(flags) * 15))
    
    print(f"Greenwashing flags: {flags}")
    
    return {
        "is_greenwashing_risk": len(flags) > 0,
        "risk_level": risk_level,
        "indicators": flags,
        "findings": flags,
        "transparency_score": transparency_score
    }
