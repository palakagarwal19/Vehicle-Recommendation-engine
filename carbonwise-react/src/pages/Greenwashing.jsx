import { useState, useEffect } from 'react';
import apiClient from '../services/api';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import '../styles/greenwashing.css';

function Greenwashing() {
  // Vehicle selection state
  const [vehicles, setVehicles] = useState([]);
  const [selection, setSelection] = useState({
    brand: '',
    model: '',
    year: '',
    country: 'US',
    gridYear: 2024
  });

  // Analysis results state
  const [analysisResults, setAnalysisResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  // Load vehicles on mount
  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      setLoadingVehicles(true);
      const data = await apiClient.getAllVehicles();
      setVehicles(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load vehicles');
    } finally {
      setLoadingVehicles(false);
    }
  };

  // Get unique brands
  const brands = [...new Set(vehicles.map(v => v.brand))].sort();

  // Get models for selected brand
  const models = selection.brand
    ? [...new Set(vehicles
        .filter(v => v.brand === selection.brand)
        .map(v => v.model))].sort()
    : [];

  // Get years for selected brand and model
  const years = selection.brand && selection.model
    ? [...new Set(vehicles
        .filter(v => v.brand === selection.brand && v.model === selection.model)
        .map(v => v.Year))].sort((a, b) => b - a)
    : [];

  // Handle selection changes
  const handleSelectionChange = (field, value) => {
    setSelection(prev => {
      const updated = { ...prev, [field]: value };
      
      // Reset dependent fields
      if (field === 'brand') {
        updated.model = '';
        updated.year = '';
      } else if (field === 'model') {
        updated.year = '';
      }
      
      return updated;
    });
  };

  // Analyze for greenwashing
  const handleAnalyze = async (withWebSearch = false) => {
    const { brand, model, year, country, gridYear } = selection;

    if (!brand || !model || !year) {
      setError('Please select a vehicle');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Show loading message for web search
      if (withWebSearch) {
        setAnalysisResults({
          loading: true,
          message: '🔍 Searching web for marketing claims...'
        });
      }

      // Get lifecycle data
      const lifecycle = await apiClient.calculateLifecycle(
        brand,
        model,
        parseInt(year),
        country,
        parseInt(gridYear)
      );

      // Get vehicle metadata
      const vehicle = vehicles.find(v =>
        v.brand === brand && v.model === model && v.Year == year
      );

      // Analyze greenwashing
      const analysis = await apiClient.detectGreenwashing(
        lifecycle,
        {
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.Year,
          type: vehicle.type,
          co2_wltp_gpkm: vehicle.co2_wltp_gpkm
        },
        withWebSearch
      );

      setAnalysisResults({
        analysis,
        vehicle,
        lifecycle
      });
    } catch (err) {
      setError(err.message || 'Failed to analyze. Please try again.');
      setAnalysisResults(null);
    } finally {
      setLoading(false);
    }
  };

  const formatEmission = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return Math.round(value).toLocaleString();
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent Transparency';
    if (score >= 60) return 'Good Transparency';
    if (score >= 40) return 'Moderate Transparency';
    return 'Low Transparency';
  };

  const getRiskVariant = (riskLevel) => {
    const level = (riskLevel || 'low').toLowerCase();
    if (level === 'high') return 'danger';
    if (level === 'medium') return 'warning';
    return 'success';
  };

  if (loadingVehicles) {
    return (
      <div className="container">
        <LoadingSpinner size="large" message="Loading vehicles..." />
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="text-center mb-md">Greenwashing Detector</h1>
      <p className="text-center text-secondary mb-lg">
        Analyze vehicle environmental claims for accuracy and transparency
      </p>

      {error && !analysisResults && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      <section className="card mb-lg" aria-labelledby="selection-heading">
        <h2 id="selection-heading" className="mb-md">Select Vehicle to Analyze</h2>
        
        <div className="grid grid-3">
          <Select
            label="Brand"
            value={selection.brand}
            onChange={(e) => handleSelectionChange('brand', e.target.value)}
            options={[
              { value: '', label: 'Select Brand' },
              ...brands.map(b => ({ value: b, label: b }))
            ]}
          />
          
          <Select
            label="Model"
            value={selection.model}
            onChange={(e) => handleSelectionChange('model', e.target.value)}
            options={[
              { value: '', label: 'Select Model' },
              ...models.map(m => ({ value: m, label: m }))
            ]}
            disabled={!selection.brand}
          />
          
          <Select
            label="Year"
            value={selection.year}
            onChange={(e) => handleSelectionChange('year', e.target.value)}
            options={[
              { value: '', label: 'Select Year' },
              ...years.map(y => ({ value: y, label: y }))
            ]}
            disabled={!selection.model}
          />
        </div>

        <div className="grid grid-2 mt-md">
          <Select
            label="Country"
            value={selection.country}
            onChange={(e) => handleSelectionChange('country', e.target.value)}
            options={[
              { value: 'US', label: 'United States' },
              { value: 'DE', label: 'Germany' },
              { value: 'FR', label: 'France' },
              { value: 'UK', label: 'United Kingdom' }
            ]}
          />
          
          <div className="form-group">
            <label htmlFor="grid-year">Grid Year</label>
            <input
              type="number"
              id="grid-year"
              value={selection.gridYear}
              onChange={(e) => handleSelectionChange('gridYear', e.target.value)}
              className="filter-select"
            />
          </div>
        </div>

        <div className="mt-md" style={{ display: 'flex', gap: '1rem' }}>
          <Button
            variant="primary"
            onClick={() => handleAnalyze(false)}
            disabled={loading || !selection.brand || !selection.model || !selection.year}
            loading={loading}
          >
            Analyze for Greenwashing
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => handleAnalyze(true)}
            disabled={loading || !selection.brand || !selection.model || !selection.year}
            loading={loading}
          >
            🔍 Search Web for Marketing Claims
          </Button>
        </div>
      </section>

      {analysisResults && analysisResults.loading && (
        <Card>
          <p>{analysisResults.message}</p>
        </Card>
      )}

      {analysisResults && !analysisResults.loading && (
        <>
          <section className="card mb-lg" aria-labelledby="results-heading">
            <div className="greenwashing-header">
              <h2 id="results-heading">Analysis Results</h2>
              <Badge
                variant={getRiskVariant(analysisResults.analysis.risk_level)}
                size="large"
              >
                {(analysisResults.analysis.risk_level || 'LOW').toUpperCase()} RISK
              </Badge>
            </div>
            
            <div className="mt-md">
              <h4>
                {analysisResults.vehicle.brand} {analysisResults.vehicle.model} ({analysisResults.vehicle.Year})
              </h4>
              <p>
                <Badge variant="info">
                  {analysisResults.vehicle.type}
                </Badge>
              </p>
              
              <div className="mt-md">
                <div className="metric-row">
                  <span>Actual Lifecycle Emissions:</span>
                  <span style={{ color: 'var(--color-eco-green)', fontWeight: 'bold' }}>
                    {formatEmission(analysisResults.lifecycle.total_g_per_km)} g/km
                  </span>
                </div>
                <div className="metric-row">
                  <span>Manufacturing:</span>
                  <span>{formatEmission(analysisResults.lifecycle.manufacturing_g_per_km)} g/km</span>
                </div>
                <div className="metric-row">
                  <span>Operational:</span>
                  <span>{formatEmission(analysisResults.lifecycle.operational_g_per_km)} g/km</span>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-2 mb-lg">
            <section className="card" aria-labelledby="indicators-heading">
              <h3 id="indicators-heading" className="mb-md">Greenwashing Indicators</h3>
              <div>
                {(!analysisResults.analysis.misleading_claims || 
                  analysisResults.analysis.misleading_claims.length === 0) ? (
                  <p className="text-eco">
                    ✓ No common misleading marketing practices detected for this vehicle type
                  </p>
                ) : (
                  <div className="misleading-claims">
                    {analysisResults.analysis.misleading_claims.map((claim, index) => (
                      <div key={index} className={`claim-card severity-${claim.severity}`}>
                        <div className="claim-header">
                          <span className="claim-icon">
                            {claim.severity === 'high' ? '🚨' : 
                             claim.severity === 'medium' ? '⚠️' : 'ℹ️'}
                          </span>
                          <span className="claim-severity">
                            {claim.severity.toUpperCase()}
                          </span>
                        </div>
                        <div className="claim-body">
                          <p><strong>Common Marketing Practice:</strong> {claim.practice}</p>
                          <p><strong>Typical Claim:</strong> {claim.common_claim}</p>
                          <p><strong>Reality for This Vehicle:</strong> {claim.reality}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card" aria-labelledby="transparency-heading">
              <h3 id="transparency-heading" className="mb-md">Transparency Score</h3>
              <div className="score-circle-small" style={{ '--score': analysisResults.analysis.transparency_score || 85 }}>
                <span className="score-value">{analysisResults.analysis.transparency_score || 85}</span>
              </div>
              <p className="mt-md text-center">
                {getScoreLabel(analysisResults.analysis.transparency_score || 85)}
              </p>
              <p className="text-center text-secondary" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                {(analysisResults.analysis.transparency_score || 85) >= 80
                  ? 'Marketing claims are mostly accurate'
                  : (analysisResults.analysis.transparency_score || 85) >= 60
                  ? 'Some claims may be misleading'
                  : (analysisResults.analysis.transparency_score || 85) >= 40
                  ? 'Multiple misleading claims detected'
                  : 'Significant greenwashing risk'}
              </p>
            </section>
          </div>

          <section className="card" aria-labelledby="findings-heading">
            <h3 id="findings-heading" className="mb-md">Detailed Findings</h3>
            <div>
              {(!analysisResults.analysis.findings || analysisResults.analysis.findings.length === 0) &&
               (!analysisResults.analysis.web_claims || analysisResults.analysis.web_claims.length === 0) ? (
                <p className="text-eco">
                  ✓ No significant greenwashing indicators found. Marketing appears transparent.
                </p>
              ) : (
                <>
                  {analysisResults.analysis.findings && analysisResults.analysis.findings.length > 0 && (
                    <>
                      <h5 style={{ marginBottom: '1rem' }}>Analysis Findings:</h5>
                      <ul className="findings-list">
                        {analysisResults.analysis.findings.map((finding, index) => (
                          <li key={index}>
                            <span className="finding-bullet">▸</span> {finding}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {analysisResults.analysis.web_claims && analysisResults.analysis.web_claims.length > 0 && (
                    <>
                      <h5 style={{ marginTop: '2rem', marginBottom: '1rem' }}>
                        Web Marketing Claims Verification:
                      </h5>
                      <div className="web-claims">
                        {analysisResults.analysis.web_claims.map((claim, index) => {
                          const isAccurate = claim.verification.is_accurate;
                          const severity = claim.verification.severity || 'low';
                          
                          return (
                            <div key={index} className={`web-claim-card severity-${severity}`}>
                              <div className="web-claim-header">
                                <span className="web-claim-icon">{isAccurate ? '✓' : '✗'}</span>
                                <span className="web-claim-source">{claim.source}</span>
                              </div>
                              <div className="web-claim-body">
                                <p><strong>Claim:</strong> "{claim.claim}"</p>
                                <p><strong>Verification:</strong> {claim.verification.explanation}</p>
                                <p className={`web-claim-status ${isAccurate ? 'accurate' : 'inaccurate'}`}>
                                  {isAccurate ? '✓ Claim is accurate' : '✗ Claim is misleading'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Greenwashing;
