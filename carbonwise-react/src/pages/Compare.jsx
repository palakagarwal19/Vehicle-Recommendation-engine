import React, { useEffect, useState, useMemo } from "react";
import "../styles/compare.css";
import apiClient from "../services/api";

import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";

import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

const API = "http://localhost:5000";

export default function Compare() {
  const [distanceKm, setDistanceKm] = useState(100);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [selectedData, setSelectedData] = useState([]);

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [powertrain, setPowertrain] = useState("");
  const [country, setCountry] = useState("US");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    const data = await apiClient.getAllVehicles();
    setVehicles(data);
  }

  async function searchVehicles(query) {
    if (query.length < 2) {
      loadVehicles();
      return;
    }
    const res = await fetch(`${API}/vehicle-search?q=${query}`);
    const data = await res.json();
    setVehicles(data);
  }

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v =>
      (!brand || v.brand === brand) &&
      (!model || v.model === model) &&
      (!year || v.year == year) &&
      (!powertrain ||
        (powertrain === "EV" && v.vehicle_type === "BEV") ||
        v.vehicle_type === powertrain
      )
    );
  }, [brand, model, year, powertrain, vehicles]);

  async function calculateComparison(vehiclesList) {
    if (vehiclesList.length === 0) {
      setSelectedData([]);
      return;
    }
    try {
      console.group("📡 calculateComparison");
      console.log("▶ Sending vehicles:", vehiclesList.map(v => ({
        brand: v.brand, model: v.model, year: v.year
      })));
      console.log("▶ Country:", country, "| Grid year: 2023");

      const results = await apiClient.compareMultiple(
        country,
        2023,
        vehiclesList.map(v => ({
          brand: v.brand,
          model: v.model,
          year: v.year
        }))
      );

      console.log("◀ Raw API response:", results);
      console.log("◀ Response length:", results.length, "| Sent:", vehiclesList.length);
      results.forEach((r, i) => {
        console.log(`  result[${i}]:`, r);
      });

      const combined = vehiclesList.map(v => {
        const match = results.find(r => r.vehicle === v.model);
        console.log(
          `  Matching "${v.model}" →`,
          match
            ? `✅ found (total_g_per_km: ${match.total_g_per_km})`
            : `❌ NO MATCH — result vehicles are: [${results.map(r => r.vehicle).join(", ")}]`
        );
        return { ...v, lifecycle: match ?? null };
      });

      console.log("◀ Combined selectedData:", combined);
      console.groupEnd();

      setSelectedData(combined);
    } catch (err) {
      console.error("❌ Comparison API error:", err);
      console.groupEnd();
    }
  }

  async function toggleVehicle(vehicle) {
    const exists = selectedVehicles.find(
      v =>
        v.brand === vehicle.brand &&
        v.model === vehicle.model &&
        v.year === vehicle.year
    );

    let updated;

    if (exists) {
      updated = selectedVehicles.filter(
        v =>
          !(
            v.brand === vehicle.brand &&
            v.model === vehicle.model &&
            v.year === vehicle.year
          )
      );
    } else {
      if (selectedVehicles.length >= 3) return;
      updated = [...selectedVehicles, vehicle];
    }

    setSelectedVehicles(updated);
    await calculateComparison(updated);
  }

  function removeVehicle(vehicle) {
    setSelectedVehicles(prev =>
      prev.filter(v =>
        !(v.brand === vehicle.brand &&
          v.model === vehicle.model &&
          v.year === vehicle.year)
      )
    );
    setSelectedData(prev =>
      prev.filter(v =>
        !(v.brand === vehicle.brand &&
          v.model === vehicle.model &&
          v.year === vehicle.year)
      )
    );
  }

  const brands = [...new Set(vehicles.map(v => v.brand))].sort();
  const models = [...new Set(vehicles.map(v => v.model))].sort();
  const years = [...new Set(vehicles.map(v => v.year))].sort((a, b) => b - a);

  // ── FIX 1: distanceKm is now used to scale all chart values ──
  const barData = {
    labels: selectedData.map(v => `${v.brand} ${v.model}`),
    datasets: [
      {
        label: `Total Lifecycle Emissions (g CO₂ over ${distanceKm} km)`,
        data: selectedData.map(v =>
          v.lifecycle ? Math.round(v.lifecycle.total_g_per_km * distanceKm) : 0
        ),
        backgroundColor: "rgba(0,200,83,0.6)",
        borderColor: "rgba(0,200,83,1)",
        borderWidth: 1
      }
    ]
  };

  const stackedData = {
    labels: selectedData.map(v => `${v.brand} ${v.model}`),
    datasets: [
      {
        label: "Manufacturing (g CO₂)",
        data: selectedData.map(v =>
          v.lifecycle ? Math.round(v.lifecycle.manufacturing_g_per_km * distanceKm) : 0
        ),
        backgroundColor: "#00C853"
      },
      {
        label: "Operational (g CO₂)",
        data: selectedData.map(v =>
          v.lifecycle ? Math.round(v.lifecycle.operational_g_per_km * distanceKm) : 0
        ),
        backgroundColor: "#69F0AE"
      }
    ]
  };

  // ── FIX 2: Shared chart options with explicit height via the wrapper div ──
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()} g CO₂`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "g CO₂" }
      }
    }
  };

  const stackedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()} g CO₂`
        }
      }
    },
    scales: {
      x: { stacked: true },
      y: {
        stacked: true,
        beginAtZero: true,
        title: { display: true, text: "g CO₂" }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.label}: ${ctx.parsed.toLocaleString()} g CO₂`
        }
      }
    }
  };

  return (
    <div className="container">

      <h1 className="text-center mb-lg">Compare Vehicles</h1>

      <section className="card mb-lg">

        <h3 className="mb-md">Select Vehicles (Max 3)</h3>

        {/* SEARCH BOX */}
        <input
          type="text"
          placeholder="Search vehicle (Tesla, Prius...)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            searchVehicles(e.target.value);
          }}
          className="filter-select"
          style={{ marginBottom: "10px" }}
        />

        <div className="filters">

          <div className="filter-group">
            <label>Brand</label>
            <select className="filter-select" onChange={e => setBrand(e.target.value)}>
              <option value="">All Brands</option>
              {brands.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Model</label>
            <select className="filter-select" onChange={e => setModel(e.target.value)}>
              <option value="">All Models</option>
              {models.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Year</label>
            <select className="filter-select" onChange={e => setYear(e.target.value)}>
              <option value="">All Years</option>
              {years.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Powertrain</label>
            <select className="filter-select" onChange={e => setPowertrain(e.target.value)}>
              <option value="">All Types</option>
              <option value="EV">EV</option>
              <option value="PHEV">PHEV</option>
              <option value="ICE">ICE</option>
              <option value="HEV">HEV</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Country</label>
            <select
              className="filter-select"
              value={country}
              onChange={e => setCountry(e.target.value)}
            >
              <option value="US">United States</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="UK">United Kingdom</option>
              <option value="CN">China</option>
              <option value="JP">Japan</option>
            </select>
          </div>

          {/* ── FIX 3: Distance input moved inside return, now correctly rendered ── */}
          <div className="filter-group">
            <label>Distance Travelled (km)</label>
            <input
              type="number"
              className="filter-select"
              value={distanceKm}
              onChange={(e) => setDistanceKm(Number(e.target.value))}
              min="1"
              step="100"
            />
          </div>

        </div>

        <div className="vehicle-list mt-md">
          {filteredVehicles.map((v, i) => {
            const selected = selectedVehicles.find(
              s => s.brand === v.brand &&
                s.model === v.model &&
                s.year === v.year
            );
            return (
              <div
                key={`${v.brand}-${v.model}-${v.year}-${i}`}
                className={`vehicle-item ${selected ? "selected" : ""}`}
                onClick={() => toggleVehicle(v)}
              >
                <h5>{v.brand} {v.model}</h5>
                <p>
                  <span className={`badge badge-${v.vehicle_type?.toLowerCase()}`}>
                    {v.vehicle_type}
                  </span>
                </p>
                <p>{v.year}</p>
              </div>
            );
          })}
        </div>

      </section>

      <section className="mb-lg">

        <div className="flex-between mb-md">
          <h3>Selected Vehicles ({selectedVehicles.length}/3)</h3>
        </div>

        <div className="grid grid-3">
          {selectedData.map((v, i) => {
            const lc = v.lifecycle;

            if (!lc) {
              return (
                <div key={i} className="card comparison-card">
                  <button className="remove-btn" onClick={() => removeVehicle(v)}>×</button>
                  <h4>{v.brand} {v.model}</h4>
                  <p style={{ color: "var(--color-text-secondary)", marginTop: "1rem" }}>
                    ⚠️ Emissions data unavailable for this vehicle.
                  </p>
                </div>
              );
            }

            return (
              <div key={i} className="card comparison-card">

                <button className="remove-btn" onClick={() => removeVehicle(v)}>×</button>

                <h4>{v.brand} {v.model}</h4>

                <div className="mt-md">
                  <div className="emission-value">
                    <span className="emission-label">Total (g/km)</span>
                    <span className="emission-number">{lc.total_g_per_km}</span>
                  </div>
                  <div className="emission-value">
                    <span className="emission-label">Manufacturing (g/km)</span>
                    <span className="emission-number">{lc.manufacturing_g_per_km}</span>
                  </div>
                  <div className="emission-value">
                    <span className="emission-label">Operational (g/km)</span>
                    <span className="emission-number">{lc.operational_g_per_km}</span>
                  </div>
                  <div className="emission-value">
                    <span className="emission-label">Total over {distanceKm} km</span>
                    <span className="emission-number">
                      {Math.round(lc.total_g_per_km * distanceKm).toLocaleString()} g
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </section>

      {selectedData.length > 0 && (

        <section className="charts-section">

          {/* ── FIX 4: Explicit height wrapper so maintainAspectRatio:false works ── */}
          <div className="chart-container">
            <h3>Lifecycle Comparison (total g CO₂ over {distanceKm} km)</h3>
            <div style={{ position: "relative", height: "300px" }}>
              <Bar data={barData} options={barOptions} />
            </div>
          </div>

          <div className="chart-container">
            <h3>Emissions Breakdown (total g CO₂ over {distanceKm} km)</h3>
            <div style={{ position: "relative", height: "300px" }}>
              <Bar data={stackedData} options={stackedOptions} />
            </div>
          </div>

          <div className="donut-charts">
            {selectedData.map((v, i) => {
              const lc = v.lifecycle;
              if (!lc) return null;
              return (
                <div className="chart-container" key={i}>
                  <h3>{v.brand} {v.model}</h3>
                  <div style={{ position: "relative", height: "280px" }}>
                    <Doughnut
                      data={{
                        labels: ["Manufacturing", "Operational"],
                        datasets: [{
                          data: [
                            Math.round(lc.manufacturing_g_per_km * distanceKm),
                            Math.round(lc.operational_g_per_km * distanceKm)
                          ],
                          backgroundColor: ["#00C853", "#69F0AE"],
                          borderColor: ["#009624", "#2bbd7e"],
                          borderWidth: 1
                        }]
                      }}
                      options={doughnutOptions}
                    />
                  </div>
                </div>
              );
            })}
          </div>

        </section>

      )}

    </div>
  );
}