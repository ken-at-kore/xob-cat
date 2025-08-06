/**
 * Test suite for parallel API calls in KoreApiService.getSessionsMetadata()
 * Tests the new concurrent execution of containment type API calls
 */

import { KoreApiService } from '../../services/koreApiService';
import axios from 'axios';

// Mock axios for API calls
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KoreApiService - Parallel API Calls', () => {
  let koreApiService: KoreApiService;
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      botId: 'test-bot-id',
      clientId: 'test-client-id', 
      clientSecret: 'test-client-secret',
      baseUrl: 'https://bots.kore.ai'
    };
    
    koreApiService = new KoreApiService(mockConfig);
  });

  describe('getSessionsMetadata - Parallel Execution', () => {
    it('should execute all 3 containment type API calls in parallel', async () => {
      // Track call timing to verify parallel execution
      const callTimes: number[] = [];
      
      mockedAxios.post.mockImplementation(async (url, payload) => {
        callTimes.push(Date.now());
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          status: 200,
          data: {
            sessions: [{
              sessionId: 'session_1',
              userId: 'user_1',
              start_time: '2025-08-01T15:00:00Z',
              end_time: '2025-08-01T15:10:00Z',
              tags: [],
              metrics: { total_messages: 5, user_messages: 3, bot_messages: 2 },
              duration_seconds: 600
            }]
          }
        };
      });

      const options = {
        dateFrom: '2025-08-01T00:00:00Z',
        dateTo: '2025-08-01T23:59:59Z',
        limit: 100
      };

      const startTime = Date.now();
      const result = await koreApiService.getSessionsMetadata(options);
      const totalTime = Date.now() - startTime;

      // Verify all 3 API calls were made
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      
      // Verify parallel execution - all calls should start within 50ms of each other
      const timeDiffs = callTimes.slice(1).map((time, i) => time - callTimes[i]!);
      expect(Math.max(...timeDiffs)).toBeLessThan(50);
      
      // Verify total execution time is closer to single call duration (not 3x)
      expect(totalTime).toBeLessThan(300); // Should be ~100ms, not ~300ms sequential
      
      // Verify results are combined correctly
      expect(result).toHaveLength(3); // One session per containment type
      expect(result.every(session => session.sessionId === 'session_1')).toBe(true);
    });

    it('should handle partial failures gracefully with Promise.allSettled', async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: {
            sessions: [{
              sessionId: 'success_session',
              userId: 'user_1',
              start_time: '2025-08-01T15:00:00Z',
              end_time: '2025-08-01T15:10:00Z',
              tags: [],
              metrics: { total_messages: 5, user_messages: 3, bot_messages: 2 },
              duration_seconds: 600
            }]
          }
        }) // agent succeeds
        .mockRejectedValueOnce(new Error('Network error')) // selfService fails
        .mockResolvedValueOnce({
          status: 200,
          data: { sessions: [] }
        }); // dropOff succeeds but empty

      const options = {
        dateFrom: '2025-08-01T00:00:00Z',
        dateTo: '2025-08-01T23:59:59Z'
      };

      const result = await koreApiService.getSessionsMetadata(options);

      // Should return successful results despite partial failures
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        sessionId: 'success_session',
        containment_type: 'agent'
      });
      
      // All 3 calls should have been attempted
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    // Note: Auth error propagation tested in integration tests
    // Complex to mock due to makeRequest method's error handling

    it('should handle all containment types failing', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Service unavailable'));

      const options = {
        dateFrom: '2025-08-01T00:00:00Z',
        dateTo: '2025-08-01T23:59:59Z'
      };

      // Should return empty array when all calls fail
      const result = await koreApiService.getSessionsMetadata(options);
      expect(result).toEqual([]);
      
      // All 3 calls should have been attempted
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should preserve containment type tagging in parallel execution', async () => {
      // Mock different responses for each containment type
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: {
            sessions: [{
              sessionId: 'agent_session',
              userId: 'user_1',
              start_time: '2025-08-01T15:00:00Z',
              end_time: '2025-08-01T15:10:00Z',
              tags: [],
              metrics: { total_messages: 5, user_messages: 3, bot_messages: 2 },
              duration_seconds: 600
            }]
          }
        }) // agent
        .mockResolvedValueOnce({
          status: 200,
          data: {
            sessions: [{
              sessionId: 'selfservice_session',
              userId: 'user_2',
              start_time: '2025-08-01T15:00:00Z',
              end_time: '2025-08-01T15:10:00Z',
              tags: [],
              metrics: { total_messages: 3, user_messages: 2, bot_messages: 1 },
              duration_seconds: 300
            }]
          }
        }) // selfService
        .mockResolvedValueOnce({
          status: 200,
          data: {
            sessions: [{
              sessionId: 'dropoff_session',
              userId: 'user_3',
              start_time: '2025-08-01T15:00:00Z',
              end_time: '2025-08-01T15:10:00Z',
              tags: [],
              metrics: { total_messages: 2, user_messages: 1, bot_messages: 1 },
              duration_seconds: 150
            }]
          }
        }); // dropOff

      const options = {
        dateFrom: '2025-08-01T00:00:00Z',
        dateTo: '2025-08-01T23:59:59Z'
      };

      const result = await koreApiService.getSessionsMetadata(options);

      // Should have 3 sessions with correct containment types
      expect(result).toHaveLength(3);
      
      const agentSession = result.find(s => s.sessionId === 'agent_session');
      const selfServiceSession = result.find(s => s.sessionId === 'selfservice_session');
      const dropOffSession = result.find(s => s.sessionId === 'dropoff_session');
      
      expect(agentSession?.containment_type).toBe('agent');
      expect(selfServiceSession?.containment_type).toBe('selfService');
      expect(dropOffSession?.containment_type).toBe('dropOff');
    });

    it('should maintain rate limiting behavior in parallel execution', async () => {
      const rateLimitSpy = jest.spyOn(koreApiService as any, 'checkRateLimit');
      
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { sessions: [] }
      });

      const options = {
        dateFrom: '2025-08-01T00:00:00Z',
        dateTo: '2025-08-01T23:59:59Z'
      };

      await koreApiService.getSessionsMetadata(options);

      // Rate limiting should be called for each parallel request
      expect(rateLimitSpy).toHaveBeenCalledTimes(3);
    });

    it('should work with mock credentials in parallel mode', async () => {
      // Create service with mock credentials
      const mockCredentialsConfig = {
        botId: 'st-mock-bot-id-12345',
        clientId: 'cs-mock-client-id-12345', 
        clientSecret: 'mock-client-secret-12345'
      };
      
      const mockKoreService = new KoreApiService(mockCredentialsConfig);

      const options = {
        dateFrom: '2025-08-01T00:00:00Z',
        dateTo: '2025-08-01T23:59:59Z',
        limit: 10
      };

      const result = await mockKoreService.getSessionsMetadata(options);

      // Should return mock data without making API calls
      expect(result.length).toBeGreaterThan(0);
      expect(mockedAxios.post).not.toHaveBeenCalled();
      
      // Mock sessions should have proper structure
      expect(result[0]).toMatchObject({
        sessionId: expect.any(String),
        userId: expect.any(String),
        containment_type: expect.any(String),
        metrics: expect.objectContaining({
          total_messages: expect.any(Number),
          user_messages: expect.any(Number),
          bot_messages: expect.any(Number)
        })
      });
    });
  });
});