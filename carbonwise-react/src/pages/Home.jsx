import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

// ── Animated car SVG ──────────────────────────────────────────────────────────
function CarSVG({ className }) {
  return (
    <svg className={className} viewBox="0 0 220 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <path d="M20 52 L28 30 Q38 18 60 16 L140 16 Q162 16 178 28 L200 52 Z"
        fill="#0a1a0f" stroke="#00C853" strokeWidth="1.2"/>
      {/* Roof */}
      <path d="M55 52 L65 24 Q80 14 110 13 Q138 13 148 24 L160 52 Z"
        fill="#051008" stroke="#00C853" strokeWidth="0.8"/>
      {/* Windows */}
      <path d="M70 50 L77 26 Q88 18 108 18 Q125 18 132 26 L138 50 Z"
        fill="rgba(0,200,83,0.08)" stroke="rgba(0,200,83,0.3)" strokeWidth="0.6"/>
      {/* Window divider */}
      <line x1="108" y1="18" x2="107" y2="50" stroke="rgba(0,200,83,0.25)" strokeWidth="0.8"/>
      {/* Undercarriage */}
      <rect x="18" y="52" width="186" height="8" rx="2" fill="#051008" stroke="#00C853" strokeWidth="0.8"/>
      {/* Front wheel well */}
      <circle cx="55" cy="62" r="14" fill="#051008" stroke="#00C853" strokeWidth="1.2"/>
      <circle cx="55" cy="62" r="8" fill="#0a1a0f" stroke="rgba(0,200,83,0.5)" strokeWidth="0.8"/>
      <circle cx="55" cy="62" r="3" fill="#00C853"/>
      {/* Rear wheel well */}
      <circle cx="162" cy="62" r="14" fill="#051008" stroke="#00C853" strokeWidth="1.2"/>
      <circle cx="162" cy="62" r="8" fill="#0a1a0f" stroke="rgba(0,200,83,0.5)" strokeWidth="0.8"/>
      <circle cx="162" cy="62" r="3" fill="#00C853"/>
      {/* Headlights */}
      <ellipse cx="198" cy="40" rx="5" ry="7" fill="rgba(0,200,83,0.15)" stroke="#00C853" strokeWidth="0.8"/>
      <ellipse cx="198" cy="40" rx="2.5" ry="4" fill="rgba(0,200,83,0.6)"/>
      {/* Tail lights */}
      <rect x="19" y="36" width="4" height="10" rx="1" fill="rgba(255,82,82,0.4)" stroke="#FF5252" strokeWidth="0.5"/>
      {/* EV badge */}
      <rect x="88" y="54" width="22" height="8" rx="2" fill="rgba(0,200,83,0.15)" stroke="rgba(0,200,83,0.5)" strokeWidth="0.5"/>
      <text x="99" y="61" textAnchor="middle" fill="#00C853" fontSize="5" fontWeight="bold" fontFamily="monospace">EV</text>
      {/* Door line */}
      <path d="M107 52 L104 22" stroke="rgba(0,200,83,0.2)" strokeWidth="0.6"/>
    </svg>
  );
}

// ── Particle canvas for exhaust/energy trail ──────────────────────────────────
function ParticleCanvas({ carX, containerWidth }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = containerWidth || window.innerWidth;
    canvas.height = 120;

    function spawnParticle() {
      const isGreen = Math.random() > 0.3;
      particlesRef.current.push({
        x:    carX - 10,
        y:    80 + (Math.random() - 0.5) * 12,
        vx:   -(Math.random() * 1.5 + 0.5),
        vy:   (Math.random() - 0.5) * 0.8,
        life: 1,
        size: Math.random() * 4 + 1,
        color: isGreen ? `rgba(0,200,83,` : `rgba(105,240,174,`,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Spawn particles near rear of car
      if (carX > 30 && carX < canvas.width + 100) {
        for (let i = 0; i < 2; i++) spawnParticle();
      }
      particlesRef.current = particlesRef.current.filter(p => p.life > 0.02);
      particlesRef.current.forEach(p => {
        p.x    += p.vx;
        p.y    += p.vy;
        p.life *= 0.96;
        p.size *= 0.99;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.life.toFixed(2)})`;
        ctx.fill();
      });
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [carX, containerWidth]);

  return <canvas ref={canvasRef} className="particle-canvas" aria-hidden="true" />;
}

// ── Animated grid background ──────────────────────────────────────────────────
function GridBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width  = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    let t = 0;

    const onResize = () => {
      w = canvas.width  = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    let raf;
    function draw() {
      ctx.clearRect(0, 0, w, h);
      t += 0.003;

      const COLS = 24, ROWS = 14;
      const cw = w / COLS, rh = h / ROWS;

      for (let r = 0; r <= ROWS; r++) {
        for (let c = 0; c <= COLS; c++) {
          const wave = Math.sin(c * 0.4 + t) * Math.cos(r * 0.5 + t * 0.7);
          const alpha = (wave + 1) * 0.025;
          ctx.strokeStyle = `rgba(0,200,83,${alpha.toFixed(3)})`;
          ctx.lineWidth = 0.5;
          if (c < COLS) {
            ctx.beginPath();
            ctx.moveTo(c * cw, r * rh);
            ctx.lineTo((c + 1) * cw, r * rh);
            ctx.stroke();
          }
          if (r < ROWS) {
            ctx.beginPath();
            ctx.moveTo(c * cw, r * rh);
            ctx.lineTo(c * cw, (r + 1) * rh);
            ctx.stroke();
          }
          // Intersection dots
          const dotAlpha = Math.max(0, wave * 0.08);
          ctx.beginPath();
          ctx.arc(c * cw, r * rh, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,200,83,${dotAlpha.toFixed(3)})`;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={canvasRef} className="grid-bg" aria-hidden="true" />;
}

// ── Animated number counter ───────────────────────────────────────────────────
function CountUp({ target, duration = 1800, suffix = '', prefix = '' }) {
  const [val, setVal]   = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    const raf = requestAnimationFrame(function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);

  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

// ── Scroll-reveal wrapper ────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.15 });
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

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [carX, setCarX]   = useState(-260);
  const [parked, setParked] = useState(false);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const CW = useRef(typeof window !== 'undefined' ? window.innerWidth : 1400);

  // Car drive-in animation
  useEffect(() => {
    CW.current = window.innerWidth;
    const target = CW.current * 0.5 - 110;
    const duration = 2800;

    function tick(now) {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const p = Math.min(elapsed / duration, 1);
      // Custom ease: fast entry, gentle stop
      const ease = p < 0.7
        ? (p / 0.7) * 0.85
        : 0.85 + ((p - 0.7) / 0.3) * 0.15;
      setCarX(-260 + (target + 260) * ease);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setParked(true);
    }
    // Slight delay before car enters
    const timer = setTimeout(() => { rafRef.current = requestAnimationFrame(tick); }, 400);
    return () => { clearTimeout(timer); cancelAnimationFrame(rafRef.current); };
  }, []);

  const tools = [
    { to: '/compare',      icon: '⟳', label: 'Multi-Vehicle Compare',   desc: 'Side-by-side lifecycle analysis for up to 3 vehicles with real-time charts.' },
    { to: '/recommend',    icon: '◎', label: 'Smart Recommendations',    desc: 'Personalised picks based on your usage, grid, and sustainability goals.' },
    { to: '/break-even',   icon: '⌁', label: 'Break-Even Analysis',      desc: 'Find the exact kilometre where an EV\'s total emissions beat a petrol car.' },
    { to: '/greenwashing', icon: '⚑', label: 'Greenwashing Detector',    desc: 'AI-powered marketing claim verification against real lifecycle data.' },
    { to: '/grid-insights',icon: '◈', label: 'Grid Insights + ML Forecast', desc: 'GPR machine-learning forecast of grid carbon intensity for 200+ countries.' },
    { to: '/methodology',  icon: '◻', label: 'Methodology',              desc: 'GREET2, WLTP, and EU EmpCo Directive — every assumption documented.' },
  ];

  const stats = [
    { value: 220,  suffix: ' g/km', label: 'Avg petrol car lifecycle',  color: '#FF5252' },
    { value: 75,   suffix: ' g/km', label: 'Avg EV lifecycle (EU grid)', color: '#00C853' },
    { value: 200,  suffix: '+',     label: 'Countries with grid data',   color: '#69F0AE' },
    { value: 3,    suffix: '×',     label: 'Cleaner — EV vs petrol',     color: '#B2DFDB' },
  ];

  return (
    <main className="cw-home">
      {/* ── HERO ── */}
      <section className="cw-hero">
        <GridBackground />

        {/* Radial spotlight */}
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
            <Link to="/recommend" className="cw-btn cw-btn--ghost">Get Recommendation</Link>
            <Link to="/grid-insights" className="cw-btn cw-btn--ghost">Grid Insights + ML</Link>
          </div>
        </div>

        {/* ── Animated car stage ── */}
        <div className="cw-car-stage" ref={containerRef} aria-hidden="true">
          <ParticleCanvas carX={carX} containerWidth={CW.current} />
          {/* Road line */}
          <div className="cw-road">
            <div className="cw-road-dash" />
          </div>
          <div
            className={`cw-car-wrap ${parked ? 'cw-car-wrap--parked' : ''}`}
            style={{ transform: `translateX(${carX}px)` }}
          >
            <CarSVG className="cw-car-svg" />
            {/* Headlight beam */}
            {!parked && (
              <div className="cw-headlight-beam" />
            )}
          </div>
          {/* Shadow under car */}
          <div
            className="cw-car-shadow"
            style={{ left: carX + 30, opacity: parked ? 0.5 : 0.3 }}
          />
        </div>

        {/* Scroll hint */}
        <div className="cw-scroll-hint" aria-hidden="true">
          <span>scroll</span>
          <div className="cw-scroll-arrow" />
        </div>
      </section>

      {/* ── STATS STRIP ── */}
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

      {/* ── FEATURES ── */}
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
              {
                icon: '🏭',
                title: 'GREET2 Manufacturing',
                body: 'Production emissions for glider, battery pack, fluids, and assembly — the same model used by the US Department of Energy.',
                accent: '#00C853',
              },
              {
                icon: '⚡',
                title: 'Live Grid Intensity',
                body: '200+ countries with transmission & distribution losses. GPR machine-learning forecast to 2034 with 95% confidence bands.',
                accent: '#69F0AE',
              },
              {
                icon: '🚗',
                title: 'WLTP Operational',
                body: 'Real-world fuel cycle emissions using official WLTP test data combined with well-to-wheel fuel upstream analysis.',
                accent: '#B2DFDB',
              },
              {
                icon: '♻',
                title: 'End-of-Life Recycling',
                body: 'Battery recycling (1.47 kg CO₂/kg), metal recovery credits, and ASR shredder residue — per GREET2 ELV methodology.',
                accent: '#FFD740',
              },
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

      {/* ── EMISSIONS VISUALISER ── */}
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
              { label: 'Petrol ICE',  mfg: 40, ops: 175, rec: 0,   total: 215, type: 'ice'  },
              { label: 'HEV Hybrid',  mfg: 44, ops: 130, rec: 0,   total: 174, type: 'hev'  },
              { label: 'PHEV',        mfg: 52, ops: 82,  rec: 5,   total: 139, type: 'phev' },
              { label: 'Battery EV',  mfg: 75, ops: 0,   rec: 18,  total: 93,  type: 'bev'  },
            ].map((v, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className={`cw-viz-bar-card cw-viz-bar-card--${v.type}`}>
                  <div className="cw-viz-label">{v.label}</div>
                  <div className="cw-viz-track">
                    <div className="cw-viz-seg cw-viz-seg--mfg"  style={{ '--w': `${(v.mfg / 220) * 100}%` }} title={`Manufacturing: ${v.mfg} g/km`} />
                    <div className="cw-viz-seg cw-viz-seg--ops"  style={{ '--w': `${(v.ops / 220) * 100}%` }} title={`Operational: ${v.ops} g/km`} />
                    {v.rec > 0 && <div className="cw-viz-seg cw-viz-seg--rec" style={{ '--w': `${(v.rec / 220) * 100}%` }} title={`Recycling: ${v.rec} g/km`} />}
                  </div>
                  <div className="cw-viz-total">{v.total} <span>g/km</span></div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={500}>
            <div className="cw-viz-legend">
              <span><span className="cw-leg-dot cw-leg-dot--mfg"/>Manufacturing</span>
              <span><span className="cw-leg-dot cw-leg-dot--ops"/>Operational</span>
              <span><span className="cw-leg-dot cw-leg-dot--rec"/>Recycling</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TOOLS GRID ── */}
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

      {/* ── CTA FOOTER ── */}
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