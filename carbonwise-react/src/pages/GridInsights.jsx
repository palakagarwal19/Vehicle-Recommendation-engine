import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import apiClient from '../services/api';
import '../styles/grid.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// ── Intensity tiers ────────────────────────────────────────────────────────────
function getTier(val) {
  if (val == null)  return { label: 'No data',        color: '#555',    bg: 'rgba(85,85,85,0.12)' };
  if (val < 100)    return { label: 'Very clean',     color: '#00E676', bg: 'rgba(0,230,118,0.10)' };
  if (val < 250)    return { label: 'Clean',          color: '#69F0AE', bg: 'rgba(105,240,174,0.10)' };
  if (val < 400)    return { label: 'Moderate',       color: '#FFD740', bg: 'rgba(255,215,64,0.10)' };
  if (val < 600)    return { label: 'Carbon intensive',color: '#FF6D00', bg: 'rgba(255,109,0,0.10)' };
  return                   { label: 'Very intensive', color: '#FF1744', bg: 'rgba(255,23,68,0.10)' };
}

function getLongTrend(series) {
  const v = series.filter(x => x != null);
  if (v.length < 2) return null;
  const delta = v[v.length - 1] - v[0];
  return { pct: Math.abs((delta / v[0] * 100)).toFixed(1), improving: delta < 0 };
}

function Sparkline({ values, color }) {
  const data = {
    labels: (values || []).map((_, i) => i),
    datasets: [{ data: values || [], borderColor: color, borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: false, spanGaps: true }]
  };
  const opts = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } };
  return <div style={{ height: 34, width: 80 }}><Line data={data} options={opts} /></div>;
}

function CountrySelect({ countries, value, onChange }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return countries;
    const q = query.toLowerCase();
    return countries.filter(c => c.toLowerCase().includes(q));
  }, [countries, query]);

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="cs-wrap" ref={ref}>
      <button className="cs-trigger" onClick={() => { setOpen(o => !o); setQuery(''); }}>
        <span>All countries ▾</span>
      </button>
      {open && (
        <div className="cs-dropdown">
          <input className="cs-search" placeholder="Search country code…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          <div className="cs-list">
            {filtered.length === 0
              ? <div className="cs-empty">No results</div>
              : filtered.map(c => (
                <button key={c} className={`cs-item ${c === value ? 'active' : ''}`}
                  onClick={() => { onChange(c); setOpen(false); setQuery(''); }}>
                  {c}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

const QUICK = ['USA','DEU','FRA','GBR','CHN','JPN','IND','CAN','AUS','BRA'];

export default function GridInsights() {
  const [gridData,   setGridData]   = useState({});
  const [allCodes,   setAllCodes]   = useState([]);
  const [selected,   setSelected]   = useState('USA');
  const [showTD,     setShowTD]     = useState(true);
  const [showFc,     setShowFc]     = useState(false);
  const [forecast,   setForecast]   = useState(null);   // GPR result for selected country
  const [fcLoading,  setFcLoading]  = useState(false);
  const [fcError,    setFcError]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // ── Load grid data + country list ──────────────────────────────────────────
  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      setLoading(true); setError(null);
      const [gData, cData] = await Promise.all([
        apiClient.getGridData(),
        fetch(`${API}/countries`).then(r => r.json())
      ]);
      setGridData(gData);
      setAllCodes(Array.isArray(cData) ? cData : []);
    } catch (err) {
      setError(err.message || 'Failed to load grid data.');
    } finally {
      setLoading(false);
    }
  }

  // ── Fetch GPR forecast when user enables it ────────────────────────────────
  useEffect(() => {
    if (!showFc) return;
    fetchForecast(selected);
  }, [showFc, selected]);

  async function fetchForecast(country) {
    setFcLoading(true); setFcError(null); setForecast(null);
    try {
      const res = await fetch(`${API}/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, horizon: 10 })
      });
      const data = await res.json();
      if (data.error) { setFcError(data.error); return; }
      setForecast(data);
    } catch (err) {
      setFcError('Forecast unavailable');
    } finally {
      setFcLoading(false);
    }
  }

  // ── Derive series for selected country ────────────────────────────────────
  const countryRaw  = gridData[selected] ?? {};
  const sortedYears = Object.keys(countryRaw).map(Number).sort((a, b) => a - b);
  const genSeries   = sortedYears.map(y => countryRaw[y]?.raw       ?? null);
  const plugSeries  = sortedYears.map(y => countryRaw[y]?.corrected ?? null);

  const latestYear  = sortedYears[sortedYears.length - 1];
  const latestRaw   = countryRaw[latestYear]?.raw       ?? null;
  const latestPlug  = countryRaw[latestYear]?.corrected ?? null;
  const latestTD    = countryRaw[latestYear]?.td_loss   ?? null;

  const tier      = getTier(latestPlug ?? latestRaw);
  const longTrend = getLongTrend(plugSeries.some(v => v !== null) ? plugSeries : genSeries);

  const prevYear  = sortedYears[sortedYears.length - 2];
  const prevPlug  = countryRaw[prevYear]?.corrected ?? countryRaw[prevYear]?.raw ?? null;
  const yoyDelta  = latestPlug && prevPlug ? latestPlug - prevPlug : null;
  const yoyPct    = yoyDelta && prevPlug   ? ((yoyDelta / prevPlug) * 100).toFixed(1) : null;
  const evGpkm    = latestPlug ? ((180 / 1000) * latestPlug).toFixed(1) : null;

  // ── Build chart data ───────────────────────────────────────────────────────
  const chartLabels = [...sortedYears.map(String)];
  const chartGen    = [...genSeries];
  const chartPlug   = [...plugSeries];

  // Append GPR forecast years if available
  if (showFc && forecast && !fcLoading) {
    forecast.years.forEach((y, i) => {
      chartLabels.push(String(y));
      chartGen.push(null);   // no historical gen for forecast years
      chartPlug.push(null);
    });
  }

  const fcStartIdx = sortedYears.length; // index where forecast begins

  const datasets = [
    {
      label: 'Generation Intensity',
      data: chartGen,
      borderColor: '#00C853',
      backgroundColor: 'rgba(0,200,83,0.07)',
      tension: 0.4, fill: true, borderWidth: 2,
      pointRadius: 2, pointBackgroundColor: '#00C853', spanGaps: false,
    },
    ...(showTD && plugSeries.some(v => v !== null) ? [{
      label: 'Plug-Adjusted',
      data: chartPlug,
      borderColor: '#69F0AE',
      backgroundColor: 'rgba(105,240,174,0.05)',
      tension: 0.4, fill: true, borderWidth: 2,
      pointRadius: 2, pointBackgroundColor: '#69F0AE', spanGaps: false,
    }] : []),
  ];

  // GPR forecast datasets
  if (showFc && forecast && !fcLoading) {
    const fcPad = new Array(sortedYears.length).fill(null);

    // Upper bound fill
    datasets.push({
      label: 'Forecast upper (95% CI)',
      data: [...fcPad, ...forecast.upper],
      borderColor: 'transparent',
      backgroundColor: 'rgba(105,240,174,0.08)',
      fill: '+1',   // fill between this and next dataset
      tension: 0.4, pointRadius: 0, borderWidth: 0, spanGaps: false,
    });
    // Lower bound fill
    datasets.push({
      label: 'Forecast lower (95% CI)',
      data: [...fcPad, ...forecast.lower],
      borderColor: 'rgba(105,240,174,0.25)',
      backgroundColor: 'rgba(105,240,174,0.08)',
      fill: false,
      tension: 0.4, pointRadius: 0, borderWidth: 1,
      borderDash: [3, 3], spanGaps: false,
    });
    // GPR mean line
    // Bridge: connect last historical to first forecast
    const meanWithBridge = [...fcPad];
    meanWithBridge[sortedYears.length - 1] = forecast.last_actual;
    forecast.mean.forEach(v => meanWithBridge.push(v));

    datasets.push({
      label: 'GPR Forecast (mean)',
      data: meanWithBridge,
      borderColor: '#B2DFDB',
      backgroundColor: 'transparent',
      tension: 0.4, fill: false, borderWidth: 2,
      pointRadius: ctx => ctx.dataIndex === sortedYears.length - 1 ? 4 : 2,
      pointBackgroundColor: '#B2DFDB',
      borderDash: [6, 3], spanGaps: false,
    });
  }

  const chartData = { labels: chartLabels, datasets };

  // Vertical divider annotation at forecast start
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#7a8a80', font: { size: 11 }, boxWidth: 12, padding: 16,
          filter: item => !item.text.includes('(95% CI)')  // hide CI bound labels
        }
      },
      tooltip: {
        backgroundColor: 'rgba(10,18,14,0.95)',
        borderColor: 'rgba(0,200,83,0.2)', borderWidth: 1,
        padding: 11, titleColor: '#aaa', bodyColor: '#ccc',
        callbacks: {
          title: ctx => {
            const yr = ctx[0].label;
            const isFc = showFc && forecast && parseInt(yr) > forecast.last_year;
            return `${yr}${isFc ? ' — GPR forecast' : ''}`;
          },
          label: ctx => {
            if (ctx.parsed.y === null) return null;
            const name = ctx.dataset.label;
            if (name.includes('upper') || name.includes('lower')) return null;
            return `${name}: ${ctx.parsed.y.toFixed(1)} g CO₂/kWh`;
          },
          afterBody: ctx => {
            if (!showFc || !forecast) return [];
            const yr = parseInt(ctx[0].label);
            const idx = forecast.years.indexOf(yr);
            if (idx === -1) return [];
            return [
              `  95% CI: ${forecast.lower[idx].toFixed(1)} – ${forecast.upper[idx].toFixed(1)} g/kWh`,
              `  Band width: ±${((forecast.upper[idx] - forecast.lower[idx]) / 2).toFixed(1)} g/kWh`
            ];
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#4a5a50', font: { size: 11 } }, border: { color: 'rgba(255,255,255,0.05)' } },
      y: {
        beginAtZero: false,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#4a5a50', font: { size: 11 }, callback: v => `${v}` },
        title: { display: true, text: 'g CO₂/kWh', color: '#3a4a40', font: { size: 11 } },
        border: { color: 'rgba(255,255,255,0.05)' }
      }
    }
  };

  // ── Country comparison table ──────────────────────────────────────────────
  const allRows = useMemo(() => Object.keys(gridData).map(code => {
    const cd  = gridData[code] ?? {};
    const yrs = Object.keys(cd).map(Number).sort((a, b) => a - b);
    if (!yrs.length) return null;
    const ly  = yrs[yrs.length - 1];
    const val = cd[ly]?.corrected ?? cd[ly]?.raw ?? null;
    const vals = yrs.map(y => cd[y]?.corrected ?? cd[y]?.raw ?? null);
    return { code, val, year: ly, tier: getTier(val), trend: getLongTrend(vals), sparkVals: vals };
  }).filter(Boolean).sort((a, b) => (a.val ?? 9999) - (b.val ?? 9999)), [gridData]);

  const quickRows = useMemo(() => QUICK.map(code => allRows.find(r => r.code === code)).filter(Boolean), [allRows]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="grid-page">
      <div className="grid-loading"><div className="grid-spinner" /><span>Loading grid data…</span></div>
    </div>
  );
  if (error) return (
    <div className="grid-page">
      <div className="grid-error"><span>⚠️ {error}</span><button onClick={fetchAll}>Retry</button></div>
    </div>
  );

  return (
    <div className="grid-page">

      <div className="grid-hero">
        <h1>Grid Emissions Insights</h1>
        <p className="grid-hero-sub">
          Carbon intensity across {allCodes.length} countries · GPR machine learning forecast
        </p>
      </div>

      {/* Quick pills + dropdown */}
      <div className="grid-quick-bar">
        {quickRows.map(r => (
          <button key={r.code}
            className={`grid-quick-pill ${selected === r.code ? 'active' : ''}`}
            style={{ '--pill-color': r.tier.color }}
            onClick={() => setSelected(r.code)}>
            <span className="pill-code">{r.code}</span>
            {r.val != null && <span className="pill-val">{Math.round(r.val)}</span>}
          </button>
        ))}
        <CountrySelect countries={allCodes} value={selected} onChange={setSelected} />
      </div>

      {/* KPI strip */}
      <div className="grid-kpi-strip">
        <div className="grid-kpi" style={{ '--accent': tier.color }}>
          <div className="kpi-top">
            <span className="kpi-label">Plug-Adjusted Intensity</span>
            <span className="kpi-badge" style={{ background: tier.bg, color: tier.color }}>{tier.label}</span>
          </div>
          <div className="kpi-val" style={{ color: tier.color }}>
            {latestPlug != null ? Math.round(latestPlug) : latestRaw != null ? Math.round(latestRaw) : '—'}
            <span className="kpi-unit">g CO₂/kWh</span>
          </div>
          <div className="kpi-sub">{latestYear} · includes T&amp;D</div>
        </div>

        <div className="grid-kpi">
          <div className="kpi-top"><span className="kpi-label">Generation Intensity</span></div>
          <div className="kpi-val">{latestRaw != null ? Math.round(latestRaw) : '—'}<span className="kpi-unit">g CO₂/kWh</span></div>
          <div className="kpi-sub">at point of generation</div>
        </div>

        <div className="grid-kpi">
          <div className="kpi-top"><span className="kpi-label">T&amp;D Loss</span></div>
          <div className="kpi-val">{latestTD != null ? `${(latestTD * 100).toFixed(1)}` : '—'}<span className="kpi-unit">%</span></div>
          <div className="kpi-sub">transmission &amp; distribution</div>
        </div>

        {yoyDelta != null && (
          <div className="grid-kpi">
            <div className="kpi-top"><span className="kpi-label">Year-on-Year</span></div>
            <div className="kpi-val" style={{ color: yoyDelta < 0 ? '#69F0AE' : '#FF7043' }}>
              {yoyDelta > 0 ? '+' : ''}{Math.round(yoyDelta)}<span className="kpi-unit">g/kWh</span>
            </div>
            <div className="kpi-sub" style={{ color: yoyDelta < 0 ? '#69F0AE' : '#FF7043' }}>
              {yoyDelta < 0 ? '▼' : '▲'} {Math.abs(yoyPct)}% vs {prevYear}
            </div>
          </div>
        )}

        {evGpkm != null && (
          <div className="grid-kpi" style={{ '--accent': '#B2DFDB' }}>
            <div className="kpi-top"><span className="kpi-label">EV Effective Rate</span></div>
            <div className="kpi-val" style={{ color: '#B2DFDB' }}>{evGpkm}<span className="kpi-unit">g/km</span></div>
            <div className="kpi-sub">at 180 Wh/km consumption</div>
          </div>
        )}

        {longTrend && (
          <div className="grid-kpi">
            <div className="kpi-top"><span className="kpi-label">Long-run Trend</span></div>
            <div className="kpi-val" style={{ color: longTrend.improving ? '#69F0AE' : '#FF7043' }}>
              {longTrend.improving ? '▼' : '▲'} {longTrend.pct}<span className="kpi-unit">%</span>
            </div>
            <div className="kpi-sub">since {sortedYears[0]}</div>
          </div>
        )}

        {/* GPR forecast KPI — only when loaded */}
        {showFc && forecast && !fcLoading && (
          <div className="grid-kpi gpr-kpi" style={{ '--accent': '#B2DFDB' }}>
            <div className="kpi-top">
              <span className="kpi-label">GPR 10yr Forecast</span>
              <span className="kpi-badge" style={{ background: 'rgba(178,223,219,0.1)', color: '#B2DFDB' }}>
                {forecast.trend}
              </span>
            </div>
            <div className="kpi-val" style={{ color: '#B2DFDB' }}>
              {Math.round(forecast.mean[forecast.mean.length - 1])}<span className="kpi-unit">g/kWh</span>
            </div>
            <div className="kpi-sub">
              in {forecast.years[forecast.years.length - 1]}
              {forecast.model_score != null && ` · R² ${forecast.model_score}`}
            </div>
          </div>
        )}
      </div>

      {/* Main chart */}
      <div className="grid-chart-card">
        <div className="grid-chart-header">
          <div>
            <h2 className="grid-chart-title">{selected} — Grid Carbon Intensity</h2>
            <p className="grid-chart-sub">
              {sortedYears[0]}–{latestYear}
              {showFc && forecast && ` · GPR forecast to ${forecast.years[forecast.years.length - 1]}`}
              {showFc && forecast && ` · shaded band = 95% confidence interval`}
            </p>
          </div>
          <div className="grid-chart-controls">
            <label className="grid-toggle">
              <input type="checkbox" checked={showTD} onChange={e => setShowTD(e.target.checked)} />
              <span className="grid-toggle-track" />
              <span className="grid-toggle-lbl">T&amp;D adjusted</span>
            </label>
            <label className="grid-toggle">
              <input type="checkbox" checked={showFc} onChange={e => setShowFc(e.target.checked)} />
              <span className="grid-toggle-track" />
              <span className="grid-toggle-lbl">
                GPR forecast
                {showFc && fcLoading && <span className="fc-spinner" />}
              </span>
            </label>
          </div>
        </div>

        {/* Forecast error banner */}
        {showFc && fcError && (
          <div className="fc-error-banner">⚠️ {fcError} — install scikit-learn on the backend</div>
        )}

        {sortedYears.length > 0 ? (
          <div className="grid-chart-wrap">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="grid-no-data">No data for {selected}</div>
        )}

        {/* GPR model info bar */}
        {showFc && forecast && !fcLoading && (
          <div className="gpr-info-bar">
            <span className="gpr-info-item">
              <span className="gpr-dot" style={{ background: '#B2DFDB' }} />
              GPR mean
            </span>
            <span className="gpr-info-item">
              <span className="gpr-band-swatch" />
              95% confidence interval
            </span>
            <span className="gpr-info-item gpr-model-score">
              Model fit R² = {forecast.model_score ?? '—'}
            </span>
            <span className="gpr-info-item">
              Kernel: RBF + WhiteKernel
            </span>
          </div>
        )}
      </div>

      {/* Insight callout */}
      {evGpkm != null && (
        <div className="grid-insight">
          <span className="insight-icon">⚡</span>
          <div className="insight-body">
            <strong>What this means for EVs in {selected}</strong>
            <p>
              At {Math.round(latestPlug ?? latestRaw)} g CO₂/kWh, a typical EV emits{' '}
              <span style={{ color: tier.color, fontWeight: 600 }}>{evGpkm} g CO₂/km</span> operationally
              — vs ~120 g/km for an average petrol car.
              {showFc && forecast && !fcLoading && (
                <> The GPR model projects intensity will reach <strong style={{ color: '#B2DFDB' }}>
                  {Math.round(forecast.mean[forecast.mean.length - 1])} g/kWh
                </strong> by {forecast.years[forecast.years.length - 1]},
                meaning EV emissions could fall to{' '}
                <strong style={{ color: '#B2DFDB' }}>
                  {((180 / 1000) * forecast.mean[forecast.mean.length - 1]).toFixed(1)} g/km
                </strong>.</>
              )}
              {longTrend?.improving && !showFc
                ? ` Grid has improved ${longTrend.pct}% since ${sortedYears[0]}.`
                : !showFc && longTrend
                  ? ` Grid intensity rose ${longTrend.pct}% since ${sortedYears[0]}.`
                  : null
              }
            </p>
          </div>
        </div>
      )}

      {/* Country table */}
      <div className="grid-table-card">
        <div className="grid-table-header">
          <h2 className="grid-section-title">
            All Countries — Ranked by Current Intensity
            <span className="grid-table-count">{allRows.length} countries</span>
          </h2>
        </div>
        <div className="gct-head">
          <span>#</span><span>Country</span><span>Intensity</span>
          <span className="gct-sm">Rating</span><span className="gct-sm">Trend</span><span>History</span>
        </div>
        <div className="gct-body">
          {allRows.map((row, i) => (
            <div key={row.code}
              className={`gct-row ${row.code === selected ? 'gct-active' : ''}`}
              onClick={() => setSelected(row.code)}>
              <span className="gct-rank">#{i + 1}</span>
              <span className="gct-code">{row.code}</span>
              <span className="gct-val" style={{ color: row.tier.color }}>
                {row.val != null ? `${Math.round(row.val)} g/kWh` : '—'}
              </span>
              <span className="gct-sm">
                <span className="gct-badge" style={{ background: row.tier.bg, color: row.tier.color }}>{row.tier.label}</span>
              </span>
              <span className="gct-trend gct-sm" style={{ color: row.trend?.improving ? '#69F0AE' : row.trend ? '#FF7043' : '#444' }}>
                {row.trend ? `${row.trend.improving ? '▼' : '▲'} ${row.trend.pct}%` : '—'}
              </span>
              <span className="gct-spark"><Sparkline values={row.sparkVals} color={row.tier.color} /></span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}