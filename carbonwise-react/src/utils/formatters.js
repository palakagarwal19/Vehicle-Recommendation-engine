/**
 * Utility functions for formatting numbers, dates, and emissions
 */

/**
 * Format a number with locale-specific thousands separators
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted number string
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format large numbers with appropriate precision
 * @param {number} value - The number to format
 * @returns {string} Formatted number string
 */
export function formatLargeNumber(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  
  if (value >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }
  
  return value.toFixed(1);
}

/**
 * Format emission values (rounds to nearest integer)
 * @param {number} value - The emission value to format
 * @returns {string} Formatted emission string
 */
export function formatEmission(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Format emission values with decimal precision
 * @param {number} value - The emission value to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted emission string
 */
export function formatEmissionDecimal(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  
  return Number(value).toFixed(decimals);
}

/**
 * Format a date to a readable string
 * @param {Date|string|number} date - The date to format
 * @param {string} locale - Locale string (default: 'en-US')
 * @returns {string} Formatted date string
 */
export function formatDate(date, locale = 'en-US') {
  if (!date) {
    return 'N/A';
  }
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    return dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid Date';
  }
}

/**
 * Format a date to a short string (MM/DD/YYYY)
 * @param {Date|string|number} date - The date to format
 * @param {string} locale - Locale string (default: 'en-US')
 * @returns {string} Formatted date string
 */
export function formatDateShort(date, locale = 'en-US') {
  if (!date) {
    return 'N/A';
  }
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    return dateObj.toLocaleDateString(locale);
  } catch (error) {
    return 'Invalid Date';
  }
}

/**
 * Format a percentage value
 * @param {number} value - The value to format as percentage
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Format a distance value with appropriate unit
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export function formatDistance(km) {
  if (km === null || km === undefined || isNaN(km)) {
    return 'N/A';
  }
  
  return `${formatLargeNumber(km)} km`;
}

/**
 * Format years from kilometers (assuming 15,000 km/year average)
 * @param {number} km - Distance in kilometers
 * @param {number} annualKm - Annual kilometers driven (default: 15000)
 * @returns {string} Formatted years string
 */
export function formatYearsFromKm(km, annualKm = 15000) {
  if (km === null || km === undefined || isNaN(km) || annualKm <= 0) {
    return 'N/A';
  }
  
  const years = km / annualKm;
  return years.toFixed(1);
}
