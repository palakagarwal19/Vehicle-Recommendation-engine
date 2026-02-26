let vehicles = [];
let selectedVehicles = [];
let selectedVehiclesData = [];
let currentUnit = 'g_km';
let currentCountry = 'US';
let currentYear = 2024;

/* ===========================
   LOAD VEHICLES
=========================== */

async function loadVehicles() {
  try {
    const response = await fetch('http://localhost:5000/vehicles');
    if (!response.ok) throw new Error('Network error');

    vehicles = await response.json();

    populateFilters();
    populateModels();
    renderVehicleList();

  } catch (error) {
    console.error('Error loading vehicles:', error);
    showError('Failed to load vehicle data.');
  }
}

function showError(message) {
  const list = document.getElementById('vehicle-list');
  list.innerHTML = `
    <p class="text-center" style="padding:2rem;color:#FF5252;">
      ${message}
    </p>
  `;
}

/* ===========================
   FILTER DROPDOWNS
=========================== */

function populateFilters() {
  const brands = [...new Set(vehicles.map(v => v.brand))].sort();
  const years = [...new Set(vehicles.map(v => v.Year))].sort((a, b) => b - a);

  const brandFilter = document.getElementById('brand-filter');
  const yearFilter = document.getElementById('year-filter');

  brandFilter.innerHTML = '<option value="">All Brands</option>';
  yearFilter.innerHTML = '<option value="">All Years</option>';

  brands.forEach(brand => {
    brandFilter.innerHTML += `<option value="${brand}">${brand}</option>`;
  });

  years.forEach(year => {
    yearFilter.innerHTML += `<option value="${year}">${year}</option>`;
  });
}

function populateModels() {
  const brand = document.getElementById('brand-filter').value;
  const modelFilter = document.getElementById('model-filter');

  modelFilter.innerHTML = '<option value="">All Models</option>';

  let filtered = vehicles;
  if (brand) {
    filtered = vehicles.filter(v => v.brand === brand);
  }

  const models = [...new Set(filtered.map(v => v.model))].sort();

  models.forEach(model => {
    modelFilter.innerHTML += `<option value="${model}">${model}</option>`;
  });
}

/* ===========================
   FILTER LOGIC
=========================== */

function getFilteredVehicles() {
  const brand = document.getElementById('brand-filter').value;
  const model = document.getElementById('model-filter').value;
  const year = document.getElementById('year-filter').value;
  const powertrain = document.getElementById('powertrain-filter').value;

  return vehicles.filter(v => {
    return (!brand || v.brand === brand) &&
           (!model || v.model === model) &&
           (!year || v.Year == year) &&
           (!powertrain || v.type === powertrain);
  }).slice(0, 100);
}

/* ===========================
   RENDER VEHICLE LIST
=========================== */

function renderVehicleList() {
  const list = document.getElementById('vehicle-list');
  const filtered = getFilteredVehicles();
  list.innerHTML = '';

  if (filtered.length === 0) {
    list.innerHTML = `
      <p class="text-center" style="padding:2rem;">
        No vehicles found.
      </p>
    `;
    return;
  }

  filtered.forEach(vehicle => {
    const vehicleKey = `${vehicle.brand}-${vehicle.model}-${vehicle.Year}`;
    const isSelected = selectedVehicles.includes(vehicleKey);
    const isDisabled = selectedVehicles.length >= 3 && !isSelected;

    const item = document.createElement('div');
    item.className = `vehicle-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;

    item.innerHTML = `
      <h5>${vehicle.brand} ${vehicle.model}</h5>
      <p>
        <span class="badge badge-${vehicle.type.toLowerCase()}">
          ${vehicle.type}
        </span>
      </p>
      <p>${vehicle.Year}</p>
    `;

    if (!isDisabled) {
      item.addEventListener('click', () => toggleVehicle(vehicle));
    }

    list.appendChild(item);
  });
}

/* ===========================
   TOGGLE VEHICLE
=========================== */

async function toggleVehicle(vehicle) {
  const vehicleKey = `${vehicle.brand}-${vehicle.model}-${vehicle.Year}`;
  const exists = selectedVehicles.includes(vehicleKey);

  if (exists) {
    selectedVehicles = selectedVehicles.filter(v => v !== vehicleKey);
    selectedVehiclesData = selectedVehiclesData.filter(v =>
      `${v.brand}-${v.model}-${v.Year}` !== vehicleKey
    );
  } else {
    if (selectedVehicles.length >= 3) return;

    selectedVehicles.push(vehicleKey);

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
      console.error('Lifecycle fetch failed:', error);
      selectedVehicles = selectedVehicles.filter(v => v !== vehicleKey);
      return;
    }
  }

  renderVehicleList();
  renderComparison();
  renderCharts();
}

/* ===========================
   REMOVE VEHICLE
=========================== */

function removeVehicle(index) {
  selectedVehicles.splice(index, 1);
  selectedVehiclesData.splice(index, 1);
  renderVehicleList();
  renderComparison();
  renderCharts();
}

/* ===========================
   RENDER COMPARISON
=========================== */

function renderComparison() {
  const grid = document.getElementById('comparison-grid');
  const count = document.getElementById('selected-count');
  count.textContent = selectedVehicles.length;

  if (selectedVehiclesData.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🚗</div>
        <p>Select up to 3 vehicles to compare</p>
      </div>
    `;
    document.getElementById('charts-section').style.display = 'none';
    return;
  }

  grid.innerHTML = '';

  selectedVehiclesData.forEach((vehicleData, index) => {
    const lifecycle = vehicleData.lifecycle;

    const card = document.createElement('div');
    card.className = 'card comparison-card';

    card.innerHTML = `
      <button class="remove-btn" onclick="removeVehicle(${index})">×</button>
      <h4>${vehicleData.brand} ${vehicleData.model}</h4>
      <p>
        <span class="badge badge-${vehicleData.type.toLowerCase()}">
          ${vehicleData.type}
        </span>
        ${vehicleData.Year}
      </p>
      <div class="mt-md">
        <div class="emission-value">
          <span>Total Lifecycle</span>
          <span>${lifecycle.total_g_per_km.toFixed(1)} g/km</span>
        </div>
        <div class="emission-value">
          <span>Manufacturing</span>
          <span>${lifecycle.manufacturing_g_per_km.toFixed(1)} g/km</span>
        </div>
        <div class="emission-value">
          <span>Operational</span>
          <span>${lifecycle.operational_g_per_km.toFixed(1)} g/km</span>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  document.getElementById('charts-section').style.display = 'block';
}

/* ===========================
   RENDER CHARTS
=========================== */

function renderCharts() {
  if (selectedVehiclesData.length === 0) return;

  const labels = selectedVehiclesData.map(v => `${v.brand} ${v.model}`);

  // BAR
  const barCtx = document.getElementById('bar-chart');
  if (window.barChart) window.barChart.destroy();

  window.barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total Lifecycle (g/km)',
        data: selectedVehiclesData.map(v => v.lifecycle.total_g_per_km),
        backgroundColor: 'rgba(0,200,83,0.6)',
        borderColor: '#00C853',
        borderWidth: 2
      }]
    }
  });

  // STACKED
  const stackedCtx = document.getElementById('stacked-chart');
  if (window.stackedChart) window.stackedChart.destroy();

  window.stackedChart = new Chart(stackedCtx, {
    type: 'bar',
    data: {
      labels,
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
      scales: {
        x: { stacked: true },
        y: { stacked: true }
      }
    }
  });

  // DONUT
  const donutContainer = document.getElementById('donut-charts');
  donutContainer.innerHTML = '';

  selectedVehiclesData.forEach((vehicleData, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h5>${vehicleData.brand} ${vehicleData.model}</h5>
      <canvas id="donut-${index}"></canvas>
    `;
    donutContainer.appendChild(card);

    new Chart(document.getElementById(`donut-${index}`), {
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
      }
    });
  });
}

/* ===========================
   COUNTRY UPDATE
=========================== */

function updateCountryYear() {
  const countrySelect = document.getElementById('country-filter');
  currentCountry = countrySelect ? countrySelect.value : 'US';
}

/* ===========================
   EVENT LISTENERS
=========================== */

document.addEventListener('DOMContentLoaded', () => {
  loadVehicles();

  document.querySelectorAll('.filter-select').forEach(select => {
    select.addEventListener('change', () => {
      if (select.id === 'brand-filter') populateModels();
      if (select.id === 'country-filter') updateCountryYear();
      renderVehicleList();
    });
  });
});