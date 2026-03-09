import { useState, useEffect } from 'react';
import apiClient from '../services/api';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import Badge from '../components/ui/Badge';
import '../styles/recommend.css';

/**
 * Recommend page component
 * Provides personalized vehicle recommendations based on usage patterns
 */
function Recommend() {
  // Form state
  const [formData, setFormData] = useState({
    country: 'US',
    annualKm: 15000,
    vehicle_typepe: ''
  });

  // Data state
  const [countries, setCountries] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Country name mapping
  const countryNameMap = {
    US: 'United States',
    DE: 'Germany',
    FR: 'France',
    UK: 'United Kingdom',
    CN: 'China',
    JP: 'Japan',
    IN: 'India',
    CA: 'Canada',
    AU: 'Australia',
    BR: 'Brazil'
  };

  // Fetch countries on mount
  useEffect(() => {
    fetchCountries();
  }, []);

  /**
   * Fetch available countries from API
   */
  const fetchCountries = async () => {
    setLoadingCountries(true);
    try {
      const response = await apiClient.getCountries();
      
      if (!Array.isArray(response) || response.length === 0) {
        throw new Error('Invalid country list');
      }

      const countryOptions = response.map(code => ({
        value: code,
        label: countryNameMap[code] || code
      }));

      setCountries(countryOptions);
    } catch (err) {
      console.error('Failed to load countries:', err);
      // Fallback to default countries
      setCountries([
        { value: 'US', label: 'United States' },
        { value: 'DE', label: 'Germany' },
        { value: 'FR', label: 'France' },
        { value: 'UK', label: 'United Kingdom' }
      ]);
    } finally {
      setLoadingCountries(false);
    }
  };

  /**
   * Handle form input changes
   */
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const errors = {};

    if (!formData.country) {
      errors.country = 'Country is required';
    }

    if (!formData.annualKm || formData.annualKm < 1000) {
      errors.annualKm = 'Annual km must be at least 1000';
    }

    if (formData.annualKm > 100000) {
      errors.annualKm = 'Annual km must be less than 100000';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Calculate score for a vehicle
   */
  const calculateScore = (totalGPerKm) => {
    return Math.max(0, Math.min(100, 100 - totalGPerKm / 3));
  };

  /**
   * Generate reasons for recommendation
   */
  const generateReasons = (vehicle) => {
    const reasons = [];

    if (vehicle.vehicle_typepe === 'EV') {
      reasons.push('Zero tailpipe emissions');
    }

    if (vehicle.total_g_per_km < 100) {
      reasons.push('Excellent lifecycle efficiency');
    }

    if (vehicle.operational_g_per_km < 50) {
      reasons.push('Low operational emissions');
    }

    if (vehicle.manufacturing_g_per_km < 50) {
      reasons.push('Low manufacturing footprint');
    }

    if (vehicle.vehicle_typepe === 'HEV') {
      reasons.push('Hybrid fuel efficiency');
    }

    if (vehicle.vehicle_typepe === 'PHEV') {
      reasons.push('Electric + hybrid flexibility');
    }

    return reasons.length ? reasons : ['Lower emissions than alternatives'];
  };

  /**
   * Get score class based on score value
   */
  const getScoreClass = (score) => {
    if (score > 70) return 'excellent';
    if (score > 50) return 'good';
    return 'moderate';
  };

  /**
   * Format emission value
   */
  const formatEmission = (value) => {
    return Math.round(value).toLocaleString();
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      const dailyKm = formData.annualKm / 365;
      const years = 10;
      const filters = formData.vehicle_typepe ? vehicle_typetype: formDvehicle_typee_type } : {};

      const response = await apiClient.getRecommendations(
        dailyKm,
        years,
        filters,
        formData.country,
        2023
      );

      if (!Array.isArray(response)) {
        throw new Error('Invalid API response');
      }

      // Process top 3 recommendations
      const processedRecs = response.slice(0, 3).map((rec, index) => {
        const score = calculateScore(rec.total_g_per_km);
        return {
          vehicle: rec,
          ranking: index + 1,
          score: Math.round(score),
          scoreClass: getScoreClass(score),
          reasons: generateReasons(rec)
        };
      });

      setRecommendations(processedRecs);
    } catch (err) {
      console.error('Failed to get recommendations:', err);
      setError(err.message || 'Failed to get recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get vehicle_typepe badge variant
   */
  const getvehicle_typepeVariant =vehicle_typetype) => {
    const lower = (vehicle_typepe || '').toLowerCase();
    if (lower === 'ev' || lower === 'bev') return 'success';
    if (lower === 'phev' || lower === 'hev') return 'info';
    return 'warning';
  };

  return (
    <div className="container">
      <h1 className="text-center mb-lg">Get Vehicle Recommendation</h1>

      <div className="grid grid-2">
        {/* Criteria Form */}
        <section className="card" aria-labelledby="criteria-heading">
          <h2 id="criteria-heading" className="mb-md">Your Criteria</h2>
          <form onSubmit={handleSubmit}>
            <Select
              label="Country"
              value={formData.country}
              onChange={(value) => handleInputChange('country', value)}
              options={countries}
              placeholder={loadingCountries ? 'Loading...' : 'Select a country'}
              required
              disabled={loadingCountries}
              error={validationErrors.country}
            />

            <Input
              label="Annual km Driven"
              type="number"
              value={formData.annualKm}
              onChange={(value) => handleInputChange('annualKm', parseInt(value) || 0)}
              min={1000}
              max={100000}
              required
              error={validationErrors.annualKm}
            />

            <Select
              label="Preferred vehicle_typepe"
              value={formData.vehicle_typepe}
              onChange={(value) => handleInputChange('vehicle_typepe', value)}
              options={[
                { value: '', label: 'Any' },
                { value: 'EV', label: 'Electric (EV)' },
                { value: 'PHEV', label: 'Plug-in Hybrid (PHEV)' },
                { value: 'HEV', label: 'Hybrid (HEV)' },
                { value: 'ICE', label: 'Gasoline/Diesel (ICE)' }
              ]}
            />

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loadingCountries}
              className="btn-full-width"
            >
              Get Recommendations
            </Button>
          </form>
        </section>

        {/* Results Section */}
        {(loading || recommendations.length > 0 || error) && (
          <section className="card" aria-labelledby="results-heading">
            <h2 id="results-heading" className="mb-md">Top 3 Recommendations</h2>
            
            {loading && (
              <LoadingSpinner size="medium" message="Finding best vehicles for you..." />
            )}

            {error && (
              <ErrorMessage
                message={error}
                onRetry={handleSubmit}
                onDismiss={() => setError(null)}
              />
            )}

            {!loading && !error && recommendations.length === 0 && (
              <div className="text-center">No vehicles match your criteria</div>
            )}

            {!loading && !error && recommendations.length > 0 && (
              <div>
                {recommendations.map((rec) => (
                  <article
                    key={`${rec.vehicle.vehicle}-${rec.ranking}`}
                    className={`recommendation-card rank-${rec.ranking}`}
                  >
                    <div className="flex-between mb-sm">
                      <h3>
                        #{rec.ranking} {rec.vehicle.vehicle}
                      </h3>
                      <span className={`score score-${rec.scoreClass}`}>
                        {rec.score}/100
                      </span>
                    </div>

                    <p>
                      <Badge variant={getvehicle_typepeVariant(rec.vehiclvehicle_typetype)}>
                        {rec.vehicle.vehicle_typepe}
                      </Badge>
                    </p>

                    <p>
                      <strong>Total:</strong> {formatEmission(rec.vehicle.total_g_per_km)} g/km
                    </p>
                    <p>
                      <strong>Manufacturing:</strong>{' '}
                      {formatEmission(rec.vehicle.manufacturing_g_per_km)} g/km
                    </p>
                    <p>
                      <strong>Operational:</strong>{' '}
                      {formatEmission(rec.vehicle.operational_g_per_km)} g/km
                    </p>

                    <ul className="reasoning">
                      {rec.reasons.map((reason, index) => (
                        <li key={index}>{reason}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default Recommend;
