# CarbonWise React Frontend

A modern React-based single-page application for comparing vehicle carbon emissions across their entire lifecycle, including manufacturing, operational, and grid emissions.

## Features

- **Multi-Vehicle Comparison**: Compare up to 3 vehicles side-by-side with interactive charts
- **Vehicle Details**: Comprehensive lifecycle analysis for individual vehicles
- **Smart Recommendations**: Get personalized vehicle recommendations based on usage patterns
- **Break-Even Analysis**: Calculate the distance at which an EV's total emissions equal an ICE vehicle
- **Greenwashing Detection**: Analyze vehicle environmental claims for accuracy
- **Grid Insights**: Explore country-specific grid emissions data with historical trends
- **Methodology**: Transparent documentation of calculation methods and data sources

## Tech Stack

- **React 19** - UI library
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Chart.js** - Data visualization
- **CSS3** - Styling

## Prerequisites

- Node.js 18+ and npm
- Backend API running on `http://localhost:5000` (or configure via environment variable)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd carbonwise-react
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
VITE_API_BASE_URL=http://localhost:5000
```

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Development Features

- Hot Module Replacement (HMR)
- Fast refresh
- Source maps
- ESLint integration

## Available Scripts

### `npm run dev`
Starts the development server with HMR on port 5173

### `npm run build`
Creates an optimized production build in the `dist/` directory

### `npm run preview`
Preview the production build locally

### `npm run lint`
Run ESLint to check code quality

### `npm test`
Run the test suite (when configured)

### `npm run test:coverage`
Run tests with coverage report (when configured)

## Project Structure

```
carbonwise-react/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable components
│   │   ├── charts/      # Chart components (Bar, Line, Donut, Stacked)
│   │   ├── layout/      # Layout components (Navigation, Footer, Layout)
│   │   └── ui/          # UI components (Button, Card, Input, Select, etc.)
│   ├── hooks/           # Custom React hooks
│   │   ├── useApi.js    # API data fetching hook
│   │   └── useDebounce.js # Debounce hook
│   ├── pages/           # Page components
│   │   ├── Home.jsx
│   │   ├── Compare.jsx
│   │   ├── VehicleDetail.jsx
│   │   ├── Recommend.jsx
│   │   ├── BreakEven.jsx
│   │   ├── Greenwashing.jsx
│   │   ├── GridInsights.jsx
│   │   ├── Methodology.jsx
│   │   └── NotFound.jsx
│   ├── services/        # API client and services
│   │   └── api.js       # Backend API client
│   ├── styles/          # Global and component styles
│   ├── utils/           # Utility functions
│   │   ├── formatters.js # Number, date, emission formatters
│   │   └── validators.js # Form validation functions
│   ├── App.jsx          # Root component
│   ├── main.jsx         # Application entry point
│   └── router.jsx       # Route configuration
├── .env.example         # Environment variable template
├── .gitignore
├── index.html           # HTML template
├── package.json
├── vite.config.js       # Vite configuration
└── README.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5000` |

## API Integration

The application integrates with the CarbonWise backend API. Ensure the backend is running before starting the frontend.

### API Endpoints Used

- `GET /vehicles` - Get all vehicles
- `GET /countries` - Get available countries
- `GET /grid-data` - Get grid emissions data
- `POST /lifecycle` - Calculate lifecycle emissions
- `POST /compare-multiple` - Compare multiple vehicles
- `POST /recommend` - Get vehicle recommendations
- `POST /break-even` - Calculate break-even distance
- `POST /greenwashing` - Detect greenwashing
- `POST /carbon-score` - Get carbon score
- `POST /annual-impact` - Calculate annual impact
- `POST /grid-sensitivity` - Get grid sensitivity analysis
- `GET /methodology` - Get methodology documentation

### API Client Features

- Singleton pattern
- Automatic error handling
- Request/response interceptors
- In-memory caching (5-minute TTL)
- Consistent error messages

## Performance Optimizations

- **Code Splitting**: All pages are lazy-loaded with React.lazy
- **Component Memoization**: Charts and expensive components use React.memo
- **API Caching**: GET requests are cached for 5 minutes
- **Debouncing**: Filter inputs use debouncing to reduce API calls
- **Bundle Optimization**: Vite automatically optimizes the production bundle

## Accessibility

The application follows WCAG 2.1 guidelines:

- Semantic HTML elements (nav, main, section, article)
- ARIA labels and landmarks
- Keyboard navigation support
- Focus indicators
- Screen reader support
- Proper heading hierarchy

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Differences from Legacy App

### Improvements

1. **Modern React Architecture**: Component-based architecture with hooks
2. **Better Performance**: Code splitting, lazy loading, memoization
3. **Enhanced UX**: Loading states, error handling, smooth transitions
4. **Accessibility**: WCAG 2.1 compliant with semantic HTML and ARIA
5. **Maintainability**: TypeScript-ready, modular structure, reusable components
6. **Developer Experience**: HMR, fast refresh, ESLint integration

### Removed Features

- None - all features from the legacy app have been migrated

## Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Deployment Options

#### 1. Static Hosting (Netlify, Vercel, GitHub Pages)

```bash
# Build the app
npm run build

# Deploy the dist/ directory
```

Configure redirects for SPA routing:

**Netlify** (`public/_redirects`):
```
/*    /index.html   200
```

**Vercel** (`vercel.json`):
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

#### 2. Docker

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 3. CDN

Upload the `dist/` directory to your CDN provider (AWS S3 + CloudFront, Azure CDN, etc.)

### Environment Configuration

For production, update the `.env` file or set environment variables:

```env
VITE_API_BASE_URL=https://api.carbonwise.com
```

## Troubleshooting

### Development Server Won't Start

- Check if port 5173 is already in use
- Delete `node_modules` and run `npm install` again
- Clear Vite cache: `rm -rf node_modules/.vite`

### API Requests Failing

- Ensure backend is running on the configured URL
- Check CORS configuration on the backend
- Verify `VITE_API_BASE_URL` in `.env`

### Build Errors

- Clear cache: `rm -rf dist node_modules/.vite`
- Reinstall dependencies: `npm ci`
- Check for TypeScript/ESLint errors: `npm run lint`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

[Your License Here]

## Contact

[Your Contact Information]

## Acknowledgments

- GREET Model (Argonne National Laboratory) - Manufacturing emissions data
- Ember Climate - Grid intensity data
- European Environment Agency - WLTP data
- Chart.js - Data visualization library
