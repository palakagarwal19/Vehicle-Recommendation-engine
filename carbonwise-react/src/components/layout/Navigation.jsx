import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Navigation.css';

function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen,   setDropdownOpen]   = useState(false);
  const [user,           setUser]           = useState(null);
  const location  = useLocation();
  const navigate  = useNavigate();
  const dropRef   = useRef(null);

  // Sync auth state on every route change
  useEffect(() => {
    const id   = localStorage.getItem('cw_user_id');
    const name = localStorage.getItem('cw_user_name');
    setUser(id ? { id, name: name || 'Account' } : null);
  }, [location.pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const isActive = path => location.pathname === path ? 'nav-link-active' : '';

  function handleLogout() {
    localStorage.removeItem('cw_user_id');
    localStorage.removeItem('cw_user_name');
    setUser(null);
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/');
  }

  const initials = user?.name?.charAt(0).toUpperCase() || '?';

  return (
    <nav className="navigation">
      <div className="nav-container">

        {/* ── Logo ── */}
        <Link to="/" className="nav-logo" onClick={() => setMobileMenuOpen(false)}>
          <span className="nav-logo-icon">🌱</span>
          <span className="nav-logo-text">CarbonWise</span>
        </Link>

        {/* ── Hamburger (mobile) ── */}
        <button
          className="nav-toggle"
          onClick={() => setMobileMenuOpen(o => !o)}
          aria-label="Toggle navigation menu"
        >
          <span className="nav-toggle-icon">{mobileMenuOpen ? '✕' : '☰'}</span>
        </button>

        {/* ── Main nav links ── */}
        <ul className={`nav-menu ${mobileMenuOpen ? 'nav-menu-open' : ''}`}>
          {[
            ['/', 'Home'],
            ['/compare', 'Compare'],
              ['/explore', 'Explore'],
            ['/recommend', 'Recommend'],
            ['/break-even', 'Break-Even'],
            ['/greenwashing', 'Greenwashing'],
            ['/grid-insights', 'Grid Insights'],
            ['/methodology', 'Methodology'],
          ].map(([path, label]) => (
            <li key={path} className="nav-item">
              <Link
                to={path}
                className={`nav-link ${isActive(path)}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </Link>
            </li>
          ))}

          {/* Mobile-only auth section */}
          <li className="nav-divider--mobile" aria-hidden="true" />
          {user ? (
            <>
              <li className="nav-item nav-item--mobile-only">
                <Link to="/wallet" className={`nav-link ${isActive('/wallet')}`} onClick={() => setMobileMenuOpen(false)}>
                  🪙 Carbon Wallet
                </Link>
              </li>
              <li className="nav-item nav-item--mobile-only">
                <Link to="/travel" className={`nav-link ${isActive('/travel')}`} onClick={() => setMobileMenuOpen(false)}>
                  + Log Trip
                </Link>
              </li>
              <li className="nav-item nav-item--mobile-only">
                <button className="nav-link nav-logout-btn" onClick={handleLogout}>↩ Sign out</button>
              </li>
            </>
          ) : (
            <>
              <li className="nav-item nav-item--mobile-only">
                <Link to="/login" className={`nav-link ${isActive('/login')}`} onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
              </li>
              <li className="nav-item nav-item--mobile-only">
                <Link to="/signup" className="nav-link nav-link-signup" onClick={() => setMobileMenuOpen(false)}>Sign up free</Link>
              </li>
            </>
          )}
        </ul>

        {/* ── Desktop right: avatar dropdown or auth buttons ── */}
        <div className="nav-auth-desktop">
          {user ? (
            <div className="nav-avatar-wrap" ref={dropRef}>
              <Link to="/wallet" className="nav-cc-badge" title="Carbon Wallet">
                <span className="nav-cc-icon">🪙</span>
                <span className="nav-cc-label">Wallet</span>
              </Link>

              <button
                className={`nav-avatar-btn ${dropdownOpen ? 'nav-avatar-btn--open' : ''}`}
                onClick={() => setDropdownOpen(o => !o)}
                aria-label="Account menu"
                aria-expanded={dropdownOpen}
              >
                <span className="nav-avatar-initials">{initials}</span>
                <span className="nav-avatar-caret">▾</span>
              </button>

              {dropdownOpen && (
                <div className="nav-dropdown" role="menu">
                  <div className="nav-dropdown-user">
                    <span className="nav-dropdown-avatar">{initials}</span>
                    <div>
                      <div className="nav-dropdown-name">{user.name}</div>
                      <div className="nav-dropdown-sub">Carbon Wallet member</div>
                    </div>
                  </div>
                  <div className="nav-dropdown-divider" />
                  <Link to="/wallet" className="nav-dropdown-item" onClick={() => setDropdownOpen(false)}>
                    <span>🪙</span> Carbon Wallet
                  </Link>
                  <Link to="/travel" className="nav-dropdown-item" onClick={() => setDropdownOpen(false)}>
                    <span>🚗</span> Log a Trip
                  </Link>
                  <div className="nav-dropdown-divider" />
                  <button className="nav-dropdown-item nav-dropdown-item--danger" onClick={handleLogout}>
                    <span>↩</span> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="nav-auth-btns">
              <Link to="/login"  className="nav-auth-btn nav-auth-btn--ghost">Sign in</Link>
              <Link to="/signup" className="nav-auth-btn nav-auth-btn--solid">Sign up free</Link>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
}

export default Navigation;