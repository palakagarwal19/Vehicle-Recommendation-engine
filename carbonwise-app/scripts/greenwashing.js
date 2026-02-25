let vehicles = [];

async function loadVehicles() {
  try {
    vehicles = await api.getAllVehicles();
    populateBrands();
  } catch (error) {
    console.error('Error loading vehicles:', error);
  }
}

function populateBrands() {
  const brands = [...new Set(vehicles.map(v => v.brand))].sort();
  const brandSelect = document.getElementById('brand');
  
  brands.forEach(brand => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    brandSelect.appendChild(option);
  });
}

function updateModels() {
  const brand = document.getElementById('brand').value;
  const modelSelect = document.getElementById('model');
  modelSelect.innerHTML = '<option value="">Select Model</option>';
  
  if (!brand) return;
  
  const models = [...new Set(vehicles
    .filter(v => v.brand === brand)
    .map(v => v.model))].sort();
  
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });
}

function updateYears() {
  const brand = document.getElementById('brand').value;
  const model = document.getElementById('model').value;
  const yearSelect = document.getElementById('year');
  yearSelect.innerHTML = '<option value="">Select Year</option>';
  
  if (!brand || !model) return;
  
  const years = [...new Set(vehicles
    .filter(v => v.brand === brand && v.model === model)
    .map(v => v.Year))].sort((a, b) => b - a);
  
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });
}

async function analyzeGreenwashing() {
  const brand = document.getElementById('brand').value;
  const model = document.getElementById('model').value;
  const year = document.getElementById('year').value;
  const country = document.getElementById('country').value;
  const gridYear = document.getElementById('grid-year').value;
  
  if (!brand || !model || !year) {
    alert('Please select a vehicle');
    return;
  }
  
  try {
    // Get lifecycle data
    const lifecycle = await api.calculateLifecycle(brand, model, year, country, gridYear);
    
    // Get vehicle metadata
    const vehicle = vehicles.find(v => 
      v.brand === brand && v.model === model && v.Year == year
    );
    
    // Analyze greenwashing
    const analysis = await api.detectGreenwashing(lifecycle, {
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.Year,
      type: vehicle.type
    });
    
    displayResults(analysis, vehicle, lifecycle);
  } catch (error) {
    console.error('Error analyzing greenwashing:', error);
    alert('Failed to analyze. Please try again.');
  }
}

function displayResults(analysis, vehicle, lifecycle) {
  document.getElementById('results').style.display = 'block';
  
  // Risk badge
  const riskBadge = document.getElementById('risk-badge');
  const riskLevel = analysis.risk_level || 'low';
  riskBadge.textContent = `${riskLevel.toUpperCase()} RISK`;
  riskBadge.className = `risk-badge risk-${riskLevel}`;
  
  // Vehicle info
  const vehicleInfo = document.getElementById('vehicle-info');
  vehicleInfo.innerHTML = `
    <h4>${vehicle.brand} ${vehicle.model} (${vehicle.Year})</h4>
    <p><span class="badge badge-${vehicle.type.toLowerCase()}">${vehicle.type}</span></p>
    <div class="mt-md">
      <div class="metric-row">
        <span>Total Lifecycle:</span>
        <span>${formatEmission(lifecycle.total_g_per_km)} g/km</span>
      </div>
      <div class="metric-row">
        <span>Manufacturing:</span>
        <span>${formatEmission(lifecycle.manufacturing_g_per_km)} g/km</span>
      </div>
      <div class="metric-row">
        <span>Operational:</span>
        <span>${formatEmission(lifecycle.operational_g_per_km)} g/km</span>
      </div>
    </div>
  `;
  
  // Indicators
  const indicators = document.getElementById('indicators');
  const indicatorsList = analysis.indicators || [];
  
  if (indicatorsList.length === 0) {
    indicators.innerHTML = '<p class="text-eco">✓ No greenwashing indicators detected</p>';
  } else {
    indicators.innerHTML = indicatorsList.map(ind => `
      <div class="indicator-item">
        <span class="indicator-icon">⚠</span>
        <span>${ind}</span>
      </div>
    `).join('');
  }
  
  // Transparency score
  const transparencyScore = document.getElementById('transparency-score');
  const score = analysis.transparency_score || 85;
  transparencyScore.innerHTML = `
    <div class="score-circle-small" style="--score: ${score}">
      <span class="score-value">${score}</span>
    </div>
    <p class="mt-md text-center">${getScoreLabel(score)}</p>
  `;
  
  // Findings
  const findings = document.getElementById('findings');
  const findingsList = analysis.findings || [];
  
  if (findingsList.length === 0) {
    findings.innerHTML = '<p>No significant findings. This vehicle appears to have transparent emissions reporting.</p>';
  } else {
    findings.innerHTML = '<ul>' + findingsList.map(f => `<li>${f}</li>`).join('') + '</ul>';
  }
}

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent Transparency';
  if (score >= 60) return 'Good Transparency';
  if (score >= 40) return 'Moderate Transparency';
  return 'Low Transparency';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadVehicles();
  
  document.getElementById('brand').addEventListener('change', updateModels);
  document.getElementById('model').addEventListener('change', updateYears);
});
