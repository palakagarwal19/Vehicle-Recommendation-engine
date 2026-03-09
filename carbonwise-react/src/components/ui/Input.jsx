import React from 'react';
import './Input.css';

/**
 * Input component with label and error display
 * @param {Object} props
 * @param {string} props.label - Input label
 * @param {string} props.type - Input type
 * @param {string|number} props.value - Input value
 * @param {Function} props.onChange - Change handler
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.required - Required field
 * @param {number} props.min - Minimum value (for number inputs)
 * @param {number} props.max - Maximum value (for number inputs)
 * @param {boolean} props.disabled - Disabled state
 * @param {string} props.error - Error message
 */
function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  min,
  max,
  disabled = false,
  error
}) {
  return (
    <div className="input-group">
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <input
        type={type}
        className={`input-field ${error ? 'input-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        disabled={disabled}
      />
      {error && <span className="input-error-message">{error}</span>}
    </div>
  );
}

export default Input;
