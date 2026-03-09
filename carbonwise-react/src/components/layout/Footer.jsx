import React from 'react';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3 className="footer-title">CarbonWise</h3>
          <p className="footer-description">
            Comprehensive lifecycle carbon analysis for vehicles, powered by GREET and Ember data.
          </p>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">Data Sources</h4>
          <ul className="footer-links">
            <li>
              <a href="https://ember-climate.org" target="_blank" rel="noopener noreferrer" className="footer-link">
                Ember Climate
              </a>
            </li>
            <li>
              <a href="https://greet.es.anl.gov" target="_blank" rel="noopener noreferrer" className="footer-link">
                GREET Model
              </a>
            </li>
            <li>
              <a href="https://www.eea.europa.eu" target="_blank" rel="noopener noreferrer" className="footer-link">
                European Environment Agency
              </a>
            </li>
            <li>
              <a href="https://www.worldbank.org" target="_blank" rel="noopener noreferrer" className="footer-link">
                World Bank
              </a>
            </li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">Contact</h4>
          <ul className="footer-links">
            <li>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="footer-link">
                GitHub
              </a>
            </li>
            <li>
              <a href="mailto:contact@carbonwise.com" className="footer-link">
                Email Us
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">
          © {currentYear} CarbonWise. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
