import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../services/api';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import DonutChart from '../components/charts/DonutChart';
import BarChart from '../components/charts/BarChart';
import '../styles/vehicle-detail.css';

function VehicleDetail() {
  // Extract URL parameters (Property 17)
  const { brand, model, year } = useParams();

  // State management
  const [vehicleData, setVehicleData] = useState(null);
  const [lifecycleData, setLifecycleData] = useState(null);
  const [carbonScore, setCarbonScore] = useState(null);
  const [gridSensitivity, setGridSensitivity] = useState([]);
  const [annualKm, setAnnualKm] = useState(15000);
  const [annualImpact, setAnnualImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calculatingImpact, setCalculatingImpact] = useState(false);

  // Default parameters
  const country = 'US';
  const gridYear = 2024;

  // Fetch vehicle details on mount (Property 18)
  useEffect(() => {
    fetchVehicleData();
  }, [brand, model, year]);

  // Fetch all vehicle data
  const fetchVehicleData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch vehicle details
      const vehicle = await apiClient.getVehicleDetail(brand, model, parseInt(year));
      setVehicleData(vehicle);

      // Fetch lifecycle data
      const lifecycle = await apiClient.calculateLifecycle(
        brand,
        model,
        parseInt(year),
        country,
        gridYear
      );
      setLifecycleData(lifecycle);

      // Fetch carbon score
      const score = await apiClient.getCarbonScore(lifecycle.total_g_per_km);
      setCarbonScore(score);

      // Fetch grid sensitivity
      const countries = ['US', 'DE', 'FR', 'UK', 'CN', 'JP'];
      const sensitivity = await apiClient.getGridSensitivity(
        brand,
        model,
        parseInt(year),
        countries,
        gridYear
      );
      setGridSensitivity(sensitivity);

    } catch (err) {
      console.error('Error loading vehicle data:', err);
      setError(err.message || 'Failed to load vehicle data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate annual impact
  const calculateAnnualImpact = async () => {
    if (!lifecycleData || !annualKm) return;

    setCalculatingImpact(true);
    try {
      const impact = await apiClient.getAnnualImpact(
        lifecycleData.total_g_per_km,
        annualKm
      );
      setAnnualImpact(impact);
    } catch (err) {
      console.error('Error calculating annual impact:', err);
    } finally {
      setCalculatingImpact(false);
    }
  };

  // Handle annual km input change (Property 20)
  const handleAnnualKmChange = (value) => {
    setAnnualKm(parseInt(value) || 0);
    setAnnualImpact(null); // Reset impact when input changes
  };

  // Get badge variant based on powertrain
  const getBadgeVariant = (powertrain) => {
    if (!powertrain) return 'info';
    const type = powertrain.toLowerCase();
    if (type.includes('bev')) return 'success';
    if (type.includes('phev') || type.includes('hev')) return 'warning';
    return 'danger';
  };

  // Format emissions value
  const formatEmission = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return Math.round(value).toLocaleString();
  };

  // Get score color
  const getScoreColor = (score) => {
    if (score >= 70) return '#00C853';
    if (score >= 40) return '#FFC107';
    return '#FF5252';
  };

  // Render loading state (Property 15)
  if (loading) {
    return (
      <div className="container">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <LoadingSpinner size="large" message="Loading vehicle details..." />
        </div>
      </div>
    );
  }

  // Render error state (Property 16)
  if (error) {
    return (
      <div className="container">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="card">
            <h2>Vehicle Not Found</h2>
            <p>{error}</p>
            <Link to="/compare" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Browse Vehicles
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const breakdownChartData = lifecycleData ? {
    labels: ['Manufacturing', 'Operational'],
    datasets: [{
      data: [
        lifecycleData.manufacturing_g_per_km || 0,
        lifecycleData.operational_g_per_km || 0
      ],
      backgroundColor: ['#00C853', '#69F0AE'],
      borderWidth: 0
    }]
  } : null;

  const sensitivityChartData = gridSensitivity.length > 0 ? {
    labels: gridSensitivity.map(s => s.country),
    datasets: [{
      label: 'Total Lifecycle (g/km)',
      data: gridSensitivity.map(s => s.total_g_per_km),
      backgroundColor: 'rgba(0, 200, 83, 0.6)',
      borderColor: '#00C853',
      borderWidth: 2
    }]
  } : null;

  const chartOptions = {
    plugins: {
      legend: {
        labels: { color: '#B0B0B0', font: { size: 14 } }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return context.label + ': ' + context.parsed.toFixed(1) + ' g/km';
          }
        }
      }
    }
  };

  const barChartOptions = {
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#B0B0B0' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#B0B0B0' }
      }
    }
  };

  // Render vehicle detail content (Property 19)
  return (
    <div className="container">
      {/* Vehicle Header */}
      <header className="vehicle-header mb-lg">
        <div className="flex-between">
          <div>
            <h1>{vehicleData?.brand} {vehicleData?.model}</h1>
            <p>{vehicleData?.Year} • {vehicleData?.type}</p>
          </div>
          <Badge variant={getBadgeVariant(vehicleData?.type)} size="large">
            {vehicleData?.type}
          </Badge>
        </div>
      </header>

      {/* Lifecycle Summary and Carbon Score */}
      <section className="grid grid-2 mb-lg" aria-label="Lifecycle summary and carbon score">
        {/* Lifecycle Summary */}
        <div className="card">
          <h3 className="mb-md">Lifecycle Summary</h3>
          <div className="metric-row">
            <span className="metric-label">Total Lifecycle</span>
            <span className="metric-value">
              {formatEmission(lifecycleData?.total_g_per_km)} g/km
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Manufacturing</span>
            <span className="metric-value">
              {formatEmission(lifecycleData?.manufacturing_g_per_km)} g/km
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Operational</span>
            <span className="metric-value">
              {formatEmission(lifecycleData?.operational_g_per_km)} g/km
            </span>
          </div>
        </div>

        {/* Carbon Score */}
        <div className="card">
          <h3 className="mb-md">Carbon Score</h3>
          <div className="score-display">
            <div 
              className="score-circle" 
              style={{
                '--score': carbonScore?.score || 0,
                borderColor: getScoreColor(carbonScore?.score || 0)
              }}
            >
              <span>{carbonScore?.score || '-'}</span>
            </div>
            <p className="mt-md">{carbonScore?.label || 'N/A'}</p>
          </div>
        </div>
      </section>

      {/* Emissions Breakdown Chart */}
      {breakdownChartData && (
        <section className="card mb-lg" aria-labelledby="breakdown-heading">
          <h2 id="breakdown-heading" className="mb-md">Emissions Breakdown</h2>
          <DonutChart data={breakdownChartData} options={chartOptions} height={300} />
        </section>
      )}

      {/* Grid Sensitivity Analysis Chart */}
      {sensitivityChartData && (
        <section className="card mb-lg" aria-labelledby="sensitivity-heading">
          <h2 id="sensitivity-heading" className="mb-md">Grid Sensitivity Analysis</h2>
          <p className="mb-md">See how this vehicle performs across different countries:</p>
          <BarChart data={sensitivityChartData} options={barChartOptions} height={300} />
        </section>
      )}

      {/* Annual Impact Calculator */}
      <section className="card" aria-labelledby="calculator-heading">
        <h2 id="calculator-heading" className="mb-md">Annual Impact Calculator</h2>
        <div className="form-group">
          <Input
            label="Annual Kilometers Driven"
            type="number"
            value={annualKm}
            onChange={handleAnnualKmChange}
            min={0}
          />
        </div>
        <Button 
          variant="primary" 
          onClick={calculateAnnualImpact}
          loading={calculatingImpact}
          disabled={!annualKm || annualKm <= 0}
        >
          Calculate Impact
        </Button>
        {annualImpact && (
          <div className="mt-md">
            <p><strong>Annual Emissions:</strong> {formatEmission(annualImpact.annual_kg)} kg CO₂</p>
            {annualImpact.equivalent && (
              <p><strong>Equivalent to:</strong> {annualImpact.equivalent}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default VehicleDetail;
