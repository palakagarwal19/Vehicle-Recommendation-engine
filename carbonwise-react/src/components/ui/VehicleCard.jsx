import React from 'react';
import './VehicleCard.css';
import Badge from './Badge';

/**
 * Vehicle card component
 * Wrapped with React.memo for performance optimization (Property 43)
 * @param {Object} props
 * @param {Object} props.vehicle - Vehicle data
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.selected - Selected state
 * @param {boolean} props.showDetails - Show detailed information
 */
function VehicleCard({ vehicle, onClick, selected = false, showDetails = false }) {
  const cardClass = `vehicle-card ${selected ? 'vehicle-card-selected' : ''} ${onClick ? 'vehicle-card-clickable' : ''}`;

  return (
    <div className={cardClass} onClick={onClick}>
      <div className="vehicle-card-header">
        <h4 className="vehicle-card-title">
          {vehicle.brand} {vehicle.model}
        </h4>
        <Badge variant="info" size="small">
          {vehicle.year}
        </Badge>
      </div>
      
      <div className="vehicle-card-body">
        <div className="vehicle-card-info">
          <span className="vehicle-card-label">Powertrain:</span>
          <Badge variant={vehicle.powertrain === 'BEV' ? 'success' : 'info'} size="small">
            {vehicle.powertrain}
          </Badge>
        </div>
        
        {showDetails && vehicle.emissions && (
          <div className="vehicle-card-info">
            <span className="vehicle-card-label">Emissions:</span>
            <span className="vehicle-card-value">{vehicle.emissions} g CO₂/km</span>
          </div>
        )}
      </div>
      
      {selected && (
        <div className="vehicle-card-selected-indicator">✓ Selected</div>
      )}
    </div>
  );
}

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(VehicleCard);
