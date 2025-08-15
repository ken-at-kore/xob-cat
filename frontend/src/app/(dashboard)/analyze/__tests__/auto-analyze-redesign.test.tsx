import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AutoAnalyzeConfig } from '../page';

// Mock the API client
jest.mock('../../../../lib/api', () => ({
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

describe('AutoAnalyzeConfig - Redesigned UI', () => {
  const mockOnAnalysisStart = jest.fn();
  const mockOnShowMockReports = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAnalysisStart.mockClear();
    mockOnShowMockReports.mockClear();
  });

  describe('Page Copy and Messaging', () => {
    it('displays new title and description copy', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      expect(screen.getByText('Auto-Analyze')).toBeInTheDocument();
      expect(screen.getByText(/intelligent bot performance insights/i)).toBeInTheDocument();
      expect(screen.getByText(/automatically analyzing customer service sessions/i)).toBeInTheDocument();
      expect(screen.getByText(/identifies patterns, classifies interactions/i)).toBeInTheDocument();
      expect(screen.getByText(/improve your bot's effectiveness/i)).toBeInTheDocument();
    });

    it('displays new card heading and description', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      expect(screen.getByText('Session Analysis Setup')).toBeInTheDocument();
      expect(screen.getByText(/Configure your AI-powered analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/AI will automatically sample sessions/i)).toBeInTheDocument();
    });

    it('displays "How Auto-Analyze Works" without "Parallel"', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      expect(screen.getByText('How Auto-Analyze Works')).toBeInTheDocument();
      expect(screen.queryByText(/parallel/i)).not.toBeInTheDocument();
    });
  });

  describe('Time of Day Dropdown', () => {
    it('renders time of day dropdown instead of time picker', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      expect(screen.getByLabelText(/time of day/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/start time/i)).not.toBeInTheDocument();
    });

    it('has correct time of day options', async () => {
      const user = userEvent.setup();
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      const dropdown = screen.getByLabelText(/time of day/i);
      await user.click(dropdown);

      await waitFor(() => {
        expect(screen.getByText('Morning (9:00 AM ET)')).toBeInTheDocument();
        expect(screen.getByText('Afternoon (1:00 PM ET)')).toBeInTheDocument();
        expect(screen.getByText('Evening (6:00 PM ET)')).toBeInTheDocument();
      });
    });

    it('defaults to Morning', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      const dropdown = screen.getByLabelText(/time of day/i);
      expect(dropdown).toHaveTextContent('Morning (9:00 AM ET)');
    });
  });

  describe('Field Order and OpenAI API Key', () => {
    it('has OpenAI API key field in correct position (after time of day)', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      const fields = screen.getAllByRole('textbox');
      const dateField = screen.getByLabelText(/start date/i);
      const apiKeyField = screen.getByLabelText(/openai api key/i);
      
      // OpenAI API key should come after date and time of day
      expect(apiKeyField).toBeInTheDocument();
    });

    it('displays updated OpenAI API key description without specific model', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      expect(screen.getByText(/your openai api key for ai analysis/i)).toBeInTheDocument();
      expect(screen.queryByText(/gpt-4o-mini/i)).not.toBeInTheDocument();
    });
  });

  describe('Cost Information', () => {
    it('displays cost estimate information', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      expect(screen.getByText(/cost of the analysis can't be precisely determined/i)).toBeInTheDocument();
      expect(screen.getByText(/may cost about 25 cents/i)).toBeInTheDocument();
      expect(screen.getByText(/depending on the length of the sessions/i)).toBeInTheDocument();
    });
  });

  describe('Progressive Disclosure - Advanced Options', () => {
    it('hides advanced fields by default', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      expect(screen.queryByLabelText(/number of sessions/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/gpt model/i)).not.toBeInTheDocument();
    });

    it('shows advanced options toggle', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      expect(screen.getByText('Advanced')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /advanced/i })).toBeInTheDocument();
    });

    it('reveals advanced fields when expanded', async () => {
      const user = userEvent.setup();
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      const advancedToggle = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedToggle);

      await waitFor(() => {
        expect(screen.getByLabelText(/number of sessions/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/gpt model/i)).toBeInTheDocument();
      });
    });

    it('removes restrictive copy from session count field', async () => {
      const user = userEvent.setup();
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      const advancedToggle = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedToggle);

      await waitFor(() => {
        expect(screen.queryByText(/analyzing more than 1000 sessions isn't allowed/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/if fewer than 5 sessions are found/i)).not.toBeInTheDocument();
      });
    });

    it('removes GPT pricing section', async () => {
      const user = userEvent.setup();
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      const advancedToggle = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedToggle);

      await waitFor(() => {
        expect(screen.queryByText(/pricing/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/input:/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/output:/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/1m tokens/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Validation with New Structure', () => {
    it('validates form with time of day selection', async () => {
      const user = userEvent.setup();
      const mockStartAnalysis = require('../../../../lib/api').autoAnalyze.startAnalysis;
      mockStartAnalysis.mockResolvedValue({ success: true, data: { analysisId: 'test-id' } });

      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/openai api key/i), 'sk-1234567890abcdef1234567890abcdef12345678');
      
      // Select different time of day
      const timeDropdown = screen.getByLabelText(/time of day/i);
      await user.click(timeDropdown);
      await user.click(screen.getByText('Afternoon (1:00 PM ET)'));

      const submitButton = screen.getByRole('button', { name: /start analysis/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockStartAnalysis).toHaveBeenCalledWith(
          expect.objectContaining({
            timeOfDay: 'afternoon'
          })
        );
      });
    });

    it('validates advanced fields when expanded', async () => {
      const user = userEvent.setup();
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      // Expand advanced options
      const advancedToggle = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedToggle);

      await waitFor(() => {
        const sessionCountField = screen.getByLabelText(/number of sessions/i);
        expect(sessionCountField).toBeInTheDocument();
      });

      // Test validation on advanced fields
      const sessionCountInput = screen.getByLabelText(/number of sessions/i);
      await user.clear(sessionCountInput);
      await user.type(sessionCountInput, '3'); // Too low

      const submitButton = screen.getByRole('button', { name: /start analysis/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/must be between 5 and 1000/i)).toBeInTheDocument();
      });
    });
  });

  describe('Default Values', () => {
    it('has correct default values for new structure', () => {
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      // Date should default to yesterday
      const dateInput = screen.getByLabelText(/start date/i) as HTMLInputElement;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 1);
      const expectedDateString = expectedDate.toISOString().split('T')[0];
      expect(dateInput.value).toBe(expectedDateString);

      // Time of day should default to Morning
      const timeDropdown = screen.getByLabelText(/time of day/i);
      expect(timeDropdown).toHaveTextContent('Morning (9:00 AM ET)');

      // API key should be empty
      const apiKeyInput = screen.getByLabelText(/openai api key/i) as HTMLInputElement;
      expect(apiKeyInput.value).toBe('');
    });

    it('has correct default values for advanced fields when expanded', async () => {
      const user = userEvent.setup();
      render(<AutoAnalyzeConfig onAnalysisStart={mockOnAnalysisStart} onShowMockReports={mockOnShowMockReports} />);

      const advancedToggle = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedToggle);

      await waitFor(() => {
        // Session count should default to 100
        const sessionCountInput = screen.getByLabelText(/number of sessions/i) as HTMLInputElement;
        expect(sessionCountInput.value).toBe('100');
      });
    });
  });
});