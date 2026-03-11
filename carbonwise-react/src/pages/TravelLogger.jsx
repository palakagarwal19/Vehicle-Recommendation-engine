import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/wallet.css";

const API = "http://localhost:5000";

// ── Vehicle search with debounce ──────────────────────────────────────────
function VehicleSearch({ onSelect }) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${API}/vehicle-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch { setResults([]); }
      finally  { setLoading(false); }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function select(v) {
    setQuery(`${v.brand} ${v.model} ${v.year}`);
    setOpen(false);
    onSelect(v);
  }

  const badgeCls = t => {
    const m = { BEV: "bev", EV: "bev", HEV: "hev", PHEV: "phev", ICE: "ice" };
    return `badge badge-${m[(t||"").toUpperCase()] ?? "ice"}`;
  };

  return (
    <div className="vsearch-wrap" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <div className="vsearch-input-wrap">
        <svg className="vsearch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          className="vsearch-input"
          placeholder="Search brand or model…"
          value={query}
          onChange={e => { setQuery(e.target.value); onSelect(null); }}
          autoComplete="off"
        />
        {loading && <span className="vsearch-spinner" />}
        {query && (
          <button className="vsearch-clear" onClick={() => { setQuery(""); setResults([]); setOpen(false); onSelect(null); }}>
            ✕
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="vsearch-dropdown" tabIndex={-1}>
          {results.slice(0, 12).map((v, i) => (
            <li key={i} className="vsearch-item" onMouseDown={() => select(v)} tabIndex={0} onKeyDown={e => e.key === "Enter" && select(v)}>
              <span className="vsearch-name">{v.brand} {v.model}</span>
              <div className="vsearch-meta">
                <span className={badgeCls(v.vehicle_type)}>{v.vehicle_type}</span>
                <span className="vsearch-year">{v.year}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && results.length === 0 && !loading && query.length >= 2 && (
        <div className="vsearch-dropdown vsearch-empty">No vehicles found for "{query}"</div>
      )}
    </div>
  );
}

// ── Emission preview badge ────────────────────────────────────────────────
function EmissionPreview({ vehicle, distanceKm }) {
  const estimate = useMemo(() => {
    if (!vehicle || !distanceKm || distanceKm <= 0) return null;
    const vtype = (vehicle.vehicle_type || "").toUpperCase();
    let gPerKm = null;

    if (vtype === "ICE" || vtype === "HEV") {
      gPerKm = parseFloat(vehicle.co2_wltp_gpkm);
    } else if (vtype === "EV" || vtype === "BEV") {
      if (vehicle.electric_wh_per_km != null)
        gPerKm = parseFloat(vehicle.electric_wh_per_km) * 0.233 / 1000 * 1000;
    } else if (vtype === "PHEV") {
      if (vehicle.co2_wltp_gpkm != null && vehicle.electric_wh_per_km != null) {
        const elec = parseFloat(vehicle.electric_wh_per_km) * 0.233 / 1000 * 1000;
        gPerKm = 0.6 * elec + 0.4 * parseFloat(vehicle.co2_wltp_gpkm);
      } else if (vehicle.co2_wltp_gpkm != null) {
        gPerKm = parseFloat(vehicle.co2_wltp_gpkm);
      }
    }

    if (gPerKm == null || isNaN(gPerKm)) return null;
    return (gPerKm * distanceKm) / 1000;
  }, [vehicle, distanceKm]);

  if (estimate == null) return null;
  return (
    <div className="emission-preview">
      <span className="ep-label">Carbon Credits this trip will cost</span>
      <span className="ep-value">≈ {estimate.toFixed(2)} kg CO₂</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function TravelLogger() {
  const navigate  = useNavigate();
  const userId    = localStorage.getItem("cw_user_id");


  const [vehicle,    setVehicle]    = useState(null);
  const [distanceKm, setDistanceKm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState(null);   // last successful trip
  const [error,      setError]      = useState(null);

  useEffect(() => { if (!userId) navigate("/login"); }, [userId, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!vehicle || !distanceKm) return;
    const dist = parseFloat(distanceKm);
    if (isNaN(dist) || dist <= 0) { setError("Enter a valid distance."); return; }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res  = await fetch(`${API}/wallet/travel/by-name`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id:     parseInt(userId),
          brand:       vehicle.brand,
          model:       vehicle.model,
          year:        vehicle.year,
          distance_km: dist,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not log trip"); return; }
      setResult(data);
      setDistanceKm("");
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setSubmitting(false);
    }
  }



  return (
    <div className="wallet-page">

      {/* ── Page header ── */}
      <div className="wallet-page-header">
        <h1 className="wallet-page-title">
          <span className="wallet-page-title-icon">🚗</span>
          Log a Trip
        </h1>
        <Link to="/wallet" className="wallet-log-trip-btn" style={{background:"transparent",color:"var(--eco)",border:"1px solid var(--eco-border)"}}>← Back to Wallet</Link>
      </div>

      <main className="wallet-main">
        <div className="travel-layout">

          {/* ── Logger form ── */}
          <section className="travel-form-card card">
            <h2 className="travel-heading">Log a trip</h2>
            <p className="travel-sub">Select your vehicle, enter the distance, and we'll deduct the carbon cost from your wallet.</p>

            <form onSubmit={handleSubmit} className="travel-form">
              <div className="travel-field">
                <label>Vehicle</label>
                <VehicleSearch onSelect={setVehicle} />
                {vehicle && (
                  <div className="travel-vehicle-preview">
                    <span>{vehicle.brand} {vehicle.model}</span>
                    <span className={`badge badge-${(vehicle.vehicle_type||"").toLowerCase()}`}>{vehicle.vehicle_type}</span>
                    <span style={{ opacity: 0.5 }}>{vehicle.year}</span>
                  </div>
                )}
              </div>

              <div className="travel-field">
                <label>Distance</label>
                <div className="travel-distance-wrap">
                  <input
                    type="number"
                    className="travel-distance-input"
                    placeholder="0"
                    value={distanceKm}
                    onChange={e => setDistanceKm(e.target.value)}
                    min="0.1"
                    step="0.1"
                    required
                  />
                  <span className="travel-distance-unit">km</span>
                </div>
              </div>

              <EmissionPreview vehicle={vehicle} distanceKm={parseFloat(distanceKm) || 0} />

              {error && <p className="auth-error">⚠ {error}</p>}

              <button
                type="submit"
                className="auth-btn"
                disabled={!vehicle || !distanceKm || submitting}
              >
                {submitting ? "Logging…" : "Log trip & deduct credits"}
              </button>
            </form>
          </section>

          {/* ── Result card ── */}
          {result && (
            <section className="travel-result card">
              <div className="result-icon">✓</div>
              <h3>Trip logged</h3>

              <div className="result-trip">
                <div className="result-row">
                  <span>Vehicle</span>
                  <strong>{result.trip.vehicle}</strong>
                </div>
                <div className="result-row">
                  <span>Distance</span>
                  <strong>{result.trip.distance_km} km</strong>
                </div>
                <div className="result-row">
                  <span>Emissions</span>
                  <strong className="result-co2">−{result.trip.emissions_kg.toFixed(3)}</strong>
                </div>
              </div>

              <div className="result-wallet">
                <div className="result-wallet-label">Wallet after this trip</div>
                <div className="result-wallet-remaining">
                  {result.wallet.remaining_credits_kg.toLocaleString(undefined,{maximumFractionDigits:1})}
                  <span> kg remaining</span>
                </div>
                <div className="progress-track" style={{ marginTop: "0.75rem" }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(
                        ((result.wallet.total_credits_kg - result.wallet.remaining_credits_kg) / result.wallet.total_credits_kg) * 100,
                        100
                      )}%`,
                      background: "#00C853",
                    }}
                  />
                </div>
              </div>

              <Link to="/wallet" className="auth-btn" style={{ display: "block", textAlign: "center", marginTop: "1.25rem" }}>
                View wallet
              </Link>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}