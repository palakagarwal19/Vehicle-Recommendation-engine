# CarbonWise Quick Start Guide

## Instant Setup (No Installation Required)

Simply open `index.html` in your web browser to start using CarbonWise!

## Running with a Local Server (Recommended)

For the best experience, serve the files with a local web server:

### Option 1: Python (if installed)
```bash
cd carbonwise-app
python -m http.server 8000
```
Then open: http://localhost:8000

### Option 2: Node.js
```bash
cd carbonwise-app
npx http-server -p 8000
```
Then open: http://localhost:8000

### Option 3: PHP
```bash
cd carbonwise-app
php -S localhost:8000
```
Then open: http://localhost:8000

### Option 4: VS Code Live Server
1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Pages Overview

1. **Landing Page** (`index.html`)
   - Hero section with animated background
   - Feature highlights
   - Call-to-action buttons

2. **Compare Page** (`pages/compare.html`)
   - Select up to 3 vehicles
   - Filter by brand, model, year, powertrain, country
   - View comparison charts (bar, stacked, donut)
   - Toggle between g/km, lifetime, and 10-year projections

3. **Recommend Page** (`pages/recommend.html`)
   - Enter your criteria (budget, body type, country, annual km)
   - Get top 3 lowest emission vehicles
   - View sustainability scores and reasoning

4. **Grid Insights** (`pages/grid-insights.html`)
   - Select country to view grid emissions
   - See generation and plug-adjusted intensity
   - Toggle forecast for future projections

5. **Methodology** (`pages/methodology.html`)
   - Learn about calculation methods
   - Expandable accordion sections
   - Data sources and validation

## Customization

### Adding Vehicles
Edit `data/vehicles.json` to add more vehicles:
```json
{
  "id": "unique-id",
  "brand": "Brand Name",
  "model": "Model Name",
  "year": 2024,
  "powertrain": "BEV",
  "country": "US",
  "bodyType": "Sedan",
  "price": 40000,
  "range": 400,
  "lifecycleEmissions": {
    "gPerKm": 85.2,
    "lifetimeKg": 17040,
    "tenYearProjection": 15300
  },
  "manufacturing": {
    "glider": 4200,
    "battery": 8500,
    "fluids": 300,
    "total": 13000
  },
  "operational": {
    "gridIntensity": 450,
    "fuelEmissions": 0,
    "efficiency": 15.5
  }
}
```

### Adding Grid Data
Edit `data/grid.json` to add more countries:
```json
{
  "country": "US",
  "year": 2024,
  "generationIntensity": 420,
  "plugAdjustedIntensity": 450,
  "tdLossPercent": 7.1,
  "trend": "decreasing",
  "forecast": [
    { "year": 2025, "projectedIntensity": 410 }
  ]
}
```

### Changing Colors
Edit `styles/variables.css` to customize the theme:
```css
:root {
  --color-primary-black: #0D0D0D;
  --color-carbon-grey: #1A1A1A;
  --color-eco-green: #00C853;
  --color-soft-green: #69F0AE;
}
```

## Troubleshooting

### Charts not displaying
- Make sure you're serving the files with a web server (not just opening the file)
- Check browser console for errors
- Ensure Chart.js CDN is accessible

### Data not loading
- Verify JSON files are valid (use JSONLint.com)
- Check browser console for fetch errors
- Ensure files are served from a web server

### Mobile menu not working
- Check that `scripts/navigation.js` is loaded
- Verify no JavaScript errors in console

## Next Steps

1. Add more vehicle data to `data/vehicles.json`
2. Customize colors and styling in `styles/variables.css`
3. Add your own logo to `assets/`
4. Deploy to a web hosting service (Netlify, Vercel, GitHub Pages)

## Support

For issues or questions, check the README.md file or contact: contact@carbonwise.example
