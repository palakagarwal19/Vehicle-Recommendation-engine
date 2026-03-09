# Design Document: React Frontend Conversion

## Overview

This design document specifies the technical architecture for converting the CarbonWise HTML/CSS/JavaScript application into a modern React-based single-page application (SPA). The conversion maintains all existing functionality while improving code organization, maintainability, and user experience through React's component-based architecture and client-side routing.

### Goals

- Convert 7 HTML pages into React components with client-side routing
- Preserve existing API client with minimal modifications
- Maintain visual design and CSS styling from the legacy application
- Implement reusable component library for consistent UI
- Optimize performance with lazy loading and code splitting
- Ensure accessibility compliance and responsive design
- Provide comprehensive testing setup and documentation

### Non-Goals

- Redesigning the user interface or user experience
- Modifying backend API endpoints or data structures
- Implementing server-side rendering (SSR)
- Adding new features beyond the existing application
- Migrating to TypeScript (JavaScript will be used)

### Technology Stack

- **Build Tool**: Vite 5.x (fast builds, HMR, optimized production bundles)
- **Framework**: React 18.x (component-based architecture, hooks, concurrent features)
- **Routing**: React Router DOM 6.x (declarative routing, nested routes, URL parameters)
- **HTTP Client**: Axios (promise-based, interceptors, request/response transformation)
- **Charts**: Chart.js 4.x + react-chartjs-2 (data visualization)
- **Testing**: Vitest + React Testing Library (fast unit tests, component testing)
- **Styling**: CSS (reuse existing stylesheets, CSS modules for component-specific styles)

## Architecture

### High-Level Architecture

The React application follows a layered architecture pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Page         │  │ UI           │  │ Chart        │      │
│  │ Components   │  │ Components   │  │ Components   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ React Router │  │ State        │  │ Hooks        │      │
│  │              │  │ Management   │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Service Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ API Client   │  │ Utilities    │  │ Formatters   │      │
│  │              │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Flask)                       │
│                   http://localhost:5000                      │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App
├── Router (BrowserRouter)
│   ├── Layout
│   │   ├── Navigation
│   │   ├── Outlet (Page Content)
│   │   └── Footer
│   │
│   └── Routes
│       ├── Home
│       ├── Compare
│       │   ├── FilterPanel
│       │   ├── VehicleSelector
│       │   ├── ComparisonGrid
│       │   └── Charts (Bar, Stacked, Donut)
│       │
│       ├── VehicleDetail
│       │   ├── VehicleHeader
│       │   ├── LifecycleSummary
│       │   ├── CarbonScore
│       │   ├── EmissionsBreakdown (Chart)
│       │   ├── GridSensitivity (Chart)
│       │   └── AnnualCalculator
│       │
│       ├── Recommend
│       │   ├── RecommendationForm
│       │   └── RecommendationResults
│       │
│       ├── BreakEven
│       │   ├── VehicleSelector (EV)
│       │   ├── VehicleSelector (ICE)
│       │   ├── AnalysisParameters
│       │   └── BreakEvenResults (Chart)
│       │
│       ├── Greenwashing
│       │   ├── AnalysisForm
│       │   └── GreenwashingResults
│       │
│       ├── GridInsights
│       │   ├── CountrySelector
│       │   ├── GridIntensity
│       │   ├── HistoricalTrends (Chart)
│       │   └── EnergyBreakdown (Chart)
│       │
│       ├── Methodology
│       │   └── MethodologyContent
│       │
│       └── NotFound
```

### Routing Architecture

React Router v6 will manage all client-side navigation:

```javascript
// Route Configuration
const routes = [
  { path: '/', element: <Home /> },
  { path: '/compare', element: <Compare /> },
  { path: '/vehicle/:brand/:model/:year', element: <VehicleDetail /> },
  { path: '/recommend', element: <Recommend /> },
  { path: '/break-even', element: <BreakEven /> },
  { path: '/greenwashing', element: <Greenwashing /> },
  { path: '/grid-insights', element: <GridInsights /> },
  { path: '/methodology', element: <Methodology /> },
  { path: '*', element: <NotFound /> }
];
```

**Routing Features**:
- BrowserRouter for clean URLs (no hash fragments)
- Lazy loading for code splitting (React.lazy + Suspense)
- URL parameters for vehicle detail page
- Programmatic navigation with useNavigate hook
- Browser back/forward button support

### Data Flow Architecture

```
User Interaction
      │
      ▼
Component Event Handler
      │
      ▼
API Service Call
      │
      ▼
Axios HTTP Request
      │
      ▼
Backend API (Flask)
      │
      ▼
JSON Response
      │
      ▼
Component State Update (useState)
      │
      ▼
React Re-render
      │
      ▼
Updated UI
```

**State Management Strategy**:
- Local component state with useState for UI state
- useEffect for data fetching and side effects
- No global state management library (Redux/Context) needed
- Props drilling for shared state (limited depth)
- API client as singleton for consistent backend communication



## Components and Interfaces

### Page Components

#### Home Page Component

**Purpose**: Landing page with hero section, features, and tool navigation

**Props**: None

**State**:
```javascript
// No state needed - static content
```

**Key Methods**: None

**Rendered Elements**:
- Hero section with animated background
- Call-to-action buttons (Compare, Recommend, Break-Even)
- Features grid (GREET Manufacturing, Real Grid Emissions, WLTP + Fuel Lifecycle)
- Tools grid (6 analysis tool cards)

**Dependencies**:
- Button component
- Card component
- React Router Link

---

#### Compare Page Component

**Purpose**: Multi-vehicle comparison with filters and visualizations

**Props**: None

**State**:
```javascript
{
  filters: {
    brand: string,
    model: string,
    year: number,
    vehicle_type: string,
    country: string
  },
  availableVehicles: Array<Vehicle>,
  selectedVehicles: Array<Vehicle>, // max 3
  comparisonData: Object,
  unitMode: 'g_km' | 'lifetime' | 'ten_year',
  loading: boolean,
  error: string | null
}
```

**Key Methods**:
- `handleFilterChange(filterName, value)` - Update filter state
- `handleVehicleSelect(vehicle)` - Add vehicle to comparison (max 3)
- `handleVehicleRemove(vehicleId)` - Remove vehicle from comparison
- `handleUnitToggle(mode)` - Switch between emission units
- `fetchComparisonData()` - Call API to get lifecycle data

**API Calls**:
- `api.getAllVehicles()` - Get vehicle list for filtering
- `api.compareMultiple(country, year, vehicles)` - Get comparison data

**Dependencies**:
- FilterPanel component
- VehicleCard component
- BarChart, StackedBarChart, DonutChart components
- LoadingSpinner component
- ErrorMessage component

---

#### VehicleDetail Page Component

**Purpose**: Detailed view of a single vehicle's carbon footprint

**Props**: None (uses URL parameters)

**State**:
```javascript
{
  vehicleData: Object,
  lifecycleData: Object,
  carbonScore: Object,
  gridSensitivity: Array,
  annualKm: number,
  annualImpact: Object,
  loading: boolean,
  error: string | null
}
```

**Key Methods**:
- `fetchVehicleData()` - Get vehicle details from URL params
- `fetchLifecycleData()` - Get lifecycle emissions
- `fetchCarbonScore()` - Get carbon score rating
- `fetchGridSensitivity()` - Get grid sensitivity analysis
- `handleAnnualKmChange(km)` - Update annual km input
- `calculateAnnualImpact()` - Calculate annual emissions

**API Calls**:
- `api.getVehicleDetail(brand, model, year)` - Get vehicle metadata
- `api.calculateLifecycle(brand, model, year, country, gridYear)` - Get emissions
- `api.getCarbonScore(totalGPerKm)` - Get score
- `api.getGridSensitivity(brand, model, year, countries, year)` - Get sensitivity
- `api.getAnnualImpact(totalGPerKm, annualKm)` - Get annual impact

**Dependencies**:
- Badge component
- Card component
- BarChart, LineChart components
- Input component
- LoadingSpinner component
- ErrorMessage component

---

#### Recommend Page Component

**Purpose**: Personalized vehicle recommendations based on usage patterns

**Props**: None

**State**:
```javascript
{
  formData: {
    country: string,
    annualKm: number,
    vehicle_type: string
  },
  countries: Array<string>,
  recommendations: Array<Vehicle>,
  loading: boolean,
  error: string | null
}
```

**Key Methods**:
- `handleInputChange(field, value)` - Update form field
- `handleSubmit()` - Submit recommendation request
- `fetchCountries()` - Get available countries

**API Calls**:
- `api.getCountries()` - Get country list
- `api.getRecommendations(dailyKm, years, filters, country, gridYear)` - Get recommendations

**Dependencies**:
- Input component
- Select component
- Button component
- VehicleCard component
- LoadingSpinner component
- ErrorMessage component

---

#### BreakEven Page Component

**Purpose**: Calculate break-even distance between EV and ICE vehicles

**Props**: None

**State**:
```javascript
{
  evSelection: {
    brand: string,
    model: string,
    year: number
  },
  iceSelection: {
    brand: string,
    model: string,
    year: number
  },
  analysisParams: {
    country: string,
    gridYear: number
  },
  breakEvenData: Object,
  vehicles: Array<Vehicle>,
  loading: boolean,
  error: string | null
}
```

**Key Methods**:
- `handleEvSelection(field, value)` - Update EV selection
- `handleIceSelection(field, value)` - Update ICE selection
- `handleParamChange(field, value)` - Update analysis parameters
- `handleCalculate()` - Calculate break-even
- `fetchVehicles()` - Get vehicle list for dropdowns

**API Calls**:
- `api.getAllVehicles()` - Get vehicle list
- `api.calculateBreakEven(country, year, ev, ice)` - Calculate break-even

**Dependencies**:
- Select component
- Button component
- Card component
- LineChart component
- LoadingSpinner component
- ErrorMessage component

---

#### Greenwashing Page Component

**Purpose**: Analyze vehicle environmental claims for accuracy

**Props**: None

**State**:
```javascript
{
  vehicleSelection: {
    brand: string,
    model: string,
    year: number,
    country: string,
    gridYear: number
  },
  analysisResults: Object,
  searchWeb: boolean,
  loading: boolean,
  error: string | null
}
```

**Key Methods**:
- `handleSelectionChange(field, value)` - Update vehicle selection
- `handleAnalyze(withWebSearch)` - Trigger analysis
- `fetchLifecycleData()` - Get vehicle data for analysis

**API Calls**:
- `api.calculateLifecycle(brand, model, year, country, gridYear)` - Get lifecycle data
- `api.detectGreenwashing(lifecycle, vehicleMeta, searchWeb)` - Analyze claims

**Dependencies**:
- Select component
- Button component
- Badge component
- Card component
- LoadingSpinner component
- ErrorMessage component

---

#### GridInsights Page Component

**Purpose**: Explore country-specific grid emissions data

**Props**: None

**State**:
```javascript
{
  selectedCountry: string,
  gridData: Object,
  historicalData: Array,
  energyBreakdown: Object,
  loading: boolean,
  error: string | null
}
```

**Key Methods**:
- `handleCountryChange(country)` - Update selected country
- `fetchGridData()` - Get grid data for selected country

**API Calls**:
- `api.getGridData()` - Get all grid data
- `api.getCountries()` - Get country list

**Dependencies**:
- Select component
- Card component
- LineChart, DonutChart components
- LoadingSpinner component
- ErrorMessage component

---

#### Methodology Page Component

**Purpose**: Display calculation methods and data sources

**Props**: None

**State**:
```javascript
{
  methodologyContent: Object,
  loading: boolean,
  error: string | null
}
```

**Key Methods**:
- `fetchMethodology()` - Get methodology content

**API Calls**:
- `api.getMethodology()` - Get methodology data

**Dependencies**:
- Card component
- LoadingSpinner component
- ErrorMessage component

---

### UI Components

#### Button Component

**Purpose**: Reusable button with variants

**Props**:
```javascript
{
  children: ReactNode,
  variant: 'primary' | 'secondary' | 'outline',
  onClick: Function,
  disabled: boolean,
  loading: boolean,
  type: 'button' | 'submit' | 'reset',
  className: string
}
```

**Variants**:
- `primary`: Solid background, white text
- `secondary`: Lighter background, dark text
- `outline`: Border only, transparent background

---

#### Card Component

**Purpose**: Content container with consistent styling

**Props**:
```javascript
{
  children: ReactNode,
  title: string,
  className: string,
  onClick: Function
}
```

---

#### Input Component

**Purpose**: Text and number input with label

**Props**:
```javascript
{
  label: string,
  type: 'text' | 'number' | 'email',
  value: string | number,
  onChange: Function,
  placeholder: string,
  required: boolean,
  min: number,
  max: number,
  disabled: boolean,
  error: string
}
```

---

#### Select Component

**Purpose**: Dropdown selection with label

**Props**:
```javascript
{
  label: string,
  value: string,
  onChange: Function,
  options: Array<{value: string, label: string}>,
  placeholder: string,
  required: boolean,
  disabled: boolean,
  error: string
}
```

---

#### Badge Component

**Purpose**: Label or tag display

**Props**:
```javascript
{
  children: ReactNode,
  variant: 'success' | 'warning' | 'danger' | 'info',
  size: 'small' | 'medium' | 'large'
}
```

---

#### VehicleCard Component

**Purpose**: Display vehicle information in card format

**Props**:
```javascript
{
  vehicle: {
    brand: string,
    model: string,
    year: number,
    vehicle_type: string,
    emissions: number
  },
  onClick: Function,
  selected: boolean,
  showDetails: boolean
}
```

---

#### LoadingSpinner Component

**Purpose**: Loading indicator

**Props**:
```javascript
{
  size: 'small' | 'medium' | 'large',
  message: string
}
```

---

#### ErrorMessage Component

**Purpose**: Error display with consistent styling

**Props**:
```javascript
{
  message: string,
  onRetry: Function,
  onDismiss: Function
}
```

---

### Chart Components

#### BarChart Component

**Purpose**: Wrapper for Chart.js bar charts

**Props**:
```javascript
{
  data: {
    labels: Array<string>,
    datasets: Array<{
      label: string,
      data: Array<number>,
      backgroundColor: string | Array<string>,
      borderColor: string | Array<string>
    }>
  },
  options: Object,
  height: number
}
```

---

#### StackedBarChart Component

**Purpose**: Wrapper for Chart.js stacked bar charts

**Props**:
```javascript
{
  data: {
    labels: Array<string>,
    datasets: Array<{
      label: string,
      data: Array<number>,
      backgroundColor: string
    }>
  },
  options: Object,
  height: number
}
```

---

#### DonutChart Component

**Purpose**: Wrapper for Chart.js doughnut charts

**Props**:
```javascript
{
  data: {
    labels: Array<string>,
    datasets: Array<{
      data: Array<number>,
      backgroundColor: Array<string>
    }>
  },
  options: Object,
  height: number
}
```

---

#### LineChart Component

**Purpose**: Wrapper for Chart.js line charts

**Props**:
```javascript
{
  data: {
    labels: Array<string>,
    datasets: Array<{
      label: string,
      data: Array<number>,
      borderColor: string,
      backgroundColor: string,
      fill: boolean
    }>
  },
  options: Object,
  height: number
}
```

---

### Layout Components

#### Navigation Component

**Purpose**: Persistent navigation bar across all pages

**Props**: None

**State**:
```javascript
{
  mobileMenuOpen: boolean
}
```

**Key Methods**:
- `toggleMobileMenu()` - Open/close mobile menu
- `closeMobileMenu()` - Close mobile menu on link click

**Features**:
- Logo and brand name
- Navigation links to all pages
- Active page highlighting
- Mobile responsive menu
- Hamburger toggle button

---

#### Footer Component

**Purpose**: Persistent footer across all pages

**Props**: None

**Features**:
- CarbonWise description
- Data source links
- Contact and GitHub links
- Copyright information

---

#### Layout Component

**Purpose**: Wrapper component with Navigation and Footer

**Props**:
```javascript
{
  children: ReactNode
}
```

**Structure**:
```jsx
<Layout>
  <Navigation />
  <main>{children}</main>
  <Footer />
</Layout>
```



## Data Models

### Vehicle Model

```javascript
{
  brand: string,              // e.g., "Tesla"
  model: string,              // e.g., "Model 3"
  year: number,               // e.g., 2023
  vehicle_type: string,         // "BEV", "PHEV", "HEV", "ICE-Petrol", "ICE-Diesel"
  range_km: number,           // Electric range in km
  battery_kwh: number,        // Battery capacity
  fuel_consumption: number,   // L/100km or kWh/100km
  wltp_emissions: number      // g CO2/km (WLTP cycle)
}
```

### Lifecycle Data Model

```javascript
{
  vehicle: {
    brand: string,
    model: string,
    year: number,
    vehicle_type: string
  },
  country: string,
  grid_year: number,
  emissions: {
    manufacturing: {
      total: number,          // kg CO2
      vehicle: number,        // kg CO2
      battery: number         // kg CO2 (for EVs)
    },
    operational: {
      total_g_per_km: number, // g CO2/km
      fuel_g_per_km: number,  // g CO2/km from fuel
      grid_g_per_km: number,  // g CO2/km from electricity
      lifetime_kg: number,    // Total operational emissions
      ten_year_kg: number     // 10-year operational emissions
    },
    total: {
      g_per_km: number,       // Total g CO2/km
      lifetime_kg: number,    // Total lifetime emissions
      ten_year_kg: number     // Total 10-year emissions
    }
  },
  assumptions: {
    lifetime_km: number,      // e.g., 200000
    annual_km: number,        // e.g., 15000
    grid_intensity: number    // g CO2/kWh
  }
}
```

### Comparison Data Model

```javascript
{
  vehicles: Array<{
    id: string,
    vehicle: Vehicle,
    lifecycle: LifecycleData
  }>,
  country: string,
  grid_year: number,
  unit_mode: 'g_km' | 'lifetime' | 'ten_year'
}
```

### Recommendation Model

```javascript
{
  criteria: {
    country: string,
    annual_km: number,
    vehicle_type: string
  },
  recommendations: Array<{
    rank: number,
    vehicle: Vehicle,
    lifecycle: LifecycleData,
    score: number,
    reasoning: string
  }>
}
```

### Break-Even Model

```javascript
{
  ev: {
    vehicle: Vehicle,
    lifecycle: LifecycleData
  },
  ice: {
    vehicle: Vehicle,
    lifecycle: LifecycleData
  },
  analysis: {
    break_even_km: number,
    break_even_years: number,
    cumulative_emissions: Array<{
      km: number,
      ev_emissions: number,
      ice_emissions: number
    }>
  },
  country: string,
  grid_year: number
}
```

### Greenwashing Analysis Model

```javascript
{
  vehicle: Vehicle,
  lifecycle: LifecycleData,
  analysis: {
    risk_level: 'Low' | 'Medium' | 'High',
    transparency_score: number,  // 0-100
    indicators: Array<{
      type: string,
      severity: 'Low' | 'Medium' | 'High',
      description: string,
      evidence: string
    }>,
    findings: Array<string>,
    web_search_results: Array<{
      source: string,
      claim: string,
      verification: string
    }>
  }
}
```

### Grid Data Model

```javascript
{
  country: string,
  current_intensity: number,    // g CO2/kWh
  historical: Array<{
    year: number,
    intensity: number
  }>,
  energy_sources: {
    coal: number,               // percentage
    natural_gas: number,
    nuclear: number,
    hydro: number,
    wind: number,
    solar: number,
    other_renewables: number
  },
  projections: Array<{
    year: number,
    intensity: number,
    scenario: string
  }>
}
```

### Carbon Score Model

```javascript
{
  total_g_per_km: number,
  score: string,              // "A+", "A", "B", "C", "D", "E", "F"
  rating: number,             // 0-100
  description: string,
  comparison: {
    better_than_percent: number,
    category_average: number
  }
}
```

### Annual Impact Model

```javascript
{
  total_g_per_km: number,
  annual_km: number,
  annual_emissions_kg: number,
  equivalents: {
    trees_needed: number,
    flights_equivalent: number,
    gasoline_liters: number
  }
}
```

### Methodology Content Model

```javascript
{
  sections: Array<{
    title: string,
    content: string,
    subsections: Array<{
      title: string,
      content: string
    }>
  }>,
  data_sources: Array<{
    name: string,
    url: string,
    description: string
  }>,
  formulas: Array<{
    name: string,
    formula: string,
    variables: Array<{
      symbol: string,
      description: string,
      unit: string
    }>
  }>,
  assumptions: Array<{
    parameter: string,
    value: string,
    justification: string
  }>
}
```

### API Error Model

```javascript
{
  error: string,              // Error message
  status: number,             // HTTP status code
  details: string,            // Additional details
  timestamp: string           // ISO timestamp
}
```

### Filter State Model

```javascript
{
  brand: string | null,
  model: string | null,
  year: number | null,
  vehicle_type: string | null,
  country: string | null
}
```

### UI State Model

```javascript
{
  loading: boolean,
  error: string | null,
  success: string | null,
  mobileMenuOpen: boolean,
  modalOpen: boolean,
  selectedTab: string
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several patterns emerged that allow us to consolidate redundant properties:

**Consolidated Patterns**:
1. Loading state properties (8.8, 9.10, 10.6, 11.9, 12.8, 13.7, 14.6, 21.1, 21.4, 21.5) - All test the same pattern: components show loading indicators during async operations and hide them when complete
2. Error handling properties (8.9, 10.7, 11.10, 12.9, 13.8, 14.7, 20.1, 20.5) - All test the same pattern: API failures display error messages
3. Data fetching on mount (9.2, 10.2, 13.1, 14.1, 17.5) - All test the same pattern: components fetch data when mounted
4. Layout component rendering (5.7, 6.5) - Both test that layout components appear on all routes
5. Chart rendering properties (9.6, 9.7, 11.7, 13.4, 13.5) - All test that charts render when data is available
6. Form submission properties (10.3, 11.5, 12.2, 18.6) - All test that form submission triggers API calls
7. Accessibility properties (24.2, 24.5, 24.6) - Can be combined into comprehensive accessibility property

**Properties to Keep Separate**:
- Component-specific behaviors that have unique logic
- URL parameter handling (unique to routing)
- Filter and selection constraints (unique business logic)
- Responsive behavior (unique to viewport changes)
- Environment configuration (unique to build/deployment)

### Property 1: API Client Singleton

*For any* two imports of the API client module, both imports should return the same instance object.

**Validates: Requirements 3.4**

### Property 2: API Client Environment Configuration

*For any* environment variable value set for VITE_API_BASE_URL, the API client should use that value as the base URL for all requests.

**Validates: Requirements 3.2, 22.2**

### Property 3: API Client Error Handling

*For any* API method that encounters an error, the error should be caught, logged to console, and returned to the calling component in a consistent format.

**Validates: Requirements 3.5, 20.5**

### Property 4: SPA Navigation Without Reload

*For any* navigation link click within the application, the browser should not perform a full page reload (window.location should not change).

**Validates: Requirements 4.4**

### Property 5: Browser History Integration

*For any* sequence of navigation actions, clicking the browser back button should navigate to the previous route and clicking forward should navigate to the next route.

**Validates: Requirements 4.6**

### Property 6: Active Navigation Highlighting

*For any* route in the application, the navigation link corresponding to that route should have an active class or style applied.

**Validates: Requirements 5.3**

### Property 7: Mobile Menu Toggle

*For any* state of the mobile menu (open or closed), clicking the toggle button should switch to the opposite state.

**Validates: Requirements 5.5**

### Property 8: Mobile Menu Auto-Close

*For any* navigation link clicked while the mobile menu is open, the menu should close after navigation.

**Validates: Requirements 5.6**

### Property 9: Layout Components on All Routes

*For any* route in the application, both the Navigation component and Footer component should be rendered.

**Validates: Requirements 5.7, 6.5**

### Property 10: Filter-Based Vehicle List Updates

*For any* filter change on the Compare page, the displayed vehicle list should update to show only vehicles matching all active filters.

**Validates: Requirements 8.2**

### Property 11: Vehicle Selection Limit

*For any* state where 3 vehicles are already selected on the Compare page, attempting to select a 4th vehicle should either be prevented or replace one of the existing selections.

**Validates: Requirements 8.3**

### Property 12: Selected Vehicles Display

*For any* vehicle selected on the Compare page, that vehicle should appear in the comparison grid.

**Validates: Requirements 8.4**

### Property 13: Lifecycle Data Fetch on Selection

*For any* vehicle selection on the Compare page, the application should make an API call to fetch lifecycle data for the selected vehicles.

**Validates: Requirements 8.6**

### Property 14: Chart Rendering on Data Receipt

*For any* page component that displays charts, when lifecycle or analysis data is received from the API, the corresponding charts should be rendered with that data.

**Validates: Requirements 8.7, 9.6, 9.7, 11.7, 13.4, 13.5**

### Property 15: Loading State Display

*For any* component performing an async operation (API call), a loading indicator should be displayed while the operation is in progress and hidden when the operation completes (success or failure).

**Validates: Requirements 8.8, 9.10, 10.6, 11.9, 12.8, 13.7, 14.6, 21.1, 21.4, 21.5**

### Property 16: Error Message Display

*For any* API request that fails, an error message should be displayed to the user describing the error.

**Validates: Requirements 8.9, 10.7, 11.10, 12.9, 13.8, 14.7, 20.1**

### Property 17: URL Parameter Extraction

*For any* valid vehicle detail URL with brand, model, and year parameters, the VehicleDetail component should correctly extract and use those parameters to fetch vehicle data.

**Validates: Requirements 9.1**

### Property 18: Data Fetching on Component Mount

*For any* page component that requires data from the API, the component should initiate data fetching when it mounts.

**Validates: Requirements 9.2, 10.2, 13.1, 14.1, 17.5**

### Property 19: Vehicle Detail Data Display

*For any* vehicle detail data received from the API, the VehicleDetail component should display the vehicle name, metadata, vehicle_type badge, lifecycle metrics, carbon score, and charts.

**Validates: Requirements 9.3, 9.4, 9.5, 9.6, 9.7**

### Property 20: Annual Impact Calculator

*For any* annual kilometer input on the VehicleDetail page, changing the input should trigger a calculation and update the displayed annual impact metrics.

**Validates: Requirements 9.8**

### Property 21: Recommendation Display

*For any* recommendation response received from the API, the Recommend page should display up to 3 recommended vehicles with their details and carbon metrics.

**Validates: Requirements 10.4, 10.5**

### Property 22: Cascading Dropdown Updates

*For any* brand selection on the BreakEven page, the model dropdown should update to show only models available for that brand, and the year dropdown should update based on the selected model.

**Validates: Requirements 11.2**

### Property 23: Vehicle Preview Display

*For any* complete vehicle selection (brand, model, year) on the BreakEven page, a vehicle preview card should be displayed.

**Validates: Requirements 11.3**

### Property 24: Break-Even Results Display

*For any* break-even calculation response received from the API, the BreakEven page should display the break-even distance, cumulative emissions chart, and comparison details.

**Validates: Requirements 11.6, 11.7, 11.8**

### Property 25: Greenwashing Analysis Results Display

*For any* greenwashing analysis response received from the API, the Greenwashing page should display the risk badge, indicators, transparency score, and detailed findings.

**Validates: Requirements 12.4, 12.5, 12.6, 12.7**

### Property 26: Grid Insights Country Selection

*For any* country selected on the GridInsights page, the displayed grid intensity, historical trends, and energy breakdown should update to show data for that country.

**Validates: Requirements 13.3**

### Property 27: Conditional Projection Display

*For any* grid data that includes future projections, the GridInsights page should display the projections section; for data without projections, the section should not be displayed.

**Validates: Requirements 13.6**

### Property 28: Methodology Content Display

*For any* methodology data received from the API, the Methodology page should display sections, data sources with links, formulas, and assumptions.

**Validates: Requirements 14.2, 14.3, 14.4, 14.5**

### Property 29: Chart Data Updates

*For any* chart component, when the data prop changes, the chart should re-render to display the new data.

**Validates: Requirements 16.5**

### Property 30: Chart Configuration Props

*For any* chart component, it should accept and apply configuration props for colors, labels, and chart options.

**Validates: Requirements 16.6**

### Property 31: API Response State Updates

*For any* API request that completes successfully, the component should update its state with the response data, triggering a re-render.

**Validates: Requirements 17.6**

### Property 32: Controlled Form Inputs

*For any* form input in the application, the input should have both a value prop (from state) and an onChange handler (to update state).

**Validates: Requirements 18.1**

### Property 33: Form Input State Synchronization

*For any* form input change, the component state should update to reflect the new input value.

**Validates: Requirements 18.2**

### Property 34: Form Submission Prevention

*For any* form submission, the default browser submission behavior should be prevented (no page reload).

**Validates: Requirements 18.3**

### Property 35: Required Field Validation

*For any* form with required fields, submitting the form with empty required fields should display validation error messages and prevent API submission.

**Validates: Requirements 18.4, 18.5**

### Property 36: Valid Form Submission

*For any* form submission where all validation passes, the application should call the appropriate API method with the form data.

**Validates: Requirements 18.6**

### Property 37: Responsive Design Viewport Support

*For any* viewport width (mobile, tablet, desktop), the application should render appropriately with readable content and functional interactions.

**Validates: Requirements 19.4**

### Property 38: Semantic HTML Usage

*For any* page component, the rendered HTML should use semantic elements (nav, main, footer, section, article) appropriately.

**Validates: Requirements 24.1**

### Property 39: Icon Button Accessibility

*For any* button that contains only an icon (no text), the button should have an aria-label attribute describing its purpose.

**Validates: Requirements 24.2**

### Property 40: Image Alt Text

*For any* image element in the application, the image should have an alt attribute with descriptive text.

**Validates: Requirements 24.5**

### Property 41: Heading Hierarchy

*For any* page in the application, headings should follow proper hierarchy (h1 → h2 → h3) without skipping levels.

**Validates: Requirements 24.6**

### Property 42: Keyboard Navigation Support

*For any* interactive element (button, link, input), the element should be keyboard accessible (focusable and operable with keyboard).

**Validates: Requirements 24.3**

### Property 43: Component Re-render Optimization

*For any* component wrapped with React.memo, the component should not re-render when its props have not changed.

**Validates: Requirements 25.2**

### Property 44: Filter Input Debouncing

*For any* rapid sequence of filter input changes, API calls should be debounced to avoid making excessive requests (only the final value after a delay should trigger an API call).

**Validates: Requirements 25.3**

### Property 45: API Response Caching

*For any* API request with identical parameters made within a short time window, the second request should use cached data instead of making a new network request.

**Validates: Requirements 25.4**

### Property 46: Initial Page Load Performance

*For any* initial page load, the application should display meaningful content within 2 seconds on a standard connection.

**Validates: Requirements 25.5**

### Property 47: Button Disabled During Async Operations

*For any* button that triggers an async operation, the button should be disabled while the operation is in progress.

**Validates: Requirements 21.3**



## Error Handling

### Error Handling Strategy

The application implements a comprehensive error handling strategy across all layers:

**API Layer Error Handling**:
```javascript
// API Client error handling
async request(endpoint, options = {}) {
  try {
    const response = await axios({
      url: `${this.baseURL}${endpoint}`,
      ...options
    });
    return response.data;
  } catch (error) {
    console.error('API request failed:', error);
    
    // Transform error into consistent format
    const apiError = {
      message: error.response?.data?.error || error.message,
      status: error.response?.status,
      details: error.response?.data?.details
    };
    
    throw apiError;
  }
}
```

**Component Layer Error Handling**:
```javascript
// Component error handling pattern
const [error, setError] = useState(null);
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const data = await api.someMethod();
    setData(data);
  } catch (err) {
    setError(getErrorMessage(err));
  } finally {
    setLoading(false);
  }
};
```

### Error Types and Messages

**Network Errors**:
- Message: "Network error. Please check your connection."
- Trigger: Network unavailable, CORS issues, timeout
- User Action: Check connection, retry

**404 Not Found**:
- Message: "Resource not found."
- Trigger: Invalid vehicle ID, missing data
- User Action: Return to previous page, try different selection

**500 Server Error**:
- Message: "Server error. Please try again later."
- Trigger: Backend API failure, database error
- User Action: Wait and retry, contact support

**400 Bad Request**:
- Message: "Invalid request. Please check your input."
- Trigger: Invalid form data, missing required fields
- User Action: Review form inputs, correct errors

**Validation Errors**:
- Message: Specific field-level messages (e.g., "Annual km must be greater than 0")
- Trigger: Client-side validation failure
- User Action: Correct specific field

### Error Display Components

**ErrorMessage Component**:
```javascript
<ErrorMessage 
  message={error}
  onRetry={handleRetry}
  onDismiss={() => setError(null)}
/>
```

**Inline Field Errors**:
```javascript
<Input
  label="Annual km"
  value={annualKm}
  onChange={handleChange}
  error={errors.annualKm}
/>
```

**Page-Level Error Boundaries**:
```javascript
// Catch React rendering errors
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

### Error Recovery Strategies

**Automatic Retry**:
- Transient network errors: Retry with exponential backoff
- Rate limit errors: Wait and retry after delay

**User-Initiated Retry**:
- Display "Retry" button for failed requests
- Clear error state before retry attempt

**Graceful Degradation**:
- Show cached data with warning if fresh data unavailable
- Display partial results if some API calls fail
- Provide alternative navigation if primary action fails

**Error Logging**:
- Log all errors to console for debugging
- Include error context (component, action, timestamp)
- Preserve error stack traces in development mode



## Testing Strategy

### Dual Testing Approach

The application requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
**Property Tests**: Verify universal properties across all inputs

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing Configuration

**Library Selection**: fast-check (JavaScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `// Feature: react-frontend-conversion, Property {number}: {property_text}`

**Example Property Test**:
```javascript
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { apiClient } from '../services/api';

describe('API Client', () => {
  // Feature: react-frontend-conversion, Property 1: API Client Singleton
  it('should return the same instance on multiple imports', () => {
    fc.assert(
      fc.property(fc.integer(), () => {
        const instance1 = require('../services/api').apiClient;
        const instance2 = require('../services/api').apiClient;
        expect(instance1).toBe(instance2);
      }),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing Strategy

**Component Testing**:
- Test component rendering with various props
- Test user interactions (clicks, form inputs)
- Test conditional rendering based on state
- Test error states and loading states

**Example Unit Test**:
```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Button from '../components/Button';

describe('Button Component', () => {
  it('should render with primary variant', () => {
    render(<Button variant="primary">Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toHaveClass('btn-primary');
  });

  it('should call onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when loading', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

**API Client Testing**:
- Mock axios responses
- Test error handling
- Test request configuration
- Test singleton behavior

**Utility Function Testing**:
- Test formatters with various inputs
- Test edge cases (null, undefined, extreme values)
- Test calculation functions

### Integration Testing

**Page Component Testing**:
- Test full page rendering
- Test data fetching on mount
- Test user workflows (filter → select → view results)
- Mock API responses

**Example Integration Test**:
```javascript
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Compare from '../pages/Compare';
import * as api from '../services/api';

describe('Compare Page', () => {
  it('should fetch and display vehicles on mount', async () => {
    vi.spyOn(api, 'getAllVehicles').mockResolvedValue([
      { brand: 'Tesla', model: 'Model 3', year: 2023 }
    ]);

    render(
      <BrowserRouter>
        <Compare />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tesla Model 3')).toBeInTheDocument();
    });
  });
});
```

### Routing Testing

**Router Configuration Testing**:
- Test all routes are defined
- Test 404 handling
- Test URL parameter extraction
- Test navigation without reload

**Example Router Test**:
```javascript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('Routing', () => {
  it('should render 404 page for undefined routes', () => {
    render(
      <MemoryRouter initialEntries={['/invalid-route']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it('should extract URL parameters for vehicle detail', () => {
    render(
      <MemoryRouter initialEntries={['/vehicle/Tesla/Model%203/2023']}>
        <App />
      </MemoryRouter>
    );
    // Test that component receives correct params
  });
});
```

### Accessibility Testing

**Automated Accessibility Testing**:
- Use jest-axe for automated a11y checks
- Test keyboard navigation
- Test screen reader compatibility
- Test ARIA attributes

**Example Accessibility Test**:
```javascript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import Navigation from '../components/Navigation';

expect.extend(toHaveNoViolations);

describe('Navigation Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Navigation />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Performance Testing

**Load Time Testing**:
- Measure initial page load time
- Test lazy loading behavior
- Test code splitting effectiveness

**Re-render Testing**:
- Use React DevTools Profiler
- Identify unnecessary re-renders
- Verify React.memo effectiveness

### Test Coverage Goals

**Minimum Coverage Targets**:
- Overall: 80% code coverage
- Components: 85% coverage
- Utilities: 90% coverage
- API Client: 95% coverage

**Coverage Reporting**:
```bash
npm run test:coverage
```

### Continuous Integration

**CI Pipeline**:
1. Run linter (ESLint)
2. Run type checking (if TypeScript added later)
3. Run unit tests
4. Run property tests
5. Run integration tests
6. Generate coverage report
7. Build production bundle
8. Run accessibility checks

**Pre-commit Hooks**:
- Run linter on staged files
- Run tests for changed files
- Prevent commits if tests fail

### Test Organization

**Directory Structure**:
```
src/
├── components/
│   ├── Button.jsx
│   └── Button.test.jsx
├── pages/
│   ├── Compare.jsx
│   └── Compare.test.jsx
├── services/
│   ├── api.js
│   └── api.test.js
└── utils/
    ├── formatters.js
    └── formatters.test.js
```

**Test File Naming**:
- Component tests: `ComponentName.test.jsx`
- Utility tests: `utilityName.test.js`
- Integration tests: `featureName.integration.test.jsx`

### Mocking Strategy

**API Mocking**:
- Use Vitest's `vi.mock()` for API client
- Create mock data factories for consistent test data
- Mock axios for HTTP request testing

**Router Mocking**:
- Use MemoryRouter for testing
- Mock useNavigate and useParams hooks

**Chart Mocking**:
- Mock Chart.js to avoid canvas rendering in tests
- Test chart data transformation logic

### Test Data Management

**Mock Data Factories**:
```javascript
// test/factories/vehicle.js
export const createMockVehicle = (overrides = {}) => ({
  brand: 'Tesla',
  model: 'Model 3',
  year: 2023,
  vehicle_type: 'BEV',
  ...overrides
});

export const createMockLifecycleData = (overrides = {}) => ({
  emissions: {
    manufacturing: { total: 10000, vehicle: 7000, battery: 3000 },
    operational: { total_g_per_km: 50, lifetime_kg: 10000 },
    total: { g_per_km: 100, lifetime_kg: 20000 }
  },
  ...overrides
});
```

### Property Test Examples

**Property 4: SPA Navigation Without Reload**:
```javascript
// Feature: react-frontend-conversion, Property 4: SPA Navigation Without Reload
it('should navigate without page reload', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('/', '/compare', '/recommend', '/break-even'),
      (route) => {
        const { container } = render(
          <MemoryRouter initialEntries={['/']}>
            <App />
          </MemoryRouter>
        );
        
        const initialLocation = window.location.href;
        const link = container.querySelector(`a[href="${route}"]`);
        fireEvent.click(link);
        
        // Location should not change (no full reload)
        expect(window.location.href).toBe(initialLocation);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 10: Filter-Based Vehicle List Updates**:
```javascript
// Feature: react-frontend-conversion, Property 10: Filter-Based Vehicle List Updates
it('should update vehicle list based on filters', () => {
  fc.assert(
    fc.property(
      fc.record({
        brand: fc.constantFrom('Tesla', 'BMW', 'Volkswagen'),
        vehicle_type: fc.constantFrom('BEV', 'PHEV', 'ICE-Petrol')
      }),
      async (filters) => {
        const mockVehicles = [
          { brand: 'Tesla', model: 'Model 3', vehicle_type: 'BEV' },
          { brand: 'BMW', model: 'i4', vehicle_type: 'BEV' },
          { brand: 'Volkswagen', model: 'Golf', vehicle_type: 'ICE-Petrol' }
        ];
        
        vi.spyOn(api, 'getAllVehicles').mockResolvedValue(mockVehicles);
        
        const { container } = render(<Compare />);
        
        // Apply filters
        fireEvent.change(screen.getByLabelText(/brand/i), {
          target: { value: filters.brand }
        });
        fireEvent.change(screen.getByLabelText(/vehicle_type/i), {
          target: { value: filters.vehicle_type }
        });
        
        await waitFor(() => {
          const displayedVehicles = container.querySelectorAll('.vehicle-card');
          displayedVehicles.forEach(card => {
            expect(card.textContent).toContain(filters.brand);
            expect(card.textContent).toContain(filters.vehicle_type);
          });
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 32: Controlled Form Inputs**:
```javascript
// Feature: react-frontend-conversion, Property 32: Controlled Form Inputs
it('should have controlled inputs with value and onChange', () => {
  fc.assert(
    fc.property(
      fc.string(),
      (inputValue) => {
        const { container } = render(<RecommendForm />);
        const inputs = container.querySelectorAll('input, select');
        
        inputs.forEach(input => {
          // All inputs should have value prop
          expect(input).toHaveProperty('value');
          
          // All inputs should have onChange handler
          const hasOnChange = input.onchange !== null || 
                             input.oninput !== null;
          expect(hasOnChange).toBe(true);
        });
      }
    ),
    { numRuns: 100 }
  );
});
```



## Implementation Details

### Project Structure

```
carbonwise-react/
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── assets/
│   │   └── images/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.jsx
│   │   │   ├── Button.test.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Card.test.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Input.test.jsx
│   │   │   ├── Select.jsx
│   │   │   ├── Select.test.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── Badge.test.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   ├── LoadingSpinner.test.jsx
│   │   │   ├── ErrorMessage.jsx
│   │   │   ├── ErrorMessage.test.jsx
│   │   │   ├── VehicleCard.jsx
│   │   │   └── VehicleCard.test.jsx
│   │   ├── charts/
│   │   │   ├── BarChart.jsx
│   │   │   ├── BarChart.test.jsx
│   │   │   ├── StackedBarChart.jsx
│   │   │   ├── StackedBarChart.test.jsx
│   │   │   ├── DonutChart.jsx
│   │   │   ├── DonutChart.test.jsx
│   │   │   ├── LineChart.jsx
│   │   │   └── LineChart.test.jsx
│   │   ├── layout/
│   │   │   ├── Navigation.jsx
│   │   │   ├── Navigation.test.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Footer.test.jsx
│   │   │   ├── Layout.jsx
│   │   │   └── Layout.test.jsx
│   │   └── ErrorBoundary.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Home.test.jsx
│   │   ├── Compare.jsx
│   │   ├── Compare.test.jsx
│   │   ├── VehicleDetail.jsx
│   │   ├── VehicleDetail.test.jsx
│   │   ├── Recommend.jsx
│   │   ├── Recommend.test.jsx
│   │   ├── BreakEven.jsx
│   │   ├── BreakEven.test.jsx
│   │   ├── Greenwashing.jsx
│   │   ├── Greenwashing.test.jsx
│   │   ├── GridInsights.jsx
│   │   ├── GridInsights.test.jsx
│   │   ├── Methodology.jsx
│   │   ├── Methodology.test.jsx
│   │   ├── NotFound.jsx
│   │   └── NotFound.test.jsx
│   ├── services/
│   │   ├── api.js
│   │   └── api.test.js
│   ├── utils/
│   │   ├── formatters.js
│   │   ├── formatters.test.js
│   │   ├── validators.js
│   │   ├── validators.test.js
│   │   ├── debounce.js
│   │   └── debounce.test.js
│   ├── hooks/
│   │   ├── useDebounce.js
│   │   ├── useDebounce.test.js
│   │   ├── useApi.js
│   │   └── useApi.test.js
│   ├── styles/
│   │   ├── variables.css
│   │   ├── reset.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   ├── landing.css
│   │   ├── compare.css
│   │   ├── vehicle-detail.css
│   │   ├── recommend.css
│   │   ├── break-even.css
│   │   ├── greenwashing.css
│   │   ├── grid.css
│   │   └── methodology.css
│   ├── App.jsx
│   ├── App.test.jsx
│   ├── main.jsx
│   └── router.jsx
├── test/
│   ├── setup.js
│   └── factories/
│       ├── vehicle.js
│       └── lifecycle.js
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
├── vitest.config.js
└── README.md
```

### Key Implementation Files

#### main.jsx (Entry Point)

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/reset.css';
import './styles/variables.css';
import './styles/layout.css';
import './styles/components.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

#### App.jsx (Root Component)

```javascript
import React, { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<LoadingSpinner size="large" />}>
            <AppRoutes />
          </Suspense>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
```

#### router.jsx (Route Configuration)

```javascript
import React, { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy load page components
const Home = lazy(() => import('./pages/Home'));
const Compare = lazy(() => import('./pages/Compare'));
const VehicleDetail = lazy(() => import('./pages/VehicleDetail'));
const Recommend = lazy(() => import('./pages/Recommend'));
const BreakEven = lazy(() => import('./pages/BreakEven'));
const Greenwashing = lazy(() => import('./pages/Greenwashing'));
const GridInsights = lazy(() => import('./pages/GridInsights'));
const Methodology = lazy(() => import('./pages/Methodology'));
const NotFound = lazy(() => import('./pages/NotFound'));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/compare" element={<Compare />} />
      <Route path="/vehicle/:brand/:model/:year" element={<VehicleDetail />} />
      <Route path="/recommend" element={<Recommend />} />
      <Route path="/break-even" element={<BreakEven />} />
      <Route path="/greenwashing" element={<Greenwashing />} />
      <Route path="/grid-insights" element={<GridInsights />} />
      <Route path="/methodology" element={<Methodology />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

#### services/api.js (API Client)

```javascript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

class CarbonWiseAPI {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async request(endpoint, options = {}) {
    try {
      const response = await this.client({
        url: endpoint,
        ...options
      });
      return response.data;
    } catch (error) {
      console.error('API request failed:', error);
      
      const apiError = {
        message: this.getErrorMessage(error),
        status: error.response?.status,
        details: error.response?.data?.details
      };
      
      throw apiError;
    }
  }

  getErrorMessage(error) {
    if (!error.response) {
      return 'Network error. Please check your connection.';
    }
    
    switch (error.response.status) {
      case 404:
        return 'Resource not found.';
      case 500:
        return 'Server error. Please try again later.';
      case 400:
        return error.response.data?.error || 'Invalid request. Please check your input.';
      default:
        return error.response.data?.error || 'An error occurred. Please try again.';
    }
  }

  // API methods (same as legacy app)
  async healthCheck() {
    return this.request('/');
  }

  async getVehicleDetail(brand, model, year) {
    return this.request(`/vehicle-detail?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&year=${year}`);
  }

  async calculateLifecycle(brand, model, vehicleYear, country, gridYear) {
    return this.request('/lifecycle', {
      method: 'POST',
      data: {
        brand,
        model,
        vehicle_year: vehicleYear,
        country,
        grid_year: gridYear
      }
    });
  }

  async getCountries() {
    return this.request('/countries');
  }

  async compareMultiple(country, year, vehicles) {
    return this.request('/compare-multiple', {
      method: 'POST',
      data: { country, year, vehicles }
    });
  }

  async getRecommendations(dailyKm, years, filters = {}, country = 'US', gridYear = 2023) {
    return this.request('/recommend', {
      method: 'POST',
      data: {
        daily_km: dailyKm,
        years,
        filters,
        country,
        grid_year: gridYear
      }
    });
  }

  async calculateBreakEven(country, year, ev, ice) {
    return this.request('/break-even', {
      method: 'POST',
      data: { country, year, ev, ice }
    });
  }

  async detectGreenwashing(lifecycle, vehicleMeta, searchWeb = false) {
    return this.request('/greenwashing', {
      method: 'POST',
      data: {
        lifecycle,
        vehicle: vehicleMeta,
        search_web: searchWeb
      }
    });
  }

  async getCarbonScore(totalGPerKm) {
    return this.request('/carbon-score', {
      method: 'POST',
      data: { total_g_per_km: totalGPerKm }
    });
  }

  async getAnnualImpact(totalGPerKm, annualKm) {
    return this.request('/annual-impact', {
      method: 'POST',
      data: {
        total_g_per_km: totalGPerKm,
        annual_km: annualKm
      }
    });
  }

  async getGridSensitivity(brand, model, vehicleYear, countries, year) {
    return this.request('/grid-sensitivity', {
      method: 'POST',
      data: {
        brand,
        model,
        vehicle_year: vehicleYear,
        countries,
        year
      }
    });
  }

  async getMethodology() {
    return this.request('/methodology');
  }

  async getAllVehicles() {
    return this.request('/vehicles');
  }

  async getGridData() {
    return this.request('/grid-data');
  }
}

// Export singleton instance
export const apiClient = new CarbonWiseAPI();
export default apiClient;
```

#### hooks/useApi.js (Custom Hook for API Calls)

```javascript
import { useState, useEffect } from 'react';

export function useApi(apiMethod, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiMethod();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, dependencies);

  return { data, loading, error };
}
```

#### hooks/useDebounce.js (Debounce Hook)

```javascript
import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### Environment Configuration

#### .env.example

```
# API Configuration
VITE_API_BASE_URL=http://localhost:5000

# Development
VITE_DEV_MODE=true
```

#### vite.config.js

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['chart.js', 'react-chartjs-2']
        }
      }
    }
  }
});
```

#### vitest.config.js

```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.test.{js,jsx}',
        '**/*.config.js'
      ]
    }
  }
});
```

#### test/setup.js

```javascript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

### Package.json Scripts

```json
{
  "name": "carbonwise-react",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext js,jsx",
    "lint:fix": "eslint src --ext js,jsx --fix"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0",
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@vitest/ui": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "jsdom": "^23.0.0",
    "fast-check": "^3.15.0",
    "eslint": "^8.55.0",
    "eslint-plugin-react": "^7.33.0",
    "eslint-plugin-react-hooks": "^4.6.0"
  }
}
```

### Build and Deployment

**Development Build**:
```bash
npm run dev
# Starts dev server on http://localhost:3000
# Hot module replacement enabled
# Source maps enabled
```

**Production Build**:
```bash
npm run build
# Creates optimized bundle in dist/
# Minifies JS and CSS
# Generates source maps
# Code splitting for vendors
```

**Preview Production Build**:
```bash
npm run preview
# Serves production build locally
# Test before deployment
```

**Deployment Options**:
1. **Static Hosting** (Netlify, Vercel, GitHub Pages)
   - Deploy dist/ directory
   - Configure redirects for SPA routing
   - Set environment variables

2. **Docker Container**
   - Serve with nginx
   - Configure reverse proxy
   - Handle API CORS

3. **CDN Deployment**
   - Upload to S3/CloudFront
   - Configure cache headers
   - Set up SSL certificate

### Migration Strategy

**Phase 1: Setup and Infrastructure**
1. Initialize Vite project
2. Set up directory structure
3. Configure build tools and testing
4. Copy CSS files from legacy app

**Phase 2: Core Components**
1. Create UI components (Button, Card, Input, etc.)
2. Create chart components
3. Create layout components (Navigation, Footer)
4. Set up routing

**Phase 3: API Integration**
1. Port API client to use Axios
2. Create custom hooks (useApi, useDebounce)
3. Test API client with backend

**Phase 4: Page Components**
1. Convert Home page
2. Convert Compare page
3. Convert VehicleDetail page
4. Convert remaining pages

**Phase 5: Testing and Polish**
1. Write unit tests for all components
2. Write property tests for key behaviors
3. Test accessibility
4. Optimize performance
5. Write documentation

**Phase 6: Deployment**
1. Build production bundle
2. Test production build
3. Deploy to hosting platform
4. Monitor for errors

### Differences from Legacy App

**Architectural Changes**:
- Single-page application vs multi-page
- Component-based vs script-based
- Client-side routing vs server routing
- Declarative UI vs imperative DOM manipulation

**Development Experience**:
- Hot module replacement (instant updates)
- Component dev tools (React DevTools)
- Better error messages
- Faster builds with Vite

**Performance Improvements**:
- Code splitting (smaller initial bundle)
- Lazy loading (load pages on demand)
- Optimized re-renders (React reconciliation)
- Better caching strategies

**Maintainability**:
- Reusable components
- Clear component hierarchy
- Centralized state management
- Comprehensive testing

**User Experience**:
- Faster navigation (no page reloads)
- Smoother transitions
- Better loading states
- Consistent error handling

