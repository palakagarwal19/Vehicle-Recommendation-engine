from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from typing import Optional

app = FastAPI(
    title="AFDC Vehicles Proxy API",
    description="Proxy server for the NREL Alternative Fuels Data Center vehicles API",
    version="1.0.0"
)

# Add CORS so your frontend can call this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to your frontend URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Put your AFDC API key here or set it as an environment variable ----
API_KEY = os.getenv("AFDC_API_KEY", "YOUR_API_KEY_HERE")
AFDC_BASE_URL = "https://developer.nrel.gov/api/vehicles/v1/vehicles.json"


@app.get("/v1/vehicles.json", summary="Get all vehicles with full data including images")
async def get_vehicles(
    # Core filters (used by the JS frontend)
    current:           Optional[str] = Query(None, description="Filter to current models only (true/false)"),
    model_year:        Optional[str] = Query(None, description="Comma-separated model year IDs, or 0 for none"),
    fuel_id:           Optional[str] = Query(None, description="Comma-separated fuel IDs ending in -1"),
    category_id:       Optional[str] = Query(None, description="Comma-separated category IDs ending in -1"),
    manufacturer_id:   Optional[str] = Query(None, description="Comma-separated manufacturer IDs ending in -1"),
    all_fuels:         Optional[str] = Query(None, description="Pass 'y' to include all fuels"),
    all_categories:    Optional[str] = Query(None, description="Pass 'y' to include all categories"),
    all_manufacturers: Optional[str] = Query(None, description="Pass 'y' to include all manufacturers"),

    # Pagination / display
    per_page:          Optional[str] = Query(None, description="Number of results per page"),
    display_length:    Optional[str] = Query(None, description="DataTable display length"),
    view_mode:         Optional[str] = Query(None, description="grid or list"),
    search_field:      Optional[str] = Query(None, description="Field to sort by"),
    search_dir:        Optional[str] = Query(None, description="Sort direction (asc/desc)"),
):
    params = {"api_key": API_KEY}

    if current:           params["current"]           = current
    if model_year:        params["model_year"]         = model_year
    if fuel_id:           params["fuel_id"]            = fuel_id
    if category_id:       params["category_id"]        = category_id
    if manufacturer_id:   params["manufacturer_id"]    = manufacturer_id
    if all_fuels:         params["all_fuels"]          = all_fuels
    if all_categories:    params["all_categories"]     = all_categories
    if all_manufacturers: params["all_manufacturers"]  = all_manufacturers
    if per_page:          params["per_page"]           = per_page
    if search_field:      params["search_field"]       = search_field
    if search_dir:        params["search_dir"]         = search_dir

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.get(AFDC_BASE_URL, params=params)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"AFDC API error: {e.response.text}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Could not reach AFDC API: {str(e)}")

        data = response.json()

    # Normalize every vehicle record to include ALL known fields (missing ones become None)
    # These match every field used in the original JS frontend
    all_fields = [
        "id", "class", "manufacturer_name", "model", "model_year",
        "fuel_name", "fuel_code", "fuels", "phev_type",
        "category_name", "vehicle_categories",
        "photo_url", "manufacturer_url",                          # ← image URL is here
        "base_msrp", "seating_capacity", "num_passengers",
        "engine_description", "drivetrain",
        "transmission_make", "heavy_duty_transmission_types",
        "alternative_fuel_economy_city", "alternative_fuel_economy_highway", "alternative_fuel_economy_combined",
        "conventional_fuel_economy_city", "conventional_fuel_economy_highway", "conventional_fuel_economy_combined",
        "fuel_economy_estimated_by_manufacturer",
        "electric_range", "total_range",
        "charging_rate_level_2", "charging_rate_dc_fast",
        "charging_speed_level_1", "charging_speed_level_2", "charging_speed_dc_fast",
        "battery_capacity_kwh",
        "heavy_duty_manufacturer_name", "heavy_duty_weight_class",
        "heavy_duty_emission_certifications",
        "heavy_duty_engines", "heavy_duty_hybrids",
        "notes",
    ]

    if "result" in data and isinstance(data["result"], list):
        data["result"] = [
            {field: vehicle.get(field, None) for field in all_fields}
            for vehicle in data["result"]
        ]

    return data


@app.get("/", summary="Health check")
def root():
    return {
        "status": "running",
        "service": "AFDC Vehicles Proxy",
        "docs": "/docs",
        "vehicles_endpoint": "/v1/vehicles.json"
    }
