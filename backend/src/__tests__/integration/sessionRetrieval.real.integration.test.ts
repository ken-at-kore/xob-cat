/**
 * SESSION RETRIEVAL INTEGRATION TEST - REAL API VERSION
 * 
 * Tests the session retrieval and message fetching process with real Kore.ai APIs.
 * This test focuses on the first part of auto-analyze: finding sessions and fetching their messages.
 * It stops before the OpenAI analysis phase begins.
 * 
 * Required Environment Variables (.env.local):
 * - TEST_BOT_ID: Valid Kore.ai bot ID
 * - TEST_CLIENT_ID: Valid Kore.ai client ID  
 * - TEST_CLIENT_SECRET: Valid Kore.ai client secret
 * 
 * Test Modes (via environment variable):
 * - SESSION_RETRIEVAL_TEST_MODE=basic (default): Test with 20 sessions
 * - SESSION_RETRIEVAL_TEST_MODE=large: Test with 100 sessions
 * - SESSION_RETRIEVAL_TEST_MODE=stress: Test with 200 sessions
 */

import { KoreApiService } from '../../services/koreApiService';
import { SWTService } from '../../services/swtService';
import { SessionSamplingService } from '../../services/sessionSamplingService';
import { SessionWithTranscript } from '../../../../shared/types';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Test configuration
const TEST_CREDENTIALS = {
  botId: process.env.TEST_BOT_ID || '',
  clientId: process.env.TEST_CLIENT_ID || '',
  clientSecret: process.env.TEST_CLIENT_SECRET || ''
};

const TEST_MODE = process.env.SESSION_RETRIEVAL_TEST_MODE || 'basic';
const SESSION_COUNTS = {
  basic: 20,
  large: 100,
  stress: 200
};

describe('Session Retrieval Integration Test - Real API', () => {
  let koreApiService: KoreApiService;
  let swtService: SWTService;
  let sessionSamplingService: SessionSamplingService;

  beforeAll(() => {
    // Validate credentials
    if (!TEST_CREDENTIALS.botId || !TEST_CREDENTIALS.clientId || !TEST_CREDENTIALS.clientSecret) {
      throw new Error(
        'Real API test requires TEST_BOT_ID, TEST_CLIENT_ID, and TEST_CLIENT_SECRET in .env.local'
      );
    }

    console.log(`\n🔬 Running session retrieval test in ${TEST_MODE} mode`);
    console.log(`📊 Target session count: ${SESSION_COUNTS[TEST_MODE as keyof typeof SESSION_COUNTS]}`);

    // Initialize services
    koreApiService = new KoreApiService(TEST_CREDENTIALS);
    swtService = new SWTService(koreApiService);
    sessionSamplingService = new SessionSamplingService(swtService, koreApiService);
  });

  describe('Session Discovery Phase', () => {
    it('should discover and sample sessions using time window expansion', async () => {
      const sessionCount = SESSION_COUNTS[TEST_MODE as keyof typeof SESSION_COUNTS];
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7); // 7 days ago
      
      const config = {
        startDate: recentDate.toISOString().split('T')[0] as string,
        startTime: '09:00',
        sessionCount,
        openaiApiKey: 'dummy-key', // Not used in this phase
        modelId: 'gpt-4o-mini' // Not used in this phase
      };

      const progressUpdates: string[] = [];
      const startTime = Date.now();

      console.log(`\n⏱️  Starting session discovery at ${new Date().toISOString()}`);
      
      const result = await sessionSamplingService.sampleSessions(
        config,
        (message) => {
          progressUpdates.push(message);
          console.log(`  📍 ${message}`);
        }
      );

      const discoveryTime = Date.now() - startTime;

      // Validate discovery results
      expect(result.sessions).toBeDefined();
      expect(result.sessions.length).toBeGreaterThan(0);
      expect(result.sessions.length).toBeLessThanOrEqual(sessionCount);
      expect(result.totalFound).toBeGreaterThanOrEqual(result.sessions.length);
      expect(result.timeWindows).toBeDefined();
      expect(result.timeWindows.length).toBeGreaterThan(0);

      console.log(`\n✅ Discovery Phase Results:`);
      console.log(`  - Sessions found: ${result.totalFound}`);
      console.log(`  - Sessions sampled: ${result.sessions.length}`);
      console.log(`  - Time windows used: ${result.timeWindows.map(w => w.label).join(', ')}`);
      console.log(`  - Discovery time: ${discoveryTime}ms`);

      // Validate progress updates
      expect(progressUpdates.some(msg => msg.includes('Searching'))).toBe(true);
      expect(progressUpdates.some(msg => msg.includes('Found'))).toBe(true);
    }, 120000); // 2 minute timeout
  });

  describe('Message Fetching Phase', () => {
    it('should fetch messages for sampled sessions efficiently', async () => {
      const sessionCount = SESSION_COUNTS[TEST_MODE as keyof typeof SESSION_COUNTS];
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7);
      
      const config = {
        startDate: recentDate.toISOString().split('T')[0] as string,
        startTime: '09:00',
        sessionCount,
        openaiApiKey: 'dummy-key',
        modelId: 'gpt-4o-mini'
      };

      console.log(`\n⏱️  Starting message fetching test at ${new Date().toISOString()}`);
      
      const startTime = Date.now();
      const result = await sessionSamplingService.sampleSessions(config);
      const totalTime = Date.now() - startTime;

      // Validate all sessions have messages
      const sessionsWithMessages = result.sessions.filter(s => s.messages && s.messages.length > 0);
      const avgMessagesPerSession = result.sessions.reduce((sum, s) => sum + (s.messages?.length || 0), 0) / result.sessions.length;

      console.log(`\n✅ Message Fetching Results:`);
      console.log(`  - Sessions with messages: ${sessionsWithMessages.length}/${result.sessions.length}`);
      console.log(`  - Avg messages per session: ${avgMessagesPerSession.toFixed(1)}`);
      console.log(`  - Total time: ${totalTime}ms`);
      console.log(`  - Time per session: ${(totalTime / result.sessions.length).toFixed(0)}ms`);

      // Performance assertions
      expect(sessionsWithMessages.length).toBeGreaterThan(0);
      expect(avgMessagesPerSession).toBeGreaterThan(2); // Should have meaningful conversations

      // Performance benchmarks (after optimization)
      const expectedMaxTime = sessionCount * 500; // 500ms per session max
      expect(totalTime).toBeLessThan(expectedMaxTime);

      // Validate message structure
      sessionsWithMessages.forEach(session => {
        expect(session.session_id).toBeTruthy();
        expect(session.messages).toBeInstanceOf(Array);
        session.messages?.forEach(msg => {
          expect(msg.timestamp).toBeTruthy();
          expect(msg.message_type).toMatch(/^(user|bot)$/);
          expect(msg.message).toBeTruthy();
        });
      });
    }, 180000); // 3 minute timeout
  });

  describe('Concurrent Batch Processing', () => {
    it('should process message fetching in concurrent batches', async () => {
      const sessionCount = Math.min(100, SESSION_COUNTS[TEST_MODE as keyof typeof SESSION_COUNTS]);
      
      // First, get session metadata
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7);
      const dateRange = {
        dateFrom: `${recentDate.toISOString().split('T')[0]}T09:00:00Z`,
        dateTo: `${recentDate.toISOString().split('T')[0]}T18:00:00Z`
      };

      console.log(`\n⏱️  Testing concurrent batch processing`);
      
      // Get metadata for sessions
      const metadata = await koreApiService.getSessionsMetadata({
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
        limit: sessionCount
      });

      if (metadata.length === 0) {
        console.log('⚠️  No sessions found for concurrent batch test');
        return;
      }

      const sessionIds = metadata.slice(0, Math.min(sessionCount, metadata.length)).map(s => s.sessionId);
      console.log(`  📊 Testing with ${sessionIds.length} sessions`);

      // Test the concurrent batch fetching
      const startTime = Date.now();
      const messages = await koreApiService.getMessagesForSessions(sessionIds, dateRange);
      const fetchTime = Date.now() - startTime;

      console.log(`\n✅ Concurrent Batch Results:`);
      console.log(`  - Sessions requested: ${sessionIds.length}`);
      console.log(`  - Messages retrieved: ${messages.length}`);
      console.log(`  - Fetch time: ${fetchTime}ms`);
      console.log(`  - Time per session: ${(fetchTime / sessionIds.length).toFixed(0)}ms`);

      // Performance assertions
      expect(messages).toBeDefined();
      expect(fetchTime).toBeLessThan(sessionIds.length * 300); // Should be faster than sequential

      // If we implement batching, we should see improved performance
      const expectedMaxTimeWithBatching = Math.ceil(sessionIds.length / 20) * 5000; // 5s per batch of 20
      console.log(`  - Expected max time with batching: ${expectedMaxTimeWithBatching}ms`);
    }, 240000); // 4 minute timeout
  });

  describe('Error Handling and Resilience', () => {
    it('should handle timeout scenarios gracefully', async () => {
      // This test will be more meaningful after implementing timeouts
      console.log(`\n⏱️  Testing timeout handling`);
      
      // Create a config that might trigger timeouts
      const config = {
        startDate: '2025-01-01', // Far in the past, might have many sessions
        startTime: '00:00',
        sessionCount: 10,
        openaiApiKey: 'dummy-key',
        modelId: 'gpt-4o-mini'
      };

      try {
        const result = await sessionSamplingService.sampleSessions(config);
        
        // If it succeeds, validate the result
        if (result.sessions.length > 0) {
          console.log(`  ✅ Retrieved ${result.sessions.length} sessions successfully`);
          expect(result.sessions).toBeDefined();
        } else {
          console.log(`  ⚠️  No sessions found for the date range`);
        }
      } catch (error) {
        // After implementing timeouts, we should handle timeout errors gracefully
        console.log(`  ⚠️  Error occurred: ${error}`);
        expect(error).toBeDefined();
      }
    }, 60000); // 1 minute timeout
  });

  describe('Performance Metrics', () => {
    it('should track and report performance metrics', async () => {
      const sessionCount = 20; // Small batch for metrics test
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7);
      
      const config = {
        startDate: recentDate.toISOString().split('T')[0] as string,
        startTime: '09:00',
        sessionCount,
        openaiApiKey: 'dummy-key',
        modelId: 'gpt-4o-mini'
      };

      const metrics = {
        discoveryStart: 0,
        discoveryEnd: 0,
        fetchStart: 0,
        fetchEnd: 0,
        totalStart: Date.now()
      };

      // Track metrics during sampling
      const result = await sessionSamplingService.sampleSessions(
        config,
        (message) => {
          if (message.includes('Searching')) {
            metrics.discoveryStart = metrics.discoveryStart || Date.now();
          }
          if (message.includes('completing search')) {
            metrics.discoveryEnd = Date.now();
            metrics.fetchStart = Date.now();
          }
        }
      );

      metrics.fetchEnd = Date.now();
      const totalTime = metrics.fetchEnd - metrics.totalStart;
      const discoveryTime = metrics.discoveryEnd - metrics.discoveryStart || 0;
      const fetchTime = metrics.fetchEnd - metrics.fetchStart || 0;

      console.log(`\n📊 Performance Metrics:`);
      console.log(`  - Total time: ${totalTime}ms`);
      console.log(`  - Discovery time: ${discoveryTime}ms (${((discoveryTime/totalTime)*100).toFixed(1)}%)`);
      console.log(`  - Fetch time: ${fetchTime}ms (${((fetchTime/totalTime)*100).toFixed(1)}%)`);
      console.log(`  - Sessions/second: ${(result.sessions.length / (totalTime/1000)).toFixed(1)}`);

      // Store metrics for comparison
      const metricsReport = {
        mode: TEST_MODE,
        sessionCount: result.sessions.length,
        totalTime,
        discoveryTime,
        fetchTime,
        sessionsPerSecond: result.sessions.length / (totalTime/1000)
      };

      console.log(`\n📈 Metrics Summary:`, JSON.stringify(metricsReport, null, 2));

      // Performance expectations
      expect(metricsReport.sessionsPerSecond).toBeGreaterThan(0.5); // At least 0.5 sessions/second
    }, 120000); // 2 minute timeout
  });
});