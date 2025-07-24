/**
 * SessionDetailsDialog Interactions Tests
 * 
 * Tests for user interactions including navigation, keyboard controls,
 * button clicks, and dialog close behavior.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionDetailsDialog } from '../SessionDetailsDialog';
import { defaultProps, setupMocks } from '../SessionDetailsDialog.testUtils';

describe('SessionDetailsDialog - Interactions', () => {
  beforeEach(() => {
    setupMocks();
  });

  describe('Close behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = jest.fn();
      render(<SessionDetailsDialog {...defaultProps} isOpen={true} onClose={onClose} />);
      
      const closeButton = screen.getByLabelText('Close');
      await userEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', async () => {
      const onClose = jest.fn();
      render(<SessionDetailsDialog {...defaultProps} isOpen={true} onClose={onClose} />);
      
      // The Escape key will be handled by the dialog itself, which will call onOpenChange
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      // Should be called once by the dialog's built-in behavior
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navigation buttons', () => {
    it('calls onNavigate with correct index when Previous button is clicked', async () => {
      const onNavigate = jest.fn();
      render(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={1} onNavigate={onNavigate} />);
      
      const prevButton = screen.getByRole('button', { name: /previous/i });
      await userEvent.click(prevButton);
      
      expect(onNavigate).toHaveBeenCalledWith(0);
    });

    it('calls onNavigate with correct index when Next button is clicked', async () => {
      const onNavigate = jest.fn();
      render(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={0} onNavigate={onNavigate} />);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextButton);
      
      expect(onNavigate).toHaveBeenCalledWith(1);
    });

    it('disables Previous button on first session', () => {
      render(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={0} />);
      
      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('disables Next button on last session', () => {
      render(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={1} />);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Keyboard navigation', () => {
    it('navigates with arrow keys', async () => {
      const onNavigate = jest.fn();
      render(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={0} onNavigate={onNavigate} />);
      
      // Right arrow should go to next session
      fireEvent.keyDown(document, { key: 'ArrowRight', code: 'ArrowRight' });
      expect(onNavigate).toHaveBeenCalledWith(1);
      
      // Left arrow should go to previous session
      onNavigate.mockClear();
      render(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={1} onNavigate={onNavigate} />);
      fireEvent.keyDown(document, { key: 'ArrowLeft', code: 'ArrowLeft' });
      expect(onNavigate).toHaveBeenCalledWith(0);
    });

    it('does not navigate beyond session boundaries with arrow keys', () => {
      const onNavigate = jest.fn();
      
      // Test at first session (should not go left)
      const { unmount } = render(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={0} onNavigate={onNavigate} />);
      fireEvent.keyDown(document, { key: 'ArrowLeft', code: 'ArrowLeft' });
      expect(onNavigate).not.toHaveBeenCalled();
      unmount();
      
      // Test at last session (should not go right)
      onNavigate.mockClear();
      render(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={1} onNavigate={onNavigate} />);
      fireEvent.keyDown(document, { key: 'ArrowRight', code: 'ArrowRight' });
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Session switching', () => {
    it('displays different session data when currentSessionIndex changes', () => {
      const { rerender } = render(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={0} />);
      
      // First session
      expect(screen.getByText('session_123')).toBeInTheDocument();
      expect(screen.getByText('Self Service')).toBeInTheDocument();
      
      // Switch to second session
      rerender(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={1} />);
      expect(screen.getByText('session_456')).toBeInTheDocument();
      expect(screen.getByText('Agent')).toBeInTheDocument();
      expect(screen.getByText('Session 2 of 2')).toBeInTheDocument();
    });
  });
});