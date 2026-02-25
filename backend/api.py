from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from engine import vehicles, total_emissions, break_even_km

app = FastAPI()

# Allow browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

