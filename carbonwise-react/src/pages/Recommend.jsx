import { useState, useEffect, useRef } from 'react';
import apiClient from '../services/api';

const API = "http://localhost:5000";

const POWERTRAIN_OPTIONS = [
  { value: '',     label: 'Any powertrain' },
  { value: 'BEV',  label: '⚡ Electric (BEV)' },
  { value: 'PHEV', label: '🔌 Plug-in Hybrid' },
  { value: 'HEV',  label: '♻️ Hybrid (HEV)' },
  { value: 'ICE',  label: '⛽ Gasoline / Diesel' },
];

const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'CN', label: 'China' },
  { value: 'JP', label: 'Japan' },
  { value: 'IN', label: 'India' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'BR', label: 'Brazil' },
];

const RANK_COLORS = ['#00ff88', '#00c853', '#69f0ae'];
const RANK_LABELS = ['OPTIMAL', 'EFFICIENT', 'VIABLE'];

function ScoreRing({ score }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(0,255,136,0.12)" strokeWidth="5" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={score > 70 ? '#00ff88' : score > 45 ? '#69f0ae' : '#ffc107'}
        strokeWidth="5"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <text
        x="36" y="40" textAnchor="middle"
        fill="#fff" fontSize="13" fontWeight="700"
        fontFamily="'JetBrains Mono', monospace"
        style={{ transform: 'rotate(90deg)', transformOrigin: '36px 36px' }}
      >
        {isFinite(score) ? score : 0}
      </text>
    </svg>
  );
}

function TypeBadge({ type }) {
  const map = {
    BEV:  { label: 'BEV',  color: '#00ff88', bg: 'rgba(0,255,136,0.1)' },
    PHEV: { label: 'PHEV', color: '#40c4ff', bg: 'rgba(64,196,255,0.1)' },
    HEV:  { label: 'HEV',  color: '#69f0ae', bg: 'rgba(105,240,174,0.1)' },
    ICE:  { label: 'ICE',  color: '#ffc107', bg: 'rgba(255,193,7,0.1)' },
  };
  const t = map[type] || { label: type, color: '#aaa', bg: 'rgba(170,170,170,0.1)' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
      color: t.color, background: t.bg, border: `1px solid ${t.color}44`,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {t.label}
    </span>
  );
}

function StatBar({ label, value, max = 300, color = '#00ff88' }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#666', letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
        <span style={{ fontSize: 11, color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{Math.round(value)} g/km</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, borderRadius: 2,
          transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 6px ${color}88`,
        }} />
      </div>
    </div>
  );
}

// ─── Map component using Leaflet ─────────────────────────────────────────────
function RouteMap({ onDistanceChange, distanceMode }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [totalKm, setTotalKm] = useState(0);
  const pointsRef = useRef([]);

  useEffect(() => {
    if (mapInstanceRef.current) return;
    if (!window.L) return;

    const L = window.L;
    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e) => {
      const newPoint = [e.latlng.lat, e.latlng.lng];
      const updated = [...pointsRef.current, newPoint];
      pointsRef.current = updated;
      setPoints([...updated]);

      const marker = L.circleMarker(newPoint, {
        radius: 6,
        fillColor: '#00ff88',
        color: '#00ff88',
        weight: 2,
        fillOpacity: 0.9,
        opacity: 1,
      }).addTo(map);
      markersRef.current.push(marker);

      if (polylineRef.current) polylineRef.current.remove();
      if (updated.length > 1) {
        polylineRef.current = L.polyline(updated, {
          color: '#00ff88',
          weight: 2,
          opacity: 0.7,
          dashArray: '6 4',
        }).addTo(map);

        let km = 0;
        for (let i = 1; i < updated.length; i++) {
          const a = L.latLng(updated[i - 1]);
          const b = L.latLng(updated[i]);
          km += a.distanceTo(b) / 1000;
        }
        setTotalKm(Math.round(km));
        onDistanceChange(Math.round(km));
      }
    });

    mapInstanceRef.current = map;
  }, []);

  function clearRoute() {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.remove(); polylineRef.current = null; }
    pointsRef.current = [];
    setPoints([]);
    setTotalKm(0);
    onDistanceChange(0);
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88' }} />
          <span style={{ fontSize: 11, color: '#666', letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>
            CLICK MAP TO PLOT ROUTE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {totalKm > 0 && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#00ff88' }}>
              {totalKm.toLocaleString()} km plotted
            </span>
          )}
          {points.length > 0 && (
            <button onClick={clearRoute} style={{
              background: 'none', border: '1px solid rgba(255,80,80,0.3)',
              color: '#ff5050', padding: '3px 10px', borderRadius: 4,
              fontSize: 10, cursor: 'pointer', letterSpacing: 1,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              CLEAR
            </button>
          )}
        </div>
      </div>
      <div
        ref={mapRef}
        style={{
          height: 280,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid rgba(0,255,136,0.15)',
          boxShadow: '0 0 30px rgba(0,255,136,0.05)',
        }}
      />
      {points.length === 0 && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -30%)',
          pointerEvents: 'none', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.3 }}>🗺</div>
          <div style={{ fontSize: 11, color: '#444', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
            TAP TWO POINTS TO MEASURE DISTANCE
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Recommend() {
  const [distanceMode, setDistanceMode] = useState('daily');
  const [distance, setDistance] = useState(40);
  const [mapDistanceKm, setMapDistanceKm] = useState(0);
  const [powertrain, setPowertrain] = useState('');
  const [country, setCountry] = useState('US');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanned, setScanned] = useState(false);

  const getDailyKm = () => {
    if (distanceMode === 'map') return mapDistanceKm > 0 ? mapDistanceKm / 365 : 40;
    if (distanceMode === 'monthly') return distance / 30;
    return distance;
  };

  const getAnnualKm = () => getDailyKm() * 365;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setRecommendations([]);
    setScanned(false);

    try {
      const dailyKm = getDailyKm();
      const filters = powertrain ? { vehicle_type: powertrain } : {};
      const res = await apiClient.getRecommendations(dailyKm, 10, filters, country, 2023);

      if (!Array.isArray(res) || res.length === 0) {
        setError('No vehicles matched your criteria. Try changing your filters.');
        return;
      }

      setRecommendations(res.slice(0, 3));
      setTimeout(() => setScanned(true), 100);
    } catch (err) {
      setError('Failed to fetch recommendations. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const calcScore = (g) => Math.round(Math.max(0, Math.min(100, 100 - g / 3)));

  const annualKm = getAnnualKm();
  const lifetime_km = annualKm * 10;

  const fmt = (val, decimals = 0) => {
    const n = Number(val);
    if (val === null || val === undefined || isNaN(n)) return '0';
    return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&family=Syne:wght@400;600;700;800&display=swap');

        .rec-page * { box-sizing: border-box; }

        .rec-page {
          min-height: 100vh;
          background: #080c0a;
          color: #e0e0e0;
          font-family: 'Syne', sans-serif;
          padding: 40px 24px 80px;
          position: relative;
          overflow-x: hidden;
        }

        .rec-page::before {
          content: '';
          position: fixed; inset: 0;
          background:
            radial-gradient(ellipse 60% 40% at 20% 0%, rgba(0,255,136,0.04) 0%, transparent 60%),
            radial-gradient(ellipse 40% 60% at 80% 100%, rgba(0,200,83,0.03) 0%, transparent 60%);
          pointer-events: none;
        }

        .rec-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 28px;
          align-items: start;
        }

        @media (max-width: 860px) {
          .rec-grid { grid-template-columns: 1fr; }
        }

        .rec-panel {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(0,255,136,0.1);
          border-radius: 12px;
          padding: 28px;
          backdrop-filter: blur(8px);
        }

        .rec-title {
          font-size: 11px;
          letter-spacing: 3px;
          color: #00ff88;
          font-family: 'JetBrains Mono', monospace;
          margin-bottom: 4px;
        }

        .rec-heading {
          font-size: 26px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 28px;
          line-height: 1.15;
        }

        .mode-tabs {
          display: flex;
          gap: 4px;
          background: rgba(0,0,0,0.4);
          border-radius: 8px;
          padding: 4px;
          margin-bottom: 22px;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .mode-tab {
          flex: 1;
          padding: 8px 4px;
          background: none;
          border: none;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'JetBrains Mono', monospace;
          color: #555;
        }

        .mode-tab.active {
          background: rgba(0,255,136,0.12);
          color: #00ff88;
          box-shadow: inset 0 0 0 1px rgba(0,255,136,0.25);
        }

        .field-label {
          display: block;
          font-size: 10px;
          letter-spacing: 2px;
          color: #00ff88;
          font-family: 'JetBrains Mono', monospace;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .field-wrap {
          margin-bottom: 20px;
        }

        .rec-select, .rec-input {
          width: 100%;
          background: rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          color: #e0e0e0;
          padding: 11px 14px;
          font-size: 14px;
          font-family: 'Syne', sans-serif;
          transition: border-color 0.2s, box-shadow 0.2s;
          appearance: none;
          -webkit-appearance: none;
        }

        .rec-select:focus, .rec-input:focus {
          outline: none;
          border-color: rgba(0,255,136,0.4);
          box-shadow: 0 0 0 3px rgba(0,255,136,0.07);
        }

        .rec-select option { background: #111; }

        .dist-display {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-bottom: 12px;
        }

        .dist-number {
          font-size: 42px;
          font-weight: 800;
          color: #00ff88;
          font-family: 'JetBrains Mono', monospace;
          line-height: 1;
          text-shadow: 0 0 20px rgba(0,255,136,0.3);
        }

        .dist-unit {
          font-size: 14px;
          color: #666;
          font-family: 'JetBrains Mono', monospace;
        }

        .dist-annual {
          font-size: 11px;
          color: #444;
          font-family: 'JetBrains Mono', monospace;
          margin-bottom: 12px;
        }

        .dist-slider {
          width: 100%;
          appearance: none;
          height: 3px;
          background: linear-gradient(
            to right,
            #00ff88 0%,
            #00ff88 var(--pct, 0%),
            rgba(255,255,255,0.08) var(--pct, 0%),
            rgba(255,255,255,0.08) 100%
          );
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          margin-bottom: 6px;
        }

        .dist-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px; height: 16px;
          background: #00ff88;
          border-radius: 50%;
          box-shadow: 0 0 12px rgba(0,255,136,0.5);
          cursor: pointer;
          transition: transform 0.15s;
        }

        .dist-slider::-webkit-slider-thumb:hover { transform: scale(1.25); }

        .dist-marks {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #333;
          font-family: 'JetBrains Mono', monospace;
        }

        .rec-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,200,83,0.1));
          border: 1px solid rgba(0,255,136,0.35);
          border-radius: 8px;
          color: #00ff88;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2.5px;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
          transition: all 0.25s;
          position: relative;
          overflow: hidden;
          margin-top: 4px;
        }

        .rec-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(0,255,136,0.22), rgba(0,200,83,0.15));
          box-shadow: 0 0 24px rgba(0,255,136,0.15), inset 0 0 0 1px rgba(0,255,136,0.5);
        }

        .rec-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .rec-btn.loading::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
          height: 2px;
          background: #00ff88;
          animation: scanline 1.2s ease-in-out infinite;
        }

        @keyframes scanline {
          0% { width: 0; left: 0; }
          50% { width: 100%; left: 0; }
          100% { width: 0; left: 100%; }
        }

        .results-area {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .results-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 4px;
        }

        .results-header-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #00ff88;
          box-shadow: 0 0 8px #00ff88;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .rec-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 22px 24px;
          position: relative;
          overflow: hidden;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease, border-color 0.3s, box-shadow 0.3s;
        }

        .rec-card.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .rec-card:nth-child(1) { transition-delay: 0.05s; }
        .rec-card:nth-child(2) { transition-delay: 0.15s; }
        .rec-card:nth-child(3) { transition-delay: 0.25s; }

        .rec-card:hover {
          border-color: rgba(0,255,136,0.2);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,255,136,0.08);
        }

        .rec-card-rank-bar {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          border-radius: 12px 0 0 12px;
        }

        .rec-card-top {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .rec-card-meta {
          flex: 1;
          min-width: 0;
        }

        .rec-rank-label {
          font-size: 9px;
          letter-spacing: 2.5px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .rec-vehicle-name {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rec-tags {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .rec-card-stats {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          padding: 14px 0;
          border-top: 1px solid rgba(255,255,255,0.05);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          margin-bottom: 14px;
        }

        .rec-stat-block {
          text-align: center;
        }

        .rec-stat-val {
          font-size: 18px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          color: #fff;
          line-height: 1;
          margin-bottom: 3px;
        }

        .rec-stat-label {
          font-size: 9px;
          color: #555;
          letter-spacing: 1px;
          font-family: 'JetBrains Mono', monospace;
        }

        .savings-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          background: rgba(0,255,136,0.07);
          border: 1px solid rgba(0,255,136,0.18);
          border-radius: 20px;
          font-size: 11px;
          color: #00ff88;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
        }

        .empty-state {
          padding: 60px 20px;
          text-align: center;
          border: 1px dashed rgba(255,255,255,0.07);
          border-radius: 12px;
        }

        .empty-icon {
          font-size: 36px;
          margin-bottom: 12px;
          opacity: 0.3;
        }

        .empty-text {
          font-size: 12px;
          color: #444;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 1px;
        }

        .error-box {
          background: rgba(255,80,80,0.06);
          border: 1px solid rgba(255,80,80,0.2);
          border-radius: 8px;
          padding: 14px 18px;
          color: #ff8080;
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
        }

        .scan-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 3px,
            rgba(0,0,0,0.04) 3px,
            rgba(0,0,0,0.04) 4px
          );
          opacity: 0.5;
          border-radius: 12px;
        }

        .map-hint {
          font-size: 10px;
          color: #444;
          font-family: 'JetBrains Mono', monospace;
          margin-top: 8px;
          letter-spacing: 0.5px;
        }

        /* ── Recycling badge ── */
        .recycling-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          background: rgba(178,223,219,0.08);
          border: 1px solid rgba(178,223,219,0.22);
          border-radius: 20px;
          font-size: 10px;
          color: #B2DFDB;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
          margin-top: 6px;
        }
      `}</style>

      <div className="rec-page">
        <div style={{ maxWidth: 1100, margin: '0 auto 32px', paddingBottom: 0 }}>
          <div className="rec-title">// CARBONWISE ANALYSIS ENGINE</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: '4px 0 0', lineHeight: 1.1 }}>
            Vehicle <span style={{ color: '#00ff88' }}>Recommender</span>
          </h1>
          <p style={{ color: '#444', fontSize: 13, marginTop: 8, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>
            Plot your route or set daily distance · We scan the full database · Results ranked by lifecycle CO₂
          </p>
        </div>

        <div className="rec-grid">

          {/* ── LEFT PANEL: Input Form ── */}
          <div>
            <div className="rec-panel">
              <div className="scan-lines" />

              <div className="field-wrap">
                <span className="field-label">DISTANCE INPUT MODE</span>
                <div className="mode-tabs">
                  {[
                    { key: 'daily',   label: 'PER DAY' },
                    { key: 'monthly', label: 'PER MONTH' },
                    { key: 'map',     label: '🗺 DRAW ROUTE' },
                  ].map(t => (
                    <button
                      key={t.key}
                      className={`mode-tab ${distanceMode === t.key ? 'active' : ''}`}
                      onClick={() => setDistanceMode(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {distanceMode !== 'map' ? (
                <div className="field-wrap">
                  <span className="field-label">
                    {distanceMode === 'daily' ? 'DAILY DISTANCE' : 'MONTHLY DISTANCE'}
                  </span>
                  <div className="dist-display">
                    <span className="dist-number">{distance}</span>
                    <span className="dist-unit">km / {distanceMode === 'daily' ? 'day' : 'month'}</span>
                  </div>
                  <div className="dist-annual">
                    ≈ {Math.round(annualKm).toLocaleString()} km / year
                  </div>
                  <input
                    type="range"
                    className="dist-slider"
                    min={distanceMode === 'daily' ? 5 : 100}
                    max={distanceMode === 'daily' ? 300 : 6000}
                    step={distanceMode === 'daily' ? 5 : 50}
                    value={distance}
                    style={{ '--pct': `${((distance - (distanceMode === 'daily' ? 5 : 100)) / ((distanceMode === 'daily' ? 295 : 5900))) * 100}%` }}
                    onChange={e => setDistance(Number(e.target.value))}
                  />
                  <div className="dist-marks">
                    <span>{distanceMode === 'daily' ? '5' : '100'}</span>
                    <span>{distanceMode === 'daily' ? '150' : '3,000'}</span>
                    <span>{distanceMode === 'daily' ? '300' : '6,000'} km</span>
                  </div>
                </div>
              ) : (
                <div className="field-wrap">
                  <span className="field-label">DRAW YOUR ROUTE</span>
                  <RouteMap onDistanceChange={setMapDistanceKm} distanceMode={distanceMode} />
                  {mapDistanceKm > 0 ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="dist-display" style={{ marginBottom: 2 }}>
                        <span className="dist-number" style={{ fontSize: 28 }}>{mapDistanceKm.toLocaleString()}</span>
                        <span className="dist-unit">km total route</span>
                      </div>
                      <div className="dist-annual">
                        If driven annually: {mapDistanceKm.toLocaleString()} km / year
                      </div>
                    </div>
                  ) : (
                    <p className="map-hint">Click at least 2 points to measure a route distance</p>
                  )}
                </div>
              )}

              <div className="field-wrap">
                <span className="field-label">POWERTRAIN PREFERENCE</span>
                <div style={{ position: 'relative' }}>
                  <select className="rec-select" value={powertrain} onChange={e => setPowertrain(e.target.value)}>
                    {POWERTRAIN_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#444', pointerEvents: 'none', fontSize: 12 }}>▾</span>
                </div>
              </div>

              <div className="field-wrap">
                <span className="field-label">GRID COUNTRY</span>
                <div style={{ position: 'relative' }}>
                  <select className="rec-select" value={country} onChange={e => setCountry(e.target.value)}>
                    {COUNTRIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#444', pointerEvents: 'none', fontSize: 12 }}>▾</span>
                </div>
              </div>

              <button
                className={`rec-btn ${loading ? 'loading' : ''}`}
                onClick={handleSubmit}
                disabled={loading || (distanceMode === 'map' && mapDistanceKm === 0)}
              >
                {loading ? 'SCANNING DATABASE…' : '⬡ FIND BEST VEHICLES'}
              </button>

              {distanceMode === 'map' && mapDistanceKm === 0 && (
                <p style={{ fontSize: 10, color: '#444', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center', marginTop: 8 }}>
                  Draw a route on the map first
                </p>
              )}
            </div>

            <div style={{
              marginTop: 14, padding: '14px 18px',
              background: 'rgba(0,255,136,0.03)',
              border: '1px solid rgba(0,255,136,0.08)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 9, color: '#00ff88', letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
                HOW IT WORKS
              </div>
              <p style={{ fontSize: 11, color: '#444', lineHeight: 1.6, margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                Rankings include full lifecycle CO₂ — manufacturing + operational + end-of-life recycling over 10 years.
                Grid intensity varies by country for EVs.
              </p>
            </div>
          </div>

          {/* ── RIGHT PANEL: Results ── */}
          <div>
            {!loading && recommendations.length === 0 && !error && (
              <div className="empty-state">
                <div className="empty-icon">⬡</div>
                <div className="empty-text">SET YOUR DISTANCE · SCAN DATABASE</div>
                <div style={{ fontSize: 10, color: '#2a2a2a', fontFamily: "'JetBrains Mono', monospace", marginTop: 8 }}>
                  UP TO 3 VEHICLES RANKED BY LIFECYCLE EMISSIONS
                </div>
              </div>
            )}

            {error && <div className="error-box">⚠ {error}</div>}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    height: 160, borderRadius: 12,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.04), transparent)',
                      animation: 'scanline 1.4s ease-in-out infinite',
                    }} />
                  </div>
                ))}
              </div>
            )}

            {!loading && recommendations.length > 0 && (
              <div className="results-area">
                <div className="results-header">
                  <div className="results-header-dot" />
                  <span style={{ fontSize: 10, color: '#444', letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                    {recommendations.length} VEHICLES RANKED · {Math.round(annualKm).toLocaleString()} KM/YR
                  </span>
                </div>

                {recommendations.map((rec, idx) => {
                  const score = calcScore(rec.total_g_per_km);
                  const rankColor = RANK_COLORS[idx];
                  const annualCO2   = isFinite(rec.annual_co2_kg) ? Math.round(rec.annual_co2_kg) : 0;
                  const recyclingKg = rec.recycling_kg ?? 0;
                  const hasRecycling = recyclingKg > 0;

                  return (
                    <div
                      key={`${rec.brand}-${rec.model}-${rec.year}-${idx}`}
                      className={`rec-card ${scanned ? 'visible' : ''}`}
                    >
                      <div className="rec-card-rank-bar" style={{ background: rankColor }} />
                      <div className="scan-lines" />

                      <div className="rec-card-top">
                        <ScoreRing score={isFinite(score) ? score : 0} />
                        <div className="rec-card-meta">
                          <div className="rec-rank-label" style={{ color: rankColor }}>
                            #{idx + 1} {RANK_LABELS[idx]}
                          </div>
                          <div className="rec-vehicle-name">
                            {rec.brand} {rec.model} <span style={{ color: '#444', fontWeight: 400 }}>({rec.year})</span>
                          </div>
                          <div className="rec-tags">
                            <TypeBadge type={rec.vehicle_type} />
                          </div>
                        </div>
                      </div>

                      <div className="rec-card-stats">
                        <div className="rec-stat-block">
                          <div className="rec-stat-val" style={{ color: rankColor }}>
                            {fmt(rec.total_for_distance_kg)}
                          </div>
                          <div className="rec-stat-label">TOTAL kg CO₂</div>
                        </div>
                        <div className="rec-stat-block">
                          <div className="rec-stat-val">{fmt(annualCO2)}</div>
                          <div className="rec-stat-label">kg CO₂/yr</div>
                        </div>
                        <div className="rec-stat-block">
                          <div className="rec-stat-val">{fmt(rec.total_g_per_km)}</div>
                          <div className="rec-stat-label">g CO₂/km</div>
                        </div>
                      </div>

                      {/* ── Operational + Manufacturing + Recycling blocks ── */}
                      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                        <div style={{
                          flex: '1 1 120px', background: 'rgba(255,255,255,0.04)',
                          borderRadius: 8, padding: '10px 14px',
                          borderLeft: `3px solid ${rankColor}`,
                        }}>
                          <div style={{ fontSize: 17, fontWeight: 700, color: rankColor }}>
                            {fmt(rec.operational_total_kg)} kg
                          </div>
                          <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginTop: 2 }}>
                            OPERATIONAL TOTAL
                          </div>
                        </div>
                        <div style={{
                          flex: '1 1 120px', background: 'rgba(255,255,255,0.04)',
                          borderRadius: 8, padding: '10px 14px',
                          borderLeft: '3px solid rgba(255,255,255,0.2)',
                        }}>
                          <div style={{ fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                            {fmt(rec.manufacturing_total_kg)} kg
                          </div>
                          <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginTop: 2 }}>
                            MANUFACTURING TOTAL
                          </div>
                        </div>
                        {/* ── NEW: Recycling block — only for EVs/PHEVs ── */}
                        {hasRecycling && (
                          <div style={{
                            flex: '1 1 120px', background: 'rgba(178,223,219,0.05)',
                            borderRadius: 8, padding: '10px 14px',
                            borderLeft: '3px solid rgba(178,223,219,0.35)',
                          }}>
                            <div style={{ fontSize: 17, fontWeight: 700, color: '#B2DFDB' }}>
                              {fmt(recyclingKg)} kg
                            </div>
                            <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginTop: 2 }}>
                              END-OF-LIFE RECYCLING
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        <StatBar
                          label={`OPERATIONAL  ${fmt(rec.operational_total_kg)} kg`}
                          value={rec.operational_total_kg}
                          max={Math.max(...recommendations.map(r => r.total_for_distance_kg)) * 1.1}
                          color={rankColor}
                        />
                        <StatBar
                          label={`MANUFACTURING  ${fmt(rec.manufacturing_total_kg)} kg (one-time)`}
                          value={rec.manufacturing_total_kg}
                          max={Math.max(...recommendations.map(r => r.total_for_distance_kg)) * 1.1}
                          color="rgba(255,255,255,0.25)"
                        />
                        {/* ── NEW: Recycling stat bar ── */}
                        {hasRecycling && (
                          <StatBar
                            label={`END-OF-LIFE RECYCLING  ${fmt(recyclingKg)} kg (one-time)`}
                            value={recyclingKg}
                            max={Math.max(...recommendations.map(r => r.total_for_distance_kg)) * 1.1}
                            color="rgba(178,223,219,0.5)"
                          />
                        )}
                      </div>

                      {(() => {
                        if (idx !== 0 || recommendations.length < 2) return null;
                        const best  = rec.personalized_total_kg;
                        const worst = Math.max(...recommendations.map(r => r.personalized_total_kg));
                        const saved = Math.round(worst - best);
                        if (!isFinite(saved)) return null;
                        return (
                          <div>
                            <span className="savings-pill">
                              <span>↓</span>
                              saves ~{saved.toLocaleString()} kg CO₂ vs worst option over {Math.round(lifetime_km / Math.max(annualKm, 1))} yr
                            </span>
                          </div>
                        );
                      })()}

                      {rec.reasons?.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{
                            fontSize: 9, color: RANK_COLORS[idx], letterSpacing: 2,
                            fontFamily: "'JetBrains Mono', monospace", marginBottom: 8, fontWeight: 700,
                          }}>
                            WHY THIS VEHICLE
                          </div>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {rec.reasons.map((reason, ri) => (
                              <li key={ri} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                                <span style={{ color: RANK_COLORS[idx], fontSize: 10, marginTop: 3, flexShrink: 0, opacity: 0.7 }}>◆</span>
                                <span style={{ fontSize: 11.5, color: '#888', lineHeight: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>
                                  {reason}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}