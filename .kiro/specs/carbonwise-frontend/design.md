# Design Document: CarbonWise Frontend

## Overview

CarbonWise is a pure HTML/CSS/JavaScript web application that provides a premium, data-driven interface for comparing vehicle lifecycle carbon emissions. The frontend architecture emphasizes simplicity, performance, and visual consistency while delivering complex data visualizations in an accessible format.

The application follows a modular architecture with semantic HTML, custom CSS for styling, and vanilla JavaScript for interactivity. It leverages Chart.js for interactive data visualizations. The design prioritizes mobile-first responsive layouts, smooth animations, and a dark theme with eco-green accents that convey scientific precision and environmental consciousness.

## Architecture

### High-Level Structure

```
CarbonWise Frontend
├── Presentation Layer (React Components)
│   ├── Pages (Route-level components)
│   ├── Features (Domain-specific components)
│   └── Shared (Reusable UI components)
├── State Management (React Context/Hooks)
├── Data Layer (API integration)
└── Styling System (Tailwind CSS + Theme)
```

### Technology Stack

- **HTML**: Semantic HTML5 with modular page structure
- **Styling**: Custom CSS3 with CSS variables for theming
- **JavaScript**: Vanilla ES6+ modules for interactivity
- **Charts**: Chart.js for all data visualizations
- **Routing**: Multi-page application with standard HTML links
- **State Management**: LocalStorage and JavaScript modules for state persistence
- **Build Tool**: None required (static files served directly)

### Routing Structure

```
/ (Landing Page)
/compare (Multi-Car Comparison)
/vehicle/:id (Vehicle Detail)
/recommend (Recommendation Engine)
/grid-insights (Grid Emissions Data)
/methodology (Documentation)
```

## Components and Interfaces

### Page Components

#### 1. LandingPage
**Purpose**: Entry point showcasing platform value proposition

**Props**: None

**State**:
- `isAnimating`: boolean for background animation state

**Key Elements**:
- Hero section with headline and subheadline
- Three CTA buttons (Compare, Recommend, Methodology)
- Animated SVG background with eco line graph
- Feature highlights grid

**Interactions**:
- CTA buttons navigate to respective routes
- Smooth scroll to feature highlights section

---

#### 2. ComparisonPage
**Purpose**: Side-by-side comparison of up to 3 vehicles

**Props**: None

**State**:
- `selectedVehicles`: Array<Vehicle> (max 3)
- `filters`: FilterState (brand, model, year, powertrain, country)
- `displayUnit`: 'g_km' | 'lifetime_kg' | 'ten_year_projection'

**Key Elements**:
- VehicleSelector component with filters
- ComparisonGrid displaying selected vehicles
- ChartContainer with grouped bar, stacked, and donut charts
- UnitToggle for switching display units

**Interactions**:
- Filter changes update available vehicles
- Vehicle selection updates comparison display
- Unit toggle recalculates and updates all values
- Maximum 3 vehicles enforced with visual feedback

---

#### 3. VehicleDetailPage
**Purpose**: Comprehensive view of single vehicle emissions

**Props**:
- `vehicleId`: string (from route params)

**State**:
- `vehicle`: Vehicle | null
- `isLoading`: boolean
- `error`: Error | null

**Key Elements**:
- VehicleHeader (name, year, powertrain badge)
- LifecycleSummary card
- ManufacturingBreakdown (glider, battery, fluids)
- OperationalBreakdown (grid, fuel)
- InteractivePieChart
- CarbonIntensityTimeline
- Action buttons (Compare, Add to Pool)

**Interactions**:
- Pie chart segments highlight on hover
- Timeline chart shows tooltip on hover
- Compare button navigates with vehicle pre-selected
- Add to pool button stores vehicle in recommendation context

---

#### 4. RecommendationPage
**Purpose**: Personalized vehicle recommendations based on user criteria

**Props**: None

**State**:
- `criteria`: RecommendationCriteria
- `recommendations`: Array<VehicleRecommendation>
- `isCalculating`: boolean

**Key Elements**:
- CriteriaForm (budget, body type, country, annual km, powertrain, grid toggle)
- RecommendationResults (top 3 vehicles)
- SustainabilityScoreCard for each recommendation
- ComparisonSnapshot
- ReasoningSection

**Interactions**:
- Form submission triggers recommendation calculation
- Results display with animated ranking
- Color-coded scores (green: excellent, yellow: good, orange: moderate)
- Click vehicle to view detail page

---

#### 5. GridInsightsPage
**Purpose**: Country-specific electricity grid emission data

**Props**: None

**State**:
- `selectedCountry`: string
- `showForecast`: boolean
- `gridData`: GridData | null

**Key Elements**:
- CountrySelector dropdown
- GridIntensityChart (line chart)
- MetricsDisplay (T&D loss, year trend)
- ForecastToggle

**Interactions**:
- Country selection loads new grid data
- Forecast toggle adds/removes projection lines
- Chart tooltip shows detailed values on hover

---

#### 6. MethodologyPage
**Purpose**: Transparent documentation of calculation methods

**Props**: None

**State**:
- `expandedSections`: Set<string>

**Key Elements**:
- AccordionSection for each methodology category
- ValidationBadge
- DataSourcesList
- ExternalLinks to source documentation

**Interactions**:
- Accordion sections expand/collapse on click
- External links open in new tab

### Feature Components

#### VehicleSelector
**Purpose**: Filter and select vehicles for comparison

**Props**:
- `selectedVehicles`: Array<Vehicle>
- `maxSelections`: number
- `onSelectionChange`: (vehicles: Array<Vehicle>) => void

**State**:
- `filters`: FilterState
- `availableVehicles`: Array<Vehicle>

**Interface**:
```typescript
interface FilterState {
  brand: string[];
  model: string[];
  year: number[];
  powertrain: PowertrainType[];
  country: string;
}

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  powertrain: PowertrainType;
  country: string;
  lifecycleEmissions: number; // g/km
  manufacturingEmissions: EmissionBreakdown;
  operationalEmissions: EmissionBreakdown;
}

type PowertrainType = 'BEV' | 'PHEV' | 'ICE' | 'Hybrid';
```

---

#### ComparisonGrid
**Purpose**: Display selected vehicles in comparison layout

**Props**:
- `vehicles`: Array<Vehicle>
- `displayUnit`: DisplayUnit

**Interface**:
```typescript
interface VehicleComparisonData {
  vehicle: Vehicle;
  lifecycleEmissions: number;
  manufacturingEmissions: number;
  operationalEmissions: number;
  carbonBreakeven: number | null; // km, null if only one vehicle
}
```

---

#### ChartContainer
**Purpose**: Wrapper for all chart components with consistent styling

**Props**:
- `title`: string
- `children`: ReactNode
- `className?`: string

**Features**:
- Glassmorphism card styling
- Responsive sizing
- Loading state support

---

#### EmissionChart
**Purpose**: Reusable chart component for various emission visualizations

**Props**:
- `data`: Array<ChartDataPoint>
- `type`: 'bar' | 'line' | 'pie' | 'donut'
- `colors`: string[]
- `unit`: string

**Interface**:
```typescript
interface ChartDataPoint {
  label: string;
  value: number;
  category?: string;
  color?: string;
}
```

### Shared Components

#### Button
**Props**:
- `variant`: 'primary' | 'secondary' | 'outline'
- `size`: 'sm' | 'md' | 'lg'
- `onClick`: () => void
- `disabled?`: boolean
- `children`: ReactNode

**Styling**:
- Primary: Eco green background with hover glow
- Secondary: Outline with eco green border
- Smooth transitions on all interactions

---

#### Card
**Props**:
- `children`: ReactNode
- `className?`: string
- `hoverable?`: boolean

**Styling**:
- Glassmorphism effect with carbon grey background
- 16px border radius
- Optional green glow on hover

---

#### LoadingSkeleton
**Props**:
- `variant`: 'text' | 'card' | 'chart'
- `count?`: number

**Purpose**: Placeholder during data loading

---

#### ErrorBoundary
**Props**:
- `children`: ReactNode
- `fallback`: ReactNode

**Purpose**: Graceful error handling with recovery options

## Data Models

### Vehicle Data Model

```typescript
interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  powertrain: PowertrainType;
  country: string;
  
  // Lifecycle emissions
  lifecycleEmissions: {
    gPerKm: number;
    lifetimeKg: number;
    tenYearProjection: number;
  };
  
  // Manufacturing breakdown
  manufacturing: {
    glider: number; // kg CO2
    battery: number; // kg CO2
    fluids: number; // kg CO2
    total: number; // kg CO2
  };
  
  // Operational breakdown
  operational: {
    gridIntensity: number; // g/kWh
    fuelEmissions: number; // g/km
    efficiency: number; // kWh/100km or L/100km
  };
  
  // Additional metadata
  bodyType: string;
  price: number;
  range: number; // km
}

type PowertrainType = 'BEV' | 'PHEV' | 'ICE' | 'Hybrid';
```

### Grid Data Model

```typescript
interface GridData {
  country: string;
  year: number;
  generationIntensity: number; // g/kWh
  plugAdjustedIntensity: number; // g/kWh
  tdLossPercent: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  forecast?: Array<{
    year: number;
    projectedIntensity: number;
  }>;
}
```

### Recommendation Criteria Model

```typescript
interface RecommendationCriteria {
  budgetRange: {
    min: number;
    max: number;
  };
  bodyType: string[];
  country: string;
  annualKmDriven: number;
  preferredPowertrain: PowertrainType[];
  gridDecarbonization: boolean;
}

interface VehicleRecommendation {
  vehicle: Vehicle;
  sustainabilityScore: number; // 0-100
  ranking: number; // 1-3
  reasoning: string[];
  comparisonSnapshot: {
    vsAverageICE: number; // percentage difference
    lifetimeSavings: number; // kg CO2
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: CTA Navigation
*For any* CTA button on the landing page, clicking it should navigate to the corresponding route without full page reload.
**Validates: Requirements 1.6**

### Property 2: Vehicle Selection Limit
*For any* set of vehicles, the comparison page should allow selection of up to 3 vehicles and prevent selection of a 4th vehicle while maintaining current state.
**Validates: Requirements 2.2, 2.3**

### Property 3: Comparison Data Completeness
*For any* selected vehicle in the comparison view, the display should include lifecycle emissions, manufacturing emissions, operational emissions, and carbon break-even distance.
**Validates: Requirements 2.4**

### Property 4: Donut Chart Per Vehicle
*For any* vehicle in the comparison view, a donut chart should be rendered for that vehicle.
**Validates: Requirements 2.7**

### Property 5: Unit Toggle Consistency
*For any* unit toggle change (g/km, lifetime kg, or 10-year projection), all displayed emission values and charts should update to reflect the new unit.
**Validates: Requirements 2.9**

### Property 6: Vehicle Detail Page Completeness
*For any* valid vehicle ID, the vehicle detail page should display the vehicle name, year, powertrain badge, country-specific lifecycle summary, interactive pie chart, and carbon intensity timeline.
**Validates: Requirements 3.1, 3.2, 3.5, 3.6**

### Property 7: Emission Breakdown Completeness
*For any* vehicle with emission data, the manufacturing breakdown should show Glider, Battery, and Fluids components, and the operational breakdown should show Grid intensity and Fuel emissions.
**Validates: Requirements 3.3, 3.4**

### Property 8: Compare Button Pre-selection
*For any* vehicle detail page, clicking "Compare with another car" should navigate to the comparison page with that vehicle already selected.
**Validates: Requirements 3.9**

### Property 9: Recommendation Count
*For any* valid recommendation criteria submission, the system should return exactly 3 vehicle recommendations.
**Validates: Requirements 4.2**

### Property 10: Recommendation Display Completeness
*For any* recommended vehicle, the display should include ranking by sustainability score, color-coded score, comparison snapshot, and reasoning section.
**Validates: Requirements 4.3, 4.4, 4.5, 4.6**

### Property 11: Grid Chart Dual Intensity
*For any* selected country with grid data, the line chart should display both generation intensity and plug-adjusted intensity over time.
**Validates: Requirements 5.2**

### Property 12: Grid Metrics Display
*For any* country's grid data display, both T&D loss percentage and year trend should be shown.
**Validates: Requirements 5.3, 5.4**

### Property 13: Forecast Toggle Effect
*For any* country with forecast data, activating the forecast toggle should add projected future values to the line chart.
**Validates: Requirements 5.6**

### Property 14: Accordion Expansion
*For any* accordion section on the methodology page, clicking it should expand to show detailed content.
**Validates: Requirements 6.2**

### Property 15: Theme Color Consistency
*For any* page, main backgrounds should use deep black (#0D0D0D), card backgrounds should use carbon grey (#1A1A1A), primary actions should use eco green (#00C853), and secondary highlights should use soft green (#69F0AE).
**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 16: Interactive Element Hover Glow
*For any* interactive element, hovering should apply a subtle neon green glow effect.
**Validates: Requirements 7.5**

### Property 17: Card Styling Consistency
*For any* card component, it should have glassmorphism styling with 16px rounded corners.
**Validates: Requirements 7.6**

### Property 18: Typography Consistency
*For any* page, body text should use Inter or Poppins font family, and headings should use bold weight.
**Validates: Requirements 7.7**

### Property 19: Chart Color Scheme
*For any* chart component, it should use neon green gradient colors on a black background.
**Validates: Requirements 7.8**

### Property 20: Button Variant Styling
*For any* button, primary buttons should have eco green background styling, and secondary buttons should have outline styling.
**Validates: Requirements 7.9, 7.10**

### Property 21: Responsive Card Layout
*For any* comparison card display, cards should stack vertically on mobile viewports and display horizontally on desktop viewports.
**Validates: Requirements 8.3, 8.4**

### Property 22: Accessible Contrast Ratios
*For any* color combination used in the interface, the contrast ratio should meet WCAG AA standards (minimum 4.5:1 for normal text, 3:1 for large text).
**Validates: Requirements 8.5**

### Property 23: Smooth State Transitions
*For any* UI state change, smooth CSS transitions should be applied with duration <= 300ms.
**Validates: Requirements 9.1, 9.6**

### Property 24: Numeric Value Animation
*For any* numeric value update, the change should be animated rather than instantly replaced.
**Validates: Requirements 9.2**

### Property 25: Loading State Skeletons
*For any* data loading state, loading skeleton components should be displayed in place of content.
**Validates: Requirements 9.3**

### Property 26: Error Display with Recovery
*For any* error condition, a user-friendly error message should be displayed along with recovery options or guidance.
**Validates: Requirements 9.4, 9.5**

### Property 27: Footer Completeness
*For any* page, the footer should display CarbonWise branding, data sources, GitHub link, and contact email.
**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 28: Client-Side Navigation
*For any* navigation link click, the navigation should occur without a full page reload (using client-side routing).
**Validates: Requirements 10.6**

### Property 29: No Inline Styles
*For any* rendered DOM element, it should not have inline style attributes (all styling via Tailwind classes).
**Validates: Requirements 11.2**

### Property 30: Recharts Usage
*For any* chart component, it should be implemented using the Recharts library.
**Validates: Requirements 11.5**

### Property 31: Number Formatting Consistency
*For any* displayed number, emission values should have 1 decimal place, large numbers (>= 1000) should have thousand separators, and percentages should have 1 decimal place.
**Validates: Requirements 12.1, 12.2, 12.3**

### Property 32: Currency Localization
*For any* currency value display, the format should match the selected country's conventions (symbol position, decimal separator, thousand separator).
**Validates: Requirements 12.4**

### Property 33: Missing Data Placeholder
*For any* data field that is unavailable or null, the display should show "N/A" or appropriate placeholder text instead of empty space or error.
**Validates: Requirements 12.5**

### Property 34: Unit Consistency Across Pages
*For any* metric type (e.g., emissions, distance, efficiency), the same unit should be used consistently across all pages where that metric appears.
**Validates: Requirements 12.6**

## Error Handling

### Error Categories

1. **Network Errors**: API request failures, timeouts
2. **Data Errors**: Invalid or missing vehicle data, malformed responses
3. **User Input Errors**: Invalid filter combinations, out-of-range values
4. **Routing Errors**: Invalid vehicle IDs, non-existent routes

### Error Handling Strategy

#### Network Errors
- Display toast notification with retry option
- Show cached data if available with "offline" indicator
- Provide manual refresh button
- Log errors to monitoring service

#### Data Errors
- Display error boundary with fallback UI
- Show partial data if some fields are valid
- Provide "Report Issue" link
- Gracefully degrade features (e.g., hide chart if data incomplete)

#### User Input Errors
- Inline validation with immediate feedback
- Disable submit buttons until valid
- Show helpful error messages near input fields
- Suggest corrections (e.g., "Budget minimum must be less than maximum")

#### Routing Errors
- Redirect to 404 page for invalid routes
- Suggest similar vehicles for invalid vehicle IDs
- Provide navigation back to home or comparison page

### Error Recovery Patterns

```typescript
interface ErrorState {
  type: 'network' | 'data' | 'input' | 'routing';
  message: string;
  recoveryActions: Array<{
    label: string;
    action: () => void;
  }>;
}

// Example: Network error recovery
const networkError: ErrorState = {
  type: 'network',
  message: 'Unable to load vehicle data. Please check your connection.',
  recoveryActions: [
    { label: 'Retry', action: () => refetchData() },
    { label: 'Use Cached Data', action: () => loadFromCache() },
    { label: 'Go Home', action: () => navigate('/') }
  ]
};
```

### Loading States

- **Initial Load**: Full-page skeleton with branded loading animation
- **Data Refresh**: Shimmer effect on affected components
- **Chart Loading**: Skeleton chart with axis placeholders
- **Lazy Loading**: Progressive loading with "Load More" button

## Testing Strategy

### Dual Testing Approach

The CarbonWise frontend will employ both unit testing and property-based testing to ensure comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property Tests**: Verify universal properties across all inputs

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Unit Testing

**Framework**: Vitest + React Testing Library

**Focus Areas**:
- Specific page rendering examples (landing page content, methodology page structure)
- Component integration points (vehicle selector with comparison grid)
- Edge cases (empty states, maximum selections, boundary values)
- Error conditions (network failures, invalid data, missing fields)
- User interactions (button clicks, form submissions, navigation)

**Example Unit Tests**:
- Landing page displays correct headline and CTA buttons
- Comparison page prevents selection of 4th vehicle
- Vehicle detail page handles missing data gracefully
- Recommendation form validates budget range (min < max)
- Grid insights page displays "No data available" for unsupported countries

**Unit Test Balance**:
Unit tests should focus on concrete examples and integration points. Avoid writing too many unit tests for scenarios that property tests can cover through randomization. Property tests will handle comprehensive input coverage, so unit tests should target specific examples that demonstrate correct behavior and edge cases that need explicit verification.

### Property-Based Testing

**Framework**: fast-check (JavaScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: carbonwise-frontend, Property {number}: {property_text}`
- Seed-based reproducibility for failed tests

**Property Test Implementation**:
Each correctness property listed above must be implemented as a single property-based test. The test should:
1. Generate random valid inputs using fast-check arbitraries
2. Execute the operation or render the component
3. Assert the property holds for all generated inputs
4. Reference the design document property number in a comment

**Example Property Test Structure**:
```typescript
// Feature: carbonwise-frontend, Property 5: Unit Toggle Consistency
test('unit toggle updates all values consistently', () => {
  fc.assert(
    fc.property(
      fc.array(vehicleArbitrary, { minLength: 1, maxLength: 3 }),
      fc.constantFrom('g_km', 'lifetime_kg', 'ten_year_projection'),
      (vehicles, newUnit) => {
        const { container } = render(<ComparisonPage initialVehicles={vehicles} />);
        const toggle = screen.getByRole('button', { name: /unit toggle/i });
        
        // Change unit
        fireEvent.click(toggle);
        selectUnit(newUnit);
        
        // Verify all displayed values use new unit
        const displayedValues = getAllEmissionValues(container);
        return displayedValues.every(val => val.unit === newUnit);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Arbitraries to Implement**:
- `vehicleArbitrary`: Generates random valid Vehicle objects
- `gridDataArbitrary`: Generates random valid GridData objects
- `recommendationCriteriaArbitrary`: Generates random valid criteria
- `colorArbitrary`: Generates valid hex color codes
- `viewportSizeArbitrary`: Generates viewport dimensions (mobile, tablet, desktop)

**Property Test Coverage**:
- Navigation and routing (Properties 1, 8, 28)
- Data display completeness (Properties 3, 6, 7, 10, 12, 27)
- Visual consistency (Properties 15-20)
- Responsive behavior (Property 21)
- Accessibility (Property 22)
- Animations and transitions (Properties 23, 24)
- Error handling (Properties 25, 26)
- Data formatting (Properties 31-34)

### Integration Testing

**Focus**: End-to-end user flows
- Complete comparison workflow (select vehicles → view comparison → view detail → add to recommendation)
- Recommendation workflow (input criteria → view results → compare recommended vehicles)
- Grid insights exploration (select country → toggle forecast → compare countries)

### Visual Regression Testing

**Tool**: Percy or Chromatic

**Coverage**:
- All page layouts at mobile, tablet, desktop breakpoints
- Component states (hover, active, disabled, error)
- Chart rendering consistency
- Dark theme color accuracy

### Accessibility Testing

**Tools**: axe-core, WAVE

**Coverage**:
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios (automated via Property 22)
- Focus management
- ARIA labels and roles

### Performance Testing

**Metrics**:
- First Contentful Paint < 1.5s
- Time to Interactive < 3.5s
- Largest Contentful Paint < 2.5s
- Chart rendering < 500ms

**Tools**: Lighthouse, Web Vitals

## Implementation Notes

### State Management

Use React Context API for global state:
- `VehicleContext`: Selected vehicles for comparison
- `RecommendationContext`: Recommendation pool and criteria
- `ThemeContext`: Dark theme configuration (future: light mode toggle)
- `ErrorContext`: Global error handling and toast notifications

### API Integration

```typescript
interface APIClient {
  getVehicles(filters: FilterState): Promise<Vehicle[]>;
  getVehicleById(id: string): Promise<Vehicle>;
  getGridData(country: string): Promise<GridData>;
  getRecommendations(criteria: RecommendationCriteria): Promise<VehicleRecommendation[]>;
}
```

### Performance Optimizations

- Lazy load route components with React.lazy()
- Memoize expensive chart calculations with useMemo()
- Debounce filter inputs (300ms)
- Virtual scrolling for large vehicle lists
- Image optimization with WebP format
- Code splitting by route

### Accessibility Considerations

- Semantic HTML elements (nav, main, article, aside)
- ARIA labels for interactive elements
- Keyboard shortcuts for common actions
- Focus trap in modals
- Skip navigation link
- Alt text for all images and charts

### Browser Support

- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- Mobile Safari: iOS 14+
- Chrome Mobile: Android 10+

### Deployment

- Build with Vite for optimized production bundle
- Deploy to Vercel or Netlify with automatic preview deployments
- Environment variables for API endpoints
- CDN for static assets
- Gzip compression enabled