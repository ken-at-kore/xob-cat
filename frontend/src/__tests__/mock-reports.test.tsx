/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AutoAnalyzePage from '../app/(dashboard)/analyze/page';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Mock Reports Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display "See Mock Reports" button on config page', () => {
    render(<AutoAnalyzePage />);
    
    const mockReportsButton = screen.getByText('See Mock Reports');
    expect(mockReportsButton).toBeInTheDocument();
    expect(mockReportsButton.tagName).toBe('BUTTON');
  });

  it('should load and display mock data when "See Mock Reports" is clicked', async () => {
    // Mock the API response
    const mockData = [
      {
        session_id: 'test_session_1',
        user_id: 'user_1',
        start_time: '2025-07-18T14:00:00.000Z',
        end_time: '2025-07-18T14:05:00.000Z',
        containment_type: 'selfService',
        messages: [
          {
            message_id: 'msg_1',
            message: 'Hello, I need help with my claim',
            message_type: 'user' as const,
            sent_time: '2025-07-18T14:00:00.000Z',
            user_id: 'user_1'
          }
        ],
        facts: {
          generalIntent: 'Claim Status',
          sessionOutcome: 'Contained' as const,
          transferReason: '',
          dropOffLocation: '',
          notes: 'User successfully checked claim status through self-service.'
        }
      }
    ];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });

    render(<AutoAnalyzePage />);
    
    const mockReportsButton = screen.getByText('See Mock Reports');
    fireEvent.click(mockReportsButton);

    // Wait for the results to load and appear
    await waitFor(() => {
      expect(screen.getByText('Analysis Results')).toBeInTheDocument();
    });

    // Verify the mock data is displayed
    expect(screen.getByText('test_session_1')).toBeInTheDocument();
    expect(screen.getByText('Claim Status')).toBeInTheDocument();
    
    // Use more specific selector for the "Contained" badge in the table
    const containedBadges = screen.getAllByText('Contained');
    expect(containedBadges.length).toBeGreaterThan(0);
  });

  it('should show loading state when loading mock data', async () => {
    // Mock a delayed response
    (fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => []
      }), 100))
    );

    render(<AutoAnalyzePage />);
    
    const mockReportsButton = screen.getByText('See Mock Reports');
    fireEvent.click(mockReportsButton);

    // Should show loading state
    expect(screen.getByText('Loading Mock Data...')).toBeInTheDocument();
    expect(screen.getByText('Loading Mock Data...')).toBeDisabled();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading Mock Data...')).not.toBeInTheDocument();
    });
  });

  it('should handle mock data loading errors gracefully', async () => {
    // Mock API error
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<AutoAnalyzePage />);
    
    const mockReportsButton = screen.getByText('See Mock Reports');
    fireEvent.click(mockReportsButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading mock results:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should allow starting a new analysis from mock results view', async () => {
    const mockData = [{
      session_id: 'test_session_1',
      user_id: 'user_1',
      start_time: '2025-07-18T14:00:00.000Z',
      end_time: '2025-07-18T14:05:00.000Z',
      containment_type: 'selfService',
      messages: [],
      facts: {
        generalIntent: 'Claim Status',
        sessionOutcome: 'Contained' as const,
        transferReason: '',
        dropOffLocation: '',
        notes: 'Test session'
      }
    }];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });

    render(<AutoAnalyzePage />);
    
    // Click mock reports button
    const mockReportsButton = screen.getByText('See Mock Reports');
    fireEvent.click(mockReportsButton);

    // Wait for results to load
    await waitFor(() => {
      expect(screen.getByText('Analysis Results')).toBeInTheDocument();
    });

    // Click "Start New Analysis" button
    const startNewButton = screen.getByText('Start New Analysis');
    fireEvent.click(startNewButton);

    // Should return to config page
    expect(screen.getByText('Auto-Analyze')).toBeInTheDocument();
    expect(screen.getByText('See Mock Reports')).toBeInTheDocument();
  });
});