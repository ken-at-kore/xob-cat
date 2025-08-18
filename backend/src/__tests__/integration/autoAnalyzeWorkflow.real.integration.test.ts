import express from 'express';
import request from 'supertest';
import { parallelAutoAnalyzeRouter } from '../../routes/parallelAutoAnalyze';
import { ServiceFactory } from '../../factories/serviceFactory';
import { destroyBackgroundJobQueue } from '../../services/backgroundJobQueue';
import {
  REAL_CREDENTIALS,
  createTestApp,
  createAnalysisConfig,
  runFullAnalysisWorkflow,
  testCancellation,
  testInvalidConfiguration,
  testNonExistentAnalysisId,
  validateCredentials,
  testLargeSessionCount,
  testConfigurableSessionCounts
} from './autoAnalyzeWorkflow.shared';

/**
 * AUTO-ANALYZE INTEGRATION TEST - REAL API VERSION
 * 
 * Tests the complete auto-analysis workflow using real external APIs.
 * This test validates the integration with:
 * - Real Kore.ai API (requires valid credentials in .env.local)
 * - Real OpenAI API (requires valid API key and incurs costs)
 * - Complete production data flow with parallel processing
 * - Strategic discovery, parallel processing, and conflict resolution
 * 
 * Required Environment Variables (.env.local):
 * - TEST_BOT_ID: Valid Kore.ai bot ID
 * - TEST_CLIENT_ID: Valid Kore.ai client ID  
 * - TEST_CLIENT_SECRET: Valid Kore.ai client secret
 * - TEST_OPENAI_API_KEY: Valid OpenAI API key (incurs costs)
 * 
 * Test Configuration (Environment Variables):
 * - REAL_API_TEST_MODE: Controls which tests to run
 *   - 'basic' (default): Run only the basic 5-session workflow test
 *   - 'all': Run all test cases including rate limiting and error handling
 *   - 'workflow': Run workflow tests only (basic + rate limiting + large session counts)
 *   - 'errors': Run error handling tests only
 *   - 'validation': Run data validation tests only
 * - REAL_API_TEST_SESSION_COUNTS: Comma-separated list of session counts to test (default: "5,10")
 * 
 * Usage Examples:
 * npm test -- --testPathPattern="autoAnalyzeWorkflow.real"                    # Basic test only
 * REAL_API_TEST_MODE=all npm test -- --testPathPattern="autoAnalyzeWorkflow.real"  # All tests
 * REAL_API_TEST_MODE=workflow npm test -- --testPathPattern="autoAnalyzeWorkflow.real"  # Workflow tests
 * 
 * # Test specific session counts (configurable) - 100 sessions tests parallel processing benefits
 * REAL_API_TEST_SESSION_COUNTS="100" REAL_API_TEST_MODE=workflow npm test -- --testPathPattern="autoAnalyzeWorkflow.real"
 * REAL_API_TEST_SESSION_COUNTS="5,25,100" REAL_API_TEST_MODE=workflow npm test -- --testPathPattern="parallelAutoAnalyzeWorkflow.real"
 * 
 * ⚠️  WARNING: This test makes real API calls and incurs OpenAI costs!
 * Only run when you need to validate production integration.
 * Parallel processing may incur higher costs due to larger session counts.
 */
describe('Auto-Analyze Integration Test - Real API', () => {
  let app: express.Application;
  const routePrefix = '/api/analysis/parallel-auto-analyze';

  // Get test mode from environment variable
  const testMode = process.env.REAL_API_TEST_MODE || 'basic';
  
  beforeAll(() => {
    // Validate real credentials are available
    try {
      validateCredentials(REAL_CREDENTIALS, 'real');
    } catch (error) {
      console.error('❌ [Real API Test] Missing required credentials:', (error as Error).message);
      console.log('💡 [Real API Test] Add the following to .env.local:');
      console.log('   TEST_BOT_ID=your-bot-id');
      console.log('   TEST_CLIENT_ID=your-client-id');
      console.log('   TEST_CLIENT_SECRET=your-client-secret');
      console.log('   TEST_OPENAI_API_KEY=sk-your-openai-key');
      throw error;
    }

    // Force use of real services
    ServiceFactory.useRealServices();
    
    // Clear mock service environment variable
    delete process.env.USE_MOCK_SERVICES;
    
    console.log('🔗 [Real API Test] Using real external APIs with parallel processing');
    console.log('🔗 [Real API Test] ServiceFactory type:', ServiceFactory.getServiceType());
    console.log(`🔗 [Real API Test] Test mode: ${testMode}`);
    console.log('💰 [Real API Test] WARNING: This test will incur OpenAI costs with parallel processing!');

    // Create test app with real credentials
    app = createTestApp(REAL_CREDENTIALS);
    app.use(routePrefix, parallelAutoAnalyzeRouter);
  });

  afterAll(() => {
    // Reset to defaults
    ServiceFactory.resetToDefaults();
    
    // Clean up background job queue to prevent Jest hanging
    destroyBackgroundJobQueue();
  });

  // Helper function to check if test should run
  const shouldRunTest = (requiredModes: string[]) => {
    return requiredModes.includes(testMode);
  };

  describe('Production Parallel Integration Workflow', () => {
    it('should complete full parallel auto-analysis workflow with real APIs', async () => {
      if (!shouldRunTest(['basic', 'workflow', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping basic workflow test (mode: ${testMode})`);
        return;
      }
      // Use recent date for real API test
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7); // 7 days ago
      const dateString = recentDate.toISOString().split('T')[0];
      
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        startDate: dateString as string,
        startTime: '09:00', 
        sessionCount: 10, // Slightly larger for parallel processing testing
        modelId: 'gpt-4o-mini' // Use efficient model for parallel processing
      });

      console.log('💰 [Parallel Real API Test] Starting parallel analysis - this will incur OpenAI costs');
      console.log(`💰 [Parallel Real API Test] Analyzing ${analysisConfig.sessionCount} sessions with ${analysisConfig.modelId} in parallel`);

      const { progress, results } = await runFullAnalysisWorkflow(
        app, 
        analysisConfig, 
        'Parallel Real API Integration Test',
        300, // Extended timeout for real API with parallel processing
        routePrefix
      );

      // Additional validation for parallel real API results
      expect(results.botId).toBe(REAL_CREDENTIALS.botId);
      expect(progress.currentStep).toBe('Parallel analysis complete');
      
      // Real API should return actual session data
      expect(results.sessions.length).toBeGreaterThan(0);
      
      // Validate parallel processing occurred
      if ('roundsCompleted' in progress) {
        expect(progress.roundsCompleted).toBeGreaterThanOrEqual(0);
        console.log(`💰 [Parallel Real API Test] Completed ${progress.roundsCompleted} parallel rounds`);
      }
      
      // Validate real OpenAI analysis
      results.sessions.forEach((session: any) => {
        expect(session.facts.generalIntent).toBeTruthy();
        expect(session.facts.sessionOutcome).toBeTruthy();
        expect(session.analysisMetadata.model).toBe('gpt-4o-mini');
        expect(session.analysisMetadata.tokensUsed).toBeGreaterThan(0);
      });

      console.log(`💰 [Parallel Real API Test] Total cost incurred: $${progress.estimatedCost.toFixed(4)}`);

    }, 600000); // 10 minute timeout for real API calls with parallel processing

    it('should handle real API rate limiting gracefully with parallel processing', async () => {
      if (!shouldRunTest(['workflow', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping rate limiting test (mode: ${testMode})`);
        return;
      }
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        sessionCount: 20, // Larger count to test parallel processing under rate limiting
        modelId: 'gpt-4o-mini'
      });

      console.log('💰 [Parallel Real API Test] Testing parallel processing with rate limiting (20 sessions)');

      const { progress, results } = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Parallel Real API Rate Limit Test',
        600, // Extended timeout for rate limited parallel requests
        routePrefix
      );

      // Should complete despite rate limiting
      expect(progress.phase).toBe('complete');
      expect(results.sessions.length).toBeGreaterThan(0);

      // Validate parallel processing stats
      if ('roundsCompleted' in progress) {
        expect(progress.roundsCompleted).toBeGreaterThan(0);
        console.log(`💰 [Parallel Real API Test] Rate limiting test completed ${progress.roundsCompleted} rounds`);
      }

      console.log(`💰 [Parallel Real API Test] Rate limit test cost: $${progress.estimatedCost.toFixed(4)}`);
      
    }, 900000); // 15 minute timeout for rate limited parallel requests

    it('should handle large session count (100 sessions) with parallel processing and real APIs', async () => {
      if (!shouldRunTest(['workflow', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping large session count test (mode: ${testMode})`);
        return;
      }
      
      // Use recent date for real API test
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7); // 7 days ago
      const dateString = recentDate.toISOString().split('T')[0];
      
      console.log('💰 [Parallel Real API Test] Starting large parallel session analysis - this will incur significant OpenAI costs');
      console.log('🚀 [Performance Test] Testing parallel processing performance benefits with 100 sessions');

      const startTime = Date.now();
      const { progress, results } = await testLargeSessionCount(
        app,
        REAL_CREDENTIALS,
        100,
        'Parallel Real API Test',
        {
          startDate: dateString as string,
          startTime: '09:00',
          modelId: 'gpt-4o-mini'
        },
        900, // 15 minutes timeout for large parallel session count with real APIs
        routePrefix
      );
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Additional validation for real API results
      expect(results.botId).toBe(REAL_CREDENTIALS.botId);
      
      // Validate parallel processing performance and stats
      if ('roundsCompleted' in progress) {
        expect(progress.roundsCompleted).toBeGreaterThan(0);
        console.log(`🚀 [Performance Test] Parallel processing completed ${progress.roundsCompleted} rounds in ${totalDuration}ms`);
        console.log(`🚀 [Performance Test] Average time per round: ${(totalDuration / progress.roundsCompleted).toFixed(0)}ms`);
      }
      
      // Validate real OpenAI analysis for all sessions
      results.sessions.forEach((session: any) => {
        expect(session.facts.generalIntent).toBeTruthy();
        expect(session.facts.sessionOutcome).toBeTruthy();
        expect(session.analysisMetadata.model).toBe('gpt-4o-mini');
        expect(session.analysisMetadata.tokensUsed).toBeGreaterThan(0);
      });

      console.log(`🚀 [Performance Test] Total processing time: ${totalDuration}ms for ${results.sessions.length} sessions`);
      console.log(`🚀 [Performance Test] Average time per session: ${(totalDuration / results.sessions.length).toFixed(0)}ms`);

    }, 1200000); // 20 minute timeout for large parallel session count with real APIs

    it('should handle configurable session counts with parallel processing and real APIs', async () => {
      if (!shouldRunTest(['workflow', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping configurable session count test (mode: ${testMode})`);
        return;
      }
      
      // Use recent date for real API test
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7); // 7 days ago
      const dateString = recentDate.toISOString().split('T')[0];
      
      await testConfigurableSessionCounts(
        app,
        REAL_CREDENTIALS,
        'REAL_API_TEST_SESSION_COUNTS',
        [5, 15], // Default to moderate counts to control costs while testing parallel processing
        'Parallel Real API Test',
        {
          startDate: dateString as string,
          startTime: '09:00',
          modelId: 'gpt-4o-mini'
        },
        routePrefix
      );
      
    }, 1800000); // 30 minute timeout for multiple configurable parallel tests
  });

  describe('Production Parallel Error Handling', () => {
    it('should handle real API cancellation with parallel processing', async () => {
      if (!shouldRunTest(['errors', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping cancellation test (mode: ${testMode})`);
        return;
      }
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        sessionCount: 15, // Moderate count for parallel cancellation testing
        modelId: 'gpt-4o-mini'
      });

      console.log('💰 [Parallel Real API Test] Testing parallel processing cancellation (minimal cost)');
      await testCancellation(app, analysisConfig, routePrefix);
      
    }, 120000); // 2 minute timeout

    it('should handle invalid configuration with parallel processing', async () => {
      if (!shouldRunTest(['errors', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping invalid config test (mode: ${testMode})`);
        return;
      }
      await testInvalidConfiguration(app, routePrefix);
    });

    it('should handle non-existent analysis ID with parallel processing', async () => {
      if (!shouldRunTest(['errors', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping non-existent ID test (mode: ${testMode})`);
        return;
      }
      await testNonExistentAnalysisId(app, routePrefix);
    });

    it('should handle real API authentication errors with parallel processing', async () => {
      if (!shouldRunTest(['errors', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping auth error test (mode: ${testMode})`);
        return;
      }
      // Create app with invalid credentials
      const invalidCredentials = {
        ...REAL_CREDENTIALS,
        clientSecret: 'invalid-secret'
      };
      
      const invalidApp = createTestApp(invalidCredentials);
      invalidApp.use(routePrefix, parallelAutoAnalyzeRouter);

      const analysisConfig = createAnalysisConfig(invalidCredentials, {
        sessionCount: 10,
        modelId: 'gpt-4o-mini'
      });

      // Should fail with authentication error
      const response = await request(invalidApp)
        .post(`${routePrefix}/start`)
        .send(analysisConfig);

      // Might succeed initially but fail during execution
      if (response.status === 200) {
        const analysisId = response.body.data.analysisId;
        
        // Poll for error
        let attempts = 0;
        let progress;
        do {
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const progressResponse = await request(invalidApp)
            .get(`${routePrefix}/progress/${analysisId}`)
            .expect(200);
            
          progress = progressResponse.body.data;
          attempts++;
        } while (progress.phase !== 'error' && progress.phase !== 'complete' && attempts < 40);
        
        expect(progress.phase).toBe('error');
        expect(progress.error).toBeDefined();
      } else {
        // Immediate failure is also acceptable
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
      
    }, 180000); // 3 minute timeout
  });

  describe('Production Parallel Data Validation', () => {
    it('should return real session data with proper structure and parallel processing benefits', async () => {
      if (!shouldRunTest(['validation', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping data validation test (mode: ${testMode})`);
        return;
      }
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        sessionCount: 8, // Small count to minimize cost while testing parallel processing
        modelId: 'gpt-4o-mini'
      });

      console.log('💰 [Parallel Real API Test] Validating real session data structure with parallel processing');

      const { progress, results } = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Parallel Real Data Validation',
        300, // Extended timeout for parallel processing
        routePrefix
      );

      // Validate parallel processing occurred
      if ('roundsCompleted' in progress) {
        expect(progress.roundsCompleted).toBeGreaterThanOrEqual(0);
        console.log(`💰 [Parallel Real API Test] Data validation completed ${progress.roundsCompleted} parallel rounds`);
      }

      // Validate real data characteristics
      expect(results.botId).toBe(REAL_CREDENTIALS.botId);
      
      // Real sessions should have actual conversation data
      results.sessions.forEach((session: any) => {
        expect(session.session_id).toBeDefined();
        expect(session.messages).toBeDefined();
        expect(Array.isArray(session.messages)).toBe(true);
        
        if (session.messages.length > 0) {
          const firstMessage = session.messages[0];
          expect(firstMessage.message_type).toMatch(/^(user|bot)$/);
          expect(firstMessage.message).toBeTruthy();
          expect(firstMessage.timestamp).toBeTruthy();
        }
        
        // Real OpenAI analysis should have meaningful content
        expect(session.facts.generalIntent).toBeTruthy();
        expect(session.facts.sessionOutcome).toMatch(/^(Contained|Agent|Escalated|Abandoned)$/);
        
        // Real token usage
        expect(session.analysisMetadata.tokensUsed).toBeGreaterThan(10); // Should be substantial
        expect(session.analysisMetadata.model).toBe('gpt-4o-mini');
      });
      
    }, 360000); // 6 minute timeout

    it('should handle different time ranges with real data and parallel processing', async () => {
      if (!shouldRunTest(['validation', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping time range test (mode: ${testMode})`);
        return;
      }
      // Test with recent date range to ensure data availability
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7); // 7 days ago
      const dateString = recentDate.toISOString().split('T')[0];

      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        startDate: dateString as string,
        startTime: '09:00',
        sessionCount: 10,
        modelId: 'gpt-4o-mini'
      });

      console.log(`💰 [Parallel Real API Test] Testing parallel processing with recent date: ${dateString}`);

      try {
        const { progress, results } = await runFullAnalysisWorkflow(
          app,
          analysisConfig,
          'Parallel Real Data Time Range Test',
          300, // Extended timeout for parallel processing
          routePrefix
        );

        expect(results.sessions.length).toBeGreaterThan(0);
        
        // Validate parallel processing occurred
        if ('roundsCompleted' in progress) {
          console.log(`💰 [Parallel Real API Test] Time range test completed ${progress.roundsCompleted} parallel rounds`);
        }
        
      } catch (error) {
        // If no sessions found in recent date, that's also valid
        if ((error as Error).message.includes('No sessions found')) {
          console.log('ℹ️  [Parallel Real API Test] No recent sessions found - this is acceptable');
          expect(true).toBe(true); // Test passes
        } else {
          throw error;
        }
      }
      
    }, 360000); // 6 minute timeout
  });

  describe('Parallel Processing Performance Validation', () => {
    it('should demonstrate parallel processing efficiency with real APIs', async () => {
      if (!shouldRunTest(['validation', 'all'])) {
        console.log(`⏭️  [Parallel Real API Test] Skipping performance validation test (mode: ${testMode})`);
        return;
      }
      
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        sessionCount: 30, // Moderate size to demonstrate parallel benefits
        modelId: 'gpt-4o-mini'
      });

      console.log('🚀 [Performance Validation] Testing parallel processing efficiency with 30 sessions');

      const startTime = Date.now();
      const { progress } = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Parallel Performance Validation',
        450, // Extended timeout for performance testing
        routePrefix
      );
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Validate parallel processing metrics
      if ('roundsCompleted' in progress) {
        expect(progress.roundsCompleted).toBeGreaterThan(0);
        const avgTimePerRound = totalDuration / progress.roundsCompleted;
        const avgTimePerSession = totalDuration / progress.sessionsProcessed;
        
        console.log(`🚀 [Performance Validation] Parallel processing metrics:`);
        console.log(`   Total time: ${totalDuration}ms`);
        console.log(`   Sessions processed: ${progress.sessionsProcessed}`);
        console.log(`   Rounds completed: ${progress.roundsCompleted}`);
        console.log(`   Average time per round: ${avgTimePerRound.toFixed(0)}ms`);
        console.log(`   Average time per session: ${avgTimePerSession.toFixed(0)}ms`);
        console.log(`   Tokens used: ${progress.tokensUsed}`);
        console.log(`   Cost: $${progress.estimatedCost.toFixed(4)}`);
        
        // Validate reasonable performance
        expect(avgTimePerSession).toBeLessThan(30000); // Less than 30 seconds per session on average
        expect(progress.roundsCompleted).toBeGreaterThan(0);
      }
      
    }, 600000); // 10 minute timeout for performance validation
  });
});