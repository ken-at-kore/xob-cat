/**
 * ShareReportModal Test Suite
 * 
 * Tests for the Share Report modal component that provides a two-step
 * workflow for sharing analysis reports: download report + share viewer URL.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ShareReportModal } from '../ShareReportModal';

// Mock clipboard API
const mockWriteText = jest.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Mock window.open
const mockWindowOpen = jest.fn();
Object.assign(window, { open: mockWindowOpen });

// Mock fetch for download functionality
global.fetch = jest.fn();

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = jest.fn(() => 'mock-blob-url');
const mockRevokeObjectURL = jest.fn();
Object.assign(window.URL, {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock-jwt-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock environment variables
const originalEnv = process.env;

const defaultProps = {
  isOpen: false,
  onClose: jest.fn(),
  analysisId: 'test-analysis-123',
};

describe('ShareReportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockSessionStorage.getItem.mockReturnValue('{"botId":"test-bot","clientId":"test-client","clientSecret":"test-secret"}');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Modal Visibility', () => {
    it('does not render when isOpen is false', () => {
      render(<ShareReportModal {...defaultProps} />);
      expect(screen.queryByText('Share Analysis Report')).not.toBeInTheDocument();
    });

    it('renders modal when isOpen is true', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Share Analysis Report')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const mockOnClose = jest.fn();
      render(<ShareReportModal {...defaultProps} isOpen={true} onClose={mockOnClose} />);
      
      // The close button has sr-only text "Close" but we need to find it by its data-slot attribute
      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking outside modal', async () => {
      const mockOnClose = jest.fn();
      render(<ShareReportModal {...defaultProps} isOpen={true} onClose={mockOnClose} />);
      
      // Find the modal overlay and click it
      const overlay = screen.getByRole('dialog').parentElement;
      if (overlay) {
        fireEvent.click(overlay);
      }
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Step 1 - Download Report', () => {
    it('renders step 1 content correctly', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
      expect(screen.getByText('Download Report Data')).toBeInTheDocument();
      expect(screen.getByText(/First, download the analysis report data/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download Report Data' })).toBeInTheDocument();
    });

    it('shows next step button as enabled initially', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      const nextButton = screen.getByRole('button', { name: 'Next: Share Link' });
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).not.toBeDisabled();
    });

    it('can advance to step 2 without downloading', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      const nextButton = screen.getByRole('button', { name: 'Next: Share Link' });
      expect(nextButton).not.toBeDisabled();
      
      // Can click next without downloading
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
      expect(screen.getByText('Share Report Viewer Link')).toBeInTheDocument();
    });

    it('handles download error gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      // Spy on console.error and alert
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      const downloadButton = screen.getByRole('button', { name: 'Download Report Data' });
      fireEvent.click(downloadButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to download analysis:', expect.any(Error));
        expect(alertSpy).toHaveBeenCalledWith('Failed to download analysis report. Please try again.');
      });

      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });

    it('makes correct API call for download', async () => {
      const mockBlob = new Blob(['test data'], { type: 'application/json' });
      const mockResponse = {
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: {
          get: () => null,
        },
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      render(<ShareReportModal {...defaultProps} isOpen={true} analysisId="test-123" />);
      
      const downloadButton = screen.getByRole('button', { name: 'Download Report Data' });
      fireEvent.click(downloadButton);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/analysis/auto-analyze/parallel/export/test-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-jwt-token': 'mock-jwt-token',
            'x-bot-id': 'test-bot',
            'x-client-id': 'test-client',
            'x-client-secret': 'test-secret',
          }),
        })
      );
    });
  });

  describe('Step 2 - Share Link', () => {
    it('advances to step 2 when next button is clicked', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      // Go directly to step 2 (no download required)
      const nextButton = screen.getByRole('button', { name: 'Next: Share Link' });
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
      expect(screen.getByText('Share Report Viewer Link')).toBeInTheDocument();
    });

    it('renders step 2 content correctly', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      // Navigate directly to step 2
      const nextButton = screen.getByRole('button', { name: 'Next: Share Link' });
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
      expect(screen.getByText(/Share this link with stakeholders/)).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://www.koreai-xobcat.com/report-viewer')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Open Report Viewer/ })).toBeInTheDocument();
    });

    it('uses custom report viewer URL from environment', () => {
      process.env.NEXT_PUBLIC_REPORT_VIEWER_URL = 'https://custom.example.com/viewer';

      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      // Navigate directly to step 2
      const nextButton = screen.getByRole('button', { name: 'Next: Share Link' });
      fireEvent.click(nextButton);
      
      expect(screen.getByDisplayValue('https://custom.example.com/viewer')).toBeInTheDocument();
    });

    it('copies URL to clipboard when copy button is clicked', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      // Navigate directly to step 2
      const nextButton = screen.getByRole('button', { name: 'Next: Share Link' });
      fireEvent.click(nextButton);
      
      const copyButton = screen.getByRole('button', { name: 'Copy Link' });
      fireEvent.click(copyButton);
      
      expect(mockWriteText).toHaveBeenCalledWith('https://www.koreai-xobcat.com/report-viewer');
    });

    it('shows success message after copying', async () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      // Navigate directly to step 2
      const nextButton = screen.getByRole('button', { name: 'Next: Share Link' });
      fireEvent.click(nextButton);
      
      const copyButton = screen.getByRole('button', { name: 'Copy Link' });
      fireEvent.click(copyButton);
      
      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeInTheDocument();
      });
      
      // Success message should disappear after timeout
      await waitFor(() => {
        expect(screen.queryByText('Link Copied!')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('opens report viewer in new tab when open button is clicked', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      // Navigate directly to step 2
      const nextButton = screen.getByRole('button', { name: 'Next: Share Link' });
      fireEvent.click(nextButton);
      
      const openButton = screen.getByRole('button', { name: /Open Report Viewer/ });
      fireEvent.click(openButton);
      
      expect(mockWindowOpen).toHaveBeenCalledWith('https://www.koreai-xobcat.com/report-viewer', '_blank');
    });

    it('allows going back to step 1', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      // Navigate directly to step 2
      const nextButton = screen.getByRole('button', { name: 'Next: Share Link' });
      fireEvent.click(nextButton);
      
      // Go back to step 1
      const backButton = screen.getByRole('button', { name: 'Back' });
      fireEvent.click(backButton);
      
      expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
      expect(screen.getByText('Download Report Data')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing analysisId gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<ShareReportModal {...defaultProps} isOpen={true} analysisId={undefined} />);
      
      const downloadButton = screen.getByRole('button', { name: 'Download Report Data' });
      fireEvent.click(downloadButton);
      
      // Should not make API call without analysisId
      expect(global.fetch).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('handles missing credentials gracefully', async () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      
      const mockBlob = new Blob(['test data'], { type: 'application/json' });
      const mockResponse = {
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: { get: () => null },
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      const downloadButton = screen.getByRole('button', { name: 'Download Report Data' });
      fireEvent.click(downloadButton);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-jwt-token': 'mock-jwt-token',
            // Should not include credential headers when not available
          }),
        })
      );
      
      const callHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      expect(callHeaders).not.toHaveProperty('x-bot-id');
      expect(callHeaders).not.toHaveProperty('x-client-id');
      expect(callHeaders).not.toHaveProperty('x-client-secret');
    });

    it('resets to step 1 when modal is reopened', () => {
      const { rerender } = render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      // Navigate directly to step 2
      const nextButton = screen.getByRole('button', { name: 'Next: Share Link' });
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
      
      // Close modal
      rerender(<ShareReportModal {...defaultProps} isOpen={false} />);
      
      // Reopen modal
      rerender(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      // Should be back to step 1
      expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download Report Data' })).toBeInTheDocument();
    });

    it('focuses close button when modal opens', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toHaveFocus();
    });

    it('traps focus within modal', () => {
      render(<ShareReportModal {...defaultProps} isOpen={true} />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      // All buttons should be focusable within the modal
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });
});