let vehicleData = null;
let lifecycleData = null;

async function loadVehicleDetail() {
  const params = new URLSearchParams(window.location.search);
  const brand = params.get('brand');
  const model = params.get('model');
  const year = params.get('year');
  const country = params.get('country') || 'US';
  const gridYear = params.get('gridYear') || '2024';

  if (!brand || !model || !year) {
    showError();
    return;
  }

  try {
    // Get vehicle detail
    vehicleData = await api.getVehicleDetail(brand, model, year);
    
    // Calculate lifecycle
    lifecycleData = await api.calculateLifecycle(brand, model, year, country, gridYear);
    
    // Get carbon score
    const scoreData = await api.getCarbonScore(lifecycleData.total_g_per_km);
    
    // Display data
    displayVehicle(vehicleData, lifecycleData, scoreData);
    
    // Load charts
    renderBreakdownChart();
    await renderSensitivityChart(brand, model, year, gridYear);
    
  } catch (error) {
    console.error('Error loading vehicle:', error);
    showError();
  }
}

function displayVehicle(vehicle, lifecycle, score) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('vehicle-content').style.display = 'block';
  
  // Header
  document.getElementById('vehicle-name').textContent = `${vehicle.brand} ${vehicle.model}`;
  document.getElementById('vehicle-meta').textContent = `${vehicle.Year} • ${vehicle.type}`;
  
  const badge = document.getElementById('vehicle-badge');
  badge.textContent = vehicle.type;
  badge.className = `badge badge-${vehicle.type.toLowerCase()}`;
  
  // Lifecycle summary
  document.getElementById('total-lifecycle').textContent = formatEmission(lifecycle.total_g_per_km) + ' g/km';
  document.getElementById('manufacturing').textContent = formatEmission(lifecycle.manufacturing_g_per_km) + ' g/km';
  document.getElementById('operational').textContent = formatEmission(lifecycle.operational_g_per_km) + ' g/km';
  
  // Carbon score
  const scoreCircle = document.getElementById('score-circle');
  scoreCircle.style.setProperty('--score', score.score);
  document.getElementById('score-value').textContent = score.score;
  document.getElementById('score-label').textContent = score.label;
  
  // Update score circle color based on score
  if (score.score >= 70) {
    scoreCircle.style.borderColor = '#00C853';
  } else if (score.score >= 40) {
    scoreCircle.style.borderColor = '#FFC107';
  } else {
    scoreCircle.style.borderColor = '#FF5252';
  }
}

function renderBreakdownChart() {
  const ctx = document.getElementById('breakdown-chart');
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Manufacturing', 'Operational'],
      datasets: [{
        data: [
          lifecycleData.manufacturing_g_per_km,
          lifecycleData.operational_g_per_km
        ],
        backgroundColor: ['#00C853', '#69F0AE'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: '#B0B0B0', font: { size: 14 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + context.parsed.toFixed(1) + ' g/km';
            }
          }
        }
      }
    }
  });
}

async function renderSensitivityChart(brand, model, year, gridYear) {
  try {
    const countries = ['US', 'DE', 'FR', 'UK', 'CN', 'JP'];
    const sensitivity = await api.getGridSensitivity(brand, model, year, countries, gridYear);
    
    const ctx = document.getElementById('sensitivity-chart');
    
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sensitivity.map(s => s.country),
        datasets: [{
          label: 'Total Lifecycle (g/km)',
          data: sensitivity.map(s => s.total_g_per_km),
          backgroundColor: 'rgba(0, 200, 83, 0.6)',
          borderColor: '#00C853',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#B0B0B0' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#B0B0B0' }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading sensitivity data:', error);
  }
}

async function calculateAnnualImpact() {
  const annualKm = parseInt(document.getElementById('annual-km').value);
  
  try {
    const impact = await api.getAnnualImpact(lifecycleData.total_g_per_km, annualKm);
    
    document.getElementById('annual-emissions').textContent = formatLargeNumber(impact.annual_kg);
    document.getElementById('annual-equivalent').textContent = impact.equivalent || 'N/A';
    document.getElementById('annual-result').style.display = 'block';
  } catch (error) {
    console.error('Error calculating annual impact:', error);
  }
}

function showError() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error-content').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', loadVehicleDetail);
