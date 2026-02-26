let vehicles = [];
let evVehicle = null;
let iceVehicle = null;

async function loadVehicles() {
  try {
    vehicles = await api.getAllVehicles();
    populateFilters();
  } catch (error) {
    console.error('Error loading vehicles:', error);
  }
}
async function loadCountries() {
  try {
    const countries = await api.getCountries();
    const select = document.getElementById('country');

    select.innerHTML = '';

    countries.forEach(code => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code;   // can later map to full name
      select.appendChild(option);
    });

  } catch (error) {
    console.error('Failed to load countries:', error);
  }
}
function populateFilters() {
  // Get unique brands for EV (only those with electric_wh_per_km) and ICE
  const evBrands = [...new Set(vehicles
    .filter(v => v.type === 'EV' && v.electric_wh_per_km !== null)
    .map(v => v.brand))].sort();
  const iceBrands = [...new Set(vehicles.filter(v => v.type === 'ICE').map(v => v.brand))].sort();
  
  const evBrandSelect = document.getElementById('ev-brand');
  evBrands.forEach(brand => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    evBrandSelect.appendChild(option);
  });
  
  const iceBrandSelect = document.getElementById('ice-brand');
  iceBrands.forEach(brand => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    iceBrandSelect.appendChild(option);
  });
}

function updateModels(type) {
  const brand = document.getElementById(`${type}-brand`).value;
  const modelSelect = document.getElementById(`${type}-model`);
  modelSelect.innerHTML = '<option value="">Select Model</option>';
  
  if (!brand) return;
  
  const vehicleType = type === 'ev' ? 'EV' : 'ICE';
  let filteredVehicles = vehicles.filter(v => v.brand === brand && v.type === vehicleType);
  
  // For EVs, only show those with electric consumption data
  if (type === 'ev') {
    filteredVehicles = filteredVehicles.filter(v => v.electric_wh_per_km !== null);
  }
  
  const models = [...new Set(filteredVehicles.map(v => v.model))].sort();
  
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });
}

function updateYears(type) {
  const brand = document.getElementById(`${type}-brand`).value;
  const model = document.getElementById(`${type}-model`).value;
  const yearSelect = document.getElementById(`${type}-year`);
  yearSelect.innerHTML = '<option value="">Select Year</option>';
  
  if (!brand || !model) return;
  
  const vehicleType = type === 'ev' ? 'EV' : 'ICE';
  const years = [...new Set(vehicles
    .filter(v => v.brand === brand && v.model === model && v.type === vehicleType)
    .map(v => v.Year))].sort((a, b) => b - a);
  
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });
}

function selectVehicle(type) {
  const brand = document.getElementById(`${type}-brand`).value;
  const model = document.getElementById(`${type}-model`).value;
  const year = document.getElementById(`${type}-year`).value;
  
  if (!brand || !model || !year) return;
  
  const vehicleType = type === 'ev' ? 'EV' : 'ICE';
  const vehicle = vehicles.find(v => 
    v.brand === brand && 
    v.model === model && 
    v.Year == year && 
    v.type === vehicleType
  );
  
  if (vehicle) {
    if (type === 'ev') {
      evVehicle = vehicle;
    } else {
      iceVehicle = vehicle;
    }
    
    const preview = document.getElementById(`${type}-preview`);
    preview.innerHTML = `
      <div class="selected-vehicle">
        <h5>${vehicle.brand} ${vehicle.model}</h5>
        <p><span class="badge badge-${vehicle.type.toLowerCase()}">${vehicle.type}</span> ${vehicle.Year}</p>
      </div>
    `;
  }
}

async function calculateBreakEven() {
  if (!evVehicle || !iceVehicle) {
    alert('Please select both EV and ICE vehicles');
    return;
  }
  
  const country = document.getElementById('country').value;
  const year = document.getElementById('year').value;
  
  try {
    // Show loading
    document.getElementById('results').style.display = 'block';
    document.getElementById('break-even-km').textContent = 'Calculating...';
    
    const result = await api.calculateBreakEven(
      country,
      year,
      {
        brand: evVehicle.brand,
        model: evVehicle.model,
        Year: evVehicle.Year
      },
      {
        brand: iceVehicle.brand,
        model: iceVehicle.model,
        Year: iceVehicle.Year
      }
    );
    
    displayResults(result);
  } catch (error) {
    console.error('Error calculating break-even:', error);
    alert('Failed to calculate break-even. Please try again.');
  }
}

function displayResults(result) {
  // Check if there's an error
  if (result.error) {
    alert('Error: ' + result.error);
    return;
  }
  
  // Display break-even distance
  const breakEvenKm = document.getElementById('break-even-km');
  if (result.break_even_km === null || result.break_even_km === undefined || result.break_even_km === 0) {
    breakEvenKm.textContent = 'N/A';
  } else {
    breakEvenKm.textContent = formatLargeNumber(result.break_even_km);
  }
  
  // Display message
  const message = document.getElementById('break-even-message');
  if (result.message) {
    message.innerHTML = result.message;
  } else if (result.break_even_km === null || result.break_even_km === undefined || result.break_even_km <= 0) {
    message.innerHTML = `
      The EV has lower total emissions from the start. 
      No break-even point needed!
    `;
  } else {
    message.innerHTML = `
      The EV will have lower total emissions than the ICE vehicle after 
      <strong>${formatLargeNumber(result.break_even_km)} km</strong>.
      <br>
      At average driving (15,000 km/year), this is approximately 
      <strong>${(result.break_even_km / 15000).toFixed(1)} years</strong>.
    `;
  }
  
  // Display comparison details
  const details = document.getElementById('comparison-details');
  details.innerHTML = `
    <div class="comparison-row">
      <h5>EV: ${evVehicle.brand} ${evVehicle.model}</h5>
      <div class="metric-row">
        <span>Manufacturing:</span>
        <span>${formatEmission(result.ev_manufacturing_g_per_km)} g/km</span>
      </div>
      <div class="metric-row">
        <span>Operational:</span>
        <span>${formatEmission(result.ev_operational_g_per_km)} g/km</span>
      </div>
      <div class="metric-row">
        <span>Total:</span>
        <span class="text-eco">${formatEmission(result.ev_total_g_per_km)} g/km</span>
      </div>
    </div>
    <hr style="margin: 1rem 0; border-color: rgba(255,255,255,0.1);">
    <div class="comparison-row">
      <h5>ICE: ${iceVehicle.brand} ${iceVehicle.model}</h5>
      <div class="metric-row">
        <span>Manufacturing:</span>
        <span>${formatEmission(result.ice_manufacturing_g_per_km)} g/km</span>
      </div>
      <div class="metric-row">
        <span>Operational:</span>
        <span>${formatEmission(result.ice_operational_g_per_km)} g/km</span>
      </div>
      <div class="metric-row">
        <span>Total:</span>
        <span class="text-eco">${formatEmission(result.ice_total_g_per_km)} g/km</span>
      </div>
    </div>
  `;
  
  // Render cumulative chart only if we have valid break-even data
  if (result.break_even_km !== null && result.break_even_km !== undefined && result.break_even_km > 0) {
    renderCumulativeChart(result);
  }
}

function renderCumulativeChart(result) {
  const ctx = document.getElementById('cumulative-chart');
  
  // Generate data points
  const maxKm = Math.max(result.break_even_km * 2, 300000);
  const points = 50;
  const step = maxKm / points;
  
  const labels = [];
  const evData = [];
  const iceData = [];
  
  for (let i = 0; i <= points; i++) {
    const km = i * step;
    labels.push(km / 1000); // Convert to thousands
    
    // Cumulative emissions = manufacturing + (operational * km)
    evData.push(
      (result.ev_manufacturing_g_per_km * 278600 / 1000) + // Manufacturing total
      (result.ev_operational_g_per_km * km / 1000) // Operational cumulative
    );
    
    iceData.push(
      (result.ice_manufacturing_g_per_km * 278600 / 1000) +
      (result.ice_operational_g_per_km * km / 1000)
    );
  }
  
  if (window.cumulativeChart) window.cumulativeChart.destroy();
  
  window.cumulativeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'EV Total Emissions',
          data: evData,
          borderColor: '#00C853',
          backgroundColor: 'rgba(0, 200, 83, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'ICE Total Emissions',
          data: iceData,
          borderColor: '#FF5252',
          backgroundColor: 'rgba(255, 82, 82, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#B0B0B0' } },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + context.parsed.y.toFixed(0) + ' kg CO₂';
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
            text: 'Cumulative Emissions (kg CO₂)',
            color: '#B0B0B0'
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#B0B0B0' },
          title: {
            display: true,
            text: 'Distance (1000 km)',
            color: '#B0B0B0'
          }
        }
      }
    }
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadVehicles();
  loadCountries();
  
  document.getElementById('ev-brand').addEventListener('change', () => {
    updateModels('ev');
  });
  
  document.getElementById('ev-model').addEventListener('change', () => {
    updateYears('ev');
  });
  
  document.getElementById('ev-year').addEventListener('change', () => {
    selectVehicle('ev');
  });
  
  document.getElementById('ice-brand').addEventListener('change', () => {
    updateModels('ice');
  });
  
  document.getElementById('ice-model').addEventListener('change', () => {
    updateYears('ice');
  });
  
  document.getElementById('ice-year').addEventListener('change', () => {
    selectVehicle('ice');
  });
});
