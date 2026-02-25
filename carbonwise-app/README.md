# CarbonWise - Vehicle Lifecycle Carbon Comparison Platform

A modern, responsive web application for comparing vehicle lifecycle carbon emissions using pure HTML, CSS, and vanilla JavaScript.

## Features

- **Landing Page**: Hero section with animated background and feature highlights
- **Vehicle Comparison**: Compare up to 3 vehicles side-by-side with interactive charts
- **Recommendations**: Get personalized vehicle recommendations based on your criteria
- **Grid Insights**: Explore country-specific electricity grid emission data
- **Methodology**: Transparent documentation of calculation methods

## Technology Stack

- **HTML5**: Semantic markup
- **CSS3**: Custom styling with CSS variables, Grid, and Flexbox
- **JavaScript**: Vanilla ES6+ modules
- **Chart.js**: Data visualizations
- **No build process**: Static files served directly

## Design System

### Colors
- Primary Black: `#0D0D0D`
- Carbon Grey: `#1A1A1A`
- Eco Green: `#00C853`
- Soft Green: `#69F0AE`

### Typography
- Font Family: Inter, Poppins
- Headings: Bold (700)
- Body: Regular (400)

### Components
- Glassmorphism cards with 16px border radius
- Eco green hover glow effects
- Smooth transitions (200-300ms)
- Loading skeletons with shimmer animation

## Project Structure

```
carbonwise-app/
├── index.html              # Landing page
├── pages/
│   ├── compare.html        # Vehicle comparison
│   ├── recommend.html      # Recommendations
│   ├── grid-insights.html  # Grid emissions data
│   └── methodology.html    # Documentation
├── styles/
│   ├── variables.css       # CSS variables
│   ├── reset.css           # CSS reset
│   ├── components.css      # Reusable components
│   ├── layout.css          # Layout and navigation
│   ├── landing.css         # Landing page styles
│   ├── compare.css         # Comparison page styles
│   ├── recommend.css       # Recommendation page styles
│   ├── grid.css            # Grid insights styles
│   └── methodology.css     # Methodology page styles
├── scripts/
│   ├── navigation.js       # Mobile navigation
│   ├── animated-bg.js      # Hero background animation
│   ├── formatters.js       # Number formatting utilities
│   ├── compare.js          # Comparison page logic
│   ├── recommend.js        # Recommendation logic
│   ├── grid-insights.js    # Grid data visualization
│   └── methodology.js      # Accordion functionality
├── data/
│   ├── vehicles.json       # Vehicle data
│   └── grid.json           # Grid emissions data
└── assets/                 # Images and icons

```

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (optional, for development)

### Installation

1. Clone or download the repository
2. Open `index.html` in your browser, or
3. Serve with a local web server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js http-server
npx http-server

# Using PHP
php -S localhost:8000
```

4. Navigate to `http://localhost:8000`

## Usage

### Comparing Vehicles
1. Go to the Compare page
2. Use filters to narrow down vehicles
3. Click on vehicles to select (max 3)
4. View comparison charts and metrics
5. Toggle between g/km, lifetime, and 10-year projections

### Getting Recommendations
1. Go to the Recommend page
2. Enter your criteria (budget, body type, country, etc.)
3. Click "Get Recommendations"
4. View top 3 lowest emission vehicles with reasoning

### Exploring Grid Data
1. Go to Grid Insights page
2. Select a country from the dropdown
3. View generation and plug-adjusted intensity
4. Toggle forecast to see future projections

## Data Sources

- **Ember Climate**: Grid intensity data
- **GREET Model**: Manufacturing emissions
- **EEA**: WLTP efficiency data
- **World Bank**: Economic data

## Browser Support

- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- Mobile Safari: iOS 14+
- Chrome Mobile: Android 10+

## Performance

- First Contentful Paint: < 1.5s
- No build process required
- Minimal dependencies (Chart.js only)
- Optimized for mobile-first

## Accessibility

- Semantic HTML5 elements
- ARIA labels on interactive elements
- Keyboard navigation support
- WCAG AA contrast ratios
- Screen reader compatible

## License

© 2026 CarbonWise. All rights reserved.

## Contact

- Email: contact@carbonwise.example
- GitHub: [Link placeholder]
