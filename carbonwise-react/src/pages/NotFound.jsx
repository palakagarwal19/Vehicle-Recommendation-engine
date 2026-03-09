import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

function NotFound() {
  return (
    <main style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <h1 style={{ fontSize: '4rem', margin: '0' }}>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/">
        <Button variant="primary">Go Home</Button>
      </Link>
    </main>
  );
}

export default NotFound;
