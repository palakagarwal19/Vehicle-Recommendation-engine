
🌱 CarbonWise

Vehicle Lifecycle Carbon Comparison Engine

CarbonWise is a scientific vehicle lifecycle emissions platform that compares:

Manufacturing emissions (GREET-based)

Operational emissions (WLTP + Grid-adjusted)

Total lifecycle emissions (g/km & lifetime kg)


It is built using validated datasets including:

GREET 2025 (Manufacturing)

Ember Electricity Data (Grid)

EEA Vehicle CO₂ dataset

World Bank T&D losses



---

🧠 Scientific Methodology

Manufacturing

Based on GREET 2025

Includes:

Glider emissions

Battery emissions

Fluids


Validated against GREET official outputs (<0.3% error)


Operational

ICE: WLTP g/km

EV / HEV / PHEV:

Electric consumption (Wh/km)

Grid intensity (g/kWh)

Plug-adjusted using T&D losses



Lifecycle

Total g/km = Operational g/km + Manufacturing g/km


---

⚙ Backend Setup (Python)

1️⃣ Create Virtual Environment

python -m venv venv

Activate:

Windows:

venv\Scripts\activate

Mac/Linux:

source venv/bin/activate


---

2️⃣ Install Dependencies

pip install flask flask-cors pandas openpyxl


---

3️⃣ Run Backend Server

cd backend
python app.py

Server runs at:

http://127.0.0.1:5000


---

🧪 Validate Manufacturing Model

To verify against official GREET values:

python test_engine.py

Expected result:

Percent Error < 1%
Status: PASS


---

⚡ Grid Setup Instructions

Dataesets already uploaded 

Required Datasets

1. Ember Electricity Dataset


2. World Bank T&D Loss Dataset


3. Official grid intensity for validation (EEA)



Ensure:

plug_intensity = generation_intensity / (1 - loss_rate)

Grid validation error must be:

< 1%


---

🚗 Frontend Setup (React + Tailwind)

1️⃣ Install Node

Download Node.js (v18+ recommended)

Final instructions:
Just install required python modules and start python app.py and then open index.html from carbonapp.



