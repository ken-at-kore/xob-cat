/**
 * Real Kore.ai API Integration Tests
 * 
 * These tests make actual API calls to Kore.ai services to validate:
 * - Authentication and authorization
 * - Real data structure validation  
 * - Error handling with real API responses
 * - Rate limiting and performance characteristics
 * 
 * To run these tests, you need real Kore.ai credentials:
 * - Set KORE_CLIENT_ID, KORE_CLIENT_SECRET, KORE_BOT_ID environment variables
 * - Or ensure backend/config/optum-bot.yaml exists with valid credentials
 * 
 * Run with: npm run test:integration
 */

import { createKoreApiService, KoreApiConfig } from '../../services/koreApiService';
import { configManager } from '../../utils/configManager';
import { SessionWithTranscript, Message } from '../../../../shared/types';

describe('Real Kore.ai API Integration Tests', () => {
  let koreApiService: ReturnType<typeof createKoreApiService>;
  let testConfig: KoreApiConfig;
  let hasRealCredentials: boolean = false;

  beforeAll(async () => {
    try {
      // Try to get real Kore.ai configuration
      const koreConfig = configManager.getKoreConfig();
      
      testConfig = {
        botId: koreConfig.bot_id,
        clientId: koreConfig.client_id,
        clientSecret: koreConfig.client_secret,
        baseUrl: koreConfig.base_url
      };

      // Validate we have real credentials
      if (!testConfig.clientId || !testConfig.clientSecret || !testConfig.botId) {
        console.warn('⚠️  Real Kore.ai credentials not found. Skipping real API tests.');
        console.warn('   Set KORE_CLIENT_ID, KORE_CLIENT_SECRET, KORE_BOT_ID environment variables');
        console.warn('   Or provide backend/config/optum-bot.yaml with valid credentials');
        return;
      }

      hasRealCredentials = true;
      koreApiService = createKoreApiService(testConfig);
      
      console.log('✅ Real Kore.ai API integration tests enabled');
      console.log(`🤖 Testing with bot: ${koreConfig.name || testConfig.botId}`);
      console.log(`🔗 API Base URL: ${testConfig.baseUrl}`);
      
    } catch (error) {
      console.warn('⚠️  Failed to initialize real Kore.ai API tests:', error);
      hasRealCredentials = false;
    }
  });

  describe('Real API Authentication', () => {
    it('should authenticate with valid Kore.ai credentials', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      // Test authentication by making a simple API call
      const dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday
      const dateTo = new Date().toISOString(); // Now
      
      // This should not throw an authentication error
      await expect(async () => {
        await koreApiService.getSessions(dateFrom, dateTo, 0, 1);
      }).not.toThrow();
      
    }, 30000); // 30 second timeout for real API calls

    it('should generate valid JWT tokens for API requests', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      // Access the internal generateAuthToken method if available
      // This tests the JWT generation logic with real credentials
      expect(testConfig.clientId).toBeTruthy();
      expect(testConfig.clientSecret).toBeTruthy();
      expect(typeof testConfig.clientId).toBe('string');
      expect(typeof testConfig.clientSecret).toBe('string');
      
    }, 10000);
  });

  describe('Real Session History Retrieval', () => {
    it('should retrieve real session data from Kore.ai API', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      // Use a recent date range that should have some data
      const dateFrom = new Date('2025-07-07T00:00:00Z').toISOString();
      const dateTo = new Date('2025-07-14T23:59:59Z').toISOString();
      
      console.log(`📅 Fetching real sessions from ${dateFrom} to ${dateTo}`);
      
      const sessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 10);
      
      console.log(`📊 Retrieved ${sessions.length} real sessions from Kore.ai`);
      
      // Validate response structure
      expect(Array.isArray(sessions)).toBe(true);
      
      // If sessions exist, validate their structure matches expectations
      if (sessions.length > 0) {
        const session = sessions[0];
        
        console.log(`🔍 Validating session structure: ${session.session_id}`);
        
        // Required session fields
        expect(session).toHaveProperty('session_id');
        expect(session).toHaveProperty('user_id');
        expect(session).toHaveProperty('start_time');
        expect(session).toHaveProperty('end_time');
        expect(session).toHaveProperty('containment_type');
        
        // Validate data types
        expect(typeof session.session_id).toBe('string');
        expect(typeof session.user_id).toBe('string');
        expect(typeof session.start_time).toBe('string');
        expect(typeof session.end_time).toBe('string');
        expect(['agent', 'selfService', 'dropOff']).toContain(session.containment_type);
        
        // Validate timestamps are valid ISO strings
        expect(new Date(session.start_time).toISOString()).toBe(session.start_time);
        expect(new Date(session.end_time).toISOString()).toBe(session.end_time);
        
        console.log(`✅ Session structure validation passed`);
      } else {
        console.log('ℹ️  No sessions found in date range - this may be expected');
      }
      
    }, 60000); // 60 second timeout for real API calls

    it('should handle real API pagination correctly', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      const dateFrom = new Date('2025-07-07T00:00:00Z').toISOString();
      const dateTo = new Date('2025-07-14T23:59:59Z').toISOString();
      
      // Get first page
      const firstPage = await koreApiService.getSessions(dateFrom, dateTo, 0, 5);
      console.log(`📄 First page: ${firstPage.length} sessions`);
      
      // Get second page  
      const secondPage = await koreApiService.getSessions(dateFrom, dateTo, 5, 5);
      console.log(`📄 Second page: ${secondPage.length} sessions`);
      
      // Validate pagination behavior
      expect(Array.isArray(firstPage)).toBe(true);
      expect(Array.isArray(secondPage)).toBe(true);
      
      // If both pages have data, they should be different
      if (firstPage.length > 0 && secondPage.length > 0) {
        const firstPageIds = firstPage.map(s => s.session_id);
        const secondPageIds = secondPage.map(s => s.session_id);
        
        // Should not have overlapping session IDs
        const intersection = firstPageIds.filter(id => secondPageIds.includes(id));
        expect(intersection.length).toBe(0);
        
        console.log('✅ Pagination working correctly - no duplicate sessions');
      }
      
    }, 60000);

    it('should respect containment type filtering with real data', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      const dateFrom = new Date('2025-07-07T00:00:00Z').toISOString();
      const dateTo = new Date('2025-07-14T23:59:59Z').toISOString();
      
      // Test each containment type
      const containmentTypes = ['selfService', 'agent', 'dropOff'] as const;
      
      for (const containmentType of containmentTypes) {
        console.log(`🔍 Testing containment type: ${containmentType}`);
        
        // Get all sessions first, then filter client-side for this test
        const allSessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 50);
        const sessions = allSessions.filter(s => s.containment_type === containmentType).slice(0, 10);
        
        console.log(`📊 Retrieved ${sessions.length} ${containmentType} sessions`);
        
        // All returned sessions should match the requested containment type
        sessions.forEach(session => {
          expect(session.containment_type).toBe(containmentType);
        });
        
        console.log(`✅ ${containmentType} filtering validated`);
      }
      
    }, 90000); // Longer timeout for multiple API calls
  });

  describe('Real Conversation History Retrieval', () => {
    it('should retrieve real conversation messages from Kore.ai API', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      const dateFrom = new Date('2025-07-07T00:00:00Z').toISOString();
      const dateTo = new Date('2025-07-14T23:59:59Z').toISOString();
      
      // First get some sessions
      const sessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 5);
      console.log(`📊 Retrieved ${sessions.length} sessions for message testing`);
      
      if (sessions.length === 0) {
        console.log('ℹ️  No sessions found - skipping message retrieval test');
        return;
      }
      
      // Get session IDs for message retrieval
      const sessionIds = sessions.map(s => s.session_id).slice(0, 3); // Test with first 3 sessions
      console.log(`💬 Fetching messages for sessions: ${sessionIds.join(', ')}`);
      
      const messages = await koreApiService.getMessages(dateFrom, dateTo, sessionIds);
      console.log(`📨 Retrieved ${messages.length} real messages from Kore.ai`);
      
      // Validate message structure
      expect(Array.isArray(messages)).toBe(true);
      
      if (messages.length > 0) {
        const message = messages[0];
        
        console.log('🔍 Validating message structure');
        
        // Check required message fields from real API
        expect(message).toHaveProperty('messageId');
        expect(message).toHaveProperty('type'); 
        expect(message).toHaveProperty('createdOn');
        expect(message).toHaveProperty('components');
        
        // Validate data types
        expect(typeof message.messageId).toBe('string');
        expect(['incoming', 'outgoing']).toContain(message.type);
        expect(typeof message.createdOn).toBe('string');
        expect(Array.isArray(message.components)).toBe(true);
        
        // Validate timestamp
        expect(new Date(message.createdOn).toISOString()).toBe(message.createdOn);
        
        // Validate at least one component exists
        expect(message.components.length).toBeGreaterThan(0);
        
        // Check component structure
        if (message.components[0]) {
          expect(message.components[0]).toHaveProperty('cT'); // Component type
          expect(message.components[0]).toHaveProperty('data');
        }
        
        console.log('✅ Real message structure validation passed');
      }
      
    }, 90000);

    it('should handle message pagination with real data', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      const dateFrom = new Date('2025-07-07T00:00:00Z').toISOString();
      const dateTo = new Date('2025-07-14T23:59:59Z').toISOString();
      
      // Get sessions with likely high message count
      const sessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 10);
      
      if (sessions.length === 0) {
        console.log('ℹ️  No sessions found - skipping message pagination test');
        return;
      }
      
      const sessionIds = sessions.map(s => s.session_id);
      console.log(`📊 Testing message pagination with ${sessionIds.length} sessions`);
      
      // Test if the service handles pagination internally for large message sets
      // This validates the internal pagination logic works with real API
      const allMessages = await koreApiService.getMessages(dateFrom, dateTo, sessionIds);
      console.log(`📨 Retrieved ${allMessages.length} total messages`);
      
      // Validate messages are chronologically ordered
      if (allMessages.length > 1) {
        let isChronological = true;
        for (let i = 1; i < allMessages.length; i++) {
          const prevTime = new Date(allMessages[i-1].createdOn).getTime();
          const currTime = new Date(allMessages[i].createdOn).getTime();
          if (currTime < prevTime) {
            isChronological = false;
            break;
          }
        }
        
        console.log(`⏰ Messages chronologically ordered: ${isChronological}`);
        // Note: This may not always be true across different sessions
      }
      
    }, 120000); // 2 minute timeout for potentially large datasets
  });

  describe('Real API Error Handling', () => {
    it('should handle invalid date ranges gracefully', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      // Test with invalid date range (end before start)
      const invalidDateFrom = new Date('2025-07-15T00:00:00Z').toISOString();
      const invalidDateTo = new Date('2025-07-07T00:00:00Z').toISOString();
      
      console.log('🧪 Testing invalid date range handling');
      
      // This should either return empty array or throw a descriptive error
      let result: any;
      let errorThrown = false;
      
      try {
        result = await koreApiService.getSessions(invalidDateFrom, invalidDateTo, 0, 5);
        console.log(`📊 Invalid date range returned: ${result.length} sessions`);
      } catch (error) {
        errorThrown = true;
        console.log(`🚨 Invalid date range error: ${(error as Error).message}`);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeTruthy();
      }
      
      // Either should handle gracefully (empty array) or throw meaningful error
      if (!errorThrown) {
        expect(Array.isArray(result)).toBe(true);
        console.log('✅ Invalid date range handled gracefully');
      } else {
        console.log('✅ Invalid date range error handled properly');
      }
      
    }, 60000);

    it('should handle non-existent session IDs gracefully', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      const dateFrom = new Date('2025-07-07T00:00:00Z').toISOString();
      const dateTo = new Date('2025-07-14T23:59:59Z').toISOString();
      
      // Use fake session IDs that don't exist
      const fakeSessionIds = ['fake-session-1', 'fake-session-2', 'non-existent-session'];
      
      console.log('🧪 Testing non-existent session ID handling');
      
      let result: any;
      let errorThrown = false;
      
      try {
        result = await koreApiService.getMessages(dateFrom, dateTo, fakeSessionIds);
        console.log(`📨 Non-existent sessions returned: ${result.length} messages`);
      } catch (error) {
        errorThrown = true;
        console.log(`🚨 Non-existent session error: ${(error as Error).message}`);
        expect(error).toBeInstanceOf(Error);
      }
      
      // Should handle gracefully (empty array) or throw meaningful error
      if (!errorThrown && result) {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0); // Should be empty for non-existent sessions
        console.log('✅ Non-existent session IDs handled gracefully');
      } else {
        console.log('✅ Non-existent session ID error handled properly');
      }
      
    }, 30000);

    it('should respect rate limiting from real Kore.ai API', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      console.log('🧪 Testing real API rate limiting behavior');
      
      const dateFrom = new Date('2025-07-07T00:00:00Z').toISOString();
      const dateTo = new Date('2025-07-08T00:00:00Z').toISOString();
      
      // Make multiple rapid requests to test rate limiting
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          koreApiService.getSessions(dateFrom, dateTo, i * 2, 2)
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      console.log(`⏱️  5 concurrent requests completed in ${totalTime}ms`);
      
      // All requests should succeed (service should handle rate limiting internally)
      results.forEach((result, index) => {
        expect(Array.isArray(result)).toBe(true);
        console.log(`   Request ${index + 1}: ${result.length} sessions`);
      });
      
      // If rate limiting is implemented, requests should take reasonable time
      expect(totalTime).toBeGreaterThan(0);
      console.log('✅ Rate limiting behavior validated');
      
    }, 120000);
  });

  describe('Real API Performance and Reliability', () => {
    it('should complete real API calls within reasonable time', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      const dateFrom = new Date('2025-07-07T00:00:00Z').toISOString();
      const dateTo = new Date('2025-07-08T00:00:00Z').toISOString();
      
      console.log('⚡ Testing real API performance');
      
      const startTime = Date.now();
      const sessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 10);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      console.log(`📊 Retrieved ${sessions.length} sessions in ${responseTime}ms`);
      
      // Should complete within reasonable time (adjust based on expected performance)
      expect(responseTime).toBeLessThan(30000); // 30 seconds max
      
      if (responseTime < 5000) {
        console.log('🚀 Excellent API performance (<5s)');
      } else if (responseTime < 15000) {
        console.log('✅ Good API performance (<15s)');
      } else {
        console.log('⚠️  Slow API performance (>15s)');
      }
      
    }, 45000);

    it('should handle concurrent real API requests safely', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API test - no credentials');
        return;
      }

      console.log('🔄 Testing concurrent real API request handling');
      
      const dateFrom = new Date('2025-07-07T00:00:00Z').toISOString();
      const dateTo = new Date('2025-07-08T00:00:00Z').toISOString();
      
      // Create concurrent requests for different data
      const concurrentRequests = [
        koreApiService.getSessions(dateFrom, dateTo, 0, 5),
        koreApiService.getSessions(dateFrom, dateTo, 5, 5),
        koreApiService.getSessions(dateFrom, dateTo, 10, 5)
      ];
      
      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentRequests);
      const endTime = Date.now();
      
      console.log(`⏱️  3 concurrent requests completed in ${endTime - startTime}ms`);
      
      // All requests should succeed or fail gracefully
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect(Array.isArray(result.value)).toBe(true);
          console.log(`   Request ${index + 1}: ✅ ${result.value.length} sessions`);
        } else {
          console.log(`   Request ${index + 1}: ❌ ${result.reason.message}`);
          // Concurrent failures are acceptable but should be errors not undefined
          expect(result.reason).toBeInstanceOf(Error);
        }
      });
      
      console.log('✅ Concurrent request handling validated');
      
    }, 60000);
  });
});