import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

/**
 * Donut Chart component
 * Wrapped with React.memo for performance optimization (Property 43)
 * @param {Object} props
 * @param {Object} props.data - Chart data
 * @param {Object} props.options - Chart options
 * @param {number} props.height - Chart height
 */
function DonutChart({ data, options = {}, height = 300 }) {
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: false,
      },
    },
    ...options
  };

  return (
    <div style={{ height: `${height}px` }}>
      <Doughnut data={data} options={defaultOptions} />
    </div>
  );
}

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(DonutChart);
