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
          <Suspense fallback={<LoadingSpinner size="large" message="Loading..." />}>
            <AppRoutes />
          </Suspense>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
