import React, { useEffect, useState, useMemo, useRef } from "react";
import "../styles/compare.css";
import apiClient from "../services/api";

import {
  Chart as ChartJS, BarElement, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

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
  const [loading, setLoading] = useState(false);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesLoadingMore, setVehiclesLoadingMore] = useState(false);
  const distanceDebounceRef = useRef(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => { loadVehicles(); }, []);

  async function loadVehicles() {
    setVehiclesLoading(true);
    setVehicles([]);
    const PAGE_SIZE = 200;
    let page = 1, totalPages = 1;
    try {
      while (page <= totalPages) {
        const res  = await fetch(`${API}/vehicles?page=${page}&limit=${PAGE_SIZE}`);
        const json = await res.json();
        const batch = Array.isArray(json) ? json : json.vehicles ?? [];
        totalPages  = json.pages ?? 1;
        setVehicles(prev => [...prev, ...batch]);
        if (page === 1) { setVehiclesLoading(false); if (totalPages > 1) setVehiclesLoadingMore(true); }
        page++;
      }
    } catch (err) {
      console.error("Failed to load vehicles:", err);
      setVehiclesLoading(false);
    } finally { setVehiclesLoadingMore(false); }
  }

  async function searchVehicles(query) {
    if (query.length < 2) { loadVehicles(); return; }
    setVehiclesLoading(true);
    const res  = await fetch(`${API}/vehicle-search?q=${query}`);
    const data = await res.json();
    setVehicles(data);
    setVehiclesLoading(false);
  }

  const filteredVehicles = useMemo(() => vehicles.filter(v =>
    (!brand || v.brand === brand) &&
    (!model || v.model === model) &&
    (!year  || v.year == year) &&
    (!powertrain ||
      (powertrain === "EV" && v.vehicle_type === "BEV") ||
      v.vehicle_type === powertrain)
  ), [brand, model, year, powertrain, vehicles]);

  async function calculateComparison(vehiclesList, distanceOverride) {
    if (vehiclesList.length === 0) { setSelectedData([]); return; }
    setLoading(true);
    try {
      const effectiveDistance = distanceOverride ?? distanceKm;
      const results = await apiClient.compareMultiple(
        country, 2023,
        vehiclesList.map(v => ({ brand: v.brand, model: v.model, year: v.year })),
        effectiveDistance
      );
      const combined = vehiclesList.map(v => {
        const match = results.find(
          r => r.brand === v.brand &&
               (r.model === v.model || r.vehicle === v.model) &&
               String(r.year) === String(v.year)
        );
        return { ...v, lifecycle: (match && !match.error) ? match : null, lifecycleError: match?.error ?? null };
      });
      setSelectedData(combined);
      setAiSummary(null);
      setAiError(null);
    } catch (err) { console.error("Comparison API error:", err); }
    finally { setLoading(false); }
  }

  async function toggleVehicle(vehicle) {
    const exists = selectedVehicles.find(
      v => v.brand === vehicle.brand && v.model === vehicle.model && v.year === vehicle.year
    );
    let updated;
    if (exists) {
      updated = selectedVehicles.filter(
        v => !(v.brand === vehicle.brand && v.model === vehicle.model && v.year === vehicle.year)
      );
    } else {
      if (selectedVehicles.length >= 3) return;
      updated = [...selectedVehicles, vehicle];
    }
    setSelectedVehicles(updated);
    await calculateComparison(updated);
  }

  function removeVehicle(vehicle) {
    const updated = selectedVehicles.filter(
      v => !(v.brand === vehicle.brand && v.model === vehicle.model && v.year === vehicle.year)
    );
    setSelectedVehicles(updated);
    calculateComparison(updated);
  }

  async function fetchAiSummary(vehiclesWithData) {
    setAiLoading(true); setAiSummary(null); setAiError(null);
    const winner = vehiclesWithData.reduce((best, v) => {
      const total = v.lifecycle?.total_for_distance_kg ?? Infinity;
      return total < (best.lifecycle?.total_for_distance_kg ?? Infinity) ? v : best;
    }, vehiclesWithData[0]);
    try {
      const [aiRes, winnerRes] = await Promise.all([
        fetch(`${API}/ai-summary`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicles: vehiclesWithData.map(v => ({
              brand: v.brand, model: v.model, year: v.year,
              vehicle_type: v.vehicle_type, lifecycle: v.lifecycle
            })),
            distance_km: distanceKm
          })
        }),
        fetch(`${API}/winner-detail`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand: winner.brand, model: winner.model, year: winner.year })
        })
      ]);
      const [aiData, winnerData] = await Promise.all([aiRes.json(), winnerRes.json()]);
      if (aiData.error) { setAiError(aiData.error); return; }
      setAiSummary({
        ...aiData,
        winner_image_url: winnerData.image_url ?? aiData.winner_image_url ?? null,
        winner_specs:     winnerData.specs ?? null,
        winner_stats:     winner.lifecycle ?? null,
      });
    } catch (err) {
      setAiError("Failed to load AI analysis. Please try again.");
    } finally { setAiLoading(false); }
  }

  const brands = [...new Set(vehicles.map(v => v.brand))].sort();
  const models = [...new Set(vehicles.map(v => v.model))].sort();
  const years  = [...new Set(vehicles.map(v => v.year))].sort((a, b) => b - a);

  const barData = {
    labels: selectedData.map(v => `${v.brand} ${v.model}`),
    datasets: [{
      label: `Total CO₂ over ${distanceKm.toLocaleString()} km (kg)`,
      data: selectedData.map(v => v.lifecycle?.total_for_distance_kg ?? 0),
      backgroundColor: "rgba(0,200,83,0.6)", borderColor: "rgba(0,200,83,1)", borderWidth: 1
    }]
  };

  const stackedData = {
    labels: selectedData.map(v => `${v.brand} ${v.model}`),
    datasets: [
      {
        label: "Manufacturing kg CO₂ (fixed)",
        data: selectedData.map(v => v.lifecycle?.manufacturing_total_kg ?? 0),
        backgroundColor: "#00C853"
      },
      {
        label: `Operational kg CO₂ (${distanceKm.toLocaleString()} km)`,
        data: selectedData.map(v => v.lifecycle?.operational_total_kg ?? 0),
        backgroundColor: "#69F0AE"
      },
      {
        label: "End-of-Life Recycling kg CO₂ (fixed)",
        data: selectedData.map(v => v.lifecycle?.recycling_kg ?? 0),
        backgroundColor: "#B2DFDB"
      }
    ]
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂` } }
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: "kg CO₂" } } }
  };

  const stackedOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂` } }
    },
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: "kg CO₂" } } }
  };

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂` } }
    }
  };

  function SkeletonVehicleItem() {
    return (
      <div className="vehicle-item skeleton-vehicle-item">
        <div className="skeleton skeleton-vehicle-title" />
        <div className="skeleton skeleton-vehicle-badge" />
        <div className="skeleton skeleton-vehicle-year" />
      </div>
    );
  }
  function SkeletonCard() {
    return (
      <div className="card comparison-card skeleton-card">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-badge" />
        <div className="mt-md">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="emission-value">
              <div className="skeleton skeleton-label" />
              <div className="skeleton skeleton-value" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  function SkeletonChart({ height = 300 }) {
    return (
      <div className="chart-container">
        <div className="skeleton skeleton-chart-title" />
        <div className="skeleton skeleton-chart" style={{ height }} />
      </div>
    );
  }
  function SkeletonDoughnut() {
    return (
      <div className="chart-container">
        <div className="skeleton skeleton-chart-title" />
        <div className="skeleton skeleton-donut" />
      </div>
    );
  }

  // ── ELV Material Flow box — shown for ALL vehicle types ───────────────────
  function ElvBox({ mat, vehicleType }) {
    const isEVType     = ["BEV", "EV", "PHEV"].includes(vehicleType);
    const hasRealData  = mat && mat.metal_recovered_kg != null;

    return (
      <div className="elv-box">
        <div className="elv-box-title">
          ♻️ End-of-Life Vehicle Recovery
          {mat?.weight_is_estimate && (
            <span className="elv-estimate-badge"> est.</span>
          )}
        </div>

        {!isEVType && (
          <div className="elv-battery-row">
            <span className="elv-label">Battery recycling</span>
            <span className="elv-dash" title="GREET: metal recycling credits offset all dismantling emissions">
              — <span className="elv-offset-note">(offset by metal credits)</span>
            </span>
          </div>
        )}

        {hasRealData ? (
          <div className="elv-grid">
            {mat.vehicle_weight_kg != null && (
              <div className="elv-row">
                <span className="elv-label">
                  Vehicle mass{mat.weight_is_estimate ? " (avg estimate)" : ""}
                </span>
                <span className="elv-neutral">
                  {mat.vehicle_weight_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                </span>
              </div>
            )}
            <div className="elv-row">
              <span className="elv-label">↩ Metals recovered</span>
              <span className="elv-positive">
                {mat.metal_recovered_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
              </span>
            </div>
            <div className="elv-row">
              <span className="elv-label">🗑 Shredder residue (ASR)</span>
              <span className="elv-negative">
                {mat.asr_waste_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
              </span>
            </div>
          </div>
        ) : (
          <div className="elv-unavailable">Vehicle weight unavailable</div>
        )}
      </div>
    );
  }

  return (
    <div className="container">

      <style>{`
        .elv-box {
          margin-top: 8px;
          padding: 9px 12px;
          background: rgba(178,223,219,0.05);
          border: 1px solid rgba(178,223,219,0.14);
          border-radius: 7px;
        }
        .elv-box-title {
          font-size: 0.68rem;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #B2DFDB;
          opacity: 0.7;
          margin-bottom: 7px;
          font-weight: 600;
        }
        .elv-estimate-badge {
          background: rgba(178,223,219,0.15);
          color: #B2DFDB;
          font-size: 0.65rem;
          padding: 1px 5px;
          border-radius: 3px;
          margin-left: 5px;
          letter-spacing: 0.5px;
          text-transform: none;
        }
        .elv-grid { display: flex; flex-direction: column; gap: 4px; }
        .elv-row  { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; }
        .elv-battery-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; margin-bottom: 5px; }
        .elv-label   { color: rgba(255,255,255,0.4); }
        .elv-dash    { color: rgba(255,255,255,0.25); font-size: 0.82rem; }
        .elv-offset-note { font-size: 0.7rem; opacity: 0.6; font-style: italic; }
        .elv-positive { color: #69F0AE !important; font-weight: 600; font-size: 0.82rem; }
        .elv-negative { color: #FF7043 !important; font-weight: 600; font-size: 0.82rem; }
        .elv-neutral  { color: rgba(255,255,255,0.6) !important; font-weight: 600; font-size: 0.82rem; }
        .elv-unavailable { font-size: 0.75rem; color: rgba(255,255,255,0.25); font-style: italic; }
        .recycling-note { font-size: 0.72rem; opacity: 0.4; font-style: italic; margin-left: 4px; }
      `}</style>

      <h1 className="text-center mb-lg">Compare Vehicles</h1>

      <section className="card mb-lg">
        <h3 className="mb-md">Select Vehicles (Max 3)</h3>

        <div className="search-bar-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text" placeholder="Search brand or model…" value={search}
            onChange={e => { setSearch(e.target.value); searchVehicles(e.target.value); }}
            className="search-bar-input"
          />
          {search && (
            <button className="search-clear-btn" onClick={() => { setSearch(""); loadVehicles(); }} aria-label="Clear search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

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
            <select className="filter-select" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="US">United States</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="UK">United Kingdom</option>
              <option value="CN">China</option>
              <option value="JP">Japan</option>
              <option value="IN">India</option>
            </select>
          </div>
          <div className="filter-group distance-filter-group">
            <div className="distance-label-row">
              <label>Distance</label>
              <div className="distance-input-wrapper">
                <input
                  type="number" className="distance-number-input" value={distanceKm}
                  onChange={e => {
                    const val = Math.min(300000, Math.max(100, Number(e.target.value) || 100));
                    setDistanceKm(val);
                    if (distanceDebounceRef.current) clearTimeout(distanceDebounceRef.current);
                    distanceDebounceRef.current = setTimeout(() => {
                      if (selectedVehicles.length > 0) calculateComparison(selectedVehicles, val);
                    }, 400);
                  }}
                  min="100" max="300000" step="100"
                />
                <span className="distance-unit">km</span>
              </div>
            </div>
            <div className="slider-track-wrapper">
              <input
                type="range" className="distance-slider" value={distanceKm}
                onChange={e => {
                  const val = Number(e.target.value);
                  setDistanceKm(val);
                  if (distanceDebounceRef.current) clearTimeout(distanceDebounceRef.current);
                  distanceDebounceRef.current = setTimeout(() => {
                    if (selectedVehicles.length > 0) calculateComparison(selectedVehicles, val);
                  }, 400);
                }}
                min="100" max="300000" step="100"
              />
              <div className="slider-fill" style={{ width: `${(distanceKm / 300000) * 100}%` }} />
            </div>
            <div className="slider-ticks">
              <span>100 km</span><span>150k km</span><span>300k km</span>
            </div>
          </div>
        </div>

        <div className="vehicle-list mt-md">
          {vehiclesLoading
            ? Array.from({ length: 12 }).map((_, i) => <SkeletonVehicleItem key={i} />)
            : filteredVehicles.map((v, i) => {
                const selected = selectedVehicles.find(
                  s => s.brand === v.brand && s.model === v.model && s.year === v.year
                );
                return (
                  <div
                    key={`${v.brand}-${v.model}-${v.year}-${i}`}
                    className={`vehicle-item ${selected ? "selected" : ""}`}
                    onClick={() => toggleVehicle(v)}
                  >
                    <h5>{v.brand} {v.model}</h5>
                    <p><span className={`badge badge-${v.vehicle_type?.toLowerCase()}`}>{v.vehicle_type}</span></p>
                    <p>{v.year}</p>
                  </div>
                );
              })
          }
        </div>

        {vehiclesLoadingMore && (
          <div className="vehicles-loading-more">
            <div className="vehicles-loading-bar" />
            <span>Loading more vehicles…</span>
          </div>
        )}
      </section>

      {/* ── SELECTED VEHICLE CARDS ── */}
      <section className="mb-lg">
        <div className="flex-between mb-md">
          <h3>Selected Vehicles ({selectedVehicles.length}/3)</h3>
        </div>
        <div className="grid grid-3">
          {loading
            ? selectedVehicles.map((_, i) => <SkeletonCard key={i} />)
            : selectedData.map((v, i) => {
                const lc = v.lifecycle;
                if (!lc) {
                  return (
                    <div key={i} className="card comparison-card">
                      <button className="remove-btn" onClick={() => removeVehicle(v)}>×</button>
                      <h4>{v.brand} {v.model}</h4>
                      <p style={{ color: "#FF5252", marginTop: "1rem", fontSize: "0.875rem" }}>
                        ⚠️ {v.lifecycleError || "Emissions data unavailable for this vehicle."}
                      </p>
                    </div>
                  );
                }

                const recyclingKg  = lc.recycling_kg ?? 0;
                const hasRecycling = recyclingKg > 0;
                const isEVType     = ["BEV", "EV", "PHEV"].includes(lc.vehicle_type);

                return (
                  <div key={i} className="card comparison-card">
                    <button className="remove-btn" onClick={() => removeVehicle(v)}>×</button>
                    <h4>{v.brand} {v.model}</h4>
                    <div className="mt-md">

                      {/* Operational */}
                      <div className="emission-value">
                        <span className="emission-label">Operational ({(lc.distance_km ?? distanceKm).toLocaleString()} km)</span>
                        <span className="emission-number">
                          {lc.operational_total_kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂
                        </span>
                      </div>

                      {/* Manufacturing */}
                      <div className="emission-value">
                        <span className="emission-label">Manufacturing (lifetime fixed)</span>
                        <span className="emission-number">
                          {lc.manufacturing_total_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂
                        </span>
                      </div>

                      {/* Battery recycling row */}
                      <div className="emission-value" style={{ marginTop: 2 }}>
                        <span className="emission-label">
                          Battery recycling (EoL)
                          {!isEVType && <span className="recycling-note">(no Li-ion pack)</span>}
                        </span>
                        <span className="emission-number" style={{ color: hasRecycling ? "inherit" : "rgba(255,255,255,0.28)" }}>
                          {hasRecycling
                            ? `${recyclingKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂`
                            : "—"
                          }
                          {lc.recycling_g_per_km > 0 && (
                            <span style={{ opacity: 0.5, fontSize: "0.75em", marginLeft: 4 }}>
                              ({lc.recycling_g_per_km} g/km)
                            </span>
                          )}
                        </span>
                      </div>

                      {/* ELV material flow — ALL types, always shown */}
                      <ElvBox mat={lc.recycling_materials} vehicleType={lc.vehicle_type} />

                      {/* Total */}
                      <div className="emission-value emission-value--total" style={{ marginTop: 8 }}>
                        <span className="emission-label">Total over {(lc.distance_km ?? distanceKm).toLocaleString()} km</span>
                        <span className="emission-number emission-number--total">
                          {lc.total_for_distance_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂
                        </span>
                      </div>

                      {/* Rate */}
                      <div className="emission-value">
                        <span className="emission-label">Rate</span>
                        <span className="emission-number" style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                          {lc.total_g_per_km} g/km
                          {lc.recycling_g_per_km > 0 && (
                            <span style={{ opacity: 0.5, fontSize: "0.75em", marginLeft: 4 }}>
                              (incl. {lc.recycling_g_per_km} g/km recycling)
                            </span>
                          )}
                        </span>
                      </div>

                    </div>
                  </div>
                );
              })
          }
        </div>
      </section>

      {/* ── CHARTS ── */}
      {(loading || selectedData.length > 0) && (
        <section className="charts-section">
          {loading ? (
            <>
              <SkeletonChart height={300} />
              <SkeletonChart height={300} />
              <div className="donut-charts">
                {selectedVehicles.map((_, i) => <SkeletonDoughnut key={i} />)}
              </div>
            </>
          ) : (
            <>
              <div className="chart-container">
                <h3>Total Lifecycle Emissions over {distanceKm.toLocaleString()} km</h3>
                <div style={{ position: "relative", height: "300px" }}>
                  <Bar data={barData} options={barOptions} />
                </div>
              </div>

              <div className="chart-container">
                <h3>Emissions Breakdown over {distanceKm.toLocaleString()} km</h3>
                <div style={{ position: "relative", height: "300px" }}>
                  <Bar data={stackedData} options={stackedOptions} />
                </div>
              </div>

              <div className="donut-charts">
                {selectedData.map((v, i) => {
                  const lc = v.lifecycle;
                  if (!lc) return null;
                  const recyclingKg  = lc.recycling_kg ?? 0;
                  const labels       = ["Manufacturing (fixed)", `Operational (${distanceKm.toLocaleString()} km)`];
                  const dataPoints   = [lc.manufacturing_total_kg, lc.operational_total_kg];
                  const bgColors     = ["#00C853", "#69F0AE"];
                  const borderColors = ["#009624", "#2bbd7e"];
                  if (recyclingKg > 0) {
                    labels.push("Battery Recycling (fixed)");
                    dataPoints.push(recyclingKg);
                    bgColors.push("#B2DFDB");
                    borderColors.push("#80CBC4");
                  }
                  return (
                    <div className="chart-container" key={i}>
                      <h3>{v.brand} {v.model}</h3>
                      <div style={{ position: "relative", height: "280px" }}>
                        <Doughnut
                          data={{ labels, datasets: [{ data: dataPoints, backgroundColor: bgColors, borderColor: borderColors, borderWidth: 1 }] }}
                          options={doughnutOptions}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── AI SUMMARY ── */}
      {selectedData.filter(v => v.lifecycle && !v.lifecycleError).length >= 1 && (
        <div className="ai-generate-wrap">
          {!aiSummary && !aiLoading && (
            <button
              className="ai-generate-btn"
              onClick={() => fetchAiSummary(selectedData.filter(v => v.lifecycle && !v.lifecycleError))}
            >
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z" fill="currentColor"/>
              </svg>
              Analyse with Gemini AI
            </button>
          )}

          {aiError && !aiLoading && (
            <div className="ai-error-wrap">
              <p className="ai-error-msg">⚠️ {aiError}</p>
              <button className="ai-generate-btn" onClick={() => fetchAiSummary(selectedData.filter(v => v.lifecycle && !v.lifecycleError))}>Retry</button>
            </div>
          )}

          {(aiLoading || aiSummary) && (
            <section className="ai-summary-section">
              <div className="ai-summary-header">
                <div className="ai-badge">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z" fill="currentColor"/>
                  </svg>
                  Gemini AI Analysis
                </div>
                <h2>Which Vehicle Should You Choose?</h2>
              </div>

              {aiLoading ? (
                <div className="ai-summary-skeleton">
                  <div className="ai-winner-skeleton">
                    <div className="skeleton ai-img-skeleton" />
                    <div className="ai-winner-text-skeleton">
                      <div className="skeleton" style={{height:22, width:"60%", marginBottom:12}} />
                      <div className="skeleton" style={{height:14, width:"40%", marginBottom:20}} />
                      <div className="skeleton" style={{height:12, width:"100%", marginBottom:8}} />
                      <div className="skeleton" style={{height:12, width:"90%", marginBottom:8}} />
                      <div className="skeleton" style={{height:12, width:"75%"}} />
                    </div>
                  </div>
                </div>
              ) : aiSummary && (
                <div className="ai-summary-content">
                  <div className="ai-winner-card">
                    {aiSummary.winner_image_url && (
                      <div className="ai-winner-img-wrap">
                        <img src={aiSummary.winner_image_url} alt={`${aiSummary.winner} image`} className="ai-winner-img" onError={e => { e.target.style.display = "none"; }} />
                      </div>
                    )}
                    <div className="ai-winner-info">
                      <div className="ai-winner-label">🏆 Best Pick</div>
                      <h3 className="ai-winner-name">{aiSummary.winner}</h3>
                      <span className={`badge badge-${aiSummary.winner_type?.toLowerCase()}`}>{aiSummary.winner_type}</span>
                      <p className="ai-winner-verdict">{aiSummary.verdict}</p>
                      {aiSummary.winner_stats && (
                        <div className="ai-winner-stats">
                          <div className="ai-winner-stat">
                            <span>Operational</span>
                            <strong>{aiSummary.winner_stats.operational_total_kg?.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</strong>
                          </div>
                          <div className="ai-winner-stat">
                            <span>Manufacturing</span>
                            <strong>{aiSummary.winner_stats.manufacturing_total_kg?.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</strong>
                          </div>
                          <div className="ai-winner-stat">
                            <span>Battery Recycling</span>
                            <strong>
                              {(aiSummary.winner_stats.recycling_kg ?? 0) > 0
                                ? `${aiSummary.winner_stats.recycling_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`
                                : "—"}
                            </strong>
                          </div>
                          <div className="ai-winner-stat">
                            <span>Rate</span>
                            <strong>{aiSummary.winner_stats.total_g_per_km} g/km</strong>
                          </div>
                        </div>
                      )}
                      {aiSummary.winner_specs && (
                        <div className="ai-winner-specs">
                          {aiSummary.winner_specs.range_km && <div className="ai-winner-spec"><span>Range</span><strong>{aiSummary.winner_specs.range_km} km</strong></div>}
                          {aiSummary.winner_specs.fuel_economy && <div className="ai-winner-spec"><span>Efficiency</span><strong>{aiSummary.winner_specs.fuel_economy}</strong></div>}
                          {aiSummary.winner_specs.manufacturer_url && (
                            <a href={aiSummary.winner_specs.manufacturer_url} target="_blank" rel="noopener noreferrer" className="ai-winner-mfr-link">
                              View on manufacturer site →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ai-reasons">
                    <h4>Why this vehicle wins</h4>
                    <ul className="ai-reasons-list">
                      {aiSummary.reasons?.map((r, i) => (
                        <li key={i}><span className="ai-reason-dot" />{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="ai-breakdown">
                    <h4>All vehicles compared</h4>
                    <div className="ai-breakdown-grid">
                      {aiSummary.breakdown?.map((v, i) => (
                        <div key={i} className={`ai-breakdown-card ${v.is_winner ? "ai-breakdown-winner" : ""}`}>
                          {v.image_url && <img src={v.image_url} alt={v.name} className="ai-breakdown-img" onError={e => { e.target.style.display = "none"; }} />}
                          <div className="ai-breakdown-name">{v.name}</div>
                          <div className="ai-breakdown-type"><span className={`badge badge-${v.type?.toLowerCase()}`}>{v.type}</span></div>
                          <div className="ai-breakdown-stat"><span>Total CO₂</span><strong>{v.total_kg?.toLocaleString(undefined, {maximumFractionDigits:0})} kg</strong></div>
                          <div className="ai-breakdown-stat"><span>Rate</span><strong>{v.rate_g_per_km} g/km</strong></div>
                          <p className="ai-breakdown-note">{v.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="ai-disclaimer">
                    Analysis generated by Gemini AI based on lifecycle emissions data.
                    Real-world results may vary based on driving patterns and grid changes.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}