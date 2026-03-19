import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const PETROL_G_PER_KM = 210;
const KG_PER_TREE     = 21;

// ── Safe fetch — never crashes on HTML error pages ────────────────────────
async function safeFetch(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (netErr) {
    throw new Error(
      `Cannot reach server at ${API}. Is Flask running? (${netErr.message})`
    );
  }

  const ct = res.headers.get("content-type") || "";
  let body;
  if (ct.includes("application/json")) {
    body = await res.json();
  } else {
    // Flask returned HTML (404/405/500) — extract <title> for a readable message
    const text  = await res.text();
    const match = text.match(/<title>([^<]+)<\/title>/i);
    const hint  = res.status === 404
      ? " — /impact/projection route not found. " +
        "Add to app.py: from impact_routes import impact_bp; app.register_blueprint(impact_bp)"
      : "";
    throw new Error((match ? match[1] : `${res.status} ${res.statusText}`) + hint);
  }

  if (!res.ok) {
    throw new Error(body?.error || `${res.status} ${res.statusText}`);
  }
  return body;
}

// ── Hooks ─────────────────────────────────────────────────────────────────
function useCountUp(target, duration = 1200, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target == null) return;
    let raf, start = null;
    const timeout = setTimeout(() => {
      const run = (t) => {
        if (!start) start = t;
        const p = Math.min((t - start) / duration, 1);
        setV(target * (1 - Math.pow(1 - p, 4)));
        if (p < 1) raf = requestAnimationFrame(run);
      };
      raf = requestAnimationFrame(run);
    }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return v;
}

// ── Area chart ────────────────────────────────────────────────────────────
function AreaChart({ years, petrolYears, animated }) {
  const W = 600, H = 220, PAD = { t: 20, r: 20, b: 40, l: 56 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  if (!years?.length) return null;
  const allVals = [...years, ...petrolYears].map(y => y.cumulative_co2_kg);
  const maxVal  = Math.max(...allVals) * 1.1;
  const toX = (i) => PAD.l + (i / (years.length - 1)) * innerW;
  const toY = (v) => PAD.t + innerH - (v / maxVal) * innerH;
  const makeLine = (arr) => arr.map((y, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(y.cumulative_co2_kg).toFixed(1)}`).join(" ");
  const makeArea = (arr) => `${makeLine(arr)} L ${toX(arr.length - 1).toFixed(1)} ${(PAD.t + innerH).toFixed(1)} L ${toX(0).toFixed(1)} ${(PAD.t + innerH).toFixed(1)} Z`;
  const yTicks   = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: maxVal * f, y: toY(maxVal * f) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="uG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#00C853" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#00C853" stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id="pG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FF1744" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#FF1744" stopOpacity="0.03" />
        </linearGradient>
        <clipPath id="cC">
          <rect x={PAD.l} y={PAD.t} height={innerH}
            width={animated ? innerW : 0}
            style={{ transition: "width 1.8s cubic-bezier(0.4,0,0.2,1)" }} />
        </clipPath>
      </defs>

      {yTicks.map(({ v, y }) => (
        <g key={v}>
          <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
          <text x={PAD.l - 6} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.22)" fontSize="8.5" fontFamily="'IBM Plex Mono',monospace">
            {v >= 1000 ? `${(v / 1000).toFixed(0)}t` : v.toFixed(0)}
          </text>
        </g>
      ))}

      {years.map((y, i) => i % 2 === 0 && (
        <text key={y.year} x={toX(i)} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="8.5" fontFamily="'IBM Plex Mono',monospace">
          {y.year}
        </text>
      ))}

      <path d={makeArea(petrolYears)} fill="url(#pG)" clipPath="url(#cC)" />
      <path d={makeLine(petrolYears)} fill="none" stroke="#FF1744" strokeWidth="2" strokeLinecap="round" clipPath="url(#cC)" style={{ filter: "drop-shadow(0 0 5px rgba(255,23,68,0.55))" }} />
      <path d={makeArea(years)} fill="url(#uG)" clipPath="url(#cC)" />
      <path d={makeLine(years)} fill="none" stroke="#00C853" strokeWidth="2.5" strokeLinecap="round" clipPath="url(#cC)" style={{ filter: "drop-shadow(0 0 7px rgba(0,200,83,0.65))" }} />
      {years.map((y, i) => (
        <circle key={i} cx={toX(i)} cy={toY(y.cumulative_co2_kg)} r="3.5" fill="#00C853" clipPath="url(#cC)" style={{ filter: "drop-shadow(0 0 4px #00C853)" }}>
          <title>{y.year}: {y.cumulative_co2_kg.toFixed(0)} kg</title>
        </circle>
      ))}

      <g transform={`translate(${PAD.l + 6},${PAD.t + 7})`}>
        <rect width="12" height="3" y="-1.5" rx="1.5" fill="#00C853" />
        <text x="16" y="3.5" fill="rgba(255,255,255,0.45)" fontSize="8.5" fontFamily="'IBM Plex Mono',monospace">Your vehicle</text>
        <rect x="96" width="12" height="3" y="-1.5" rx="1.5" fill="#FF1744" />
        <text x="112" y="3.5" fill="rgba(255,255,255,0.45)" fontSize="8.5" fontFamily="'IBM Plex Mono',monospace">Petrol baseline</text>
      </g>
    </svg>
  );
}

// ── Earth globe ───────────────────────────────────────────────────────────
function Earth({ hot, size = 90 }) {
  const id = hot ? "hG2" : "cG2";
  return (
    <svg width={size} height={size} viewBox="0 0 90 90"
      style={{ animation: hot ? "pHot 3s ease-in-out infinite" : "bCool 4s ease-in-out infinite" }}>
      <defs>
        <radialGradient id={id} cx="38%" cy="35%" r="62%">
          <stop offset="0%"   stopColor={hot ? "#FF9100" : "#2d8a55"} />
          <stop offset="100%" stopColor={hot ? "#8B0000" : "#0d3320"} />
        </radialGradient>
      </defs>
      <circle cx="45" cy="45" r="43" fill={hot ? "rgba(255,80,0,0.15)" : "rgba(0,200,83,0.1)"} />
      <circle cx="45" cy="45" r="36" fill={`url(#${id})`} />
      <ellipse cx="37" cy="35" rx="11" ry="15" fill={hot ? "#a93226" : "#1a6b38"} opacity="0.7" transform="rotate(-15,37,35)" />
      <ellipse cx="57" cy="43" rx="8"  ry="11" fill={hot ? "#c0392b" : "#27ae60"} opacity="0.6" transform="rotate(22,57,43)" />
      <ellipse cx="44" cy="61" rx="10" ry="6"  fill={hot ? "#a93226" : "#1a6b38"} opacity="0.5" />
      <ellipse cx="32" cy="31" rx="9"  ry="5"  fill="rgba(255,255,255,0.1)" transform="rotate(-30,32,31)" />
      {hot && (
        <>
          <circle cx="45" cy="45" r="39" fill="none" stroke="rgba(255,100,0,0.25)" strokeWidth="4" />
          <circle cx="45" cy="45" r="44" fill="none" stroke="rgba(255,50,0,0.12)"  strokeWidth="6" />
        </>
      )}
    </svg>
  );
}

// ── Growing forest ────────────────────────────────────────────────────────
function GrowingForest({ years }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    ref.current = setInterval(() => setIdx(i => (i + 1) % years.length), 900);
    return () => clearInterval(ref.current);
  }, [years.length]);

  const y    = years[idx] || {};
  const trees = Math.round(y.trees_absorbed ?? 0);
  const MAX = 80, lit = Math.min(trees, MAX);

  return (
    <div>
      <div style={{ display: "flex", gap: ".35rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {years.map((yr, i) => (
          <button key={yr.year} onClick={() => { setIdx(i); clearInterval(ref.current); }}
            style={{ background: i === idx ? "rgba(0,200,83,0.12)" : "#181c19", border: `1px solid ${i === idx ? "rgba(0,200,83,0.25)" : "rgba(255,255,255,0.07)"}`, color: i === idx ? "#00C853" : "rgba(221,232,222,0.42)", borderRadius: "6px", padding: ".22rem .55rem", fontSize: ".7rem", fontFamily: "'IBM Plex Mono',monospace", cursor: "pointer", fontWeight: i === idx ? 700 : 400, transition: "all .15s" }}>
            {yr.year}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: ".7rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
          {Array.from({ length: MAX }).map((_, i) => (
            <span key={i} style={{ fontSize: "1rem", userSelect: "none", opacity: i < lit ? 1 : .07, filter: i < lit ? "none" : "grayscale(1)", animation: i < lit ? `tPop .35s ${(i * 22) % 450}ms ease both` : "none" }}>🌳</span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: ".15rem" }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.2rem", fontWeight: 700, color: "#00C853" }}>{trees.toLocaleString()}</span>
          <span style={{ fontSize: ".72rem", color: "rgba(221,232,222,0.42)" }}>trees absorbing CO₂ in {y.year}</span>
          {trees > MAX && <span style={{ fontSize: ".68rem", color: "#00C853", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }}>+{(trees - MAX).toLocaleString()} more</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function ClimateProjection() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const userId    = localStorage.getItem("cw_user_id") || 1;

  const tripData = state
    ? (state.trip ?? {
        emissions_kg: state.emissions_kg,
        distance_km:  state.distance_km,
        vehicle:      state.vehicle ?? "Your vehicle",
      })
    : null;

  const [proj,    setProj]    = useState(state?.projection ?? null);
  const [loading, setLoading] = useState(!state?.projection);
  const [error,   setError]   = useState(null);
  const [ready,   setReady]   = useState(false);

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (tripData?.emissions_kg != null && tripData?.distance_km != null) {
        // Specific trip — POST
        data = await safeFetch(`${API}/impact/projection`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            user_id:     parseInt(userId),
            emissions_kg: tripData.emissions_kg,
            distance_km:  tripData.distance_km,
            vehicle:      tripData.vehicle,
          }),
        });
      } else {
        // No trip state — derive from wallet history
        data = await safeFetch(`${API}/impact/projection/${userId}`);
      }
      setProj(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tripData, userId]);

  useEffect(() => { if (!proj) doFetch(); }, []);
  useEffect(() => {
    if (proj) {
      const t = setTimeout(() => setReady(true), 250);
      return () => clearTimeout(t);
    }
  }, [proj]);

  const years       = proj?.years ?? [];
  const last        = years[years.length - 1];
  const userTotal   = last?.cumulative_co2_kg ?? 0;
  const freq        = tripData ? (tripData.distance_km > 50 ? 1 : 5) : 5;
  const petrolAnn   = tripData
    ? (tripData.distance_km * PETROL_G_PER_KM / 1000) * freq * 52
    : (userTotal / 10) * 2.4;
  const petrolYears = years.map((y, i) => ({ year: y.year, cumulative_co2_kg: petrolAnn * (i + 1) }));
  const petrolTotal = petrolAnn * 10;
  const savedTotal  = Math.max(petrolTotal - userTotal, 0);
  const treesUser   = Math.round(userTotal  / KG_PER_TREE);
  const treesPetrol = Math.round(petrolTotal / KG_PER_TREE);
  const treesSaved  = savedTotal / KG_PER_TREE;

  const aSaved  = useCountUp(savedTotal / 1000, 1400, 300);
  const aTrees  = useCountUp(treesSaved,         1400, 500);
  const aVsBase = useCountUp(proj?.vs_baseline_pct ?? 0, 1200, 200);
  const aC_u    = useCountUp(userTotal,   1200, 300);
  const aC_p    = useCountUp(petrolTotal, 1200, 300);
  const aT_u    = useCountUp(treesUser,   1200, 500);
  const aT_p    = useCountUp(treesPetrol, 1200, 500);
  const vsCol   = aVsBase < 60 ? "#00C853" : aVsBase < 85 ? "#FFD600" : "#FF1744";

  const S = {
    page:   { minHeight: "100vh", background: "#090b0a", color: "#dde8de", fontFamily: "'DM Sans',sans-serif", backgroundImage: "radial-gradient(ellipse 90% 55% at 50% -5%,rgba(0,200,83,0.065) 0%,transparent 65%),radial-gradient(ellipse 50% 40% at 92% 100%,rgba(255,23,68,0.04) 0%,transparent 60%)" },
    header: { maxWidth: "1000px", margin: "0 auto", padding: "2.5rem 1.5rem .5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" },
    main:   { maxWidth: "1000px", margin: "0 auto", padding: "1.5rem 1.5rem 5rem", display: "flex", flexDirection: "column", gap: "1.5rem" },
    card:   { background: "#111412", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "1.75rem" },
    eye:    { fontSize: ".62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(221,232,222,0.42)", display: "flex", alignItems: "center", gap: ".5rem", marginBottom: "1rem" },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes pHot{0%,100%{filter:drop-shadow(0 0 8px rgba(255,100,0,.5))}50%{filter:drop-shadow(0 0 22px rgba(255,100,0,.85))}}
        @keyframes bCool{0%,100%{filter:drop-shadow(0 0 7px rgba(0,200,83,.4))}50%{filter:drop-shadow(0 0 18px rgba(0,200,83,.75))}}
        @keyframes tPop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
        @keyframes floatG{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes lSweep{0%{width:0;margin-left:0}50%{width:80%;margin-left:0}100%{width:0;margin-left:100%}}
      `}</style>

      <div style={S.page}>
        <div style={S.header}>
          <Link to="/travel" style={{ fontSize: ".8rem", color: "rgba(221,232,222,0.42)", textDecoration: "none", fontWeight: 600 }}>← Back</Link>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: ".62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "#00C853", marginBottom: ".3rem" }}>🔭 10-Year Prediction</div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(1.5rem,4vw,2.3rem)", fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.1 }}>Your Climate Story</h1>
            <p style={{ fontSize: ".82rem", color: "rgba(221,232,222,0.42)", marginTop: ".4rem" }}>{tripData?.vehicle ?? "Your vehicle"} · {tripData?.distance_km ?? "—"} km/trip</p>
          </div>
          <div style={{ width: 60 }} />
        </div>

        <main style={S.main}>

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", minHeight: "60vh", textAlign: "center" }}>
              <div style={{ animation: "floatG 3s ease-in-out infinite" }}><Earth hot={false} size={110} /></div>
              <div>
                <p style={{ fontSize: ".9rem", color: "rgba(221,232,222,0.42)" }}>Modelling your climate future…</p>
                <p style={{ fontSize: ".72rem", color: "rgba(255,255,255,.18)", fontFamily: "'IBM Plex Mono',monospace", marginTop: ".3rem" }}>Building 10-year CO₂ projections</p>
              </div>
              <div style={{ width: "160px", height: "3px", background: "rgba(255,255,255,.06)", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#00C853", borderRadius: "99px", animation: "lSweep 1.6s ease-in-out infinite" }} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(255,23,68,0.07)", border: "1px solid rgba(255,23,68,0.25)", borderRadius: "12px", padding: "1.5rem 1.75rem", maxWidth: "680px", margin: "2rem auto" }}>
              <p style={{ color: "#ff5252", fontWeight: 700, marginBottom: ".5rem" }}>⚠ Failed to load projection</p>
              <p style={{ fontSize: ".82rem", color: "rgba(221,232,222,0.6)", fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.6, wordBreak: "break-word" }}>{error}</p>
              <button onClick={doFetch} style={{ marginTop: "1.25rem", background: "#00C853", color: "#001a0d", border: "none", padding: ".6rem 1.4rem", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontSize: ".85rem" }}>↺ Retry</button>
            </div>
          )}

          {/* Content */}
          {!loading && !error && proj && (
            <>
              {/* Globe hero */}
              <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "center", gap: "2rem", flexWrap: "wrap", padding: "2.25rem 1.75rem", background: "radial-gradient(ellipse 80% 80% at 50% 50%,rgba(0,200,83,0.04),#111412)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg,transparent,transparent 32px,rgba(255,255,255,0.012) 32px,rgba(255,255,255,0.012) 33px)", pointerEvents: "none" }} />
                {[
                  { label: "Petrol baseline", hot: true,  co2: petrolTotal, col: "#FF1744" },
                  null,
                  { label: "Your vehicle",    hot: false, co2: userTotal,   col: "#00C853" },
                ].map((side, i) => side === null ? (
                  <div key="mid" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".4rem", zIndex: 1 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.6rem", fontWeight: 800, color: "#00C853", textShadow: "0 0 30px rgba(0,200,83,.4)", whiteSpace: "nowrap" }}>−{aSaved.toFixed(1)}t</div>
                    <svg width="72" height="14" viewBox="0 0 72 14" fill="none">
                      <path d="M0 7h62M54 1l10 6-10 6" stroke="#00C853" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 4px #00C853)" }} />
                    </svg>
                    <div style={{ fontSize: ".68rem", color: "rgba(221,232,222,0.42)" }}>saved over 10 years</div>
                  </div>
                ) : (
                  <div key={side.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".7rem", zIndex: 1 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: side.col }}>{side.label}</div>
                    <Earth hot={side.hot} size={92} />
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: ".78rem", color: "rgba(221,232,222,0.42)" }}>{(side.co2 / 1000).toFixed(1)} t CO₂</div>
                  </div>
                ))}
              </div>

              {/* Scenario cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {[
                  { label: "⛽ Petrol Car — Before", co2: aC_p, trees: aT_p, temp: `+${((proj.temp_rise_avoided_c ?? 0) * 1.4).toFixed(3)}°C`, col: "#FF1744", bg: "rgba(255,23,68,0.05)",  bc: "rgba(255,23,68,0.2)",  hot: true,  emoji: "🌡️" },
                  { label: `🌿 ${tripData?.vehicle ?? "Your vehicle"}`, co2: aC_u, trees: aT_u, temp: `${proj.temp_rise_avoided_c?.toFixed(3)}°C avoided`, col: "#00C853", bg: "rgba(0,200,83,0.05)", bc: "rgba(0,200,83,0.18)", hot: false, emoji: "❄️" },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.bc}`, borderRadius: "10px", padding: "1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: ".7rem", marginBottom: "1rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: s.col }}>{s.label}</div>
                        <div style={{ fontSize: ".63rem", color: "rgba(221,232,222,0.42)", marginTop: ".1rem" }}>10-year total</div>
                      </div>
                      <Earth hot={s.hot} size={56} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.55rem", fontWeight: 700, color: s.col, lineHeight: 1 }}>{(s.co2 / 1000).toFixed(1)}</div>
                        <div style={{ fontSize: ".58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#F5C842" }}>tonnes CO₂</div>
                      </div>
                      <div style={{ width: "1px", height: "40px", background: "rgba(255,255,255,0.07)" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.55rem", fontWeight: 700, color: s.col, lineHeight: 1 }}>{Math.round(s.trees).toLocaleString()}</div>
                        <div style={{ fontSize: ".58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#F5C842" }}>trees</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: ".4rem", fontSize: ".73rem", color: "rgba(221,232,222,0.42)", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px", padding: ".4rem .7rem" }}>
                      <span>{s.emoji}</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: ".75rem" }}>{s.temp}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={S.card}>
                <div style={{ ...S.eye }}>📈 Cumulative CO₂ accumulation</div>
                <p style={{ fontSize: ".76rem", color: "rgba(221,232,222,0.42)", marginBottom: "1.25rem" }}>
                  Green = your vehicle · Red = petrol baseline · ~{freq === 1 ? "1 trip/week" : `${freq} trips/week`}
                </p>
                <AreaChart years={years} petrolYears={petrolYears} animated={ready} />
              </div>

              {/* Savings hero */}
              <div style={{ textAlign: "center", padding: "2.25rem 1.75rem", background: "radial-gradient(ellipse 70% 70% at 50% 50%,rgba(0,200,83,.07),transparent)", borderRadius: "10px", border: "1px dashed rgba(0,200,83,.22)" }}>
                <div style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#00C853", marginBottom: ".75rem" }}>🌍 Total CO₂ prevented over 10 years</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(2.4rem,6.5vw,3.8rem)", fontWeight: 800, color: "#00C853", lineHeight: 1, textShadow: "0 0 60px rgba(0,200,83,.3)" }}>
                  {aSaved.toFixed(1)}<span style={{ fontSize: "1.1rem", color: "rgba(255,255,255,.3)", marginLeft: ".3rem" }}>tonnes</span>
                </div>
                <div style={{ fontSize: ".76rem", color: "rgba(221,232,222,0.42)", marginTop: ".5rem" }}>
                  ≈ {Math.round(aTrees).toLocaleString()} trees absorbing carbon for an entire year
                </div>
              </div>

              {/* Stats strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1px", background: "rgba(255,255,255,0.07)", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                {[
                  { ico: "🌡️", val: proj.temp_rise_avoided_c?.toFixed(3),      unit: "°C",           lbl: "temperature rise avoided" },
                  { ico: "🌳", val: proj.trees_to_offset?.toLocaleString(),     unit: "trees",        lbl: "needed to offset 10yr total" },
                  { ico: "⛽", val: proj.petrol_litres_equiv?.toLocaleString(), unit: "litres",       lbl: "of petrol not burned" },
                  { ico: "📊", val: `${aVsBase.toFixed(0)}%`,                  unit: "of avg driver",lbl: "your emissions vs average", col: vsCol },
                ].map(s => (
                  <div key={s.lbl} style={{ background: "#111412", padding: "1.2rem 1rem", display: "flex", flexDirection: "column", gap: ".18rem" }}>
                    <span style={{ fontSize: "1rem", marginBottom: ".15rem" }}>{s.ico}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.25rem", fontWeight: 700, color: s.col ?? "#dde8de", lineHeight: 1.1 }}>{s.val}</span>
                    <span style={{ fontSize: ".58rem", color: "#F5C842", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>{s.unit}</span>
                    <span style={{ fontSize: ".62rem", color: "rgba(221,232,222,0.42)", marginTop: ".05rem" }}>{s.lbl}</span>
                  </div>
                ))}
              </div>

              {/* Forest */}
              <div style={S.card}>
                <div style={S.eye}>🌳 Your forest — year by year</div>
                <GrowingForest years={years} />
              </div>

              {/* Narrative */}
              {proj.narrative && (
                <div style={{ ...S.card, display: "flex", gap: "1rem", alignItems: "flex-start", background: "rgba(245,200,66,.05)", border: "1px solid rgba(245,200,66,.14)" }}>
                  <span style={{ fontSize: "1.6rem", flexShrink: 0, marginTop: ".1rem" }}>🌍</span>
                  <p style={{ fontSize: ".88rem", lineHeight: 1.75, color: "#dde8de" }}>{proj.narrative}</p>
                </div>
              )}

              {/* Note if no trips */}
              {proj.note && (
                <div style={{ textAlign: "center", fontSize: ".75rem", color: "rgba(221,232,222,0.3)", fontFamily: "'IBM Plex Mono',monospace", padding: ".5rem" }}>
                  ℹ {proj.note}
                </div>
              )}

              {/* CTAs */}
              <div style={{ display: "flex", gap: ".85rem", justifyContent: "center", flexWrap: "wrap" }}>
                <Link to="/wallet"        style={{ background: "#00C853",            color: "#001a0d",                    fontWeight: 700, fontSize: ".88rem", border: "none", borderRadius: "10px", padding: ".78rem 1.5rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: ".4rem" }}>🪙 View Wallet</Link>
                <Link to="/carbon-impact" style={{ background: "rgba(0,200,83,0.1)", color: "#00C853",                    border: "1px solid rgba(0,200,83,0.2)", borderRadius: "10px", padding: ".78rem 1.3rem", fontSize: ".88rem", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>🌿 Impact Dashboard</Link>
                <Link to="/travel"        style={{ background: "transparent",        color: "rgba(221,232,222,0.42)",     border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: ".78rem 1.3rem", fontSize: ".88rem", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Log another trip</Link>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}