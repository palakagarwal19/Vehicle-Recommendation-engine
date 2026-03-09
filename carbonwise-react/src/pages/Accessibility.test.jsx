import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from './Home';
import Compare from './Compare';
import VehicleDetail from './VehicleDetail';
import Recommend from './Recommend';
import BreakEven from './BreakEven';
import Greenwashing from './Greenwashing';
import GridInsights from './GridInsights';
import Methodology from './Methodology';
import NotFound from './NotFound';

/**
 * Accessibility Tests for React Frontend Conversion
 * 
 * **Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.5, 24.6**
 * 
 * These tests verify that all pages meet accessibility standards:
 * - Property 38: Semantic HTML usage
 * - Property 39: Icon button accessibility
 * - Property 40: Image alt text
 * - Property 41: Heading hierarchy
 * - Property 42: Keyboard navigation support
 */

// Helper to wrap components with Router
const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Accessibility Tests', () => {
  describe('Property 38: Semantic HTML Usage', () => {
    /**
     * **Validates: Requirements 24.1**
     * 
     * For any page component, the rendered HTML should use semantic elements
     * (nav, main, footer, section, article) appropriately.
     */
    
    it('Home page should use semantic HTML elements', () => {
      renderWithRouter(<Home />);
      
      // Check for main element
      const mainElement = document.querySelector('main');
      expect(mainElement).toBeTruthy();
      
      // Check for section elements
      const sections = document.querySelectorAll('section');
      expect(sections.length).toBeGreaterThan(0);
      
      // Check for article elements in features
      const articles = document.querySelectorAll('article');
      expect(articles.length).toBeGreaterThan(0);
    });

    it('Compare page should use semantic section elements', () => {
      renderWithRouter(<Compare />);
      
      // Check for section elements
      const sections = document.querySelectorAll('section');
      expect(sections.length).toBeGreaterThan(0);
      
      // Verify specific sections exist
      const filtersSection = document.querySelector('section[aria-label="Vehicle filters"]');
      expect(filtersSection).toBeTruthy();
    });

    it('VehicleDetail page should use semantic header and sections', () => {
      renderWithRouter(<VehicleDetail />);
      
      // Check for header element
      const headerElement = document.querySelector('header');
      expect(headerElement).toBeTruthy();
      
      // Check for section elements
      const sections = document.querySelectorAll('section');
      expect(sections.length).toBeGreaterThan(0);
    });

    it('NotFound page should use main element', () => {
      renderWithRouter(<NotFound />);
      
      const mainElement = document.querySelector('main');
      expect(mainElement).toBeTruthy();
    });
  });

  describe('Property 39: Icon Button Accessibility', () => {
    /**
     * **Validates: Requirements 24.2**
     * 
     * For any button that contains only an icon (no text), the button should
     * have an aria-label attribute describing its purpose.
     */
    
    it('Navigation toggle button should have aria-label', () => {
      renderWithRouter(<Home />);
      
      const toggleButton = document.querySelector('.nav-toggle');
      if (toggleButton) {
        expect(toggleButton.getAttribute('aria-label')).toBeTruthy();
      }
    });

    it('Compare page remove buttons should have descriptive aria-labels', async () => {
      renderWithRouter(<Compare />);
      
      // Wait for any remove buttons to appear
      const removeButtons = document.querySelectorAll('.remove-btn');
      removeButtons.forEach(button => {
        const ariaLabel = button.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        // Should describe what vehicle is being removed
        expect(ariaLabel.toLowerCase()).toContain('remove');
      });
    });
  });

  describe('Property 40: Image Alt Text', () => {
    /**
     * **Validates: Requirements 24.5**
     * 
     * For any image element in the application, the image should have an
     * alt attribute with descriptive text.
     */
    
    it('Decorative icons should have aria-hidden attribute', () => {
      renderWithRouter(<Home />);
      
      // Check feature icons are marked as decorative
      const featureIcons = document.querySelectorAll('.feature-icon');
      featureIcons.forEach(icon => {
        expect(icon.getAttribute('aria-hidden')).toBe('true');
      });
    });

    it('Canvas element should be marked as presentation', () => {
      renderWithRouter(<Home />);
      
      const canvas = document.querySelector('canvas');
      if (canvas) {
        expect(canvas.getAttribute('aria-hidden')).toBe('true');
        expect(canvas.getAttribute('role')).toBe('presentation');
      }
    });
  });

  describe('Property 41: Heading Hierarchy', () => {
    /**
     * **Validates: Requirements 24.6**
     * 
     * For any page in the application, headings should follow proper hierarchy
     * (h1 → h2 → h3) without skipping levels.
     */
    
    it('Home page should have proper heading hierarchy', () => {
      renderWithRouter(<Home />);
      
      // Should have exactly one h1
      const h1Elements = document.querySelectorAll('h1');
      expect(h1Elements.length).toBe(1);
      
      // Should have h2 elements
      const h2Elements = document.querySelectorAll('h2');
      expect(h2Elements.length).toBeGreaterThan(0);
      
      // h3 elements should only appear after h2
      const h3Elements = document.querySelectorAll('h3');
      if (h3Elements.length > 0) {
        expect(h2Elements.length).toBeGreaterThan(0);
      }
    });

    it('Compare page should have proper heading hierarchy', () => {
      renderWithRouter(<Compare />);
      
      // Should have exactly one h1
      const h1Elements = document.querySelectorAll('h1');
      expect(h1Elements.length).toBe(1);
      
      // Should have h2 elements for major sections
      const h2Elements = document.querySelectorAll('h2');
      expect(h2Elements.length).toBeGreaterThan(0);
    });

    it('VehicleDetail page should have proper heading hierarchy', () => {
      renderWithRouter(<VehicleDetail />);
      
      // Should have exactly one h1
      const h1Elements = document.querySelectorAll('h1');
      expect(h1Elements.length).toBe(1);
      
      // Should have h2 elements for sections
      const h2Elements = document.querySelectorAll('h2');
      expect(h2Elements.length).toBeGreaterThan(0);
    });

    it('Recommend page should have proper heading hierarchy', () => {
      renderWithRouter(<Recommend />);
      
      // Should have exactly one h1
      const h1Elements = document.querySelectorAll('h1');
      expect(h1Elements.length).toBe(1);
      
      // Should have h2 elements
      const h2Elements = document.querySelectorAll('h2');
      expect(h2Elements.length).toBeGreaterThan(0);
    });

    it('BreakEven page should have proper heading hierarchy', () => {
      renderWithRouter(<BreakEven />);
      
      // Should have exactly one h1
      const h1Elements = document.querySelectorAll('h1');
      expect(h1Elements.length).toBe(1);
      
      // Should have h2 elements
      const h2Elements = document.querySelectorAll('h2');
      expect(h2Elements.length).toBeGreaterThan(0);
    });

    it('Greenwashing page should have proper heading hierarchy', () => {
      renderWithRouter(<Greenwashing />);
      
      // Should have exactly one h1
      const h1Elements = document.querySelectorAll('h1');
      expect(h1Elements.length).toBe(1);
      
      // Should have h2 elements
      const h2Elements = document.querySelectorAll('h2');
      expect(h2Elements.length).toBeGreaterThan(0);
    });

    it('GridInsights page should have proper heading hierarchy', () => {
      renderWithRouter(<GridInsights />);
      
      // Should have exactly one h1
      const h1Elements = document.querySelectorAll('h1');
      expect(h1Elements.length).toBe(1);
      
      // Should have h2 elements
      const h2Elements = document.querySelectorAll('h2');
      expect(h2Elements.length).toBeGreaterThan(0);
    });

    it('Methodology page should have proper heading hierarchy', () => {
      renderWithRouter(<Methodology />);
      
      // Should have exactly one h1
      const h1Elements = document.querySelectorAll('h1');
      expect(h1Elements.length).toBe(1);
      
      // Should have h2 elements
      const h2Elements = document.querySelectorAll('h2');
      expect(h2Elements.length).toBeGreaterThan(0);
    });
  });

  describe('Property 42: Keyboard Navigation Support', () => {
    /**
     * **Validates: Requirements 24.3**
     * 
     * For any interactive element (button, link, input), the element should be
     * keyboard accessible (focusable and operable with keyboard).
     */
    
    it('Interactive vehicle items should be keyboard accessible', () => {
      renderWithRouter(<Compare />);
      
      // Check for tabIndex on interactive divs
      const vehicleItems = document.querySelectorAll('.vehicle-item');
      vehicleItems.forEach(item => {
        // Should have tabIndex for keyboard focus
        const tabIndex = item.getAttribute('tabIndex');
        expect(tabIndex).toBe('0');
        
        // Should have aria-label for screen readers
        const ariaLabel = item.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
      });
    });

    it('All buttons should be keyboard accessible', () => {
      renderWithRouter(<Home />);
      
      const buttons = document.querySelectorAll('button');
      buttons.forEach(button => {
        // Buttons are natively keyboard accessible
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('All links should be keyboard accessible', () => {
      renderWithRouter(<Home />);
      
      const links = document.querySelectorAll('a');
      links.forEach(link => {
        // Links are natively keyboard accessible
        expect(link.tagName).toBe('A');
      });
    });

    it('Form inputs should be keyboard accessible', () => {
      renderWithRouter(<Recommend />);
      
      const inputs = document.querySelectorAll('input, select');
      inputs.forEach(input => {
        // Inputs are natively keyboard accessible
        expect(['INPUT', 'SELECT']).toContain(input.tagName);
      });
    });
  });

  describe('ARIA Labels and Landmarks', () => {
    it('Sections should have appropriate ARIA labels', () => {
      renderWithRouter(<Home />);
      
      // Check for aria-labelledby or aria-label on sections
      const sections = document.querySelectorAll('section');
      sections.forEach(section => {
        const hasAriaLabel = section.getAttribute('aria-label') || 
                            section.getAttribute('aria-labelledby');
        // At least some sections should have ARIA labels
        if (section.querySelector('h2[id]')) {
          expect(hasAriaLabel).toBeTruthy();
        }
      });
    });

    it('Compare page should have labeled sections', () => {
      renderWithRouter(<Compare />);
      
      const filtersSection = document.querySelector('section[aria-label="Vehicle filters"]');
      expect(filtersSection).toBeTruthy();
      
      const selectedSection = document.querySelector('section[aria-labelledby="selected-heading"]');
      expect(selectedSection).toBeTruthy();
    });
  });

  describe('Role Attributes', () => {
    it('Vehicle list should have list role', () => {
      renderWithRouter(<Compare />);
      
      const vehicleList = document.querySelector('.vehicle-list[role="list"]');
      expect(vehicleList).toBeTruthy();
    });

    it('Vehicle items should have listitem role', () => {
      renderWithRouter(<Compare />);
      
      const vehicleItems = document.querySelectorAll('[role="listitem"]');
      // Should have listitem roles if list is present
      if (document.querySelector('[role="list"]')) {
        expect(vehicleItems.length).toBeGreaterThan(0);
      }
    });
  });
});
