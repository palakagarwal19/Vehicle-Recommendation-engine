import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GridInsights from './GridInsights';
import apiClient from '../services/api';

// Mock the API client
vi.mock('../services/api', () => ({
  default: {
    getGridData: vi.fn()
  }
}));

// Mock the chart components
vi.mock('../components/charts/LineChart', () => ({
  default: ({ data, options }) => (
    <div data-testid="line-chart">
      Chart with {data?.datasets?.length || 0} datasets
    </div>
  )
}));

describe('GridInsights Page', () => {
  const mockGridData = {
    USA: {
      '2020': { raw: 400, corrected: 450, td_loss: 0.125 },
      '2021': { raw: 380, corrected: 430, td_loss: 0.132 },
      '2022': { raw: 360, corrected: 410, td_loss: 0.139 }
    },
    DEU: {
      '2020': { raw: 350, corrected: 390, td_loss: 0.114 },
      '2021': { raw: 330, corrected: 370, td_loss: 0.121 },
      '2022': { raw: 310, corrected: 350, td_loss: 0.129 }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Property 18: Data Fetching on Component Mount
  it('should fetch grid data on mount', async () => {
    apiClient.getGridData.mockResolvedValue(mockGridData);

    render(<GridInsights />);

    await waitFor(() => {
      expect(apiClient.getGridData).toHaveBeenCalledTimes(1);
    });
  });

  // Property 15: Loading State Display
  it('should display loading spinner while fetching data', () => {
    apiClient.getGridData.mockImplementation(() => new Promise(() => {}));

    render(<GridInsights />);

    expect(screen.getByText(/loading grid data/i)).toBeInTheDocument();
  });

  // Property 16: Error Message Display
  it('should display error message when API fails', async () => {
    const errorMessage = 'Failed to load grid data';
    apiClient.getGridData.mockRejectedValue(new Error(errorMessage));

    render(<GridInsights />);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  // Property 26: Grid Insights Country Selection
  it('should update displayed data when country is changed', async () => {
    apiClient.getGridData.mockResolvedValue(mockGridData);
    const user = userEvent.setup();

    render(<GridInsights />);

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText(/generation intensity/i)).toBeInTheDocument();
    });

    // Initial country (US) should show 360 (latest year 2022)
    expect(screen.getByText('360')).toBeInTheDocument();

    // Change country to Germany
    const select = screen.getByLabelText(/select country/i);
    await user.selectOptions(select, 'DE');

    // Should now show Germany's data (310 for 2022)
    await waitFor(() => {
      expect(screen.getByText('310')).toBeInTheDocument();
    });
  });

  // Property 27: Conditional Projection Display
  it('should show forecast when toggle is enabled', async () => {
    apiClient.getGridData.mockResolvedValue(mockGridData);
    const user = userEvent.setup();

    render(<GridInsights />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/generation intensity/i)).toBeInTheDocument();
    });

    // Find and click the forecast toggle
    const forecastToggle = screen.getByRole('checkbox');
    await user.click(forecastToggle);

    // Chart should still be rendered (forecast is added to chart data)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('should display grid intensity metrics', async () => {
    apiClient.getGridData.mockResolvedValue(mockGridData);

    render(<GridInsights />);

    await waitFor(() => {
      expect(screen.getByText(/generation intensity/i)).toBeInTheDocument();
      expect(screen.getByText(/plug-adjusted intensity/i)).toBeInTheDocument();
      expect(screen.getByText(/t&d loss/i)).toBeInTheDocument();
    });
  });

  it('should display historical trends chart', async () => {
    apiClient.getGridData.mockResolvedValue(mockGridData);

    render(<GridInsights />);

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  it('should handle missing country data gracefully', async () => {
    apiClient.getGridData.mockResolvedValue({});

    render(<GridInsights />);

    await waitFor(() => {
      expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });
  });

  it('should retry fetching data when retry button is clicked', async () => {
    apiClient.getGridData.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();

    render(<GridInsights />);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    // Mock successful response for retry
    apiClient.getGridData.mockResolvedValue(mockGridData);

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    // Should show data after retry
    await waitFor(() => {
      expect(screen.getByText(/generation intensity/i)).toBeInTheDocument();
    });
  });
});
