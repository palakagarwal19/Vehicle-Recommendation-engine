import React from 'react';
import Navigation from './Navigation';
import Footer from './Footer';
import './Layout.css';

/**
 * Layout component that wraps all pages
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 */
function Layout({ children }) {
  return (
    <div className="layout">
      <Navigation />
      <main className="layout-main">{children}</main>
      <Footer />
    </div>
  );
}

export default Layout;
