/**
 * SessionDetailsDialog Rendering Tests
 * 
 * Tests for basic rendering behavior, visibility, and initial display
 * of session information and dialog structure.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { SessionDetailsDialog } from '../SessionDetailsDialog';
import { mockSessions, defaultProps, setupMocks } from '../SessionDetailsDialog.testUtils';

describe('SessionDetailsDialog - Rendering', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<SessionDetailsDialog {...defaultProps} />);
    expect(screen.queryByText('Session Details')).not.toBeInTheDocument();
  });

  it('renders dialog with session information when isOpen is true', () => {
    render(<SessionDetailsDialog {...defaultProps} isOpen={true} />);
    
    // Check dialog header
    expect(screen.getByText('Session Details')).toBeInTheDocument();
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
    
    // Check session counter
    expect(screen.getByText('Session 1 of 2')).toBeInTheDocument();
    
    // Check navigation buttons
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    
    // Check session information grid
    expect(screen.getByText('Session Information')).toBeInTheDocument();
    expect(screen.getByText('Session ID')).toBeInTheDocument();
    expect(screen.getByText('session_123')).toBeInTheDocument();
    expect(screen.getByText('Containment Type')).toBeInTheDocument();
    expect(screen.getByText('Self Service')).toBeInTheDocument();
    expect(screen.getByText('User ID')).toBeInTheDocument();
    expect(screen.getByText('user_456')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('5m 0s')).toBeInTheDocument();
  });

  it('displays conversation messages correctly', () => {
    render(<SessionDetailsDialog {...defaultProps} isOpen={true} />);
    
    // Check conversation section
    expect(screen.getByText('Conversation')).toBeInTheDocument();
    
    // Check messages are displayed
    expect(screen.getByText('I need to check the status of my claim')).toBeInTheDocument();
    expect(screen.getByText('I can help you check your claim status. Please provide your claim number.')).toBeInTheDocument();
    
    // Check message speakers
    expect(screen.getAllByText('User').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bot').length).toBeGreaterThan(0);
  });

  it('displays different session data when currentSessionIndex changes', () => {
    render(<SessionDetailsDialog {...defaultProps} isOpen={true} currentSessionIndex={1} />);
    
    // Check that we're displaying the second session
    expect(screen.getByText('Session 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('session_456')).toBeInTheDocument();
    expect(screen.getByText('user_789')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('2m 30s')).toBeInTheDocument();
    
    // Check messages from second session
    expect(screen.getByText('I have a question about my bill')).toBeInTheDocument();
    expect(screen.getByText('I can help you with billing questions. Please provide your member ID.')).toBeInTheDocument();
  });

  it('handles sessions with empty messages array', () => {
    const sessionsWithEmptyMessages = [
      {
        ...mockSessions[0],
        messages: [],
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0
      }
    ];

    render(
      <SessionDetailsDialog
        {...defaultProps}
        isOpen={true}
        sessions={sessionsWithEmptyMessages}
      />
    );

    expect(screen.getByText('Session Information')).toBeInTheDocument();
    expect(screen.getByText('Conversation')).toBeInTheDocument();
    // Should still render the conversation section even with no messages
  });

  it('formats timestamps correctly in conversation', () => {
    render(<SessionDetailsDialog {...defaultProps} isOpen={true} />);
    
    // Check that timestamps are formatted and displayed
    // The exact format depends on the formatTime implementation
    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
    expect(timeElements.length).toBeGreaterThan(0);
  });
});