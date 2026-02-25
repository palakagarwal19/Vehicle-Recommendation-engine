# Implementation Plan: CarbonWise Frontend (HTML/CSS/JS)

## Overview

This implementation plan builds CarbonWise using pure HTML, CSS, and vanilla JavaScript. The approach focuses on creating static HTML pages with modular CSS and JavaScript for a fast, lightweight application.

## Tasks

- [ ] 1. Project setup and structure
  - Create directory structure: pages/, styles/, scripts/, assets/, data/
  - Create base HTML template with meta tags and viewport settings
  - Set up CSS variables for theme colors (#0D0D0D, #1A1A1A, #00C853, #69F0AE)
  - Create main stylesheet with reset and base styles
  - Include Chart.js CDN

- [ ] 2. Create shared CSS components
  - Create button styles (primary, secondary, outline variants)
  - Create card styles with glassmorphism effect
  - Create loading skeleton animations
  - Create typography styles (Inter/Poppins fonts)
  - Create utility classes for spacing, colors, transitions

- [ ] 3. Create shared JavaScript utilities
  - Create number formatting functions (formatters.js)
  - Create currency formatting with localization
  - Create missing data placeholder utility
  - Create chart configuration helpers
  - Create state management module (localStorage wrapper)

- [ ] 4. Build landing page (index.html)
  - Create hero section with headline and subheadline
  - Add three CTA buttons with navigation
  - Create animated SVG background
  - Add feature highlights section
  - Style with responsive CSS

- [ ] 5. Build comparison page (compare.html)
  - Create vehicle selector with filter dropdowns
  - Create comparison grid layout
  - Add unit toggle buttons
  - Create chart containers for bar, stacked, and donut charts
  - Add JavaScript for vehicle selection logic (max 3)
  - Initialize Chart.js charts with data

- [ ] 6. Build vehicle detail page (vehicle.html)
  - Create vehicle header with name, year, badge
  - Add lifecycle summary card
  - Create manufacturing breakdown section
  - Create operational breakdown section
  - Add interactive pie chart with Chart.js
  - Add carbon intensity timeline chart
  - Add action buttons (Compare, Add to pool)

- [ ] 7. Build recommendation page (recommend.html)
  - Create criteria form with inputs
  - Add form validation JavaScript
  - Create results display section
  - Add sustainability score cards with color coding
  - Create comparison snapshot section
  - Add reasoning section

- [ ] 8. Build grid insights page (grid-insights.html)
  - Create country selector dropdown
  - Add line chart for intensity data
  - Create metrics display section
  - Add forecast toggle
  - Implement chart update logic

- [ ] 9. Build methodology page (methodology.html)
  - Create accordion sections with JavaScript
  - Add validation badge
  - Create data sources list with external links
  - Style expandable content

- [ ] 10. Create navigation and footer
  - Build navigation bar component (reusable across pages)
  - Create footer with branding, sources, links
  - Add mobile hamburger menu
  - Implement smooth navigation

- [ ] 11. Add interactivity and animations
  - Create animated number counter
  - Add smooth transitions to all interactive elements
  - Implement hover glow effects
  - Add loading states
  - Create error message displays

- [ ] 12. Implement responsive design
  - Add media queries for mobile, tablet, desktop
  - Test all pages at different breakpoints
  - Ensure touch-friendly interactions
  - Optimize for mobile-first

- [ ] 13. Add accessibility features
  - Add ARIA labels to interactive elements
  - Implement keyboard navigation
  - Add skip navigation link
  - Ensure color contrast ratios
  - Test with screen readers

- [ ] 14. Create mock data and API integration
  - Create JSON files for vehicle data
  - Create JSON files for grid data
  - Write JavaScript to fetch and parse data
  - Implement error handling for data loading

- [ ] 15. Final polish and testing
  - Test all pages and interactions
  - Optimize performance (minify CSS/JS)
  - Add meta tags for SEO
  - Test cross-browser compatibility
  - Validate HTML/CSS

## Notes

- All styling via external CSS files (no inline styles)
- Use CSS Grid and Flexbox for layouts
- Chart.js for all data visualizations
- LocalStorage for state persistence
- Vanilla JavaScript ES6+ modules
- No build process required - static files
