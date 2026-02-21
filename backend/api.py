from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .engine import vehicles, total_emissions, break_even_km

app = FastAPI()

# Allow browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "CarbonWise API Running"}

@app.get("/compare")
def compare(daily_km: int = 40, years: int = 10, country: str = "India"):
    bev = vehicles[0]
    ice = vehicles[1]

    bev_total = total_emissions(bev, daily_km, years, country)
    ice_total = total_emissions(ice, daily_km, years, country)

    return {
        "bev_total_kg": bev_total,
        "ice_total_kg": ice_total,
        "break_even_km": break_even_km(bev, ice, country),
        "recommendation": "BUY BEV" if bev_total < ice_total else "BUY ICE"
    }