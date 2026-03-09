import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import Select from '../components/ui/Select';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import LineChart from '../components/charts/LineChart';
import '../styles/grid.css';

function GridInsights() {
  // State management
  const [gridData, setGridData] = useState({});
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [showForecast, setShowForecast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Country code mapping: 2-letter to 3-letter ISO codes
  const countryCodeMap = {
    "US": "USA",
    "DE": "DEU",
    "FR": "FRA",
    "UK": "GBR",
    "CN": "CHN",
    "JP": "JPN",
    "IN": "IND",
    "CA": "CAN",
    "AU": "AUS",
    "BR": "BRA"
  };

  // Fetch grid data on mount (Property 18)
  useEffect(() => {
    fetchGridData();
  }, []);

  const fetchGridData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getGridData();
      setGridData(data);
    } catch (err) {
      console.error('Error loading grid data:', err);
      setError(err.message || 'Failed to load grid data. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Handle country selection (Property 26)
  const handleCountryChange = (value) => {
    setSelectedCountry(value);
  };

  // Handle forecast toggle
  const handleForecastToggle = (e) => {
    setShowForecast(e.target.checked);
  };

  // Get current country data
  const getCurrentData = () => {
    // Convert to 3-letter code
    const country3Letter = countryCodeMap[selectedCountry] || selectedCountry;
    const countryData = gridData[country3Letter];
    
    if (!countryData) return null;
    
    // Get latest year data
    const years = Object.keys(countryData).sort((a, b) => b - a);
    const latestYear = years[0];
    const data = countryData[latestYear];
    
    // Handle null/undefined values
    if (!data || data.raw === null || data.corrected === null) {
      return null;
    }
    
    return {
      country: selectedCountry,
      year: latestYear,
      generationIntensity: data.raw,
      plugAdjustedIntensity: data.corrected,
      tdLossPercent: ((data.corrected - data.raw) / data.raw * 100).toFixed(2),
      years: years,
      allData: countryData
    };
  };

  // Prepare chart data
  const prepareChartData = () => {
    const data = getCurrentData();
    if (!data) return null;

    // Get historical data
    const years = data.years.sort((a, b) => a - b);
    let labels = [...years];
    let genData = years.map(year => {
      const yearData = data.allData[year];
      return yearData && yearData.raw !== null ? yearData.raw : null;
    });
    let plugData = years.map(year => {
      const yearData = data.allData[year];
      return yearData && yearData.corrected !== null ? yearData.corrected : null;
    });

    // Add forecast if enabled (Property 27)
    if (showForecast) {
      const lastYear = parseInt(years[years.length - 1]);
      const lastGen = genData[genData.length - 1];
      const lastPlug = plugData[plugData.length - 1];
      
      // Only forecast if we have valid data
      if (lastGen !== null && lastPlug !== null) {
        // Calculate trend (average change per year)
        const validGenData = genData.filter(v => v !== null);
        const validPlugData = plugData.filter(v => v !== null);
        
        if (validGenData.length > 1) {
          const genTrend = (validGenData[validGenData.length - 1] - validGenData[0]) / (validGenData.length - 1);
          const plugTrend = (validPlugData[validPlugData.length - 1] - validPlugData[0]) / (validPlugData.length - 1);
          
          // Project 5 years into future
          for (let i = 1; i <= 5; i++) {
            labels.push(lastYear + i);
            genData.push(Math.max(0, lastGen + (genTrend * i)));
            plugData.push(Math.max(0, lastPlug + (plugTrend * i)));
          }
        }
      }
    }

    return {
      labels: labels,
      datasets: [
        {
          label: 'Generation Intensity',
          data: genData,
          borderColor: '#00C853',
          backgroundColor: 'rgba(0, 200, 83, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          spanGaps: true
        },
        {
          label: 'Plug-Adjusted Intensity',
          data: plugData,
          borderColor: '#69F0AE',
          backgroundColor: 'rgba(105, 240, 174, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          spanGaps: true
        }
      ]
    };
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: { color: '#B0B0B0' }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            if (context.parsed.y === null) return 'No data';
            return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + ' g CO₂/kWh';
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
          text: 'g CO₂/kWh',
          color: '#B0B0B0'
        }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#B0B0B0' }
      }
    }
  };

  // Format large numbers
  const formatLargeNumber = (value) => {
    if (value === null || value === undefined) return '-';
    return Math.round(value).toLocaleString();
  };

  // Get current data for display
  const currentData = getCurrentData();

  // Render loading state (Property 15)
  if (loading) {
    return (
      <div className="container">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <LoadingSpinner size="large" message="Loading grid data..." />
        </div>
      </div>
    );
  }

  // Render error state (Property 16)
  if (error) {
    return (
      <div className="container">
        <div style={{ padding: '3rem' }}>
          <ErrorMessage message={error} onRetry={fetchGridData} />
        </div>
      </div>
    );
  }

  const chartData = prepareChartData();

  return (
    <div className="container">
      <h1 className="text-center mb-lg">Grid Emissions Insights</h1>
      
      {/* Chart Card with Country Selector */}
      <section className="card mb-lg" aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="visually-hidden">Grid intensity trends</h2>
        <div className="flex-between mb-md">
          <div className="form-group" style={{ margin: 0, flex: 1, maxWidth: '300px' }}>
            <Select
              label="Select Country"
              value={selectedCountry}
              onChange={handleCountryChange}
              options={[
                { value: 'US', label: 'United States' },
                { value: 'DE', label: 'Germany' },
                { value: 'FR', label: 'France' },
                { value: 'UK', label: 'United Kingdom' },
                { value: 'CN', label: 'China' },
                { value: 'JP', label: 'Japan' },
                { value: 'IN', label: 'India' },
                { value: 'CA', label: 'Canada' },
                { value: 'AU', label: 'Australia' },
                { value: 'BR', label: 'Brazil' }
              ]}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>&nbsp;</label>
            <label className="toggle-label">
              <input 
                type="checkbox" 
                checked={showForecast}
                onChange={handleForecastToggle}
              />
              <span>Show Forecast</span>
            </label>
          </div>
        </div>
        
        {/* Historical Trends Chart */}
        {chartData ? (
          <LineChart data={chartData} options={chartOptions} height={400} />
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No data available for selected country
          </div>
        )}
      </section>

      {/* Grid Intensity Metrics */}
      {currentData && (
        <section className="grid grid-3" aria-label="Grid intensity metrics">
          <div className="card text-center">
            <h4 className="text-eco">Generation Intensity</h4>
            <p className="metric-value">{formatLargeNumber(currentData.generationIntensity)}</p>
            <p className="metric-unit">g CO₂/kWh</p>
          </div>
          <div className="card text-center">
            <h4 className="text-eco">Plug-Adjusted Intensity</h4>
            <p className="metric-value">{formatLargeNumber(currentData.plugAdjustedIntensity)}</p>
            <p className="metric-unit">g CO₂/kWh</p>
          </div>
          <div className="card text-center">
            <h4 className="text-eco">T&D Loss</h4>
            <p className="metric-value">{currentData.tdLossPercent}</p>
            <p className="metric-unit">%</p>
          </div>
        </section>
      )}
    </div>
  );
}

export default GridInsights;
