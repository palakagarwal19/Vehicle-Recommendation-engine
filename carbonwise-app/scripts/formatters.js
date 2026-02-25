// Number Formatting Utilities

function formatEmission(value) {
  if (value === null || value === undefined) return 'N/A';
  return value.toFixed(1);
}

function formatLargeNumber(value) {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }
  return value.toFixed(1);
}

function formatPercentage(value) {
  if (value === null || value === undefined) return 'N/A';
  return value.toFixed(1) + '%';
}

function formatCurrency(value, country = 'US') {
  if (value === null || value === undefined) return 'N/A';
  
  const formats = {
    'US': { symbol: '$', position: 'before', decimal: '.', thousand: ',' },
    'EU': { symbol: '€', position: 'after', decimal: ',', thousand: '.' },
    'UK': { symbol: '£', position: 'before', decimal: '.', thousand: ',' },
    'JP': { symbol: '¥', position: 'before', decimal: '.', thousand: ',' }
  };
  
  const format = formats[country] || formats['US'];
  const formatted = value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  
  return format.position === 'before' 
    ? `${format.symbol}${formatted}` 
    : `${formatted}${format.symbol}`;
}

function getPlaceholder(value) {
  return (value === null || value === undefined) ? 'N/A' : value;
}

// Animated Number Counter
function animateNumber(element, start, end, duration = 1000) {
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }
    element.textContent = formatLargeNumber(current);
  }, 16);
}
