import axios from 'axios';

// API Configuration - reads from environment variable or defaults to localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * CarbonWise API Client
 * Handles all HTTP requests to the backend API with caching support
 */
class CarbonWiseAPI {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // In-memory cache with TTL (Property 45)
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes default TTL
  }
  
  /**
   * Generate cache key from endpoint and options
   * @param {string} endpoint - API endpoint
   * @param {object} options - Request options
   * @returns {string} Cache key
   */
  getCacheKey(endpoint, options = {}) {
    const method = options.method || 'GET';
    const data = options.data ? JSON.stringify(options.data) : '';
    return `${method}:${endpoint}:${data}`;
  }
  
  /**
   * Get cached response if available and not expired
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * Store response in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Generic request method with error handling and caching
   * @param {string} endpoint - API endpoint path
   * @param {object} options - Axios request options
   * @param {boolean} useCache - Whether to use cache (default: true for GET)
   * @returns {Promise} Response data
   */
  async request(endpoint, options = {}, useCache = true) {
    const method = options.method || 'GET';
    const shouldCache = useCache && method === 'GET';
    
    // Check cache for GET requests
    if (shouldCache) {
      const cacheKey = this.getCacheKey(endpoint, options);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    try {
      const response = await this.client({
        url: endpoint,
        ...options
      });
      
      // Cache successful GET responses
      if (shouldCache) {
        const cacheKey = this.getCacheKey(endpoint, options);
        this.setCache(cacheKey, response.data);
      }
      
      return response.data;
    } catch (error) {
      console.error('API request failed:', error);
      
      // Transform error into consistent format
      const apiError = {
        message: this.getErrorMessage(error),
        status: error.response?.status,
        details: error.response?.data?.details
      };
      
      throw apiError;
    }
  }

  /**
   * Get user-friendly error message based on error type
   * @param {Error} error - Axios error object
   * @returns {string} User-friendly error message
   */
  getErrorMessage(error) {
    if (!error.response) {
      return 'Network error. Please check your connection.';
    }
    
    switch (error.response.status) {
      case 404:
        return 'Resource not found.';
      case 500:
        return 'Server error. Please try again later.';
      case 400:
        return error.response.data?.error || 'Invalid request. Please check your input.';
      default:
        return error.response.data?.error || 'An error occurred. Please try again.';
    }
  }

  // ==================== API Methods ====================

  /**
   * Health check endpoint
   * @returns {Promise<object>} API status
   */
  async healthCheck() {
    return this.request('/');
  }

  /**
   * Get vehicle detail by brand, model, and year
   * @param {string} brand - Vehicle brand
   * @param {string} model - Vehicle model
   * @param {number} year - Vehicle year
   * @returns {Promise<object>} Vehicle details
   */
  async getVehicleDetail(brand, model, year) {
    return this.request(
      `/vehicle-detail?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&year=${year}`
    );
  }

  /**
   * Calculate lifecycle emissions for a vehicle
   * @param {string} brand - Vehicle brand
   * @param {string} model - Vehicle model
   * @param {number} vehicleYear - Vehicle year
   * @param {string} country - Country code
   * @param {number} gridYear - Grid data year
   * @returns {Promise<object>} Lifecycle emissions data
   */
  async calculateLifecycle(brand, model, vehicleYear, country, gridYear) {
    return this.request('/lifecycle', {
      method: 'POST',
      data: {
        brand,
        model,
        vehicle_year: vehicleYear,
        country,
        grid_year: gridYear
      }
    });
  }

  /**
   * Get list of available countries
   * @returns {Promise<Array>} List of countries
   */
  async getCountries() {
    return this.request('/countries');
  }

  /**
   * Compare multiple vehicles
   * @param {string} country - Country code
   * @param {number} year - Grid data year
   * @param {Array} vehicles - Array of vehicle objects
   * @returns {Promise<Array>} Comparison results
   */
  async compareMultiple(country, year, vehicles) {
    return this.request('/compare-multiple', {
      method: 'POST',
      data: { country, year, vehicles }
    });
  }

  /**
   * Get vehicle recommendations based on usage patterns
   * @param {number} dailyKm - Daily kilometers driven
   * @param {number} years - Years of ownership
   * @param {object} filters - Filter criteria
   * @param {string} country - Country code
   * @param {number} gridYear - Grid data year
   * @returns {Promise<Array>} Recommended vehicles
   */
  async getRecommendations(dailyKm, years, filters = {}, country = 'US', gridYear = 2023) {
    return this.request('/recommend', {
      method: 'POST',
      data: {
        daily_km: dailyKm,
        years,
        filters,
        country,
        grid_year: gridYear
      }
    });
  }

  /**
   * Calculate break-even distance between EV and ICE
   * @param {string} country - Country code
   * @param {number} year - Grid data year
   * @param {object} ev - EV vehicle object
   * @param {object} ice - ICE vehicle object
   * @returns {Promise<object>} Break-even analysis
   */
  async calculateBreakEven(country, year, ev, ice) {
    return this.request('/break-even', {
      method: 'POST',
      data: { country, year, ev, ice }
    });
  }

  /**
   * Detect greenwashing in vehicle claims
   * @param {object} lifecycle - Lifecycle emissions data
   * @param {object} vehicleMeta - Vehicle metadata
   * @param {boolean} searchWeb - Enable web search
   * @returns {Promise<object>} Greenwashing analysis
   */
  async detectGreenwashing(lifecycle, vehicleMeta, searchWeb = false) {
    return this.request('/greenwashing', {
      method: 'POST',
      data: {
        lifecycle,
        vehicle: vehicleMeta,
        search_web: searchWeb
      }
    });
  }

  /**
   * Get carbon score for emissions value
   * @param {number} totalGPerKm - Total g CO2/km
   * @returns {Promise<object>} Carbon score
   */
  async getCarbonScore(totalGPerKm) {
    return this.request('/carbon-score', {
      method: 'POST',
      data: { total_g_per_km: totalGPerKm }
    });
  }

  /**
   * Calculate annual impact
   * @param {number} totalGPerKm - Total g CO2/km
   * @param {number} annualKm - Annual kilometers
   * @returns {Promise<object>} Annual impact data
   */
  async getAnnualImpact(totalGPerKm, annualKm) {
    return this.request('/annual-impact', {
      method: 'POST',
      data: {
        total_g_per_km: totalGPerKm,
        annual_km: annualKm
      }
    });
  }

  /**
   * Get grid sensitivity analysis
   * @param {string} brand - Vehicle brand
   * @param {string} model - Vehicle model
   * @param {number} vehicleYear - Vehicle year
   * @param {Array} countries - Array of country codes
   * @param {number} year - Grid data year
   * @returns {Promise<object>} Grid sensitivity data
   */
  async getGridSensitivity(brand, model, vehicleYear, countries, year) {
    return this.request('/grid-sensitivity', {
      method: 'POST',
      data: {
        brand,
        model,
        vehicle_year: vehicleYear,
        countries,
        year
      }
    });
  }

  /**
   * Get methodology information
   * @returns {Promise<object>} Methodology content
   */
  async getMethodology() {
    return this.request('/methodology');
  }

  /**
   * Get all vehicles
   * @returns {Promise<Array>} List of all vehicles
   */
  async getAllVehicles() {
    return this.request('/vehicles');
  }

  /**
   * Get grid data for all countries
   * @returns {Promise<object>} Grid data
   */
  async getGridData() {
    return this.request('/grid-data');
  }
}

// Export singleton instance
export const apiClient = new CarbonWiseAPI();
export default apiClient;
