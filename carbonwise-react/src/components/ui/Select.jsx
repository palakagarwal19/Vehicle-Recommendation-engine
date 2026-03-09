import React from 'react';
import './Select.css';

/**
 * Select component with label and error display
 * @param {Object} props
 * @param {string} props.label - Select label
 * @param {string} props.value - Selected value
 * @param {Function} props.onChange - Change handler
 * @param {Array} props.options - Array of {value, label} objects
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.required - Required field
 * @param {boolean} props.disabled - Disabled state
 * @param {string} props.error - Error message
 */
function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  required = false,
  disabled = false,
  error
}) {
  return (
    <div className="select-group">
      {label && (
        <label className="select-label">
          {label}
          {required && <span className="select-required">*</span>}
        </label>
      )}
      <select
        className={`select-field ${error ? 'select-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="select-error-message">{error}</span>}
    </div>
  );
}

export default Select;
