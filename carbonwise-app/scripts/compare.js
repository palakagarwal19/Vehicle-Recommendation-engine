let vehicles = [];
let selectedVehicles = [];
let selectedVehiclesData = [];
let currentUnit = 'g_km';
let currentCountry = 'US';
let currentYear = 2024;

async function loadVehicles() {
  try {
    const response = await fetch('http://localhost:5000/vehicles');

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    vehicles = await response.json();

    populateFilters();
    renderVehicleList();

  } catch (error) {
    console.error('Error loading vehicles:', error);
    showError('Failed to load vehicle data. Please try again.');
  }
}

// Show error message
function showError(message) {
  const list = document.getElementById('vehicle-list');
  list.innerHTML = `<p class="text-center" style="padding: 2rem; color: #FF5252;">${message}</p>`;
}

// Populate filter dropdowns
function populateFilters() {
  const brands = [...new Set(vehicles.map(v => v.brand))].sort();
  const years = [...new Set(vehicles.map(v => v.Year))].sort((a, b) => b - a);
  
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
}

// Filter vehicles
function getFilteredVehicles() {
  const brand = document.getElementById('brand-filter').value;
  const year = document.getElementById('year-filter').value;
  const powertrain = document.getElementById('powertrain-filter').value;
  
  return vehicles.filter(v => {
    return (!brand || v.brand === brand) &&
           (!year || v.Year == year) &&
           (!powertrain || v.type === powertrain);
  }).slice(0, 100); // Limit to 100 for performance
}

// Render vehicle list
function renderVehicleList() {
  const list = document.getElementById('vehicle-list');
  const filtered = getFilteredVehicles();
  
  list.innerHTML = '';
  
  if (filtered.length === 0) {
    list.innerHTML = '<p class="text-center" style="padding: 2rem; color: var(--color-text-secondary);">No vehicles found. Try adjusting filters.</p>';
    return;
  }
  
  filtered.forEach(vehicle => {
    const vehicleKey = `${vehicle.brand}-${vehicle.model}-${vehicle.Year}`;
    const isSelected = selectedVehicles.some(v => v === vehicleKey);
    const isDisabled = selectedVehicles.length >= 3 && !isSelected;
    
    const item = document.createElement('div');
    item.className = `vehicle-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
    item.innerHTML = `
      <h5>${vehicle.brand} ${vehicle.model}</h5>
      <p><span class="badge badge-${vehicle.type.toLowerCase()}">${vehicle.type}</span></p>
      <p>${vehicle.Year}</p>
    `;
    
    if (!isDisabled) {
      item.addEventListener('click', () => toggleVehicle(vehicle));
    }
    
    list.appendChild(item);
  });
}

// Toggle vehicle selection
async function toggleVehicle(vehicle) {
  const vehicleKey = `${vehicle.brand}-${vehicle.model}-${vehicle.Year}`;
  const index = selectedVehicles.indexOf(vehicleKey);
  
  if (index > -1) {
    selectedVehicles.splice(index, 1);
    selectedVehiclesData = selectedVehiclesData.filter((v, i) => i !== index);
  } else if (selectedVehicles.length < 3) {
    selectedVehicles.push(vehicleKey);
    
    // Show loading
    const grid = document.getElementById('comparison-grid');
    grid.innerHTML = '<div class="skeleton skeleton-card"></div>'.repeat(selectedVehicles.length);
    
    // Fetch lifecycle data from API
    try {
      const lifecycleData = await api.calculateLifecycle(
        vehicle.brand,
        vehicle.model,
        vehicle.Year,
        currentCountry,
        currentYear
      );
      
      selectedVehiclesData.push({
        ...vehicle,
        lifecycle: lifecycleData
      });
    } catch (error) {
      console.error('Error fetching lifecycle data:', error);
      selectedVehicles.pop();
      showError('Failed to calculate lifecycle emissions. Please try again.');
      return;
    }
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
  
  if (selectedVehiclesData.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚗</div><p>Select up to 3 vehicles to compare</p></div>';
    document.getElementById('charts-section').style.display = 'none';
    return;
  }
  
  grid.innerHTML = '';
  
  selectedVehiclesData.forEach((vehicleData, index) => {
    const card = document.createElement('div');
    card.className = 'card comparison-card';
    
    const lifecycle = vehicleData.lifecycle;
    
    card.innerHTML = `
      <button class="remove-btn" onclick="removeVehicle(${index})">×</button>
      <h4>${vehicleData.brand} ${vehicleData.model}</h4>
      <p><span class="badge badge-${vehicleData.type.toLowerCase()}">${vehicleData.type}</span> ${vehicleData.Year}</p>
      <div class="mt-md">
        <div class="emission-value">
          <span class="emission-label">Total Lifecycle</span>
          <span class="emission-number">${formatEmission(lifecycle.total_g_per_km)} g/km</span>
        </div>
        <div class="emission-value">
          <span class="emission-label">Manufacturing</span>
          <span class="emission-number">${formatEmission(lifecycle.manufacturing_g_per_km)} g/km</span>
        </div>
        <div class="emission-value">
          <span class="emission-label">Operational</span>
          <span class="emission-number">${formatEmission(lifecycle.operational_g_per_km)} g/km</span>
        </div>
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  document.getElementById('charts-section').style.display = 'block';
}

// Remove vehicle
function removeVehicle(index) {
  selectedVehicles.splice(index, 1);
  selectedVehiclesData.splice(index, 1);
  renderVehicleList();
  renderComparison();
  renderCharts();
}

// Render charts
function renderCharts() {
  if (selectedVehiclesData.length === 0) return;
  
  // Bar chart
  const barCtx = document.getElementById('bar-chart');
  if (window.barChart) window.barChart.destroy();
  
  window.barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: selectedVehiclesData.map(v => `${v.brand} ${v.model}`),
      datasets: [{
        label: 'Total Lifecycle (g/km)',
        data: selectedVehiclesData.map(v => v.lifecycle.total_g_per_km),
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
      labels: selectedVehiclesData.map(v => `${v.brand} ${v.model}`),
      datasets: [
        {
          label: 'Manufacturing',
          data: selectedVehiclesData.map(v => v.lifecycle.manufacturing_g_per_km),
          backgroundColor: '#00C853'
        },
        {
          label: 'Operational',
          data: selectedVehiclesData.map(v => v.lifecycle.operational_g_per_km),
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
  
  selectedVehiclesData.forEach((vehicleData, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h5 class="mb-md">${vehicleData.brand} ${vehicleData.model}</h5>
      <canvas id="donut-${index}"></canvas>
    `;
    donutContainer.appendChild(card);
    
    const ctx = document.getElementById(`donut-${index}`);
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Manufacturing', 'Operational'],
        datasets: [{
          data: [
            vehicleData.lifecycle.manufacturing_g_per_km,
            vehicleData.lifecycle.operational_g_per_km
          ],
          backgroundColor: ['#00C853', '#69F0AE']
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

// Update country and year
function updateCountryYear() {
  const countrySelect = document.getElementById('country-filter');
  if (countrySelect) {
    currentCountry = countrySelect.value || 'US';
  }
  
  // Reload selected vehicles with new country/year
  if (selectedVehicles.length > 0) {
    const tempSelected = [...selectedVehicles];
    selectedVehicles = [];
    selectedVehiclesData = [];
    
    tempSelected.forEach(async (vehicleKey) => {
      const [brand, model, year] = vehicleKey.split('-');
      const vehicle = vehicles.find(v => 
        v.brand === brand && v.model === model && v.Year == year
      );
      if (vehicle) {
        await toggleVehicle(vehicle);
      }
    });
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadVehicles();
  
  // Filter changes
  document.querySelectorAll('.filter-select').forEach(select => {
    select.addEventListener('change', () => {
      if (select.id === 'country-filter') {
        updateCountryYear();
      } else {
        renderVehicleList();
      }
    });
  });
  
  // Unit toggle (future enhancement)
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentUnit = btn.dataset.unit;
      // Future: recalculate values based on unit
    });
  });
});
