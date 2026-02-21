from engine import *

daily_km = 40
years = 10
country = "India"

bev = vehicles[0]
ice = vehicles[1]

bev_total = total_emissions(bev, daily_km, years, country)
ice_total = total_emissions(ice, daily_km, years, country)

print("BEV total tons CO2:", round(bev_total/1000,2))
print("ICE total tons CO2:", round(ice_total/1000,2))
print("Break-even km:", round(break_even_km(bev, ice, country),0))
if bev_total < ice_total:
    print("Recommendation: BUY BEV")
else:
    print("Recommendation: BUY ICE")