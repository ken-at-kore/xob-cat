import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionDetailsDialog } from '../SessionDetailsDialog';
import { SessionWithTranscript } from '../../../shared/types';

const mockSessions: SessionWithTranscript[] = [
  {
    session_id: 'session_123',
    user_id: 'user_456',
    start_time: '2025-07-21T10:00:00.000Z',
    end_time: '2025-07-21T10:05:00.000Z',
    containment_type: 'selfService',
    tags: ['Claim Status', 'Contained'],
    metrics: {
      total_messages: 8,
      user_messages: 4,
      bot_messages: 4
    },
    messages: [
      {
        timestamp: '2025-07-21T10:00:00.000Z',
        message_type: 'user',
        message: 'I need to check the status of my claim'
      },
      {
        timestamp: '2025-07-21T10:00:30.000Z',
        message_type: 'bot',
        message: 'I can help you check your claim status. Please provide your claim number.'
      },
      {
        timestamp: '2025-07-21T10:01:00.000Z',
        message_type: 'user',
        message: 'My claim number is CLM-12345'
      },
      {
        timestamp: '2025-07-21T10:01:30.000Z',
        message_type: 'bot',
        message: 'Thank you. Your claim CLM-12345 is currently being processed and should be completed within 3-5 business days.'
      }
    ],
    duration_seconds: 300,
    message_count: 4,
    user_message_count: 2,
    bot_message_count: 2
  },
  {
    session_id: 'session_456',
    user_id: 'user_789',
    start_time: '2025-07-21T11:00:00.000Z',
    end_time: '2025-07-21T11:02:30.000Z',
    containment_type: 'agent',
    tags: ['Billing', 'Transfer'],
    metrics: {
      total_messages: 6,
      user_messages: 3,
      bot_messages: 3
    },
    messages: [
      {
        timestamp: '2025-07-21T11:00:00.000Z',
        message_type: 'user',
        message: 'I have a question about my bill'
      },
      {
        timestamp: '2025-07-21T11:00:30.000Z',
        message_type: 'bot',
        message: 'I can help you with billing questions. Please provide your member ID.'
      }
    ],
    duration_seconds: 150,
    message_count: 2,
    user_message_count: 1,
    bot_message_count: 1
  }
];

describe('SessionDetailsDialog', () => {
  const defaultProps = {
    isOpen: false,
    onClose: jest.fn(),
    sessions: mockSessions,
    currentSessionIndex: 0,
    onNavigate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('handles sessions with empty messages array', () => {
    const sessionsWithEmptyMessages: SessionWithTranscript[] = [{
      ...mockSessions[0],
      messages: []
    }];
    
    render(<SessionDetailsDialog {...defaultProps} isOpen={true} sessions={sessionsWithEmptyMessages} />);
    
    expect(screen.getByText('Conversation')).toBeInTheDocument();
    expect(screen.getByText('No messages in this session.')).toBeInTheDocument();
  });

  it('formats timestamps correctly in conversation', () => {
    render(<SessionDetailsDialog {...defaultProps} isOpen={true} />);
    
    // Check that timestamps are formatted (format will depend on implementation)
    expect(screen.getByText('06:00:00 AM')).toBeInTheDocument();
    expect(screen.getByText('06:00:30 AM')).toBeInTheDocument();
  });

  it('displays messages when session has proper message structure with sessionId field', () => {
    // Test with Kore.ai style messages that include sessionId field
    const sessionWithKoreMessages: SessionWithTranscript[] = [{
      session_id: 'test_session',
      user_id: 'user_123',
      start_time: '2025-07-21T10:00:00.000Z',
      end_time: '2025-07-21T10:05:00.000Z',
      containment_type: 'selfService',
      tags: [],
      metrics: { total_messages: 2, user_messages: 1, bot_messages: 1 },
      messages: [
        {
          sessionId: 'test_session', // This field might be present in Kore.ai data
          timestamp: '2025-07-21T10:00:00.000Z',
          message_type: 'user',
          message: 'Hello, I need help'
        },
        {
          sessionId: 'test_session',
          timestamp: '2025-07-21T10:00:30.000Z',
          message_type: 'bot', 
          message: 'How can I assist you today?'
        }
      ] as any, // Cast to any to allow sessionId field
      duration_seconds: 300,
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1
    }];

    render(<SessionDetailsDialog 
      isOpen={true}
      onClose={jest.fn()}
      sessions={sessionWithKoreMessages}
      currentSessionIndex={0}
      onNavigate={jest.fn()}
    />);

    expect(screen.getByText('Conversation')).toBeInTheDocument();
    expect(screen.getByText('Hello, I need help')).toBeInTheDocument();
    expect(screen.getByText('How can I assist you today?')).toBeInTheDocument();
    expect(screen.getAllByText('User')).toHaveLength(1);
    expect(screen.getAllByText('Bot')).toHaveLength(1);
    expect(screen.queryByText('No messages in this session.')).not.toBeInTheDocument();
  });

  it('handles malformed message data gracefully', () => {
    const sessionWithMalformedMessages: SessionWithTranscript[] = [{
      session_id: 'test_session',
      user_id: 'user_123',
      start_time: '2025-07-21T10:00:00.000Z',
      end_time: '2025-07-21T10:05:00.000Z',
      containment_type: 'selfService',
      tags: [],
      metrics: { total_messages: 2, user_messages: 1, bot_messages: 1 },
      messages: [
        // Message without required fields
        {
          timestamp: '2025-07-21T10:00:00.000Z'
          // missing message_type and message
        },
        // Message with extra fields
        {
          sessionId: 'test_session',
          timestamp: '2025-07-21T10:00:30.000Z',
          message_type: 'bot',
          message: 'Valid message',
          extraField: 'should be ignored'
        }
      ] as any,
      duration_seconds: 300,
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1
    }];

    render(<SessionDetailsDialog 
      isOpen={true}
      onClose={jest.fn()}
      sessions={sessionWithMalformedMessages}
      currentSessionIndex={0}
      onNavigate={jest.fn()}
    />);

    expect(screen.getByText('Conversation')).toBeInTheDocument();
    // Should only display the valid message (malformed messages should be filtered out)
    expect(screen.getByText('Valid message')).toBeInTheDocument();
    // Should only show one Bot badge for the valid message
    expect(screen.getAllByText('Bot')).toHaveLength(1);
    // Should only show one User badge (none for malformed messages)
    expect(screen.queryAllByText('User')).toHaveLength(0);
  });

  it('preserves message order and displays correct timestamps', () => {
    const sessionWithOrderedMessages: SessionWithTranscript[] = [{
      session_id: 'test_session',
      user_id: 'user_123',
      start_time: '2025-07-21T10:00:00.000Z',
      end_time: '2025-07-21T10:05:00.000Z',
      containment_type: 'selfService',
      tags: [],
      metrics: { total_messages: 3, user_messages: 2, bot_messages: 1 },
      messages: [
        {
          timestamp: '2025-07-21T10:00:00.000Z',
          message_type: 'user',
          message: 'First message'
        },
        {
          timestamp: '2025-07-21T10:01:00.000Z',
          message_type: 'bot',
          message: 'Second message'
        },
        {
          timestamp: '2025-07-21T10:02:00.000Z',
          message_type: 'user',
          message: 'Third message'
        }
      ],
      duration_seconds: 300,
      message_count: 3,
      user_message_count: 2,
      bot_message_count: 1
    }];

    render(<SessionDetailsDialog 
      isOpen={true}
      onClose={jest.fn()}
      sessions={sessionWithOrderedMessages}
      currentSessionIndex={0}
      onNavigate={jest.fn()}
    />);

    // Check that messages appear in the correct order
    const messages = screen.getAllByText(/First message|Second message|Third message/);
    expect(messages[0]).toHaveTextContent('First message');
    expect(messages[1]).toHaveTextContent('Second message');
    expect(messages[2]).toHaveTextContent('Third message');
    
    // Check timestamps
    expect(screen.getByText('06:00:00 AM')).toBeInTheDocument(); // 10:00 UTC -> 06:00 AM ET
    expect(screen.getByText('06:01:00 AM')).toBeInTheDocument(); // 10:01 UTC -> 06:01 AM ET  
    expect(screen.getByText('06:02:00 AM')).toBeInTheDocument(); // 10:02 UTC -> 06:02 AM ET
  });

  // Test to reproduce the actual reported issues
  it('reproduces the "No messages in this session" issue with real backend data structure', () => {
    // This test uses the exact data structure from mockDataService.ts to reproduce the issue
    const realBackendSession: SessionWithTranscript[] = [{
      session_id: 'session_1737661200000_0',
      user_id: 'user_123',
      start_time: '2025-07-21T14:00:00.000Z',
      end_time: '2025-07-21T14:15:30.000Z',
      containment_type: 'selfService',
      tags: ['Claim Status', 'Contained'],
      metrics: {
        total_messages: 8,
        user_messages: 4,
        bot_messages: 4
      },
      messages: [
        {
          timestamp: '2025-07-21T14:00:00.000Z',
          message_type: 'user',
          message: 'I need to check the status of my claim'
        },
        {
          timestamp: '2025-07-21T14:00:30.000Z',
          message_type: 'bot',
          message: 'I can help you check your claim status. Please provide your claim number.'
        },
        {
          timestamp: '2025-07-21T14:01:00.000Z',
          message_type: 'user',
          message: 'My claim number is 123456789'
        },
        {
          timestamp: '2025-07-21T14:01:30.000Z',
          message_type: 'bot',
          message: 'Thank you. Let me look up your claim. I found claim 123456789. The status is currently "Under Review" and was submitted on 2024-01-15.'
        }
      ],
      duration_seconds: 930, // 15 minutes 30 seconds
      message_count: 4,
      user_message_count: 2,
      bot_message_count: 2
    }];

    render(<SessionDetailsDialog 
      isOpen={true}
      onClose={jest.fn()}
      sessions={realBackendSession}
      currentSessionIndex={0}
      onNavigate={jest.fn()}
    />);

    // This should show messages, not "No messages"
    expect(screen.getByText('Conversation')).toBeInTheDocument();
    
    // If we see "No messages in this session", the issue is reproduced
    const noMessagesText = screen.queryByText('No messages in this session.');
    if (noMessagesText) {
      console.log('BUG REPRODUCED: "No messages in this session" appears despite valid messages array');
    }
    
    // These should appear but may not due to the bug
    const firstMessage = screen.queryByText('I need to check the status of my claim');
    const secondMessage = screen.queryByText('I can help you check your claim status. Please provide your claim number.');
    
    if (!firstMessage || !secondMessage) {
      console.log('BUG CONFIRMED: Messages not displaying despite valid data structure');
    }
    
    // This test will fail if the bug exists, helping us identify the issue
    expect(screen.queryByText('No messages in this session.')).not.toBeInTheDocument();
    expect(screen.getByText('I need to check the status of my claim')).toBeInTheDocument();
  });

  it('reproduces the duration showing N/A issue with real backend data', () => {
    // Test with the exact data structure from mockDataService.ts
    const sessionWithDuration: SessionWithTranscript[] = [{
      session_id: 'session_duration_test',
      user_id: 'user_456',
      start_time: '2025-07-21T14:00:00.000Z',
      end_time: '2025-07-21T14:15:30.000Z',
      containment_type: 'agent',
      tags: ['Test'],
      metrics: { total_messages: 2, user_messages: 1, bot_messages: 1 },
      messages: [],
      duration_seconds: 930, // This should show as "15m 30s"
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1
    }];

    render(<SessionDetailsDialog 
      isOpen={true}
      onClose={jest.fn()}
      sessions={sessionWithDuration}
      currentSessionIndex={0}
      onNavigate={jest.fn()}
    />);

    // Check if duration shows as "N/A" (the bug) or correctly as "15m 30s"
    const duration = screen.getByText('Duration').parentElement?.nextElementSibling;
    const durationText = duration?.textContent;
    
    if (durationText === 'N/A') {
      console.log('BUG REPRODUCED: Duration shows N/A despite duration_seconds: 930');
    }
    
    // This test will fail if the bug exists
    expect(screen.getByText('15m 30s')).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });

  // Test the exact scenario that might be happening in production
  it('calculates duration from start/end times when duration_seconds is null', () => {
    const sessionWithNullDuration: SessionWithTranscript[] = [{
      session_id: 'session_null_duration',
      user_id: 'user_456', 
      start_time: '2025-07-21T14:00:00.000Z',
      end_time: '2025-07-21T14:15:30.000Z', // 15 minutes 30 seconds later
      containment_type: 'selfService',
      tags: ['Test'],
      metrics: { total_messages: 2, user_messages: 1, bot_messages: 1 },
      messages: [
        {
          timestamp: '2025-07-21T14:00:00.000Z',
          message_type: 'user',
          message: 'Test message'
        }
      ],
      duration_seconds: null as any, // This might be what's coming from backend
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1
    }];

    render(<SessionDetailsDialog 
      isOpen={true}
      onClose={jest.fn()}
      sessions={sessionWithNullDuration}
      currentSessionIndex={0}
      onNavigate={jest.fn()}
    />);

    // Fixed: Should calculate duration from start/end times (15m 30s), not show N/A
    expect(screen.getByText('15m 30s')).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
    // Should still show the message
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  // Test what happens if messages array contains different data structure than expected
  it('reproduces message display issue with actual Kore.ai response structure', () => {
    const sessionWithKoreStructure: SessionWithTranscript[] = [{
      session_id: 'kore_session_123',
      user_id: 'user_456',
      start_time: '2025-07-21T14:00:00.000Z', 
      end_time: '2025-07-21T14:15:30.000Z',
      containment_type: 'selfService',
      tags: ['Test'],
      metrics: { total_messages: 2, user_messages: 1, bot_messages: 1 },
      messages: [
        // What if the backend is returning empty messages or malformed structure?
        {
          timestamp: '',  // Empty timestamp
          message_type: 'user' as any,
          message: 'Test message'
        },
        {
          timestamp: '2025-07-21T14:00:30.000Z',
          message_type: '' as any,  // Empty message_type
          message: 'Bot response'
        },
        {
          timestamp: '2025-07-21T14:01:00.000Z',
          message_type: 'user' as any,
          message: ''  // Empty message
        }
      ] as any,
      duration_seconds: 930,
      message_count: 3,
      user_message_count: 2,
      bot_message_count: 1
    }];

    render(<SessionDetailsDialog 
      isOpen={true}
      onClose={jest.fn()}
      sessions={sessionWithKoreStructure}
      currentSessionIndex={0}
      onNavigate={jest.fn()}
    />);

    // With malformed messages, should show "No messages" because validation filters them out
    expect(screen.getByText('No messages in this session.')).toBeInTheDocument();
    // But duration should work
    expect(screen.getByText('15m 30s')).toBeInTheDocument();
  });

  // Test that fixes work correctly
  it('fixes both duration and message display issues', () => {
    const sessionWithFixes: SessionWithTranscript[] = [{
      session_id: 'fixed_session',
      user_id: 'user_456',
      start_time: '2025-07-21T14:00:00.000Z',
      end_time: '2025-07-21T14:00:30.000Z',
      containment_type: 'selfService',
      tags: ['Test'],
      metrics: { total_messages: 2, user_messages: 1, bot_messages: 1 },
      messages: [
        {
          timestamp: '2025-07-21T14:00:00.000Z',
          message_type: 'user',
          message: 'Valid user message'
        },
        {
          timestamp: '2025-07-21T14:00:15.000Z',
          message_type: 'bot',
          message: 'Valid bot message'
        }
      ],
      duration_seconds: 30, // 30 seconds - should show as "30s"
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1
    }];

    render(<SessionDetailsDialog 
      isOpen={true}
      onClose={jest.fn()}
      sessions={sessionWithFixes}
      currentSessionIndex={0}
      onNavigate={jest.fn()}
    />);

    // Both messages should display
    expect(screen.getByText('Valid user message')).toBeInTheDocument();
    expect(screen.getByText('Valid bot message')).toBeInTheDocument();
    expect(screen.queryByText('No messages in this session.')).not.toBeInTheDocument();

    // Duration should show correctly (30 seconds)
    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });

  it('handles zero duration correctly (should show 0s, not N/A)', () => {
    const sessionWithZeroDuration: SessionWithTranscript[] = [{
      session_id: 'zero_duration_session',
      user_id: 'user_456',
      start_time: '2025-07-21T14:00:00.000Z',
      end_time: '2025-07-21T14:00:00.000Z',
      containment_type: 'selfService',
      tags: ['Test'],
      metrics: { total_messages: 1, user_messages: 1, bot_messages: 0 },
      messages: [
        {
          timestamp: '2025-07-21T14:00:00.000Z',
          message_type: 'user',
          message: 'Quick message'
        }
      ],
      duration_seconds: 0, // Zero duration should show as "0s"
      message_count: 1,
      user_message_count: 1,
      bot_message_count: 0
    }];

    render(<SessionDetailsDialog 
      isOpen={true}
      onClose={jest.fn()}
      sessions={sessionWithZeroDuration}
      currentSessionIndex={0}
      onNavigate={jest.fn()}
    />);

    // Zero duration should show as "0s", not "N/A"
    expect(screen.getByText('0s')).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });
});