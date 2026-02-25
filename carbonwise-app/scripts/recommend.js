let vehicles = [];

async function loadVehicles() {
  try {
    vehicles = await api.getAllVehicles();
  } catch (error) {
    console.error('Error loading vehicles:', error);
  }
}

async function getRecommendations(criteria) {
  try {
    // Calculate daily km from annual km
    const dailyKm = criteria.annualKm / 365;
    const years = 10; // Default 10 years
    
    // Call backend API with country
    const recommendations = await api.getRecommendations(dailyKm, years, {
      powertrain: criteria.powertrain || null
    }, criteria.country || 'US', 2023);
    
    if (recommendations.error) {
      throw new Error(recommendations.error);
    }
    
    // Recommendations are already sorted by emissions
    return recommendations.slice(0, 3).map((rec, index) => {
      const score = calculateScore(rec.total_g_per_km);
      let scoreClass = 'excellent';
      if (score < 70) scoreClass = 'good';
      if (score < 50) scoreClass = 'moderate';
      
      const reasons = [];
      if (rec.powertrain === 'EV') reasons.push('Zero tailpipe emissions');
      if (rec.manufacturing_g_per_km < 50) reasons.push('Lower manufacturing emissions');
      if (rec.total_g_per_km < 100) reasons.push('Excellent lifecycle efficiency');
      if (rec.operational_g_per_km < 50) reasons.push('Low operational emissions');
      
      return {
        vehicle: rec,
        ranking: index + 1,
        score: Math.round(score),
        scoreClass,
        reasons
      };
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return [];
  }
}

function calculateScore(totalGPerKm) {
  // Score calculation: 100 - (emissions / 3)
  // 0 g/km = 100, 300 g/km = 0
  return Math.max(0, Math.min(100, 100 - (totalGPerKm / 3)));
}

function renderRecommendations(recommendations) {
  const container = document.getElementById('recommendations');
  const results = document.getElementById('results');
  
  if (recommendations.length === 0) {
    container.innerHTML = '<p class="text-center">No vehicles match your criteria. Try adjusting your filters.</p>';
    results.style.display = 'block';
    return;
  }
  
  container.innerHTML = '';
  
  recommendations.forEach(rec => {
    const v = rec.vehicle;
    const card = document.createElement('div');
    card.className = `recommendation-card rank-${rec.ranking}`;
    card.innerHTML = `
      <div class="flex-between mb-sm">
        <h4>#${rec.ranking} ${v.vehicle}</h4>
        <span class="score score-${rec.scoreClass}">${rec.score}/100</span>
      </div>
      <p><span class="badge badge-${v.powertrain.toLowerCase()}">${v.powertrain}</span></p>
      <p class="mt-sm"><strong>Total Lifecycle:</strong> ${formatEmission(v.total_g_per_km)} g/km</p>
      <p><strong>Manufacturing:</strong> ${formatEmission(v.manufacturing_g_per_km)} g/km</p>
      <p><strong>Operational:</strong> ${formatEmission(v.operational_g_per_km)} g/km</p>
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

document.addEventListener('DOMContentLoaded', () => {
  loadVehicles();
  
  document.getElementById('criteria-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Show loading
    const container = document.getElementById('recommendations');
    const results = document.getElementById('results');
    container.innerHTML = '<div class="skeleton skeleton-card"></div>'.repeat(3);
    results.style.display = 'block';
    
    const criteria = {
      budgetMin: parseInt(document.getElementById('budget-min').value),
      budgetMax: parseInt(document.getElementById('budget-max').value),
      country: document.getElementById('country').value,
      annualKm: parseInt(document.getElementById('annual-km').value),
      powertrain: document.getElementById('powertrain').value
    };
    
    const recommendations = await getRecommendations(criteria);
    renderRecommendations(recommendations);
  });
});
