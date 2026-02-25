let gridData = {};
let chart = null;

async function loadGridData() {
  try {
    gridData = await api.getGridData();
    updateDisplay();
  } catch (error) {
    console.error('Error loading grid data:', error);
    showError('Failed to load grid data. Please ensure the backend is running.');
  }
}

function showError(message) {
  document.getElementById('gen-intensity').textContent = 'Error';
  document.getElementById('plug-intensity').textContent = 'Error';
  document.getElementById('td-loss').textContent = 'Error';
}

function getCurrentData() {
  const country = document.getElementById('country-select').value;
  
  // Country code mapping: 2-letter to 3-letter ISO codes
  const countryCodeMap = {
    "US": "USA",
    "DE": "DEU",
    "FR": "FRA",
    "UK": "GBR",
    "CN": "CHN",
    "JP": "JPN",
    "IN": "IND",
    "CA": "CAN",
    "AU": "AUS",
    "BR": "BRA"
  };
  
  // Convert to 3-letter code
  const country3Letter = countryCodeMap[country] || country;
  const countryData = gridData[country3Letter];
  
  if (!countryData) return null;
  
  // Get latest year data
  const years = Object.keys(countryData).sort((a, b) => b - a);
  const latestYear = years[0];
  const data = countryData[latestYear];
  
  // Handle null/undefined values
  if (!data || data.raw === null || data.corrected === null) {
    return null;
  }
  
  return {
    country,
    year: latestYear,
    generationIntensity: data.raw,
    plugAdjustedIntensity: data.corrected,
    tdLossPercent: ((data.corrected - data.raw) / data.raw * 100).toFixed(2),
    years: years,
    allData: countryData
  };
}

function updateDisplay() {
  const data = getCurrentData();
  if (!data) {
    showError('No data available for selected country');
    return;
  }
  
  document.getElementById('gen-intensity').textContent = formatLargeNumber(data.generationIntensity);
  document.getElementById('plug-intensity').textContent = formatLargeNumber(data.plugAdjustedIntensity);
  document.getElementById('td-loss').textContent = data.tdLossPercent;
  
  updateChart();
}

function updateChart() {
  const data = getCurrentData();
  if (!data) return;
  
  const showForecast = document.getElementById('forecast-toggle').checked;
  
  // Get historical data
  const years = data.years.sort((a, b) => a - b);
  const labels = years;
  const genData = years.map(year => {
    const yearData = data.allData[year];
    return yearData && yearData.raw !== null ? yearData.raw : null;
  });
  const plugData = years.map(year => {
    const yearData = data.allData[year];
    return yearData && yearData.corrected !== null ? yearData.corrected : null;
  });
  
  // Add forecast if enabled (simple linear projection)
  if (showForecast) {
    const lastYear = parseInt(years[years.length - 1]);
    const lastGen = genData[genData.length - 1];
    const lastPlug = plugData[plugData.length - 1];
    
    // Only forecast if we have valid data
    if (lastGen !== null && lastPlug !== null) {
      // Calculate trend (average change per year)
      const validGenData = genData.filter(v => v !== null);
      const validPlugData = plugData.filter(v => v !== null);
      
      if (validGenData.length > 1) {
        const genTrend = (validGenData[validGenData.length - 1] - validGenData[0]) / (validGenData.length - 1);
        const plugTrend = (validPlugData[validPlugData.length - 1] - validPlugData[0]) / (validPlugData.length - 1);
        
        // Project 5 years into future
        for (let i = 1; i <= 5; i++) {
          labels.push(lastYear + i);
          genData.push(Math.max(0, lastGen + (genTrend * i)));
          plugData.push(Math.max(0, lastPlug + (plugTrend * i)));
        }
      }
    }
  }
  
  const ctx = document.getElementById('grid-chart');
  
  if (chart) {
    chart.destroy();
  }
  
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Generation Intensity',
          data: genData,
          borderColor: '#00C853',
          backgroundColor: 'rgba(0, 200, 83, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          spanGaps: true  // Connect points even if there are nulls
        },
        {
          label: 'Plug-Adjusted Intensity',
          data: plugData,
          borderColor: '#69F0AE',
          backgroundColor: 'rgba(105, 240, 174, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          spanGaps: true  // Connect points even if there are nulls
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: '#B0B0B0' }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.parsed.y === null) return 'No data';
              return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + ' g CO₂/kWh';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#B0B0B0' },
          title: {
            display: true,
            text: 'g CO₂/kWh',
            color: '#B0B0B0'
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#B0B0B0' }
        }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadGridData();
  
  document.getElementById('country-select').addEventListener('change', updateDisplay);
  document.getElementById('forecast-toggle').addEventListener('change', updateChart);
});
