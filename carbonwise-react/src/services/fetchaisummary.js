// ─────────────────────────────────────────────────────────────────
// Replace your existing fetchAiSummary function with this version.
// Changes:
//   1. Winner is determined CLIENT-SIDE (lowest total_for_distance_kg)
//   2. Gemini /ai-summary + /lifecycle for winner fire in PARALLEL
//   3. Winner stats merged into aiSummary as `winner_stats`
// ─────────────────────────────────────────────────────────────────

async function fetchAiSummary(vehiclesWithData) {
  setAiLoading(true);
  setAiSummary(null);

  // ── 1. Find winner client-side (no need to wait for Gemini) ──
  const winner = vehiclesWithData.reduce((best, v) => {
    const total = v.lifecycle?.total_for_distance_kg ?? Infinity;
    return total < (best.lifecycle?.total_for_distance_kg ?? Infinity) ? v : best;
  }, vehiclesWithData[0]);

  try {
    // ── 2. Fire both requests at the same time ──
    const [aiRes, statsRes] = await Promise.all([

      // Gemini AI analysis
      fetch(`${API}/ai-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicles: vehiclesWithData.map(v => ({
            brand: v.brand,
            model: v.model,
            year: v.year,
            vehicle_type: v.vehicle_type,
            lifecycle: v.lifecycle
          })),
          distance_km: distanceKm
        })
      }),

      // Winner lifecycle stats from backend
      fetch(`${API}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: winner.brand,
          model: winner.model,
          year: winner.year,
          country,
          grid_year: 2023,
          distance_km: distanceKm
        })
      })

    ]);

    // ── 3. Parse both responses in parallel too ──
    const [aiData, statsData] = await Promise.all([aiRes.json(), statsRes.json()]);

    console.log("🏆 Client-side winner:", `${winner.brand} ${winner.model} ${winner.year}`);
    console.log("📊 Winner lifecycle stats:", statsData);
    console.log("🤖 Gemini response:", aiData);

    // ── 4. Merge winner stats into the AI summary object ──
    setAiSummary({
      ...aiData,
      winner_stats: statsData.error ? null : statsData
    });

  } catch (err) {
    console.error("AI summary error:", err);
  } finally {
    setAiLoading(false);
  }
}


// ─────────────────────────────────────────────────────────────────
// OPTIONAL: render winner_stats in the winner card (Compare.jsx)
// Add this block inside ai-winner-info, after the verdict <p>:
// ─────────────────────────────────────────────────────────────────

/*
{aiSummary.winner_stats && (
  <div className="ai-winner-stats">
    <div className="ai-winner-stat">
      <span>Operational</span>
      <strong>
        {aiSummary.winner_stats.operational_total_kg?.toLocaleString(
          undefined, { maximumFractionDigits: 0 }
        )} kg
      </strong>
    </div>
    <div className="ai-winner-stat">
      <span>Manufacturing</span>
      <strong>
        {aiSummary.winner_stats.manufacturing_total_kg?.toLocaleString(
          undefined, { maximumFractionDigits: 0 }
        )} kg
      </strong>
    </div>
    <div className="ai-winner-stat">
      <span>Rate</span>
      <strong>{aiSummary.winner_stats.total_g_per_km} g/km</strong>
    </div>
  </div>
)}
*/