let gridData = [];
let chart = null;

async function loadGridData() {
  try {
    const response = await fetch('../data/grid.json');
    gridData = await response.json();
    updateDisplay();
  } catch (error) {
    console.error('Error loading grid data:', error);
  }
}

function getCurrentData() {
  const country = document.getElementById('country-select').value;
  return gridData.find(d => d.country === country);
}

function updateDisplay() {
  const data = getCurrentData();
  if (!data) return;
  
  document.getElementById('gen-intensity').textContent = formatLargeNumber(data.generationIntensity);
  document.getElementById('plug-intensity').textContent = formatLargeNumber(data.plugAdjustedIntensity);
  document.getElementById('td-loss').textContent = formatPercentage(data.tdLossPercent);
  
  updateChart();
}

function updateChart() {
  const data = getCurrentData();
  if (!data) return;
  
  const showForecast = document.getElementById('forecast-toggle').checked;
  
  const labels = [data.year];
  const genData = [data.generationIntensity];
  const plugData = [data.plugAdjustedIntensity];
  
  if (showForecast && data.forecast) {
    data.forecast.forEach(f => {
      labels.push(f.year);
      genData.push(f.projectedIntensity);
      plugData.push(f.projectedIntensity * (1 + data.tdLossPercent / 100));
    });
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
          fill: true
        },
        {
          label: 'Plug-Adjusted Intensity',
          data: plugData,
          borderColor: '#69F0AE',
          backgroundColor: 'rgba(105, 240, 174, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: '#B0B0B0' }
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
