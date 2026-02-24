let vehiclesData = [];
let chart;

// ===============================
// Page Load
// ===============================
document.addEventListener("DOMContentLoaded", async function () {
    await loadVehicles();

    document.getElementById("brandSelect")
        .addEventListener("change", populateModels);

    document.getElementById("modelSelect")
        .addEventListener("change", populateYears);
});

// ===============================
// Load Vehicles From Backend
// ===============================
async function loadVehicles() {
    const response = await fetch("http://127.0.0.1:5000/vehicles");
    vehiclesData = await response.json();
    populateBrands();
}

// ===============================
// Compare Button
// ===============================
window.compareVehicle = async function () {

    const brand = document.getElementById("brandSelect").value;
    const model = document.getElementById("modelSelect").value;
    const year = document.getElementById("yearSelect").value;

    if (!brand || !model || !year) {
        alert("Please select brand, model and year");
        return;
    }

    const response = await fetch(
        `http://127.0.0.1:5000/compare?brand=${brand}&model=${model}&year=${year}&country=POL`
    );

    const data = await response.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    updateChart(data, brand, model);
};

// ===============================
// Chart Update
// ===============================
function updateChart(data, brand, model) {

    const ctx = document.getElementById("chart").getContext("2d");

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: [
                "Operational (g CO₂/km)",
                "Manufacturing (g CO₂/km)",
                "Total Lifecycle (g CO₂/km)"
            ],
            datasets: [{
                label: `${brand} ${model}`,
                data: [
                    Number(data.operational_g_per_km),
                    Number(data.manufacturing_g_per_km),
                    Number(data.total_g_per_km)
                ]
            }]
        }
    });
}

// ===============================
// Dropdown Logic
// ===============================

function populateBrands() {

    const brandSelect = document.getElementById("brandSelect");
    brandSelect.innerHTML = `<option value="">Select Brand</option>`;

    const brands = [...new Set(vehiclesData.map(v => v.brand))].sort();

    brands.forEach(brand => {
        const option = document.createElement("option");
        option.value = brand;
        option.textContent = brand;
        brandSelect.appendChild(option);
    });
}

function populateModels() {

    const brand = document.getElementById("brandSelect").value;
    const modelSelect = document.getElementById("modelSelect");

    modelSelect.innerHTML = `<option value="">Select Model</option>`;
    document.getElementById("yearSelect").innerHTML =
        `<option value="">Select Year</option>`;

    if (!brand) return;

    const models = [
        ...new Set(
            vehiclesData
                .filter(v => v.brand === brand)
                .map(v => v.model)
        )
    ];

    models.forEach(model => {
        const option = document.createElement("option");
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
    });
}

function populateYears() {

    const brand = document.getElementById("brandSelect").value;
    const model = document.getElementById("modelSelect").value;
    const yearSelect = document.getElementById("yearSelect");

    yearSelect.innerHTML = `<option value="">Select Year</option>`;

    if (!brand || !model) return;

    const years = [
        ...new Set(
            vehiclesData
                .filter(v => v.brand === brand && v.model === model)
                .map(v => v.Year)
        )
    ].sort((a, b) => b - a);

    years.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });
}