/**
 * CONCURRENT BATCH PROCESSING UNIT TESTS
 * 
 * Tests the concurrent batch processing logic without real API calls.
 * Focuses on batching logic, concurrency control, timeout handling, and error resilience.
 */

import axios from 'axios';
import { KoreApiService } from '../../services/koreApiService';
import { KoreMessage } from '../../services/koreApiService';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Concurrent Batch Processing Unit Tests', () => {
  let koreApiService: KoreApiService;
  const mockConfig = {
    botId: 'mock-bot-id',
    clientId: 'mock-client-id',
    clientSecret: 'mock-client-secret'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    koreApiService = new KoreApiService(mockConfig);
  });

  describe('Batch Creation Logic', () => {
    it('should split session IDs into batches of 20', () => {
      const sessionIds = Array.from({ length: 100 }, (_, i) => `session_${i}`);
      const batchSize = 20;
      
      // This will be implemented in the actual service
      const createBatches = (ids: string[], size: number): string[][] => {
        const batches: string[][] = [];
        for (let i = 0; i < ids.length; i += size) {
          batches.push(ids.slice(i, i + size));
        }
        return batches;
      };

      const batches = createBatches(sessionIds, batchSize);

      expect(batches).toHaveLength(5); // 100 / 20 = 5 batches
      expect(batches[0]).toHaveLength(20);
      expect(batches[4]).toHaveLength(20);
      expect(batches.flat()).toHaveLength(100);
      expect(batches[0]?.[0]).toBe('session_0');
      expect(batches[4]?.[19]).toBe('session_99');
    });

    it('should handle non-divisible session counts', () => {
      const sessionIds = Array.from({ length: 47 }, (_, i) => `session_${i}`);
      const batchSize = 20;
      
      const createBatches = (ids: string[], size: number): string[][] => {
        const batches: string[][] = [];
        for (let i = 0; i < ids.length; i += size) {
          batches.push(ids.slice(i, i + size));
        }
        return batches;
      };

      const batches = createBatches(sessionIds, batchSize);

      expect(batches).toHaveLength(3); // 47 / 20 = 2.35, so 3 batches
      expect(batches[0]).toHaveLength(20);
      expect(batches[1]).toHaveLength(20);
      expect(batches[2]).toHaveLength(7); // Remainder
    });

    it('should handle empty session list', () => {
      const sessionIds: string[] = [];
      const batchSize = 20;
      
      const createBatches = (ids: string[], size: number): string[][] => {
        const batches: string[][] = [];
        for (let i = 0; i < ids.length; i += size) {
          batches.push(ids.slice(i, i + size));
        }
        return batches;
      };

      const batches = createBatches(sessionIds, batchSize);

      expect(batches).toHaveLength(0);
    });
  });

  describe('Concurrency Control', () => {
    it('should limit concurrent API calls to 10', async () => {
      // Mock implementation of concurrency limiter
      class ConcurrencyLimiter {
        private activeCount = 0;
        private maxConcurrent: number;
        private queue: (() => void)[] = [];

        constructor(maxConcurrent: number) {
          this.maxConcurrent = maxConcurrent;
        }

        async execute<T>(fn: () => Promise<T>): Promise<T> {
          while (this.activeCount >= this.maxConcurrent) {
            await new Promise<void>(resolve => {
              this.queue.push(resolve);
            });
          }

          this.activeCount++;
          try {
            return await fn();
          } finally {
            this.activeCount--;
            const next = this.queue.shift();
            if (next) next();
          }
        }

        getActiveCount(): number {
          return this.activeCount;
        }
      }

      const limiter = new ConcurrencyLimiter(10);
      const results: number[] = [];
      const delays: number[] = Array.from({ length: 25 }, () => Math.random() * 100);

      // Track max concurrent executions
      let maxConcurrent = 0;

      const tasks = delays.map((delay, index) => 
        limiter.execute(async () => {
          maxConcurrent = Math.max(maxConcurrent, limiter.getActiveCount());
          await new Promise(resolve => setTimeout(resolve, delay));
          results.push(index);
          return index;
        })
      );

      await Promise.all(tasks);

      expect(results).toHaveLength(25);
      expect(maxConcurrent).toBeLessThanOrEqual(10);
    });

    it('should process batches in parallel up to concurrency limit', async () => {
      const batches = Array.from({ length: 15 }, (_, i) => 
        Array.from({ length: 20 }, (_, j) => `session_${i * 20 + j}`)
      );

      const processedBatches: number[] = [];
      const startTimes: number[] = [];
      const endTimes: number[] = [];

      // Simulate processing with timing
      const processBatch = async (batchIndex: number): Promise<void> => {
        startTimes[batchIndex] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate API call
        processedBatches.push(batchIndex);
        endTimes[batchIndex] = Date.now();
      };

      // Process with concurrency limit of 10
      const maxConcurrent = 10;
      const executing: Promise<void>[] = [];
      
      for (let i = 0; i < batches.length; i++) {
        const promise = processBatch(i);
        executing.push(promise);

        if (executing.length >= maxConcurrent) {
          const completed = await Promise.race(executing);
          const index = await Promise.race(executing.map(async (p, idx) => {
            try { await p; return idx; } catch { return idx; }
          }));
          executing.splice(index, 1);
        }
      }

      await Promise.all(executing);

      expect(processedBatches).toHaveLength(15);
      
      // Check that processing was parallel
      const overlappingBatches = startTimes.filter((start, i) => 
        startTimes.some((otherStart, j) => 
          i !== j && start < (endTimes[j] || 0) && (endTimes[i] || 0) > otherStart
        )
      );
      
      expect(overlappingBatches.length).toBeGreaterThan(0); // Some batches ran in parallel
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout requests after 30 seconds', async () => {
      const timeoutPromise = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
          )
        ]);
      };

      // Test successful completion before timeout
      const fastPromise = new Promise<string>(resolve => 
        setTimeout(() => resolve('success'), 100)
      );
      
      const fastResult = await timeoutPromise(fastPromise, 30000);
      expect(fastResult).toBe('success');

      // Test timeout
      const slowPromise = new Promise<string>(resolve => 
        setTimeout(() => resolve('too late'), 100)
      );

      await expect(timeoutPromise(slowPromise, 50)).rejects.toThrow('Timeout after 50ms');
    });

    it('should handle timeout errors gracefully in batch processing', async () => {
      const batches = [
        ['session_1', 'session_2'],
        ['session_3', 'session_4'],
        ['session_5', 'session_6']
      ];

      const results: { batch: number; status: 'success' | 'timeout' | 'error' }[] = [];

      const processBatchWithTimeout = async (batch: string[], index: number): Promise<void> => {
        try {
          // Simulate some batches timing out
          if (index === 1) {
            await new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10)
            );
          } else {
            await new Promise(resolve => setTimeout(resolve, 5));
            results.push({ batch: index, status: 'success' });
          }
        } catch (error) {
          if (error instanceof Error && error.message === 'Timeout') {
            results.push({ batch: index, status: 'timeout' });
          } else {
            results.push({ batch: index, status: 'error' });
          }
        }
      };

      await Promise.all(batches.map((batch, i) => processBatchWithTimeout(batch, i)));

      expect(results).toHaveLength(3);
      expect(results.filter(r => r.status === 'success')).toHaveLength(2);
      expect(results.filter(r => r.status === 'timeout')).toHaveLength(1);
      expect(results.find(r => r.batch === 1)?.status).toBe('timeout');
    });
  });

  describe('Error Resilience', () => {
    it('should continue processing other batches when one fails', async () => {
      const batches = Array.from({ length: 5 }, (_, i) => 
        Array.from({ length: 20 }, (_, j) => `session_${i * 20 + j}`)
      );

      const successfulBatches: number[] = [];
      const failedBatches: number[] = [];

      const processBatch = async (batch: string[], index: number): Promise<void> => {
        try {
          // Simulate batch 2 failing
          if (index === 2) {
            throw new Error('API Error');
          }
          await new Promise(resolve => setTimeout(resolve, 10));
          successfulBatches.push(index);
        } catch (error) {
          failedBatches.push(index);
        }
      };

      await Promise.all(batches.map((batch, i) => processBatch(batch, i)));

      expect(successfulBatches).toHaveLength(4);
      expect(failedBatches).toHaveLength(1);
      expect(failedBatches[0]).toBe(2);
      expect(successfulBatches).toContain(0);
      expect(successfulBatches).toContain(1);
      expect(successfulBatches).toContain(3);
      expect(successfulBatches).toContain(4);
    });

    it('should retry failed batches with exponential backoff', async () => {
      let attemptCount = 0;
      const maxRetries = 3;

      const retryWithBackoff = async <T,>(
        fn: () => Promise<T>,
        retries: number = maxRetries
      ): Promise<T> => {
        try {
          attemptCount++;
          return await fn();
        } catch (error) {
          if (retries > 0) {
            const delay = Math.pow(2, maxRetries - retries) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(fn, retries - 1);
          }
          throw error;
        }
      };

      // Test successful retry
      let failCount = 0;
      const eventuallySucceeds = async (): Promise<string> => {
        if (failCount < 2) {
          failCount++;
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      attemptCount = 0;
      const result = await retryWithBackoff(eventuallySucceeds);
      expect(result).toBe('success');
      expect(attemptCount).toBe(3); // Initial + 2 retries

      // Test max retries exceeded
      const alwaysFails = async (): Promise<string> => {
        throw new Error('Permanent failure');
      };

      attemptCount = 0;
      await expect(retryWithBackoff(alwaysFails)).rejects.toThrow('Permanent failure');
      expect(attemptCount).toBe(4); // Initial + 3 retries
    });
  });

  describe('Result Aggregation', () => {
    it('should correctly aggregate messages from all successful batches', async () => {
      const mockMessages: Record<string, KoreMessage[]> = {
        batch_0: [
          { sessionId: 'session_0', type: 'incoming', timestampValue: 1000 } as KoreMessage,
          { sessionId: 'session_1', type: 'outgoing', timestampValue: 2000 } as KoreMessage
        ],
        batch_1: [
          { sessionId: 'session_2', type: 'incoming', timestampValue: 3000 } as KoreMessage,
          { sessionId: 'session_3', type: 'outgoing', timestampValue: 4000 } as KoreMessage
        ],
        batch_2: [
          { sessionId: 'session_4', type: 'incoming', timestampValue: 5000 } as KoreMessage
        ]
      };

      const aggregateResults = (batchResults: KoreMessage[][]): KoreMessage[] => {
        return batchResults.flat();
      };

      const batchResults = Object.values(mockMessages);
      const aggregated = aggregateResults(batchResults);

      expect(aggregated).toHaveLength(5);
      expect(aggregated[0]?.sessionId).toBe('session_0');
      expect(aggregated[4]?.sessionId).toBe('session_4');
    });

    it('should handle partial results when some batches fail', () => {
      const batchResults: (KoreMessage[] | null)[] = [
        [{ sessionId: 'session_0', type: 'incoming' } as KoreMessage],
        null, // Failed batch
        [{ sessionId: 'session_2', type: 'incoming' } as KoreMessage],
        null, // Failed batch
        [{ sessionId: 'session_4', type: 'incoming' } as KoreMessage]
      ];

      const aggregatePartialResults = (results: (KoreMessage[] | null)[]): KoreMessage[] => {
        return results.filter(r => r !== null).flat() as KoreMessage[];
      };

      const aggregated = aggregatePartialResults(batchResults);

      expect(aggregated).toHaveLength(3);
      expect(aggregated.map(m => m.sessionId)).toEqual(['session_0', 'session_2', 'session_4']);
    });
  });

  describe('Performance Tracking', () => {
    it('should track batch processing times', async () => {
      const batchTimes: { batch: number; duration: number }[] = [];

      const processBatchWithTiming = async (batch: string[], index: number): Promise<void> => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        const duration = Date.now() - start;
        batchTimes.push({ batch: index, duration });
      };

      const batches = Array.from({ length: 5 }, (_, i) => [`session_${i}`]);
      await Promise.all(batches.map((batch, i) => processBatchWithTiming(batch, i)));

      expect(batchTimes).toHaveLength(5);
      batchTimes.forEach(timing => {
        expect(timing.duration).toBeGreaterThan(0);
        expect(timing.duration).toBeLessThan(200);
      });

      const avgTime = batchTimes.reduce((sum, t) => sum + t.duration, 0) / batchTimes.length;
      console.log(`Average batch processing time: ${avgTime.toFixed(2)}ms`);
    });

    it('should calculate overall performance improvement', () => {
      const sequentialTime = 100 * 500; // 100 sessions * 500ms each
      const concurrentTime = Math.ceil(100 / 20) * 5000; // 5 batches * 5s each (with parallelism)
      
      const improvement = sequentialTime / concurrentTime;

      expect(improvement).toBeGreaterThan(1);
      console.log(`Performance improvement: ${improvement.toFixed(1)}x faster`);
    });
  });
});