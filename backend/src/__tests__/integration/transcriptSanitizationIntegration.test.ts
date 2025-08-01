import { KoreApiService } from '../../services/koreApiService';
import { SWTBuilder } from '../../models/swtModels';

describe('Transcript Sanitization Integration', () => {
  describe('KoreApiService integration', () => {
    let service: KoreApiService;

    beforeEach(() => {
      service = new KoreApiService({
        botId: 'test-bot',
        clientId: 'test-client',
        clientSecret: 'test-secret'
      });
    });

    it('should sanitize JSON bot messages when converting', () => {
      const koreMessage = {
        sessionId: 'test-session',
        createdBy: 'bot',
        createdOn: '2025-01-01T10:00:00Z',
        type: 'outgoing' as const,
        timestampValue: 1234567890,
        components: [{
          cT: 'text',
          data: {
            text: JSON.stringify({
              type: 'command',
              data: [{
                say: {
                  text: ['Hello! How can I help you today?']
                }
              }]
            })
          }
        }]
      };

      const result = (service as any).convertKoreMessageToMessage(koreMessage);

      expect(result).toEqual({
        sessionId: 'test-session',
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'bot',
        message: 'Hello! How can I help you today?'
      });
    });

    it('should sanitize SSML tags in messages', () => {
      const koreMessage = {
        sessionId: 'test-session',
        createdBy: 'bot',
        createdOn: '2025-01-01T10:00:00Z',
        type: 'outgoing' as const,
        timestampValue: 1234567890,
        components: [{
          cT: 'text',
          data: {
            text: '<speak><prosody rate="-10%">I can help you with that.</prosody></speak>'
          }
        }]
      };

      const result = (service as any).convertKoreMessageToMessage(koreMessage);

      expect(result).toEqual({
        sessionId: 'test-session',
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'bot',
        message: 'I can help you with that.'
      });
    });

    it('should filter out Welcome Task messages', () => {
      const koreMessage = {
        sessionId: 'test-session',
        createdBy: 'user',
        createdOn: '2025-01-01T10:00:00Z',
        type: 'incoming' as const,
        timestampValue: 1234567890,
        components: [{
          cT: 'text',
          data: {
            text: 'Welcome Task'
          }
        }]
      };

      const result = (service as any).convertKoreMessageToMessage(koreMessage);

      expect(result).toBeNull();
    });

    it('should filter out hangup command JSON messages', () => {
      const hangupMessage = JSON.stringify({
        type: 'command',
        command: 'redirect',
        queueCommand: true,
        data: [
          { verb: 'pause', length: 0.2 },
          { verb: 'hangup', headers: {} }
        ]
      });

      const koreMessage = {
        sessionId: 'test-session',
        createdBy: 'bot',
        createdOn: '2025-01-01T10:00:00Z',
        type: 'outgoing' as const,
        timestampValue: 1234567890,
        components: [{
          cT: 'text',
          data: {
            text: hangupMessage
          }
        }]
      };

      const result = (service as any).convertKoreMessageToMessage(koreMessage);

      expect(result).toBeNull();
    });

    it('should decode HTML entities in messages', () => {
      const koreMessage = {
        sessionId: 'test-session',
        createdBy: 'bot',
        createdOn: '2025-01-01T10:00:00Z',
        type: 'outgoing' as const,
        timestampValue: 1234567890,
        components: [{
          cT: 'text',
          data: {
            text: 'You can say &quot;treatment or appointment&quot;; &quot;episode of incapacity&quot;; or, &quot;something else&quot;.'
          }
        }]
      };

      const result = (service as any).convertKoreMessageToMessage(koreMessage);

      expect(result).toEqual({
        sessionId: 'test-session',
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'bot',
        message: 'You can say "treatment or appointment"; "episode of incapacity"; or, "something else".'
      });
    });

    it('should replace MAX_NO_INPUT user messages', () => {
      const koreMessage = {
        sessionId: 'test-session',
        createdBy: 'user',
        createdOn: '2025-01-01T10:00:00Z',
        type: 'incoming' as const,
        timestampValue: 1234567890,
        components: [{
          cT: 'text',
          data: {
            text: 'MAX_NO_INPUT'
          }
        }]
      };

      const result = (service as any).convertKoreMessageToMessage(koreMessage);

      expect(result).toEqual({
        sessionId: 'test-session',
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'user',
        message: '<User is silent>'
      });
    });
  });

  describe('SWTBuilder integration', () => {
    it('should sanitize messages when creating from already converted messages', () => {
      const rawMessage = {
        message: '<speak>Hello <emphasis>world</emphasis>!</speak>',
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'bot'
      };

      const result = SWTBuilder.createMessage(rawMessage);

      expect(result).toEqual({
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'bot',
        message: 'Hello world!'
      });
    });

    it('should filter out Welcome Task when creating messages', () => {
      const rawMessage = {
        message: 'Welcome Task',
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'user'
      };

      const result = SWTBuilder.createMessage(rawMessage);

      expect(result).toBeNull();
    });

    it('should filter out hangup command messages when creating messages', () => {
      const hangupMessage = JSON.stringify({
        type: 'command',
        command: 'redirect',
        data: [{ verb: 'hangup', headers: {} }]
      });

      const rawMessage = {
        message: hangupMessage,
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'bot'
      };

      const result = SWTBuilder.createMessage(rawMessage);

      expect(result).toBeNull();
    });

    it('should decode HTML entities when creating messages', () => {
      const rawMessage = {
        message: 'Please choose &quot;yes&quot; or &quot;no&quot; &amp; confirm.',
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'bot'
      };

      const result = SWTBuilder.createMessage(rawMessage);

      expect(result).toEqual({
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'bot',
        message: 'Please choose "yes" or "no" & confirm.'
      });
    });

    it('should replace MAX_NO_INPUT when creating messages', () => {
      const rawMessage = {
        message: 'MAX_NO_INPUT',
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'user'
      };

      const result = SWTBuilder.createMessage(rawMessage);

      expect(result).toEqual({
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'user',
        message: '<User is silent>'
      });
    });

    it('should handle combined patterns in raw Kore messages', () => {
      const rawMessage = {
        createdOn: '2025-01-01T10:00:00Z',
        type: 'outgoing',
        components: [{
          cT: 'text',
          data: {
            text: JSON.stringify({
              say: {
                text: '<speak>Welcome to <prosody rate="slow">our service</prosody>!</speak>'
              }
            })
          }
        }]
      };

      const result = SWTBuilder.createMessage(rawMessage);

      expect(result).toEqual({
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'bot',
        message: 'Welcome to our service!'
      });
    });
  });

  describe('End-to-end session creation', () => {
    it('should create clean SWT with sanitized messages', () => {
      const session = {
        session_id: 'test-session',
        user_id: 'test-user',
        start_time: '2025-01-01T10:00:00Z',
        end_time: '2025-01-01T10:05:00Z',
        containment_type: 'selfService' as const
      };

      const messages = [
        {
          message: 'Welcome Task',
          timestamp: '2025-01-01T10:00:00Z',
          message_type: 'user' as const
        },
        {
          message: JSON.stringify({
            data: [{
              say: { text: ['Hello! How can I help?'] }
            }]
          }),
          timestamp: '2025-01-01T10:00:05Z',
          message_type: 'bot' as const
        },
        {
          message: 'I need help with my account',
          timestamp: '2025-01-01T10:00:10Z',
          message_type: 'user' as const
        },
        {
          message: '<speak><prosody rate="-10%">I can help you with that.</prosody></speak>',
          timestamp: '2025-01-01T10:00:15Z',
          message_type: 'bot' as const
        },
        {
          message: JSON.stringify({
            type: 'command',
            command: 'redirect',
            data: [{ verb: 'hangup', headers: {} }]
          }),
          timestamp: '2025-01-01T10:00:20Z',
          message_type: 'bot' as const
        }
      ];

      const swt = SWTBuilder.createSWT(session, messages);

      // Should have filtered out Welcome Task and hangup command, leaving 3 messages
      expect(swt.messages).toHaveLength(3);
      expect(swt.message_count).toBe(3);
      expect(swt.user_message_count).toBe(1);
      expect(swt.bot_message_count).toBe(2);

      // Check sanitized content
      expect(swt.messages[0]?.message).toBe('Hello! How can I help?');
      expect(swt.messages[1]?.message).toBe('I need help with my account');
      expect(swt.messages[2]?.message).toBe('I can help you with that.');
    });
  });
});