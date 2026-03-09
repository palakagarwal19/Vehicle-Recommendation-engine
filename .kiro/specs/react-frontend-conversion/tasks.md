# Implementation Plan: React Frontend Conversion

## Overview

This plan converts the CarbonWise HTML/CSS/JavaScript application into a modern React-based single-page application. The implementation follows a 6-phase migration strategy: Setup, Core Components, API Integration, Page Components, Testing & Polish, and Deployment. Each task builds incrementally, with checkpoints to validate progress.

## Tasks

- [x] 1. Initialize React project with Vite and dependencies
  - Create new project using `npm create vite@latest carbonwise-react -- --template react`
  - Install dependencies: react-router-dom, axios, chart.js, react-chartjs-2
  - Install dev dependencies: vitest, @testing-library/react, @testing-library/jest-dom, fast-check, jsdom
  - Configure package.json scripts (dev, build, preview, test, test:coverage, lint)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 26.1, 26.2, 26.3_

- [x] 2. Set up project structure and configuration
  - [x] 2.1 Create directory structure
    - Create src/components/ui, src/components/charts, src/components/layout directories
    - Create src/pages, src/services, src/utils, src/hooks, src/styles directories
    - Create src/assets/images directory
    - Create test/factories directory
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [x] 2.2 Configure build and test tools
    - Create vite.config.js with React plugin, dev server, and build optimization
    - Create vitest.config.js with jsdom environment and coverage settings
    - Create test/setup.js with testing-library matchers
    - Create .env.example with VITE_API_BASE_URL
    - Create .gitignore for node_modules, dist, .env
    - _Requirements: 1.8, 22.1, 22.3, 22.4, 22.5, 26.4_
  
  - [x] 2.3 Copy and organize CSS files
    - Copy variables.css, reset.css, layout.css, components.css from legacy app to src/styles
    - Copy page-specific CSS files (landing.css, compare.css, vehicle-detail.css, etc.)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 3. Checkpoint - Verify project setup
  - Ensure `npm run dev` starts development server successfully
  - Ensure `npm run test` runs without errors
  - Ensure all tests pass, ask the user if questions arise

- [x] 4. Implement API client service
  - [x] 4.1 Create API client class with singleton pattern
    - Create src/services/api.js with CarbonWiseAPI class
    - Implement constructor with baseURL from environment variable
    - Implement request method with axios and error handling
    - Implement getErrorMessage method for consistent error messages
    - Export singleton instance
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 22.2, 22.3_
  
  - [x] 4.2 Implement all API methods
    - Implement healthCheck, getVehicleDetail, calculateLifecycle methods
    - Implement getCountries, compareMultiple, getRecommendations methods
    - Implement calculateBreakEven, detectGreenwashing methods
    - Implement getCarbonScore, getAnnualImpact, getGridSensitivity methods
    - Implement getMethodology, getAllVehicles, getGridData methods
    - _Requirements: 3.3_
  
  - [ ]* 4.3 Write unit tests for API client
    - Test singleton pattern (Property 1)
    - Test environment configuration (Property 2)
    - Test error handling for network, 404, 500, 400 errors (Property 3)
    - Mock axios responses for all API methods
    - **Property 1: API Client Singleton**
    - **Property 2: API Client Environment Configuration**
    - **Property 3: API Client Error Handling**
    - **Validates: Requirements 3.4, 3.2, 3.5, 20.1, 20.2, 20.3, 20.4**

- [x] 5. Implement custom hooks
  - [x] 5.1 Create useApi hook
    - Create src/hooks/useApi.js with data, loading, error state
    - Implement useEffect for data fetching with cleanup
    - Handle loading and error states
    - _Requirements: 17.1, 17.2, 17.5, 17.6_
  
  - [x] 5.2 Create useDebounce hook
    - Create src/hooks/useDebounce.js with delay parameter
    - Implement setTimeout with cleanup
    - _Requirements: 25.3_
  
  - [ ]* 5.3 Write unit tests for custom hooks
    - Test useApi hook with mock API calls
    - Test useDebounce hook with various delay values
    - **Validates: Requirements 17.5, 25.3**

- [x] 6. Implement UI components library
  - [x] 6.1 Create Button component
    - Create src/components/ui/Button.jsx with variants (primary, secondary, outline)
    - Support disabled, loading, type, className props
    - _Requirements: 15.1_
  
  - [x] 6.2 Create Card component
    - Create src/components/ui/Card.jsx with title and children props
    - Support onClick and className props
    - _Requirements: 15.2_
  
  - [x] 6.3 Create Input component
    - Create src/components/ui/Input.jsx with label, type, value, onChange props
    - Support validation error display
    - _Requirements: 15.7_
  
  - [x] 6.4 Create Select component
    - Create src/components/ui/Select.jsx with label, options, value, onChange props
    - Support placeholder and error display
    - _Requirements: 15.6_
  
  - [x] 6.5 Create Badge component
    - Create src/components/ui/Badge.jsx with variants (success, warning, danger, info)
    - Support size prop (small, medium, large)
    - _Requirements: 15.8_
  
  - [x] 6.6 Create LoadingSpinner component
    - Create src/components/ui/LoadingSpinner.jsx with size and message props
    - _Requirements: 15.3, 21.1_
  
  - [x] 6.7 Create ErrorMessage component
    - Create src/components/ui/ErrorMessage.jsx with message, onRetry, onDismiss props
    - _Requirements: 15.4, 20.1_
  
  - [x] 6.8 Create VehicleCard component
    - Create src/components/ui/VehicleCard.jsx with vehicle data props
    - Support selected state and onClick handler
    - _Requirements: 15.5_
  
  - [ ]* 6.9 Write unit tests for UI components
    - Test Button variants, disabled, loading states
    - Test Input controlled component behavior (Property 32)
    - Test Select controlled component behavior (Property 32)
    - Test ErrorMessage display and retry functionality
    - **Property 32: Controlled Form Inputs**
    - **Validates: Requirements 15.1-15.8, 18.1, 18.2**

- [x] 7. Implement chart components library
  - [x] 7.1 Create BarChart component
    - Create src/components/charts/BarChart.jsx wrapping Chart.js Bar
    - Accept data, options, height props
    - _Requirements: 16.1_
  
  - [x] 7.2 Create StackedBarChart component
    - Create src/components/charts/StackedBarChart.jsx with stacked configuration
    - Accept data, options, height props
    - _Requirements: 16.2_
  
  - [x] 7.3 Create DonutChart component
    - Create src/components/charts/DonutChart.jsx wrapping Chart.js Doughnut
    - Accept data, options, height props
    - _Requirements: 16.3_
  
  - [x] 7.4 Create LineChart component
    - Create src/components/charts/LineChart.jsx wrapping Chart.js Line
    - Accept data, options, height props
    - _Requirements: 16.4_
  
  - [ ]* 7.5 Write unit tests for chart components
    - Test chart rendering with mock data
    - Test chart data updates (Property 29)
    - Test chart configuration props (Property 30)
    - **Property 29: Chart Data Updates**
    - **Property 30: Chart Configuration Props**
    - **Validates: Requirements 16.5, 16.6**

- [x] 8. Implement layout components
  - [x] 8.1 Create Navigation component
    - Create src/components/layout/Navigation.jsx with logo and navigation links
    - Implement mobile menu toggle with state
    - Implement active link highlighting using useLocation
    - Implement mobile menu auto-close on navigation (Property 8)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.2 Create Footer component
    - Create src/components/layout/Footer.jsx with description, links, copyright
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 8.3 Create Layout component
    - Create src/components/layout/Layout.jsx wrapping Navigation, children, Footer
    - _Requirements: 5.7, 6.5_
  
  - [ ]* 8.4 Write unit tests for layout components
    - Test Navigation mobile menu toggle (Property 7)
    - Test Navigation mobile menu auto-close (Property 8)
    - Test Navigation active link highlighting (Property 6)
    - Test Layout renders Navigation and Footer (Property 9)
    - **Property 6: Active Navigation Highlighting**
    - **Property 7: Mobile Menu Toggle**
    - **Property 8: Mobile Menu Auto-Close**
    - **Property 9: Layout Components on All Routes**
    - **Validates: Requirements 5.3, 5.5, 5.6, 5.7, 6.5**

- [x] 9. Checkpoint - Verify core components
  - Test all UI components render correctly
  - Test all chart components render with sample data
  - Test layout components with routing
  - Ensure all tests pass, ask the user if questions arise

- [x] 10. Set up routing configuration
  - [x] 10.1 Create router configuration
    - Create src/router.jsx with Routes and lazy-loaded page components
    - Define routes for all 8 pages plus 404
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 10.2 Create App component with routing
    - Create src/App.jsx with BrowserRouter, Layout, Suspense
    - Create src/components/ErrorBoundary.jsx for error handling
    - Create src/main.jsx as entry point with CSS imports
    - _Requirements: 4.2, 4.4_
  
  - [ ]* 10.3 Write routing tests
    - Test SPA navigation without reload (Property 4)
    - Test browser history integration (Property 5)
    - Test 404 handling for undefined routes
    - Test URL parameter extraction (Property 17)
    - **Property 4: SPA Navigation Without Reload**
    - **Property 5: Browser History Integration**
    - **Property 17: URL Parameter Extraction**
    - **Validates: Requirements 4.4, 4.5, 4.6, 9.1**

- [x] 11. Implement Home page component
  - [x] 11.1 Create Home page with hero section
    - Create src/pages/Home.jsx with hero, features, tools sections
    - Import landing.css
    - Use Button and Card components
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ]* 11.2 Write unit tests for Home page
    - Test hero section renders
    - Test CTA buttons link to correct routes
    - Test features and tools sections render
    - **Validates: Requirements 7.1-7.6**

- [x] 12. Implement Compare page component
  - [x] 12.1 Create Compare page structure and state
    - Create src/pages/Compare.jsx with filters, vehicles, comparison state
    - Import compare.css
    - Implement filter change handlers
    - Implement vehicle selection handlers with 3-vehicle limit (Property 11)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [x] 12.2 Implement Compare page data fetching
    - Fetch available vehicles on mount (Property 18)
    - Fetch comparison data when vehicles selected (Property 13)
    - Implement unit toggle handler
    - _Requirements: 8.2, 8.6_
  
  - [x] 12.3 Implement Compare page UI rendering
    - Render filter controls with Select components
    - Render vehicle list with VehicleCard components
    - Render selected vehicles grid (Property 12)
    - Render charts when data available (Property 14)
    - Render loading and error states (Property 15, 16)
    - _Requirements: 8.4, 8.5, 8.7, 8.8, 8.9_
  
  - [ ]* 12.4 Write unit tests for Compare page
    - Test filter-based vehicle list updates (Property 10)
    - Test vehicle selection limit (Property 11)
    - Test selected vehicles display (Property 12)
    - Test lifecycle data fetch on selection (Property 13)
    - Test chart rendering on data receipt (Property 14)
    - **Property 10: Filter-Based Vehicle List Updates**
    - **Property 11: Vehicle Selection Limit**
    - **Property 12: Selected Vehicles Display**
    - **Property 13: Lifecycle Data Fetch on Selection**
    - **Property 14: Chart Rendering on Data Receipt**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.6, 8.7**

- [x] 13. Implement VehicleDetail page component
  - [x] 13.1 Create VehicleDetail page structure and state
    - Create src/pages/VehicleDetail.jsx with vehicle, lifecycle, score state
    - Import vehicle-detail.css
    - Extract URL parameters using useParams (Property 17)
    - _Requirements: 9.1_
  
  - [x] 13.2 Implement VehicleDetail data fetching
    - Fetch vehicle details on mount (Property 18)
    - Fetch lifecycle data, carbon score, grid sensitivity
    - Handle 404 errors for invalid vehicles
    - _Requirements: 9.2, 9.9_
  
  - [x] 13.3 Implement VehicleDetail UI rendering
    - Render vehicle header with name, metadata, badge (Property 19)
    - Render lifecycle summary metrics (Property 19)
    - Render carbon score with visual indicator (Property 19)
    - Render emissions breakdown and grid sensitivity charts (Property 19)
    - Render annual impact calculator with input (Property 20)
    - Render loading and error states (Property 15, 16)
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.10_
  
  - [ ]* 13.4 Write unit tests for VehicleDetail page
    - Test URL parameter extraction (Property 17)
    - Test data fetching on mount (Property 18)
    - Test vehicle detail data display (Property 19)
    - Test annual impact calculator (Property 20)
    - **Property 17: URL Parameter Extraction**
    - **Property 18: Data Fetching on Component Mount**
    - **Property 19: Vehicle Detail Data Display**
    - **Property 20: Annual Impact Calculator**
    - **Validates: Requirements 9.1, 9.2, 9.3-9.8**

- [x] 14. Checkpoint - Verify core pages
  - Test Home, Compare, and VehicleDetail pages render correctly
  - Test navigation between pages
  - Test API integration with backend
  - Ensure all tests pass, ask the user if questions arise

- [x] 15. Implement Recommend page component
  - [x] 15.1 Create Recommend page with form and results
    - Create src/pages/Recommend.jsx with form state and recommendations state
    - Import recommend.css
    - Implement form input handlers
    - Implement form submission with validation (Property 35, 36)
    - Fetch countries on mount (Property 18)
    - Fetch recommendations on submit
    - Render recommendation results (Property 21)
    - Render loading and error states (Property 15, 16)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  
  - [ ]* 15.2 Write unit tests for Recommend page
    - Test form submission triggers API call (Property 36)
    - Test recommendation display (Property 21)
    - Test required field validation (Property 35)
    - **Property 21: Recommendation Display**
    - **Property 35: Required Field Validation**
    - **Property 36: Valid Form Submission**
    - **Validates: Requirements 10.3, 10.4, 10.5, 18.4, 18.5, 18.6**

- [x] 16. Implement BreakEven page component
  - [x] 16.1 Create BreakEven page with dual vehicle selection
    - Create src/pages/BreakEven.jsx with EV and ICE selection state
    - Import break-even.css
    - Implement cascading dropdown handlers (Property 22)
    - Implement vehicle preview display (Property 23)
    - Fetch vehicles on mount (Property 18)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [x] 16.2 Implement BreakEven calculation and results
    - Implement calculate button handler
    - Fetch break-even data from API
    - Render break-even results with chart (Property 24)
    - Render loading and error states (Property 15, 16)
    - _Requirements: 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_
  
  - [ ]* 16.3 Write unit tests for BreakEven page
    - Test cascading dropdown updates (Property 22)
    - Test vehicle preview display (Property 23)
    - Test break-even results display (Property 24)
    - **Property 22: Cascading Dropdown Updates**
    - **Property 23: Vehicle Preview Display**
    - **Property 24: Break-Even Results Display**
    - **Validates: Requirements 11.2, 11.3, 11.6-11.8**

- [x] 17. Implement Greenwashing page component
  - [x] 17.1 Create Greenwashing page with analysis form
    - Create src/pages/Greenwashing.jsx with vehicle selection and results state
    - Import greenwashing.css
    - Implement vehicle selection handlers
    - Implement analyze button handlers (with and without web search)
    - Fetch lifecycle data and send to greenwashing endpoint
    - Render analysis results (Property 25)
    - Render loading and error states (Property 15, 16)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_
  
  - [ ]* 17.2 Write unit tests for Greenwashing page
    - Test greenwashing analysis results display (Property 25)
    - Test form submission with web search toggle
    - **Property 25: Greenwashing Analysis Results Display**
    - **Validates: Requirements 12.4-12.7**

- [x] 18. Implement GridInsights page component
  - [x] 18.1 Create GridInsights page with country selector
    - Create src/pages/GridInsights.jsx with country and grid data state
    - Import grid.css
    - Fetch grid data on mount (Property 18)
    - Implement country selection handler (Property 26)
    - Render grid intensity, historical trends, energy breakdown
    - Conditionally render projections (Property 27)
    - Render loading and error states (Property 15, 16)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_
  
  - [ ]* 18.2 Write unit tests for GridInsights page
    - Test grid insights country selection (Property 26)
    - Test conditional projection display (Property 27)
    - **Property 26: Grid Insights Country Selection**
    - **Property 27: Conditional Projection Display**
    - **Validates: Requirements 13.3, 13.6**

- [x] 19. Implement Methodology page component
  - [x] 19.1 Create Methodology page with content sections
    - Create src/pages/Methodology.jsx with methodology content state
    - Import methodology.css
    - Fetch methodology data on mount (Property 18)
    - Render sections, data sources, formulas, assumptions (Property 28)
    - Render loading and error states (Property 15, 16)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_
  
  - [ ]* 19.2 Write unit tests for Methodology page
    - Test methodology content display (Property 28)
    - **Property 28: Methodology Content Display**
    - **Validates: Requirements 14.2-14.5**

- [x] 20. Implement NotFound page component
  - [x] 20.1 Create NotFound page
    - Create src/pages/NotFound.jsx with 404 message and link to home
    - _Requirements: 4.3_
  
  - [ ]* 20.2 Write unit tests for NotFound page
    - Test 404 page renders for undefined routes
    - **Validates: Requirements 4.3**

- [x] 21. Checkpoint - Verify all pages complete
  - Test all 8 pages render correctly
  - Test navigation between all pages
  - Test all API integrations
  - Ensure all tests pass, ask the user if questions arise

- [x] 22. Implement utility functions
  - [x] 22.1 Create formatter utilities
    - Create src/utils/formatters.js with number, date, emission formatters
    - _Requirements: 19.3_
  
  - [x] 22.2 Create validator utilities
    - Create src/utils/validators.js with form validation functions
    - _Requirements: 18.4_
  
  - [ ]* 22.3 Write unit tests for utilities
    - Test formatters with various inputs and edge cases
    - Test validators with valid and invalid inputs
    - **Validates: Requirements 18.4, 19.3**

- [x] 23. Implement accessibility enhancements
  - [x] 23.1 Add semantic HTML and ARIA attributes
    - Review all components for semantic HTML usage (Property 38)
    - Add aria-label to icon buttons (Property 39)
    - Add alt text to all images (Property 40)
    - Verify heading hierarchy (Property 41)
    - Ensure keyboard navigation support (Property 42)
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6_
  
  - [ ]* 23.2 Write accessibility tests
    - Test semantic HTML usage (Property 38)
    - Test icon button accessibility (Property 39)
    - Test image alt text (Property 40)
    - Test heading hierarchy (Property 41)
    - Test keyboard navigation (Property 42)
    - **Property 38: Semantic HTML Usage**
    - **Property 39: Icon Button Accessibility**
    - **Property 40: Image Alt Text**
    - **Property 41: Heading Hierarchy**
    - **Property 42: Keyboard Navigation Support**
    - **Validates: Requirements 24.1-24.6**

- [x] 24. Implement performance optimizations
  - [x] 24.1 Add React.memo to components
    - Wrap expensive components with React.memo (Property 43)
    - _Requirements: 25.2_
  
  - [x] 24.2 Implement filter debouncing
    - Use useDebounce hook for filter inputs (Property 44)
    - _Requirements: 25.3_
  
  - [x] 24.3 Implement API response caching
    - Add caching logic to API client (Property 45)
    - _Requirements: 25.4_
  
  - [x] 24.4 Verify lazy loading
    - Ensure all page components use React.lazy
    - Test code splitting in production build
    - _Requirements: 25.1_
  
  - [ ]* 24.5 Write performance tests
    - Test component re-render optimization (Property 43)
    - Test filter input debouncing (Property 44)
    - Test API response caching (Property 45)
    - Test initial page load performance (Property 46)
    - **Property 43: Component Re-render Optimization**
    - **Property 44: Filter Input Debouncing**
    - **Property 45: API Response Caching**
    - **Property 46: Initial Page Load Performance**
    - **Validates: Requirements 25.1-25.5**

- [x] 25. Implement comprehensive error handling
  - [x] 25.1 Add error boundaries
    - Verify ErrorBoundary wraps App component
    - Test error boundary fallback UI
    - _Requirements: 20.1_
  
  - [x] 25.2 Verify error messages
    - Test network error messages (Property 16)
    - Test 404, 500, 400 error messages (Property 16)
    - Test validation error messages (Property 35)
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_
  
  - [ ]* 25.3 Write error handling tests
    - Test error message display (Property 16)
    - Test button disabled during async operations (Property 47)
    - **Property 16: Error Message Display**
    - **Property 47: Button Disabled During Async Operations**
    - **Validates: Requirements 20.1-20.6, 21.3**

- [x] 26. Checkpoint - Verify testing and polish complete
  - Run full test suite with coverage report
  - Verify 80% overall coverage, 85% components, 90% utilities, 95% API client
  - Test accessibility with automated tools
  - Test responsive design on mobile, tablet, desktop
  - Ensure all tests pass, ask the user if questions arise

- [x] 27. Create comprehensive documentation
  - [x] 27.1 Write README.md
    - Document project overview and features
    - Document installation instructions
    - Document npm scripts (dev, build, preview, test)
    - Document environment variable configuration
    - Document project structure
    - Document relationship with backend API
    - Document differences from legacy app
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7_
  
  - [x] 27.2 Create component documentation
    - Document all UI components with props and examples
    - Document all chart components with usage
    - Document custom hooks with examples
    - _Requirements: 27.1_

- [x] 28. Build and test production bundle
  - [x] 28.1 Create production build
    - Run `npm run build` to create optimized bundle
    - Verify build output in dist/ directory
    - Check bundle sizes and code splitting
    - _Requirements: 23.1, 23.2, 23.3, 23.4_
  
  - [x] 28.2 Test production build locally
    - Run `npm run preview` to test production build
    - Test all pages and features in production mode
    - Verify environment variables work correctly
    - _Requirements: 23.5_
  
  - [x] 28.3 Prepare deployment configuration
    - Document deployment options (static hosting, Docker, CDN)
    - Create deployment instructions in README
    - Configure redirects for SPA routing
    - _Requirements: 23.6_

- [x] 29. Final checkpoint - Production ready
  - Verify all features work in production build
  - Verify all tests pass with 100% success rate
  - Verify documentation is complete and accurate
  - Verify backend API integration works correctly
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All property tests must run with minimum 100 iterations
- Checkpoints ensure incremental validation at key milestones
- The implementation follows the 6-phase migration strategy from the design document
- All components should be tested before moving to the next phase
- Backend API must be running on http://localhost:5000 for integration testing
