import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';
import bgImage from '../components/images/back.jpeg';

// ── Car SVG ───────────────────────────────────────────────────────────────────
function CarSVG({ className }) {
  return (
    <svg className={className} viewBox="0 0 220 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 52 L28 30 Q38 18 60 16 L140 16 Q162 16 178 28 L200 52 Z"
        fill="#0a1a0f" stroke="#00C853" strokeWidth="1.2"/>
      <path d="M55 52 L65 24 Q80 14 110 13 Q138 13 148 24 L160 52 Z"
        fill="#051008" stroke="#00C853" strokeWidth="0.8"/>
      <path d="M70 50 L77 26 Q88 18 108 18 Q125 18 132 26 L138 50 Z"
        fill="rgba(0,200,83,0.08)" stroke="rgba(0,200,83,0.3)" strokeWidth="0.6"/>
      <line x1="108" y1="18" x2="107" y2="50" stroke="rgba(0,200,83,0.25)" strokeWidth="0.8"/>
      <rect x="18" y="52" width="186" height="8" rx="2" fill="#051008" stroke="#00C853" strokeWidth="0.8"/>
      <circle cx="55"  cy="62" r="14" fill="#051008" stroke="#00C853" strokeWidth="1.2"/>
      <circle cx="55"  cy="62" r="8"  fill="#0a1a0f" stroke="rgba(0,200,83,0.5)" strokeWidth="0.8"/>
      <circle cx="55"  cy="62" r="3"  fill="#00C853"/>
      <circle cx="162" cy="62" r="14" fill="#051008" stroke="#00C853" strokeWidth="1.2"/>
      <circle cx="162" cy="62" r="8"  fill="#0a1a0f" stroke="rgba(0,200,83,0.5)" strokeWidth="0.8"/>
      <circle cx="162" cy="62" r="3"  fill="#00C853"/>
      <ellipse cx="198" cy="40" rx="5"   ry="7" fill="rgba(0,200,83,0.15)" stroke="#00C853" strokeWidth="0.8"/>
      <ellipse cx="198" cy="40" rx="2.5" ry="4" fill="rgba(0,200,83,0.6)"/>
      <rect x="19" y="36" width="4" height="10" rx="1" fill="rgba(255,82,82,0.4)" stroke="#FF5252" strokeWidth="0.5"/>
      <rect x="88" y="54" width="22" height="8" rx="2" fill="rgba(0,200,83,0.15)" stroke="rgba(0,200,83,0.5)" strokeWidth="0.5"/>
      <text x="99" y="61" textAnchor="middle" fill="#00C853" fontSize="5" fontWeight="bold" fontFamily="monospace">EV</text>
    </svg>
  );
}

// ── Animated counter ──────────────────────────────────────────────────────────
function CountUp({ target, duration = 1800, suffix = '' }) {
  const [val, setVal]         = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setStarted(true); },
      { threshold: 0.5 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    let rafId;
    const tick = now => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [started, target, duration]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ── Scroll-reveal ─────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVis(true); },
      { threshold: 0.12 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`reveal ${vis ? 'reveal--visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const tools = [
    { to: '/compare',       icon: '⟳', label: 'Multi-Vehicle Compare',      desc: 'Side-by-side lifecycle analysis for up to 3 vehicles with real-time charts.' },
    { to: '/recommend',     icon: '◎', label: 'Smart Recommendations',       desc: 'Personalised picks based on your usage, grid, and sustainability goals.' },
    { to: '/break-even',    icon: '⌁', label: 'Break-Even Analysis',         desc: "Find the exact kilometre where an EV's total emissions beat a petrol car." },
    { to: '/greenwashing',  icon: '⚑', label: 'Greenwashing Detector',       desc: 'AI-powered marketing claim verification against real lifecycle data.' },
    { to: '/grid-insights', icon: '◈', label: 'Grid Insights + ML Forecast', desc: 'GPR machine-learning forecast of grid carbon intensity for 200+ countries.' },
    { to: '/methodology',   icon: '◻', label: 'Methodology',                 desc: 'GREET2, WLTP, and EU EmpCo Directive — every assumption documented.' },
  ];

  const stats = [
    { value: 220, suffix: ' g/km', label: 'Avg petrol car lifecycle',   color: '#FF5252' },
    { value: 75,  suffix: ' g/km', label: 'Avg EV lifecycle (EU grid)',  color: '#00C853' },
    { value: 200, suffix: '+',     label: 'Countries with grid data',    color: '#69F0AE' },
    { value: 3,   suffix: '×',     label: 'Cleaner — EV vs petrol',      color: '#B2DFDB' },
  ];

  return (
    <main className="cw-home">

      <div className="cw-bg-image" style={{ backgroundImage: `url(${bgImage})` }} aria-hidden="true" />
      <div className="cw-bg-overlay" aria-hidden="true" />

      {/* ── Hero ── */}
      <section className="cw-hero">
        <div className="cw-spotlight" aria-hidden="true" />

        <div className="cw-hero-content">
          <div className="cw-eyebrow">
            <span className="cw-eyebrow-dot" />
            GREET2 · WLTP · EU EmpCo 2024/825
          </div>
          <h1 className="cw-hero-title">
            <span className="cw-title-line cw-title-line--1">The True Cost</span>
            <span className="cw-title-line cw-title-line--2">of Every Car</span>
            <span className="cw-title-line cw-title-line--3">on the Planet</span>
          </h1>
          <p className="cw-hero-sub">
            Manufacturing · Grid · Fuel · Recycling — unified into one number.
          </p>
          <div className="cw-hero-cta">
            <Link to="/compare" className="cw-btn cw-btn--primary">
              <span>Compare Vehicles</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link to="/recommend"     className="cw-btn cw-btn--ghost">Get Recommendation</Link>
            <Link to="/grid-insights" className="cw-btn cw-btn--ghost">Grid Insights + ML</Link>
          </div>
          <div className="cw-data-ticker" aria-hidden="true">
            {[
              { dot: '#FF5252', text: 'ICE avg 220 g/km'   },
              { dot: '#00C853', text: 'EV (EU) 75 g/km'    },
              { dot: '#69F0AE', text: '200+ grid regions'  },
              { dot: '#FFD740', text: 'GREET2 methodology' },
            ].map(({ dot, text }) => (
              <span key={text} className="cw-ticker-item">
                <span className="cw-ticker-dot" style={{ background: dot }} />
                {text}
              </span>
            ))}
          </div>
        </div>

        {/* Car stage — pure CSS, no JS animation whatsoever */}
        <div className="cw-car-stage" aria-hidden="true">
          <div className="cw-road"><div className="cw-road-dash" /></div>
          <div className="cw-car-wrap cw-car-drive">
            <CarSVG className="cw-car-svg" />
            <div className="cw-headlight-beam" />
          </div>
          <div className="cw-exhaust-trail cw-car-drive" />
          <div className="cw-car-shadow cw-car-drive" />
        </div>

        <div className="cw-scroll-hint" aria-hidden="true">
          <span>scroll</span>
          <div className="cw-scroll-arrow" />
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="cw-stats-strip" aria-label="Key statistics">
        {stats.map((s, i) => (
          <Reveal key={i} delay={i * 80} className="cw-stat">
            <div className="cw-stat-val" style={{ color: s.color }}>
              <CountUp target={s.value} suffix={s.suffix} />
            </div>
            <div className="cw-stat-label">{s.label}</div>
          </Reveal>
        ))}
      </section>

      {/* ── Features ── */}
      <section className="cw-features">
        <div className="cw-section-inner">
          <Reveal>
            <div className="cw-section-head">
              <span className="cw-tag">Methodology</span>
              <h2>Comprehensive Lifecycle Analysis</h2>
              <p>Every gram accounted for — from ore extraction to end-of-life recycling.</p>
            </div>
          </Reveal>
          <div className="cw-feature-grid">
            {[
              { icon: '🏭', title: 'GREET2 Manufacturing',  body: 'Production emissions for glider, battery pack, fluids, and assembly — the same model used by the US Department of Energy.', accent: '#00C853' },
              { icon: '⚡', title: 'Live Grid Intensity',   body: '200+ countries with T&D losses. GPR machine-learning forecast to 2034 with 95% confidence bands.',                            accent: '#69F0AE' },
              { icon: '🚗', title: 'WLTP Operational',      body: 'Real-world fuel cycle emissions using official WLTP test data combined with well-to-wheel fuel upstream analysis.',            accent: '#B2DFDB' },
              { icon: '♻', title: 'End-of-Life Recycling', body: 'Battery recycling (1.47 kg CO₂/kg), metal recovery credits, and ASR shredder residue — per GREET2 ELV methodology.',         accent: '#FFD740' },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="cw-feature-card" style={{ '--card-accent': f.accent }}>
                  <div className="cw-feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                  <div className="cw-feature-bar" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Emissions visualiser ── */}
      <section className="cw-viz-section">
        <div className="cw-section-inner">
          <Reveal>
            <div className="cw-section-head">
              <span className="cw-tag">At a Glance</span>
              <h2>Lifecycle Emissions Breakdown</h2>
            </div>
          </Reveal>
          <div className="cw-viz-row">
            {[
              { label: 'Petrol ICE', mfg: 40, ops: 175, rec: 0,  total: 215, type: 'ice'  },
              { label: 'HEV Hybrid', mfg: 44, ops: 130, rec: 0,  total: 174, type: 'hev'  },
              { label: 'PHEV',       mfg: 52, ops: 82,  rec: 5,  total: 139, type: 'phev' },
              { label: 'Battery EV', mfg: 75, ops: 0,   rec: 18, total: 93,  type: 'bev'  },
            ].map((v, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className={`cw-viz-bar-card cw-viz-bar-card--${v.type}`}>
                  <div className="cw-viz-label">{v.label}</div>
                  <div className="cw-viz-track">
                    <div className="cw-viz-seg cw-viz-seg--mfg" style={{ '--w': `${(v.mfg / 220) * 100}%` }} />
                    <div className="cw-viz-seg cw-viz-seg--ops" style={{ '--w': `${(v.ops / 220) * 100}%` }} />
                    {v.rec > 0 && <div className="cw-viz-seg cw-viz-seg--rec" style={{ '--w': `${(v.rec / 220) * 100}%` }} />}
                  </div>
                  <div className="cw-viz-total">{v.total} <span>g/km</span></div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={500}>
            <div className="cw-viz-legend">
              <span><span className="cw-leg-dot cw-leg-dot--mfg" />Manufacturing</span>
              <span><span className="cw-leg-dot cw-leg-dot--ops" />Operational</span>
              <span><span className="cw-leg-dot cw-leg-dot--rec" />Recycling</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Tools grid ── */}
      <section className="cw-tools">
        <div className="cw-section-inner">
          <Reveal>
            <div className="cw-section-head">
              <span className="cw-tag">Platform</span>
              <h2>Analysis Tools</h2>
            </div>
          </Reveal>
          <div className="cw-tools-grid">
            {tools.map((t, i) => (
              <Reveal key={i} delay={i * 70}>
                <Link to={t.to} className="cw-tool-card">
                  <div className="cw-tool-icon">{t.icon}</div>
                  <div className="cw-tool-body">
                    <h3>{t.label}</h3>
                    <p>{t.desc}</p>
                  </div>
                  <div className="cw-tool-arrow">→</div>
                  <div className="cw-tool-glow" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="cw-bottom-cta">
        <Reveal>
          <p className="cw-bottom-eyebrow">Ready to find out?</p>
          <h2 className="cw-bottom-title">What's your car really costing the planet?</h2>
          <Link to="/compare" className="cw-btn cw-btn--primary cw-btn--xl">
            Start Comparing Now
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </Reveal>
      </section>

    </main>
  );
}