import { useState, useRef, useEffect } from 'react';
import apiClient from '../services/api';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/* ── helpers ── */
const fmt = (n, d = 0) =>
  n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: d }) : '—';

/* ── skeleton ── */
const Sk = ({ w = '100%', h = 16, r = 6, style = {} }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: 'linear-gradient(90deg,rgba(0,200,83,.06) 25%,rgba(0,200,83,.14) 50%,rgba(0,200,83,.06) 75%)',
    backgroundSize: '600px 100%',
    animation: 'shimmer 1.6s infinite linear',
    ...style,
  }} />
);

/* ── Risk config ── */
const RISK_CONFIG = {
  high:   { color: '#FF5252', bg: 'rgba(255,82,82,.1)',   border: 'rgba(255,82,82,.25)',   icon: '🚨', label: 'HIGH RISK' },
  medium: { color: '#FF9800', bg: 'rgba(255,152,0,.1)',   border: 'rgba(255,152,0,.25)',   icon: '⚠️', label: 'MEDIUM RISK' },
  low:    { color: '#69F0AE', bg: 'rgba(105,240,174,.1)', border: 'rgba(105,240,174,.25)', icon: '✅', label: 'LOW RISK' },
};
const RISK_MAP = {
  safe: 'low', caution: 'medium', warning: 'high', violation: 'high',
  low: 'low', medium: 'medium', high: 'high',
};
const normaliseRisk  = (l) => RISK_MAP[(l || 'safe').toLowerCase()] || 'low';
const getRisk        = (l) => RISK_CONFIG[normaliseRisk(l)] || RISK_CONFIG.low;

/* ── FIX 3/4: label aspirational and unverified findings distinctly ── */
const findingMeta = (f) => {
  if (f.is_aspirational) return { icon: '📋', tag: 'Aspirational', tagColor: 'rgba(255,255,255,.35)', muted: true };
  if (f.is_unverified)   return { icon: '❓', tag: 'Unverified',   tagColor: '#FFD600',               muted: false };
  return null;
};

/* ── Normalise backend /greenwashing response ── */
const normaliseAnalysis = (raw) => {
  if (!raw) return raw;

  const webClaims = (raw.web_findings || raw.web_claims || []).map(wf => {
    // FIX 1: aspirational/unverified web claims are NOT misleading
    const isAspirational = wf.is_aspirational === true;
    const isUnverified   = wf.is_unverified   === true;
    const isAccurate     = isAspirational || isUnverified
      ? true
      : normaliseRisk(wf.risk_level) === 'low';

    return {
      claim:        wf.claim || wf.claim_text || '',
      source:       wf.source || 'Unknown',
      source_url:   wf.source_url || null,
      risk_level:   normaliseRisk(wf.risk_level),
      reason:       wf.reason || '',
      suggestion:   wf.suggestion || '',
      context:      wf.context || '',
      is_aspirational: isAspirational,
      is_unverified:   isUnverified,
      verification: {
        is_accurate:  isAccurate,
        severity:     normaliseRisk(wf.risk_level),
        explanation:  wf.reason || '',
      },
    };
  });

  const findings = (raw.findings || []).map(f =>
    typeof f === 'object' && f !== null
      ? { ...f, risk_level: normaliseRisk(f.risk_level) }
      : f
  );

  const level = normaliseRisk(raw.overall_risk || raw.risk_level);

  // FIX 2: use backend-computed transparency_score if present (penalty model);
  // only fall back to heuristic if missing
  const score = raw.transparency_score != null
    ? raw.transparency_score
    : (() => {
        const base = level === 'high' ? 32 : level === 'medium' ? 58 : 82;
        const n = (raw.web_findings || []).length + (raw.findings || []).length;
        return Math.max(10, base - n * 3);
      })();

  return {
    ...raw,
    overall_risk:       level,
    findings,
    web_claims:         webClaims,
    // FIX 5: backend sends pre-filtered misleading_claims; use directly
    misleading_claims:  raw.misleading_claims || [],
    structural_flags:   raw.structural_flags  || [],
    transparency_score: score,
  };
};

/* ── Powertrain colours ── */
const PT_COL = { EV:'#00C853', BEV:'#00C853', PHEV:'#69F0AE', HEV:'#B2DFDB', ICE:'#FF7043' };
const ptC = (t) => PT_COL[t] || '#69F0AE';

const COUNTRIES = [
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'DE', label: '🇩🇪 Germany' },
  { value: 'FR', label: '🇫🇷 France' },
  { value: 'UK', label: '🇬🇧 United Kingdom' },
  { value: 'CN', label: '🇨🇳 China' },
  { value: 'JP', label: '🇯🇵 Japan' },
  { value: 'IN', label: '🇮🇳 India' },
];

/* ── sub-components ── */
const Spin = ({ size = 16, color = '#00C853', track = 'rgba(0,200,83,.25)' }) => (
  <span style={{ display:'inline-block', width:size, height:size, flexShrink:0, border:`2px solid ${track}`, borderTopColor:color, borderRadius:'50%', animation:'spin 1s linear infinite' }} />
);

const StepPill = ({ icon, label, status }) => {
  const c = {
    waiting: { bg:'rgba(255,255,255,.04)', border:'rgba(255,255,255,.1)',  text:'rgba(255,255,255,.3)' },
    running: { bg:'rgba(0,200,83,.06)',    border:'rgba(0,200,83,.3)',     text:'#00C853' },
    done:    { bg:'rgba(0,200,83,.1)',     border:'rgba(0,200,83,.35)',    text:'#00C853' },
    error:   { bg:'rgba(255,82,82,.08)',   border:'rgba(255,82,82,.25)',   text:'#FF5252' },
  }[status] || {};
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'.45rem', padding:'.38rem .8rem', borderRadius:999, background:c.bg, border:`1px solid ${c.border}`, color:c.text, fontSize:'.72rem', fontWeight:600, transition:'all .3s' }}>
      {status==='running' ? <Spin size={10} color={c.text} track={`${c.text}30`} /> : <span style={{ fontSize:'.78rem' }}>{status==='done'?'✓':status==='error'?'✗':icon}</span>}
      {label}
    </div>
  );
};

const ScoreArc = ({ score = 85 }) => {
  const r = 52, cx = 64, cy = 64, circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const col = score>=80?'#00C853':score>=60?'#69F0AE':score>=40?'#FFD600':score>=20?'#FF9800':'#FF5252';
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="8"
        strokeDasharray={`${circ*pct} ${circ}`} strokeDashoffset={circ*0.25}
        strokeLinecap="round" style={{ transition:'stroke-dasharray 1s ease' }}/>
      <text x={cx} y={cy-6} textAnchor="middle" fill={col} style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:28 }}>{score}</text>
      <text x={cx} y={cy+16} textAnchor="middle" fill="rgba(255,255,255,.35)" style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:1 }}>SCORE</text>
    </svg>
  );
};

/* ════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════ */
export default function Greenwashing() {

  const [vehicles,        setVehicles]        = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesLoadingMore, setVehiclesLoadingMore] = useState(false);

  const [search,     setSearch]     = useState('');
  const [filterBrand,setFilterBrand]= useState('');
  const [filterModel,setFilterModel]= useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterPT,   setFilterPT]   = useState('');
  const searchDebounce = useRef(null);

  const [selected, setSelected] = useState(null);
  const [country,  setCountry]  = useState('US');
  const [gridYear, setGridYear] = useState(2024);

  const [phase,         setPhase]         = useState('idle');
  const [lifecycle,     setLifecycle]     = useState(null);
  const [analysis,      setAnalysis]      = useState(null);
  const [stepLifecycle, setStepLifecycle] = useState('waiting');
  const [stepGW,        setStepGW]        = useState('waiting');
  const [stepWeb,       setStepWeb]       = useState('waiting');
  const [error,         setError]         = useState(null);

  useEffect(() => { loadVehicles(); }, []);

  async function loadVehicles() {
    setVehiclesLoading(true);
    setVehicles([]);
    const PAGE_SIZE = 200;
    let page = 1, totalPages = 1;
    try {
      while (page <= totalPages) {
        const res  = await fetch(`${API}/vehicles?page=${page}&limit=${PAGE_SIZE}`);
        const json = await res.json();
        const batch = Array.isArray(json) ? json : (json.vehicles ?? []);
        totalPages  = json.pages ?? 1;
        setVehicles(prev => [...prev, ...batch]);
        if (page === 1) { setVehiclesLoading(false); if (totalPages > 1) setVehiclesLoadingMore(true); }
        page++;
      }
    } catch (e) {
      console.error('Failed to load vehicles:', e);
      setVehiclesLoading(false);
    } finally { setVehiclesLoadingMore(false); }
  }

  async function handleSearch(q) {
    setSearch(q);
    clearTimeout(searchDebounce.current);
    if (q.length < 2) { loadVehicles(); return; }
    searchDebounce.current = setTimeout(async () => {
      setVehiclesLoading(true);
      try {
        const res  = await fetch(`${API}/vehicle-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setVehicles(data);
      } catch {}
      finally { setVehiclesLoading(false); }
    }, 280);
  }

  const filteredVehicles = vehicles.filter(v => {
    const pt = v.vehicle_type?.toUpperCase();
    return (
      (!filterBrand || v.brand  === filterBrand) &&
      (!filterModel || v.model  === filterModel) &&
      (!filterYear  || String(v.year) === filterYear) &&
      (!filterPT    || pt === filterPT || (filterPT === 'EV' && pt === 'BEV'))
    );
  });

  const brands = [...new Set(vehicles.map(v => v.brand))].sort();
  const models = [...new Set(vehicles.map(v => v.model))].sort();
  const years  = [...new Set(vehicles.map(v => v.year))].sort((a,b) => b - a);

  const pickVehicle = (v) => { setSelected(v); resetResults(); };

  const resetResults = () => {
    setPhase('idle'); setLifecycle(null); setAnalysis(null);
    setStepLifecycle('waiting'); setStepGW('waiting'); setStepWeb('waiting');
    setError(null);
  };

  const handleAnalyse = async () => {
    if (!selected) return;
    setPhase('running'); setLifecycle(null); setAnalysis(null); setError(null);
    setStepLifecycle('running'); setStepGW('waiting'); setStepWeb('running');

    let lc;
    try {
      lc = await apiClient.calculateLifecycle(
        selected.brand, selected.model, parseInt(selected.year), country, parseInt(gridYear)
      );
      if (lc?.error) throw new Error(lc.error);
      setLifecycle(lc);
      setStepLifecycle('done');
    } catch (err) {
      setStepLifecycle('error'); setStepGW('error'); setStepWeb('error');
      setError(err.message || 'Failed to calculate lifecycle emissions');
      setPhase('done'); return;
    }

    setStepGW('running');
    const vm = { brand: selected.brand, model: selected.model, year: selected.year, type: selected.vehicle_type, co2_wltp_gpkm: lc.operational_g_per_km };

    const [baseRes, webRes] = await Promise.allSettled([
      apiClient.detectGreenwashing(lc, vm, false),
      apiClient.detectGreenwashing(lc, vm, true),
    ]);

    const hi = (a, b) => ({ low:1,medium:2,high:3 }[a]||1) >= ({ low:1,medium:2,high:3 }[b]||1) ? a : b;

    if (baseRes.status === 'fulfilled' && baseRes.value) {
      const base = normaliseAnalysis(baseRes.value);
      setStepGW('done');
      if (webRes.status === 'fulfilled' && webRes.value) {
        const web = normaliseAnalysis(webRes.value);
        setAnalysis({
          ...base,
          overall_risk:       hi(base.overall_risk, web.overall_risk),
          // FIX 2: use minimum of the two backend scores (most conservative)
          transparency_score: Math.min(base.transparency_score ?? 85, web.transparency_score ?? 85),
          web_claims:         web.web_claims || [],
          // FIX 5: merge misleading_claims from both passes (deduplicate by practice)
          misleading_claims:  deduplicateMisleading([
            ...(base.misleading_claims || []),
            ...(web.misleading_claims  || []),
          ]),
          findings:           [...(base.findings||[]), ...(web.findings||[])],
          structural_flags:   [...new Set([...(base.structural_flags||[]), ...(web.structural_flags||[])])],
          vehicle: selected, lifecycle: lc,
        });
        setStepWeb('done');
      } else {
        setAnalysis({ ...base, web_claims:[], vehicle:selected, lifecycle:lc });
        setStepWeb(webRes.status === 'rejected' ? 'error' : 'done');
      }
    } else {
      setStepGW('error');
      setError('Greenwashing analysis failed. Please try again.');
      if (webRes.status === 'fulfilled' && webRes.value) {
        setAnalysis({ ...normaliseAnalysis(webRes.value), vehicle:selected, lifecycle:lc });
        setStepWeb('done');
      } else setStepWeb('error');
    }
    setPhase('done');
  };

  // FIX 5: deduplicate misleading_claims by 'practice' key
  function deduplicateMisleading(arr) {
    const seen = new Set();
    return arr.filter(m => {
      const key = m.practice || JSON.stringify(m);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const getScoreLabel = (s) => s>=80 ? 'Excellent Transparency' : s>=60 ? 'Good Transparency' : s>=40 ? 'Moderate Transparency' : 'Low Transparency';
  const isRunning = phase === 'running';

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:"'DM Mono',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        @keyframes shimmer    { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin       { to{transform:rotate(360deg)} }
        @keyframes skelShim   { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        .fade-up   { animation:fadeUp .35s ease both; }
        .card-gw   { background:#111; border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:1.5rem; }
        .card-green{ background:rgba(0,200,83,.04); border:1px solid rgba(0,200,83,.16); border-radius:12px; }
        .card-glass{ background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:12px; backdrop-filter:blur(4px); }
        .section-title { font-family:'Syne',sans-serif; font-weight:700; font-size:1rem; color:#fff; margin-bottom:.9rem; }
        .gw-search-wrap {
          position:relative; display:flex; align-items:center;
          background:#0a0a0a; border:1.5px solid rgba(0,200,83,.25);
          border-radius:999px; padding:0 1.25rem; height:52px;
          transition:border-color .2s, box-shadow .2s; margin-bottom:1.25rem;
        }
        .gw-search-wrap:focus-within { border-color:#00C853; box-shadow:0 0 0 3px rgba(0,200,83,.12), 0 4px 24px rgba(0,200,83,.08); }
        .gw-search-input { flex:1; background:transparent; border:none; outline:none; color:#fff; font-family:'DM Mono',monospace; font-size:.95rem; font-weight:500; padding:0 .75rem; height:100%; letter-spacing:.01em; }
        .gw-search-input::placeholder { color:rgba(255,255,255,.28); font-weight:400; }
        .gw-search-icon { width:18px; height:18px; color:rgba(0,200,83,.5); flex-shrink:0; transition:color .2s; }
        .gw-search-wrap:focus-within .gw-search-icon { color:#00C853; }
        .gw-clear-btn { display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.08); border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; flex-shrink:0; padding:0; transition:background .15s; }
        .gw-clear-btn:hover { background:rgba(255,82,82,.22); }
        .gw-filter-select { padding:.7rem .9rem; background:#000000ec; color:#00C853; border:1px solid #00C853; border-radius:6px; font-family:'DM Mono',monospace; font-size:.85rem; font-weight:600; cursor:pointer; outline:none; width:100%; transition:box-shadow .2s; }
        .gw-filter-select:focus { box-shadow:0 0 8px rgba(0,200,83,.4); }
        .gw-filter-select option { background:#000; color:#00C853; }
        .gw-filter-label { font-weight:700; color:#00C853; font-size:.875rem; display:block; margin-bottom:.4rem; }
        .vitem { padding:.6rem .75rem; background:rgba(255,255,255,.05); border:2px solid transparent; border-radius:7px; cursor:pointer; transition:all .15s; }
        .vitem:hover  { border-color:#00C853; background:rgba(0,200,83,.1); }
        .vitem.active { border-color:#00C853; background:rgba(0,200,83,.15); }
        .skel { background:linear-gradient(90deg,rgba(0,200,83,.06) 25%,rgba(0,200,83,.14) 50%,rgba(0,200,83,.06) 75%); background-size:600px 100%; animation:skelShim 1.6s infinite linear; border-radius:5px; }
        .vitem-skel { pointer-events:none; min-height:72px; display:flex; flex-direction:column; gap:.45rem; justify-content:center; }
        .load-more-bar { display:flex; align-items:center; gap:.75rem; padding:.5rem 0 .25rem; font-size:.75rem; color:rgba(0,200,83,.6); }
        .load-bar-line { flex:1; height:2px; background:linear-gradient(90deg,transparent 0%,rgba(0,200,83,.8) 50%,transparent 100%); background-size:200% 100%; animation:skelShim 1.2s infinite linear; border-radius:999px; }
        .gw-input { background:#0a0a0a; border:1.5px solid rgba(0,200,83,.22); color:#00C853; border-radius:8px; padding:.6rem .9rem; font-family:'DM Mono',monospace; font-size:.82rem; font-weight:500; outline:none; box-sizing:border-box; transition:border-color .2s,box-shadow .2s; }
        .gw-input:focus { border-color:#00C853; box-shadow:0 0 0 3px rgba(0,200,83,.12); }
        .gw-input:disabled { opacity:.4; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:rgba(0,200,83,.3); border-radius:999px; }
      `}</style>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2.5rem 1.5rem' }}>

        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'clamp(1.5rem,3vw,2.2rem)', fontWeight:800, textAlign:'center', margin:'0 0 .35rem' }}>
          Greenwashing Detector
        </h1>
        <p style={{ color:'rgba(255,255,255,.35)', fontSize:'.85rem', textAlign:'center', marginBottom:'2rem' }}>
          Select a vehicle · we'll scan lifecycle emissions &amp; real marketing claims in parallel
        </p>

        {/* ── Selection card ── */}
        <div className="card-gw" style={{ marginBottom:'1.5rem' }}>
          <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'1.05rem', color:'#fff', marginBottom:'1.25rem' }}>
            Select Vehicle
          </h3>

          <div className="gw-search-wrap">
            <svg className="gw-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="gw-search-input" placeholder="Search brand or model…" value={search} onChange={e => handleSearch(e.target.value)} />
            {vehiclesLoading && search.length >= 2 && <Spin size={16} />}
            {search && !vehiclesLoading && (
              <button className="gw-clear-btn" onClick={() => { setSearch(''); loadVehicles(); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width:13, height:13, color:'rgba(255,255,255,.5)' }}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.25rem' }}>
            {[['Brand', filterBrand, setFilterBrand, brands, v => v],
              ['Model', filterModel, setFilterModel, models, v => v],
              ['Year',  filterYear,  setFilterYear,  years,  v => v]].map(([label, val, setter, opts, display]) => (
              <div key={label}>
                <label className="gw-filter-label">{label}</label>
                <select className="gw-filter-select" value={val} onChange={e => setter(e.target.value)}>
                  <option value="">All {label}s</option>
                  {opts.map(o => <option key={o} value={o}>{display(o)}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="gw-filter-label">Powertrain</label>
              <select className="gw-filter-select" value={filterPT} onChange={e => setFilterPT(e.target.value)}>
                <option value="">All Types</option>
                <option value="EV">EV / BEV</option>
                <option value="PHEV">PHEV</option>
                <option value="HEV">HEV</option>
                <option value="ICE">ICE</option>
              </select>
            </div>
            <div>
              <label className="gw-filter-label">Country</label>
              <select className="gw-filter-select" value={country} onChange={e => setCountry(e.target.value)} disabled={isRunning}>
                {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="gw-filter-label">Grid Year</label>
              <input className="gw-input" type="number" value={gridYear} min="2015" max="2030"
                style={{ width:'100%' }} onChange={e => setGridYear(Number(e.target.value))} disabled={isRunning} />
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'.6rem', maxHeight:380, overflowY:'auto', marginBottom:'1.25rem' }}>
            {vehiclesLoading && !vehicles.length
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="vitem vitem-skel">
                    <div className="skel" style={{ height:13, width:'75%' }} />
                    <div className="skel" style={{ height:11, width:'32%', borderRadius:999 }} />
                    <div className="skel" style={{ height:10, width:'20%' }} />
                  </div>
                ))
              : filteredVehicles.map((v, i) => {
                  const isActive = selected?.brand===v.brand && selected?.model===v.model && selected?.year===v.year;
                  const pc = ptC(v.vehicle_type);
                  return (
                    <div key={`${v.brand}-${v.model}-${v.year}-${i}`}
                      className={`vitem ${isActive ? 'active' : ''}`}
                      onClick={() => pickVehicle(v)}
                    >
                      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'.88rem', color:isActive?'#00C853':'#fff', marginBottom:'.2rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {v.brand} {v.model}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
                        <span style={{ display:'inline-block', background:`${pc}22`, border:`1px solid ${pc}40`, color:pc, fontSize:'.65rem', fontWeight:700, padding:'.1rem .45rem', borderRadius:4, letterSpacing:'.04em' }}>
                          {v.vehicle_type}
                        </span>
                        <span style={{ fontSize:'.75rem', color:'rgba(255,255,255,.4)' }}>{v.year}</span>
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {vehiclesLoadingMore && (
            <div className="load-more-bar">
              <div className="load-bar-line" /><span>Loading more vehicles…</span>
            </div>
          )}

          {selected ? (
            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'.85rem', padding:'1rem 1.1rem', background:'rgba(0,200,83,.05)', border:'1px solid rgba(0,200,83,.2)', borderRadius:9 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'.6rem', flex:1, minWidth:180 }}>
                <div style={{ width:34, height:34, borderRadius:7, flexShrink:0, background:`${ptC(selected.vehicle_type)}1a`, border:`1px solid ${ptC(selected.vehicle_type)}38`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.58rem', fontWeight:700, color:ptC(selected.vehicle_type) }}>
                  {selected.vehicle_type}
                </div>
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'.9rem', color:'#00C853' }}>{selected.brand} {selected.model}</div>
                  <div style={{ fontSize:'.68rem', color:'rgba(255,255,255,.32)' }}>{selected.year} · ready to analyse</div>
                </div>
              </div>
              <button onClick={handleAnalyse} disabled={isRunning} style={{ display:'inline-flex', alignItems:'center', gap:'.5rem', padding:'.78rem 1.75rem', borderRadius:999, background:isRunning?'rgba(0,200,83,.06)':'linear-gradient(135deg,rgba(0,200,83,.18),rgba(0,200,83,.06))', border:'1.5px solid rgba(0,200,83,.45)', color:'#00C853', fontFamily:"'DM Mono',monospace", fontSize:'.9rem', fontWeight:700, letterSpacing:'.02em', cursor:isRunning?'not-allowed':'pointer', opacity:isRunning?.65:1, boxShadow:isRunning?'none':'0 0 22px rgba(0,200,83,.15)', transition:'all .2s', whiteSpace:'nowrap' }}>
                {isRunning ? <><Spin size={14} /><span>Analysing…</span></> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z"/></svg>Detect Greenwashing</>}
              </button>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'.75rem', color:'rgba(255,255,255,.22)', fontSize:'.82rem' }}>
              Click a vehicle above to select it
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="fade-up" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'.85rem 1.1rem', marginBottom:'1.25rem', background:'rgba(255,82,82,.08)', border:'1px solid rgba(255,82,82,.25)', borderRadius:9, fontSize:'.875rem', color:'#FF5252' }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={{ background:'none', border:'none', color:'#FF5252', cursor:'pointer', fontSize:'1.2rem', lineHeight:1 }}>×</button>
          </div>
        )}

        {/* ── Progress pills ── */}
        {(isRunning || phase === 'done') && (
          <div className="fade-up" style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', marginBottom:'1.25rem', alignItems:'center' }}>
            <StepPill icon="⚡" label="Lifecycle emissions"   status={stepLifecycle} />
            <span style={{ color:'rgba(255,255,255,.15)', fontSize:'.7rem' }}>→</span>
            <StepPill icon="🔍" label="Greenwashing analysis" status={stepGW} />
            <span style={{ color:'rgba(255,255,255,.15)', fontSize:'.7rem' }}>→</span>
            <StepPill icon="🌐" label="Web claims scan"       status={stepWeb} />
          </div>
        )}

        {/* ── Lifecycle result card ── */}
        {lifecycle && selected && (
          <div className="card-green fade-up" style={{ padding:'1.75rem', marginBottom:'1.25rem' }}>
            <div style={{ display:'flex', gap:'1.5rem', alignItems:'flex-start', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:220 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'.55rem', marginBottom:'.75rem', flexWrap:'wrap' }}>
                  {analysis
                    ? <span className="fade-up" style={{ display:'inline-flex', alignItems:'center', gap:'.35rem', padding:'.28rem .8rem', borderRadius:999, background:getRisk(analysis.overall_risk).bg, border:`1px solid ${getRisk(analysis.overall_risk).border}`, color:getRisk(analysis.overall_risk).color, fontSize:'.7rem', fontWeight:700, letterSpacing:'.07em' }}>
                        {getRisk(analysis.overall_risk).icon} {getRisk(analysis.overall_risk).label}
                      </span>
                    : isRunning && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:'.38rem', padding:'.28rem .8rem', borderRadius:999, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.28)', fontSize:'.7rem' }}>
                          <Spin size={9} color="rgba(255,255,255,.4)" track="rgba(255,255,255,.1)" /> Scoring…
                        </span>
                      )
                  }
                  <span style={{ padding:'.22rem .6rem', borderRadius:999, background:`${ptC(selected.vehicle_type)}18`, border:`1px solid ${ptC(selected.vehicle_type)}30`, color:ptC(selected.vehicle_type), fontSize:'.66rem', fontWeight:600 }}>
                    {selected.vehicle_type}
                  </span>
                </div>

                <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'clamp(1.15rem,2.5vw,1.7rem)', fontWeight:800, margin:'0 0 1rem' }}>
                  {selected.brand} {selected.model}
                  <span style={{ color:'rgba(255,255,255,.28)', fontWeight:400, fontSize:'.6em', marginLeft:'.55rem' }}>{selected.year}</span>
                </h2>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:'.6rem' }}>
                  {[
                    { label:'Total lifecycle',  val:`${fmt(lifecycle.total_for_distance_kg,0)} kg`,           col:'#00C853' },
                    { label:'Manufacturing',    val:`${fmt(lifecycle.manufacturing_total_kg,0)} kg`,           col:'#69F0AE' },
                    { label:'Operational',      val:`${fmt(lifecycle.operational_g_per_km,1)} g/km`,          col:'#B2DFDB' },
                    ...(lifecycle.recycling_kg != null && lifecycle.recycling_kg > 0
                      ? [{ label:'Recycling', val:`${fmt(lifecycle.recycling_kg,0)} kg`, col:'#FFD600' }]
                      : []),
                  ].map(({ label, val, col }) => (
                    <div key={label} style={{ padding:'.7rem .9rem', background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:9 }}>
                      <div style={{ fontSize:'.64rem', color:'rgba(255,255,255,.28)', letterSpacing:'.05em', textTransform:'uppercase', marginBottom:'.28rem' }}>{label}</div>
                      <div style={{ color:col, fontWeight:600, fontSize:'.88rem' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'.35rem', flexShrink:0 }}>
                {analysis
                  ? <><ScoreArc score={analysis.transparency_score ?? 85} /><div style={{ fontSize:'.7rem', color:'rgba(255,255,255,.38)', textAlign:'center' }}>{getScoreLabel(analysis.transparency_score??85)}</div></>
                  : <><Sk w={128} h={128} r="50%" /><Sk w={80} h={10} style={{ marginTop:'.35rem' }} /></>
                }
              </div>
            </div>
          </div>
        )}

        {/* ── Analysis cards ── */}
        {analysis && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))', gap:'1.1rem', marginBottom:'1.1rem' }}>

              {/* Indicators — FIX 5: only shows genuinely misleading practices */}
              <div className="card-glass fade-up" style={{ padding:'1.4rem', animationDelay:'.05s' }}>
                <div className="section-title">⚠️ Greenwashing Indicators</div>
                {(analysis.misleading_claims||[]).length === 0
                  ? <div style={{ display:'flex', alignItems:'center', gap:'.6rem', color:'#69F0AE', fontSize:'.875rem' }}>
                      <span>✅</span> No common misleading practices detected.
                    </div>
                  : <div style={{ display:'flex', flexDirection:'column', gap:'.65rem' }}>
                      {analysis.misleading_claims.map((claim, i) => {
                        const cfg = getRisk(claim.severity);
                        return (
                          <div key={i} style={{ padding:'.9rem', borderRadius:9, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'.45rem', marginBottom:'.45rem' }}>
                              <span>{claim.severity==='high'?'🚨':claim.severity==='medium'?'⚠️':'ℹ️'}</span>
                              <span style={{ color:cfg.color, fontSize:'.66rem', fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>{claim.severity}</span>
                            </div>
                            {claim.practice     && <div style={{ display:'flex', justifyContent:'space-between', padding:'.35rem 0', borderBottom:'1px solid rgba(255,255,255,.05)', fontSize:'.77rem' }}><span style={{color:'rgba(255,255,255,.38)'}}>Practice</span><span style={{color:'#fff',maxWidth:'60%',textAlign:'right'}}>{claim.practice}</span></div>}
                            {claim.common_claim && <div style={{ display:'flex', justifyContent:'space-between', padding:'.35rem 0', borderBottom:'1px solid rgba(255,255,255,.05)', fontSize:'.77rem' }}><span style={{color:'rgba(255,255,255,.38)'}}>Typical claim</span><span style={{color:'rgba(255,255,255,.55)',maxWidth:'60%',textAlign:'right'}}>{claim.common_claim}</span></div>}
                            {claim.reality      && <div style={{ marginTop:'.4rem', fontSize:'.77rem', color:cfg.color, lineHeight:1.5 }}>{claim.reality}</div>}
                          </div>
                        );
                      })}
                    </div>
                }
              </div>

              {/* Structural */}
              <div className="card-glass fade-up" style={{ padding:'1.4rem', animationDelay:'.08s' }}>
                <div className="section-title">🏗️ Structural Assessment</div>
                {(analysis.structural_flags||[]).length > 0
                  ? <div style={{ display:'flex', flexDirection:'column', gap:'.38rem' }}>
                      {analysis.structural_flags.map((flag, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'.55rem', padding:'.5rem 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background:'#FF9800', flexShrink:0, marginTop:'.35rem' }} />
                          <span style={{ color:'rgba(255,255,255,.62)', fontSize:'.8rem', lineHeight:1.5 }}>{flag}</span>
                        </div>
                      ))}
                    </div>
                  : <div style={{ display:'flex', alignItems:'center', gap:'.6rem', color:'#69F0AE', fontSize:'.875rem' }}><span>✅</span> No structural greenwashing flags found.</div>
                }
                <div style={{ marginTop:'1.1rem', padding:'.9rem', borderRadius:9, background:getRisk(analysis.overall_risk).bg, border:`1px solid ${getRisk(analysis.overall_risk).border}` }}>
                  <div style={{ fontSize:'.64rem', color:'rgba(255,255,255,.28)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:'.32rem' }}>Overall Risk</div>
                  <div style={{ color:getRisk(analysis.overall_risk).color, fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'1rem' }}>
                    {getRisk(analysis.overall_risk).icon} {getRisk(analysis.overall_risk).label}
                  </div>
                </div>
              </div>
            </div>

            {/* Findings — FIX 3/4: aspirational and unverified styled differently */}
            {(analysis.findings||[]).length > 0 && (
              <div className="card-glass fade-up" style={{ padding:'1.4rem', marginBottom:'1.1rem', animationDelay:'.11s' }}>
                <div className="section-title">📋 Detailed Findings</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'.45rem' }}>
                  {analysis.findings.map((f, i) => {
                    const isObj = typeof f === 'object' && f !== null;
                    const meta  = isObj ? findingMeta(f) : null;
                    const cfg   = meta?.muted
                      ? { bg:'rgba(255,255,255,.02)', border:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.35)' }
                      : (isObj ? getRisk(f.risk_level) : getRisk('medium'));
                    return (
                      <div key={i} style={{ padding:'.9rem 1rem', borderRadius:9, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
                        {isObj ? (
                          <>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.35rem', gap:'.9rem' }}>
                              <span style={{ color: meta ? 'rgba(255,255,255,.5)' : '#fff', fontSize:'.83rem', fontWeight:500 }}>
                                {meta ? meta.icon : ''} {f.claim}
                              </span>
                              <span style={{ color: meta ? meta.tagColor : cfg.color, fontSize:'.64rem', fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', flexShrink:0 }}>
                                {meta ? meta.tag : f.risk_level}
                              </span>
                            </div>
                            {f.reason     && <div style={{ color:'rgba(255,255,255,.42)', fontSize:'.77rem', lineHeight:1.5, marginBottom:'.28rem' }}>{f.reason}</div>}
                            {f.suggestion && !meta?.muted && <div style={{ color:cfg.color, fontSize:'.77rem', lineHeight:1.5 }}>💡 {f.suggestion}</div>}
                          </>
                        ) : (
                          <div style={{ display:'flex', alignItems:'flex-start', gap:'.55rem' }}>
                            <span style={{ color:'#FF9800', flexShrink:0 }}>▸</span>
                            <span style={{ color:'rgba(255,255,255,.68)', fontSize:'.83rem', lineHeight:1.5 }}>{f}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Web claims — FIX 1: aspirational/unverified show neutral verdict */}
            {(analysis.web_claims||[]).length > 0 && (
              <div className="card-glass fade-up" style={{ padding:'1.4rem', marginBottom:'1.1rem', animationDelay:'.15s' }}>
                <div className="section-title">🌐 Web Marketing Claims</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'.6rem' }}>
                  {analysis.web_claims.map((wc, i) => {
                    const accurate     = wc.verification?.is_accurate;
                    const aspirational = wc.is_aspirational;
                    const unverified   = wc.is_unverified;
                    const cfg          = aspirational
                      ? { bg:'rgba(255,255,255,.02)', border:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.35)' }
                      : getRisk(accurate ? 'low' : (wc.risk_level || 'high'));
                    return (
                      <div key={i} style={{ padding:'.9rem 1rem', borderRadius:9, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'.45rem', marginBottom:'.45rem' }}>
                          <span style={{ color: aspirational ? 'rgba(255,255,255,.3)' : accurate ? '#69F0AE' : '#FF5252', fontSize:'1rem' }}>
                            {aspirational ? '📋' : unverified ? '❓' : accurate ? '✓' : '✗'}
                          </span>
                          <span style={{ color:'rgba(255,255,255,.35)', fontSize:'.72rem' }}>{wc.source}</span>
                          {wc.source_url && <a href={wc.source_url} target="_blank" rel="noreferrer" style={{ color:'rgba(0,200,83,.5)', fontSize:'.67rem', marginLeft:'auto' }}>↗ source</a>}
                        </div>
                        <div style={{ color: aspirational ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.75)', fontSize:'.83rem', marginBottom:'.38rem', lineHeight:1.5 }}>"{wc.claim}"</div>
                        {wc.reason     && <div style={{ color:'rgba(255,255,255,.42)', fontSize:'.77rem', lineHeight:1.4, marginBottom:'.3rem' }}>{wc.reason}</div>}
                        {wc.suggestion && !aspirational && <div style={{ color:cfg.color, fontSize:'.77rem', lineHeight:1.4 }}>💡 {wc.suggestion}</div>}
                        {/* FIX 1: verdict line */}
                        <div style={{ marginTop:'.45rem', fontSize:'.68rem', fontWeight:600, letterSpacing:'.04em',
                          color: aspirational ? 'rgba(255,255,255,.25)'
                               : unverified   ? '#FFD600'
                               : accurate     ? '#69F0AE'
                               : '#FF5252' }}>
                          {aspirational ? '📋 Aspirational / corporate statement — not a product claim'
                           : unverified  ? '❓ Unverified — no matching rule; manual review recommended'
                           : accurate    ? '✓ Claim appears accurate'
                                        : '✗ Claim is potentially misleading'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stepWeb === 'running' && (
              <div className="card-glass fade-up" style={{ padding:'.85rem 1.4rem', marginBottom:'1.1rem', display:'flex', alignItems:'center', gap:'.9rem' }}>
                <Spin size={16} color="#FF9800" track="rgba(255,152,0,.25)" />
                <span style={{ color:'rgba(255,255,255,.42)', fontSize:'.86rem' }}>Scanning web for manufacturer marketing claims…</span>
              </div>
            )}

            {(analysis.findings||[]).length===0 && (analysis.misleading_claims||[]).length===0 && (analysis.web_claims||[]).length===0 && (
              <div className="card-glass fade-up" style={{ padding:'2rem', marginBottom:'1.1rem', textAlign:'center' }}>
                <div style={{ fontSize:'2.4rem', marginBottom:'.7rem' }}>✅</div>
                <div style={{ color:'#69F0AE', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'.95rem', marginBottom:'.35rem' }}>No significant greenwashing detected</div>
                <div style={{ color:'rgba(255,255,255,.32)', fontSize:'.83rem' }}>Marketing appears transparent for this vehicle.</div>
              </div>
            )}

            <p style={{ textAlign:'center', fontSize:'.67rem', color:'rgba(255,255,255,.16)', lineHeight:1.6, marginTop:'.4rem' }}>
              Analysis based on lifecycle emissions data. Claims detected algorithmically — results may vary by region.
            </p>
          </>
        )}

        {phase === 'idle' && !selected && (
          <div style={{ textAlign:'center', padding:'4rem 2rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1rem', opacity:.25 }}>🔎</div>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:'.95rem', color:'rgba(255,255,255,.28)', marginBottom:'.35rem' }}>Select a vehicle above to begin</p>
            <p style={{ fontSize:'.8rem', color:'rgba(255,255,255,.16)' }}>Greenwashing detection uses full lifecycle emissions, not just tailpipe CO₂</p>
          </div>
        )}

        {phase === 'idle' && selected && !lifecycle && (
          <div style={{ textAlign:'center', padding:'2.5rem 2rem' }}>
            <div style={{ fontSize:'1.8rem', marginBottom:'.65rem', opacity:.35 }}>☝️</div>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:'.9rem', color:'rgba(255,255,255,.25)' }}>
              Hit <span style={{ color:'#00C853' }}>Detect Greenwashing</span> to run the full analysis
            </p>
          </div>
        )}

        <div style={{ height:'3rem' }} />
      </div>
    </div>
  );
}