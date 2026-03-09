import React from 'react';
import './Button.css';

/**
 * Button component with variants
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.variant - Button variant: 'primary', 'secondary', 'outline'
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.disabled - Disabled state
 * @param {boolean} props.loading - Loading state
 * @param {string} props.type - Button type: 'button', 'submit', 'reset'
 * @param {string} props.className - Additional CSS classes
 */
function Button({
  children,
  variant = 'primary',
  onClick,
  disabled = false,
  loading = false,
  type = 'button',
  className = ''
}) {
  const buttonClass = `btn btn-${variant} ${loading ? 'btn-loading' : ''} ${className}`.trim();

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <span className="btn-spinner"></span>
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export default Button;
