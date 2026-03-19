import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Radar } from "react-chartjs-2";

ChartJS.register(
  BarElement, ArcElement, CategoryScale, LinearScale,
  RadialLinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler
);

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/* ── helpers ── */
const fmt = (n, d = 0) =>
  n != null ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : "—";

const POWERTRAIN_COLORS = {
  EV: "#00C853", BEV: "#00C853",
  PHEV: "#69F0AE",
  HEV: "#B2DFDB",
  ICE: "#FF7043",
};

const COUNTRIES = [
  { code: "US", label: "🇺🇸 United States" },
  { code: "DE", label: "🇩🇪 Germany" },
  { code: "FR", label: "🇫🇷 France" },
  { code: "UK", label: "🇬🇧 United Kingdom" },
  { code: "CN", label: "🇨🇳 China" },
  { code: "JP", label: "🇯🇵 Japan" },
  { code: "IN", label: "🇮🇳 India" },
];

/* ── tiny skeleton ── */
const Sk = ({ w = "100%", h = 16, r = 6, style = {} }) => (
  <div
    style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,rgba(0,200,83,.06) 25%,rgba(0,200,83,.14) 50%,rgba(0,200,83,.06) 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.6s infinite linear",
      ...style,
    }}
  />
);

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export default function VehicleExplorer() {
  /* search state */
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [sugLoading, setSugLoading] = useState(false);

  /* selected vehicle identity */
  const [selected, setSelected] = useState(null);

  /* settings */
  const [country, setCountry] = useState("US");
  const [distanceKm, setDistanceKm] = useState(15000);

  /* data */
  const [detail, setDetail] = useState(null);
  const [lifecycle, setLifecycle] = useState(null);
  const [carbonScore, setCarbonScore] = useState(null);
  const [annualImpact, setAnnualImpact] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [vehicleImage, setVehicleImage] = useState(null);

  /* loading flags */
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingLifecycle, setLoadingLifecycle] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState(null);

  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  /* ── search suggestions ── */
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setSuggestions([]); setShowSug(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSugLoading(true);
      try {
        const res = await fetch(`${API}/vehicle-search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setSuggestions(data.slice(0, 12));
        setShowSug(true);
      } catch { setSuggestions([]); }
      finally { setSugLoading(false); }
    }, 250);
  };

  /* ── pick a vehicle ── */
  const pickVehicle = useCallback(async (v) => {
    setSelected(v);
    setQuery(`${v.brand} ${v.model} (${v.year})`);
    // FIX 1: Immediately and forcefully clear suggestions
    setSuggestions([]);
    setShowSug(false);

    // reset
    setDetail(null); setLifecycle(null); setCarbonScore(null);
    setAnnualImpact(null); setAiSummary(null); setVehicleImage(null);
    setAiError(null);

    setLoadingDetail(true);
    setLoadingLifecycle(true);

    /* parallel: detail + lifecycle */
    const [detailRes, lcRes] = await Promise.allSettled([
      fetch(`${API}/vehicle-detail?brand=${encodeURIComponent(v.brand)}&model=${encodeURIComponent(v.model)}&year=${v.year}`).then(r => r.json()),
      fetch(`${API}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: v.brand, model: v.model,
          vehicle_year: v.year,
          country, grid_year: 2023,
          distance_km: distanceKm
        })
      }).then(r => r.json()),
    ]);

    const det = detailRes.status === "fulfilled" ? detailRes.value : null;
    const lc  = lcRes.status  === "fulfilled" ? lcRes.value  : null;

    setDetail(det);
    setLoadingDetail(false);

    if (lc && !lc.error) {
      setLifecycle(lc);

      /* parallel: score + annual + winner-detail (image) */
      const [scoreRes, annualRes, imgRes] = await Promise.allSettled([
        fetch(`${API}/carbon-score`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ total_g_per_km: lc.total_g_per_km })
        }).then(r => r.json()),
        fetch(`${API}/annual-impact`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ total_g_per_km: lc.total_g_per_km, annual_km: distanceKm })
        }).then(r => r.json()),
        fetch(`${API}/winner-detail`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand: v.brand, model: v.model, year: v.year })
        }).then(r => r.json()),
      ]);

      if (scoreRes.status  === "fulfilled" && !scoreRes.value?.error) setCarbonScore(scoreRes.value);
      if (annualRes.status === "fulfilled") setAnnualImpact(annualRes.value);
      if (imgRes.status    === "fulfilled") setVehicleImage(imgRes.value?.image_url || null);
    }
    setLoadingLifecycle(false);
  }, [country, distanceKm]);

  /* re-fetch lifecycle when country/distance changes */
  useEffect(() => {
    if (!selected) return;
    const refetch = async () => {
      setLoadingLifecycle(true);
      setLifecycle(null); setCarbonScore(null); setAnnualImpact(null);
      try {
        const lc = await fetch(`${API}/lifecycle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: selected.brand, model: selected.model,
            vehicle_year: selected.year,
            country, grid_year: 2023,
            distance_km: distanceKm
          })
        }).then(r => r.json());

        if (!lc.error) {
          setLifecycle(lc);
          const [scoreRes, annualRes] = await Promise.allSettled([
            fetch(`${API}/carbon-score`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ total_g_per_km: lc.total_g_per_km })
            }).then(r => r.json()),
            fetch(`${API}/annual-impact`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ total_g_per_km: lc.total_g_per_km, annual_km: distanceKm })
            }).then(r => r.json()),
          ]);
          if (scoreRes.status  === "fulfilled" && !scoreRes.value?.error) setCarbonScore(scoreRes.value);
          if (annualRes.status === "fulfilled") setAnnualImpact(annualRes.value);
        }
      } catch {}
      setLoadingLifecycle(false);
    };
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, distanceKm]);

  /* ── AI summary ── */
  const fetchAI = async () => {
    if (!selected || !lifecycle) return;
    setLoadingAI(true); setAiSummary(null); setAiError(null);
    try {
      const res = await fetch(`${API}/ai-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicles: [{
            brand: selected.brand, model: selected.model,
            year: selected.year,
            vehicle_type: selected.vehicle_type,
            lifecycle
          }],
          distance_km: distanceKm
        })
      });
      const data = await res.json();
      if (data.error) { setAiError(data.error); return; }
      setAiSummary({ ...data, winner_stats: lifecycle });
    } catch (e) { setAiError("Failed to load AI analysis."); }
    finally { setLoadingAI(false); }
  };

  /* ── chart data ── */
  const doughnutData = lifecycle ? {
    labels: ["Manufacturing (fixed)", `Operational (${fmt(distanceKm)} km)`, "Battery Recycling (EoL)"].filter((_, i) =>
      i !== 2 || (lifecycle.recycling_kg > 0)
    ),
    datasets: [{
      data: [
        lifecycle.manufacturing_total_kg,
        lifecycle.operational_total_kg,
        ...(lifecycle.recycling_kg > 0 ? [lifecycle.recycling_kg] : [])
      ],
      backgroundColor: ["#2196F3", "#FF5252", "#FFC107"],
      borderColor:     ["#1565C0", "#B71C1C", "#F57F17"],
      borderWidth: 2,
    }]
  } : null;

  const barData = lifecycle ? {
    labels: ["Manufacturing", "Operational", "Recycling"],
    datasets: [{
      label: "kg CO₂",
      data: [
        lifecycle.manufacturing_total_kg,
        lifecycle.operational_total_kg,
        lifecycle.recycling_kg ?? 0,
      ],
      backgroundColor: ["#2196F3", "#FF5252", "#FFC107"],
      borderColor:     ["#1565C0", "#B71C1C", "#F57F17"],
      borderWidth: 1,
      borderRadius: 6,
    }]
  } : null;

  const radarData = lifecycle ? {
    labels: ["Manufacturing", "Operational", "Recycling", "Total Rate", "Efficiency"],
    datasets: [{
      label: selected ? `${selected.brand} ${selected.model}` : "",
      data: [
        Math.min(100, (lifecycle.manufacturing_total_kg / 10000) * 100),
        Math.min(100, (lifecycle.operational_total_kg / (distanceKm * 0.3)) * 100),
        Math.min(100, ((lifecycle.recycling_kg ?? 0) / 1000) * 100),
        Math.min(100, (lifecycle.total_g_per_km / 300) * 100),
        Math.max(0, 100 - (lifecycle.total_g_per_km / 3)),
      ],
      backgroundColor: "rgba(0,200,83,0.15)",
      borderColor: "#00C853",
      pointBackgroundColor: "#00C853",
      pointBorderColor: "#fff",
      pointHoverBackgroundColor: "#fff",
      pointHoverBorderColor: "#00C853",
      borderWidth: 2,
    }]
  } : null;

  const chartFont = { family: "'DM Mono', monospace", color: "rgba(255,255,255,0.6)" };

  const baseChartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "rgba(255,255,255,0.65)", font: chartFont, boxWidth: 14 } },
      tooltip: {
        backgroundColor: "rgba(10,10,10,0.9)",
        borderColor: "rgba(0,200,83,0.4)", borderWidth: 1,
        titleColor: "#00C853", bodyColor: "rgba(255,255,255,0.8)",
        callbacks: { label: ctx => ` ${fmt(ctx.parsed.y ?? ctx.parsed, 1)} kg CO₂` }
      }
    },
    scales: {
      x: { ticks: { color: "rgba(255,255,255,0.5)", font: chartFont }, grid: { color: "rgba(255,255,255,0.06)" } },
      y: { ticks: { color: "rgba(255,255,255,0.5)", font: chartFont }, grid: { color: "rgba(255,255,255,0.06)" }, beginAtZero: true }
    }
  };

  const radarOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: "rgba(10,10,10,0.9)", borderColor: "rgba(0,200,83,0.4)", borderWidth: 1, titleColor: "#00C853", bodyColor: "rgba(255,255,255,0.8)" }
    },
    scales: {
      r: {
        beginAtZero: true, max: 100,
        ticks: { display: false },
        grid: { color: "rgba(0,200,83,0.1)" },
        pointLabels: { color: "rgba(255,255,255,0.55)", font: { ...chartFont, size: 11 } },
        angleLines: { color: "rgba(0,200,83,0.1)" },
      }
    }
  };

  const scoreColor = carbonScore
    ? carbonScore.grade === "A" ? "#00C853"
    : carbonScore.grade === "B" ? "#69F0AE"
    : carbonScore.grade === "C" ? "#FFD600"
    : carbonScore.grade === "D" ? "#FF9800"
    : "#FF5252"
    : "#555";

  const ptColor = selected ? (POWERTRAIN_COLORS[selected.vehicle_type] || "#69F0AE") : "#00C853";

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'DM Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(0,200,83,0.2)} 50%{box-shadow:0 0 40px rgba(0,200,83,0.4)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.6);opacity:0} }
        .fade-up { animation: fadeUp .4s ease both; }
        .card-glass {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          backdrop-filter: blur(4px);
        }
        .card-green {
          background: rgba(0,200,83,0.05);
          border: 1px solid rgba(0,200,83,0.18);
          border-radius: 14px;
        }
        .stat-row { display:flex; justify-content:space-between; align-items:center; padding:.55rem 0; border-bottom:1px solid rgba(255,255,255,.06); }
        .stat-row:last-child { border-bottom:none; }
        .stat-label { color:rgba(255,255,255,.45); font-size:.8rem; letter-spacing:.04em; }
        .stat-val   { color:#00C853; font-weight:500; font-size:.875rem; }
        .section-title { font-family:'Syne',sans-serif; font-weight:700; font-size:1.1rem; color:#fff; margin-bottom:1rem; letter-spacing:.01em; }
        .badge {
          display:inline-flex; align-items:center; gap:.3rem;
          padding:.25rem .7rem; border-radius:999px;
          font-size:.7rem; font-weight:500; letter-spacing:.06em; text-transform:uppercase;
        }
        .filter-select {
          background:#0a0a0a; border:1.5px solid rgba(0,200,83,.25); color:#00C853;
          border-radius:8px; padding:.6rem .9rem; font-family:'DM Mono',monospace;
          font-size:.85rem; font-weight:500; cursor:pointer; outline:none;
          transition: border-color .2s, box-shadow .2s;
        }
        .filter-select:focus { border-color:#00C853; box-shadow:0 0 0 3px rgba(0,200,83,.12); }
        .filter-select option { background:#111; color:#00C853; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(0,200,83,.3); border-radius:999px; }
      `}</style>

      {/* ── HERO SEARCH ── */}
      <div style={{
        padding: "4rem 2rem 2.5rem",
        background: "linear-gradient(180deg, rgba(0,200,83,.06) 0%, transparent 100%)",
        borderBottom: "1px solid rgba(0,200,83,.1)",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <p style={{ fontFamily: "'Syne',sans-serif", fontSize: ".7rem", letterSpacing: ".2em", color: "#00C853", opacity: .7, textTransform: "uppercase", marginBottom: ".5rem" }}>
            CarbonWise · Vehicle Explorer
          </p>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 800, margin: "0 0 1.5rem", lineHeight: 1.15 }}>
            Explore any vehicle's<br />
            <span style={{ color: "#00C853" }}>full carbon story</span>
          </h1>

          {/* Search bar */}
          <div style={{ position: "relative" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: ".75rem",
              background: "#0d0d0d", border: "1.5px solid rgba(0,200,83,.3)",
              borderRadius: 14, padding: ".85rem 1.25rem",
              transition: "border-color .2s, box-shadow .2s",
              boxShadow: query.length >= 2 ? "0 0 0 3px rgba(0,200,83,.1), 0 8px 32px rgba(0,0,0,.4)" : "0 4px 20px rgba(0,0,0,.3)",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,200,83,.6)" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={handleQueryChange}
                onFocus={() => suggestions.length > 0 && setShowSug(true)}
                // FIX 1: hide suggestions on blur after small delay (allows click to register first)
                onBlur={() => setTimeout(() => setShowSug(false), 150)}
                placeholder="Search brand or model… e.g. Tesla Model 3"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "#fff", fontFamily: "'DM Mono',monospace", fontSize: ".95rem", fontWeight: 500,
                }}
              />
              {sugLoading && (
                <div style={{ width: 16, height: 16, border: "2px solid rgba(0,200,83,.3)", borderTopColor: "#00C853", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              )}
              {query && !sugLoading && (
                <button
                  onClick={() => { setQuery(""); setSuggestions([]); setShowSug(false); setSelected(null); }}
                  style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.5)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {showSug && suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 100,
                background: "#0d0d0d", border: "1px solid rgba(0,200,83,.2)",
                borderRadius: 12, overflow: "hidden",
                boxShadow: "0 16px 48px rgba(0,0,0,.6)",
                animation: "fadeUp .15s ease",
              }}>
                {suggestions.map((v, i) => (
                  <div
                    key={i}
                    // FIX 1: preventDefault on mouseDown prevents input blur before click fires
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => pickVehicle(v)}
                    style={{
                      display: "flex", alignItems: "center", gap: "1rem",
                      padding: ".75rem 1.25rem", cursor: "pointer",
                      borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
                      transition: "background .15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,200,83,.07)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: `${POWERTRAIN_COLORS[v.vehicle_type] || "#69F0AE"}18`,
                      border: `1px solid ${POWERTRAIN_COLORS[v.vehicle_type] || "#69F0AE"}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: ".65rem", fontWeight: 600, color: POWERTRAIN_COLORS[v.vehicle_type] || "#69F0AE",
                      letterSpacing: ".04em",
                    }}>
                      {v.vehicle_type}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: ".9rem" }}>{v.brand} {v.model}</div>
                      <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".75rem", marginTop: 2 }}>{v.year}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,200,83,.4)" strokeWidth="2" strokeLinecap="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Settings bar */}
        {selected && (
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem", alignItems: "center" }} className="fade-up">
            <div style={{ display: "flex", flexDirection: "column", gap: ".35rem" }}>
              <label style={{ fontSize: ".7rem", color: "#00C853", letterSpacing: ".08em", textTransform: "uppercase" }}>Country / Grid</label>
              <select className="filter-select" value={country} onChange={e => setCountry(e.target.value)}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: ".35rem", flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label style={{ fontSize: ".7rem", color: "#00C853", letterSpacing: ".08em", textTransform: "uppercase" }}>Annual Distance</label>
                <span style={{ fontSize: ".75rem", color: "#00C853", fontWeight: 500 }}>{fmt(distanceKm)} km</span>
              </div>
              <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
                <input
                  type="range" min="1000" max="100000" step="500"
                  value={distanceKm}
                  onChange={e => setDistanceKm(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#00C853", cursor: "pointer" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".67rem", color: "rgba(255,255,255,.25)" }}>
                <span>1k km</span><span>50k km</span><span>100k km</span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selected && !loadingDetail && (
          <div style={{ textAlign: "center", padding: "5rem 2rem", color: "rgba(255,255,255,.25)" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "1rem", opacity: .5 }}>🔍</div>
            <p style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.1rem", marginBottom: ".5rem", color: "rgba(255,255,255,.4)" }}>Search for any vehicle above</p>
            <p style={{ fontSize: ".85rem" }}>Get lifecycle emissions, carbon score, charts & AI analysis</p>
          </div>
        )}

        {/* ── VEHICLE HEADER ── */}
        {selected && (
          <div className="fade-up" style={{ marginBottom: "2rem" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr auto",
              gap: "1.5rem", alignItems: "start",
            }}>
              {/* Left: identity + image */}
              <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* Image */}
                <div style={{
                  width: 200, height: 130, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                  background: "rgba(0,200,83,.05)", border: "1px solid rgba(0,200,83,.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {vehicleImage ? (
                    <img src={vehicleImage} alt={`${selected.brand} ${selected.model}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={e => { e.target.style.display = "none"; }}
                    />
                  ) : (
                    <div style={{ color: "rgba(0,200,83,.25)", fontSize: ".75rem", textAlign: "center", padding: "1rem" }}>
                      <div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>🚗</div>
                      No image
                    </div>
                  )}
                </div>

                {/* Title block */}
                <div>
                  <div style={{ display: "flex", gap: ".5rem", alignItems: "center", marginBottom: ".5rem", flexWrap: "wrap" }}>
                    <span className="badge" style={{ background: `${ptColor}18`, border: `1px solid ${ptColor}40`, color: ptColor }}>
                      {selected.vehicle_type}
                    </span>
                    <span style={{ fontSize: ".75rem", color: "rgba(255,255,255,.35)" }}>{selected.year}</span>
                  </div>
                  <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 800, margin: "0 0 .5rem" }}>
                    {selected.brand} {selected.model}
                  </h2>
                  {loadingDetail ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
                      <Sk w={200} h={13} /><Sk w={140} h={13} />
                    </div>
                  ) : detail && (
                    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: ".75rem" }}>
                      {detail.co2_wltp_gpkm != null && (
                        <div style={{ fontSize: ".8rem", color: "rgba(255,255,255,.5)" }}>
                          <span style={{ color: "#00C853", fontWeight: 500 }}>{fmt(detail.co2_wltp_gpkm, 1)}</span> g/km WLTP
                        </div>
                      )}
                      {detail.electric_wh_per_km != null && (
                        <div style={{ fontSize: ".8rem", color: "rgba(255,255,255,.5)" }}>
                          <span style={{ color: "#69F0AE", fontWeight: 500 }}>{fmt(detail.electric_wh_per_km, 0)}</span> Wh/km
                        </div>
                      )}
                      {detail.vehicle_weight_kg != null && (
                        <div style={{ fontSize: ".8rem", color: "rgba(255,255,255,.5)" }}>
                          <span style={{ color: "rgba(255,255,255,.7)", fontWeight: 500 }}>{fmt(detail.vehicle_weight_kg, 0)}</span> kg
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: carbon score badge */}
              {/* FIX 2: show when selected + (loading OR score ready OR lifecycle loaded without score) */}
              {selected && (loadingLifecycle || carbonScore || lifecycle) && (
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  {loadingLifecycle ? (
                    <Sk w={90} h={90} r="50%" />
                  ) : carbonScore ? (
                    <>
                      <div style={{
                        position: "relative", width: 88, height: 88,
                        border: `3px solid ${scoreColor}`,
                        borderRadius: "50%",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        animation: "glow 3s ease infinite",
                      }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "2rem", fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                          {carbonScore.grade}
                        </div>
                        <div style={{ fontSize: ".6rem", color: "rgba(255,255,255,.4)", letterSpacing: ".08em", textTransform: "uppercase", marginTop: 2 }}>
                          score
                        </div>
                      </div>
                      <div style={{ fontSize: ".65rem", color: "rgba(255,255,255,.35)", marginTop: ".5rem", maxWidth: 88, lineHeight: 1.4 }}>
                        {carbonScore.label}
                      </div>
                    </>
                  ) : lifecycle ? (
                    /* Fallback: show g/km rate if score API failed */
                    <div style={{
                      width: 88, height: 88, borderRadius: "50%",
                      border: "3px solid rgba(255,255,255,.12)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{ fontSize: ".95rem", fontWeight: 700, color: "rgba(255,255,255,.6)", lineHeight: 1 }}>
                        {fmt(lifecycle.total_g_per_km, 0)}
                      </div>
                      <div style={{ fontSize: ".55rem", color: "rgba(255,255,255,.3)", marginTop: 3, letterSpacing: ".04em" }}>g/km</div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MAIN GRID ── */}
        {selected && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>

            {/* ─ Emissions Summary ─ */}
            <div className="card-green fade-up" style={{ padding: "1.5rem", animationDelay: ".05s" }}>
              <div className="section-title">📊 Lifecycle Emissions</div>
              {loadingLifecycle ? (
                <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
                  {[1,2,3,4,5].map(i => <div key={i} style={{ display: "flex", justifyContent: "space-between" }}><Sk w="45%" h={13}/><Sk w="25%" h={13}/></div>)}
                </div>
              ) : lifecycle ? (
                <>
                  <div className="stat-row">
                    <span className="stat-label">Operational ({fmt(distanceKm)} km)</span>
                    <span className="stat-val">{fmt(lifecycle.operational_total_kg, 1)} kg CO₂</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Manufacturing (lifetime fixed)</span>
                    <span className="stat-val">{fmt(lifecycle.manufacturing_total_kg, 0)} kg CO₂</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Battery Recycling (EoL)</span>
                    <span style={{ color: lifecycle.recycling_kg > 0 ? "#69F0AE" : "rgba(255,255,255,.25)", fontWeight: 500, fontSize: ".875rem" }}>
                      {lifecycle.recycling_kg > 0 ? `${fmt(lifecycle.recycling_kg, 0)} kg CO₂` : "—"}
                    </span>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(0,200,83,.25)", margin: ".75rem 0 .5rem", paddingTop: ".75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "rgba(255,255,255,.6)", fontSize: ".85rem" }}>Total</span>
                      <span style={{ color: "#69F0AE", fontWeight: 600, fontSize: "1.15rem" }}>
                        {fmt(lifecycle.total_for_distance_kg, 0)} kg CO₂
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: ".35rem" }}>
                      <span style={{ color: "rgba(255,255,255,.35)", fontSize: ".78rem" }}>Rate</span>
                      <span style={{ color: "rgba(255,255,255,.6)", fontSize: ".78rem" }}>{lifecycle.total_g_per_km} g/km</span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ color: "rgba(255,82,82,.7)", fontSize: ".875rem" }}>⚠️ Emissions data unavailable</div>
              )}
            </div>

            {/* ─ Annual Impact ─ */}
            <div className="card-glass fade-up" style={{ padding: "1.5rem", animationDelay: ".1s" }}>
              <div className="section-title">🌍 Annual Impact</div>
              {loadingLifecycle ? (
                <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
                  {[1,2,3].map(i => <div key={i} style={{ display: "flex", justifyContent: "space-between" }}><Sk w="50%" h={13}/><Sk w="30%" h={13}/></div>)}
                </div>
              ) : annualImpact ? (
                <>
                  <div className="stat-row">
                    <span className="stat-label">Annual CO₂</span>
                    <span className="stat-val">{fmt(annualImpact.annual_kg, 1)} kg</span>
                  </div>
                  {annualImpact.trees_equivalent != null && (
                    <div className="stat-row">
                      <span className="stat-label">🌳 Trees to offset</span>
                      <span className="stat-val">{fmt(annualImpact.trees_equivalent, 0)}</span>
                    </div>
                  )}
                  {annualImpact.flights_equivalent != null && (
                    <div className="stat-row">
                      <span className="stat-label">✈️ Short-haul flights equiv.</span>
                      <span className="stat-val">{fmt(annualImpact.flights_equivalent, 1)}</span>
                    </div>
                  )}
                  {annualImpact.coal_kg != null && (
                    <div className="stat-row">
                      <span className="stat-label">🪨 Coal equivalent</span>
                      <span className="stat-val">{fmt(annualImpact.coal_kg, 1)} kg</span>
                    </div>
                  )}
                  {annualImpact.homes_powered != null && (
                    <div className="stat-row">
                      <span className="stat-label">🏠 Homes powered (clean)</span>
                      <span className="stat-val">{fmt(annualImpact.homes_powered, 2)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: "rgba(255,255,255,.25)", fontSize: ".85rem", marginTop: ".5rem" }}>Select a vehicle to see impact</div>
              )}
            </div>

            {/* ─ Vehicle Specs ─ */}
            <div className="card-glass fade-up" style={{ padding: "1.5rem", animationDelay: ".15s" }}>
              <div className="section-title">⚙️ Specifications</div>
              {loadingDetail ? (
                <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ display: "flex", justifyContent: "space-between" }}><Sk w="45%" h={13}/><Sk w="25%" h={13}/></div>)}
                </div>
              ) : detail ? (
                <>
                  {detail.brand        && <div className="stat-row"><span className="stat-label">Brand</span><span className="stat-val">{detail.brand}</span></div>}
                  {detail.model        && <div className="stat-row"><span className="stat-label">Model</span><span className="stat-val">{detail.model}</span></div>}
                  {detail.year         && <div className="stat-row"><span className="stat-label">Year</span><span className="stat-val">{detail.year}</span></div>}
                  {detail.vehicle_type && <div className="stat-row"><span className="stat-label">Powertrain</span><span style={{ color: ptColor, fontWeight: 500, fontSize: ".875rem" }}>{detail.vehicle_type}</span></div>}
                  {detail.body_type    && <div className="stat-row"><span className="stat-label">Body type</span><span className="stat-val">{detail.body_type}</span></div>}
                  {detail.fuel_type    && <div className="stat-row"><span className="stat-label">Fuel type</span><span className="stat-val">{detail.fuel_type}</span></div>}
                  {detail.electric_range_km != null && <div className="stat-row"><span className="stat-label">Electric range</span><span className="stat-val">{fmt(detail.electric_range_km, 0)} km</span></div>}
                  {detail.battery_capacity_kwh != null && <div className="stat-row"><span className="stat-label">Battery capacity</span><span className="stat-val">{fmt(detail.battery_capacity_kwh, 1)} kWh</span></div>}
                  {detail.engine_cc    && <div className="stat-row"><span className="stat-label">Engine</span><span className="stat-val">{fmt(detail.engine_cc, 0)} cc</span></div>}
                  {detail.horsepower   && <div className="stat-row"><span className="stat-label">Power</span><span className="stat-val">{fmt(detail.horsepower, 0)} hp</span></div>}
                  {detail.vehicle_weight_kg != null && <div className="stat-row"><span className="stat-label">Curb weight</span><span className="stat-val">{fmt(detail.vehicle_weight_kg, 0)} kg</span></div>}
                  {detail.battery_weight_kg != null && detail.battery_weight_kg > 0 && (
                    <div className="stat-row"><span className="stat-label">Battery weight</span><span className="stat-val">{fmt(detail.battery_weight_kg, 0)} kg</span></div>
                  )}
                  {detail.co2_wltp_gpkm != null && <div className="stat-row"><span className="stat-label">CO₂ WLTP</span><span className="stat-val">{fmt(detail.co2_wltp_gpkm, 1)} g/km</span></div>}
                  {detail.electric_wh_per_km != null && <div className="stat-row"><span className="stat-label">Energy use</span><span className="stat-val">{fmt(detail.electric_wh_per_km, 1)} Wh/km</span></div>}
                </>
              ) : (
                <div style={{ color: "rgba(255,255,255,.25)", fontSize: ".85rem" }}>No specs available</div>
              )}
            </div>

            {/* ─ ELV Recovery ─ */}
            {lifecycle?.recycling_materials && (
              <div className="card-glass fade-up" style={{ padding: "1.5rem", animationDelay: ".2s" }}>
                <div className="section-title">♻️ End-of-Life Recovery</div>
                <div className="stat-row">
                  <span className="stat-label">
                    Vehicle mass{lifecycle.recycling_materials.weight_is_estimate ? " (avg est.)" : ""}
                  </span>
                  <span style={{ color: "rgba(255,255,255,.6)", fontWeight: 500, fontSize: ".875rem" }}>
                    {fmt(lifecycle.recycling_materials.vehicle_weight_kg, 0)} kg
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">↩ Metals recovered</span>
                  <span style={{ color: "#69F0AE", fontWeight: 600, fontSize: ".875rem" }}>
                    {fmt(lifecycle.recycling_materials.metal_recovered_kg, 0)} kg
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">🗑 Shredder residue (ASR)</span>
                  <span style={{ color: "#FF7043", fontWeight: 600, fontSize: ".875rem" }}>
                    {fmt(lifecycle.recycling_materials.asr_waste_kg, 0)} kg
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Dismantled mass</span>
                  <span style={{ color: "rgba(255,255,255,.6)", fontWeight: 500, fontSize: ".875rem" }}>
                    {fmt(lifecycle.recycling_materials.dismantled_mass_kg, 0)} kg
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CHARTS SECTION ── */}
        {selected && lifecycle && !loadingLifecycle && (
          <div style={{ marginTop: "2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }} className="fade-up">

            {/* Bar chart */}
            <div className="card-glass" style={{ padding: "1.5rem" }}>
              <div className="section-title">Emissions Breakdown</div>
              <div style={{ height: 240, position: "relative" }}>
                <Bar data={barData} options={{
                  ...baseChartOpts,
                  plugins: { ...baseChartOpts.plugins, legend: { display: false } }
                }} />
              </div>
            </div>

            {/* Doughnut */}
            <div className="card-glass" style={{ padding: "1.5rem" }}>
              <div className="section-title">Proportional Share</div>
              <div style={{ height: 240, position: "relative" }}>
                <Doughnut data={doughnutData} options={{
                  ...baseChartOpts,
                  scales: {},
                  plugins: {
                    ...baseChartOpts.plugins,
                    legend: { position: "bottom", labels: { color: "rgba(255,255,255,.6)", font: chartFont, boxWidth: 12, padding: 12 } },
                    tooltip: { ...baseChartOpts.plugins.tooltip, callbacks: { label: ctx => ` ${fmt(ctx.parsed, 1)} kg CO₂` } }
                  }
                }} />
              </div>
            </div>

            {/* Radar */}
            <div className="card-glass" style={{ padding: "1.5rem" }}>
              <div className="section-title">Environmental Profile</div>
              <div style={{ height: 240, position: "relative" }}>
                <Radar data={radarData} options={radarOpts} />
              </div>
              <p style={{ fontSize: ".67rem", color: "rgba(255,255,255,.2)", marginTop: ".75rem", lineHeight: 1.5, textAlign: "center" }}>
                Normalised scores — lower manufacturing/operational/recycling is better; higher efficiency is better
              </p>
            </div>
          </div>
        )}

        {/* ── AI ANALYSIS SECTION ── */}
        {selected && lifecycle && !loadingLifecycle && (
          <div style={{ marginTop: "2rem" }} className="fade-up">
            {!aiSummary && !loadingAI && (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  onClick={fetchAI}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: ".6rem",
                    background: "linear-gradient(135deg, rgba(0,200,83,.15), rgba(0,200,83,.05))",
                    border: "1.5px solid rgba(0,200,83,.4)", color: "#00C853",
                    fontFamily: "'DM Mono',monospace", fontSize: ".9rem", fontWeight: 600,
                    padding: ".85rem 2rem", borderRadius: 999, cursor: "pointer",
                    transition: "all .2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,200,83,.2)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(0,200,83,.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg,rgba(0,200,83,.15),rgba(0,200,83,.05))"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                    <path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z" fill="currentColor"/>
                  </svg>
                  Analyse with Gemini AI
                </button>
              </div>
            )}

            {aiError && !loadingAI && (
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "rgba(255,82,82,.8)", marginBottom: "1rem" }}>⚠️ {aiError}</p>
                <button onClick={fetchAI} style={{ background: "rgba(255,82,82,.1)", border: "1px solid rgba(255,82,82,.3)", color: "#FF5252", padding: ".6rem 1.5rem", borderRadius: 8, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>Retry</button>
              </div>
            )}

            {loadingAI && (
              <div className="card-green" style={{ padding: "2rem" }}>
                <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
                  <Sk w={180} h={110} r={10} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: ".6rem" }}>
                    <Sk w="55%" h={20} /><Sk w="35%" h={14} /><Sk w="100%" h={13} /><Sk w="90%" h={13} /><Sk w="70%" h={13} />
                  </div>
                </div>
              </div>
            )}

            {aiSummary && !loadingAI && (
              <div className="card-green" style={{ padding: "2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: "1.25rem" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: ".4rem",
                    background: "rgba(0,200,83,.12)", border: "1px solid rgba(0,200,83,.3)",
                    color: "#00C853", fontSize: ".7rem", fontWeight: 600, letterSpacing: ".08em",
                    textTransform: "uppercase", padding: ".3rem .75rem", borderRadius: 999,
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z" fill="currentColor"/></svg>
                    Gemini AI Analysis
                  </span>
                </div>

                <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.3rem", fontWeight: 700, marginBottom: ".75rem" }}>
                  {aiSummary.verdict || aiSummary.summary}
                </h3>

                {aiSummary.reasons?.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0", display: "flex", flexDirection: "column", gap: ".6rem" }}>
                    {aiSummary.reasons.map((r, i) => (
                      <li key={i} style={{ display: "flex", gap: ".65rem", alignItems: "flex-start", color: "rgba(255,255,255,.75)", fontSize: ".875rem", lineHeight: 1.5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00C853", flexShrink: 0, marginTop: ".45rem" }} />
                        {r}
                      </li>
                    ))}
                  </ul>
                )}

                {aiSummary.breakdown?.length > 0 && (
                  <div>
                    <div style={{ fontSize: ".7rem", letterSpacing: ".1em", color: "rgba(255,255,255,.3)", textTransform: "uppercase", marginTop: "1.25rem", marginBottom: ".75rem" }}>Detailed breakdown</div>
                    {aiSummary.breakdown.map((v, i) => (
                      <div key={i} style={{ padding: ".75rem", background: "rgba(255,255,255,.03)", borderRadius: 8, marginBottom: ".5rem", fontSize: ".85rem", color: "rgba(255,255,255,.65)", lineHeight: 1.6 }}>
                        {v.note}
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ fontSize: ".7rem", color: "rgba(255,255,255,.2)", marginTop: "1.25rem", lineHeight: 1.5 }}>
                  Analysis generated by Gemini AI. Real-world results may vary based on driving patterns and grid changes.
                </p>
              </div>
            )}
          </div>
        )}

        {/* bottom padding */}
        <div style={{ height: "4rem" }} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}