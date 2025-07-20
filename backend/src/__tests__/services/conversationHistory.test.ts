import { jest } from '@jest/globals';
import { createKoreApiService, KoreApiConfig } from '../../services/koreApiService';

// Mock the config manager
jest.mock('../../utils/configManager', () => ({
  configManager: {
    getKoreConfig: jest.fn(),
  }
}));

// Mock axios
const mockAxios = {
  post: jest.fn(),
  isAxiosError: jest.fn(),
};

jest.mock('axios', () => ({
  default: mockAxios
}));

describe('Conversation History Retrieval', () => {
  const mockKoreConfig = {
    bot_id: 'test-bot-id',
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    base_url: 'https://bots.kore.ai',
    name: 'Test Bot'
  };

  const mockKoreMessages = [
    {
      sessionId: 'session-123',
      createdBy: 'user-456',
      createdOn: '2025-01-01T10:00:00Z',
      type: 'incoming',
      timestampValue: 1704110400000,
      components: [{ cT: 'text', data: { text: 'I need help with my bill' } }]
    },
    {
      sessionId: 'session-123',
      createdBy: 'bot',
      createdOn: '2025-01-01T10:00:05Z',
      type: 'outgoing',
      timestampValue: 1704110405000,
      components: [{ cT: 'text', data: { text: 'I can help you with billing. Please provide your member ID.' } }]
    },
    {
      sessionId: 'session-123',
      createdBy: 'user-456',
      createdOn: '2025-01-01T10:00:10Z',
      type: 'incoming',
      timestampValue: 1704110410000,
      components: [{ cT: 'text', data: { text: 'My member ID is MEM123456' } }]
    },
    {
      sessionId: 'session-123',
      createdBy: 'bot',
      createdOn: '2025-01-01T10:00:15Z',
      type: 'outgoing',
      timestampValue: 1704110415000,
      components: [{ cT: 'text', data: { text: 'Thank you. Let me look up your account.' } }]
    }
  ];

  const mockKoreSessions = [
    {
      sessionId: 'session-123',
      userId: 'user-456',
      start_time: '2025-01-01T10:00:00Z',
      end_time: '2025-01-01T10:05:00Z',
      containment_type: 'agent',
      tags: [],
      metrics: {
        total_messages: 4,
        user_messages: 2,
        bot_messages: 2
      },
      messages: [],
      duration_seconds: 300,
      message_count: 4,
      user_message_count: 2,
      bot_message_count: 2
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.post.mockReset();
    mockAxios.isAxiosError.mockReturnValue(false);
  });

  describe('Message Retrieval', () => {
    it('should retrieve conversation messages from Kore.ai API', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      (mockAxios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          messages: mockKoreMessages,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://bots.kore.ai/api/public/bot/test-bot-id/getMessagesV2',
        {
          skip: 0,
          limit: 10000,
          dateFrom: '2025-01-01T00:00:00Z',
          dateTo: '2025-01-02T00:00:00Z'
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'auth': expect.any(String)
          })
        })
      );

      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBe(4);
      
      // Verify message structure
      expect(messages[0]).toEqual({
        timestamp: '2025-01-01T10:00:00Z',
        message_type: 'user',
        message: 'I need help with my bill'
      });
      expect(messages[1]).toEqual({
        timestamp: '2025-01-01T10:00:05Z',
        message_type: 'bot',
        message: 'I can help you with billing. Please provide your member ID.'
      });
    });

    it('should handle pagination for large message datasets', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      // First call returns messages with moreAvailable: true
      (mockAxios.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          messages: mockKoreMessages.slice(0, 2),
          moreAvailable: true
        }
      });
      
      // Second call returns remaining messages with moreAvailable: false
      (mockAxios.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          messages: mockKoreMessages.slice(2),
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      expect(mockAxios.post).toHaveBeenCalledTimes(2);
      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBe(4);
    });

    it('should filter messages by session IDs', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const axios = require('axios').default;
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          messages: mockKoreMessages,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const sessionIds = ['session-123', 'session-456'];
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z', sessionIds);

      expect(axios.post).toHaveBeenCalledWith(
        'https://bots.kore.ai/api/public/bot/test-bot-id/getMessagesV2',
        {
          skip: 0,
          limit: 10000,
          dateFrom: '2025-01-01T00:00:00Z',
          dateTo: '2025-01-02T00:00:00Z',
          sessionId: sessionIds
        },
        expect.any(Object)
      );

      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBe(4);
    });

    it('should handle rate limiting gracefully', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const axios = require('axios').default;
      
      // First call returns 429 (rate limit)
      axios.post.mockRejectedValueOnce({
        response: { status: 429 }
      });
      
      // Second call succeeds
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          messages: mockKoreMessages,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBe(4);
    });

    it('should extract text content from message components', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const messagesWithComplexComponents = [
        {
          sessionId: 'session-123',
          createdBy: 'user-456',
          createdOn: '2025-01-01T10:00:00Z',
          type: 'incoming',
          timestampValue: 1704110400000,
          components: [
            { cT: 'image', data: { url: 'https://example.com/image.jpg' } },
            { cT: 'text', data: { text: 'I need help with my bill' } },
            { cT: 'button', data: { label: 'Click me' } }
          ]
        }
      ];

      const axios = require('axios').default;
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          messages: messagesWithComplexComponents,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBe(1);
      expect(messages[0].message).toBe('I need help with my bill');
    });

    it('should filter out messages without text content', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const messagesWithoutText = [
        {
          sessionId: 'session-123',
          createdBy: 'user-456',
          createdOn: '2025-01-01T10:00:00Z',
          type: 'incoming',
          timestampValue: 1704110400000,
          components: [
            { cT: 'image', data: { url: 'https://example.com/image.jpg' } },
            { cT: 'button', data: { label: 'Click me' } }
          ]
        },
        {
          sessionId: 'session-123',
          createdBy: 'bot',
          createdOn: '2025-01-01T10:00:05Z',
          type: 'outgoing',
          timestampValue: 1704110405000,
          components: [
            { cT: 'text', data: { text: 'I can help you with billing.' } }
          ]
        }
      ];

      const axios = require('axios').default;
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          messages: messagesWithoutText,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBe(1); // Only the message with text content
      expect(messages[0].message).toBe('I can help you with billing.');
    });
  });

  describe('Session Message Retrieval', () => {
    it('should retrieve messages for a specific session', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const axios = require('axios').default;
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          messages: mockKoreMessages,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getSessionMessages('session-123');

      expect(axios.post).toHaveBeenCalledWith(
        'https://bots.kore.ai/api/public/bot/test-bot-id/getMessagesV2',
        {
          skip: 0,
          limit: 10000,
          dateFrom: expect.any(String),
          dateTo: expect.any(String),
          sessionId: ['session-123']
        },
        expect.any(Object)
      );

      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBe(4);
    });
  });

  describe('Conversation Flow Analysis', () => {
    it('should maintain chronological order of messages', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const axios = require('axios').default;
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          messages: mockKoreMessages,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      // Verify chronological order
      for (let i = 0; i < messages.length - 1; i++) {
        const currentTime = new Date(messages[i].timestamp).getTime();
        const nextTime = new Date(messages[i + 1].timestamp).getTime();
        expect(currentTime).toBeLessThanOrEqual(nextTime);
      }
    });

    it('should identify user and bot messages correctly', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const axios = require('axios').default;
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          messages: mockKoreMessages,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      const userMessages = messages.filter(m => m.message_type === 'user');
      const botMessages = messages.filter(m => m.message_type === 'bot');

      expect(userMessages.length).toBe(2);
      expect(botMessages.length).toBe(2);
      expect(userMessages[0].message).toBe('I need help with my bill');
      expect(botMessages[0].message).toBe('I can help you with billing. Please provide your member ID.');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const axios = require('axios').default;
      axios.post.mockRejectedValue(new Error('API Error'));

      const service = createKoreApiService(config);
      
      await expect(service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z'))
        .rejects.toThrow('API Error');
    });

    it('should handle empty message responses', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const axios = require('axios').default;
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          messages: [],
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      expect(messages).toEqual([]);
    });

    it('should handle malformed message data', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const malformedMessages = [
        {
          sessionId: 'session-123',
          createdBy: 'user-456',
          createdOn: '2025-01-01T10:00:00Z',
          type: 'incoming',
          timestampValue: 1704110400000,
          components: [] // No text component
        },
        {
          sessionId: 'session-123',
          createdBy: 'bot',
          createdOn: '2025-01-01T10:00:05Z',
          type: 'outgoing',
          timestampValue: 1704110405000,
          components: [{ cT: 'text', data: { text: 'Valid message' } }]
        }
      ];

      const axios = require('axios').default;
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          messages: malformedMessages,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBe(1); // Only the valid message
      expect(messages[0].message).toBe('Valid message');
    });
  });

  describe('Performance and Rate Limiting', () => {
    it('should implement proper rate limiting', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const axios = require('axios').default;
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          messages: mockKoreMessages,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const startTime = Date.now();
      
      await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (not waiting for rate limits)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle large message datasets efficiently', async () => {
      const config: KoreApiConfig = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };

      const largeMessageSet = Array.from({ length: 100 }, (_, i) => ({
        sessionId: `session-${i}`,
        createdBy: i % 2 === 0 ? 'user-456' : 'bot',
        createdOn: new Date(2025, 0, 1, 10, 0, i).toISOString(),
        type: i % 2 === 0 ? 'incoming' : 'outgoing',
        timestampValue: 1704110400000 + i * 1000,
        components: [{ cT: 'text', data: { text: `Message ${i}` } }]
      }));

      const axios = require('axios').default;
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          messages: largeMessageSet,
          moreAvailable: false
        }
      });

      const service = createKoreApiService(config);
      const messages = await service.getMessages('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBe(100);
      
      // Verify all messages were processed
      messages.forEach((message, index) => {
        expect(message.message).toBe(`Message ${index}`);
      });
    });
  });
}); 