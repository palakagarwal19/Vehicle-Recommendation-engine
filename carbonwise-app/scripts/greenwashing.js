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

async function analyzeGreenwashing(searchWeb = false) {
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
    // Show loading message
    if (searchWeb) {
      document.getElementById('results').style.display = 'block';
      document.getElementById('indicators').innerHTML = '<p>🔍 Searching web for marketing claims...</p>';
    }
    
    // Get lifecycle data
    const lifecycle = await api.calculateLifecycle(brand, model, year, country, gridYear);
    
    // Get vehicle metadata
    const vehicle = vehicles.find(v => 
      v.brand === brand && v.model === model && v.Year == year
    );
    
    // Analyze greenwashing - pass claimed emissions from vehicle data
    const analysis = await api.detectGreenwashing(lifecycle, {
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.Year,
      type: vehicle.type,
      co2_wltp_gpkm: vehicle.co2_wltp_gpkm  // Pass manufacturer's claimed emissions
    }, searchWeb);
    
    displayResults(analysis, vehicle, lifecycle);
  } catch (error) {
    console.error('Error analyzing greenwashing:', error);
    alert('Failed to analyze. Please try again.');
  }
}

async function analyzeWithWebSearch() {
  await analyzeGreenwashing(true);
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
        <span>Actual Lifecycle Emissions:</span>
        <span style="color: var(--color-eco-green); font-weight: bold;">${formatEmission(lifecycle.total_g_per_km)} g/km</span>
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
  
  // Misleading Claims Section
  const indicators = document.getElementById('indicators');
  const misleadingClaims = analysis.misleading_claims || [];
  
  if (misleadingClaims.length === 0) {
    indicators.innerHTML = '<p class="text-eco">✓ No common misleading marketing practices detected for this vehicle type</p>';
  } else {
    indicators.innerHTML = '<div class="misleading-claims">' + 
      misleadingClaims.map(claim => `
        <div class="claim-card severity-${claim.severity}">
          <div class="claim-header">
            <span class="claim-icon">${claim.severity === 'high' ? '🚨' : claim.severity === 'medium' ? '⚠️' : 'ℹ️'}</span>
            <span class="claim-severity">${claim.severity.toUpperCase()}</span>
          </div>
          <div class="claim-body">
            <p><strong>Common Marketing Practice:</strong> ${claim.practice}</p>
            <p><strong>Typical Claim:</strong> ${claim.common_claim}</p>
            <p><strong>Reality for This Vehicle:</strong> ${claim.reality}</p>
          </div>
        </div>
      `).join('') + 
      '</div>';
  }
  
  // Transparency score
  const transparencyScore = document.getElementById('transparency-score');
  const score = analysis.transparency_score || 85;
  transparencyScore.innerHTML = `
    <div class="score-circle-small" style="--score: ${score}">
      <span class="score-value">${score}</span>
    </div>
    <p class="mt-md text-center">${getScoreLabel(score)}</p>
    <p class="text-center text-secondary" style="font-size: 0.9rem; margin-top: 0.5rem;">
      ${score >= 80 ? 'Marketing claims are mostly accurate' : 
        score >= 60 ? 'Some claims may be misleading' : 
        score >= 40 ? 'Multiple misleading claims detected' : 
        'Significant greenwashing risk'}
    </p>
  `;
  
  // Findings
  const findings = document.getElementById('findings');
  const findingsList = analysis.findings || [];
  const webClaims = analysis.web_claims || [];
  
  let findingsHTML = '';
  
  if (findingsList.length === 0 && webClaims.length === 0) {
    findingsHTML = '<p class="text-eco">✓ No significant greenwashing indicators found. Marketing appears transparent.</p>';
  } else {
    if (findingsList.length > 0) {
      findingsHTML += '<h5 style="margin-bottom: 1rem;">Analysis Findings:</h5>';
      findingsHTML += '<ul class="findings-list">' + 
        findingsList.map(f => `<li><span class="finding-bullet">▸</span> ${f}</li>`).join('') + 
        '</ul>';
    }
    
    if (webClaims.length > 0) {
      findingsHTML += '<h5 style="margin-top: 2rem; margin-bottom: 1rem;">Web Marketing Claims Verification:</h5>';
      findingsHTML += '<div class="web-claims">';
      
      webClaims.forEach(claim => {
        const isAccurate = claim.verification.is_accurate;
        const severity = claim.verification.severity || 'low';
        
        findingsHTML += `
          <div class="web-claim-card severity-${severity}">
            <div class="web-claim-header">
              <span class="web-claim-icon">${isAccurate ? '✓' : '✗'}</span>
              <span class="web-claim-source">${claim.source}</span>
            </div>
            <div class="web-claim-body">
              <p><strong>Claim:</strong> "${claim.claim}"</p>
              <p><strong>Verification:</strong> ${claim.verification.explanation}</p>
              <p class="web-claim-status ${isAccurate ? 'accurate' : 'inaccurate'}">
                ${isAccurate ? '✓ Claim is accurate' : '✗ Claim is misleading'}
              </p>
            </div>
          </div>
        `;
      });
      
      findingsHTML += '</div>';
    }
  }
  
  findings.innerHTML = findingsHTML;
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
