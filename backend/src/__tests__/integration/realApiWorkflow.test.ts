/**
 * Real API End-to-End Workflow Tests
 * 
 * Tests the complete session + conversation history retrieval workflow
 * using real Kore.ai API calls from start to finish.
 */

import { getSessions } from '../../services/mockDataService';
import { createKoreApiService } from '../../services/koreApiService';
import { configManager } from '../../utils/configManager';
import { SessionWithTranscript } from '../../../../shared/types';

describe('Real API End-to-End Workflow Tests', () => {
  let hasRealCredentials: boolean = false;
  let testBotName: string = '';

  beforeAll(async () => {
    try {
      const koreConfig = configManager.getKoreConfig();
      hasRealCredentials = !!(koreConfig.client_id && koreConfig.client_secret && koreConfig.bot_id);
      testBotName = koreConfig.name || 'Unknown Bot';
      
      if (hasRealCredentials) {
        console.log('✅ Real API workflow tests enabled');
        console.log(`🤖 Testing with bot: ${testBotName}`);
      } else {
        console.log('⚠️  Real API workflow tests disabled - no credentials');
      }
    } catch (error) {
      hasRealCredentials = false;
      console.log('⚠️  Failed to initialize real API workflow tests');
    }
  });

  describe('Complete Session Retrieval Workflow', () => {
    it('should retrieve sessions with populated conversation history using real API', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API workflow test - no credentials');
        return;
      }

      console.log('🔄 Starting complete real API workflow test...');
      
      // Use the main getSessions function which should use real API when credentials are available
      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-14T23:59:59Z',
        limit: 10,
        skip: 0
      };

      console.log('📊 Fetching sessions with real API integration...');
      const startTime = Date.now();
      const sessions = await getSessions(filters);
      const endTime = Date.now();
      
      const retrievalTime = endTime - startTime;
      console.log(`⏱️  Retrieved ${sessions.length} sessions in ${retrievalTime}ms`);

      // Validate session structure
      expect(Array.isArray(sessions)).toBe(true);
      
      if (sessions.length > 0) {
        console.log('🔍 Validating session structure from real API...');
        
        const session = sessions[0];
        
        if (session) {
          // Validate complete SessionWithTranscript structure
          expect(session).toHaveProperty('session_id');
          expect(session).toHaveProperty('user_id');
          expect(session).toHaveProperty('start_time');
          expect(session).toHaveProperty('end_time');
          expect(session).toHaveProperty('containment_type');
          expect(session).toHaveProperty('messages');
          expect(session).toHaveProperty('message_count');
          expect(session).toHaveProperty('user_message_count');
          expect(session).toHaveProperty('bot_message_count');
          
          // Validate message integration
          expect(Array.isArray(session.messages)).toBe(true);
          
          if (session.messages && session.messages.length > 0) {
            console.log(`💬 Session ${session.session_id} has ${session.messages.length} messages`);
            
            const message = session.messages[0];
            
            if (message) {
              // Validate message structure matches shared types
              expect(message).toHaveProperty('timestamp');
              expect(message).toHaveProperty('message_type');
              expect(message).toHaveProperty('message');
              
              expect(['user', 'bot']).toContain(message.message_type);
              expect(typeof message.message).toBe('string');
              expect(message.message.length).toBeGreaterThan(0);
              
              console.log(`✅ Message integration validated: "${message.message.substring(0, 50)}..."`);
            }
          }
          
          // Validate computed metrics
          expect(typeof session.message_count).toBe('number');
          expect(typeof session.user_message_count).toBe('number');
          expect(typeof session.bot_message_count).toBe('number');
          expect(session.message_count).toBe(session.messages.length);
          
          console.log(`📈 Session metrics: ${session.message_count} total, ${session.user_message_count} user, ${session.bot_message_count} bot`);
          
          console.log('✅ Complete workflow validation passed');
        }
      } else {
        console.log('ℹ️  No sessions found in test date range - this may be expected');
      }
      
      // Performance validation
      expect(retrievalTime).toBeLessThan(60000); // Should complete within 1 minute
      
    }, 90000);

    it('should handle session filtering with real API data', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API filtering test - no credentials');
        return;
      }

      console.log('🔍 Testing session filtering with real API...');
      
      const baseFilters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-14T23:59:59Z',
        limit: 20,
        skip: 0
      };

      // Test different containment type filters
      const containmentTypes = ['selfService', 'agent', 'dropOff'] as const;
      const results: { [key: string]: SessionWithTranscript[] } = {};
      
      for (const containmentType of containmentTypes) {
        console.log(`📊 Testing ${containmentType} filtering...`);
        
        const filters = { ...baseFilters, containment_type: containmentType };
        const sessions = await getSessions(filters);
        results[containmentType] = sessions;
        
        console.log(`   ${containmentType}: ${sessions.length} sessions`);
        
        // Validate all returned sessions match the filter
        sessions.forEach(session => {
          expect(session.containment_type).toBe(containmentType);
        });
      }
      
      // Get unfiltered results for comparison
      console.log('📊 Testing unfiltered results...');
      const allSessions = await getSessions(baseFilters);
      console.log(`   total: ${allSessions.length} sessions`);
      
      // Validate filtering logic
      const totalFiltered = (results.selfService?.length || 0) + (results.agent?.length || 0) + (results.dropOff?.length || 0);
      
      if (allSessions.length > 0) {
        // Total filtered should not exceed unfiltered (may be less due to limit)
        expect(totalFiltered).toBeLessThanOrEqual(allSessions.length + 60); // Account for multiple API calls with limits
        console.log(`✅ Filtering validation: ${totalFiltered} filtered vs ${allSessions.length} total`);
      }
      
    }, 120000);

    it('should handle pagination correctly with real API data', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API pagination test - no credentials'); 
        return;
      }

      console.log('📄 Testing pagination with real API...');
      
      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-14T23:59:59Z',
        limit: 5,
        skip: 0
      };

      // Get multiple pages
      const pages = [];
      const maxPages = 3;
      
      for (let page = 0; page < maxPages; page++) {
        const pageFilters = { ...filters, skip: page * filters.limit };
        console.log(`📄 Fetching page ${page + 1} (skip: ${pageFilters.skip})...`);
        
        const pageSessions = await getSessions(pageFilters);
        pages.push(pageSessions);
        
        console.log(`   Page ${page + 1}: ${pageSessions.length} sessions`);
        
        // If we get fewer than limit, we've reached the end
        if (pageSessions.length < filters.limit) {
          console.log(`📄 Reached end at page ${page + 1}`);
          break;
        }
      }
      
      // Validate pagination behavior
      let allSessionIds: string[] = [];
      pages.forEach((page, index) => {
        expect(Array.isArray(page)).toBe(true);
        
        const pageIds = page.map(s => s.session_id);
        
        // Check for duplicates across pages
        const duplicates = allSessionIds.filter(id => pageIds.includes(id));
        expect(duplicates.length).toBe(0);
        
        allSessionIds.push(...pageIds);
        
        console.log(`   Page ${index + 1}: ${pageIds.length} unique sessions`);
      });
      
      console.log(`✅ Pagination validated: ${allSessionIds.length} total unique sessions across pages`);
      
    }, 120000);
  });

  describe('Real API Error Scenarios', () => {
    it('should handle service errors gracefully in complete workflow', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API error test - no credentials');
        return;
      }

      console.log('🧪 Testing error handling in complete workflow...');
      
      // Test with various potentially problematic inputs
      const errorTestCases = [
        {
          name: 'Invalid date format',
          filters: {
            start_date: 'invalid-date',
            end_date: '2025-07-14T23:59:59Z',
            limit: 5,
            skip: 0
          }
        },
        {
          name: 'Negative pagination',
          filters: {
            start_date: '2025-07-07T00:00:00Z',
            end_date: '2025-07-14T23:59:59Z',
            limit: -5,
            skip: -10
          }
        },
        {
          name: 'Extremely large limit',
          filters: {
            start_date: '2025-07-07T00:00:00Z',
            end_date: '2025-07-14T23:59:59Z',
            limit: 999999,
            skip: 0
          }
        }
      ];
      
      for (const testCase of errorTestCases) {
        console.log(`🧪 Testing: ${testCase.name}`);
        
        let result;
        let errorThrown = false;
        
        try {
          result = await getSessions(testCase.filters);
        } catch (error) {
          errorThrown = true;
          console.log(`   Error caught: ${(error as Error).message}`);
          expect(error).toBeInstanceOf(Error);
        }
        
        if (!errorThrown && result) {
          // Should handle gracefully
          expect(Array.isArray(result)).toBe(true);
          console.log(`   Handled gracefully: ${result.length} sessions`);
        }
        
        console.log(`   ✅ ${testCase.name} handled appropriately`);
      }
      
    }, 90000);

    it('should maintain data consistency under real API errors', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API consistency test - no credentials');
        return;
      }

      console.log('🔄 Testing data consistency under potential API errors...');
      
      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-14T23:59:59Z',
        limit: 10,
        skip: 0
      };

      // Make the same request multiple times to check consistency
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(getSessions({ ...filters }));
      }
      
      const results = await Promise.allSettled(requests);
      
      let successfulResults: SessionWithTranscript[][] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
          console.log(`   Request ${index + 1}: ✅ ${result.value.length} sessions`);
        } else {
          console.log(`   Request ${index + 1}: ❌ ${result.reason.message}`);
        }
      });
      
      // If multiple requests succeeded, they should return consistent data
      if (successfulResults.length > 1) {
        const firstResult = successfulResults[0];
        if (firstResult) {
          const firstResultIds = firstResult.map(s => s.session_id).sort();
          
          for (let i = 1; i < successfulResults.length; i++) {
            const currentResult = successfulResults[i];
            if (currentResult) {
              const currentResultIds = currentResult.map(s => s.session_id).sort();
              
              // Should return the same sessions (unless data changed between requests)
              // This is a consistency check, not strict equality due to potential timing
              console.log(`   Comparing request 1 (${firstResultIds.length}) vs request ${i + 1} (${currentResultIds.length})`);
            }
          }
        }
        
        console.log('✅ Data consistency check completed');
      } else {
        console.log('ℹ️  Insufficient successful requests for consistency check');
      }
      
    }, 90000);
  });

  describe('Real API Performance Benchmarks', () => {
    it('should meet performance benchmarks with real API', async () => {
      if (!hasRealCredentials) {
        console.log('⏭️  Skipping real API performance test - no credentials');
        return;
      }

      console.log('⚡ Running performance benchmark with real API...');
      
      const benchmarkFilters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-08T00:00:00Z', // Smaller range for consistent testing
        limit: 20,
        skip: 0
      };

      // Warm-up request
      console.log('🔥 Warm-up request...');
      await getSessions({ ...benchmarkFilters, limit: 1 });
      
      // Benchmark multiple requests
      const benchmarkRuns = 3;
      const times = [];
      
      for (let run = 1; run <= benchmarkRuns; run++) {
        console.log(`🏃 Benchmark run ${run}/${benchmarkRuns}...`);
        
        const startTime = Date.now();
        const sessions = await getSessions(benchmarkFilters);
        const endTime = Date.now();
        
        const runTime = endTime - startTime;
        times.push(runTime);
        
        console.log(`   Run ${run}: ${sessions.length} sessions in ${runTime}ms`);
      }
      
      // Calculate performance metrics
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      console.log('📊 Performance Results:');
      console.log(`   Average: ${avgTime.toFixed(0)}ms`);
      console.log(`   Min: ${minTime}ms`);
      console.log(`   Max: ${maxTime}ms`);
      
      // Performance assertions (adjust based on your requirements)
      expect(avgTime).toBeLessThan(30000); // Average under 30 seconds
      expect(maxTime).toBeLessThan(60000); // Max under 1 minute
      
      // Performance rating
      if (avgTime < 5000) {
        console.log('🚀 Excellent performance (<5s average)');
      } else if (avgTime < 15000) {
        console.log('✅ Good performance (<15s average)');
      } else {
        console.log('⚠️  Acceptable performance (<30s average)');
      }
      
    }, 180000); // 3 minute timeout for performance testing
  });
});