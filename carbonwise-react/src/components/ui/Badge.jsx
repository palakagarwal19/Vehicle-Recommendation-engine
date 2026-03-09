import React from 'react';
import './Badge.css';

/**
 * Badge component for labels and tags
 * @param {Object} props
 * @param {React.ReactNode} props.children - Badge content
 * @param {string} props.variant - Badge variant: 'success', 'warning', 'danger', 'info'
 * @param {string} props.size - Badge size: 'small', 'medium', 'large'
 */
function Badge({ children, variant = 'info', size = 'medium' }) {
  const badgeClass = `badge badge-${variant} badge-${size}`;

  return <span className={badgeClass}>{children}</span>;
}

export default Badge;
