/**
 * Utility functions for form validation
 */

/**
 * Validate that a field is not empty
 * @param {any} value - The value to validate
 * @returns {string|null} Error message or null if valid
 */
export function validateRequired(value) {
  if (value === null || value === undefined || value === '') {
    return 'This field is required';
  }
  
  if (typeof value === 'string' && value.trim() === '') {
    return 'This field is required';
  }
  
  return null;
}

/**
 * Validate email format
 * @param {string} email - The email to validate
 * @returns {string|null} Error message or null if valid
 */
export function validateEmail(email) {
  if (!email) {
    return null; // Use validateRequired separately for required check
  }
  
  // Basic email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  
  return null;
}

/**
 * Validate that a number is within a specified range
 * @param {number} value - The value to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {string|null} Error message or null if valid
 */
export function validateRange(value, min, max) {
  if (value === null || value === undefined || value === '') {
    return null; // Use validateRequired separately for required check
  }
  
  const numValue = Number(value);
  
  if (isNaN(numValue)) {
    return 'Please enter a valid number';
  }
  
  if (min !== undefined && numValue < min) {
    return `Value must be at least ${min}`;
  }
  
  if (max !== undefined && numValue > max) {
    return `Value must be at most ${max}`;
  }
  
  return null;
}

/**
 * Validate that a value is a valid number
 * @param {any} value - The value to validate
 * @returns {string|null} Error message or null if valid
 */
export function validateNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null; // Use validateRequired separately for required check
  }
  
  const numValue = Number(value);
  
  if (isNaN(numValue)) {
    return 'Please enter a valid number';
  }
  
  return null;
}

/**
 * Validate that a number is positive
 * @param {number} value - The value to validate
 * @returns {string|null} Error message or null if valid
 */
export function validatePositive(value) {
  if (value === null || value === undefined || value === '') {
    return null; // Use validateRequired separately for required check
  }
  
  const numValue = Number(value);
  
  if (isNaN(numValue)) {
    return 'Please enter a valid number';
  }
  
  if (numValue <= 0) {
    return 'Value must be greater than 0';
  }
  
  return null;
}

/**
 * Validate that a number is non-negative
 * @param {number} value - The value to validate
 * @returns {string|null} Error message or null if valid
 */
export function validateNonNegative(value) {
  if (value === null || value === undefined || value === '') {
    return null; // Use validateRequired separately for required check
  }
  
  const numValue = Number(value);
  
  if (isNaN(numValue)) {
    return 'Please enter a valid number';
  }
  
  if (numValue < 0) {
    return 'Value must be 0 or greater';
  }
  
  return null;
}

/**
 * Validate that a string has a minimum length
 * @param {string} value - The value to validate
 * @param {number} minLength - Minimum length
 * @returns {string|null} Error message or null if valid
 */
export function validateMinLength(value, minLength) {
  if (!value) {
    return null; // Use validateRequired separately for required check
  }
  
  if (typeof value !== 'string') {
    return 'Value must be a string';
  }
  
  if (value.length < minLength) {
    return `Must be at least ${minLength} characters`;
  }
  
  return null;
}

/**
 * Validate that a string has a maximum length
 * @param {string} value - The value to validate
 * @param {number} maxLength - Maximum length
 * @returns {string|null} Error message or null if valid
 */
export function validateMaxLength(value, maxLength) {
  if (!value) {
    return null; // Use validateRequired separately for required check
  }
  
  if (typeof value !== 'string') {
    return 'Value must be a string';
  }
  
  if (value.length > maxLength) {
    return `Must be at most ${maxLength} characters`;
  }
  
  return null;
}

/**
 * Validate a year value
 * @param {number} year - The year to validate
 * @returns {string|null} Error message or null if valid
 */
export function validateYear(year) {
  if (year === null || year === undefined || year === '') {
    return null; // Use validateRequired separately for required check
  }
  
  const numYear = Number(year);
  
  if (isNaN(numYear)) {
    return 'Please enter a valid year';
  }
  
  const currentYear = new Date().getFullYear();
  const minYear = 1900;
  const maxYear = currentYear + 10;
  
  if (numYear < minYear || numYear > maxYear) {
    return `Year must be between ${minYear} and ${maxYear}`;
  }
  
  return null;
}

/**
 * Combine multiple validators
 * @param {any} value - The value to validate
 * @param {Array<Function>} validators - Array of validator functions
 * @returns {string|null} First error message or null if all valid
 */
export function combineValidators(value, validators) {
  for (const validator of validators) {
    const error = validator(value);
    if (error) {
      return error;
    }
  }
  return null;
}
