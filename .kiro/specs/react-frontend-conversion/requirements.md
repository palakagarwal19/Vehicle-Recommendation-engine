# Requirements Document

## Introduction

This document specifies the requirements for converting the existing CarbonWise HTML/CSS/JavaScript application into a modern React-based single-page application (SPA). The conversion will maintain all existing functionality while improving code organization, maintainability, and user experience through React's component-based architecture and client-side routing.

## Glossary

- **React_App**: The new React-based single-page application that replaces the existing multi-page HTML application
- **API_Client**: The existing JavaScript module (api.js) that handles HTTP requests to the backend API
- **Router**: React Router library component that manages client-side navigation between pages
- **Component**: A reusable React function component that encapsulates UI logic and rendering
- **Page_Component**: A top-level React component that represents a full page view (Home, Compare, Vehicle Detail, etc.)
- **UI_Component**: A reusable React component for common interface elements (buttons, cards, forms, etc.)
- **State_Hook**: React hooks (useState, useEffect, etc.) used for managing component state and side effects
- **Backend_API**: The existing Python Flask API server running on http://localhost:5000
- **Legacy_App**: The existing multi-page HTML/CSS/JavaScript application in the carbonwise-app/ directory
- **Chart_Component**: React component that wraps Chart.js for data visualization
- **Navigation_Bar**: The persistent navigation component displayed across all pages
- **Footer**: The persistent footer component displayed across all pages

## Requirements

### Requirement 1: Project Initialization

**User Story:** As a developer, I want to initialize a new React project with proper tooling, so that I have a modern development environment with fast builds and hot module replacement.

#### Acceptance Criteria

1. THE React_App SHALL be initialized using Vite as the build tool
2. THE React_App SHALL use React version 18 or higher
3. THE React_App SHALL include React Router DOM version 6 or higher for routing
4. THE React_App SHALL include Axios for HTTP requests
5. THE React_App SHALL include Chart.js and react-chartjs-2 for data visualizations
6. THE React_App SHALL be created in a new directory named "carbonwise-react"
7. THE React_App SHALL include a package.json with all required dependencies
8. THE React_App SHALL include development scripts for running, building, and previewing the application

### Requirement 2: Project Structure

**User Story:** As a developer, I want a well-organized project structure, so that code is easy to navigate and maintain.

#### Acceptance Criteria

1. THE React_App SHALL organize source code in a "src" directory
2. THE React_App SHALL contain a "components" subdirectory for reusable UI components
3. THE React_App SHALL contain a "pages" subdirectory for Page_Components
4. THE React_App SHALL contain a "services" subdirectory for the API_Client
5. THE React_App SHALL contain a "utils" subdirectory for utility functions
6. THE React_App SHALL contain an "assets" subdirectory for static resources
7. THE React_App SHALL contain a "styles" subdirectory for CSS files
8. THE React_App SHALL include a public directory for static assets served at the root

### Requirement 3: API Client Integration

**User Story:** As a developer, I want to reuse the existing API client with minimal modifications, so that backend integration remains consistent and reliable.

#### Acceptance Criteria

1. THE React_App SHALL include the API_Client from the Legacy_App with minimal modifications
2. THE API_Client SHALL support environment-based configuration for the Backend_API URL
3. THE API_Client SHALL maintain all existing API methods (healthCheck, getVehicleDetail, calculateLifecycle, etc.)
4. THE API_Client SHALL export a singleton instance for use across components
5. THE API_Client SHALL handle errors consistently and return them to calling components
6. WHEN the Backend_API URL is not configured, THE API_Client SHALL default to "http://localhost:5000"

### Requirement 4: Routing Configuration

**User Story:** As a user, I want to navigate between pages without full page reloads, so that the application feels fast and responsive.

#### Acceptance Criteria

1. THE Router SHALL define routes for all seven pages: Home (/), Compare (/compare), Vehicle Detail (/vehicle/:brand/:model/:year), Recommend (/recommend), Break-Even (/break-even), Greenwashing (/greenwashing), Grid Insights (/grid-insights), and Methodology (/methodology)
2. THE Router SHALL use BrowserRouter for clean URLs without hash fragments
3. THE Router SHALL render a 404 Not Found page for undefined routes
4. WHEN a user clicks a navigation link, THE Router SHALL navigate without full page reload
5. THE Router SHALL support URL parameters for the Vehicle Detail page
6. THE Router SHALL preserve browser back/forward button functionality

### Requirement 5: Navigation Component

**User Story:** As a user, I want a consistent navigation bar across all pages, so that I can easily move between different sections of the application.

#### Acceptance Criteria

1. THE Navigation_Bar SHALL display the CarbonWise logo and name
2. THE Navigation_Bar SHALL include links to all seven pages
3. THE Navigation_Bar SHALL highlight the currently active page
4. WHEN the viewport width is less than 768px, THE Navigation_Bar SHALL display a mobile menu toggle button
5. WHEN the mobile menu toggle is clicked, THE Navigation_Bar SHALL show or hide the navigation links
6. WHEN a navigation link is clicked on mobile, THE Navigation_Bar SHALL close the mobile menu
7. THE Navigation_Bar SHALL be rendered on all pages

### Requirement 6: Footer Component

**User Story:** As a user, I want a consistent footer across all pages, so that I can access important links and information.

#### Acceptance Criteria

1. THE Footer SHALL display the CarbonWise description
2. THE Footer SHALL include links to data sources (Ember Climate, GREET Model, EEA, World Bank)
3. THE Footer SHALL include contact and GitHub links
4. THE Footer SHALL display copyright information
5. THE Footer SHALL be rendered on all pages

### Requirement 7: Home Page Component

**User Story:** As a user, I want to see an engaging landing page, so that I understand what CarbonWise offers and can navigate to key features.

#### Acceptance Criteria

1. THE Home Page_Component SHALL display a hero section with animated background
2. THE Home Page_Component SHALL display the main title "Compare True Vehicle Carbon Impact"
3. THE Home Page_Component SHALL display three call-to-action buttons linking to Compare, Recommend, and Break-Even pages
4. THE Home Page_Component SHALL display a features section highlighting GREET Manufacturing, Real Grid Emissions, and WLTP + Fuel Lifecycle
5. THE Home Page_Component SHALL display a tools section with cards linking to all six analysis tools
6. THE Home Page_Component SHALL preserve the visual design from the Legacy_App

### Requirement 8: Compare Page Component

**User Story:** As a user, I want to compare multiple vehicles side-by-side, so that I can make informed decisions about vehicle carbon impact.

#### Acceptance Criteria

1. THE Compare Page_Component SHALL display filter controls for Brand, Model, Year, Powertrain, and Country
2. THE Compare Page_Component SHALL fetch and display a list of available vehicles based on filter selections
3. THE Compare Page_Component SHALL allow users to select up to 3 vehicles for comparison
4. THE Compare Page_Component SHALL display selected vehicles in a grid layout
5. THE Compare Page_Component SHALL display unit toggle buttons for g/km, Lifetime (kg), and 10-Year emissions
6. WHEN vehicles are selected, THE Compare Page_Component SHALL fetch lifecycle data from the Backend_API
7. WHEN lifecycle data is received, THE Compare Page_Component SHALL display bar charts, stacked charts, and donut charts
8. THE Compare Page_Component SHALL display loading states while fetching data
9. THE Compare Page_Component SHALL display error messages when API requests fail

### Requirement 9: Vehicle Detail Page Component

**User Story:** As a user, I want to view detailed information about a specific vehicle, so that I can understand its complete carbon footprint.

#### Acceptance Criteria

1. THE Vehicle_Detail Page_Component SHALL extract brand, model, and year from URL parameters
2. THE Vehicle_Detail Page_Component SHALL fetch vehicle details from the Backend_API
3. THE Vehicle_Detail Page_Component SHALL display vehicle name, metadata, and powertrain badge
4. THE Vehicle_Detail Page_Component SHALL display lifecycle summary metrics (Total, Manufacturing, Operational)
5. THE Vehicle_Detail Page_Component SHALL display a carbon score with visual indicator
6. THE Vehicle_Detail Page_Component SHALL display an emissions breakdown chart
7. THE Vehicle_Detail Page_Component SHALL display a grid sensitivity analysis chart
8. THE Vehicle_Detail Page_Component SHALL include an annual impact calculator with user input
9. WHEN vehicle data is not found, THE Vehicle_Detail Page_Component SHALL display an error message with link to Compare page
10. THE Vehicle_Detail Page_Component SHALL display loading states while fetching data

### Requirement 10: Recommend Page Component

**User Story:** As a user, I want to receive personalized vehicle recommendations, so that I can find vehicles that match my usage patterns and sustainability goals.

#### Acceptance Criteria

1. THE Recommend Page_Component SHALL display a form with inputs for Country, Annual km Driven, and Preferred Powertrain
2. THE Recommend Page_Component SHALL fetch available countries from the Backend_API
3. WHEN the form is submitted, THE Recommend Page_Component SHALL send criteria to the Backend_API
4. WHEN recommendations are received, THE Recommend Page_Component SHALL display the top 3 recommended vehicles
5. THE Recommend Page_Component SHALL display each recommendation with vehicle details and carbon metrics
6. THE Recommend Page_Component SHALL display loading states while fetching recommendations
7. THE Recommend Page_Component SHALL display error messages when API requests fail

### Requirement 11: Break-Even Page Component

**User Story:** As a user, I want to calculate the break-even distance between an EV and ICE vehicle, so that I can understand when an EV becomes more carbon-efficient.

#### Acceptance Criteria

1. THE Break_Even Page_Component SHALL display separate selection forms for EV and ICE vehicles
2. THE Break_Even Page_Component SHALL display cascading dropdowns for Brand, Model, and Year for both vehicles
3. THE Break_Even Page_Component SHALL display vehicle previews when selections are made
4. THE Break_Even Page_Component SHALL display analysis parameter inputs for Country and Grid Year
5. WHEN the calculate button is clicked, THE Break_Even Page_Component SHALL send both vehicle selections to the Backend_API
6. WHEN break-even results are received, THE Break_Even Page_Component SHALL display the break-even distance in kilometers
7. THE Break_Even Page_Component SHALL display a cumulative emissions chart showing both vehicles
8. THE Break_Even Page_Component SHALL display a comparison details section
9. THE Break_Even Page_Component SHALL display loading states while calculating
10. THE Break_Even Page_Component SHALL display error messages when API requests fail

### Requirement 12: Greenwashing Page Component

**User Story:** As a user, I want to analyze vehicle environmental claims for accuracy, so that I can identify misleading marketing.

#### Acceptance Criteria

1. THE Greenwashing Page_Component SHALL display a vehicle selection form with Brand, Model, Year, Country, and Grid Year inputs
2. WHEN the analyze button is clicked, THE Greenwashing Page_Component SHALL fetch vehicle lifecycle data and send it to the greenwashing detection endpoint
3. WHEN the web search button is clicked, THE Greenwashing Page_Component SHALL request analysis with web search enabled
4. WHEN analysis results are received, THE Greenwashing Page_Component SHALL display a risk badge (Low, Medium, High)
5. THE Greenwashing Page_Component SHALL display greenwashing indicators with descriptions
6. THE Greenwashing Page_Component SHALL display a transparency score
7. THE Greenwashing Page_Component SHALL display detailed findings
8. THE Greenwashing Page_Component SHALL display loading states while analyzing
9. THE Greenwashing Page_Component SHALL display error messages when API requests fail

### Requirement 13: Grid Insights Page Component

**User Story:** As a user, I want to explore country-specific grid emissions data, so that I can understand how electricity sources affect vehicle emissions.

#### Acceptance Criteria

1. THE Grid_Insights Page_Component SHALL fetch grid data from the Backend_API
2. THE Grid_Insights Page_Component SHALL display a country selector
3. THE Grid_Insights Page_Component SHALL display current grid intensity for the selected country
4. THE Grid_Insights Page_Component SHALL display historical trends chart
5. THE Grid_Insights Page_Component SHALL display energy source breakdown
6. THE Grid_Insights Page_Component SHALL display future projections if available
7. THE Grid_Insights Page_Component SHALL display loading states while fetching data
8. THE Grid_Insights Page_Component SHALL display error messages when API requests fail

### Requirement 14: Methodology Page Component

**User Story:** As a user, I want to understand the calculation methods and data sources, so that I can trust the accuracy of the carbon impact analysis.

#### Acceptance Criteria

1. THE Methodology Page_Component SHALL fetch methodology content from the Backend_API
2. THE Methodology Page_Component SHALL display sections for Manufacturing Emissions, Operational Emissions, and Grid Emissions
3. THE Methodology Page_Component SHALL display data sources with links
4. THE Methodology Page_Component SHALL display calculation formulas and assumptions
5. THE Methodology Page_Component SHALL display validation processes
6. THE Methodology Page_Component SHALL display loading states while fetching content
7. THE Methodology Page_Component SHALL display error messages when API requests fail

### Requirement 15: Reusable UI Components

**User Story:** As a developer, I want reusable UI components, so that I can maintain consistent design and reduce code duplication.

#### Acceptance Criteria

1. THE React_App SHALL include a Button UI_Component with variants (primary, secondary, outline)
2. THE React_App SHALL include a Card UI_Component for content containers
3. THE React_App SHALL include a LoadingSpinner UI_Component for loading states
4. THE React_App SHALL include an ErrorMessage UI_Component for error display
5. THE React_App SHALL include a VehicleCard UI_Component for displaying vehicle information
6. THE React_App SHALL include a Select UI_Component for dropdown inputs
7. THE React_App SHALL include an Input UI_Component for text and number inputs
8. THE React_App SHALL include a Badge UI_Component for labels and tags

### Requirement 16: Chart Components

**User Story:** As a developer, I want reusable chart components, so that data visualizations are consistent across pages.

#### Acceptance Criteria

1. THE React_App SHALL include a BarChart Chart_Component wrapping Chart.js bar charts
2. THE React_App SHALL include a StackedBarChart Chart_Component wrapping Chart.js stacked bar charts
3. THE React_App SHALL include a DonutChart Chart_Component wrapping Chart.js doughnut charts
4. THE React_App SHALL include a LineChart Chart_Component wrapping Chart.js line charts
5. WHEN chart data is updated, THE Chart_Component SHALL re-render with new data
6. THE Chart_Component SHALL accept configuration props for colors, labels, and options

### Requirement 17: State Management

**User Story:** As a developer, I want proper state management, so that application data flows predictably and components remain synchronized.

#### Acceptance Criteria

1. THE React_App SHALL use useState State_Hook for local component state
2. THE React_App SHALL use useEffect State_Hook for side effects and data fetching
3. THE React_App SHALL use useNavigate State_Hook for programmatic navigation
4. THE React_App SHALL use useParams State_Hook for accessing URL parameters
5. WHEN a component mounts, THE React_App SHALL fetch required data using useEffect
6. WHEN API requests complete, THE React_App SHALL update component state with results

### Requirement 18: Form Handling

**User Story:** As a developer, I want consistent form handling, so that user inputs are validated and submitted properly.

#### Acceptance Criteria

1. THE React_App SHALL use controlled components for all form inputs
2. WHEN a form input changes, THE React_App SHALL update component state
3. WHEN a form is submitted, THE React_App SHALL prevent default browser submission
4. WHEN a form is submitted, THE React_App SHALL validate required fields
5. WHEN validation fails, THE React_App SHALL display error messages to the user
6. WHEN validation succeeds, THE React_App SHALL call the appropriate API method

### Requirement 19: Styling and CSS

**User Story:** As a developer, I want to preserve the existing design system, so that the React app maintains visual consistency with the original application.

#### Acceptance Criteria

1. THE React_App SHALL reuse CSS files from the Legacy_App (variables.css, reset.css, components.css, layout.css)
2. THE React_App SHALL import page-specific CSS files in corresponding Page_Components
3. THE React_App SHALL maintain the existing color scheme, typography, and spacing
4. THE React_App SHALL maintain responsive design for mobile, tablet, and desktop viewports
5. THE React_App SHALL maintain hover effects and transitions from the Legacy_App

### Requirement 20: Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong, so that I understand what happened and how to proceed.

#### Acceptance Criteria

1. WHEN an API request fails, THE React_App SHALL display an error message to the user
2. WHEN a network error occurs, THE React_App SHALL display "Network error. Please check your connection."
3. WHEN a 404 error occurs, THE React_App SHALL display "Resource not found."
4. WHEN a 500 error occurs, THE React_App SHALL display "Server error. Please try again later."
5. THE React_App SHALL log errors to the browser console for debugging
6. THE React_App SHALL provide actionable error messages when possible (e.g., "Try selecting different filters")

### Requirement 21: Loading States

**User Story:** As a user, I want to see loading indicators during data fetching, so that I know the application is working and not frozen.

#### Acceptance Criteria

1. WHEN a component is fetching data, THE React_App SHALL display a LoadingSpinner UI_Component
2. WHEN a page is loading, THE React_App SHALL display skeleton loaders for content areas
3. WHEN a button action triggers an API request, THE React_App SHALL disable the button and show loading state
4. WHEN data fetching completes, THE React_App SHALL hide loading indicators and display content
5. WHEN data fetching fails, THE React_App SHALL hide loading indicators and display error messages

### Requirement 22: Environment Configuration

**User Story:** As a developer, I want environment-based configuration, so that I can easily switch between development and production API endpoints.

#### Acceptance Criteria

1. THE React_App SHALL support a .env file for environment variables
2. THE React_App SHALL read the Backend_API URL from VITE_API_BASE_URL environment variable
3. WHEN VITE_API_BASE_URL is not set, THE React_App SHALL default to "http://localhost:5000"
4. THE React_App SHALL include a .env.example file with sample configuration
5. THE React_App SHALL not commit .env files to version control

### Requirement 23: Build and Deployment

**User Story:** As a developer, I want optimized production builds, so that the application loads quickly for end users.

#### Acceptance Criteria

1. THE React_App SHALL support a build command that creates optimized production assets
2. THE React_App SHALL minify JavaScript and CSS in production builds
3. THE React_App SHALL generate source maps for debugging
4. THE React_App SHALL output build artifacts to a "dist" directory
5. THE React_App SHALL support a preview command for testing production builds locally
6. THE React_App SHALL include a README with instructions for development, building, and deployment

### Requirement 24: Accessibility

**User Story:** As a user with disabilities, I want the application to be accessible, so that I can use it with assistive technologies.

#### Acceptance Criteria

1. THE React_App SHALL use semantic HTML elements (nav, main, footer, section, article)
2. THE React_App SHALL include aria-label attributes for icon buttons
3. THE React_App SHALL maintain keyboard navigation support for all interactive elements
4. THE React_App SHALL maintain sufficient color contrast ratios from the Legacy_App
5. THE React_App SHALL include alt text for images
6. THE React_App SHALL use proper heading hierarchy (h1, h2, h3, etc.)

### Requirement 25: Performance

**User Story:** As a user, I want the application to load and respond quickly, so that I have a smooth experience.

#### Acceptance Criteria

1. THE React_App SHALL lazy load Page_Components using React.lazy and Suspense
2. THE React_App SHALL avoid unnecessary re-renders by using React.memo where appropriate
3. THE React_App SHALL debounce filter inputs to reduce API calls
4. THE React_App SHALL cache API responses where appropriate
5. WHEN the initial page loads, THE React_App SHALL display content within 2 seconds on a standard connection

### Requirement 26: Testing Setup

**User Story:** As a developer, I want a testing framework configured, so that I can write and run tests for components and utilities.

#### Acceptance Criteria

1. THE React_App SHALL include Vitest as the test runner
2. THE React_App SHALL include React Testing Library for component testing
3. THE React_App SHALL include a test script in package.json
4. THE React_App SHALL include example tests for at least one component
5. THE React_App SHALL support test coverage reporting

### Requirement 27: Documentation

**User Story:** As a developer, I want comprehensive documentation, so that I can understand the project structure and contribute effectively.

#### Acceptance Criteria

1. THE React_App SHALL include a README.md with project overview
2. THE README SHALL document installation instructions
3. THE README SHALL document available npm scripts (dev, build, preview, test)
4. THE README SHALL document environment variable configuration
5. THE README SHALL document project structure and key directories
6. THE README SHALL document the relationship with the Backend_API
7. THE README SHALL include a section on differences from the Legacy_App
