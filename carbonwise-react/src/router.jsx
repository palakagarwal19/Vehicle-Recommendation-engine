import React, { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy load page components for code splitting
const Home = lazy(() => import('./pages/Home'));
const Compare = lazy(() => import('./pages/Compare'));
const VehicleDetail = lazy(() => import('./pages/VehicleDetail'));
const Recommend = lazy(() => import('./pages/Recommend'));
const BreakEven = lazy(() => import('./pages/BreakEven'));
const Greenwashing = lazy(() => import('./pages/Greenwashing'));
const GridInsights = lazy(() => import('./pages/GridInsights'));
const Methodology = lazy(() => import('./pages/Methodology'));
const NotFound = lazy(() => import('./pages/NotFound'));

/**
 * Application routes configuration
 */
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

export default AppRoutes;
