let vehicles = [];
let countries = [];

async function loadVehicles() {
  try {
    vehicles = await api.getAllVehicles();
  } catch (error) {
    console.error('Error loading vehicles:', error);
  }
}

async function loadCountries() {
  try {
    const response = await api.getCountries();
    
    console.log('Countries API response:', response);
    
    // Check if response has error
    if (response && response.error) {
      console.error('Error from API:', response.error);
      loadFallbackCountries();
      return;
    }
    
    // Check if response is an array
    if (!Array.isArray(response)) {
      console.error('Invalid response format (not an array):', response);
      loadFallbackCountries();
      return;
    }
    
    if (response.length === 0) {
      console.error('Empty countries array');
      loadFallbackCountries();
      return;
    }
    
    countries = response;
    const countrySelect = document.getElementById('country');
    
    if (!countrySelect) {
      console.error('Country select element not found');
      return;
    }
    
    countrySelect.innerHTML = '';
    
    countries.forEach(country => {
      if (country && country.code && country.name) {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        countrySelect.appendChild(option);
      } else {
        console.warn('Invalid country object:', country);
      }
    });
    
    // Set default to US
    if (countrySelect.querySelector('option[value="US"]')) {
      countrySelect.value = 'US';
    }
    
    console.log('Successfully loaded', countries.length, 'countries');
  } catch (error) {
    console.error('Error loading countries:', error);
    loadFallbackCountries();
  }
}

function loadFallbackCountries() {
  console.log('Loading fallback countries');
  const countrySelect = document.getElementById('country');
  if (!countrySelect) {
    console.error('Country select element not found for fallback');
    return;
  }
  countrySelect.innerHTML = `
    <option value="US">United States</option>
    <option value="DE">Germany</option>
    <option value="FR">France</option>
    <option value="UK">United Kingdom</option>
    <option value="CN">China</option>
    <option value="JP">Japan</option>
    <option value="CA">Canada</option>
    <option value="AU">Australia</option>
  `;
}

async function getRecommendations(criteria) {
  try {
    console.log('Getting recommendations with criteria:', criteria);
    
    // Calculate daily km from annual km
    const dailyKm = criteria.annualKm / 365;
    const years = 10; // Default 10 years
    
    // Call backend API with country
    const recommendations = await api.getRecommendations(dailyKm, years, {
      powertrain: criteria.powertrain || null
    }, criteria.country || 'US', 2023);
    
    console.log('API response:', recommendations);
    
    if (recommendations.error) {
      throw new Error(recommendations.error);
    }
    
    if (!Array.isArray(recommendations)) {
      throw new Error('Invalid response format from API');
    }
    
    if (recommendations.length === 0) {
      console.log('No recommendations returned from API');
      return [];
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
      
      // Add powertrain-specific reasons
      if (rec.powertrain === 'HEV') reasons.push('Hybrid efficiency reduces fuel consumption');
      if (rec.powertrain === 'PHEV') reasons.push('Electric mode for short trips, hybrid for long trips');
      if (rec.powertrain === 'ICE' && rec.total_g_per_km < 200) reasons.push('Efficient conventional engine');
      
      return {
        vehicle: rec,
        ranking: index + 1,
        score: Math.round(score),
        scoreClass,
        reasons: reasons.length > 0 ? reasons : ['Low overall emissions compared to alternatives']
      };
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    throw error; // Re-throw to handle in the calling function
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
    container.innerHTML = `
      <div class="text-center" style="padding: 2rem;">
        <p style="color: var(--color-text-secondary); margin-bottom: 1rem;">
          No vehicles match your criteria. This could be due to:
        </p>
        <ul style="text-align: left; color: var(--color-text-secondary); margin: 0 auto; max-width: 300px;">
          <li>Limited data for the selected powertrain</li>
          <li>No vehicles available in the selected country</li>
          <li>Backend processing issues</li>
        </ul>
        <p style="color: var(--color-text-secondary); margin-top: 1rem;">
          Try selecting "Any" for powertrain or a different country.
        </p>
      </div>
    `;
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
  loadCountries();
  
  document.getElementById('criteria-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Show loading
    const container = document.getElementById('recommendations');
    const results = document.getElementById('results');
    container.innerHTML = '<div class="skeleton skeleton-card"></div>'.repeat(3);
    results.style.display = 'block';
    
    const criteria = {
      country: document.getElementById('country').value,
      annualKm: parseInt(document.getElementById('annual-km').value),
      powertrain: document.getElementById('powertrain').value
    };
    
    console.log('Form submitted with criteria:', criteria);
    
    try {
      const recommendations = await getRecommendations(criteria);
      renderRecommendations(recommendations);
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      container.innerHTML = `
        <div class="text-center" style="padding: 2rem; color: #FF5252;">
          <p><strong>Error getting recommendations</strong></p>
          <p>${error.message}</p>
          <p style="margin-top: 1rem; color: var(--color-text-secondary);">
            Please check that the backend server is running and try again.
          </p>
        </div>
      `;
    }
  });
});
