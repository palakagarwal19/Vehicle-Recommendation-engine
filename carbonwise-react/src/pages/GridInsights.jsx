import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import apiClient from '../services/api';
import '../styles/grid.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const COUNTRY_MAP = {
  US: { code: "USA", label: "United States", flag: "🇺🇸" },
  DE: { code: "DEU", label: "Germany",       flag: "🇩🇪" },
  FR: { code: "FRA", label: "France",         flag: "🇫🇷" },
  UK: { code: "GBR", label: "United Kingdom", flag: "🇬🇧" },
  CN: { code: "CHN", label: "China",          flag: "🇨🇳" },
  JP: { code: "JPN", label: "Japan",          flag: "🇯🇵" },
  IN: { code: "IND", label: "India",          flag: "🇮🇳" },
  CA: { code: "CAN", label: "Canada",         flag: "🇨🇦" },
  AU: { code: "AUS", label: "Australia",      flag: "🇦🇺" },
  BR: { code: "BRA", label: "Brazil",         flag: "🇧🇷" },
};

// Intensity thresholds (g CO₂/kWh)
function getIntensityTier(val) {
  if (val === null || val === undefined) return { label: "No data",  color: "#555",    bg: "rgba(85,85,85,0.12)" };
  if (val < 100)  return { label: "Very clean", color: "#00E676", bg: "rgba(0,230,118,0.10)" };
  if (val < 250)  return { label: "Clean",      color: "#69F0AE", bg: "rgba(105,240,174,0.10)" };
  if (val < 400)  return { label: "Moderate",   color: "#FFD740", bg: "rgba(255,215,64,0.10)" };
  if (val < 600)  return { label: "Intensive",  color: "#FF6D00", bg: "rgba(255,109,0,0.10)" };
  return           { label: "Very intensive", color: "#FF1744", bg: "rgba(255,23,68,0.10)" };
}

function getTrend(data) {
  const valid = data.filter(v => v !== null && v !== undefined);
  if (valid.length < 2) return null;
  const delta = valid[valid.length - 1] - valid[0];
  const pct   = ((delta / valid[0]) * 100).toFixed(1);
  return { delta: Math.round(delta), pct, improving: delta < 0 };
}

function Sparkline({ values, color }) {
  const ref = useRef(null);
  const valid = (values || []).map(v => v ?? null);
  const data = {
    labels: valid.map((_, i) => i),
    datasets: [{
      data: valid, borderColor: color, borderWidth: 1.5,
      pointRadius: 0, tension: 0.4, fill: false, spanGaps: true
    }]
  };
  const opts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } }
  };
  return (
    <div style={{ height: 36, width: 80 }}>
      <Line ref={ref} data={data} options={opts} />
    </div>
  );
}

export default function GridInsights() {
  const [gridData,       setGridData]       = useState({});
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [showForecast,   setShowForecast]   = useState(false);
  const [showTD,         setShowTD]         = useState(true);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  useEffect(() => { fetchGrid(); }, []);

  async function fetchGrid() {
    try {
      setLoading(true); setError(null);
      // /grid returns { "USA": { "2015": { raw, corrected }, ... }, ... }
      const data = await apiClient.getGridData();
      setGridData(data);
    } catch (err) {
      setError(err.message || 'Failed to load grid data.');
    } finally {
      setLoading(false);
    }
  }

  // ── Derive data for selected country ──────────────────────────────────────
  const countryCode3 = COUNTRY_MAP[selectedCountry]?.code ?? selectedCountry;
  const rawCountryData = gridData[countryCode3] ?? {};
  const sortedYears = Object.keys(rawCountryData).map(Number).sort((a, b) => a - b);

  const genSeries  = sortedYears.map(y => rawCountryData[y]?.raw      ?? null);
  const plugSeries = sortedYears.map(y => rawCountryData[y]?.corrected ?? null);
  const tdSeries   = sortedYears.map((y, i) => {
    const r = rawCountryData[y]?.raw;
    const c = rawCountryData[y]?.corrected;
    return (r && c && r > 0) ? parseFloat(((c - r) / r * 100).toFixed(2)) : null;
  });

  const latestYear = sortedYears[sortedYears.length - 1];
  const latestGen  = rawCountryData[latestYear]?.raw      ?? null;
  const latestPlug = rawCountryData[latestYear]?.corrected ?? null;
  const latestTD   = (latestGen && latestPlug && latestGen > 0)
    ? ((latestPlug - latestGen) / latestGen * 100).toFixed(1)
    : null;

  const genTier  = getIntensityTier(latestPlug ?? latestGen);
  const genTrend = getTrend(plugSeries.filter(v => v !== null).length > 1 ? plugSeries : genSeries);

  // ── Build chart data ──────────────────────────────────────────────────────
  let chartLabels  = [...sortedYears];
  let chartGen     = [...genSeries];
  let chartPlug    = [...plugSeries];

  if (showForecast && sortedYears.length > 1) {
    const n = sortedYears.length;
    const validGen  = genSeries.filter(v => v !== null);
    const validPlug = plugSeries.filter(v => v !== null);
    const gTrend = validGen.length  > 1 ? (validGen[validGen.length-1]   - validGen[0])   / (validGen.length  - 1) : 0;
    const pTrend = validPlug.length > 1 ? (validPlug[validPlug.length-1] - validPlug[0])  / (validPlug.length - 1) : 0;
    const lastG = genSeries[genSeries.length - 1] ?? 0;
    const lastP = plugSeries[plugSeries.length - 1] ?? 0;
    for (let i = 1; i <= 5; i++) {
      chartLabels.push(latestYear + i);
      chartGen.push(Math.max(0, lastG + gTrend * i));
      chartPlug.push(Math.max(0, lastP + pTrend * i));
    }
  }

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Generation Intensity',
        data: chartGen,
        borderColor: '#00C853',
        backgroundColor: 'rgba(0,200,83,0.08)',
        tension: 0.4, fill: true, borderWidth: 2,
        pointRadius: 3, pointBackgroundColor: '#00C853',
        spanGaps: true,
        borderDash: showForecast ? undefined : undefined,
        segment: showForecast ? {
          borderDash: ctx => ctx.p0DataIndex >= sortedYears.length - 1 ? [5, 4] : undefined,
          borderColor: ctx => ctx.p0DataIndex >= sortedYears.length - 1 ? 'rgba(0,200,83,0.45)' : '#00C853',
        } : undefined,
      },
      ...(showTD && plugSeries.some(v => v !== null) ? [{
        label: 'Plug-Adjusted (with T&D loss)',
        data: chartPlug,
        borderColor: '#69F0AE',
        backgroundColor: 'rgba(105,240,174,0.05)',
        tension: 0.4, fill: true, borderWidth: 2,
        pointRadius: 3, pointBackgroundColor: '#69F0AE',
        spanGaps: true,
        segment: showForecast ? {
          borderDash: ctx => ctx.p0DataIndex >= sortedYears.length - 1 ? [5, 4] : undefined,
          borderColor: ctx => ctx.p0DataIndex >= sortedYears.length - 1 ? 'rgba(105,240,174,0.4)' : '#69F0AE',
        } : undefined,
      }] : [])
    ]
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#B0B0B0', font: { size: 12 }, boxWidth: 14, padding: 20 }
      },
      tooltip: {
        backgroundColor: 'rgba(18,24,20,0.92)',
        borderColor: 'rgba(0,200,83,0.3)', borderWidth: 1,
        padding: 12,
        callbacks: {
          title: ctx => `Year ${ctx[0].label}${showForecast && ctx[0].dataIndex >= sortedYears.length ? ' (forecast)' : ''}`,
          label: ctx => {
            if (ctx.parsed.y === null) return `${ctx.dataset.label}: No data`;
            return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} g CO₂/kWh`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#7a8a80', font: { size: 11 } },
        border: { color: 'rgba(255,255,255,0.05)' }
      },
      y: {
        beginAtZero: false,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#7a8a80', font: { size: 11 },
          callback: v => `${v} g` },
        title: { display: true, text: 'g CO₂/kWh', color: '#5a6a60', font: { size: 11 } },
        border: { color: 'rgba(255,255,255,0.05)' }
      }
    }
  };

  // ── Cross-country comparison (latest year per country) ────────────────────
  const comparisonRows = Object.entries(COUNTRY_MAP).map(([key, meta]) => {
    const cd = gridData[meta.code] ?? {};
    const yrs = Object.keys(cd).map(Number).sort((a, b) => a - b);
    if (!yrs.length) return null;
    const ly  = yrs[yrs.length - 1];
    const val = cd[ly]?.corrected ?? cd[ly]?.raw ?? null;
    const sparkVals = yrs.map(y => cd[y]?.corrected ?? cd[y]?.raw ?? null);
    const tier = getIntensityTier(val);
    const trend = getTrend(sparkVals);
    return { key, ...meta, value: val, year: ly, tier, trend, sparkVals };
  }).filter(Boolean).sort((a, b) => (a.value ?? 9999) - (b.value ?? 9999));

  // ── YoY change for current country ───────────────────────────────────────
  const prevYear    = sortedYears[sortedYears.length - 2];
  const prevPlug    = rawCountryData[prevYear]?.corrected ?? rawCountryData[prevYear]?.raw ?? null;
  const yoyDelta    = latestPlug && prevPlug ? latestPlug - prevPlug : null;
  const yoyPct      = yoyDelta && prevPlug   ? ((yoyDelta / prevPlug) * 100).toFixed(1) : null;

  // ── EV equivalence insight ────────────────────────────────────────────────
  // At current grid: what's an EV's effective operational g/km?
  // Assume avg EV = 180 Wh/km
  const evGpkm = latestPlug ? ((180 / 1000) * latestPlug).toFixed(1) : null;

  if (loading) return (
    <div className="grid-page">
      <div className="grid-loading">
        <div className="grid-loading-spinner" />
        <span>Loading grid data…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="grid-page">
      <div className="grid-error">
        <span>⚠️ {error}</span>
        <button onClick={fetchGrid}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="grid-page">

      <div className="grid-hero">
        <h1>Grid Emissions Insights</h1>
        <p className="grid-hero-sub">Carbon intensity of electricity by country — the key variable behind EV lifecycle emissions</p>
      </div>

      {/* ── COUNTRY SELECTOR ── */}
      <div className="grid-country-bar">
        {Object.entries(COUNTRY_MAP).map(([key, meta]) => (
          <button
            key={key}
            className={`grid-country-pill ${selectedCountry === key ? 'active' : ''}`}
            onClick={() => setSelectedCountry(key)}
          >
            <span className="pill-flag">{meta.flag}</span>
            <span className="pill-label">{key}</span>
          </button>
        ))}
      </div>

      {/* ── KPI STRIP ── */}
      {latestGen !== null && (
        <div className="grid-kpi-strip">

          <div className="grid-kpi" style={{ '--kpi-accent': genTier.color }}>
            <div className="kpi-label">Plug-Adjusted Intensity</div>
            <div className="kpi-value" style={{ color: genTier.color }}>
              {latestPlug !== null ? Math.round(latestPlug) : Math.round(latestGen)}
              <span className="kpi-unit">g CO₂/kWh</span>
            </div>
            <div className="kpi-badge" style={{ background: genTier.bg, color: genTier.color }}>
              {genTier.label}
            </div>
          </div>

          <div className="grid-kpi">
            <div className="kpi-label">Generation Intensity</div>
            <div className="kpi-value">
              {Math.round(latestGen)}
              <span className="kpi-unit">g CO₂/kWh</span>
            </div>
            <div className="kpi-sub">at point of generation</div>
          </div>

          {latestTD !== null && (
            <div className="grid-kpi">
              <div className="kpi-label">T&amp;D Loss Overhead</div>
              <div className="kpi-value">
                +{latestTD}
                <span className="kpi-unit">%</span>
              </div>
              <div className="kpi-sub">transmission &amp; distribution</div>
            </div>
          )}

          {yoyDelta !== null && (
            <div className="grid-kpi">
              <div className="kpi-label">Year-on-Year Change</div>
              <div className="kpi-value" style={{ color: yoyDelta < 0 ? '#69F0AE' : '#FF7043' }}>
                {yoyDelta > 0 ? '+' : ''}{Math.round(yoyDelta)}
                <span className="kpi-unit">g/kWh</span>
              </div>
              <div className="kpi-sub" style={{ color: yoyDelta < 0 ? '#69F0AE' : '#FF7043' }}>
                {yoyDelta < 0 ? '▼' : '▲'} {Math.abs(yoyPct)}% vs {prevYear}
              </div>
            </div>
          )}

          {evGpkm !== null && (
            <div className="grid-kpi" style={{ '--kpi-accent': '#B2DFDB' }}>
              <div className="kpi-label">EV Effective Rate</div>
              <div className="kpi-value" style={{ color: '#B2DFDB' }}>
                {evGpkm}
                <span className="kpi-unit">g CO₂/km</span>
              </div>
              <div className="kpi-sub">at 180 Wh/km avg consumption</div>
            </div>
          )}

          {genTrend && (
            <div className="grid-kpi">
              <div className="kpi-label">Long-run Trend</div>
              <div className="kpi-value" style={{ color: genTrend.improving ? '#69F0AE' : '#FF7043' }}>
                {genTrend.improving ? '▼' : '▲'} {Math.abs(genTrend.pct)}
                <span className="kpi-unit">%</span>
              </div>
              <div className="kpi-sub">
                {genTrend.improving ? 'cleaner' : 'more intensive'} since {sortedYears[0]}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── MAIN CHART ── */}
      <div className="grid-chart-card">
        <div className="grid-chart-header">
          <div>
            <h2 className="grid-chart-title">
              {COUNTRY_MAP[selectedCountry]?.flag} {COUNTRY_MAP[selectedCountry]?.label} — Grid Intensity Trend
            </h2>
            <p className="grid-chart-sub">
              {latestYear && `Data through ${latestYear}`}
              {showForecast && ' · Dashed lines = 5-year linear forecast'}
            </p>
          </div>
          <div className="grid-chart-controls">
            <label className="grid-toggle">
              <input type="checkbox" checked={showTD} onChange={e => setShowTD(e.target.checked)} />
              <span className="grid-toggle-track" />
              <span className="grid-toggle-label">T&amp;D adjusted</span>
            </label>
            <label className="grid-toggle">
              <input type="checkbox" checked={showForecast} onChange={e => setShowForecast(e.target.checked)} />
              <span className="grid-toggle-track" />
              <span className="grid-toggle-label">Forecast</span>
            </label>
          </div>
        </div>

        {sortedYears.length > 0 ? (
          <div className="grid-chart-wrap">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="grid-no-data">No data available for {COUNTRY_MAP[selectedCountry]?.label}</div>
        )}
      </div>

      {/* ── INSIGHT CALLOUT ── */}
      {latestPlug !== null && evGpkm !== null && (
        <div className="grid-insight-callout">
          <div className="insight-icon">⚡</div>
          <div className="insight-body">
            <strong>What this means for EVs in {COUNTRY_MAP[selectedCountry]?.label}</strong>
            <p>
              At {Math.round(latestPlug)} g CO₂/kWh, an average EV (180 Wh/km) emits{' '}
              <span style={{ color: getIntensityTier(latestPlug).color, fontWeight: 600 }}>
                {evGpkm} g CO₂/km
              </span>{' '}
              operationally — compared to ~120 g/km for a typical petrol car.
              {genTrend?.improving
                ? ` The grid has improved ${Math.abs(genTrend.pct)}% since ${sortedYears[0]}, making EVs cleaner over time.`
                : ` The grid intensity has risen ${Math.abs(genTrend?.pct ?? 0)}% since ${sortedYears[0]} — watch for renewable expansion.`
              }
            </p>
          </div>
        </div>
      )}

      {/* ── COUNTRY COMPARISON TABLE ── */}
      <div className="grid-compare-card">
        <h2 className="grid-section-title">Country Comparison — Latest Available Year</h2>
        <div className="grid-compare-table">
          <div className="gct-head">
            <span>Country</span>
            <span>Intensity</span>
            <span className="gct-hide-sm">Rating</span>
            <span className="gct-hide-sm">Trend</span>
            <span>History</span>
          </div>
          {comparisonRows.map((row, i) => (
            <div
              key={row.key}
              className={`gct-row ${row.key === selectedCountry ? 'gct-row-active' : ''}`}
              onClick={() => setSelectedCountry(row.key)}
            >
              <span className="gct-country">
                <span className="gct-flag">{row.flag}</span>
                <span className="gct-name">{row.label}</span>
                <span className="gct-rank">#{i + 1}</span>
              </span>
              <span className="gct-val" style={{ color: row.tier.color }}>
                {row.value !== null ? `${Math.round(row.value)} g/kWh` : '—'}
              </span>
              <span className="gct-badge gct-hide-sm" style={{ background: row.tier.bg, color: row.tier.color }}>
                {row.tier.label}
              </span>
              <span className="gct-trend gct-hide-sm" style={{ color: row.trend?.improving ? '#69F0AE' : row.trend ? '#FF7043' : '#555' }}>
                {row.trend
                  ? `${row.trend.improving ? '▼' : '▲'} ${Math.abs(row.trend.pct)}%`
                  : '—'
                }
              </span>
              <span className="gct-spark">
                <Sparkline values={row.sparkVals} color={row.tier.color} />
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}