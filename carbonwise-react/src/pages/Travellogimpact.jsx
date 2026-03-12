import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000";
const KG_PER_TREE = 21;
const PETROL_G_PER_KM = 210;

function useCountUp(target, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target && target !== 0) return;
    let s = null;
    const run = (t) => {
      if (!s) s = t;
      const p = Math.min((t - s) / duration, 1);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }, [target, duration]);
  return v;
}

function BalanceRing({ remaining, total }) {
  const pct = total > 0 ? Math.min(remaining / total, 1) : 0;
  const R = 38, C = 2 * Math.PI * R;
  const colour = pct > 0.5 ? "#00C853" : pct > 0.25 ? "#FFD600" : "#FF1744";
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle cx="48" cy="48" r={R} fill="none" stroke={colour} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${pct * C} ${C}`} strokeDashoffset={C * 0.25}
        style={{ transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 6px ${colour}80)` }} />
      <text x="48" y="44" textAnchor="middle" fill={colour} fontSize="13" fontWeight="700" fontFamily="'IBM Plex Mono',monospace">
        {(pct * 100).toFixed(0)}%
      </text>
      <text x="48" y="57" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="'IBM Plex Mono',monospace">
        LEFT
      </text>
    </svg>
  );
}

export function TripImpactPanel({ result, walletTotal = 2300, onClose, onViewWallet }) {
  const navigate = useNavigate();

  const [impact,      setImpact]      = useState(null);
  const [impactLoad,  setImpactLoad]  = useState(true);
  const [impactError, setImpactError] = useState(null);

  const panelRef = useRef(null);

  const emissionsKg = result?.emissions_kg      ?? 0;
  const distanceKm  = result?.distance_km       ?? 0;
  const vehicle     = result?.vehicle           ?? "Your vehicle";
  const remaining   = result?.remaining_credits ?? 0;
  const userId      = result?.user_id           ?? 1;

  // Fetch /impact/trip on mount (fast, pure maths)
  useEffect(() => {
    setImpactLoad(true);
    fetch(`${API}/impact/trip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, emissions_kg: emissionsKg, distance_km: distanceKm, vehicle }),
    })
      .then(r => r.json())
      .then(data => { if (data.error) throw new Error(data.error); setImpact(data); })
      .catch(e => setImpactError(e.message))
      .finally(() => setImpactLoad(false));
  }, []); // eslint-disable-line

  // Navigate to full graphical climate page
  const goToClimate = () => {
    onClose?.();
    navigate("/climate", {
      state: { emissions_kg: emissionsKg, distance_km: distanceKm, vehicle }
    });
  };

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const savedKg         = impact?.saved_kg                  ?? Math.max((distanceKm * PETROL_G_PER_KM / 1000) - emissionsKg, 0);
  const treesEquiv      = impact?.trees_equivalent          ?? savedKg / KG_PER_TREE;
  const walletRemaining = impact?.wallet?.remaining_credits ?? remaining;

  const animEmit   = useCountUp(emissionsKg,    800);
  const animSaved  = useCountUp(savedKg,        900);
  const animTrees  = useCountUp(treesEquiv,    1000);
  const animRemain = useCountUp(walletRemaining, 1000);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        :root{
          --eco:#00C853;--eco-dim:rgba(0,200,83,0.12);--eco-border:rgba(0,200,83,0.22);
          --bg:#0d0f0e;--bg-card:#141714;--bg-card2:#1a1d1a;
          --border:rgba(255,255,255,0.07);--text:#e8ede9;
          --text-dim:rgba(232,237,233,0.45);--red:#FF1744;
          --cc-gold:#F5C842;--radius:14px;--radius-sm:8px;
          --mono:'IBM Plex Mono',monospace;--sans:'DM Sans',system-ui,sans-serif;
        }
        *{box-sizing:border-box;margin:0;padding:0;}
        .tip-overlay{position:fixed;inset:0;z-index:900;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s ease;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .tip-sheet{width:100%;max-width:580px;background:var(--bg-card);border:1px solid var(--border);border-bottom:none;border-radius:var(--radius) var(--radius) 0 0;padding:0 0 2rem;max-height:92vh;overflow-y:auto;animation:slideUp .3s cubic-bezier(.4,0,.2,1);font-family:var(--sans);color:var(--text);}
        @keyframes slideUp{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
        .tip-handle{width:36px;height:4px;background:rgba(255,255,255,0.12);border-radius:99px;margin:12px auto 0;}
        .tip-header{display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem 0;}
        .tip-title{display:flex;align-items:center;gap:.5rem;font-size:1rem;font-weight:700;}
        .tip-close{background:var(--bg-card2);border:1px solid var(--border);color:var(--text-dim);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:.8rem;display:flex;align-items:center;justify-content:center;transition:color .15s;}
        .tip-close:hover{color:var(--text);}
        .tip-trip-strip{margin:1rem 1.5rem 0;background:var(--bg-card2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem 1rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;}
        .trip-strip-icon{font-size:1.3rem;}
        .trip-strip-info{flex:1;}
        .trip-strip-name{font-size:.88rem;font-weight:600;}
        .trip-strip-meta{font-size:.72rem;color:var(--text-dim);font-family:var(--mono);}
        .trip-strip-cc{font-family:var(--mono);font-size:.88rem;font-weight:700;color:#ff7070;background:rgba(255,112,112,0.08);border:1px solid rgba(255,112,112,0.18);border-radius:999px;padding:.2rem .65rem;}
        .trip-strip-cc::after{content:' CC';font-size:.7em;color:var(--cc-gold);font-weight:700;margin-left:.1em;}
        .tip-skeleton{margin:1rem 1.5rem 0;height:80px;background:linear-gradient(90deg,var(--bg-card2) 25%,rgba(255,255,255,0.04) 50%,var(--bg-card2) 75%);background-size:200% 100%;border-radius:var(--radius-sm);animation:shimmer 1.4s infinite;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .tip-metrics{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem;margin:1rem 1.5rem 0;}
        @media(max-width:420px){.tip-metrics{grid-template-columns:1fr 1fr;}}
        .tip-metric{background:var(--bg-card2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.85rem .9rem;display:flex;flex-direction:column;gap:.15rem;}
        .tip-metric-icon{font-size:1rem;margin-bottom:.1rem;}
        .tip-metric-val{font-family:var(--mono);font-size:1.2rem;font-weight:700;line-height:1.1;}
        .tip-metric-val--green{color:var(--eco);}
        .tip-metric-val--red{color:#ff7070;}
        .tip-metric-label{font-size:.68rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em;}
        .tip-balance{margin:1rem 1.5rem 0;display:flex;align-items:center;gap:1.25rem;background:var(--bg-card2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem 1.1rem;}
        .balance-text{flex:1;}
        .balance-label{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.3rem;}
        .balance-num{font-family:var(--mono);font-size:1.7rem;font-weight:700;color:var(--eco);line-height:1;text-shadow:0 0 20px rgba(0,200,83,.3);}
        .balance-num::after{content:' CC';font-size:.45em;color:var(--cc-gold);font-weight:700;letter-spacing:.06em;margin-left:.25em;vertical-align:middle;}
        .balance-sub{font-size:.72rem;color:var(--text-dim);margin-top:.3rem;font-family:var(--mono);}
        .proj-unlock-btn{margin:1rem 1.5rem 0;width:calc(100% - 3rem);background:linear-gradient(135deg,rgba(0,200,83,.12),rgba(0,200,83,.06));border:1px solid var(--eco-border);border-radius:var(--radius-sm);padding:1rem 1.25rem;cursor:pointer;display:flex;align-items:center;gap:.75rem;transition:background .2s,transform .1s;font-family:var(--sans);text-align:left;}
        .proj-unlock-btn:hover{background:rgba(0,200,83,.18);transform:translateY(-1px);}
        .proj-btn-icon{font-size:1.5rem;flex-shrink:0;}
        .proj-btn-text{flex:1;}
        .proj-btn-title{font-size:.88rem;font-weight:700;color:var(--eco);display:block;}
        .proj-btn-sub{font-size:.75rem;color:var(--text-dim);margin-top:.15rem;display:block;}
        .proj-btn-arrow{color:var(--eco);font-size:1.1rem;font-weight:700;}
        .tip-cta{display:flex;gap:.75rem;padding:1.25rem 1.5rem 0;flex-wrap:wrap;}
        .cta-primary{flex:1;background:var(--eco);color:#001a0d;font-weight:700;font-size:.85rem;border:none;border-radius:var(--radius-sm);padding:.7rem 1rem;cursor:pointer;transition:opacity .15s;white-space:nowrap;}
        .cta-primary:hover{opacity:.88;}
        .cta-secondary{flex:1;background:var(--bg-card2);color:var(--text-dim);font-weight:600;font-size:.85rem;border:1px solid var(--border);border-radius:var(--radius-sm);padding:.7rem 1rem;cursor:pointer;transition:color .15s,border-color .15s;white-space:nowrap;}
        .cta-secondary:hover{color:var(--text);border-color:rgba(255,255,255,.18);}
        .impact-error-bar{margin:1rem 1.5rem 0;font-size:.78rem;color:#ff6b6b;background:rgba(255,26,68,.08);border:1px solid rgba(255,26,68,.18);border-radius:var(--radius-sm);padding:.55rem .8rem;}
      `}</style>

      <div className="tip-overlay">
        <div className="tip-sheet" ref={panelRef}>
          <div className="tip-handle" />

          <div className="tip-header">
            <div className="tip-title">✅ Trip Logged</div>
            <button className="tip-close" onClick={onClose}>✕</button>
          </div>

          {/* Trip strip */}
          <div className="tip-trip-strip">
            <span className="trip-strip-icon">🚗</span>
            <div className="trip-strip-info">
              <div className="trip-strip-name">{vehicle}</div>
              <div className="trip-strip-meta">{distanceKm} km · just now</div>
            </div>
            <span className="trip-strip-cc">−{emissionsKg.toFixed(1)}</span>
          </div>

          {/* Skeleton while impact loads */}
          {impactLoad && <div className="tip-skeleton" />}
          {impactError && <div className="impact-error-bar">⚠ {impactError}</div>}

          {/* 3 metrics */}
          {!impactLoad && (
            <div className="tip-metrics">
              <div className="tip-metric">
                <span className="tip-metric-icon">💨</span>
                <span className="tip-metric-val tip-metric-val--red">{animEmit.toFixed(1)}</span>
                <span className="tip-metric-label">kg CO₂ emitted</span>
              </div>
              <div className="tip-metric">
                <span className="tip-metric-icon">🌱</span>
                <span className="tip-metric-val tip-metric-val--green">{animSaved.toFixed(1)}</span>
                <span className="tip-metric-label">kg saved vs petrol</span>
              </div>
              <div className="tip-metric">
                <span className="tip-metric-icon">🌳</span>
                <span className="tip-metric-val tip-metric-val--green">{animTrees.toFixed(2)}</span>
                <span className="tip-metric-label">tree-years equiv.</span>
              </div>
            </div>
          )}

          {/* Balance ring */}
          {!impactLoad && (
            <div className="tip-balance">
              <BalanceRing remaining={walletRemaining} total={walletTotal} />
              <div className="balance-text">
                <div className="balance-label">Remaining Balance</div>
                <div className="balance-num">{Math.round(animRemain).toLocaleString()}</div>
                <div className="balance-sub">of {walletTotal.toLocaleString()} CC annual budget</div>
              </div>
            </div>
          )}

          {/* ── Navigate to full climate page ── */}
          {!impactLoad && (
            <button className="proj-unlock-btn" onClick={goToClimate}>
              <span className="proj-btn-icon">🔭</span>
              <span className="proj-btn-text">
                <span className="proj-btn-title">See your 10-year climate impact</span>
                <span className="proj-btn-sub">Charts, data & Ml Projection→ full page</span>
              </span>
              <span className="proj-btn-arrow">→</span>
            </button>
          )}

          {/* CTAs */}
          <div className="tip-cta">
            <button className="cta-primary" onClick={onViewWallet}>🪙 View Wallet</button>
            <button className="cta-secondary" onClick={onClose}>Log another trip</button>
          </div>
        </div>
      </div>
    </>
  );
}