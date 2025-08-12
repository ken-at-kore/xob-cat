/**
 * KORE API SERVICE CONCURRENT BATCH UNIT TESTS
 * 
 * Tests the concurrent batch processing implementation in KoreApiService
 * without making real API calls.
 */

import { KoreApiService } from '../../services/koreApiService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KoreApiService Concurrent Batch Processing', () => {
  let koreApiService: KoreApiService;
  const mockConfig = {
    botId: 'test-bot-id',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    koreApiService = new KoreApiService(mockConfig);
    
    // Mock JWT token generation
    jest.spyOn(koreApiService as any, 'generateJwtToken').mockReturnValue('mock-jwt-token');
    
    // Mock rate limit check
    jest.spyOn(koreApiService as any, 'checkRateLimit').mockResolvedValue(undefined);
  });

  describe('Single Batch (≤20 sessions)', () => {
    it('should use single API call for small session counts', async () => {
      const sessionIds = ['session_1', 'session_2', 'session_3'];
      const mockResponse = {
        status: 200,
        data: {
          messages: [
            { sessionId: 'session_1', type: 'incoming' },
            { sessionId: 'session_2', type: 'outgoing' },
            { sessionId: 'session_3', type: 'incoming' }
          ]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await koreApiService.getMessagesForSessions(sessionIds);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/getMessagesV2'),
        expect.objectContaining({
          sessionId: sessionIds
        }),
        expect.objectContaining({
          timeout: 30000
        })
      );
      expect(result).toHaveLength(3);
    });
  });

  describe('Multiple Batches (>20 sessions)', () => {
    it('should split large session counts into batches', async () => {
      const sessionIds = Array.from({ length: 50 }, (_, i) => `session_${i}`);
      const mockResponse = {
        status: 200,
        data: {
          messages: Array.from({ length: 10 }, (_, i) => ({
            sessionId: `session_${i}`,
            type: i % 2 === 0 ? 'incoming' : 'outgoing'
          }))
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await koreApiService.getMessagesForSessions(sessionIds);

      // Should make 3 calls: 20 + 20 + 10 sessions
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      
      // First batch: sessions 0-19
      expect(mockedAxios.post).toHaveBeenNthCalledWith(1,
        expect.stringContaining('/getMessagesV2'),
        expect.objectContaining({
          sessionId: sessionIds.slice(0, 20)
        }),
        expect.objectContaining({
          timeout: 30000
        })
      );

      // Second batch: sessions 20-39
      expect(mockedAxios.post).toHaveBeenNthCalledWith(2,
        expect.stringContaining('/getMessagesV2'),
        expect.objectContaining({
          sessionId: sessionIds.slice(20, 40)
        }),
        expect.objectContaining({
          timeout: 30000
        })
      );

      // Third batch: sessions 40-49
      expect(mockedAxios.post).toHaveBeenNthCalledWith(3,
        expect.stringContaining('/getMessagesV2'),
        expect.objectContaining({
          sessionId: sessionIds.slice(40, 50)
        }),
        expect.objectContaining({
          timeout: 30000
        })
      );

      // Should aggregate all results
      expect(result).toHaveLength(30); // 3 batches × 10 messages each
    });

    it('should handle concurrent batches with proper timing', async () => {
      const sessionIds = Array.from({ length: 100 }, (_, i) => `session_${i}`);
      
      // Track call timings
      const callTimes: number[] = [];
      mockedAxios.post.mockImplementation(() => {
        callTimes.push(Date.now());
        return Promise.resolve({
          status: 200,
          data: {
            messages: [{ sessionId: 'test', type: 'incoming' }]
          }
        });
      });

      const startTime = Date.now();
      await koreApiService.getMessagesForSessions(sessionIds);
      const endTime = Date.now();

      // Should make 5 calls (100 sessions / 20 per batch)
      expect(mockedAxios.post).toHaveBeenCalledTimes(5);

      // Check that calls were made concurrently (within a reasonable window)
      const callSpan = Math.max(...callTimes) - Math.min(...callTimes);
      const totalTime = endTime - startTime;
      
      // Concurrent calls should start close together
      expect(callSpan).toBeLessThan(totalTime * 0.5); // Started within first half of total time

      console.log(`Batch processing timing:`);
      console.log(`  - Total time: ${totalTime}ms`);
      console.log(`  - Call span: ${callSpan}ms`);
    });
  });

  describe('Error Handling', () => {
    it('should handle individual batch failures gracefully', async () => {
      const sessionIds = Array.from({ length: 60 }, (_, i) => `session_${i}`);
      
      // Make the second batch fail
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { messages: [{ sessionId: 'session_0', type: 'incoming' }] }
        })
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          status: 200,
          data: { messages: [{ sessionId: 'session_40', type: 'incoming' }] }
        });

      const result = await koreApiService.getMessagesForSessions(sessionIds);

      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(2); // Only successful batches
    });

    it('should handle timeout errors specifically', async () => {
      const sessionIds = ['session_1', 'session_2'];
      const timeoutError = new Error('timeout of 30000ms exceeded') as any;
      timeoutError.code = 'ECONNABORTED';
      
      mockedAxios.post.mockRejectedValue(timeoutError);

      await expect(koreApiService.getMessagesForSessions(sessionIds))
        .rejects.toThrow('timeout of 30000ms exceeded');
    });

    it('should provide fallback on complete batch processing failure', async () => {
      const sessionIds = Array.from({ length: 40 }, (_, i) => `session_${i}`);
      
      // Make all batches fail initially
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Batch 1 failed'))
        .mockRejectedValueOnce(new Error('Batch 2 failed'))
        // Then succeed on fallback
        .mockResolvedValueOnce({
          status: 200,
          data: { messages: [{ sessionId: 'fallback', type: 'incoming' }] }
        });

      const result = await koreApiService.getMessagesForSessions(sessionIds);

      // Should try 2 batch calls + 1 fallback call
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(1); // Fallback result
    });
  });

  describe('Performance Optimization', () => {
    it('should log batch processing performance metrics', async () => {
      const sessionIds = Array.from({ length: 80 }, (_, i) => `session_${i}`);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { messages: [{ sessionId: 'test', type: 'incoming' }] }
      });

      await koreApiService.getMessagesForSessions(sessionIds);

      // Should log batch processing details
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Split 80 sessions into 4 batches')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing with max 10 concurrent API calls')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Batch Processing Complete:')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Configuration', () => {
    it('should use correct batch size and concurrency limits', async () => {
      // This test verifies our configuration constants
      const sessionIds = Array.from({ length: 100 }, (_, i) => `session_${i}`);
      
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { messages: [] }
      });

      await koreApiService.getMessagesForSessions(sessionIds);

      // Should create exactly 5 batches (100 / 20)
      expect(mockedAxios.post).toHaveBeenCalledTimes(5);

      // Each call should have max 20 sessions
      for (let i = 0; i < 5; i++) {
        const call = mockedAxios.post.mock.calls[i];
        const payload = call?.[1] as any;
        expect(payload?.sessionId).toHaveLength(20);
      }
    });
  });
});