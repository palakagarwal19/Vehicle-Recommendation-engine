import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/wallet.css";

const API = "http://localhost:5000";

// ── Carbon gauge SVG  ─────────────────────────────────────────────────────
function CarbonGauge({ usedPct }) {
  // Half-circle gauge: 0 % = green needle far left, 100 % = red needle far right
  const clampedPct = Math.min(Math.max(usedPct, 0), 100);
  const R          = 80;
  const cx         = 100;
  const cy         = 100;
  // Arc goes from 180° → 0° (left to right across the top)
  const startAngle = Math.PI;            // 180° in radians
  const endAngle   = 0;
  const needleAngle = Math.PI - (clampedPct / 100) * Math.PI;

  const arcX1 = cx + R * Math.cos(startAngle);
  const arcY1 = cy + R * Math.sin(startAngle);
  const arcX2 = cx + R * Math.cos(endAngle);
  const arcY2 = cy + R * Math.sin(endAngle);

  // Progress arc up to current usage
  const progressAngle = Math.PI - (clampedPct / 100) * Math.PI;
  const progX = cx + R * Math.cos(progressAngle);
  const progY = cy + R * Math.sin(progressAngle);
  const largeArc = clampedPct > 50 ? 1 : 0;

  // Needle tip
  const nLen = 65;
  const nX   = cx + nLen * Math.cos(needleAngle);
  const nY   = cy + nLen * Math.sin(needleAngle);

  // Colour interpolation: green → yellow → red
  const colour =
    clampedPct < 50  ? "#00C853" :
    clampedPct < 75  ? "#FFD600" :
    clampedPct < 90  ? "#FF9100" : "#FF1744";

  return (
    <svg viewBox="0 0 200 110" className="gauge-svg" aria-label={`Carbon usage: ${clampedPct.toFixed(1)}%`}>
      {/* Track */}
      <path
        d={`M ${arcX1} ${arcY1} A ${R} ${R} 0 0 1 ${arcX2} ${arcY2}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round"
      />
      {/* Progress arc */}
      {clampedPct > 0 && (
        <path
          d={`M ${arcX1} ${arcY1} A ${R} ${R} 0 ${largeArc} 1 ${progX} ${progY}`}
          fill="none" stroke={colour} strokeWidth="12" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${colour}80)` }}
        />
      )}
      {/* Tick marks */}
      {[0, 25, 50, 75, 100].map(pct => {
        const a = Math.PI - (pct / 100) * Math.PI;
        const r1 = R + 6, r2 = R + 14;
        return (
          <line
            key={pct}
            x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
            stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"
          />
        );
      })}
      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={nX}  y2={nY}
        stroke={colour} strokeWidth="2.5" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${colour})` }}
      />
      <circle cx={cx} cy={cy} r="5" fill={colour} />
      {/* Labels */}
      <text x="18"  y="108" fill="rgba(255,255,255,0.35)" fontSize="9">0%</text>
      <text x="172" y="108" fill="rgba(255,255,255,0.35)" fontSize="9">100%</text>
    </svg>
  );
}

// ── Trip row ──────────────────────────────────────────────────────────────
function TripRow({ trip }) {
  const date = trip.logged_at
    ? new Date(trip.logged_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : "—";
  return (
    <div className="trip-row">
      <div className="trip-info">
        <span className="trip-vehicle">{trip.vehicle || "Unknown vehicle"}</span>
        <span className="trip-date">{date}</span>
      </div>
      <div className="trip-metrics">
        <span className="trip-km">{trip.distance_km?.toLocaleString(undefined,{maximumFractionDigits:0})} km</span>
        <span className="trip-co2 trip-co2--cc">−{trip.emissions_kg?.toFixed(1)}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function WalletDashboard() {
  const navigate   = useNavigate();
  const userId     = localStorage.getItem("cw_user_id");


  const [wallet,  setWallet]  = useState(null);
  const [trips,   setTrips]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    if (!userId) { navigate("/login"); return; }
    setLoading(true);
    setError(null);
    try {
      const [walletRes, tripsRes] = await Promise.all([
        fetch(`${API}/wallet/${userId}`),
        fetch(`${API}/wallet/${userId}/log?limit=10`),
      ]);
      if (!walletRes.ok) throw new Error("Could not load wallet");
      const [walletData, tripsData] = await Promise.all([
        walletRes.json(),
        tripsRes.json(),
      ]);
      setWallet(walletData);
      setTrips(tripsData.trips || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId, navigate]);

  useEffect(() => { load(); }, [load]);



  if (!userId)  return null;
  if (loading)  return <div className="wallet-page"><div className="wallet-loading">Loading wallet…</div></div>;
  if (error)    return <div className="wallet-page"><div className="wallet-error">⚠ {error} <button onClick={load}>Retry</button></div></div>;
  if (!wallet)  return null;

  const used       = wallet.used_credits   ?? 0;
  const remaining  = wallet.remaining_credits ?? 0;
  const total      = wallet.total_credits  ?? 2300;
  const usedPct    = wallet.usage_pct      ?? 0;
  const stats      = wallet.stats          ?? {};

  const statusLabel =
    usedPct < 50 ? { text: "On track",     cls: "status-green"  } :
    usedPct < 75 ? { text: "Moderate use", cls: "status-yellow" } :
    usedPct < 90 ? { text: "High use",     cls: "status-orange" } :
                   { text: "Critical",     cls: "status-red"    };

  return (
    <div className="wallet-page">

      {/* ── Page header ── */}
      <div className="wallet-page-header">
        <h1 className="wallet-page-title">
          <span className="wallet-page-title-icon">🪙</span>
          Carbon Wallet
        </h1>
        <Link to="/travel" className="wallet-log-trip-btn">+ Log Trip</Link>
      </div>

      <main className="wallet-main">

        {/* ── Gauge hero ── */}
        <section className="wallet-hero card">
          <div className="wallet-hero-gauge">
            <CarbonGauge usedPct={usedPct} />
            <div className="gauge-label">
              <span className={`gauge-status ${statusLabel.cls}`}>{statusLabel.text}</span>
              <span className="gauge-pct">{usedPct.toFixed(1)}% used</span>
            </div>
          </div>

          <div className="wallet-hero-stats">
            <div className="hero-stat hero-stat--remaining">
              <span className="hero-stat-value">{remaining.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
              <span className="hero-stat-label"><span className="cc-unit">CC</span> remaining</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value hero-stat-value--used">{used.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
              <span className="hero-stat-label"><span className="cc-unit">CC</span> used this year</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value hero-stat-value--total">{total.toLocaleString()}</span>
              <span className="hero-stat-label"><span className="cc-unit">CC</span> annual budget</span>
            </div>
          </div>
        </section>

        {/* ── Progress bar ── */}
        <section className="wallet-progress card">
          <div className="progress-header">
            <span>Budget used in {wallet.year}</span>
            <span className="progress-header-cc"><span className="cc-badge"><span className="cc-badge-icon">🪙</span>CC</span> {used.toFixed(0)} / {total}</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(usedPct, 100)}%`,
                background: usedPct < 50 ? "#00C853" : usedPct < 75 ? "#FFD600" : usedPct < 90 ? "#FF9100" : "#FF1744"
              }}
            />
          </div>
          <div className="progress-ticks">
            <span>0</span><span>575</span><span>1150</span><span>1725</span><span>2300 🪙</span>
          </div>
        </section>

        {/* ── 4-stat grid ── */}
        <div className="wallet-stat-grid">
          {[
            { label: "Trips this year",    value: stats.trips              ?? 0,  unit: ""         },
            { label: "Distance driven",    value: (stats.total_km ?? 0).toLocaleString(undefined,{maximumFractionDigits:0}), unit: "km"       },
            { label: "Emissions logged",   value: (stats.total_emissions_kg ?? 0).toFixed(1), unit: "CC"          },
            { label: "Per trip average",   value: stats.trips ? ((stats.total_emissions_kg ?? 0) / stats.trips).toFixed(1) : "—", unit: stats.trips ? "CC" : ""  },
          ].map(({ label, value, unit }) => (
            <div key={label} className="wallet-stat-card card">
              <span className="stat-value">{value}</span>
              {unit && <span className="stat-unit">{unit}</span>}
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Recent trips ── */}
        <section className="wallet-trips card">
          <div className="trips-header">
            <h3>Recent trips</h3>
            <Link to="/travel" className="trips-log-btn">+ Log new trip</Link>
          </div>

          {trips.length === 0 ? (
            <div className="trips-empty">
              <p>No trips logged yet.</p>
              <Link to="/travel" className="auth-btn" style={{ display: "inline-block", marginTop: "1rem" }}>
                Log your first trip
              </Link>
            </div>
          ) : (
            <div className="trips-list">
              {trips.map(t => <TripRow key={t.log_id} trip={t} />)}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}