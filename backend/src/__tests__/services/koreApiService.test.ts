import { jest } from '@jest/globals';
import { createKoreApiService, KoreApiConfig } from '../../services/koreApiService';
import axios from 'axios';

// Mock the modules
jest.mock('axios');

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('KoreApiService', () => {
  const mockConfig: KoreApiConfig = {
    botId: 'test-bot-id',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    baseUrl: 'https://bots.kore.ai'
  };

  const mockSessionsResponse = {
    sessions: [
      {
        sessionId: 'session-1',
        userId: 'user-1',
        start_time: '2025-01-01T00:00:00Z',
        end_time: '2025-01-01T00:01:00Z',
        containment_type: 'agent',
        tags: { userTags: [], sessionTags: [] },
        messages: []
      }
    ]
  };

  const mockMessagesResponse = {
    messages: [
      {
        sessionId: 'session-1',
        createdBy: 'user-1',
        createdOn: '2025-01-01T00:00:30Z',
        type: 'incoming',
        timestampValue: 1735689630000,
        components: [
          {
            cT: 'text',
            data: { text: 'Hello' }
          }
        ]
      }
    ],
    moreAvailable: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.post.mockResolvedValue({ status: 200, data: mockSessionsResponse });
  });

  describe('createKoreApiService', () => {
    it('should create a KoreApiService instance', () => {
      const service = createKoreApiService(mockConfig);
      expect(service).toBeDefined();
      expect(typeof service.getSessions).toBe('function');
      expect(typeof service.getSessionById).toBe('function');
    });
  });

  describe('Configuration', () => {
    it('should use default base URL when not provided', () => {
      const configWithoutBaseUrl = {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      };

      const service = createKoreApiService(configWithoutBaseUrl);
      expect(service).toBeDefined();
    });
  });

  describe('getSessions', () => {
    it('should fetch sessions for all containment types', async () => {
      const service = createKoreApiService(mockConfig);
      
      await service.getSessions('2025-01-01', '2025-01-02');

      // Should make 3 POST calls for agent, selfService, and dropOff
      expect(mockAxios.post).toHaveBeenCalledTimes(3);
      
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('containmentType=agent'),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle pagination parameters', async () => {
      const service = createKoreApiService(mockConfig);
      
      await service.getSessions('2025-01-01', '2025-01-02', 10, 20);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          skip: 10,
          limit: 20
        }),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.post.mockRejectedValue(new Error('API Error'));

      // Service should return empty array when all containment types fail
      const result = await service.getSessions('2025-01-01', '2025-01-02');
      expect(result).toEqual([]);
    });

    it('should return empty array when no sessions found', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.post.mockResolvedValue({ status: 200, data: { sessions: [] } });

      const result = await service.getSessions('2025-01-01', '2025-01-02');

      expect(result).toEqual([]);
    });
  });

  describe('getMessages', () => {
    it('should fetch messages with correct parameters', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.post.mockResolvedValue({ status: 200, data: mockMessagesResponse });
      
      await service.getMessages('2025-01-01', '2025-01-02');

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/getMessagesV2'),
        expect.objectContaining({
          dateFrom: '2025-01-01',
          dateTo: '2025-01-02'
        }),
        expect.any(Object)
      );
    });

    it('should handle session ID filtering', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.post.mockResolvedValue({ status: 200, data: mockMessagesResponse });
      
      await service.getMessages('2025-01-01', '2025-01-02', ['session-1']);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          sessionId: ['session-1']
        }),
        expect.any(Object)
      );
    });
  });

  describe('getSessionById', () => {
    it('should fetch specific session by ID', async () => {
      const service = createKoreApiService(mockConfig);
      const sessionId = 'test-session-id';
      
      await service.getSessionById(sessionId);

      // Should make a call to getSessions with broad date range
      expect(mockAxios.post).toHaveBeenCalled();
    });

    it('should handle session not found', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.post.mockResolvedValue({ status: 200, data: { sessions: [] } });

      const result = await service.getSessionById('non-existent-session');

      expect(result).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const service = createKoreApiService(mockConfig);
      
      // Make multiple rapid requests
      const promises = Array(3).fill(null).map(() => 
        service.getSessions('2025-01-01', '2025-01-02')
      );

      await Promise.all(promises);

      // Should have made requests (rate limiting is internal)
      expect(mockAxios.post).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.post.mockRejectedValue(new Error('Network Error'));

      // Service should return empty array when all containment types fail
      const result = await service.getSessions('2025-01-01', '2025-01-02');
      expect(result).toEqual([]);
    });

    it('should handle invalid response format', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.post.mockResolvedValue({ status: 200, data: { invalid: 'format' } });

      const result = await service.getSessions('2025-01-01', '2025-01-02');

      expect(result).toEqual([]);
    });
  });

  describe('URL Construction', () => {
    it('should construct correct API URLs', async () => {
      const service = createKoreApiService(mockConfig);
      
      await service.getSessions('2025-01-01', '2025-01-02');

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringMatching(/https:\/\/bots\.kore\.ai\/api\/public\/bot\/test-bot-id\/getSessions/),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should include date parameters in payload', async () => {
      const service = createKoreApiService(mockConfig);
      
      await service.getSessions('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dateFrom: '2025-01-01T00:00:00Z',
          dateTo: '2025-01-02T00:00:00Z'
        }),
        expect.any(Object)
      );
    });
  });

  describe('Message Conversion', () => {
    it('should convert Kore messages to internal format', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.post.mockResolvedValue({ status: 200, data: mockMessagesResponse });
      
      const result = await service.getMessages('2025-01-01', '2025-01-02');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('sessionId');
      expect(result[0]).toHaveProperty('timestamp');
      expect(result[0]).toHaveProperty('message_type');
      expect(result[0]).toHaveProperty('message');
    });
  });
}); 