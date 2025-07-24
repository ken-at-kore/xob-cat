/**
 * Shared test utilities for SessionDetailsDialog tests
 */

import { SessionWithTranscript } from '@/shared/types';

export const mockSessions: SessionWithTranscript[] = [
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

export const defaultProps = {
  isOpen: false,
  onClose: jest.fn(),
  sessions: mockSessions,
  currentSessionIndex: 0,
  onNavigate: jest.fn()
};

export const setupMocks = () => {
  jest.clearAllMocks();
};