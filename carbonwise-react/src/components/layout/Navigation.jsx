import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navigation.css';

function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path ? 'nav-link-active' : '';
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo" onClick={closeMobileMenu}>
          <span className="nav-logo-icon">🌱</span>
          <span className="nav-logo-text">CarbonWise</span>
        </Link>

        <button 
          className="nav-toggle" 
          onClick={toggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <span className="nav-toggle-icon">{mobileMenuOpen ? '✕' : '☰'}</span>
        </button>

        <ul className={`nav-menu ${mobileMenuOpen ? 'nav-menu-open' : ''}`}>
          <li className="nav-item">
            <Link to="/" className={`nav-link ${isActive('/')}`} onClick={closeMobileMenu}>
              Home
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/compare" className={`nav-link ${isActive('/compare')}`} onClick={closeMobileMenu}>
              Compare
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/recommend" className={`nav-link ${isActive('/recommend')}`} onClick={closeMobileMenu}>
              Recommend
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/break-even" className={`nav-link ${isActive('/break-even')}`} onClick={closeMobileMenu}>
              Break-Even
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/greenwashing" className={`nav-link ${isActive('/greenwashing')}`} onClick={closeMobileMenu}>
              Greenwashing
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/grid-insights" className={`nav-link ${isActive('/grid-insights')}`} onClick={closeMobileMenu}>
              Grid Insights
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/methodology" className={`nav-link ${isActive('/methodology')}`} onClick={closeMobileMenu}>
              Methodology
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navigation;
