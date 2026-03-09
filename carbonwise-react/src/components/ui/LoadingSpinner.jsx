import React from 'react';
import './LoadingSpinner.css';

/**
 * Loading spinner component
 * @param {Object} props
 * @param {string} props.size - Spinner size: 'small', 'medium', 'large'
 * @param {string} props.message - Loading message
 */
function LoadingSpinner({ size = 'medium', message }) {
  return (
    <div className="loading-spinner-container">
      <div className={`loading-spinner loading-spinner-${size}`}></div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
}

export default LoadingSpinner;
