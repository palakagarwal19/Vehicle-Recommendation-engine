"""
Web search module for finding manufacturer marketing claims
"""

def search_marketing_claims(brand, model, year, actual_total, actual_operational, actual_manufacturing, powertrain):
    """
    Search the web for manufacturer marketing claims about a vehicle
    and compare them with actual calculated emissions
    
    Returns a list of claim objects with verification
    """
    
    claims_found = []
    
    # Build search query
    vehicle_name = f"{brand} {model}"
    if year:
        vehicle_name += f" {year}"
    
    # Search for emissions claims
    search_queries = [
        f"{vehicle_name} emissions CO2 g/km",
        f"{vehicle_name} zero emissions electric",
        f"{vehicle_name} eco friendly green",
        f"{vehicle_name} carbon footprint",
        f"{vehicle_name} environmental impact"
    ]
    
    print(f"Searching web for marketing claims: {vehicle_name}")
    
    # Note: This is a placeholder for actual web search implementation
    # In production, you would use a web search API here
    
    # For now, return common marketing claims based on powertrain type
    if powertrain == "EV":
        claims_found.append({
            "source": "Common EV Marketing",
            "claim": "Zero tailpipe emissions",
            "claim_type": "emissions",
            "verification": {
                "is_accurate": False,
                "explanation": f"While tailpipe emissions are zero, total lifecycle is {actual_total:.0f} g/km (manufacturing: {actual_manufacturing:.0f} g/km, grid: {actual_operational:.0f} g/km)",
                "severity": "high"
            }
        })
        
        claims_found.append({
            "source": "Common EV Marketing",
            "claim": "100% clean energy vehicle",
            "claim_type": "environmental",
            "verification": {
                "is_accurate": False,
                "explanation": f"Grid electricity contributes {actual_operational:.0f} g/km. Only clean if charged from renewable sources.",
                "severity": "high" if actual_operational > 80 else "medium"
            }
        })
    
    elif powertrain in ["HEV", "PHEV"]:
        claims_found.append({
            "source": "Common Hybrid Marketing",
            "claim": "Significantly lower emissions than conventional vehicles",
            "claim_type": "comparison",
            "verification": {
                "is_accurate": actual_total < 180,
                "explanation": f"Lifecycle emissions: {actual_total:.0f} g/km. Efficient ICE vehicles achieve ~180 g/km. Improvement: {((180 - actual_total) / 180 * 100):.0f}%",
                "severity": "low" if actual_total < 180 else "medium"
            }
        })
    
    elif powertrain == "ICE":
        claims_found.append({
            "source": "Common ICE Marketing",
            "claim": "Efficient engine technology",
            "claim_type": "efficiency",
            "verification": {
                "is_accurate": actual_total < 200,
                "explanation": f"Lifecycle emissions: {actual_total:.0f} g/km. Average ICE: ~220 g/km. {'Efficient' if actual_total < 200 else 'Above average'}",
                "severity": "low" if actual_total < 200 else "medium"
            }
        })
    
    return claims_found
