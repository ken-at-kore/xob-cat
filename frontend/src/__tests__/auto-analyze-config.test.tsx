import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AutoAnalyzeConfig } from '../app/(dashboard)/analyze/page';

// Mock the API client
jest.mock('../lib/api', () => ({
  autoAnalyze: {
    startAnalysis: jest.fn(),
    getProgress: jest.fn(),
    getResults: jest.fn()
  }
}));

// Mock useRouter
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

describe('AutoAnalyzeConfig Component', () => {
  const mockOnAnalysisStart = jest.fn();
  const mockOnShowMockReports = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAnalysisStart.mockClear();
    mockOnShowMockReports.mockClear();
  });

  it('renders configuration form with default values', () => {
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    // Check form elements exist
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number of sessions/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/openai api key/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start analysis/i })).toBeInTheDocument();

    // Check default values
    const sessionCountInput = screen.getByLabelText(/number of sessions/i) as HTMLInputElement;
    expect(sessionCountInput.value).toBe('100');

    const timeInput = screen.getByLabelText(/start time/i) as HTMLInputElement;
    expect(timeInput.value).toBe('09:00');

    // Date should default to 7 days ago
    const dateInput = screen.getByLabelText(/start date/i) as HTMLInputElement;
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - 7);
    const expectedDateString = expectedDate.toISOString().split('T')[0];
    expect(dateInput.value).toBe(expectedDateString);
  });

  it('displays feature explanation', () => {
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    expect(screen.getByText(/comprehensive bot performance analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/randomly samples sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/ai-powered fact extraction/i)).toBeInTheDocument();
  });

  it('validates session count range', async () => {
    const user = userEvent.setup();
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    const sessionCountInput = screen.getByLabelText(/number of sessions/i);
    const submitButton = screen.getByRole('button', { name: /start analysis/i });

    // Test too low
    await user.clear(sessionCountInput);
    await user.type(sessionCountInput, '3');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/must be between 5 and 1000/i)).toBeInTheDocument();
    });

    // Test too high
    await user.clear(sessionCountInput);
    await user.type(sessionCountInput, '1500');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/must be between 5 and 1000/i)).toBeInTheDocument();
    });

    // Test valid value
    await user.clear(sessionCountInput);
    await user.type(sessionCountInput, '100');

    await waitFor(() => {
      expect(screen.queryByText(/must be between 5 and 1000/i)).not.toBeInTheDocument();
    });
  });

  it('validates OpenAI API key format', async () => {
    const user = userEvent.setup();
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    const apiKeyInput = screen.getByLabelText(/openai api key/i);
    const submitButton = screen.getByRole('button', { name: /start analysis/i });

    // Test invalid format
    await user.type(apiKeyInput, 'invalid-key');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid openai api key format/i)).toBeInTheDocument();
    });

    // Test valid format
    await user.clear(apiKeyInput);
    await user.type(apiKeyInput, 'sk-1234567890abcdef1234567890abcdef12345678');

    await waitFor(() => {
      expect(screen.queryByText(/invalid openai api key format/i)).not.toBeInTheDocument();
    });
  });

  it('validates date is in the past', async () => {
    const user = userEvent.setup();
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    const dateInput = screen.getByLabelText(/start date/i);
    const submitButton = screen.getByRole('button', { name: /start analysis/i });

    // Test future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    await user.clear(dateInput);
    await user.type(dateInput, futureDate.toISOString().split('T')[0]);
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/date must be in the past/i)).toBeInTheDocument();
    });
  });

  it('validates time format', async () => {
    const user = userEvent.setup();
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    const timeInput = screen.getByLabelText(/start time/i);
    const submitButton = screen.getByRole('button', { name: /start analysis/i });

    // Test invalid time
    await user.clear(timeInput);
    await user.type(timeInput, '25:00');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid time format/i)).toBeInTheDocument();
    });

    // Test valid time
    await user.clear(timeInput);
    await user.type(timeInput, '14:30');

    await waitFor(() => {
      expect(screen.queryByText(/invalid time format/i)).not.toBeInTheDocument();
    });
  });

  it('requires all fields to be filled', async () => {
    const user = userEvent.setup();
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    const submitButton = screen.getByRole('button', { name: /start analysis/i });
    const apiKeyInput = screen.getByLabelText(/openai api key/i);

    // Leave API key empty
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/openai api key is required/i)).toBeInTheDocument();
    });

    // Fill API key
    await user.type(apiKeyInput, 'sk-1234567890abcdef1234567890abcdef12345678');

    await waitFor(() => {
      expect(screen.queryByText(/openai api key is required/i)).not.toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    const mockStartAnalysis = require('../lib/api').autoAnalyze.startAnalysis;
    mockStartAnalysis.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    const user = userEvent.setup();
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    // Fill form with valid data
    await user.type(screen.getByLabelText(/openai api key/i), 'sk-1234567890abcdef1234567890abcdef12345678');
    
    const submitButton = screen.getByRole('button', { name: /start analysis/i });
    await user.click(submitButton);

    // Should show loading state
    expect(screen.getByText(/starting analysis/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Wait for completion
    await waitFor(() => {
      expect(screen.queryByText(/starting analysis/i)).not.toBeInTheDocument();
    }, { timeout: 200 });
  });

  it('handles API errors gracefully', async () => {
    const mockStartAnalysis = require('../lib/api').autoAnalyze.startAnalysis;
    mockStartAnalysis.mockRejectedValue(new Error('Service unavailable'));

    const user = userEvent.setup();
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    // Fill form with valid data
    await user.type(screen.getByLabelText(/openai api key/i), 'sk-1234567890abcdef1234567890abcdef12345678');
    
    const submitButton = screen.getByRole('button', { name: /start analysis/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/service unavailable/i)).toBeInTheDocument();
    });

    // Button should be enabled again
    expect(submitButton).not.toBeDisabled();
  });

  it('displays timezone information for time input', () => {
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    expect(screen.getByText(/eastern time/i)).toBeInTheDocument();
  });

  it('shows helpful hints for configuration options', () => {
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    expect(screen.getByText(/analyzing more than 1000 sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/fewer than 10 sessions/i)).toBeInTheDocument();
  });

  it('updates form state correctly on input changes', async () => {
    const user = userEvent.setup();
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    const sessionCountInput = screen.getByLabelText(/number of sessions/i) as HTMLInputElement;
    const timeInput = screen.getByLabelText(/start time/i) as HTMLInputElement;

    await user.clear(sessionCountInput);
    await user.type(sessionCountInput, '250');
    expect(sessionCountInput.value).toBe('250');

    await user.clear(timeInput);
    await user.type(timeInput, '14:30');
    expect(timeInput.value).toBe('14:30');
  });

  it('has proper accessibility attributes', () => {
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    // Check form labels are properly associated
    const sessionCountInput = screen.getByLabelText(/number of sessions/i);
    expect(sessionCountInput).toHaveAttribute('type', 'number');
    expect(sessionCountInput).toHaveAttribute('min', '10');
    expect(sessionCountInput).toHaveAttribute('max', '1000');

    const dateInput = screen.getByLabelText(/start date/i);
    expect(dateInput).toHaveAttribute('type', 'date');

    const timeInput = screen.getByLabelText(/start time/i);
    expect(timeInput).toHaveAttribute('type', 'time');

    const apiKeyInput = screen.getByLabelText(/openai api key/i);
    expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  it('handles keyboard navigation properly', async () => {
    const user = userEvent.setup();
    render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

    const dateInput = screen.getByLabelText(/start date/i);
    const timeInput = screen.getByLabelText(/start time/i);
    const sessionCountInput = screen.getByLabelText(/number of sessions/i);
    const apiKeyInput = screen.getByLabelText(/openai api key/i);
    const submitButton = screen.getByRole('button', { name: /start analysis/i });

    // Tab through form elements
    await user.tab();
    expect(dateInput).toHaveFocus();

    await user.tab();
    expect(timeInput).toHaveFocus();

    await user.tab();
    expect(sessionCountInput).toHaveFocus();

    await user.tab();
    expect(apiKeyInput).toHaveFocus();

    await user.tab();
    expect(submitButton).toHaveFocus();
  });

  describe('Development Section Visibility', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules(); // Clear module cache
      process.env = { ...originalEnv }; // Reset to original env
    });

    afterAll(() => {
      process.env = originalEnv; // Restore original env
    });

    it('shows development section when NEXT_PUBLIC_ENABLE_DEV_FEATURES is true', () => {
      process.env.NEXT_PUBLIC_ENABLE_DEV_FEATURES = 'true';
      
      render(<AutoAnalyzeConfig 
        onAnalysisStart={mockOnAnalysisStart} 
        onShowMockReports={mockOnShowMockReports} 
        showDevFeatures={true}
      />);

      expect(screen.getByText(/development & testing/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /see mock report/i })).toBeInTheDocument();
      expect(screen.getByText(/skip the analysis step/i)).toBeInTheDocument();
    });

    it('hides development section when NEXT_PUBLIC_ENABLE_DEV_FEATURES is false', () => {
      process.env.NEXT_PUBLIC_ENABLE_DEV_FEATURES = 'false';
      
      render(<AutoAnalyzeConfig 
        onAnalysisStart={mockOnAnalysisStart} 
        onShowMockReports={mockOnShowMockReports} 
        showDevFeatures={false}
      />);

      expect(screen.queryByText(/development & testing/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /see mock report/i })).not.toBeInTheDocument();
    });

    it('hides development section when NEXT_PUBLIC_ENABLE_DEV_FEATURES is undefined', () => {
      delete process.env.NEXT_PUBLIC_ENABLE_DEV_FEATURES;
      
      render(<AutoAnalyzeConfig 
        onAnalysisStart={mockOnAnalysisStart} 
        onShowMockReports={mockOnShowMockReports} 
        showDevFeatures={false}
      />);

      expect(screen.queryByText(/development & testing/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /see mock report/i })).not.toBeInTheDocument();
    });

    it('calls onShowMockReports when mock report button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<AutoAnalyzeConfig 
        onAnalysisStart={mockOnAnalysisStart} 
        onShowMockReports={mockOnShowMockReports} 
        showDevFeatures={true}
      />);

      const mockReportButton = screen.getByRole('button', { name: /see mock report/i });
      await user.click(mockReportButton);

      expect(mockOnShowMockReports).toHaveBeenCalledTimes(1);
    });

    it('shows loading state for mock report button', () => {
      render(<AutoAnalyzeConfig 
        onAnalysisStart={mockOnAnalysisStart} 
        onShowMockReports={mockOnShowMockReports} 
        showDevFeatures={true}
        isLoadingMock={true}
      />);

      const mockReportButton = screen.getByRole('button', { name: /loading mock data/i });
      expect(mockReportButton).toBeDisabled();
    });

    it('shows correct button text - singular "Report" not "Reports"', () => {
      render(<AutoAnalyzeConfig 
        onAnalysisStart={mockOnAnalysisStart} 
        onShowMockReports={mockOnShowMockReports} 
        showDevFeatures={true}
      />);

      // Should be "See Mock Report" (singular), not "See Mock Reports" (plural)
      expect(screen.getByRole('button', { name: /see mock report$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /see mock reports/i })).not.toBeInTheDocument();
    });
  });
});