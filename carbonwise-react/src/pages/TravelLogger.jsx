import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/wallet.css";
import { TripImpactPanel } from "./TravelLogImpact";

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

  const [vehicle,     setVehicle]     = useState(null);
  const [distanceKm,  setDistanceKm]  = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [tripResult,  setTripResult]  = useState(null);   // drives impact panel
  const [error,       setError]       = useState(null);

  useEffect(() => { if (!userId) navigate("/login"); }, [userId, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!vehicle || !distanceKm) return;
    const dist = parseFloat(distanceKm);
    if (isNaN(dist) || dist <= 0) { setError("Enter a valid distance."); return; }

    setSubmitting(true);
    setError(null);

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

      // ── normalise response shape for TripImpactPanel ──────────────────
      // The panel expects: emissions_kg, distance_km, remaining_credits, vehicle
      const normalised = {
        emissions_kg:      data.trip?.emissions_kg      ?? data.emissions_kg      ?? 0,
        distance_km:       data.trip?.distance_km       ?? data.distance_km       ?? dist,
        remaining_credits: data.wallet?.remaining_credits_kg ?? data.remaining_credits ?? 0,
        vehicle:           data.trip?.vehicle           ?? `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
        // keep the raw response too in case the panel or caller needs it
        _raw: data,
      };
      setTripResult(normalised);
      setDistanceKm("");
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePanelClose() {
    setTripResult(null);
    // Optionally reset the vehicle so the user can quickly log the next trip:
    // setVehicle(null);
  }

  return (
    <div className="wallet-page">

      {/* ── Page header ── */}
      <div className="wallet-page-header">
        <h1 className="wallet-page-title">
          <span className="wallet-page-title-icon">🚗</span>
          Log a Trip
        </h1>
        <Link
          to="/wallet"
          className="wallet-log-trip-btn"
          style={{ background: "transparent", color: "var(--eco)", border: "1px solid var(--eco-border)" }}
        >
          ← Back to Wallet
        </Link>
      </div>

      <main className="wallet-main">
        <div className="travel-layout">

          {/* ── Logger form ── */}
          <section className="travel-form-card card">
            <h2 className="travel-heading">Log a trip</h2>
            <p className="travel-sub">
              Select your vehicle, enter the distance, and we'll deduct the carbon cost from your wallet.
            </p>

            <form onSubmit={handleSubmit} className="travel-form">
              <div className="travel-field">
                <label>Vehicle</label>
                <VehicleSearch onSelect={setVehicle} />
                {vehicle && (
                  <div className="travel-vehicle-preview">
                    <span>{vehicle.brand} {vehicle.model}</span>
                    <span className={`badge badge-${(vehicle.vehicle_type || "").toLowerCase()}`}>
                      {vehicle.vehicle_type}
                    </span>
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
                {submitting
                  ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(0,26,13,0.3)", borderTopColor: "#001a0d", borderRadius: "50%", animation: "spin 0.7s linear infinite", marginRight: 8, verticalAlign: "middle" }} />Logging…</>
                  : "Log trip & deduct credits"}
              </button>
            </form>
          </section>

          {/* ── Right column hint (shown before first trip) ── */}
          {!tripResult && (
            <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "flex-start", justifyContent: "center" }}>
              <span style={{ fontSize: "2.5rem" }}>🌿</span>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>See your impact instantly</h3>
              <p style={{ fontSize: "0.83rem", color: "var(--text-dim)", lineHeight: 1.6, margin: 0 }}>
                After logging a trip you'll see exactly how much CO₂ you saved vs a petrol car, your remaining carbon budget, and — powered by ML Model — a 10-year climate projection based on your driving habits.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
                {[
                  { icon: "🌱", text: "kg CO₂ saved vs petrol baseline" },
                  { icon: "🪙", text: "Remaining carbon credit balance" },
                  { icon: "🌳", text: "How many trees your savings equal" },
                  { icon: "🔭", text: "10-year climate projection" },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    <span style={{ fontSize: "1rem" }}>{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </main>

      {/* ── Impact bottom-sheet — mounts after successful trip POST ── */}
      {tripResult && (
        <TripImpactPanel
          result={tripResult}
          walletTotal={4600}
          onClose={handlePanelClose}
          onViewWallet={() => navigate("/wallet")}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}