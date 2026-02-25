// API Configuration
const API_BASE_URL = 'http://localhost:5000';

// API Client
class CarbonWiseAPI {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    return this.request('/');
  }

  // Get vehicle detail
  async getVehicleDetail(brand, model, year) {
    return this.request(`/vehicle-detail?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&year=${year}`);
  }

  // Calculate lifecycle
  async calculateLifecycle(brand, model, vehicleYear, country, gridYear) {
    return this.request('/lifecycle', {
      method: 'POST',
      body: JSON.stringify({
        brand,
        model,
        vehicle_year: vehicleYear,
        country,
        grid_year: gridYear
      })
    });
  }

  // Compare multiple vehicles
  async compareMultiple(country, year, vehicles) {
    return this.request('/compare-multiple', {
      method: 'POST',
      body: JSON.stringify({
        country,
        year,
        vehicles
      })
    });
  }

  // Get recommendations
  async getRecommendations(dailyKm, years, filters = {}, country = 'US', gridYear = 2023) {
    return this.request('/recommend', {
      method: 'POST',
      body: JSON.stringify({
        daily_km: dailyKm,
        years,
        filters,
        country,
        grid_year: gridYear
      })
    });
  }

  // Calculate break-even
  async calculateBreakEven(country, year, ev, ice) {
    return this.request('/break-even', {
      method: 'POST',
      body: JSON.stringify({
        country,
        year,
        ev,
        ice
      })
    });
  }

  // Detect greenwashing
  async detectGreenwashing(lifecycle, vehicleMeta) {
    return this.request('/greenwashing', {
      method: 'POST',
      body: JSON.stringify({
        lifecycle,
        vehicle: vehicleMeta
      })
    });
  }

  // Get carbon score
  async getCarbonScore(totalGPerKm) {
    return this.request('/carbon-score', {
      method: 'POST',
      body: JSON.stringify({
        total_g_per_km: totalGPerKm
      })
    });
  }

  // Calculate annual impact
  async getAnnualImpact(totalGPerKm, annualKm) {
    return this.request('/annual-impact', {
      method: 'POST',
      body: JSON.stringify({
        total_g_per_km: totalGPerKm,
        annual_km: annualKm
      })
    });
  }

  // Grid sensitivity analysis
  async getGridSensitivity(brand, model, vehicleYear, countries, year) {
    return this.request('/grid-sensitivity', {
      method: 'POST',
      body: JSON.stringify({
        brand,
        model,
        vehicle_year: vehicleYear,
        countries,
        year
      })
    });
  }

  // Get methodology
  async getMethodology() {
    return this.request('/methodology');
  }

  // Get all vehicles (from local data for filtering)
  async getAllVehicles() {
    return this.request('/vehicles');
  }

  // Get grid data (for grid insights page)
  async getGridData() {
    return this.request('/grid-data');
  }
}

// Export singleton instance
const api = new CarbonWiseAPI();
