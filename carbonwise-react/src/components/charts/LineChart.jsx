import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Line Chart component
 * Wrapped with React.memo for performance optimization (Property 43)
 * @param {Object} props
 * @param {Object} props.data - Chart data
 * @param {Object} props.options - Chart options
 * @param {number} props.height - Chart height
 */
function LineChart({ data, options = {}, height = 300 }) {
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
    ...options
  };

  return (
    <div style={{ height: `${height}px` }}>
      <Line data={data} options={defaultOptions} />
    </div>
  );
}

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(LineChart);
