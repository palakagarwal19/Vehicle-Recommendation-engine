import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import VehicleCard from '../components/ui/VehicleCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import BarChart from '../components/charts/BarChart';
import StackedBarChart from '../components/charts/StackedBarChart';
import DonutChart from '../components/charts/DonutChart';
import useDebounce from '../hooks/useDebounce';
import '../styles/compare.css';

function Compare() {
  // State management
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [unitMode, setUnitMode] = useState('g_km'); // 'g_km', 'lifetime', 'ten_year'
  const [loading, setLoading] = useState(true);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    brand: '',
    model: '',
    year: '',
    powertrain: '',
    country: 'US'
  });

  // Debounce filter values to reduce unnecessary re-renders (Property 44)
  const debouncedBrand = useDebounce(filters.brand, 300);
  const debouncedModel = useDebounce(filters.model, 300);
  const debouncedYear = useDebounce(filters.year, 300);
  const debouncedPowertrain = useDebounce(filters.powertrain, 300);

  // Fetch vehicles on mount
  useEffect(() => {
    fetchVehicles();
  }, []);

  // Fetch comparison data when vehicles are selected
  useEffect(() => {
    if (selectedVehicles.length > 0) {
      fetchComparisonData();
    } else {
      setComparisonData(null);
    }
  }, [selectedVehicles, filters.country]);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAllVehicles();
      setVehicles(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchComparisonData = async () => {
    try {
      setComparisonLoading(true);
      const vehicleData = selectedVehicles.map(v => ({
        brand: v.brand,
        model: v.model,
        year: v.year
      }));
      
      const data = await apiClient.compareMultiple(
        filters.country,
        2023, // Grid year
        vehicleData
      );
      
      setComparisonData(data);
    } catch (err) {
      console.error('Failed to fetch comparison data:', err);
      // Don't set error state here, just log it
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters({ ...filters, [filterName]: value });
  };

  const handleVehicleSelect = (vehicle) => {
    const isSelected = selectedVehicles.find(
      v => v.brand === vehicle.brand && v.model === vehicle.model && v.year === vehicle.year
    );
    
    if (isSelected) {
      // Remove vehicle
      setSelectedVehicles(
        selectedVehicles.filter(
          v => !(v.brand === vehicle.brand && v.model === vehicle.model && v.year === vehicle.year)
        )
      );
    } else if (selectedVehicles.length < 3) {
      // Add vehicle (max 3)
      setSelectedVehicles([...selectedVehicles, vehicle]);
    }
  };

  const handleVehicleRemove = (vehicle) => {
    setSelectedVehicles(
      selectedVehicles.filter(
        v => !(v.brand === vehicle.brand && v.model === vehicle.model && v.year === vehicle.year)
      )
    );
  };

  const handleUnitToggle = (mode) => {
    setUnitMode(mode);
  };

  // Filter vehicles based on selected filters
  const filteredVehicles = vehicles.filter(vehicle => {
    if (filters.brand && vehicle.brand !== filters.brand) return false;
    if (filters.model && vehicle.model !== filters.model) return false;
    if (filters.year && vehicle.year !== parseInt(filters.year)) return false;
    if (filters.powertrain && vehicle.powertrain !== filters.powertrain) return false;
    return true;
  });

  // Get unique values for filter dropdowns
  const uniqueBrands = [...new Set(vehicles.map(v => v.brand))].sort();
  const uniqueModels = filters.brand
    ? [...new Set(vehicles.filter(v => v.brand === filters.brand).map(v => v.model))].sort()
    : [...new Set(vehicles.map(v => v.model))].sort();
  const uniqueYears = [...new Set(vehicles.map(v => v.year))].sort((a, b) => b - a);
  const uniquePowertrains = [...new Set(vehicles.map(v => v.powertrain))].sort();

  // Prepare chart data
  const prepareBarChartData = () => {
    if (!comparisonData || !Array.isArray(comparisonData)) return null;

    const labels = comparisonData.map(item => `${item.vehicle.brand} ${item.vehicle.model}`);
    const data = comparisonData.map(item => {
      if (unitMode === 'g_km') {
        return item.lifecycle?.emissions?.total?.g_per_km || 0;
      } else if (unitMode === 'lifetime') {
        return item.lifecycle?.emissions?.total?.lifetime_kg || 0;
      } else {
        return item.lifecycle?.emissions?.total?.ten_year_kg || 0;
      }
    });

    return {
      labels,
      datasets: [{
        label: unitMode === 'g_km' ? 'g CO₂/km' : 'kg CO₂',
        data,
        backgroundColor: 'rgba(0, 200, 83, 0.6)',
        borderColor: 'rgba(0, 200, 83, 1)',
        borderWidth: 1
      }]
    };
  };

  const prepareStackedChartData = () => {
    if (!comparisonData || !Array.isArray(comparisonData)) return null;

    const labels = comparisonData.map(item => `${item.vehicle.brand} ${item.vehicle.model}`);
    
    return {
      labels,
      datasets: [
        {
          label: 'Manufacturing',
          data: comparisonData.map(item => item.lifecycle?.emissions?.manufacturing?.total || 0),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
        },
        {
          label: 'Operational',
          data: comparisonData.map(item => {
            if (unitMode === 'g_km') {
              return item.lifecycle?.emissions?.operational?.total_g_per_km || 0;
            } else if (unitMode === 'lifetime') {
              return item.lifecycle?.emissions?.operational?.lifetime_kg || 0;
            } else {
              return item.lifecycle?.emissions?.operational?.ten_year_kg || 0;
            }
          }),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
        }
      ]
    };
  };

  const prepareDonutChartData = (vehicleIndex) => {
    if (!comparisonData || !Array.isArray(comparisonData) || !comparisonData[vehicleIndex]) return null;

    const item = comparisonData[vehicleIndex];
    const manufacturing = item.lifecycle?.emissions?.manufacturing?.total || 0;
    const operational = unitMode === 'g_km'
      ? item.lifecycle?.emissions?.operational?.total_g_per_km || 0
      : unitMode === 'lifetime'
      ? item.lifecycle?.emissions?.operational?.lifetime_kg || 0
      : item.lifecycle?.emissions?.operational?.ten_year_kg || 0;

    return {
      labels: ['Manufacturing', 'Operational'],
      datasets: [{
        data: [manufacturing, operational],
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
        ],
        borderWidth: 1
      }]
    };
  };

  if (loading) return <LoadingSpinner size="large" message="Loading vehicles..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchVehicles} />;

  return (
    <div className="compare-page">
      <h1>Compare Vehicles</h1>
      
      {/* Filter Controls */}
      <section className="filters" aria-label="Vehicle filters">
        <Select
          label="Brand"
          value={filters.brand}
          onChange={(value) => handleFilterChange('brand', value)}
          options={[
            { value: '', label: 'All Brands' },
            ...uniqueBrands.map(brand => ({ value: brand, label: brand }))
          ]}
        />
        
        <Select
          label="Model"
          value={filters.model}
          onChange={(value) => handleFilterChange('model', value)}
          options={[
            { value: '', label: 'All Models' },
            ...uniqueModels.map(model => ({ value: model, label: model }))
          ]}
        />
        
        <Select
          label="Year"
          value={filters.year}
          onChange={(value) => handleFilterChange('year', value)}
          options={[
            { value: '', label: 'All Years' },
            ...uniqueYears.map(year => ({ value: year.toString(), label: year.toString() }))
          ]}
        />
        
        <Select
          label="Powertrain"
          value={filters.powertrain}
          onChange={(value) => handleFilterChange('powertrain', value)}
          options={[
            { value: '', label: 'All Powertrains' },
            ...uniquePowertrains.map(pt => ({ value: pt, label: pt }))
          ]}
        />
        
        <Select
          label="Country"
          value={filters.country}
          onChange={(value) => handleFilterChange('country', value)}
          options={[
            { value: 'US', label: 'United States' },
            { value: 'DE', label: 'Germany' },
            { value: 'UK', label: 'United Kingdom' },
            { value: 'FR', label: 'France' },
            { value: 'CN', label: 'China' }
          ]}
        />
      </section>

      {/* Selected Vehicles */}
      <section className="selected-vehicles" aria-labelledby="selected-heading">
        <h2 id="selected-heading">Selected Vehicles ({selectedVehicles.length}/3)</h2>
        {selectedVehicles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">🚗</div>
            <p>Select up to 3 vehicles to compare</p>
          </div>
        ) : (
          <div className="vehicle-grid">
            {selectedVehicles.map((vehicle, index) => (
              <div key={index} className="comparison-card">
                <button
                  className="remove-btn"
                  onClick={() => handleVehicleRemove(vehicle)}
                  aria-label={`Remove ${vehicle.brand} ${vehicle.model} from comparison`}
                >
                  ×
                </button>
                <VehicleCard
                  vehicle={vehicle}
                  selected={true}
                  showDetails={true}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Unit Toggle */}
      {selectedVehicles.length > 0 && (
        <section className="unit-toggle" aria-label="Emission unit selection">
          <Button
            variant={unitMode === 'g_km' ? 'primary' : 'outline'}
            onClick={() => handleUnitToggle('g_km')}
            className={unitMode === 'g_km' ? 'unit-btn active' : 'unit-btn'}
          >
            g/km
          </Button>
          <Button
            variant={unitMode === 'lifetime' ? 'primary' : 'outline'}
            onClick={() => handleUnitToggle('lifetime')}
            className={unitMode === 'lifetime' ? 'unit-btn active' : 'unit-btn'}
          >
            Lifetime (kg)
          </Button>
          <Button
            variant={unitMode === 'ten_year' ? 'primary' : 'outline'}
            onClick={() => handleUnitToggle('ten_year')}
            className={unitMode === 'ten_year' ? 'unit-btn active' : 'unit-btn'}
          >
            10-Year (kg)
          </Button>
        </section>
      )}

      {/* Comparison Charts */}
      {comparisonLoading && (
        <LoadingSpinner size="medium" message="Loading comparison data..." />
      )}
      
      {!comparisonLoading && comparisonData && comparisonData.length > 0 && (
        <section className="charts-section" aria-labelledby="charts-heading">
          <h2 id="charts-heading">Comparison Charts</h2>
          
          <div className="chart-container">
            <h3>Total Emissions Comparison</h3>
            {prepareBarChartData() && (
              <BarChart data={prepareBarChartData()} height={300} />
            )}
          </div>

          <div className="chart-container">
            <h3>Emissions Breakdown</h3>
            {prepareStackedChartData() && (
              <StackedBarChart data={prepareStackedChartData()} height={300} />
            )}
          </div>

          <div className="donut-charts">
            {comparisonData.map((item, index) => (
              <div key={index} className="chart-container">
                <h3>{item.vehicle.brand} {item.vehicle.model}</h3>
                {prepareDonutChartData(index) && (
                  <DonutChart data={prepareDonutChartData(index)} height={250} />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available Vehicles */}
      <section className="available-vehicles" aria-labelledby="available-heading">
        <h2 id="available-heading">Available Vehicles ({filteredVehicles.length})</h2>
        <div className="vehicle-list" role="list">
          {filteredVehicles.slice(0, 20).map((vehicle, index) => (
            <div
              key={index}
              role="listitem"
              className={`vehicle-item ${
                selectedVehicles.some(
                  v => v.brand === vehicle.brand && v.model === vehicle.model && v.year === vehicle.year
                )
                  ? 'selected'
                  : ''
              } ${selectedVehicles.length >= 3 && !selectedVehicles.some(
                v => v.brand === vehicle.brand && v.model === vehicle.model && v.year === vehicle.year
              ) ? 'disabled' : ''}`}
              onClick={() => handleVehicleSelect(vehicle)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleVehicleSelect(vehicle);
                }
              }}
              tabIndex={0}
              aria-label={`${vehicle.brand} ${vehicle.model} ${vehicle.year} ${vehicle.powertrain}`}
            >
              <h5>{vehicle.brand} {vehicle.model}</h5>
              <p>Year: {vehicle.year}</p>
              <p>Powertrain: {vehicle.powertrain}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Compare;
