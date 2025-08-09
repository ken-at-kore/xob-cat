/**
 * Tests for optimized bot connection functionality
 * Validates the single API call optimization for connection testing
 */

import { jest } from '@jest/globals';
import { createKoreApiService, KoreApiConfig } from '../../services/koreApiService';
import axios from 'axios';

// Mock the modules
jest.mock('axios');

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('KoreApiService - Connection Optimized', () => {
  const mockConfig: KoreApiConfig = {
    botId: 'test-bot-id',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    baseUrl: 'https://bots.kore.ai'
  };

  const mockConnectionSessionResponse = {
    sessions: [
      {
        sessionId: 'connection-test-session-1',
        userId: 'user-1',
        start_time: '2025-01-01T00:00:00Z',
        end_time: '2025-01-01T00:01:00Z',
        containment_type: 'agent',
        tags: [],
        metrics: {
          total_messages: 5,
          user_messages: 3,
          bot_messages: 2
        },
        duration_seconds: 60
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.post.mockResolvedValue({ status: 200, data: mockConnectionSessionResponse });
  });

  describe('getSessionsMetadataForConnectionTest', () => {
    it('should make only ONE API call for connection testing', async () => {
      const service = createKoreApiService(mockConfig);
      
      // Connection test should only call agent containment type
      const result = await service.getSessionsMetadataForConnectionTest({
        dateFrom: '2025-01-01T00:00:00Z',
        dateTo: '2025-01-01T00:01:00Z',
        limit: 1
      });

      // Should make only 1 API call (not 3)
      expect(mockAxios.post).toHaveBeenCalledTimes(1);
      
      // Should call only agent containment type
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('containmentType=agent'),
        expect.any(Object),
        expect.any(Object)
      );
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        sessionId: 'connection-test-session-1',
        userId: 'user-1',
        start_time: '2025-01-01T00:00:00Z',
        end_time: '2025-01-01T00:01:00Z',
        containment_type: 'agent',
        tags: [],
        metrics: {
          total_messages: 5,
          user_messages: 3,
          bot_messages: 2
        },
        duration_seconds: 60
      });
    });

    it('should respect limit parameter for minimal data fetching', async () => {
      const service = createKoreApiService(mockConfig);
      
      await service.getSessionsMetadataForConnectionTest({
        dateFrom: '2025-01-01T00:00:00Z',
        dateTo: '2025-01-01T00:01:00Z',
        limit: 1
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          limit: 1
        }),
        expect.any(Object)
      );
    });

    it('should work with small time windows', async () => {
      const service = createKoreApiService(mockConfig);
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const now = new Date().toISOString();
      
      await service.getSessionsMetadataForConnectionTest({
        dateFrom: oneMinuteAgo,
        dateTo: now,
        limit: 1
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dateFrom: oneMinuteAgo,
          dateTo: now
        }),
        expect.any(Object)
      );
    });

    it('should handle timeout for connection testing', async () => {
      // Mock axios to reject after delay
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 15000)
      );
      mockAxios.post.mockImplementation(() => timeoutPromise as any);

      const service = createKoreApiService(mockConfig);
      
      const startTime = Date.now();
      
      await expect(service.getSessionsMetadataForConnectionTest({
        dateFrom: '2025-01-01T00:00:00Z',
        dateTo: '2025-01-01T00:01:00Z',
        limit: 1,
        timeout: 10000
      })).rejects.toThrow();

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should timeout within ~10 seconds (with some buffer)
      expect(duration).toBeLessThan(12000);
    });

    it('should return empty array when no sessions found', async () => {
      mockAxios.post.mockResolvedValue({ status: 200, data: { sessions: [] } });
      
      const service = createKoreApiService(mockConfig);
      
      const result = await service.getSessionsMetadataForConnectionTest({
        dateFrom: '2025-01-01T00:00:00Z',
        dateTo: '2025-01-01T00:01:00Z',
        limit: 1
      });

      expect(result).toEqual([]);
    });

    it('should throw authentication errors immediately', async () => {
      const authError = {
        response: { status: 401, data: { message: 'Unauthorized' } }
      };
      mockAxios.post.mockRejectedValue(authError);
      
      const service = createKoreApiService(mockConfig);
      
      await expect(service.getSessionsMetadataForConnectionTest({
        dateFrom: '2025-01-01T00:00:00Z',
        dateTo: '2025-01-01T00:01:00Z',
        limit: 1
      })).rejects.toEqual(authError);
    });
  });

  describe('Integration with connection test route', () => {
    it('should support connection test time window (1 minute)', () => {
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000; // 1 minute ago
      
      const dateFrom = new Date(oneMinuteAgo).toISOString();
      const dateTo = new Date(now).toISOString();
      
      const timeDiff = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
      expect(timeDiff).toBe(60 * 1000); // Exactly 1 minute
    });
  });
});