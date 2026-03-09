import React from 'react';
import './Card.css';

/**
 * Card component for content containers
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {string} props.title - Card title
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onClick - Click handler
 */
function Card({ children, title, className = '', onClick }) {
  const cardClass = `card ${onClick ? 'card-clickable' : ''} ${className}`.trim();

  return (
    <div className={cardClass} onClick={onClick}>
      {title && <h3 className="card-title">{title}</h3>}
      <div className="card-content">{children}</div>
    </div>
  );
}

export default Card;
