/**
 * SWTBuilder Unit Tests
 * 
 * Tests for SWT model building, message creation, grouping,
 * and conversation summary functionality.
 */

import { SWTBuilder } from '../../models/swtModels';

describe('SWTBuilder', () => {
  describe('createMessage', () => {
    it('should create message from valid message data', () => {
      const rawMessage = {
        createdOn: '2025-07-20T10:01:00Z',
        type: 'incoming',
        components: [{ cT: 'text', data: { text: 'Hello, world!' } }]
      };

      const message = SWTBuilder.createMessage(rawMessage);

      expect(message).not.toBeNull();
      expect(message!.timestamp).toBe('2025-07-20T10:01:00Z');
      expect(message!.message_type).toBe('user');
      expect(message!.message).toBe('Hello, world!');
    });

    it('should return null for message without text content', () => {
      const rawMessage = {
        createdOn: '2025-07-20T10:01:00Z',
        type: 'incoming',
        components: [{ cT: 'image', data: { url: 'image.jpg' } }]
      };

      const message = SWTBuilder.createMessage(rawMessage);

      expect(message).toBeNull();
    });

    it('should handle message without components', () => {
      const rawMessage = {
        createdOn: '2025-07-20T10:01:00Z',
        type: 'incoming',
        components: []
      };

      const message = SWTBuilder.createMessage(rawMessage);

      expect(message).toBeNull();
    });
  });

  describe('createSWT', () => {
    it('should create SWT with computed metrics', () => {
      const session = {
        sessionId: 'session-1',
        userId: 'user-1',
        start_time: '2025-07-20T10:00:00Z',
        end_time: '2025-07-20T10:05:00Z',
        containment_type: 'selfService',
        tags: ['tag1'],
        metrics: { score: 0.8 }
      };

      const messages = [
        {
          createdOn: '2025-07-20T10:01:00Z',
          type: 'incoming',
          components: [{ cT: 'text', data: { text: 'Hello' } }]
        },
        {
          createdOn: '2025-07-20T10:02:00Z',
          type: 'outgoing',
          components: [{ cT: 'text', data: { text: 'Hi there!' } }]
        }
      ];

      const swt = SWTBuilder.createSWT(session, messages);

      expect(swt.session_id).toBe('session-1');
      expect(swt.user_id).toBe('user-1');
      expect(swt.message_count).toBe(2);
      expect(swt.user_message_count).toBe(1);
      expect(swt.bot_message_count).toBe(1);
      expect(swt.duration_seconds).toBe(300);
             expect(swt.messages).toHaveLength(2);
       expect(swt.messages[0]!.message).toBe('Hello');
       expect(swt.messages[1]!.message).toBe('Hi there!');
    });

    it('should handle invalid duration timestamps', () => {
      const session = {
        sessionId: 'session-1',
        userId: 'user-1',
        start_time: 'invalid-time',
        end_time: 'also-invalid',
        containment_type: 'selfService',
        tags: [],
        metrics: {}
      };

             const messages: any[] = [];

      const swt = SWTBuilder.createSWT(session, messages);

      expect(swt.duration_seconds).toBeNull();
    });
  });

  describe('groupMessagesBySession', () => {
    it('should group messages by session ID', () => {
      const messages = [
        { sessionId: 'session-1', message: 'Hello' },
        { sessionId: 'session-1', message: 'Hi' },
        { sessionId: 'session-2', message: 'Help' },
        { sessionId: 'session-1', message: 'Bye' }
      ];

      const grouped = SWTBuilder.groupMessagesBySession(messages);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['session-1']).toHaveLength(3);
      expect(grouped['session-2']).toHaveLength(1);
    });

    it('should handle messages without session ID', () => {
      const messages = [
        { sessionId: 'session-1', message: 'Hello' },
        { message: 'No session' },
        { sessionId: 'session-2', message: 'Help' }
      ];

      const grouped = SWTBuilder.groupMessagesBySession(messages);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['session-1']).toHaveLength(1);
      expect(grouped['session-2']).toHaveLength(1);
    });
  });

  describe('getConversationSummary', () => {
    it('should generate summary for SWT with messages', () => {
      const swt = {
        session_id: 'session-1',
        user_id: 'user-1',
        start_time: '2025-07-20T10:00:00Z',
        end_time: '2025-07-20T10:05:00Z',
        containment_type: 'selfService' as const,
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2025-07-20T10:01:00Z', message_type: 'user' as const, message: 'Hello' },
          { timestamp: '2025-07-20T10:02:00Z', message_type: 'bot' as const, message: 'Hi there!' }
        ],
        duration_seconds: 300,
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      };

      const summary = SWTBuilder.getConversationSummary(swt);

      expect(summary).toBe('Session with 2 messages (1 user, 1 bot)');
    });

    it('should handle SWT without messages', () => {
      const swt = {
        session_id: 'session-1',
        user_id: 'user-1',
        start_time: '2025-07-20T10:00:00Z',
        end_time: '2025-07-20T10:05:00Z',
        containment_type: 'selfService' as const,
        tags: [],
        metrics: {},
        messages: [],
        duration_seconds: 300,
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0
      };

      const summary = SWTBuilder.getConversationSummary(swt);

      expect(summary).toBe('No messages in this session');
    });
  });
});