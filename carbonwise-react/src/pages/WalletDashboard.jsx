import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/wallet.css";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// ── fetch helper — surfaces the real error including Flask HTML 404s ──────
async function safeFetch(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (networkErr) {
    throw new Error(
      `Cannot reach the server at ${API}. ` +
      `Make sure Flask is running on port 5000. (${networkErr.message})`
    );
  }

  // Try JSON first; fall back to text so we never silently swallow errors
  const contentType = res.headers.get("content-type") || "";
  let body;
  if (contentType.includes("application/json")) {
    body = await res.json();
  } else {
    const text = await res.text();
    // Flask HTML 404/405 → extract the h1 if present, otherwise first 120 chars
    const match = text.match(/<title>([^<]+)<\/title>/i);
    body = { error: match ? match[1] : text.slice(0, 120) };
  }

  if (!res.ok) {
    const hint =
      res.status === 404
        ? " — The wallet blueprint may not be registered in app.py. " +
          "Add: from wallet_routes import wallet_bp; app.register_blueprint(wallet_bp)"
        : res.status === 405
        ? " — Wrong HTTP method. Check the route accepts GET."
        : "";
    throw new Error((body?.error || `${res.status} ${res.statusText}`) + hint);
  }

  return body;
}

// ── Carbon gauge SVG ──────────────────────────────────────────────────────
function CarbonGauge({ usedPct }) {
  const clampedPct  = Math.min(Math.max(usedPct, 0), 100);
  const R = 80, cx = 100, cy = 100;
  const startAngle  = Math.PI;
  const endAngle    = 0;
  const needleAngle = Math.PI - (clampedPct / 100) * Math.PI;

  const arcX1 = cx + R * Math.cos(startAngle);
  const arcY1 = cy + R * Math.sin(startAngle);
  const arcX2 = cx + R * Math.cos(endAngle);
  const arcY2 = cy + R * Math.sin(endAngle);

  const progressAngle = Math.PI - (clampedPct / 100) * Math.PI;
  const progX = cx + R * Math.cos(progressAngle);
  const progY = cy + R * Math.sin(progressAngle);
  const largeArc = clampedPct > 50 ? 1 : 0;

  const nX = cx + 65 * Math.cos(needleAngle);
  const nY = cy + 65 * Math.sin(needleAngle);

  const colour =
    clampedPct < 50 ? "#00C853" : clampedPct < 75 ? "#FFD600" :
    clampedPct < 90 ? "#FF9100" : "#FF1744";

  return (
    <svg viewBox="0 0 200 110" className="gauge-svg" aria-label={`Carbon usage: ${clampedPct.toFixed(1)}%`}>
      <path d={`M ${arcX1} ${arcY1} A ${R} ${R} 0 0 1 ${arcX2} ${arcY2}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round" />
      {clampedPct > 0 && (
        <path d={`M ${arcX1} ${arcY1} A ${R} ${R} 0 ${largeArc} 1 ${progX} ${progY}`}
          fill="none" stroke={colour} strokeWidth="12" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${colour}80)` }} />
      )}
      {[0, 25, 50, 75, 100].map(pct => {
        const a = Math.PI - (pct / 100) * Math.PI;
        return (
          <line key={pct}
            x1={cx + (R+6) * Math.cos(a)} y1={cy + (R+6) * Math.sin(a)}
            x2={cx + (R+14) * Math.cos(a)} y2={cy + (R+14) * Math.sin(a)}
            stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        );
      })}
      <line x1={cx} y1={cy} x2={nX} y2={nY}
        stroke={colour} strokeWidth="2.5" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${colour})` }} />
      <circle cx={cx} cy={cy} r="5" fill={colour} />
      <text x="18"  y="108" fill="rgba(255,255,255,0.35)" fontSize="9">0%</text>
      <text x="172" y="108" fill="rgba(255,255,255,0.35)" fontSize="9">100%</text>
    </svg>
  );
}

// ── Trip row ──────────────────────────────────────────────────────────────
function TripRow({ trip, onClimate }) {
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
        <span className="trip-km">
          {trip.distance_km?.toLocaleString(undefined, { maximumFractionDigits: 0 })} km
        </span>
        <span className="trip-co2 trip-co2--cc">−{trip.emissions_kg?.toFixed(1)}</span>
        <button className="trip-climate-btn" onClick={() => onClimate(trip)}
          title="See 10-year climate projection for this trip">
          🔭 <span className="trip-climate-label">Climate</span>
        </button>
      </div>
    </div>
  );
}

// ── Diagnostic error banner ───────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="wallet-error-banner">
      <div className="wallet-error-icon">⚠</div>
      <div className="wallet-error-body">
        <strong>Failed to load wallet</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="wallet-retry-btn">↺ Retry</button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function WalletDashboard() {
  const navigate = useNavigate();

  const rawId  = localStorage.getItem("cw_user_id");
  const userId = rawId && !isNaN(Number(rawId)) && Number(rawId) > 0
    ? Number(rawId) : null;

  const [wallet,  setWallet]  = useState(null);
  const [trips,   setTrips]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    if (!userId) { navigate("/login"); return; }

    setLoading(true);
    setError(null);

    // 1 — optional liveness check so we give a better message on total 404
    try {
      await safeFetch(`${API}/wallet/ping`);
    } catch (pingErr) {
      // ping failed → blueprint probably not registered
      setError(pingErr.message);
      setLoading(false);
      return;
    }

    // 2 — load wallet (critical)
    try {
      const walletData = await safeFetch(`${API}/wallet/${userId}`);
      setWallet(walletData);
    } catch (e) {
      setError(e.message);
      setLoading(false);
      return;
    }

    // 3 — load trips (non-critical)
    try {
      const tripsData = await safeFetch(`${API}/wallet/${userId}/log?limit=10`);
      setTrips(tripsData.trips || []);
    } catch {
      setTrips([]);
    }

    setLoading(false);
  }, [userId, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleClimate = (trip) =>
    navigate("/climate", {
      state: {
        emissions_kg: trip.emissions_kg,
        distance_km:  trip.distance_km,
        vehicle:      trip.vehicle || "Unknown vehicle",
        logged_at:    trip.logged_at,
      },
    });

  // ── render states ──
  if (!userId) return null;

  if (loading) {
    return (
      <div className="wallet-page">
        <div className="wallet-loading">
          <span className="wallet-loading-spinner" aria-hidden="true" />
          Loading wallet…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wallet-page">
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }

  if (!wallet) return null;

  const used      = wallet.used_credits      ?? 0;
  const remaining = wallet.remaining_credits ?? 0;
  const total     = wallet.total_credits     ?? 4600;
  const usedPct   = wallet.usage_pct         ?? 0;
  const stats     = wallet.stats             ?? {};

  const statusLabel =
    usedPct < 50 ? { text: "On track",     cls: "status-green"  } :
    usedPct < 75 ? { text: "Moderate use", cls: "status-yellow" } :
    usedPct < 90 ? { text: "High use",     cls: "status-orange" } :
                   { text: "Critical",     cls: "status-red"    };

  return (
    <div className="wallet-page">
      <style>{`
        .trip-climate-btn {
          display:inline-flex;align-items:center;gap:.25rem;
          background:rgba(0,200,83,.08);border:1px solid rgba(0,200,83,.2);
          border-radius:6px;padding:.22rem .55rem;
          font-size:.72rem;font-weight:700;color:#00C853;
          cursor:pointer;transition:background .15s,border-color .15s,transform .1s;
          white-space:nowrap;font-family:inherit;line-height:1;
        }
        .trip-climate-btn:hover{background:rgba(0,200,83,.16);border-color:rgba(0,200,83,.4);transform:translateY(-1px);}
        .trip-climate-btn:active{transform:translateY(0);}
        @media(max-width:380px){.trip-climate-label{display:none;}}
        .trip-metrics{display:flex;gap:.65rem;align-items:center;flex-shrink:0;}

        .wallet-loading{display:flex;align-items:center;gap:.75rem;justify-content:center;
          padding:4rem;color:rgba(232,237,233,.5);font-size:.95rem;}
        .wallet-loading-spinner{width:18px;height:18px;border-radius:50%;
          border:2px solid rgba(0,200,83,.2);border-top-color:#00C853;
          animation:_spin .75s linear infinite;}
        @keyframes _spin{to{transform:rotate(360deg);}}

        .wallet-error-banner{
          display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap;
          background:rgba(255,23,68,.08);border:1px solid rgba(255,23,68,.3);
          border-radius:12px;padding:1.4rem 1.6rem;
          margin:2rem auto;max-width:780px;
        }
        .wallet-error-icon{font-size:1.4rem;flex-shrink:0;margin-top:2px;}
        .wallet-error-body{flex:1;}
        .wallet-error-body strong{display:block;color:#ff5252;font-size:.95rem;margin-bottom:.4rem;}
        .wallet-error-body p{color:rgba(232,237,233,.7);font-size:.83rem;line-height:1.6;
          font-family:'DM Mono',monospace;margin:0;word-break:break-word;}
        .wallet-retry-btn{
          align-self:flex-start;background:rgba(255,23,68,.12);
          border:1px solid rgba(255,23,68,.35);border-radius:6px;
          padding:.35rem 1rem;color:#ff5252;font-weight:700;
          cursor:pointer;font-family:inherit;font-size:.82rem;
          transition:background .15s;white-space:nowrap;
        }
        .wallet-retry-btn:hover{background:rgba(255,23,68,.22);}
      `}</style>

      {/* ── Header ── */}
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
              <span className="hero-stat-value">
                {remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="hero-stat-label"><span className="cc-unit">CC</span> remaining</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value hero-stat-value--used">
                {used.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
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
            <span className="progress-header-cc">
              <span className="cc-badge"><span className="cc-badge-icon">🪙</span>CC</span>
              {" "}{used.toFixed(0)} / {total}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{
              width: `${Math.min(usedPct, 100)}%`,
              background:
                usedPct < 50 ? "#00C853" : usedPct < 75 ? "#FFD600" :
                usedPct < 90 ? "#FF9100" : "#FF1744",
            }} />
          </div>
          <div className="progress-ticks">
            <span>0</span><span>1150</span><span>2300</span><span>3450</span><span>4600 🪙</span>
          </div>
        </section>

        {/* ── 4-stat grid ── */}
        <div className="wallet-stat-grid">
          {[
            { label: "Trips this year",  value: stats.trips ?? 0,                                                                        unit: ""   },
            { label: "Distance driven",  value: (stats.total_km ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 }),            unit: "km" },
            { label: "Emissions logged", value: (stats.total_emissions_kg ?? 0).toFixed(1),                                              unit: "CC" },
            { label: "Per trip average", value: stats.trips ? ((stats.total_emissions_kg ?? 0) / stats.trips).toFixed(1) : "—",
              unit: stats.trips ? "CC" : "" },
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
            <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
              <button
                onClick={() => navigate("/climate")}
                style={{
                  display:"inline-flex",alignItems:"center",gap:"0.3rem",
                  background:"rgba(0,200,83,0.08)",border:"1px solid rgba(0,200,83,0.2)",
                  borderRadius:"6px",padding:"0.28rem 0.7rem",
                  fontSize:"0.75rem",fontWeight:700,color:"#00C853",
                  cursor:"pointer",fontFamily:"inherit",transition:"background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(0,200,83,0.15)"}
                onMouseLeave={e => e.currentTarget.style.background="rgba(0,200,83,0.08)"}
              >
                🔭 Overall projection
              </button>
              <Link to="/travel" className="trips-log-btn">+ Log new trip</Link>
            </div>
          </div>

          {trips.length === 0 ? (
            <div className="trips-empty">
              <p>No trips logged yet.</p>
              <Link to="/travel" className="auth-btn" style={{ display:"inline-block", marginTop:"1rem" }}>
                Log your first trip
              </Link>
            </div>
          ) : (
            <>
              <div style={{
                display:"flex",justifyContent:"flex-end",padding:"0 0 0.4rem",
                fontSize:"0.62rem",fontWeight:700,textTransform:"uppercase",
                letterSpacing:"0.07em",color:"rgba(232,237,233,0.25)",
              }}>
                <span style={{ marginRight:"0.4rem" }}>km</span>
                <span style={{ marginRight:"0.9rem" }}>CC</span>
                <span style={{ marginRight:"0.3rem" }}>impact</span>
              </div>
              <div className="trips-list">
                {trips.map(t => (
                  <TripRow key={t.log_id} trip={t} onClimate={handleClimate} />
                ))}
              </div>
            </>
          )}
        </section>

      </main>
    </div>
  );
}