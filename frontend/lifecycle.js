let vehiclesData = [];
let chart;

// ===============================
// Page Load
// ===============================
document.addEventListener("DOMContentLoaded", async function () {
    await loadVehicles();

    // Add change listeners AFTER data is loaded
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

    const response = await fetch(
        `http://127.0.0.1:5000/compare?brand=${brand}&model=${model}&year=${year}&country=POL`
    );

    const data = await response.json();
    updateChart(data);
};

// ===============================
// Chart Update
// ===============================
function updateChart(data) {

    const ctx = document.getElementById("chart").getContext("2d");

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Per KM (g CO₂)", "Lifetime (kg CO₂)"],
            datasets: [{
                label: data.brand + " " + data.model,
                data: [
                    Number(data.per_km_g || 0),
                    Number(data.lifetime_kg || 0)
                ],
                backgroundColor: ["green", "blue"]
            }]
        }
    });
}

// ===============================
// Dropdown Logic
// ===============================

function populateBrands() {

    const brands = [...new Set(vehiclesData.map(v => v.brand))].sort();
    const brandSelect = document.getElementById("brandSelect");

    brandSelect.innerHTML = "";

    brands.forEach(brand => {
        const option = document.createElement("option");
        option.value = brand;
        option.textContent = brand;
        brandSelect.appendChild(option);
    });

    populateModels();
}

function populateModels() {

    const brand = document.getElementById("brandSelect").value;

    const models = [
        ...new Set(
            vehiclesData
                .filter(v => v.brand === brand)
                .map(v => v.model)
        )
    ];

    const modelSelect = document.getElementById("modelSelect");
    modelSelect.innerHTML = "";

    models.forEach(model => {
        const option = document.createElement("option");
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
    });

    populateYears();
}

function populateYears() {

    const brand = document.getElementById("brandSelect").value;
    const model = document.getElementById("modelSelect").value;

    const years = [
        ...new Set(
            vehiclesData
                .filter(v => v.brand === brand && v.model === model)
                .map(v => v.Year)
        )
    ];

    const yearSelect = document.getElementById("yearSelect");
    yearSelect.innerHTML = "";

    years.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });
}