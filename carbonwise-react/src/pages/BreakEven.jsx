import React, { useEffect, useState, useMemo, useRef } from "react";
import "../styles/break-even.css";

import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const API = "http://localhost:5000";

const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "UK", label: "United Kingdom" },
  { value: "CN", label: "China" },
  { value: "JP", label: "Japan" },
  { value: "IN", label: "India" },
];

// All powertrain types — matches engine.py
const POWERTRAIN_TYPES = ["EV", "BEV", "HEV", "PHEV", "ICE"];

// Badge CSS class per type
const badgeClass = t => {
  if (!t) return "";
  const m = { BEV: "bev", EV: "bev", HEV: "hev", PHEV: "phev", ICE: "ice" };
  return m[t.toUpperCase()] ?? t.toLowerCase();
};

// ── Selector panel — pure/stateless, parent owns all state ──────────────────
function VehicleSelector({ side, vehicles, vehiclesLoading, sel, setSel }) {
  const { powertrain, brand, model, year } = sel;

  const pool = useMemo(() => {
    if (!powertrain) return vehicles;
    if (powertrain === "EV") return vehicles.filter(v => v.vehicle_type === "EV" || v.vehicle_type === "BEV");
    return vehicles.filter(v => v.vehicle_type === powertrain);
  }, [powertrain, vehicles]);

  const brands = useMemo(() => [...new Set(pool.map(v => v.brand))].sort(), [pool]);

  const models = useMemo(() =>
    brand ? [...new Set(pool.filter(v => v.brand === brand).map(v => v.model))].sort() : [],
    [brand, pool]);

  const years = useMemo(() =>
    (brand && model)
      ? [...new Set(pool.filter(v => v.brand === brand && v.model === model).map(v => v.year))].sort((a, b) => b - a)
      : [],
    [brand, model, pool]);

  // Resolved vehicle — computed here, stored in parent via setSel
  const resolved = useMemo(() =>
    (brand && model && year)
      ? pool.find(v => v.brand === brand && v.model === model && String(v.year) === String(year)) ?? null
      : null,
    [brand, model, year, pool]);

  // Keep parent in sync — only when resolved actually changes
  const prevRef = useRef(undefined);
  useEffect(() => {
    if (resolved !== prevRef.current) {
      prevRef.current = resolved;
      setSel(s => ({ ...s, resolved }));
    }
  }, [resolved, setSel]);

  // Patch helper — always uses functional setSel to avoid stale closure
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

      {/* Powertrain type pills */}
      <div className="be-type-pills mb-md">
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
            <option value="">All Brands</option>
            {vehiclesLoading
              ? <option disabled>Loading…</option>
              : brands.map(b => <option key={b}>{b}</option>)}
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
            &nbsp;{resolved.year}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BreakEven() {

  // Vehicle list — same paginated loading as Compare
  const [vehicles,            setVehicles]            = useState([]);
  const [vehiclesLoading,     setVehiclesLoading]     = useState(true);
  const [vehiclesLoadingMore, setVehiclesLoadingMore] = useState(false);
  const [search,              setSearch]              = useState("");

  // Vehicle A and B selection state
  const [selA, setSelA] = useState({ powertrain: "EV",  brand: "", model: "", year: "", resolved: null });
  const [selB, setSelB] = useState({ powertrain: "ICE", brand: "", model: "", year: "", resolved: null });

  // Params / results
  const [country,       setCountry]       = useState("US");
  const [gridYear,      setGridYear]      = useState(2023);
  const [breakEvenData, setBreakEvenData] = useState(null);
  const [calculating,   setCalculating]   = useState(false);
  const [calcError,     setCalcError]     = useState(null);

  // ── Load vehicles ────────────────────────────────────────────────────────
  // Phase 1 (instant):     4 parallel requests — 50 of each type → UI ready
  // Phase 2 (background):  stream remaining pages per type, merging as they land
  useEffect(() => { loadVehicles(); }, []);

  async function loadVehicles() {
    setVehiclesLoading(true);
    setVehicles([]);

    const TYPES    = ["EV", "HEV", "PHEV", "ICE"];
    const FIRST_N  = 50;   // per type shown immediately
    const BG_LIMIT = 200;  // page size for background pages

    // ── Dedup helper ────────────────────────────────────────────────────────
    const key = v => `${v.brand}|${v.model}|${v.year}`;

    try {
      // ── Phase 1: 4 requests fired simultaneously ──────────────────────────
      const phase1 = await Promise.all(
        TYPES.map(t =>
          fetch(`${API}/vehicles?page=1&limit=${FIRST_N}&vehicle_type=${t}`)
            .then(r => r.json())
            .then(j => ({
              batch:      Array.isArray(j) ? j : (j.vehicles ?? []),
              total:      j.total      ?? 0,
              totalPages: Math.ceil((j.total ?? 0) / BG_LIMIT),
              type:       t,
            }))
        )
      );

      // Merge initial batches, deduplicate (EV/BEV may overlap)
      const seen    = new Set();
      const initial = [];
      for (const { batch } of phase1) {
        for (const v of batch) {
          const k = key(v);
          if (!seen.has(k)) { seen.add(k); initial.push(v); }
        }
      }
      setVehicles(initial);
      setVehiclesLoading(false);

      // ── Phase 2: background pages, type by type, page by page ─────────────
      const needsMore = phase1.some(({ total }) => total > FIRST_N);
      if (!needsMore) return;

      setVehiclesLoadingMore(true);

      for (const { type, total } of phase1) {
        if (total <= FIRST_N) continue;

        // Pages 2, 3, … at BG_LIMIT each (page 1 already covered FIRST_N rows)
        const bgPages = Math.ceil((total - FIRST_N) / BG_LIMIT);

        for (let p = 0; p < bgPages; p++) {
          const res  = await fetch(
            `${API}/vehicles?page=${p + 2}&limit=${BG_LIMIT}&vehicle_type=${type}`
          );
          const json = await res.json();
          const batch = Array.isArray(json) ? json : (json.vehicles ?? []);

          setVehicles(prev => {
            const existingKeys = new Set(prev.map(key));
            const fresh = batch.filter(v => !existingKeys.has(key(v)));
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
    setVehiclesLoading(true);
    const res  = await fetch(`${API}/vehicle-search?q=${query}`);
    const data = await res.json();
    setVehicles(data);
    setVehiclesLoading(false);
  }

  // ── Calculate ────────────────────────────────────────────────────────────
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
          vehicle_a: { brand: vA.brand, model: vA.model, year: vA.year },
          vehicle_b: { brand: vB.brand, model: vB.model, year: vB.year },
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

  // ── Chart data ───────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!breakEvenData) return null;
    const bkm = breakEvenData.break_even_km;
    if (!bkm || bkm <= 0) return null;

    const maxKm = Math.max(bkm * 2, 300_000);
    const N     = 60;
    const step  = maxKm / N;
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

    const aLabel = `${breakEvenData.a_brand} ${breakEvenData.a_model} (${breakEvenData.a_vehicle_type})`;
    const bLabel = `${breakEvenData.b_brand} ${breakEvenData.b_model} (${breakEvenData.b_vehicle_type})`;

    // Colour Vehicle A green (lower operational), B red
    const aIsLower = breakEvenData.a_operational_g_per_km <= breakEvenData.b_operational_g_per_km;
    const colA = aIsLower ? "#00C853" : "#FF5252";
    const colB = aIsLower ? "#FF5252" : "#00C853";

    return {
      labels,
      datasets: [
        {
          label: aLabel,
          data: aPts,
          borderColor: colA,
          backgroundColor: colA === "#00C853" ? "rgba(0,200,83,0.08)" : "rgba(255,82,82,0.08)",
          borderWidth: 2, tension: 0.3, fill: true, pointRadius: 0, pointHoverRadius: 4,
        },
        {
          label: bLabel,
          data: bPts,
          borderColor: colB,
          backgroundColor: colB === "#00C853" ? "rgba(0,200,83,0.08)" : "rgba(255,82,82,0.08)",
          borderWidth: 2, tension: 0.3, fill: true, pointRadius: 0, pointHoverRadius: 4,
        },
        {
          label: "Break-Even Point",
          data: bkPts,
          showLine: false,
          pointRadius: labels.map((_, i) => (i === bIdx ? 9 : 0)),
          pointHoverRadius: 11,
          pointBackgroundColor: "#FFD700",
          pointBorderColor: "#FFA000",
          pointBorderWidth: 2,
          borderColor: "transparent",
          backgroundColor: "transparent",
        },
      ],
    };
  }, [breakEvenData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        filter: item => item.parsed.y !== null,
        callbacks: {
          title:  items => `${items[0].label}k km`,
          label:  ctx   => {
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

  // ── Skeletons — same as Compare ──────────────────────────────────────────
  function SkeletonChart() {
    return (
      <div className="chart-container">
        <div className="skeleton skeleton-chart-title" />
        <div className="skeleton skeleton-chart" style={{ height: 300 }} />
      </div>
    );
  }

  const fmtKg  = v => v == null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " kg";
  const fmtGkm = v => v == null ? "—" : v.toFixed(1) + " g/km";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="container">

      <h1 className="text-center mb-lg">Lifecycle Break-Even Analysis</h1>
      <p className="text-center mb-lg" style={{ color: "var(--color-text-secondary)" }}>
        Compare any two powertrains — find where their cumulative lifecycle emissions cross
      </p>

      {/* ── VEHICLE PICKER ── */}
      <section className="card mb-lg">
        <h3 className="mb-md">Select Vehicles to Compare</h3>

        {/* Search bar — identical to Compare */}
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
          <VehicleSelector
            side="a"
            vehicles={vehicles}
            vehiclesLoading={vehiclesLoading}
            sel={selA}
            setSel={setSelA}
          />

          <div className="be-vs-divider">VS</div>

          <VehicleSelector
            side="b"
            vehicles={vehicles}
            vehiclesLoading={vehiclesLoading}
            sel={selB}
            setSel={setSelB}
          />
        </div>

        {vehiclesLoadingMore && (
          <div className="vehicles-loading-more">
            <div className="vehicles-loading-bar" />
            <span>Loading more vehicles…</span>
          </div>
        )}
      </section>

      {/* ── PARAMS + CALCULATE ── */}
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
              {calculating ? "Calculating…" : "Calculate Break-Even"}
            </button>
          </div>
        </div>
        {calcError && (
          <p style={{ color: "#FF5252", marginTop: "1rem", fontSize: "0.875rem" }}>⚠️ {calcError}</p>
        )}
      </section>

      {/* ── RESULTS ── */}
      {calculating && (
        <section className="charts-section">
          <SkeletonChart />
        </section>
      )}

      {breakEvenData && !calculating && (() => {
        const bkm    = breakEvenData.break_even_km;
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
                    {hasBkm ? bkm.toLocaleString(undefined, { maximumFractionDigits: 0 }) : bkm === 0 ? "0" : "—"}
                  </span>
                  <span className="unit">km</span>
                </div>
                <p style={{ marginTop: "1rem", color: "var(--color-text-secondary)", maxWidth: 560, margin: "1rem auto 0" }}>
                  {breakEvenData.message
                    ? breakEvenData.message
                    : hasBkm
                      ? <>
                          After{" "}
                          <strong>{bkm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</strong>{" "}
                          {aWins ? aName : bName} has lower total lifecycle emissions.
                          At 15 000 km/year that is approximately{" "}
                          <strong>{(bkm / 15000).toFixed(1)} years</strong>.
                        </>
                      : `${aWins ? aName : bName} has lower emissions from the very start — no break-even needed!`}
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
                  {bkm === 0
                    ? `${aWins ? aName : bName} leads in both manufacturing and operational emissions — no crossover to plot.`
                    : "No operational advantage — the lines never cross on this grid."}
                </p>
              )}
            </div>

            {/* Comparison cards — same style as Compare */}
            <div className="grid grid-2">
              {[
                { key: "a", name: aName, v: vA },
                { key: "b", name: bName, v: vB },
              ].map(({ key, name, v }) => {
                const pt = breakEvenData[`${key}_vehicle_type`];
                return (
                  <div key={key} className="card comparison-card">
                    <h4>{name}</h4>
                    <p style={{ marginBottom: "1rem" }}>
                      <span className={`badge badge-${badgeClass(pt)}`}>{pt}</span>
                      &nbsp;{breakEvenData[`${key}_year`]}
                    </p>
                    <div className="mt-md">
                      <div className="emission-value">
                        <span className="emission-label">Manufacturing (fixed, lifetime)</span>
                        <span className="emission-number">{fmtKg(breakEvenData[`${key}_manufacturing_total_kg`])} CO₂</span>
                      </div>
                      <div className="emission-value">
                        <span className="emission-label">Operational rate</span>
                        <span className="emission-number">{fmtGkm(breakEvenData[`${key}_operational_g_per_km`])}</span>
                      </div>
                      <div className="emission-value">
                        <span className="emission-label">Manufacturing rate</span>
                        <span className="emission-number">{fmtGkm(breakEvenData[`${key}_manufacturing_g_per_km`])}</span>
                      </div>
                      <div className="emission-value emission-value--total">
                        <span className="emission-label">Total lifecycle rate</span>
                        <span className="emission-number emission-number--total">
                          {fmtGkm(breakEvenData[`${key}_total_g_per_km`])}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary sentence */}
            {hasBkm && (
              <div className="card mt-lg" style={{ textAlign: "center", padding: "1.5rem" }}>
                <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
                  {aWins ? aName : bName} saves{" "}
                  <strong style={{ color: "var(--color-eco-green)" }}>
                    {fmtGkm(Math.abs(breakEvenData.operational_advantage_g_per_km))}
                  </strong>{" "}
                  per km operationally. Its manufacturing carbon premium of{" "}
                  <strong>
                    {fmtKg(Math.abs(
                      (breakEvenData.a_manufacturing_total_kg ?? 0) -
                      (breakEvenData.b_manufacturing_total_kg ?? 0)
                    ))}
                  </strong>{" "}
                  CO₂ is repaid after{" "}
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