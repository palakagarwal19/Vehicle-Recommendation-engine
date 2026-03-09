import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Stacked Bar Chart component
 * Wrapped with React.memo for performance optimization (Property 43)
 * @param {Object} props
 * @param {Object} props.data - Chart data
 * @param {Object} props.options - Chart options
 * @param {number} props.height - Chart height
 */
function StackedBarChart({ data, options = {}, height = 300 }) {
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
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
      },
    },
    ...options
  };

  return (
    <div style={{ height: `${height}px` }}>
      <Bar data={data} options={defaultOptions} />
    </div>
  );
}

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(StackedBarChart);
