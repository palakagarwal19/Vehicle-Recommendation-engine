// ===============================
// RECOMMENDATION ENGINE (API DRIVEN)
// ===============================

async function getRecommendations(criteria) {
  try {
    const response = await fetch('http://localhost:5000/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        country: criteria.country,
        year: new Date().getFullYear(),
        filters: {
          bodyType: criteria.bodyType || undefined,
          powertrain: criteria.powertrain || undefined,
          priceMin: criteria.budgetMin,
          priceMax: criteria.budgetMax
        }
      })
    });

    const data = await response.json();

    if (data.error || !data.recommended) return [];

    return data.recommended.map((vehicle, index) => {

      const score = Math.max(0, 100 - (vehicle.total_g_per_km / 2));

      let scoreClass = 'excellent';
      if (score < 70) scoreClass = 'good';
      if (score < 50) scoreClass = 'moderate';

      return {
        vehicle,
        ranking: index + 1,
        score: Math.round(score),
        scoreClass,
        reasons: generateReasons(vehicle)
      };
    });

  } catch (error) {
    console.error('Recommendation error:', error);
    return [];
  }
}


// ===============================
// REASONING ENGINE
// ===============================

function generateReasons(vehicle) {
  const reasons = [];

  if (vehicle.powertrain === 'EV')
    reasons.push('Zero tailpipe emissions');

  if (vehicle.operational_g_per_km < 80)
    reasons.push('Very low operational emissions');

  if (vehicle.total_g_per_km < 100)
    reasons.push('Outstanding lifecycle footprint');
  else if (vehicle.total_g_per_km < 140)
    reasons.push('Low lifecycle emissions');

  if (vehicle.manufacturing_g_per_km < 30)
    reasons.push('Efficient manufacturing profile');

  return reasons;
}


// ===============================
// RENDERING
// ===============================

function renderRecommendations(recommendations) {

  const container = document.getElementById('recommendations');
  const results = document.getElementById('results');

  if (recommendations.length === 0) {
    container.innerHTML =
      '<p class="text-center">No vehicles match your criteria. Try adjusting your filters.</p>';
    results.style.display = 'block';
    return;
  }

  container.innerHTML = '';

  recommendations.forEach(rec => {

    const card = document.createElement('div');
    card.className = `recommendation-card rank-${rec.ranking}`;

    card.innerHTML = `
      <div class="flex-between mb-sm">
        <h4>#${rec.ranking} ${rec.vehicle.vehicle}</h4>
        <span class="score score-${rec.scoreClass}">${rec.score}/100</span>
      </div>

      <p>
        <span class="badge badge-${rec.vehicle.powertrain.toLowerCase()}">
          ${rec.vehicle.powertrain}
        </span>
      </p>

      <p class="mt-sm">
        <strong>Lifecycle:</strong> ${rec.vehicle.total_g_per_km.toFixed(1)} g/km
      </p>

      <div class="reasoning">
        <strong>Why recommended:</strong>
        <ul>
          ${rec.reasons.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    `;

    container.appendChild(card);
  });

  results.style.display = 'block';
}


// ===============================
// FORM HANDLER
// ===============================

document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('criteria-form')
    .addEventListener('submit', async (e) => {

      e.preventDefault();

      const criteria = {
        budgetMin: parseInt(document.getElementById('budget-min').value),
        budgetMax: parseInt(document.getElementById('budget-max').value),
        bodyType: document.getElementById('body-type').value,
        country: document.getElementById('country').value,
        annualKm: parseInt(document.getElementById('annual-km').value),
        powertrain: document.getElementById('powertrain').value
      };

      const recommendations = await getRecommendations(criteria);
      renderRecommendations(recommendations);
    });
});