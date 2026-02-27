def detect_greenwashing(vehicle_lifecycle, vehicle_meta, search_web=False):

    flags = []
    misleading_claims = []
    web_claims = []

    powertrain = vehicle_meta.get("type")
    brand = vehicle_meta.get("brand")
    model = vehicle_meta.get("model")
    year = vehicle_meta.get("year")
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
            "transparency_score": 50,
            "actual_lifecycle": None,
            "misleading_claims": [],
            "web_claims": []
        }

    print(f"Greenwashing analysis: type={powertrain}, total={total}, op={operational}, manuf={manufacturing}")

    # ===== WEB SEARCH FOR MARKETING CLAIMS (if enabled) =====
    if search_web and brand and model:
        try:
            from web_search import search_marketing_claims
            web_claims = search_marketing_claims(brand, model, year, total, operational, manufacturing, powertrain)
            print(f"Found {len(web_claims)} web marketing claims")
        except Exception as e:
            print(f"Web search failed: {e}")
            web_claims = []

    # ===== MISLEADING MARKETING PRACTICES DETECTION =====
    # These are common misleading practices, not specific claims from our data
    
    # 1. "Zero Emissions" marketing for EVs (common practice)
    if powertrain == "EV":
        if manufacturing > 0 or operational > 0:
            hidden_emissions = manufacturing + operational
            misleading_claims.append({
                "practice": "Zero Emissions Marketing",
                "common_claim": "Manufacturers often market EVs as 'zero emissions' vehicles",
                "reality": f"Total lifecycle: {total:.0f} g/km (Manufacturing: {manufacturing:.0f} g/km, Grid: {operational:.0f} g/km)",
                "severity": "high" if total > 100 else "medium"
            })
            flags.append(f"Common 'zero emissions' marketing ignores {hidden_emissions:.0f} g/km from manufacturing and grid")
    
    # 2. Tailpipe-only focus (common industry practice)
    if powertrain in ["ICE", "HEV", "PHEV"]:
        hidden_manufacturing_percent = (manufacturing / total) * 100
        
        if hidden_manufacturing_percent > 20:
            misleading_claims.append({
                "practice": "Tailpipe-Only Reporting",
                "common_claim": "Industry typically reports only tailpipe/operational emissions",
                "reality": f"Full lifecycle: {total:.0f} g/km (includes {manufacturing:.0f} g/km manufacturing - {hidden_manufacturing_percent:.0f}% of total)",
                "severity": "medium"
            })
            flags.append(f"Standard practice shows only operational emissions, hides {manufacturing:.0f} g/km manufacturing")

    # 3. "Eco" or "Green" branding with high lifecycle emissions
    if powertrain == "EV" and total > 150:
        misleading_claims.append({
            "practice": "Eco-Friendly Branding",
            "common_claim": "EVs commonly marketed as 'eco-friendly' or 'green' vehicles",
            "reality": f"High lifecycle emissions: {total:.0f} g/km (dirty grid + heavy battery manufacturing)",
            "severity": "high"
        })
        flags.append(f"'Eco' branding potentially misleading with {total:.0f} g/km lifecycle emissions")
    
    if powertrain in ["HEV", "PHEV"] and total > 180:
        misleading_claims.append({
            "practice": "Hybrid Efficiency Claims",
            "common_claim": "Hybrids marketed as significantly more efficient than conventional vehicles",
            "reality": f"Lifecycle emissions {total:.0f} g/km only marginally better than efficient ICE (~180 g/km)",
            "severity": "medium"
        })
        flags.append(f"Hybrid marketing may overstate benefits: {total:.0f} g/km lifecycle")

    # 4. Manufacturing burden hidden in marketing
    manuf_percentage = (manufacturing / total) * 100 if total > 0 else 0
    if manuf_percentage > 50:
        misleading_claims.append({
            "practice": "Manufacturing Emissions Omission",
            "common_claim": "Marketing focuses on operational efficiency, rarely mentions manufacturing",
            "reality": f"Manufacturing dominates: {manuf_percentage:.0f}% of lifecycle emissions ({manufacturing:.0f} g/km)",
            "severity": "high"
        })
        flags.append(f"Marketing typically ignores that {manuf_percentage:.0f}% of emissions are from manufacturing")

    # 5. Grid dependency for EVs (not disclosed in marketing)
    if powertrain == "EV" and operational > 80:
        grid_percentage = (operational / total) * 100
        misleading_claims.append({
            "practice": "Grid Dependency Omission",
            "common_claim": "EV marketing rarely discloses grid electricity source impact",
            "reality": f"Grid-dependent: {operational:.0f} g/km from electricity ({grid_percentage:.0f}% of total) - not clean in all regions",
            "severity": "high"
        })
        flags.append(f"EV marketed as 'clean' but grid contributes {operational:.0f} g/km in this region")

    # 6. Unrealistic comparison baselines
    if powertrain == "EV" and total < 100:
        # Good performance, but check if comparisons are fair
        misleading_claims.append({
            "practice": "Comparison Baseline Selection",
            "common_claim": "EVs often compared to high-emission vehicles (300+ g/km) rather than efficient alternatives",
            "reality": f"This EV: {total:.0f} g/km. Should compare to efficient ICE (~180 g/km) for fair assessment",
            "severity": "low"
        })

    # Calculate risk level based on severity
    risk_level = "low"
    high_severity_count = sum(1 for claim in misleading_claims if claim.get("severity") == "high")
    
    if high_severity_count >= 2 or len(flags) >= 4:
        risk_level = "high"
    elif high_severity_count >= 1 or len(flags) >= 2:
        risk_level = "medium"
    
    # Calculate transparency score
    transparency_score = 100
    for claim in misleading_claims:
        if claim["severity"] == "high":
            transparency_score -= 20
        elif claim["severity"] == "medium":
            transparency_score -= 10
        else:
            transparency_score -= 5
    transparency_score = max(0, transparency_score)
    
    print(f"Greenwashing flags: {len(flags)} flags")
    print(f"Misleading practices: {len(misleading_claims)} practices")
    print(f"Web claims found: {len(web_claims)} claims")
    
    return {
        "is_greenwashing_risk": len(flags) > 0,
        "risk_level": risk_level,
        "indicators": flags,
        "findings": flags,
        "transparency_score": transparency_score,
        "actual_lifecycle": total,
        "misleading_claims": misleading_claims,
        "web_claims": web_claims
    }

    flags = []
    misleading_claims = []

    powertrain = vehicle_meta.get("type")
    total = vehicle_lifecycle.get("total_g_per_km")
    operational = vehicle_lifecycle.get("operational_g_per_km")
    manufacturing = vehicle_lifecycle.get("manufacturing_g_per_km")
    
    # Get manufacturer's claimed emissions (WLTP - lab test conditions)
    claimed_co2 = vehicle_meta.get("co2_wltp_gpkm")

    # Handle None values
    if total is None or operational is None or manufacturing is None:
        return {
            "is_greenwashing_risk": False,
            "risk_level": "low",
            "indicators": ["Insufficient data for greenwashing analysis"],
            "findings": ["Insufficient data for greenwashing analysis"],
            "transparency_score": 50,
            "claimed_emissions": None,
            "actual_lifecycle": None,
            "hidden_emissions_percent": None,
            "misleading_claims": []
        }

    print(f"Greenwashing analysis: type={powertrain}, total={total}, op={operational}, manuf={manufacturing}, claimed={claimed_co2}")

    # ===== MISLEADING MARKETING CLAIMS DETECTION =====
    
    # 1. "Zero Emissions" claims for EVs (ignoring manufacturing and grid)
    if powertrain == "EV":
        if manufacturing > 0 or operational > 0:
            hidden_emissions = manufacturing + operational
            misleading_claims.append({
                "claim": "Zero Emissions Vehicle",
                "reality": f"Total lifecycle: {total:.0f} g/km (Manufacturing: {manufacturing:.0f} g/km, Grid: {operational:.0f} g/km)",
                "severity": "high" if total > 100 else "medium"
            })
            flags.append(f"'Zero emissions' marketing ignores {hidden_emissions:.0f} g/km from manufacturing and grid")
    
    # 2. Tailpipe-only claims (ignoring manufacturing)
    if claimed_co2 is not None and claimed_co2 > 0:
        # WLTP only measures tailpipe emissions, not lifecycle
        hidden_manufacturing_percent = (manufacturing / total) * 100
        
        if powertrain in ["ICE", "HEV", "PHEV"]:
            misleading_claims.append({
                "claim": f"Official emissions: {claimed_co2:.0f} g/km (WLTP tailpipe only)",
                "reality": f"Full lifecycle: {total:.0f} g/km (includes {manufacturing:.0f} g/km manufacturing)",
                "severity": "medium" if hidden_manufacturing_percent > 20 else "low"
            })
            
            if hidden_manufacturing_percent > 20:
                flags.append(f"Marketing shows only tailpipe ({claimed_co2:.0f} g/km), hides {manufacturing:.0f} g/km manufacturing")
        
        # 3. WLTP vs Real-World discrepancy (WLTP is lab test, typically 20-30% lower than real-world)
        # We can estimate real-world would be ~25% higher than WLTP
        estimated_real_world = claimed_co2 * 1.25
        if operational > estimated_real_world:
            real_world_gap = ((operational - claimed_co2) / claimed_co2) * 100
            misleading_claims.append({
                "claim": f"WLTP test: {claimed_co2:.0f} g/km (lab conditions)",
                "reality": f"Real-world estimate: {operational:.0f} g/km ({real_world_gap:.0f}% higher)",
                "severity": "high" if real_world_gap > 40 else "medium"
            })
            flags.append(f"Lab test ({claimed_co2:.0f} g/km) vs real-world ({operational:.0f} g/km) - {real_world_gap:.0f}% gap")

    # 4. "Eco" or "Green" branding with high lifecycle emissions
    if powertrain == "EV" and total > 150:
        misleading_claims.append({
            "claim": "Eco-friendly / Green vehicle",
            "reality": f"High lifecycle emissions: {total:.0f} g/km (dirty grid + heavy battery)",
            "severity": "high"
        })
        flags.append(f"'Eco' branding misleading with {total:.0f} g/km lifecycle emissions")
    
    if powertrain in ["HEV", "PHEV"] and total > 180:
        misleading_claims.append({
            "claim": "Hybrid efficiency",
            "reality": f"Lifecycle emissions {total:.0f} g/km barely better than efficient ICE",
            "severity": "medium"
        })
        flags.append(f"Hybrid marketing overstates benefits: {total:.0f} g/km lifecycle")

    # 5. Manufacturing burden hidden in marketing
    manuf_percentage = (manufacturing / total) * 100 if total > 0 else 0
    if manuf_percentage > 50:
        misleading_claims.append({
            "claim": "Focus on operational efficiency",
            "reality": f"Manufacturing dominates: {manuf_percentage:.0f}% of lifecycle emissions",
            "severity": "high"
        })
        flags.append(f"Marketing ignores that {manuf_percentage:.0f}% of emissions are from manufacturing")

    # 6. Grid dependency for EVs (not disclosed in marketing)
    if powertrain == "EV" and operational > 80:
        grid_percentage = (operational / total) * 100
        misleading_claims.append({
            "claim": "Clean electric vehicle",
            "reality": f"Grid-dependent: {operational:.0f} g/km from dirty electricity ({grid_percentage:.0f}% of total)",
            "severity": "high"
        })
        flags.append(f"EV marketed as 'clean' but grid contributes {operational:.0f} g/km")

    # 7. Comparison manipulation (comparing EV to worst ICE, not average)
    if powertrain == "EV" and total < 100:
        # This is actually good, but check if marketing compares to unrealistic ICE baseline
        misleading_claims.append({
            "claim": "Potential: Compared to 'average' 300+ g/km ICE",
            "reality": f"Should compare to efficient ICE (~180 g/km). This EV: {total:.0f} g/km",
            "severity": "low"
        })

    # Calculate risk level
    risk_level = "low"
    high_severity_count = sum(1 for claim in misleading_claims if claim.get("severity") == "high")
    
    if high_severity_count >= 2 or len(flags) >= 4:
        risk_level = "high"
    elif high_severity_count >= 1 or len(flags) >= 2:
        risk_level = "medium"
    
    # Calculate transparency score
    transparency_score = 100
    for claim in misleading_claims:
        if claim["severity"] == "high":
            transparency_score -= 20
        elif claim["severity"] == "medium":
            transparency_score -= 10
        else:
            transparency_score -= 5
    transparency_score = max(0, transparency_score)
    
    # Calculate hidden emissions percentage
    hidden_emissions_percent = None
    if claimed_co2 and claimed_co2 > 0:
        hidden_emissions = total - claimed_co2
        hidden_emissions_percent = (hidden_emissions / total) * 100
    
    print(f"Greenwashing flags: {len(flags)} flags")
    print(f"Misleading claims: {len(misleading_claims)} claims")
    
    return {
        "is_greenwashing_risk": len(flags) > 0,
        "risk_level": risk_level,
        "indicators": flags,
        "findings": flags,
        "transparency_score": transparency_score,
        "claimed_emissions": claimed_co2,
        "actual_lifecycle": total,
        "hidden_emissions_percent": hidden_emissions_percent,
        "misleading_claims": misleading_claims
    }
