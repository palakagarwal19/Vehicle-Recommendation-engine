let vehicles = [];
let selectedVehicles = [];
let currentUnit = 'g_km';

// Load vehicles data
async function loadVehicles() {
  try {
    const response = await fetch('../data/vehicles.json');
    vehicles = await response.json();
    populateFilters();
    renderVehicleList();
  } catch (error) {
    console.error('Error loading vehicles:', error);
  }
}

// Populate filter dropdowns
function populateFilters() {
  const brands = [...new Set(vehicles.map(v => v.brand))];
  const years = [...new Set(vehicles.map(v => v.year))];
  const countries = [...new Set(vehicles.map(v => v.country))];
  
  const brandFilter = document.getElementById('brand-filter');
  brands.forEach(brand => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    brandFilter.appendChild(option);
  });
  
  const yearFilter = document.getElementById('year-filter');
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  });
  
  const countryFilter = document.getElementById('country-filter');
  countries.forEach(country => {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    countryFilter.appendChild(option);
  });
}

// Filter vehicles
function getFilteredVehicles() {
  const brand = document.getElementById('brand-filter').value;
  const year = document.getElementById('year-filter').value;
  const powertrain = document.getElementById('powertrain-filter').value;
  const country = document.getElementById('country-filter').value;
  
  return vehicles.filter(v => {
    return (!brand || v.brand === brand) &&
           (!year || v.year == year) &&
           (!powertrain || v.powertrain === powertrain) &&
           (!country || v.country === country);
  });
}

// Render vehicle list
function renderVehicleList() {
  const list = document.getElementById('vehicle-list');
  const filtered = getFilteredVehicles();
  
  list.innerHTML = '';
  
  filtered.forEach(vehicle => {
    const isSelected = selectedVehicles.some(v => v.id === vehicle.id);
    const isDisabled = selectedVehicles.length >= 3 && !isSelected;
    
    const item = document.createElement('div');
    item.className = `vehicle-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
    item.innerHTML = `
      <h5>${vehicle.brand} ${vehicle.model}</h5>
      <p><span class="badge badge-${vehicle.powertrain.toLowerCase()}">${vehicle.powertrain}</span></p>
      <p>${vehicle.year} • ${vehicle.country}</p>
    `;
    
    if (!isDisabled) {
      item.addEventListener('click', () => toggleVehicle(vehicle));
    }
    
    list.appendChild(item);
  });
}

// Toggle vehicle selection
function toggleVehicle(vehicle) {
  const index = selectedVehicles.findIndex(v => v.id === vehicle.id);
  
  if (index > -1) {
    selectedVehicles.splice(index, 1);
  } else if (selectedVehicles.length < 3) {
    selectedVehicles.push(vehicle);
  }
  
  renderVehicleList();
  renderComparison();
  renderCharts();
}

// Render comparison grid
function renderComparison() {
  const grid = document.getElementById('comparison-grid');
  const count = document.getElementById('selected-count');
  count.textContent = selectedVehicles.length;
  
  if (selectedVehicles.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚗</div><p>Select up to 3 vehicles to compare</p></div>';
    document.getElementById('charts-section').style.display = 'none';
    return;
  }
  
  grid.innerHTML = '';
  
  selectedVehicles.forEach(vehicle => {
    const card = document.createElement('div');
    card.className = 'card comparison-card';
    
    let value;
    if (currentUnit === 'g_km') {
      value = vehicle.lifecycleEmissions.gPerKm;
    } else if (currentUnit === 'lifetime_kg') {
      value = vehicle.lifecycleEmissions.lifetimeKg;
    } else {
      value = vehicle.lifecycleEmissions.tenYearProjection;
    }
    
    card.innerHTML = `
      <button class="remove-btn" onclick="removeVehicle('${vehicle.id}')">×</button>
      <h4>${vehicle.brand} ${vehicle.model}</h4>
      <p><span class="badge badge-${vehicle.powertrain.toLowerCase()}">${vehicle.powertrain}</span> ${vehicle.year}</p>
      <div class="mt-md">
        <div class="emission-value">
          <span class="emission-label">Lifecycle</span>
          <span class="emission-number">${formatLargeNumber(value)}</span>
        </div>
        <div class="emission-value">
          <span class="emission-label">Manufacturing</span>
          <span class="emission-number">${formatLargeNumber(vehicle.manufacturing.total)}</span>
        </div>
        <div class="emission-value">
          <span class="emission-label">Operational</span>
          <span class="emission-number">${formatLargeNumber(vehicle.operational.fuelEmissions || vehicle.operational.gridIntensity)}</span>
        </div>
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  document.getElementById('charts-section').style.display = 'block';
}

// Remove vehicle
function removeVehicle(id) {
  selectedVehicles = selectedVehicles.filter(v => v.id !== id);
  renderVehicleList();
  renderComparison();
  renderCharts();
}

// Render charts
function renderCharts() {
  if (selectedVehicles.length === 0) return;
  
  // Bar chart
  const barCtx = document.getElementById('bar-chart');
  if (window.barChart) window.barChart.destroy();
  
  window.barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: selectedVehicles.map(v => `${v.brand} ${v.model}`),
      datasets: [{
        label: 'Lifecycle Emissions (g/km)',
        data: selectedVehicles.map(v => v.lifecycleEmissions.gPerKm),
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
        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#B0B0B0' } },
        x: { grid: { display: false }, ticks: { color: '#B0B0B0' } }
      }
    }
  });
  
  // Stacked chart
  const stackedCtx = document.getElementById('stacked-chart');
  if (window.stackedChart) window.stackedChart.destroy();
  
  window.stackedChart = new Chart(stackedCtx, {
    type: 'bar',
    data: {
      labels: selectedVehicles.map(v => `${v.brand} ${v.model}`),
      datasets: [
        {
          label: 'Manufacturing',
          data: selectedVehicles.map(v => v.manufacturing.total / 200),
          backgroundColor: '#00C853'
        },
        {
          label: 'Operational',
          data: selectedVehicles.map(v => v.lifecycleEmissions.gPerKm - (v.manufacturing.total / 200)),
          backgroundColor: '#69F0AE'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#B0B0B0' } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#B0B0B0' } },
        y: { stacked: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#B0B0B0' } }
      }
    }
  });
  
  // Donut charts
  const donutContainer = document.getElementById('donut-charts');
  donutContainer.innerHTML = '';
  
  selectedVehicles.forEach((vehicle, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h5 class="mb-md">${vehicle.brand} ${vehicle.model}</h5>
      <canvas id="donut-${index}"></canvas>
    `;
    donutContainer.appendChild(card);
    
    const ctx = document.getElementById(`donut-${index}`);
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Glider', 'Battery', 'Fluids'],
        datasets: [{
          data: [vehicle.manufacturing.glider, vehicle.manufacturing.battery, vehicle.manufacturing.fluids],
          backgroundColor: ['#00C853', '#69F0AE', '#4CAF50']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: '#B0B0B0' } }
        }
      }
    });
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadVehicles();
  
  // Filter changes
  document.querySelectorAll('.filter-select').forEach(select => {
    select.addEventListener('change', renderVehicleList);
  });
  
  // Unit toggle
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentUnit = btn.dataset.unit;
      renderComparison();
    });
  });
});
