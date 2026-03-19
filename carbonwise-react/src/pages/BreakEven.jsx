import React, { useEffect, useState, useMemo, useRef } from "react";
import "../styles/break-even.css";

import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

import { Line, Bar } from "react-chartjs-2";

ChartJS.register(LineElement, BarElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const API = "http://localhost:5000";

const COUNTRIES = [
  { value: "USA", label: "United States" },
  { value: "DEU", label: "Germany" },
  { value: "FRA", label: "France" },
  { value: "GBR", label: "United Kingdom" },
  { value: "CHN", label: "China" },
  { value: "JPN", label: "Japan" },
  { value: "IND", label: "India" },
];

const POWERTRAIN_TYPES = ["EV", "HEV", "PHEV", "ICE"];

const badgeClass = t => {
  if (!t) return "";
  const m = { BEV: "bev", EV: "bev", HEV: "hev", PHEV: "phev", ICE: "ice" };
  return m[t.toUpperCase()] ?? t.toLowerCase();
};

// ── Color constants ────────────────────────────────────────────────────────────
const COLORS = {
  manufacturing: { bg: "#2196F3", border: "#1565C0", faint: "rgba(33,150,243,0.12)" },
  operational:   { bg: "#FF5252", border: "#B71C1C", faint: "rgba(255,82,82,0.12)" },
  eol:           { bg: "#FFC107", border: "#F57F17", faint: "rgba(255,193,7,0.12)" },
};

// Small inline spinner
function MiniSpinner() {
  return (
    <span style={{
      display: "inline-block", width: 16, height: 16,
      border: "2px solid rgba(0,200,83,0.2)",
      borderTopColor: "#00C853", borderRadius: "50%",
      animation: "be-spin 0.7s linear infinite",
      verticalAlign: "middle", marginRight: 6,
    }} />
  );
}

// ── Mini emissions bar chart ───────────────────────────────────────────────────
function EmissionsBarChart({ mfgGPerKm, opGPerKm, eolGPerKm = 0, label }) {
  const data = {
    labels: ["g / km breakdown"],
    datasets: [
      {
        label: "Manufacturing",
        data: [+(mfgGPerKm ?? 0).toFixed(2)],
        backgroundColor: COLORS.manufacturing.bg,
        borderColor: COLORS.manufacturing.border,
        borderWidth: 1,
        borderRadius: { topLeft: 4, bottomLeft: 4 },
        stack: "stack",
      },
      {
        label: "Operational",
        data: [+(opGPerKm ?? 0).toFixed(2)],
        backgroundColor: COLORS.operational.bg,
        borderColor: COLORS.operational.border,
        borderWidth: 1,
        stack: "stack",
      },
      {
        label: "EoL / Recycling",
        data: [+(eolGPerKm ?? 0).toFixed(2)],
        backgroundColor: COLORS.eol.bg,
        borderColor: COLORS.eol.border,
        borderWidth: 1,
        borderRadius: { topRight: 4, bottomRight: 4 },
        stack: "stack",
      },
    ],
  };

  const options = {
    indexAxis: "y",           // horizontal stacked bar
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          color: "rgba(255,255,255,0.55)",
          font: { size: 10, family: "inherit" },
          boxWidth: 10,
          padding: 8,
        },
      },
      tooltip: {
        backgroundColor: "rgba(10,10,10,0.92)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.75)",
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)} g/km`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: {
          color: "rgba(255,255,255,0.4)",
          font: { size: 10 },
          callback: v => `${v}g`,
        },
        title: {
          display: false,
        },
      },
      y: {
        stacked: true,
        display: false,
        grid: { display: false },
      },
    },
  };

  return (
    <div style={{ height: 110, marginTop: "1.25rem" }}>
      <Bar data={data} options={options} />
    </div>
  );
}

// ── Donut-style legend pills for the card header ───────────────────────────────
function ColorLegend() {
  return (
    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
      {[
        { label: "Manufacturing", color: COLORS.manufacturing.bg },
        { label: "Operational",   color: COLORS.operational.bg },
        { label: "EoL",           color: COLORS.eol.bg },
      ].map(({ label, color }) => (
        <span key={label} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: "0.7rem", color: "rgba(255,255,255,0.5)",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Selector panel ────────────────────────────────────────────────────────────
function VehicleSelector({ side, vehicles, vehiclesLoading, sel, setSel }) {
  const { powertrain, brand, model, year } = sel;

  const pool = useMemo(() => {
    if (!powertrain) return vehicles;
    if (powertrain === "EV") return vehicles.filter(v =>
      ["EV", "BEV"].includes((v.vehicle_type || "").toUpperCase())
    );
    return vehicles.filter(v =>
      (v.vehicle_type || "").toUpperCase() === powertrain
    );
  }, [powertrain, vehicles]);

  const brands = useMemo(() =>
    [...new Set(pool.map(v => v.brand).filter(Boolean))].sort(),
    [pool]);

  const models = useMemo(() =>
    brand
      ? [...new Set(pool.filter(v => v.brand === brand).map(v => v.model).filter(Boolean))].sort()
      : [],
    [brand, pool]);

  const years = useMemo(() =>
    brand && model
      ? [...new Set(
          pool.filter(v => v.brand === brand && v.model === model)
              .map(v => v.year ?? v.Year)
              .filter(Boolean)
        )].sort((a, b) => b - a)
      : [],
    [brand, model, pool]);

  const resolved = useMemo(() =>
    brand && model && year
      ? pool.find(v =>
          v.brand === brand &&
          v.model === model &&
          String(v.year ?? v.Year) === String(year)
        ) ?? null
      : null,
    [brand, model, year, pool]);

  const prevRef = useRef(undefined);
  useEffect(() => {
    if (resolved !== prevRef.current) {
      prevRef.current = resolved;
      setSel(s => ({ ...s, resolved }));
    }
  }, [resolved, setSel]);

  const patch = obj => setSel(s => ({ ...s, ...obj }));
  const label = side === "a" ? "Vehicle A" : "Vehicle B";

  return (
    <div className="be-selector-col">
      <h4 className="be-selector-title">
        {powertrain
          ? <span className={`badge badge-${badgeClass(powertrain)}`}>{powertrain}</span>
          : <span className="badge" style={{ opacity: 0.4 }}>—</span>}
        &nbsp;{label}
      </h4>

      <div className="be-type-pills">
        {POWERTRAIN_TYPES.map(pt => (
          <button
            key={pt}
            className={`be-type-pill be-type-pill--${badgeClass(pt)} ${powertrain === pt ? "be-type-pill--active" : ""}`}
            onClick={() => patch({ powertrain: pt, brand: "", model: "", year: "", resolved: null })}
          >
            {pt}
          </button>
        ))}
        <button
          className={`be-type-pill be-type-pill--all ${!powertrain ? "be-type-pill--active" : ""}`}
          onClick={() => patch({ powertrain: "", brand: "", model: "", year: "", resolved: null })}
        >
          All
        </button>
      </div>

      <div className="filters" style={{ flexDirection: "column", gap: "0.6rem" }}>
        <div className="filter-group">
          <label>Brand</label>
          <select
            className="filter-select"
            value={brand}
            onChange={e => patch({ brand: e.target.value, model: "", year: "", resolved: null })}
          >
            <option value="">
              {vehiclesLoading ? "Loading…" : `All Brands (${brands.length})`}
            </option>
            {brands.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label>Model</label>
          <select
            className="filter-select"
            value={model}
            disabled={!brand}
            onChange={e => patch({ model: e.target.value, year: "", resolved: null })}
          >
            <option value="">Select Model</option>
            {models.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label>Year</label>
          <select
            className="filter-select"
            value={year}
            disabled={!model}
            onChange={e => patch({ year: e.target.value, resolved: null })}
          >
            <option value="">Select Year</option>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {resolved && (
        <div className="selected-vehicle mt-md">
          <h5>{resolved.brand} {resolved.model}</h5>
          <p>
            <span className={`badge badge-${badgeClass(resolved.vehicle_type)}`}>
              {resolved.vehicle_type}
            </span>
            &nbsp;{resolved.year ?? resolved.Year}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BreakEven() {
  const [vehicles,            setVehicles]            = useState([]);
  const [vehiclesLoading,     setVehiclesLoading]     = useState(true);
  const [vehiclesLoadingMore, setVehiclesLoadingMore] = useState(false);
  const [vehicleCount,        setVehicleCount]        = useState(0);
  const [search,              setSearch]              = useState("");

  const [selA, setSelA] = useState({ powertrain: "EV",  brand: "", model: "", year: "", resolved: null });
  const [selB, setSelB] = useState({ powertrain: "ICE", brand: "", model: "", year: "", resolved: null });

  const [country,       setCountry]       = useState("USA");
  const [gridYear,      setGridYear]      = useState(2023);
  const [breakEvenData, setBreakEvenData] = useState(null);
  const [calculating,   setCalculating]   = useState(false);
  const [calcError,     setCalcError]     = useState(null);

  useEffect(() => { loadVehicles(); }, []);

  async function loadVehicles() {
    setVehiclesLoading(true);
    setVehicles([]);
    try {
      const r1    = await fetch(`${API}/vehicles?page=1&limit=100`);
      const j1    = await r1.json();
      const batch1 = Array.isArray(j1) ? j1 : (j1.vehicles ?? []);
      const total  = j1.total ?? batch1.length;
      setVehicles(batch1);
      setVehicleCount(total);
      setVehiclesLoading(false);

      if (total > 100) {
        setVehiclesLoadingMore(true);
        const totalPages = Math.ceil(total / 200);
        for (let p = 2; p <= Math.min(totalPages, 20); p++) {
          const r  = await fetch(`${API}/vehicles?page=${p}&limit=200`);
          const j  = await r.json();
          const batch = Array.isArray(j) ? j : (j.vehicles ?? []);
          if (!batch.length) break;
          setVehicles(prev => {
            const keys = new Set(prev.map(v => `${v.brand}|${v.model}|${v.year ?? v.Year}`));
            const fresh = batch.filter(v => !keys.has(`${v.brand}|${v.model}|${v.year ?? v.Year}`));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
        }
      }
    } catch (err) {
      console.error("Failed to load vehicles:", err);
      setVehiclesLoading(false);
    } finally {
      setVehiclesLoadingMore(false);
    }
  }

  async function searchVehicles(query) {
    if (query.length < 2) { loadVehicles(); return; }
    try {
      setVehiclesLoading(true);
      const res  = await fetch(`${API}/vehicle-search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setVehiclesLoading(false);
    }
  }

  const vA = selA.resolved;
  const vB = selB.resolved;

  async function handleCalculate() {
    if (!vA || !vB) return;
    setCalculating(true);
    setCalcError(null);
    setBreakEvenData(null);
    try {
      const res = await fetch(`${API}/break-even`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_a: { brand: vA.brand, model: vA.model, year: vA.year ?? vA.Year },
          vehicle_b: { brand: vB.brand, model: vB.model, year: vB.year ?? vB.Year },
          country,
          grid_year: gridYear,
        })
      });
      const data = await res.json();
      if (data.error) setCalcError(data.error);
      else            setBreakEvenData(data);
    } catch {
      setCalcError("Failed to calculate break-even. Please try again.");
    } finally {
      setCalculating(false);
    }
  }

  // ── Line chart ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!breakEvenData) return null;
    const bkm = breakEvenData.break_even_km;
    if (!bkm || bkm <= 0) return null;

    const maxKm = Math.max(bkm * 2, 300_000);
    const N = 60, step = maxKm / N;
    const labels = [], aPts = [], bPts = [];
    const mA = breakEvenData.a_manufacturing_total_kg;
    const mB = breakEvenData.b_manufacturing_total_kg;

    for (let i = 0; i <= N; i++) {
      const km = i * step;
      labels.push((km / 1000).toFixed(0));
      aPts.push(+(mA + breakEvenData.a_operational_g_per_km * km / 1000).toFixed(1));
      bPts.push(+(mB + breakEvenData.b_operational_g_per_km * km / 1000).toFixed(1));
    }

    const bIdx = Math.round((bkm / maxKm) * N);
    const bY   = +(mA + breakEvenData.a_operational_g_per_km * bkm / 1000).toFixed(1);
    const bkPts = labels.map((_, i) => (i === bIdx ? bY : null));

    const aIsLower = breakEvenData.a_operational_g_per_km <= breakEvenData.b_operational_g_per_km;
    const colA = aIsLower ? "#00C853" : "#FF5252";
    const colB = aIsLower ? "#FF5252" : "#00C853";
    const aLabel = `${breakEvenData.a_brand} ${breakEvenData.a_model} (${breakEvenData.a_vehicle_type})`;
    const bLabel = `${breakEvenData.b_brand} ${breakEvenData.b_model} (${breakEvenData.b_vehicle_type})`;

    return {
      labels,
      datasets: [
        {
          label: aLabel, data: aPts, borderColor: colA,
          backgroundColor: colA === "#00C853" ? "rgba(0,200,83,0.08)" : "rgba(255,82,82,0.08)",
          borderWidth: 2, tension: 0.3, fill: true, pointRadius: 0, pointHoverRadius: 4,
        },
        {
          label: bLabel, data: bPts, borderColor: colB,
          backgroundColor: colB === "#00C853" ? "rgba(0,200,83,0.08)" : "rgba(255,82,82,0.08)",
          borderWidth: 2, tension: 0.3, fill: true, pointRadius: 0, pointHoverRadius: 4,
        },
        {
          label: "Break-Even Point", data: bkPts, showLine: false,
          pointRadius: labels.map((_, i) => i === bIdx ? 9 : 0),
          pointHoverRadius: 11,
          pointBackgroundColor: "#FFD700", pointBorderColor: "#FFA000", pointBorderWidth: 2,
          borderColor: "transparent", backgroundColor: "transparent",
        },
      ],
    };
  }, [breakEvenData]);

  const chartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        filter: item => item.parsed.y !== null,
        callbacks: {
          title:  items => `${items[0].label}k km`,
          label:  ctx => {
            if (ctx.datasetIndex === 2)
              return `Break-Even ≈ ${breakEvenData?.break_even_km?.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
            return `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂`;
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 8 }, title: { display: true, text: "Distance (1 000 km)" } },
      y: { beginAtZero: true, title: { display: true, text: "Cumulative CO₂ (kg)" } },
    }
  }), [breakEvenData]);

  const fmtKg  = v => v == null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " kg";
  const fmtGkm = v => v == null ? "—" : v.toFixed(1) + " g/km";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container">
      <style>{`@keyframes be-spin { to { transform: rotate(360deg); } }`}</style>

      <h1 className="text-center mb-lg">Lifecycle Break-Even Analysis</h1>
      <p className="text-center mb-lg" style={{ color: "var(--color-text-secondary)" }}>
        Compare any two powertrains — find where their cumulative lifecycle emissions cross
      </p>

      {/* ── Vehicle picker ── */}
      <section className="card mb-lg">
        <h3 className="mb-md">
          Select Vehicles to Compare
          {vehiclesLoading && <><MiniSpinner /><span style={{ fontSize: "0.8rem", opacity: 0.5 }}> loading vehicles…</span></>}
          {!vehiclesLoading && vehiclesLoadingMore && (
            <span style={{ fontSize: "0.78rem", opacity: 0.4, marginLeft: 8 }}>
              <MiniSpinner /> loading more…
            </span>
          )}
          {!vehiclesLoading && !vehiclesLoadingMore && vehicles.length > 0 && (
            <span style={{ fontSize: "0.75rem", opacity: 0.35, marginLeft: 8 }}>
              {vehicles.length.toLocaleString()} vehicles
            </span>
          )}
        </h3>

        <div className="search-bar-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search brand or model…"
            value={search}
            className="search-bar-input"
            onChange={e => { setSearch(e.target.value); searchVehicles(e.target.value); }}
          />
          {search && (
            <button className="search-clear-btn" onClick={() => { setSearch(""); loadVehicles(); }} aria-label="Clear search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="be-selectors mt-md">
          <VehicleSelector side="a" vehicles={vehicles} vehiclesLoading={vehiclesLoading} sel={selA} setSel={setSelA} />
          <div className="be-vs-divider">VS</div>
          <VehicleSelector side="b" vehicles={vehicles} vehiclesLoading={vehiclesLoading} sel={selB} setSel={setSelB} />
        </div>
      </section>

      {/* ── Params ── */}
      <section className="card mb-lg">
        <h3 className="mb-md">Analysis Parameters</h3>
        <div className="filters">
          <div className="filter-group">
            <label>Country / Grid</label>
            <select className="filter-select" value={country} onChange={e => setCountry(e.target.value)}>
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Grid Year</label>
            <select className="filter-select" value={gridYear} onChange={e => setGridYear(Number(e.target.value))}>
              {[2020, 2021, 2022, 2023, 2024].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="filter-group" style={{ alignSelf: "flex-end" }}>
            <button
              className="ai-generate-btn"
              onClick={handleCalculate}
              disabled={!vA || !vB || calculating}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {calculating ? <><MiniSpinner />Calculating…</> : "Calculate Break-Even"}
            </button>
          </div>
        </div>
        {calcError && (
          <p style={{ color: "#FF5252", marginTop: "1rem", fontSize: "0.875rem" }}>⚠️ {calcError}</p>
        )}
      </section>

      {/* ── Results ── */}
      {breakEvenData && !calculating && (() => {
        const bkm   = breakEvenData.break_even_km;
        const hasBkm = bkm != null && bkm > 0;
        const aName  = `${breakEvenData.a_brand} ${breakEvenData.a_model}`;
        const bName  = `${breakEvenData.b_brand} ${breakEvenData.b_model}`;
        const aWins  = breakEvenData.a_operational_g_per_km <= breakEvenData.b_operational_g_per_km;

        return (
          <section className="charts-section">
            {/* Hero */}
            <div className="card mb-lg" style={{ textAlign: "center" }}>
              <h3 className="mb-md">Break-Even Point</h3>
              <div className="break-even-display">
                <div className="break-even-value">
                  <span className="big-number">
                    {hasBkm
                      ? bkm.toLocaleString(undefined, { maximumFractionDigits: 0 })
                      : bkm === 0 ? "0" : "—"}
                  </span>
                  <span className="unit">km</span>
                </div>
                <p style={{ marginTop: "1rem", color: "var(--color-text-secondary)", maxWidth: 560, margin: "1rem auto 0" }}>
                  {breakEvenData.message
                    ? breakEvenData.message
                    : hasBkm
                      ? <>After <strong>{bkm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</strong> {aWins ? aName : bName} has lower total lifecycle emissions. At 15 000 km/year that is approximately <strong>{(bkm / 15000).toFixed(1)} years</strong>.</>
                      : `${aWins ? aName : bName} has lower emissions from the very start — no break-even needed.`}
                </p>
              </div>
            </div>

            {/* Line chart */}
            <div className="chart-container">
              <h3>Cumulative Lifecycle Emissions</h3>
              {hasBkm && chartData ? (
                <div style={{ position: "relative", height: "300px" }}>
                  <Line data={chartData} options={chartOptions} />
                </div>
              ) : (
                <p style={{ color: "var(--color-text-secondary)", padding: "2rem 0" }}>
                  No operational advantage — the lines never cross on this grid.
                </p>
              )}
            </div>

            {/* ── Comparison cards with embedded bar charts ── */}
            <div className="grid grid-2">
              {[
                { key: "a", name: aName },
                { key: "b", name: bName },
              ].map(({ key, name }) => {
                const pt        = breakEvenData[`${key}_vehicle_type`];
                const mfgGPerKm = breakEvenData[`${key}_manufacturing_g_per_km`];
                const opGPerKm  = breakEvenData[`${key}_operational_g_per_km`];
                // EoL g/km — use if backend sends it, else 0
                const eolGPerKm = breakEvenData[`${key}_recycling_g_per_km`] ?? 0;

                return (
                  <div key={key} className="card comparison-card">
                    {/* Card header */}
                    <h4>{name}</h4>
                    <p style={{ marginBottom: "0.75rem" }}>
                      <span className={`badge badge-${badgeClass(pt)}`}>{pt}</span>
                      &nbsp;{breakEvenData[`${key}_year`]}
                    </p>

                    {/* ── Stats ── */}
                    <div className="mt-md">
                      <div className="emission-value">
                        <span className="emission-label">Manufacturing (lifetime total)</span>
                        <span className="emission-number"
                          style={{ color: COLORS.manufacturing.bg }}>
                          {fmtKg(breakEvenData[`${key}_manufacturing_total_kg`])}
                        </span>
                      </div>
                      <div className="emission-value">
                        <span className="emission-label">Operational rate</span>
                        <span className="emission-number"
                          style={{ color: COLORS.operational.bg }}>
                          {fmtGkm(opGPerKm)}
                        </span>
                      </div>
                      <div className="emission-value">
                        <span className="emission-label">Manufacturing rate</span>
                        <span className="emission-number"
                          style={{ color: COLORS.manufacturing.bg }}>
                          {fmtGkm(mfgGPerKm)}
                        </span>
                      </div>
                      {eolGPerKm > 0 && (
                        <div className="emission-value">
                          <span className="emission-label">EoL / Recycling rate</span>
                          <span className="emission-number"
                            style={{ color: COLORS.eol.bg }}>
                            {fmtGkm(eolGPerKm)}
                          </span>
                        </div>
                      )}
                      <div className="emission-value emission-value--total">
                        <span className="emission-label">Total lifecycle rate</span>
                        <span className="emission-number emission-number--total">
                          {fmtGkm(breakEvenData[`${key}_total_g_per_km`])}
                        </span>
                      </div>
                    </div>

                    {/* ── Divider ── */}
                    <div style={{
                      margin: "1.1rem 0 0.4rem",
                      borderTop: "1px solid rgba(255,255,255,0.07)",
                    }} />

                    {/* ── Emissions breakdown bar chart ── */}
                    <p style={{
                      fontSize: "0.72rem",
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      margin: "0 0 0.2rem",
                    }}>
                      Emissions breakdown (g / km)
                    </p>
                    <EmissionsBarChart
                      mfgGPerKm={mfgGPerKm}
                      opGPerKm={opGPerKm}
                      eolGPerKm={eolGPerKm}
                      label={name}
                    />
                  </div>
                );
              })}
            </div>

            {/* Summary footer */}
            {hasBkm && (
              <div className="card mt-lg" style={{ textAlign: "center", padding: "1.5rem" }}>
                <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
                  {aWins ? aName : bName} saves{" "}
                  <strong style={{ color: "var(--color-eco-green)" }}>
                    {fmtGkm(Math.abs(breakEvenData.operational_advantage_g_per_km))}
                  </strong>{" "}
                  per km operationally. Its manufacturing carbon premium of{" "}
                  <strong>{fmtKg(Math.abs((breakEvenData.a_manufacturing_total_kg ?? 0) - (breakEvenData.b_manufacturing_total_kg ?? 0)))}</strong>{" "}
                  is repaid after{" "}
                  <strong>{bkm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</strong>.
                </p>
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
}