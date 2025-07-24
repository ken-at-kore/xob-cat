/**
 * SessionDetailsDialog Data Handling Tests
 * 
 * Tests for message display, data formatting, edge cases, and
 * reproduction of real-world backend data issues.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { SessionDetailsDialog } from '../SessionDetailsDialog';
import { SessionWithTranscript } from '@/shared/types';
import { setupMocks } from '../SessionDetailsDialog.testUtils';

describe('SessionDetailsDialog - Data Handling', () => {
  beforeEach(() => {
    setupMocks();
  });

  describe('Message display edge cases', () => {
    it('handles sessions with empty messages array', () => {
      const sessionsWithEmptyMessages: SessionWithTranscript[] = [{
        session_id: 'empty_session',
        user_id: 'user_456',
        start_time: '2025-07-21T10:00:00.000Z',
        end_time: '2025-07-21T10:05:00.000Z',
        containment_type: 'selfService',
        tags: [],
        metrics: { total_messages: 0, user_messages: 0, bot_messages: 0 },
        messages: [],
        duration_seconds: 300,
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0
      }];
      
      render(<SessionDetailsDialog 
        isOpen={true}
        onClose={jest.fn()}
        sessions={sessionsWithEmptyMessages}
        currentSessionIndex={0}
        onNavigate={jest.fn()}
      />);
      
      expect(screen.getByText('Conversation')).toBeInTheDocument();
      expect(screen.getByText('No messages in this session.')).toBeInTheDocument();
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
      
      // Check timestamps are displayed (format depends on implementation)
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Real backend data issue reproduction', () => {
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
  });

  describe('Duration formatting edge cases', () => {
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

  describe('Integration test for fixes', () => {
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
  });
});