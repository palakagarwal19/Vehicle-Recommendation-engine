# Implementation Plan: CarbonWise Frontend

## Overview

This implementation plan breaks down the CarbonWise frontend into incremental, testable steps. The approach follows a bottom-up strategy: building shared components first, then feature-specific components, then pages, and finally integration. Each major component includes property-based tests to validate correctness properties from the design document.

## Tasks

- [ ] 1. Project setup and configuration
  - Initialize React project with Vite
  - Configure Tailwind CSS with custom theme (colors: #0D0D0D, #1A1A1A, #00C853, #69F0AE)
  - Install dependencies: React Router, Recharts, fast-check, Vitest, React Testing Library
  - Set up project structure: pages/, components/shared/, components/features/, contexts/, utils/
  - Configure Tailwind to disable inline styles
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 11.1, 11.2_

- [ ] 2. Implement shared UI components
  - [ ] 2.1 Create Button component with variants (primary, secondary, outline)
    - Implement size variants (sm, md, lg)
    - Add eco green styling for primary, outline for secondary
    - Add hover glow effect with CSS transitions (<= 300ms)
    - _Requirements: 7.3, 7.5, 7.9, 7.10, 9.1, 9.6_
  
  - [ ]* 2.2 Write property test for Button styling
    - **Property 20: Button Variant Styling**
    - **Validates: Requirements 7.9, 7.10**
  
  - [ ] 2.3 Create Card component with glassmorphism styling
    - Implement 16px border radius
    - Add carbon grey background (#1A1A1A)
    - Add optional hover glow effect
    - _Requirements: 7.2, 7.5, 7.6_
  
  - [ ]* 2.4 Write property test for Card styling
    - **Property 17: Card Styling Consistency**
    - **Validates: Requirements 7.6**
  
  - [ ] 2.5 Create LoadingSkeleton component with variants (text, card, chart)
    - Implement shimmer animation
    - _Requirements: 9.3_
  
  - [ ]* 2.6 Write property test for loading skeletons
    - **Property 25: Loading State Skeletons**
    - **Validates: Requirements 9.3**
  
  - [ ] 2.7 Create ErrorBoundary component with recovery actions
    - Display user-friendly error messages
    - Provide recovery options (retry, go home, use cached data)
    - _Requirements: 9.4, 9.5_
  
  - [ ]* 2.8 Write property test for error display
    - **Property 26: Error Display with Recovery**
    - **Validates: Requirements 9.4, 9.5**

- [ ] 3. Implement data formatting utilities
  - [ ] 3.1 Create number formatting functions
    - Format emission values with 1 decimal place
    - Add thousand separators for numbers >= 1000
    - Format percentages with 1 decimal place
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [ ]* 3.2 Write property test for number formatting
    - **Property 31: Number Formatting Consistency**
    - **Validates: Requirements 12.1, 12.2, 12.3**
  
  - [ ] 3.3 Create currency formatting function with localization
    - Support country-specific formats (symbol position, separators)
    - _Requirements: 12.4_
  
  - [ ]* 3.4 Write property test for currency localization
    - **Property 32: Currency Localization**
    - **Validates: Requirements 12.4**
  
  - [ ] 3.5 Create missing data placeholder utility
    - Return "N/A" for null/undefined values
    - _Requirements: 12.5_
  
  - [ ]* 3.6 Write property test for missing data placeholders
    - **Property 33: Missing Data Placeholder**
    - **Validates: Requirements 12.5**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement chart components
  - [ ] 5.1 Create ChartContainer wrapper component
    - Add glassmorphism card styling
    - Implement responsive sizing
    - Add loading state support
    - _Requirements: 7.6, 9.3_
  
  - [ ] 5.2 Create EmissionChart component using Recharts
    - Support types: bar, line, pie, donut
    - Apply neon green gradient colors on black background
    - Add hover tooltips
    - _Requirements: 7.8, 11.5_
  
  - [ ]* 5.3 Write property test for chart color scheme
    - **Property 19: Chart Color Scheme**
    - **Validates: Requirements 7.8**
  
  - [ ]* 5.4 Write property test for Recharts usage
    - **Property 30: Recharts Usage**
    - **Validates: Requirements 11.5**

- [ ] 6. Implement state management contexts
  - [ ] 6.1 Create VehicleContext for selected vehicles
    - Manage selected vehicles array (max 3)
    - Provide selection/deselection functions
    - _Requirements: 2.2, 2.3_
  
  - [ ] 6.2 Create RecommendationContext for recommendation pool
    - Store recommendation criteria and results
    - _Requirements: 4.1, 4.2_
  
  - [ ] 6.3 Create ThemeContext for dark theme configuration
    - Store theme colors and typography settings
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7_
  
  - [ ] 6.4 Create ErrorContext for global error handling
    - Manage error state and toast notifications
    - _Requirements: 9.4, 9.5_

- [ ] 7. Implement vehicle selection and filtering
  - [ ] 7.1 Create VehicleSelector component
    - Implement filters: Brand, Model, Year, Powertrain, Country
    - Enforce maximum 3 vehicle selection
    - Prevent 4th selection with visual feedback
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ]* 7.2 Write property test for vehicle selection limit
    - **Property 2: Vehicle Selection Limit**
    - **Validates: Requirements 2.2, 2.3**
  
  - [ ] 7.3 Create ComparisonGrid component
    - Display selected vehicles side-by-side
    - Show lifecycle, manufacturing, operational emissions, carbon breakeven
    - Implement responsive layout (vertical on mobile, horizontal on desktop)
    - _Requirements: 2.4, 8.3, 8.4_
  
  - [ ]* 7.4 Write property test for comparison data completeness
    - **Property 3: Comparison Data Completeness**
    - **Validates: Requirements 2.4**
  
  - [ ]* 7.5 Write property test for responsive card layout
    - **Property 21: Responsive Card Layout**
    - **Validates: Requirements 8.3, 8.4**

- [ ] 8. Implement comparison page charts
  - [ ] 8.1 Create grouped bar chart for vehicle comparison
    - Display all selected vehicles
    - _Requirements: 2.5_
  
  - [ ] 8.2 Create stacked lifecycle breakdown chart
    - Show manufacturing vs operational emissions
    - _Requirements: 2.6_
  
  - [ ] 8.3 Create donut chart component for individual vehicles
    - Render one chart per selected vehicle
    - _Requirements: 2.7_
  
  - [ ]* 8.4 Write property test for donut chart per vehicle
    - **Property 4: Donut Chart Per Vehicle**
    - **Validates: Requirements 2.7**
  
  - [ ] 8.5 Create UnitToggle component
    - Support g/km, lifetime kg, 10-year projection
    - Update all values and charts on toggle
    - _Requirements: 2.8, 2.9_
  
  - [ ]* 8.6 Write property test for unit toggle consistency
    - **Property 5: Unit Toggle Consistency**
    - **Validates: Requirements 2.9**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement ComparisonPage
  - [ ] 10.1 Create ComparisonPage component
    - Integrate VehicleSelector, ComparisonGrid, charts, UnitToggle
    - Wire up state management
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  
  - [ ]* 10.2 Write unit tests for ComparisonPage
    - Test filter interactions
    - Test empty state
    - Test maximum selection enforcement
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 11. Implement vehicle detail page components
  - [ ] 11.1 Create VehicleHeader component
    - Display name, year, powertrain badge
    - _Requirements: 3.1_
  
  - [ ] 11.2 Create LifecycleSummary card
    - Show country-specific lifecycle summary
    - _Requirements: 3.2_
  
  - [ ] 11.3 Create ManufacturingBreakdown component
    - Display Glider, Battery, Fluids breakdown
    - _Requirements: 3.3_
  
  - [ ] 11.4 Create OperationalBreakdown component
    - Display Grid intensity and Fuel emissions
    - _Requirements: 3.4_
  
  - [ ]* 11.5 Write property test for emission breakdown completeness
    - **Property 7: Emission Breakdown Completeness**
    - **Validates: Requirements 3.3, 3.4**
  
  - [ ] 11.6 Create InteractivePieChart component
    - Show lifecycle emission breakdown
    - Add hover highlighting
    - _Requirements: 3.5_
  
  - [ ] 11.7 Create CarbonIntensityTimeline component
    - Display emissions over time
    - Add hover tooltips
    - _Requirements: 3.6_

- [ ] 12. Implement VehicleDetailPage
  - [ ] 12.1 Create VehicleDetailPage component
    - Integrate all vehicle detail components
    - Add "Compare with another car" button
    - Add "Add to recommendation pool" button
    - Handle loading and error states
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
  
  - [ ]* 12.2 Write property test for vehicle detail page completeness
    - **Property 6: Vehicle Detail Page Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.5, 3.6**
  
  - [ ]* 12.3 Write property test for compare button pre-selection
    - **Property 8: Compare Button Pre-selection**
    - **Validates: Requirements 3.9**
  
  - [ ]* 12.4 Write unit tests for VehicleDetailPage
    - Test missing data handling
    - Test button interactions
    - Test error states
    - _Requirements: 3.1, 3.9, 9.4, 12.5_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement recommendation page components
  - [ ] 14.1 Create CriteriaForm component
    - Add inputs: Budget range, Body type, Country, Annual km, Powertrain, Grid toggle
    - Implement inline validation
    - _Requirements: 4.1_
  
  - [ ] 14.2 Create RecommendationResults component
    - Display top 3 vehicles
    - Show ranking by sustainability score
    - Apply color-coded scores (green/yellow/orange)
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [ ] 14.3 Create SustainabilityScoreCard component
    - Display score with color coding
    - Show comparison snapshot
    - Show reasoning section
    - _Requirements: 4.4, 4.5, 4.6_
  
  - [ ]* 14.4 Write property test for recommendation count
    - **Property 9: Recommendation Count**
    - **Validates: Requirements 4.2**
  
  - [ ]* 14.5 Write property test for recommendation display completeness
    - **Property 10: Recommendation Display Completeness**
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6**

- [ ] 15. Implement RecommendationPage
  - [ ] 15.1 Create RecommendationPage component
    - Integrate CriteriaForm and RecommendationResults
    - Add animated ranking display
    - Handle calculation loading state
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 15.2 Write unit tests for RecommendationPage
    - Test form validation (budget min < max)
    - Test empty results state
    - Test click to detail page
    - _Requirements: 4.1, 4.2_

- [ ] 16. Implement grid insights page components
  - [ ] 16.1 Create CountrySelector dropdown component
    - List available countries
    - _Requirements: 5.1_
  
  - [ ] 16.2 Create GridIntensityChart component
    - Display generation intensity and plug-adjusted intensity lines
    - Add hover tooltips
    - _Requirements: 5.2_
  
  - [ ]* 16.3 Write property test for grid chart dual intensity
    - **Property 11: Grid Chart Dual Intensity**
    - **Validates: Requirements 5.2**
  
  - [ ] 16.4 Create MetricsDisplay component
    - Show T&D loss percentage and year trend
    - _Requirements: 5.3, 5.4_
  
  - [ ]* 16.5 Write property test for grid metrics display
    - **Property 12: Grid Metrics Display**
    - **Validates: Requirements 5.3, 5.4**
  
  - [ ] 16.6 Create ForecastToggle component
    - Add/remove forecast projection lines
    - _Requirements: 5.5, 5.6_
  
  - [ ]* 16.7 Write property test for forecast toggle effect
    - **Property 13: Forecast Toggle Effect**
    - **Validates: Requirements 5.6**

- [ ] 17. Implement GridInsightsPage
  - [ ] 17.1 Create GridInsightsPage component
    - Integrate CountrySelector, GridIntensityChart, MetricsDisplay, ForecastToggle
    - Handle country selection changes
    - Handle no data state
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [ ]* 17.2 Write unit tests for GridInsightsPage
    - Test country selection
    - Test forecast toggle
    - Test "No data available" for unsupported countries
    - _Requirements: 5.1, 5.6_

- [ ] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Implement methodology page components
  - [ ] 19.1 Create AccordionSection component
    - Implement expand/collapse functionality
    - Add smooth transitions
    - _Requirements: 6.1, 6.2, 9.1_
  
  - [ ]* 19.2 Write property test for accordion expansion
    - **Property 14: Accordion Expansion**
    - **Validates: Requirements 6.2**
  
  - [ ] 19.3 Create ValidationBadge component
    - Display validation badge
    - _Requirements: 6.3_
  
  - [ ] 19.4 Create DataSourcesList component
    - List sources: Ember, GREET, EEA, World Bank
    - Add external links (open in new tab)
    - _Requirements: 6.4_

- [ ] 20. Implement MethodologyPage
  - [ ] 20.1 Create MethodologyPage component
    - Add accordions for Manufacturing, Grid Intensity, Operational, Validation
    - Integrate ValidationBadge and DataSourcesList
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 20.2 Write unit tests for MethodologyPage
    - Test accordion interactions
    - Test external links
    - Test all sections present
    - _Requirements: 6.1, 6.4_

- [ ] 21. Implement landing page components
  - [ ] 21.1 Create Hero section component
    - Display headline: "Compare True Vehicle Carbon Impact"
    - Display subheadline: "Manufacturing + Grid + Fuel Lifecycle Emissions"
    - Add three CTA buttons with navigation
    - _Requirements: 1.1, 1.2, 1.3, 1.6_
  
  - [ ]* 21.2 Write property test for CTA navigation
    - **Property 1: CTA Navigation**
    - **Validates: Requirements 1.6**
  
  - [ ] 21.3 Create AnimatedBackground component
    - Implement subtle animated eco line graph SVG
    - _Requirements: 1.4_
  
  - [ ] 21.4 Create FeatureHighlights component
    - Display: GREET Manufacturing Model, Real Grid Emissions, WLTP + Fuel Lifecycle
    - _Requirements: 1.5_

- [ ] 22. Implement LandingPage
  - [ ] 22.1 Create LandingPage component
    - Integrate Hero, AnimatedBackground, FeatureHighlights
    - Add smooth scroll to highlights
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [ ]* 22.2 Write unit tests for LandingPage
    - Test headline and subheadline text
    - Test CTA buttons present
    - Test feature highlights text
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ] 23. Implement footer and navigation
  - [ ] 23.1 Create Footer component
    - Display CarbonWise branding
    - Show data sources
    - Add GitHub link
    - Add contact email
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ]* 23.2 Write property test for footer completeness
    - **Property 27: Footer Completeness**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
  
  - [ ] 23.3 Create Navigation component
    - Add links to all major pages
    - Implement client-side routing (no full page reload)
    - _Requirements: 10.5, 10.6_
  
  - [ ]* 23.4 Write property test for client-side navigation
    - **Property 28: Client-Side Navigation**
    - **Validates: Requirements 10.6**

- [ ] 24. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Implement routing and app integration
  - [ ] 25.1 Create App component with React Router
    - Set up routes: /, /compare, /vehicle/:id, /recommend, /grid-insights, /methodology
    - Add Navigation and Footer to all pages
    - Implement lazy loading for route components
    - _Requirements: 10.5, 10.6_
  
  - [ ] 25.2 Wrap app with context providers
    - Add VehicleContext, RecommendationContext, ThemeContext, ErrorContext
    - _Requirements: 11.4_
  
  - [ ] 25.3 Add 404 page for invalid routes
    - Provide navigation back to home
    - _Requirements: 9.4_

- [ ] 26. Implement theme and styling consistency
  - [ ]* 26.1 Write property test for theme color consistency
    - **Property 15: Theme Color Consistency**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
  
  - [ ]* 26.2 Write property test for interactive element hover glow
    - **Property 16: Interactive Element Hover Glow**
    - **Validates: Requirements 7.5**
  
  - [ ]* 26.3 Write property test for typography consistency
    - **Property 18: Typography Consistency**
    - **Validates: Requirements 7.7**
  
  - [ ]* 26.4 Write property test for no inline styles
    - **Property 29: No Inline Styles**
    - **Validates: Requirements 11.2**

- [ ] 27. Implement animations and transitions
  - [ ]* 27.1 Write property test for smooth state transitions
    - **Property 23: Smooth State Transitions**
    - **Validates: Requirements 9.1, 9.6**
  
  - [ ] 27.2 Create AnimatedNumber component
    - Animate numeric value changes
    - _Requirements: 9.2_
  
  - [ ]* 27.3 Write property test for numeric value animation
    - **Property 24: Numeric Value Animation**
    - **Validates: Requirements 9.2**

- [ ] 28. Implement accessibility features
  - [ ] 28.1 Add semantic HTML elements throughout
    - Use nav, main, article, aside appropriately
    - _Requirements: 8.5_
  
  - [ ] 28.2 Add ARIA labels to interactive elements
    - Label buttons, inputs, charts
    - _Requirements: 8.5_
  
  - [ ] 28.3 Implement keyboard navigation support
    - Add focus management
    - Add skip navigation link
    - _Requirements: 8.5_
  
  - [ ]* 28.4 Write property test for accessible contrast ratios
    - **Property 22: Accessible Contrast Ratios**
    - **Validates: Requirements 8.5**

- [ ] 29. Implement unit consistency validation
  - [ ]* 29.1 Write property test for unit consistency across pages
    - **Property 34: Unit Consistency Across Pages**
    - **Validates: Requirements 12.6**

- [ ] 30. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 31. Integration and polish
  - [ ]* 31.1 Write integration tests
    - Test complete comparison workflow
    - Test recommendation workflow
    - Test grid insights exploration
    - _Requirements: 1.6, 2.9, 3.9, 4.2, 5.6_
  
  - [ ] 31.2 Add performance optimizations
    - Implement code splitting by route
    - Add useMemo for expensive calculations
    - Debounce filter inputs (300ms)
    - _Requirements: 9.6_
  
  - [ ] 31.3 Test responsive layouts at all breakpoints
    - Verify mobile, tablet, desktop layouts
    - _Requirements: 8.1, 8.3, 8.4_
  
  - [ ] 31.4 Add alt text to all images and charts
    - Ensure screen reader compatibility
    - _Requirements: 8.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: shared components → feature components → pages → integration
