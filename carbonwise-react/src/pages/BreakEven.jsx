import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import LineChart from '../components/charts/LineChart';
import '../styles/break-even.css';

/**
 * BreakEven Page Component
 * Calculate break-even distance between EV and ICE vehicles
 */
function BreakEven() {
  // Vehicle data
  const [vehicles, setVehicles] = useState([]);
  const [countries, setCountries] = useState([]);
  
  // EV selection state
  const [evSelection, setEvSelection] = useState({
    brand: '',
    model: '',
    year: ''
  });
  
  // ICE selection state
  const [iceSelection, setIceSelection] = useState({
    brand: '',
    model: '',
    year: ''
  });
  
  // Analysis parameters
  const [analysisParams, setAnalysisParams] = useState({
    country: 'US',
    gridYear: 2024
  });
  
  // Selected vehicles for preview
  const [evVehicle, setEvVehicle] = useState(null);
  const [iceVehicle, setIceVehicle] = useState(null);
  
  // Break-even results
  const [breakEvenData, setBreakEvenData] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // Fetch vehicles and countries on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [vehiclesData, countriesData] = await Promise.all([
        apiClient.getAllVehicles(),
        apiClient.getCountries()
      ]);
      
      setVehicles(vehiclesData);
      setCountries(countriesData);
    } catch (err) {
      setError(err.message || 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get unique brands for EV (only those with electric_wh_per_km)
  const getEvBrands = () => {
    const evVehicles = vehicles.filter(v => v.type === 'EV' && v.electric_wh_per_km !== null);
    const brands = [...new Set(evVehicles.map(v => v.brand))].sort();
    return brands.map(brand => ({ value: brand, label: brand }));
  };

  // Get unique brands for ICE
  const getIceBrands = () => {
    const iceVehicles = vehicles.filter(v => v.type === 'ICE');
    const brands = [...new Set(iceVehicles.map(v => v.brand))].sort();
    return brands.map(brand => ({ value: brand, label: brand }));
  };

  // Get models for selected brand
  const getModels = (type, brand) => {
    if (!brand) return [];
    
    const vehicleType = type === 'ev' ? 'EV' : 'ICE';
    let filteredVehicles = vehicles.filter(v => v.brand === brand && v.type === vehicleType);
    
    // For EVs, only show those with electric consumption data
    if (type === 'ev') {
      filteredVehicles = filteredVehicles.filter(v => v.electric_wh_per_km !== null);
    }
    
    const models = [...new Set(filteredVehicles.map(v => v.model))].sort();
    return models.map(model => ({ value: model, label: model }));
  };

  // Get years for selected brand and model
  const getYears = (type, brand, model) => {
    if (!brand || !model) return [];
    
    const vehicleType = type === 'ev' ? 'EV' : 'ICE';
    const years = [...new Set(vehicles
      .filter(v => v.brand === brand && v.model === model && v.type === vehicleType)
      .map(v => v.Year))].sort((a, b) => b - a);
    
    return years.map(year => ({ value: year.toString(), label: year.toString() }));
  };

  // Handle EV selection changes
  const handleEvBrandChange = (brand) => {
    setEvSelection({ brand, model: '', year: '' });
    setEvVehicle(null);
  };

  const handleEvModelChange = (model) => {
    setEvSelection({ ...evSelection, model, year: '' });
    setEvVehicle(null);
  };

  const handleEvYearChange = (year) => {
    setEvSelection({ ...evSelection, year });
    
    // Find and set the selected vehicle
    const vehicle = vehicles.find(v => 
      v.brand === evSelection.brand && 
      v.model === evSelection.model && 
      v.Year == year && 
      v.type === 'EV'
    );
    
    setEvVehicle(vehicle);
  };

  // Handle ICE selection changes
  const handleIceBrandChange = (brand) => {
    setIceSelection({ brand, model: '', year: '' });
    setIceVehicle(null);
  };

  const handleIceModelChange = (model) => {
    setIceSelection({ ...iceSelection, model, year: '' });
    setIceVehicle(null);
  };

  const handleIceYearChange = (year) => {
    setIceSelection({ ...iceSelection, year });
    
    // Find and set the selected vehicle
    const vehicle = vehicles.find(v => 
      v.brand === iceSelection.brand && 
      v.model === iceSelection.model && 
      v.Year == year && 
      v.type === 'ICE'
    );
    
    setIceVehicle(vehicle);
  };

  // Handle calculate button click
  const handleCalculate = async () => {
    if (!evVehicle || !iceVehicle) {
      setError('Please select both EV and ICE vehicles');
      return;
    }
    
    setCalculating(true);
    setError(null);
    
    try {
      const result = await apiClient.calculateBreakEven(
        analysisParams.country,
        analysisParams.gridYear,
        {
          brand: evVehicle.brand,
          model: evVehicle.model,
          Year: evVehicle.Year
        },
        {
          brand: iceVehicle.brand,
          model: iceVehicle.model,
          Year: iceVehicle.Year
        }
      );
      
      if (result.error) {
        setError(result.error);
      } else {
        setBreakEvenData(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate break-even. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  // Format large numbers
  const formatLargeNumber = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (value >= 1000) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
    }
    return value.toFixed(1);
  };

  // Format emissions
  const formatEmission = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(1);
  };

  // Render cumulative emissions chart
  const renderCumulativeChart = () => {
    if (!breakEvenData || breakEvenData.break_even_km === null || breakEvenData.break_even_km === undefined || breakEvenData.break_even_km <= 0) {
      return null;
    }

    const maxKm = Math.max(breakEvenData.break_even_km * 2, 300000);
    const points = 50;
    const step = maxKm / points;
    
    const labels = [];
    const evData = [];
    const iceData = [];
    
    // Get total manufacturing emissions in kg
    const evManufTotalKg = breakEvenData.ev_manufacturing_total_kg || (breakEvenData.ev_manufacturing_g_per_km * 278600 / 1000);
    const iceManufTotalKg = breakEvenData.ice_manufacturing_total_kg || (breakEvenData.ice_manufacturing_g_per_km * 278600 / 1000);
    
    for (let i = 0; i <= points; i++) {
      const km = i * step;
      labels.push(km / 1000); // Convert to thousands for display
      
      // Cumulative emissions = total manufacturing (kg) + (operational g/km * km / 1000)
      evData.push(
        evManufTotalKg + (breakEvenData.ev_operational_g_per_km * km / 1000)
      );
      
      iceData.push(
        iceManufTotalKg + (breakEvenData.ice_operational_g_per_km * km / 1000)
      );
    }
    
    // Calculate break-even point for annotation
    const breakEvenKm = breakEvenData.break_even_km;
    const breakEvenEmissions = evManufTotalKg + (breakEvenData.ev_operational_g_per_km * breakEvenKm / 1000);
    
    const chartData = {
      labels: labels,
      datasets: [
        {
          label: 'EV Total Emissions',
          data: evData,
          borderColor: '#00C853',
          backgroundColor: 'rgba(0, 200, 83, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2
        },
        {
          label: 'ICE Total Emissions',
          data: iceData,
          borderColor: '#FF5252',
          backgroundColor: 'rgba(255, 82, 82, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2
        },
        {
          label: 'Break-Even Point',
          data: [{x: breakEvenKm / 1000, y: breakEvenEmissions}],
          pointRadius: 8,
          pointBackgroundColor: '#FFD700',
          pointBorderColor: '#FFA500',
          pointBorderWidth: 2,
          showLine: false
        }
      ]
    };
    
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#B0B0B0' } },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.datasetIndex === 2) {
                return 'Break-Even: ' + formatLargeNumber(breakEvenKm) + ' km (' + context.parsed.y.toFixed(0) + ' kg CO₂)';
              }
              return context.dataset.label + ': ' + context.parsed.y.toFixed(0) + ' kg CO₂';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#B0B0B0' },
          title: {
            display: true,
            text: 'Cumulative Emissions (kg CO₂)',
            color: '#B0B0B0'
          }
        },
        x: {
          type: 'linear',
          grid: { display: false },
          ticks: { color: '#B0B0B0' },
          title: {
            display: true,
            text: 'Distance (1000 km)',
            color: '#B0B0B0'
          }
        }
      }
    };
    
    return <LineChart data={chartData} options={chartOptions} height={300} />;
  };

  // Render break-even results
  const renderResults = () => {
    if (!breakEvenData) return null;

    const breakEvenKm = breakEvenData.break_even_km;
    const hasValidBreakEven = breakEvenKm !== null && breakEvenKm !== undefined && breakEvenKm > 0;

    return (
      <section className="mt-lg">
        <Card className="mb-lg">
          <h3 className="mb-md text-center">Break-Even Results</h3>
          <div className="break-even-display">
            <div className="break-even-value">
              <span className="big-number">
                {hasValidBreakEven ? formatLargeNumber(breakEvenKm) : 'N/A'}
              </span>
              <span className="unit">kilometers</span>
            </div>
            <p className="text-center mt-md">
              {breakEvenData.message ? (
                <span dangerouslySetInnerHTML={{ __html: breakEvenData.message }} />
              ) : hasValidBreakEven ? (
                <>
                  The EV will have lower total emissions than the ICE vehicle after{' '}
                  <strong>{formatLargeNumber(breakEvenKm)} km</strong>.
                  <br />
                  At average driving (15,000 km/year), this is approximately{' '}
                  <strong>{(breakEvenKm / 15000).toFixed(1)} years</strong>.
                </>
              ) : (
                <>
                  The EV has lower total emissions from the start.
                  <br />
                  No break-even point needed!
                </>
              )}
            </p>
          </div>
        </Card>

        <div className="grid grid-2">
          <Card>
            <h4 className="mb-md">Cumulative Emissions Chart</h4>
            {hasValidBreakEven ? (
              renderCumulativeChart()
            ) : (
              <p className="text-center text-secondary">
                The EV has lower emissions from the start, so no break-even chart is needed.
              </p>
            )}
          </Card>
          
          <Card>
            <h4 className="mb-md">Emissions Comparison</h4>
            <div>
              <div className="comparison-row">
                <h5>EV: {evVehicle.brand} {evVehicle.model}</h5>
                <div className="metric-row">
                  <span>Manufacturing:</span>
                  <span>{formatEmission(breakEvenData.ev_manufacturing_g_per_km)} g/km</span>
                </div>
                <div className="metric-row">
                  <span>Operational:</span>
                  <span>{formatEmission(breakEvenData.ev_operational_g_per_km)} g/km</span>
                </div>
                <div className="metric-row">
                  <span>Total:</span>
                  <span className="text-eco">{formatEmission(breakEvenData.ev_total_g_per_km)} g/km</span>
                </div>
              </div>
              <hr style={{ margin: '1rem 0', borderColor: 'rgba(255,255,255,0.1)' }} />
              <div className="comparison-row">
                <h5>ICE: {iceVehicle.brand} {iceVehicle.model}</h5>
                <div className="metric-row">
                  <span>Manufacturing:</span>
                  <span>{formatEmission(breakEvenData.ice_manufacturing_g_per_km)} g/km</span>
                </div>
                <div className="metric-row">
                  <span>Operational:</span>
                  <span>{formatEmission(breakEvenData.ice_operational_g_per_km)} g/km</span>
                </div>
                <div className="metric-row">
                  <span>Total:</span>
                  <span className="text-eco">{formatEmission(breakEvenData.ice_total_g_per_km)} g/km</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>
    );
  };

  if (loading) {
    return (
      <div className="container">
        <LoadingSpinner size="large" message="Loading vehicles and countries..." />
      </div>
    );
  }

  return (
    <main>
      <div className="container">
        <h1 className="text-center mb-md">EV vs ICE Break-Even Analysis</h1>
        <p className="text-center text-secondary mb-lg">
          Calculate the distance at which an EV's total emissions equal an ICE vehicle
        </p>

        {error && (
          <ErrorMessage 
            message={error} 
            onRetry={breakEvenData ? handleCalculate : fetchInitialData}
            onDismiss={() => setError(null)}
          />
        )}

        <div className="grid grid-2">
          {/* EV Selection */}
          <section className="card" aria-labelledby="ev-selection-heading">
            <h2 id="ev-selection-heading" className="mb-md">Select Electric Vehicle</h2>
            <Select
              label="Brand"
              value={evSelection.brand}
              onChange={handleEvBrandChange}
              options={getEvBrands()}
              placeholder="Select Brand"
            />
            <Select
              label="Model"
              value={evSelection.model}
              onChange={handleEvModelChange}
              options={getModels('ev', evSelection.brand)}
              placeholder="Select Model"
              disabled={!evSelection.brand}
            />
            <Select
              label="Year"
              value={evSelection.year}
              onChange={handleEvYearChange}
              options={getYears('ev', evSelection.brand, evSelection.model)}
              placeholder="Select Year"
              disabled={!evSelection.model}
            />
            {evVehicle && (
              <div className="vehicle-preview">
                <div className="selected-vehicle">
                  <h5>{evVehicle.brand} {evVehicle.model}</h5>
                  <p>
                    <Badge variant="success">{evVehicle.type}</Badge>{' '}
                    {evVehicle.Year}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ICE Selection */}
          <section className="card" aria-labelledby="ice-selection-heading">
            <h2 id="ice-selection-heading" className="mb-md">Select ICE Vehicle</h2>
            <Select
              label="Brand"
              value={iceSelection.brand}
              onChange={handleIceBrandChange}
              options={getIceBrands()}
              placeholder="Select Brand"
            />
            <Select
              label="Model"
              value={iceSelection.model}
              onChange={handleIceModelChange}
              options={getModels('ice', iceSelection.brand)}
              placeholder="Select Model"
              disabled={!iceSelection.brand}
            />
            <Select
              label="Year"
              value={iceSelection.year}
              onChange={handleIceYearChange}
              options={getYears('ice', iceSelection.brand, iceSelection.model)}
              placeholder="Select Year"
              disabled={!iceSelection.model}
            />
            {iceVehicle && (
              <div className="vehicle-preview">
                <div className="selected-vehicle">
                  <h5>{iceVehicle.brand} {iceVehicle.model}</h5>
                  <p>
                    <Badge variant="danger">{iceVehicle.type}</Badge>{' '}
                    {iceVehicle.Year}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Analysis Parameters */}
        <section className="card mt-lg" aria-labelledby="params-heading">
          <h2 id="params-heading" className="mb-md">Analysis Parameters</h2>
          <div className="grid grid-3">
            <Select
              label="Country"
              value={analysisParams.country}
              onChange={(value) => setAnalysisParams({ ...analysisParams, country: value })}
              options={countries.map(c => ({ value: c.code, label: c.name }))}
            />
            <div className="form-group">
              <label className="select-label">Grid Year</label>
              <input
                type="number"
                className="select-field"
                value={analysisParams.gridYear}
                onChange={(e) => setAnalysisParams({ ...analysisParams, gridYear: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="select-label">&nbsp;</label>
              <Button
                variant="primary"
                onClick={handleCalculate}
                loading={calculating}
                disabled={!evVehicle || !iceVehicle}
                style={{ width: '100%' }}
              >
                Calculate Break-Even
              </Button>
            </div>
          </div>
        </section>

        {/* Results */}
        {renderResults()}
      </div>
    </main>
  );
}

export default BreakEven;
