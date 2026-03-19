import React, { useEffect, useState, useMemo, useRef, useCallback, memo } from "react";
import "../styles/compare.css";
import apiClient from "../services/api";
import { useVehicles } from "../hooks/useVehicles";   // ← NEW

import {
  Chart as ChartJS, BarElement, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

const powertrainColor = {
  BEV:  "#00C853", EV: "#00C853",
  ICE:  "#FF9800", HEV: "#2196F3", PHEV: "#9C27B0",
};
const lifecycleColors = {
  manufacturing: "#2196F3",
  operational:   "#FF5252",
  recycling:     "#FFC107",
};

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// ── Vehicle list page size — only render this many at once ────────────────
const VISIBLE_LIMIT = 60;

// ─────────────────────────────────────────────────────────────────
// Powertrain tag plugin (unchanged — canvas-only, not DOM)
// ─────────────────────────────────────────────────────────────────
const powertrainTagPlugin = {
  id: "powertrainTag",
  afterDraw(chart, _args, options) {
    const tags = options?.tags;
    if (!tags?.length) return;
    const { ctx, scales: { x }, chartArea } = chart;
    if (!x) return;
    const PILL_H  = 16;
    const PILL_PY = chartArea.bottom + 46;
    ctx.save();
    x.ticks.forEach((_, i) => {
      const tag = tags[i];
      if (!tag) return;
      const cx = x.getPixelForTick(i);
      ctx.font = "bold 10px 'DM Mono', monospace";
      const tw = ctx.measureText(tag.label).width;
      const pw = tw + 14;
      const px = cx - pw / 2;
      const r  = PILL_H / 2;
      ctx.beginPath();
      ctx.moveTo(px + r, PILL_PY);
      ctx.lineTo(px + pw - r, PILL_PY);
      ctx.arcTo(px + pw, PILL_PY, px + pw, PILL_PY + PILL_H, r);
      ctx.arcTo(px + pw, PILL_PY + PILL_H, px, PILL_PY + PILL_H, r);
      ctx.arcTo(px, PILL_PY + PILL_H, px, PILL_PY, r);
      ctx.arcTo(px, PILL_PY, px + pw, PILL_PY, r);
      ctx.closePath();
      ctx.fillStyle   = tag.color + "22";
      ctx.strokeStyle = tag.color + "88";
      ctx.lineWidth   = 1;
      ctx.fill(); ctx.stroke();
      ctx.fillStyle    = tag.color;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tag.label, cx, PILL_PY + PILL_H / 2);
    });
    ctx.restore();
  },
};
ChartJS.register(powertrainTagPlugin);

// ── Memoised vehicle row — skips re-render unless selection changes ───────
const VehicleItem = memo(function VehicleItem({ vehicle, isSelected, onToggle }) {
  return (
    <div
      className={`vehicle-item${isSelected ? " selected" : ""}`}
      onClick={onToggle}
    >
      <h5>{vehicle.brand} {vehicle.model}</h5>
      <p>
        <span className={`badge badge-${vehicle.vehicle_type?.toLowerCase()}`}>
          {vehicle.vehicle_type}
        </span>
      </p>
      <p>{vehicle.year}</p>
    </div>
  );
});

// ── Skeletons (unchanged) ─────────────────────────────────────────────────
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

// ── ELV box (unchanged) ───────────────────────────────────────────────────
function ElvBox({ mat, vehicleType }) {
  const isEVType    = ["BEV", "EV", "PHEV"].includes(vehicleType);
  const hasRealData = mat && mat.metal_recovered_kg != null;
  return (
    <div className="elv-box">
      <div className="elv-box-title">
        ♻️ End-of-Life Vehicle Recovery
        {mat?.weight_is_estimate && <span className="elv-estimate-badge"> est.</span>}
      </div>
      {!isEVType && (
        <div className="elv-battery-row">
          <span className="elv-label">Battery recycling</span>
          <span className="elv-dash">— <span className="elv-offset-note">(offset by metal credits)</span></span>
        </div>
      )}
      {hasRealData ? (
        <div className="elv-grid">
          {mat.vehicle_weight_kg != null && (
            <div className="elv-row">
              <span className="elv-label">Vehicle mass{mat.weight_is_estimate ? " (avg estimate)" : ""}</span>
              <span className="elv-neutral">{mat.vehicle_weight_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
            </div>
          )}
          <div className="elv-row">
            <span className="elv-label">↩ Metals recovered</span>
            <span className="elv-positive">{mat.metal_recovered_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
          </div>
          <div className="elv-row">
            <span className="elv-label">🗑 Shredder residue (ASR)</span>
            <span className="elv-negative">{mat.asr_waste_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
          </div>
        </div>
      ) : (
        <div className="elv-unavailable">Vehicle weight unavailable</div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function Compare() {
  const [distanceKm, setDistanceKm]             = useState(100);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [selectedData, setSelectedData]         = useState([]);
  const [brand, setBrand]                       = useState("");
  const [model, setModel]                       = useState("");
  const [year, setYear]                         = useState("");
  const [powertrain, setPowertrain]             = useState("");
  const [country, setCountry]                   = useState("US");
  const [loading, setLoading]                   = useState(false);
  const [showAll, setShowAll]                   = useState(false);
  const [aiSummary, setAiSummary]               = useState(null);
  const [aiLoading, setAiLoading]               = useState(false);
  const [aiError, setAiError]                   = useState(null);

  const distanceDebounceRef = useRef(null);

  // ── useVehicles hook — replaces all manual loading/search boilerplate ──
  const {
    vehicles,
    vehiclesLoading,
    vehiclesLoadingMore,
    search,
    handleSearch,
    reload: reloadVehicles,
  } = useVehicles();

  // ── Filter + slice in useMemo ─────────────────────────────────────────
  const filteredVehicles = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return vehicles.filter(v =>
      (!brand      || v.brand === brand) &&
      (!model      || v.model === model) &&
      (!year       || v.year == year) &&
      (!powertrain ||
        (powertrain === "EV" && v.vehicle_type === "BEV") ||
        v.vehicle_type === powertrain) &&
      (!lowerSearch || v.brand.toLowerCase().includes(lowerSearch) ||
        v.model.toLowerCase().includes(lowerSearch))
    );
  }, [brand, model, year, powertrain, vehicles, search]);

  const visibleVehicles = useMemo(
    () => showAll ? filteredVehicles : filteredVehicles.slice(0, VISIBLE_LIMIT),
    [filteredVehicles, showAll]
  );

  // ── Stable selection set for O(1) lookup ─────────────────────────────
  const selectedKeys = useMemo(
    () => new Set(selectedVehicles.map(v => `${v.brand}|${v.model}|${v.year}`)),
    [selectedVehicles]
  );

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
      setAiSummary(null); setAiError(null);
    } catch (err) { console.error("Comparison API error:", err); }
    finally { setLoading(false); }
  }

  const toggleVehicle = useCallback(async (vehicle) => {
    const key = `${vehicle.brand}|${vehicle.model}|${vehicle.year}`;
    let updated;
    if (selectedKeys.has(key)) {
      updated = selectedVehicles.filter(v => `${v.brand}|${v.model}|${v.year}` !== key);
    } else {
      if (selectedVehicles.length >= 3) return;
      updated = [...selectedVehicles, vehicle];
    }
    setSelectedVehicles(updated);
    await calculateComparison(updated);
  }, [selectedVehicles, selectedKeys, distanceKm, country]);

  function removeVehicle(vehicle) {
    const key = `${vehicle.brand}|${vehicle.model}|${vehicle.year}`;
    const updated = selectedVehicles.filter(v => `${v.brand}|${v.model}|${v.year}` !== key);
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
              vehicle_type: v.vehicle_type, lifecycle: v.lifecycle,
            })),
            distance_km: distanceKm,
          }),
        }),
        fetch(`${API}/winner-detail`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand: winner.brand, model: winner.model, year: winner.year }),
        }),
      ]);
      const [aiData, winnerData] = await Promise.all([aiRes.json(), winnerRes.json()]);
      if (aiData.error) { setAiError(aiData.error); return; }
      setAiSummary({
        ...aiData,
        winner_image_url: winnerData.image_url ?? aiData.winner_image_url ?? null,
        winner_specs:     winnerData.specs ?? null,
        winner_stats:     winner.lifecycle ?? null,
      });
    } catch {
      setAiError("Failed to load AI analysis. Please try again.");
    } finally { setAiLoading(false); }
  }

  const brands = useMemo(() => [...new Set(vehicles.map(v => v.brand))].sort(), [vehicles]);
  const models = useMemo(() => [...new Set(vehicles.map(v => v.model))].sort(), [vehicles]);
  const years  = useMemo(() => [...new Set(vehicles.map(v => v.year))].sort((a, b) => b - a), [vehicles]);

  const ptTags       = selectedData.map(v => ({ label: v.vehicle_type || "?", color: powertrainColor[v.vehicle_type] || "#888" }));
  const chartPadding = { bottom: 40 };

  const barData = {
    labels: selectedData.map(v => `${v.brand} ${v.model}`),
    datasets: [{
      label: `Total CO₂ over ${distanceKm.toLocaleString()} km (kg)`,
      data:  selectedData.map(v => v.lifecycle?.total_for_distance_kg ?? 0),
      backgroundColor: selectedData.map(v => (powertrainColor[v.vehicle_type] || "#888") + "99"),
      borderColor:     selectedData.map(v =>  powertrainColor[v.vehicle_type] || "#888"),
      borderWidth: 2, borderRadius: 4,
    }],
  };

  const stackedData = {
    labels: selectedData.map(v => `${v.brand} ${v.model}`),
    datasets: [
      { label: "Manufacturing",                           data: selectedData.map(v => v.lifecycle?.manufacturing_total_kg ?? 0), backgroundColor: lifecycleColors.manufacturing, borderRadius: 4 },
      { label: `Operational (${distanceKm.toLocaleString()} km)`, data: selectedData.map(v => v.lifecycle?.operational_total_kg   ?? 0), backgroundColor: lifecycleColors.operational,   borderRadius: 4 },
      { label: "End-of-Life Recycling",                  data: selectedData.map(v => v.lifecycle?.recycling_kg               ?? 0), backgroundColor: lifecycleColors.recycling },
    ],
  };

  const ptPlugin    = { powertrainTag: { tags: ptTags } };
  const barOptions  = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 400 },
    layout: { padding: chartPadding },
    plugins: {
      legend: { position: "top" },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂` } },
      ...ptPlugin,
    },
    scales: {
      x: { ticks: { color: "#ccc", font: { family: "'DM Mono', monospace", size: 11 } } },
      y: { beginAtZero: true, title: { display: true, text: "kg CO₂" } },
    },
  };

  const stackedOptions = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 400 },
    layout: { padding: chartPadding },
    plugins: {
      legend: { position: "top" },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂` } },
      ...ptPlugin,
    },
    scales: {
      x: { stacked: true, ticks: { color: "#ccc", font: { family: "'DM Mono', monospace", size: 11 } } },
      y: { stacked: true, beginAtZero: true, title: { display: true, text: "kg CO₂" } },
    },
  };

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 400 },
    cutout: "65%",
    plugins: {
      legend: { position: "bottom", labels: { color: "#ffffff", font: { size: 12, weight: "600" }, padding: 18 } },
      tooltip: { callbacks: { label: ctx => `${ctx.label}: ${(ctx.parsed || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂` } },
    },
  };

  return (
    <>
      <div className="page-bg-image" />
      <div className="page-bg-overlay" />
      <div className="container">
        <style>{`
          .pt-pill { display:inline-flex;align-items:center;padding:.18rem .6rem;border-radius:999px;font-size:.7rem;font-weight:700;letter-spacing:.06em;border:1.5px solid;line-height:1; }
          .donut-title-row { display:flex;align-items:center;gap:.55rem;margin-bottom:var(--spacing-md,1rem);flex-wrap:wrap; }
          .donut-title-row h3 { margin:0; }
        `}</style>

        <h1 className="text-center mb-lg">Compare Vehicles</h1>

        {/* ── SELECTION CARD ── */}
        <section className="card mb-lg">
          <h3 className="mb-md">Select Vehicles (Max 3)</h3>

          {/* Search — wired to hook's handleSearch */}
          <div className="search-bar-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search brand or model…"
              value={search}
              onChange={e => { setShowAll(false); handleSearch(e.target.value); }}
              className="search-bar-input"
            />
            {search && (
              <button
                className="search-clear-btn"
                onClick={() => { setShowAll(false); handleSearch(""); }}
                aria-label="Clear search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          <div className="filters">
            <div className="filter-group"><label>Brand</label>
              <select className="filter-select" onChange={e => setBrand(e.target.value)}>
                <option value="">All Brands</option>{brands.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="filter-group"><label>Model</label>
              <select className="filter-select" onChange={e => setModel(e.target.value)}>
                <option value="">All Models</option>{models.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="filter-group"><label>Year</label>
              <select className="filter-select" onChange={e => setYear(e.target.value)}>
                <option value="">All Years</option>{years.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div className="filter-group"><label>Powertrain</label>
              <select className="filter-select" onChange={e => setPowertrain(e.target.value)}>
                <option value="">All Types</option>
                <option value="EV">EV</option><option value="PHEV">PHEV</option>
                <option value="ICE">ICE</option><option value="HEV">HEV</option>
              </select>
            </div>
            <div className="filter-group"><label>Country</label>
              <select className="filter-select" value={country} onChange={e => setCountry(e.target.value)}>
                <option value="US">United States</option><option value="DE">Germany</option>
                <option value="FR">France</option><option value="UK">United Kingdom</option>
                <option value="CN">China</option><option value="JP">Japan</option><option value="IN">India</option>
              </select>
            </div>
            <div className="filter-group distance-filter-group">
              <div className="distance-label-row">
                <label>Distance</label>
                <div className="distance-input-wrapper">
                  <input type="number" className="distance-number-input" value={distanceKm}
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
                <input type="range" className="distance-slider" value={distanceKm}
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
              <div className="slider-ticks"><span>100 km</span><span>150k km</span><span>300k km</span></div>
            </div>
          </div>

          {/* ── Vehicle list ── */}
          <div className="vehicle-list mt-md">
            {vehiclesLoading && !vehicles.length
              ? Array.from({ length: 12 }).map((_, i) => <SkeletonVehicleItem key={i} />)
              : visibleVehicles.map((v, i) => {
                  const key = `${v.brand}|${v.model}|${v.year}`;
                  return (
                    <VehicleItem
                      key={`${key}-${i}`}
                      vehicle={v}
                      isSelected={selectedKeys.has(key)}
                      onToggle={() => toggleVehicle(v)}
                    />
                  );
                })
            }
          </div>

          {/* Loading-more bar — mirrors Greenwashing style */}
          {vehiclesLoadingMore && (
            <div style={{ display:"flex", alignItems:"center", gap:".75rem", padding:".5rem 0 .25rem", fontSize:".75rem", color:"rgba(255,255,255,.4)" }}>
              <div style={{ flex:1, height:2, background:"rgba(255,255,255,.08)", borderRadius:999 }} />
              <span>Loading more vehicles…</span>
            </div>
          )}

          {/* Show more / show fewer */}
          {!vehiclesLoading && filteredVehicles.length > VISIBLE_LIMIT && (
            <button className="show-more-btn" onClick={() => setShowAll(p => !p)}>
              {showAll
                ? `▲ Show fewer`
                : `▼ Show all ${filteredVehicles.length} vehicles`}
            </button>
          )}
          {!vehiclesLoading && filteredVehicles.length === 0 && (
            <p style={{ textAlign: "center", padding: "1.5rem 0", opacity: 0.45 }}>
              No vehicles match your filters.
            </p>
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
                  if (!lc) return (
                    <div key={i} className="card comparison-card">
                      <button className="remove-btn" onClick={() => removeVehicle(v)}>×</button>
                      <h4>{v.brand} {v.model}</h4>
                      <p style={{ color:"#FF5252", marginTop:"1rem", fontSize:"0.875rem" }}>
                        ⚠️ {v.lifecycleError || "Emissions data unavailable for this vehicle."}
                      </p>
                    </div>
                  );
                  const recyclingKg  = lc.recycling_kg ?? 0;
                  const hasRecycling = recyclingKg > 0;
                  const isEVType     = ["BEV","EV","PHEV"].includes(lc.vehicle_type);
                  const ptColor      = powertrainColor[lc.vehicle_type] || "#888";
                  return (
                    <div key={i} className="card comparison-card">
                      <button className="remove-btn" onClick={() => removeVehicle(v)}>×</button>
                      <div style={{ display:"flex", alignItems:"center", gap:".5rem", flexWrap:"wrap" }}>
                        <h4 style={{ margin:0 }}>{v.brand} {v.model}</h4>
                        <span className="pt-pill" style={{ color:ptColor, borderColor:ptColor+"55", background:ptColor+"18" }}>{lc.vehicle_type}</span>
                      </div>
                      <div className="mt-md">
                        <div className="emission-value">
                          <span className="emission-label">Operational ({(lc.distance_km ?? distanceKm).toLocaleString()} km)</span>
                          <span className="emission-number">{lc.operational_total_kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂</span>
                        </div>
                        <div className="emission-value">
                          <span className="emission-label">Manufacturing (lifetime fixed)</span>
                          <span className="emission-number">{lc.manufacturing_total_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂</span>
                        </div>
                        <div className="emission-value" style={{ marginTop:2 }}>
                          <span className="emission-label">
                            Battery recycling (EoL)
                            {!isEVType && <span className="recycling-note">(no Li-ion pack)</span>}
                          </span>
                          <span className="emission-number" style={{ color: hasRecycling ? "inherit" : "rgba(255,255,255,0.28)" }}>
                            {hasRecycling ? `${recyclingKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂` : "—"}
                          </span>
                        </div>
                        <ElvBox mat={lc.recycling_materials} vehicleType={lc.vehicle_type} />
                        <div className="emission-value emission-value--total" style={{ marginTop:8 }}>
                          <span className="emission-label">Total over {(lc.distance_km ?? distanceKm).toLocaleString()} km</span>
                          <span className="emission-number emission-number--total">{lc.total_for_distance_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂</span>
                        </div>
                        <div className="emission-value">
                          <span className="emission-label">Rate</span>
                          <span className="emission-number" style={{ fontSize:"0.8rem", opacity:0.7 }}>{lc.total_g_per_km} g/km</span>
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
                  <div style={{ position:"relative", height:"330px" }}>
                    <Bar data={barData} options={barOptions} />
                  </div>
                </div>
                <div className="chart-container">
                  <h3>Emissions Breakdown over {distanceKm.toLocaleString()} km</h3>
                  <div style={{ position:"relative", height:"330px" }}>
                    <Bar data={stackedData} options={stackedOptions} />
                  </div>
                </div>
                <div className="donut-charts">
                  {selectedData.map((v, i) => {
                    const lc = v.lifecycle;
                    if (!lc) return null;
                    const recyclingKg = lc.recycling_kg ?? 0;
                    const ptColor     = powertrainColor[v.vehicle_type] || "#888";
                    const labels      = ["Manufacturing", `Operational (${distanceKm.toLocaleString()} km)`];
                    const dataPoints  = [lc.manufacturing_total_kg, lc.operational_total_kg];
                    const bgColors    = [lifecycleColors.manufacturing, lifecycleColors.operational];
                    if (recyclingKg > 0) { labels.push("End-of-Life Recycling"); dataPoints.push(recyclingKg); bgColors.push(lifecycleColors.recycling); }
                    return (
                      <div className="chart-container" key={i}>
                        <div className="donut-title-row">
                          <h3>{v.brand} {v.model}</h3>
                          <span className="pt-pill" style={{ color:ptColor, borderColor:ptColor+"55", background:ptColor+"18" }}>{v.vehicle_type}</span>
                        </div>
                        <div style={{ position:"relative", height:"280px" }}>
                          <Doughnut
                            data={{ labels, datasets: [{ data: dataPoints, backgroundColor: bgColors, borderColor: bgColors, borderWidth: 1 }] }}
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
              <button className="ai-generate-btn"
                onClick={() => fetchAiSummary(selectedData.filter(v => v.lifecycle && !v.lifecycleError))}>
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z" fill="currentColor"/>
                </svg>
                <span>Analyse with Gemini AI</span>
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
                        <div className="skeleton" style={{height:22,width:"60%",marginBottom:12}}/>
                        <div className="skeleton" style={{height:14,width:"40%",marginBottom:20}}/>
                        <div className="skeleton" style={{height:12,width:"100%",marginBottom:8}}/>
                        <div className="skeleton" style={{height:12,width:"90%",marginBottom:8}}/>
                        <div className="skeleton" style={{height:12,width:"75%"}}/>
                      </div>
                    </div>
                  </div>
                ) : aiSummary && (
                  <div className="ai-summary-content">
                    <div className="ai-winner-card">
                      {aiSummary.winner_image_url && (
                        <div className="ai-winner-img-wrap">
                          <img src={aiSummary.winner_image_url} alt={`${aiSummary.winner} image`} className="ai-winner-img" onError={e => { e.target.style.display="none"; }} />
                        </div>
                      )}
                      <div className="ai-winner-info">
                        <div className="ai-winner-label">🏆 Best Pick</div>
                        <div style={{ display:"flex", alignItems:"center", gap:".5rem", flexWrap:"wrap" }}>
                          <h3 className="ai-winner-name">{aiSummary.winner}</h3>
                          <span className="pt-pill" style={{ color:powertrainColor[aiSummary.winner_type]||"#888", borderColor:(powertrainColor[aiSummary.winner_type]||"#888")+"55", background:(powertrainColor[aiSummary.winner_type]||"#888")+"18" }}>{aiSummary.winner_type}</span>
                        </div>
                        <p className="ai-winner-verdict">{aiSummary.verdict}</p>
                        {aiSummary.winner_stats && (
                          <div className="ai-winner-stats">
                            <div className="ai-winner-stat"><span>Operational</span><strong>{aiSummary.winner_stats.operational_total_kg?.toLocaleString(undefined,{maximumFractionDigits:0})} kg</strong></div>
                            <div className="ai-winner-stat"><span>Manufacturing</span><strong>{aiSummary.winner_stats.manufacturing_total_kg?.toLocaleString(undefined,{maximumFractionDigits:0})} kg</strong></div>
                            <div className="ai-winner-stat"><span>Battery Recycling</span><strong>{(aiSummary.winner_stats.recycling_kg??0)>0?`${aiSummary.winner_stats.recycling_kg.toLocaleString(undefined,{maximumFractionDigits:0})} kg`:"—"}</strong></div>
                            <div className="ai-winner-stat"><span>Rate</span><strong>{aiSummary.winner_stats.total_g_per_km} g/km</strong></div>
                          </div>
                        )}
                        {aiSummary.winner_specs && (
                          <div className="ai-winner-specs">
                            {aiSummary.winner_specs.range_km && <div className="ai-winner-spec"><span>Range</span><strong>{aiSummary.winner_specs.range_km} km</strong></div>}
                            {aiSummary.winner_specs.fuel_economy && <div className="ai-winner-spec"><span>Efficiency</span><strong>{aiSummary.winner_specs.fuel_economy}</strong></div>}
                            {aiSummary.winner_specs.manufacturer_url && <a href={aiSummary.winner_specs.manufacturer_url} target="_blank" rel="noopener noreferrer" className="ai-winner-mfr-link">View on manufacturer site →</a>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ai-reasons">
                      <h4>Why this vehicle wins</h4>
                      <ul className="ai-reasons-list">
                        {aiSummary.reasons?.map((r, i) => <li key={i}><span className="ai-reason-dot"/>{r}</li>)}
                      </ul>
                    </div>
                    <div className="ai-breakdown">
                      <h4>All vehicles compared</h4>
                      <div className="ai-breakdown-grid">
                        {aiSummary.breakdown?.map((v, i) => (
                          <div key={i} className={`ai-breakdown-card ${v.is_winner?"ai-breakdown-winner":""}`}>
                            {v.image_url && <img src={v.image_url} alt={v.name} className="ai-breakdown-img" onError={e=>{e.target.style.display="none";}}/>}
                            <div style={{ display:"flex", alignItems:"center", gap:".4rem", marginBottom:".4rem" }}>
                              <div className="ai-breakdown-name">{v.name}</div>
                              <span className="pt-pill" style={{ color:powertrainColor[v.type]||"#888", borderColor:(powertrainColor[v.type]||"#888")+"55", background:(powertrainColor[v.type]||"#888")+"18", fontSize:".65rem" }}>{v.type}</span>
                            </div>
                            <div className="ai-breakdown-stat"><span>Total CO₂</span><strong>{v.total_kg?.toLocaleString(undefined,{maximumFractionDigits:0})} kg</strong></div>
                            <div className="ai-breakdown-stat"><span>Rate</span><strong>{v.rate_g_per_km} g/km</strong></div>
                            <p className="ai-breakdown-note">{v.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="ai-disclaimer">Analysis generated by Gemini AI based on lifecycle emissions data. Real-world results may vary.</p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}