import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import '../styles/landing.css';

function Home() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Resize canvas on window resize
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Line graph animation
    const points = [];
    const numPoints = 50;

    // Initialize points
    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: (width / numPoints) * i,
        y: height / 2 + Math.sin(i * 0.2) * 50,
        vy: (Math.random() - 0.5) * 0.5
      });
    }

    let animationFrameId;

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Update and draw points
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 200, 83, 0.3)';
      ctx.lineWidth = 2;

      points.forEach((point, i) => {
        // Update y position
        point.y += point.vy;

        // Bounce off edges
        if (point.y < height * 0.3 || point.y > height * 0.7) {
          point.vy *= -1;
        }

        // Draw line
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });

      ctx.stroke();

      // Draw glow effect
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(0, 200, 83, 0.5)';
      ctx.stroke();
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(animate);
    }

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <main>
      {/* Hero Section */}
      <section className="hero" aria-label="Hero section">
        <canvas ref={canvasRef} id="animated-bg" className="hero-bg" aria-hidden="true" role="presentation"></canvas>
        <div className="container hero-content">
          <h1 className="hero-title">Compare True Vehicle Carbon Impact</h1>
          <p className="hero-subtitle">Manufacturing + Grid + Fuel Lifecycle Emissions</p>
          <div className="hero-cta">
            <Link to="/compare">
              <Button variant="primary" className="btn-lg">Compare Vehicles</Button>
            </Link>
            <Link to="/recommend">
              <Button variant="secondary" className="btn-lg">Get Recommendation</Button>
            </Link>
            <Link to="/break-even">
              <Button variant="outline" className="btn-lg">Break-Even Analysis</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="features" aria-labelledby="features-heading">
        <div className="container">
          <h2 id="features-heading" className="text-center mb-xl">Comprehensive Lifecycle Analysis</h2>
          <div className="grid grid-3">
            <article className="card card-hoverable">
              <div className="feature-icon" aria-hidden="true">🏭</div>
              <h3>GREET Manufacturing Model</h3>
              <p>Accurate production emissions including glider, battery, and fluids using the industry-standard GREET methodology.</p>
            </article>
            <article className="card card-hoverable">
              <div className="feature-icon" aria-hidden="true">⚡</div>
              <h3>Real Grid Emissions</h3>
              <p>Country-specific electricity grid intensity data with transmission and distribution losses factored in.</p>
            </article>
            <article className="card card-hoverable">
              <div className="feature-icon" aria-hidden="true">🚗</div>
              <h3>WLTP + Fuel Lifecycle</h3>
              <p>Operational emissions based on WLTP testing standards and complete fuel lifecycle analysis.</p>
            </article>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="tools" aria-labelledby="tools-heading">
        <div className="container">
          <h2 id="tools-heading" className="text-center mb-xl">Analysis Tools</h2>
          <div className="grid grid-2">
            <Link to="/compare" className="tool-card card card-hoverable">
              <h3>🔄 Multi-Vehicle Comparison</h3>
              <p>Compare up to 3 vehicles side-by-side with real-time lifecycle calculations and interactive charts.</p>
            </Link>
            <Link to="/recommend" className="tool-card card card-hoverable">
              <h3>🎯 Smart Recommendations</h3>
              <p>Get personalized vehicle recommendations based on your budget, usage, and sustainability goals.</p>
            </Link>
            <Link to="/break-even" className="tool-card card card-hoverable">
              <h3>📊 Break-Even Analysis</h3>
              <p>Calculate the distance at which an EV's total emissions equal an ICE vehicle's emissions.</p>
            </Link>
            <Link to="/greenwashing" className="tool-card card card-hoverable">
              <h3>🔍 Greenwashing Detector</h3>
              <p>Analyze vehicle environmental claims for accuracy and detect misleading marketing.</p>
            </Link>
            <Link to="/grid-insights" className="tool-card card card-hoverable">
              <h3>🌍 Grid Insights</h3>
              <p>Explore country-specific grid emissions data with historical trends and future forecasts.</p>
            </Link>
            <Link to="/methodology" className="tool-card card card-hoverable">
              <h3>📚 Methodology</h3>
              <p>Learn about our calculation methods, data sources, and validation processes.</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;
