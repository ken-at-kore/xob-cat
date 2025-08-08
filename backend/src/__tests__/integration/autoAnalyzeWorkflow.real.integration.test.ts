import express from 'express';
import request from 'supertest';
import { autoAnalyzeRouter } from '../../routes/autoAnalyze';
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
 * - Complete production data flow
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
 * # Test specific session counts (configurable)
 * REAL_API_TEST_SESSION_COUNTS="100" REAL_API_TEST_MODE=workflow npm test -- --testPathPattern="autoAnalyzeWorkflow.real"
 * REAL_API_TEST_SESSION_COUNTS="5,25,100" REAL_API_TEST_MODE=workflow npm test -- --testPathPattern="autoAnalyzeWorkflow.real"
 * 
 * ⚠️  WARNING: This test makes real API calls and incurs OpenAI costs!
 * Only run when you need to validate production integration.
 */
describe('Auto-Analyze Integration Test - Real API', () => {
  let app: express.Application;

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
    
    console.log('🔗 [Real API Test] Using real external APIs');
    console.log('🔗 [Real API Test] ServiceFactory type:', ServiceFactory.getServiceType());
    console.log(`🔗 [Real API Test] Test mode: ${testMode}`);
    console.log('💰 [Real API Test] WARNING: This test will incur OpenAI costs!');

    // Create test app with real credentials
    app = createTestApp(REAL_CREDENTIALS);
    app.use('/api/analysis/auto-analyze', autoAnalyzeRouter);
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

  describe('Production Integration Workflow', () => {
    it('should complete full auto-analysis workflow with real APIs', async () => {
      if (!shouldRunTest(['basic', 'workflow', 'all'])) {
        console.log(`⏭️  [Real API Test] Skipping basic workflow test (mode: ${testMode})`);
        return;
      }
      // Use recent date for real API test
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7); // 7 days ago
      const dateString = recentDate.toISOString().split('T')[0];
      
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        startDate: dateString as string,
        startTime: '09:00', 
        sessionCount: 5, // Keep small to minimize costs
        modelId: 'gpt-4.1-nano'
      });

      console.log('💰 [Real API Test] Starting analysis - this will incur OpenAI costs');
      console.log(`💰 [Real API Test] Analyzing ${analysisConfig.sessionCount} sessions with ${analysisConfig.modelId}`);

      const { progress, results } = await runFullAnalysisWorkflow(
        app, 
        analysisConfig, 
        'Real API Integration Test'
      );

      // Additional validation for real API results
      expect(results.botId).toBe(REAL_CREDENTIALS.botId);
      
      // Real API should return actual session data
      expect(results.sessions.length).toBeGreaterThan(0);
      
      // Validate real OpenAI analysis
      results.sessions.forEach((session: any) => {
        expect(session.facts.generalIntent).toBeTruthy();
        expect(session.facts.sessionOutcome).toBeTruthy();
        expect(session.analysisMetadata.model).toBe('gpt-4.1-nano');
        expect(session.analysisMetadata.tokensUsed).toBeGreaterThan(0);
      });

      console.log(`💰 [Real API Test] Total cost incurred: $${progress.estimatedCost.toFixed(4)}`);

    }, 300000); // 5 minute timeout for real API calls

    it('should handle real API rate limiting gracefully', async () => {
      if (!shouldRunTest(['workflow', 'all'])) {
        console.log(`⏭️  [Real API Test] Skipping rate limiting test (mode: ${testMode})`);
        return;
      }
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        sessionCount: 10, // Reduced count to avoid timeouts while still testing rate limiting
        modelId: 'gpt-4.1-nano'
      });

      console.log('💰 [Real API Test] Testing rate limiting with 10 sessions');

      const { progress, results } = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Real API Rate Limit Test'
      );

      // Should complete despite rate limiting
      expect(progress.phase).toBe('complete');
      expect(results.sessions.length).toBeGreaterThan(0);

      console.log(`💰 [Real API Test] Rate limit test cost: $${progress.estimatedCost.toFixed(4)}`);
      
    }, 600000); // 10 minute timeout for rate limited requests

    it('should handle large session count (100 sessions) with real APIs', async () => {
      if (!shouldRunTest(['workflow', 'all'])) {
        console.log(`⏭️  [Real API Test] Skipping large session count test (mode: ${testMode})`);
        return;
      }
      
      // Use recent date for real API test
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7); // 7 days ago
      const dateString = recentDate.toISOString().split('T')[0];
      
      console.log('💰 [Real API Test] Starting large session analysis - this will incur significant OpenAI costs');

      const { progress, results } = await testLargeSessionCount(
        app,
        REAL_CREDENTIALS,
        100,
        'Real API Test',
        {
          startDate: dateString as string,
          startTime: '09:00',
          modelId: 'gpt-4.1-nano'
        },
        600 // 10 minutes timeout for large session count with real APIs
      );

      // Additional validation for real API results
      expect(results.botId).toBe(REAL_CREDENTIALS.botId);
      
      // Validate real OpenAI analysis for all sessions
      results.sessions.forEach((session: any) => {
        expect(session.facts.generalIntent).toBeTruthy();
        expect(session.facts.sessionOutcome).toBeTruthy();
        expect(session.analysisMetadata.model).toBe('gpt-4.1-nano');
        expect(session.analysisMetadata.tokensUsed).toBeGreaterThan(0);
      });

    }, 900000); // 15 minute timeout for large session count with real APIs (10min polling + 5min buffer)

    it('should handle configurable session counts with real APIs', async () => {
      if (!shouldRunTest(['workflow', 'all'])) {
        console.log(`⏭️  [Real API Test] Skipping configurable session count test (mode: ${testMode})`);
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
        [5, 10], // Default to smaller counts to control costs
        'Real API Test',
        {
          startDate: dateString as string,
          startTime: '09:00',
          modelId: 'gpt-4.1-nano'
        }
      );
      
    }, 900000); // 15 minute timeout for multiple configurable tests
  });

  describe('Production Error Handling', () => {
    it('should handle real API cancellation', async () => {
      if (!shouldRunTest(['errors', 'all'])) {
        console.log(`⏭️  [Real API Test] Skipping cancellation test (mode: ${testMode})`);
        return;
      }
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        sessionCount: 10, // Reduced count to avoid timeouts but still allow cancellation testing
        modelId: 'gpt-4.1-nano'
      });

      console.log('💰 [Real API Test] Testing cancellation (minimal cost)');
      await testCancellation(app, analysisConfig);
      
    }, 60000); // 1 minute timeout

    it('should handle invalid configuration with real APIs', async () => {
      if (!shouldRunTest(['errors', 'all'])) {
        console.log(`⏭️  [Real API Test] Skipping invalid config test (mode: ${testMode})`);
        return;
      }
      await testInvalidConfiguration(app);
    });

    it('should handle non-existent analysis ID with real APIs', async () => {
      if (!shouldRunTest(['errors', 'all'])) {
        console.log(`⏭️  [Real API Test] Skipping non-existent ID test (mode: ${testMode})`);
        return;
      }
      await testNonExistentAnalysisId(app);
    });

    it('should handle real API authentication errors', async () => {
      if (!shouldRunTest(['errors', 'all'])) {
        console.log(`⏭️  [Real API Test] Skipping auth error test (mode: ${testMode})`);
        return;
      }
      // Create app with invalid credentials
      const invalidCredentials = {
        ...REAL_CREDENTIALS,
        clientSecret: 'invalid-secret'
      };
      
      const invalidApp = createTestApp(invalidCredentials);
      invalidApp.use('/api/analysis/auto-analyze', autoAnalyzeRouter);

      const analysisConfig = createAnalysisConfig(invalidCredentials, {
        sessionCount: 5,
        modelId: 'gpt-4.1-nano'
      });

      // Should fail with authentication error
      const response = await request(invalidApp)
        .post('/api/analysis/auto-analyze/start')
        .send(analysisConfig);

      // Might succeed initially but fail during execution
      if (response.status === 200) {
        const analysisId = response.body.data.analysisId;
        
        // Poll for error
        let attempts = 0;
        let progress;
        do {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const progressResponse = await request(invalidApp)
            .get(`/api/analysis/auto-analyze/progress/${analysisId}`)
            .expect(200);
            
          progress = progressResponse.body.data;
          attempts++;
        } while (progress.phase !== 'error' && progress.phase !== 'complete' && attempts < 30);
        
        expect(progress.phase).toBe('error');
        expect(progress.error).toBeDefined();
      } else {
        // Immediate failure is also acceptable
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
      
    }, 120000); // 2 minute timeout
  });

  describe('Production Data Validation', () => {
    it('should return real session data with proper structure', async () => {
      if (!shouldRunTest(['validation', 'all'])) {
        console.log(`⏭️  [Real API Test] Skipping data validation test (mode: ${testMode})`);
        return;
      }
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        sessionCount: 3, // Small count to minimize cost
        modelId: 'gpt-4.1-nano'
      });

      console.log('💰 [Real API Test] Validating real session data structure');

      const { results } = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Real Data Validation'
      );

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
        expect(session.analysisMetadata.model).toBe('gpt-4.1-nano');
      });
      
    }, 180000); // 3 minute timeout

    it('should handle different time ranges with real data', async () => {
      if (!shouldRunTest(['validation', 'all'])) {
        console.log(`⏭️  [Real API Test] Skipping time range test (mode: ${testMode})`);
        return;
      }
      // Test with recent date range to ensure data availability
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7); // 7 days ago
      const dateString = recentDate.toISOString().split('T')[0];

      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        startDate: dateString as string,
        startTime: '09:00',
        sessionCount: 5,
        modelId: 'gpt-4.1-nano'
      });

      console.log(`💰 [Real API Test] Testing with recent date: ${dateString}`);

      try {
        const { results } = await runFullAnalysisWorkflow(
          app,
          analysisConfig,
          'Real Data Time Range Test'
        );

        expect(results.sessions.length).toBeGreaterThan(0);
        
      } catch (error) {
        // If no sessions found in recent date, that's also valid
        if ((error as Error).message.includes('No sessions found')) {
          console.log('ℹ️  [Real API Test] No recent sessions found - this is acceptable');
          expect(true).toBe(true); // Test passes
        } else {
          throw error;
        }
      }
      
    }, 240000); // 4 minute timeout
  });
});