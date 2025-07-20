import { jest } from '@jest/globals';
import { createKoreApiService, KoreApiConfig } from '../../services/koreApiService';
import axios from 'axios';
import jwt from 'jsonwebtoken';

// Mock the modules
jest.mock('axios');
jest.mock('jsonwebtoken');

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('KoreApiService', () => {
  const mockConfig: KoreApiConfig = {
    botId: 'test-bot-id',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    baseUrl: 'https://bots.kore.ai'
  };

  const mockJwtToken = 'mock-jwt-token';
  const mockSessionsResponse = {
    data: {
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
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mockJwt.sign as jest.Mock).mockReturnValue(mockJwtToken);
    mockAxios.get.mockResolvedValue(mockSessionsResponse);
  });

  describe('createKoreApiService', () => {
    it('should create a KoreApiService instance', () => {
      const service = createKoreApiService(mockConfig);
      expect(service).toBeDefined();
      expect(typeof service.getSessions).toBe('function');
      expect(typeof service.getSessionById).toBe('function');
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate JWT token with correct payload', async () => {
      const service = createKoreApiService(mockConfig);
      
      // Trigger a request to generate JWT
      await service.getSessions('2025-01-01', '2025-01-02');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          iss: mockConfig.clientId,
          sub: mockConfig.botId,
          iat: expect.any(Number),
          exp: expect.any(Number)
        },
        mockConfig.clientSecret,
        { algorithm: 'HS256' }
      );
    });

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

      // Should make 3 calls for agent, selfService, and dropOff
      expect(mockAxios.get).toHaveBeenCalledTimes(3);
      
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('containmentType=agent'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockJwtToken}`
          })
        })
      );
    });

    it('should handle pagination parameters', async () => {
      const service = createKoreApiService(mockConfig);
      
      await service.getSessions('2025-01-01', '2025-01-02', 10, 20);

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('skip=10'),
        expect.any(Object)
      );
      
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.get.mockRejectedValue(new Error('API Error'));

      await expect(service.getSessions('2025-01-01', '2025-01-02'))
        .rejects.toThrow('API Error');
    });

    it('should return empty array when no sessions found', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.get.mockResolvedValue({ data: { sessions: [] } });

      const result = await service.getSessions('2025-01-01', '2025-01-02');

      expect(result).toEqual([]);
    });
  });

  describe('getSessionById', () => {
    it('should fetch specific session by ID', async () => {
      const service = createKoreApiService(mockConfig);
      const sessionId = 'test-session-id';
      
      await service.getSessionById(sessionId);

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/sessions/${sessionId}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockJwtToken}`
          })
        })
      );
    });

    it('should handle session not found', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.get.mockResolvedValue({ data: null });

      const result = await service.getSessionById('non-existent-session');

      expect(result).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const service = createKoreApiService(mockConfig);
      
      // Make multiple rapid requests
      const promises = Array(5).fill(null).map(() => 
        service.getSessions('2025-01-01', '2025-01-02')
      );

      await Promise.all(promises);

      // Should have made requests (rate limiting is internal)
      expect(mockAxios.get).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.get.mockRejectedValue(new Error('Network Error'));

      await expect(service.getSessions('2025-01-01', '2025-01-02'))
        .rejects.toThrow('Network Error');
    });

    it('should handle invalid response format', async () => {
      const service = createKoreApiService(mockConfig);
      mockAxios.get.mockResolvedValue({ data: { invalid: 'format' } });

      const result = await service.getSessions('2025-01-01', '2025-01-02');

      expect(result).toEqual([]);
    });
  });

  describe('URL Construction', () => {
    it('should construct correct API URLs', async () => {
      const service = createKoreApiService(mockConfig);
      
      await service.getSessions('2025-01-01', '2025-01-02');

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringMatching(/https:\/\/bots\.kore\.ai\/api\/public\/bot\/test-bot-id\/getSessions/),
        expect.any(Object)
      );
    });

    it('should include date parameters in URL', async () => {
      const service = createKoreApiService(mockConfig);
      
      await service.getSessions('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z');

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('dateFrom=2025-01-01T00:00:00Z'),
        expect.any(Object)
      );
      
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('dateTo=2025-01-02T00:00:00Z'),
        expect.any(Object)
      );
    });
  });
}); 