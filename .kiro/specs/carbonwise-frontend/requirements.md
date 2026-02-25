# Requirements Document: CarbonWise Frontend

## Introduction

CarbonWise is a modern, responsive web platform for comparing vehicle lifecycle carbon emissions. The platform enables users to analyze and compare manufacturing, grid, and fuel lifecycle emissions across different vehicles, providing data-driven insights for sustainable vehicle choices.

**Technology Approach**: Pure HTML, CSS, and vanilla JavaScript (no frameworks). The application uses static HTML pages with CSS for styling and vanilla JavaScript for interactivity and data visualization.

## Glossary

- **Frontend**: The React-based web application user interface
- **Vehicle**: An automobile with associated carbon emission data
- **Lifecycle_Emissions**: Total carbon emissions including manufacturing, operational, and fuel components (measured in g/km)
- **Manufacturing_Emissions**: Carbon emissions from vehicle production including glider, battery, and fluids
- **Operational_Emissions**: Carbon emissions from vehicle operation including grid intensity and fuel consumption
- **Grid_Intensity**: Carbon emissions per unit of electricity generation (g/kWh)
- **Carbon_Breakeven**: Distance at which a vehicle's total lifecycle emissions equal another vehicle's emissions
- **GREET_Model**: Greenhouse gases, Regulated Emissions, and Energy use in Technologies model
- **WLTP**: Worldwide Harmonized Light Vehicles Test Procedure
- **T&D_Loss**: Transmission and Distribution loss percentage
- **Powertrain**: Vehicle propulsion system type (BEV, PHEV, ICE, Hybrid)

## Requirements

### Requirement 1: Landing Page Display

**User Story:** As a visitor, I want to see a compelling landing page, so that I understand the platform's purpose and can navigate to key features.

#### Acceptance Criteria

1. WHEN a user visits the root URL, THE Frontend SHALL display a hero section with headline "Compare True Vehicle Carbon Impact"
2. WHEN the landing page loads, THE Frontend SHALL display a subheadline "Manufacturing + Grid + Fuel Lifecycle Emissions"
3. THE Frontend SHALL display three CTA buttons: "Compare Vehicles", "Get Recommendation", and "View Methodology"
4. WHEN the landing page is displayed, THE Frontend SHALL render a subtle animated eco line graph background
5. THE Frontend SHALL display feature highlights including "GREET Manufacturing Model", "Real Grid Emissions", and "WLTP + Fuel Lifecycle"
6. WHEN a user clicks a CTA button, THE Frontend SHALL navigate to the corresponding page

### Requirement 2: Multi-Vehicle Comparison

**User Story:** As a user, I want to compare up to 3 vehicles side-by-side, so that I can evaluate their relative carbon impacts.

#### Acceptance Criteria

1. WHEN a user accesses the comparison page, THE Frontend SHALL provide vehicle selection with filters for Brand, Model, Year, Powertrain, and Country
2. THE Frontend SHALL allow selection of up to 3 vehicles simultaneously
3. WHEN a user attempts to select more than 3 vehicles, THE Frontend SHALL prevent the selection and maintain the current state
4. WHEN vehicles are selected, THE Frontend SHALL display lifecycle emissions (g/km), manufacturing emissions, operational emissions, and carbon break-even distance for each vehicle
5. WHEN comparison data is displayed, THE Frontend SHALL render a grouped bar chart comparing all selected vehicles
6. WHEN comparison data is displayed, THE Frontend SHALL render a stacked lifecycle breakdown chart
7. WHEN comparison data is displayed, THE Frontend SHALL render a donut chart for each vehicle
8. THE Frontend SHALL provide a toggle to switch between g/km, lifetime total (kg), and 10-year projection views
9. WHEN the user changes the unit toggle, THE Frontend SHALL update all displayed values and charts accordingly

### Requirement 3: Vehicle Detail Display

**User Story:** As a user, I want to view detailed information about a specific vehicle, so that I can understand its complete carbon footprint breakdown.

#### Acceptance Criteria

1. WHEN a user navigates to /vehicle/:id, THE Frontend SHALL display the vehicle name, year, and powertrain badge
2. WHEN a vehicle detail page loads, THE Frontend SHALL display a country-specific lifecycle summary
3. WHEN displaying manufacturing data, THE Frontend SHALL show breakdown by Glider, Battery, and Fluids
4. WHEN displaying operational data, THE Frontend SHALL show breakdown by Grid intensity and Fuel emissions
5. WHEN a vehicle detail page loads, THE Frontend SHALL render an interactive lifecycle pie chart
6. WHEN a vehicle detail page loads, THE Frontend SHALL render a carbon intensity timeline chart
7. THE Frontend SHALL display a "Compare with another car" button
8. THE Frontend SHALL display an "Add to recommendation pool" button
9. WHEN a user clicks "Compare with another car", THE Frontend SHALL navigate to the comparison page with the current vehicle pre-selected

### Requirement 4: Vehicle Recommendation

**User Story:** As a user, I want to receive personalized vehicle recommendations based on my criteria, so that I can find the most sustainable option for my needs.

#### Acceptance Criteria

1. WHEN a user navigates to /recommend, THE Frontend SHALL display input fields for Budget range, Body type, Country, Annual km driven, Preferred powertrain, and Grid decarbonization toggle
2. WHEN a user submits recommendation criteria, THE Frontend SHALL display the top 3 lowest lifecycle emission vehicles
3. WHEN recommendations are displayed, THE Frontend SHALL show vehicles ranked by sustainability score
4. WHEN recommendations are displayed, THE Frontend SHALL apply color-coded sustainability scores
5. WHEN recommendations are displayed, THE Frontend SHALL include a comparison snapshot for each vehicle
6. WHEN recommendations are displayed, THE Frontend SHALL include a "Why recommended" section explaining the selection rationale

### Requirement 5: Grid Insights Visualization

**User Story:** As a user, I want to explore grid emission data by country, so that I can understand how electricity generation impacts vehicle emissions.

#### Acceptance Criteria

1. WHEN a user accesses the grid insights page, THE Frontend SHALL display a country selector
2. WHEN a country is selected, THE Frontend SHALL render a line chart showing generation intensity and plug-adjusted intensity over time
3. WHEN grid data is displayed, THE Frontend SHALL show the T&D loss percentage
4. WHEN grid data is displayed, THE Frontend SHALL show the year trend
5. THE Frontend SHALL provide a forecast toggle for future projections
6. WHEN the forecast toggle is activated, THE Frontend SHALL update the line chart to include projected future values

### Requirement 6: Methodology Documentation

**User Story:** As a user, I want to understand the calculation methodology, so that I can trust the platform's data and analysis.

#### Acceptance Criteria

1. WHEN a user navigates to the methodology page, THE Frontend SHALL display expandable accordions for Manufacturing, Grid Intensity, Operational, and Validation sections
2. WHEN a user clicks an accordion, THE Frontend SHALL expand to show detailed methodology information
3. WHEN the methodology page loads, THE Frontend SHALL display a validation badge
4. WHEN the methodology page loads, THE Frontend SHALL display a list of data sources including Ember, GREET, EEA, and World Bank

### Requirement 7: Visual Design System

**User Story:** As a user, I want a consistent, premium visual experience, so that the platform feels professional and trustworthy.

#### Acceptance Criteria

1. THE Frontend SHALL apply primary color deep black (#0D0D0D) to main backgrounds
2. THE Frontend SHALL apply secondary color carbon grey (#1A1A1A) to card backgrounds
3. THE Frontend SHALL apply primary accent eco green (#00C853) to primary actions and highlights
4. THE Frontend SHALL apply secondary accent soft green (#69F0AE) to secondary highlights
5. WHEN displaying interactive elements, THE Frontend SHALL apply subtle neon green glow effects on hover
6. THE Frontend SHALL use glassmorphism dark cards with 16px rounded corners
7. THE Frontend SHALL use Inter or Poppins typography with bold headings
8. WHEN displaying charts, THE Frontend SHALL use neon green gradient colors on black backgrounds
9. THE Frontend SHALL apply eco green styling to primary buttons
10. THE Frontend SHALL apply outline styling to secondary buttons

### Requirement 8: Responsive Layout

**User Story:** As a user on any device, I want the interface to adapt to my screen size, so that I can access the platform from desktop, tablet, or mobile.

#### Acceptance Criteria

1. WHEN the viewport width changes, THE Frontend SHALL adjust layout to maintain usability
2. THE Frontend SHALL implement mobile-first responsive design
3. WHEN displayed on mobile devices, THE Frontend SHALL stack comparison cards vertically
4. WHEN displayed on desktop devices, THE Frontend SHALL display comparison cards horizontally
5. THE Frontend SHALL maintain accessible contrast ratios across all screen sizes

### Requirement 9: User Experience Enhancements

**User Story:** As a user, I want smooth, polished interactions, so that the platform feels modern and responsive.

#### Acceptance Criteria

1. WHEN UI state changes occur, THE Frontend SHALL apply smooth CSS transitions
2. WHEN numeric values update, THE Frontend SHALL animate the number changes
3. WHEN data is loading, THE Frontend SHALL display loading skeleton components
4. WHEN an error occurs, THE Frontend SHALL display a user-friendly error message
5. WHEN an error occurs, THE Frontend SHALL provide recovery options or guidance
6. THE Frontend SHALL complete all transitions within 300ms for perceived responsiveness

### Requirement 10: Footer and Navigation

**User Story:** As a user, I want consistent navigation and footer information, so that I can easily access different sections and find platform information.

#### Acceptance Criteria

1. THE Frontend SHALL display a footer on all pages with CarbonWise branding
2. WHEN the footer is displayed, THE Frontend SHALL show data sources
3. WHEN the footer is displayed, THE Frontend SHALL show a GitHub link
4. WHEN the footer is displayed, THE Frontend SHALL show a contact email
5. THE Frontend SHALL provide navigation between all major pages
6. WHEN a user clicks a navigation link, THE Frontend SHALL navigate to the corresponding page without full page reload

### Requirement 11: Component Architecture

**User Story:** As a developer, I want a modular code structure, so that the codebase is maintainable and scalable.

#### Acceptance Criteria

1. THE Frontend SHALL implement modular HTML pages with reusable CSS classes
2. THE Frontend SHALL use custom CSS for styling without inline styles
3. THE Frontend SHALL organize files in a modular directory structure (pages/, styles/, scripts/, assets/)
4. THE Frontend SHALL implement clean JavaScript module patterns for state management
5. THE Frontend SHALL use Chart.js library for all data visualizations
6. WHEN rendering charts, THE Frontend SHALL use reusable chart initialization functions

### Requirement 12: Data Display Accuracy

**User Story:** As a user, I want accurate and consistent data presentation, so that I can make informed decisions.

#### Acceptance Criteria

1. WHEN displaying emission values, THE Frontend SHALL format numbers with appropriate precision (1 decimal place for g/km)
2. WHEN displaying large numbers, THE Frontend SHALL use thousand separators for readability
3. WHEN displaying percentages, THE Frontend SHALL show values with 1 decimal place
4. WHEN displaying currency, THE Frontend SHALL format according to the selected country's conventions
5. WHEN data is unavailable, THE Frontend SHALL display "N/A" or appropriate placeholder text
6. THE Frontend SHALL maintain consistent units across all pages for the same metric type
