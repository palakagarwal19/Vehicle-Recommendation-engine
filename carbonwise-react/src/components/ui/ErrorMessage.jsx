import React from 'react';
import './ErrorMessage.css';
import Button from './Button';

/**
 * Error message component
 * @param {Object} props
 * @param {string} props.message - Error message
 * @param {Function} props.onRetry - Retry handler
 * @param {Function} props.onDismiss - Dismiss handler
 */
function ErrorMessage({ message, onRetry, onDismiss }) {
  return (
    <div className="error-message" role="alert" aria-live="polite">
      <div className="error-icon">⚠️</div>
      <div className="error-content">
        <p className="error-text">{message}</p>
        <div className="error-actions">
          {onRetry && (
            <Button variant="primary" onClick={onRetry} className="error-btn">
              Retry
            </Button>
          )}
          {onDismiss && (
            <Button variant="outline" onClick={onDismiss} className="error-btn">
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorMessage;
