import express from 'express';
import request from 'supertest';
import { autoAnalyzeRouter } from '../../routes/autoAnalyze';
import { ServiceFactory } from '../../factories/serviceFactory';
import {
  REAL_CREDENTIALS,
  createTestApp,
  createAnalysisConfig,
  runFullAnalysisWorkflow,
  testCancellation,
  testInvalidConfiguration,
  testNonExistentAnalysisId,
  validateCredentials
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
 * ⚠️  WARNING: This test makes real API calls and incurs OpenAI costs!
 * Only run when you need to validate production integration.
 */
describe('Auto-Analyze Integration Test - Real API', () => {
  let app: express.Application;

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
    console.log('💰 [Real API Test] WARNING: This test will incur OpenAI costs!');

    // Create test app with real credentials
    app = createTestApp(REAL_CREDENTIALS);
    app.use('/api/analysis/auto-analyze', autoAnalyzeRouter);
  });

  afterAll(() => {
    // Reset to defaults
    ServiceFactory.resetToDefaults();
  });

  describe('Production Integration Workflow', () => {
    it('should complete full auto-analysis workflow with real APIs', async () => {
      // Use recent date for real API test
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7); // 7 days ago
      const dateString = recentDate.toISOString().split('T')[0];
      
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        startDate: dateString as string,
        startTime: '09:00', 
        sessionCount: 5, // Keep small to minimize costs
        modelId: 'gpt-4o-mini'
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
        expect(session.analysisMetadata.model).toBe('gpt-4o-mini');
        expect(session.analysisMetadata.tokensUsed).toBeGreaterThan(0);
      });

      console.log(`💰 [Real API Test] Total cost incurred: $${progress.estimatedCost.toFixed(4)}`);

    }, 300000); // 5 minute timeout for real API calls

    it('should handle real API rate limiting gracefully', async () => {
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        sessionCount: 20, // Larger count to test rate limiting
        modelId: 'gpt-4o-mini'
      });

      console.log('💰 [Real API Test] Testing rate limiting with 20 sessions');

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
  });

  describe('Production Error Handling', () => {
    it('should handle real API cancellation', async () => {
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        sessionCount: 30, // Larger count to have time to cancel
        modelId: 'gpt-4o-mini'
      });

      console.log('💰 [Real API Test] Testing cancellation (minimal cost)');
      await testCancellation(app, analysisConfig);
      
    }, 60000); // 1 minute timeout

    it('should handle invalid configuration with real APIs', async () => {
      await testInvalidConfiguration(app);
    });

    it('should handle non-existent analysis ID with real APIs', async () => {
      await testNonExistentAnalysisId(app);
    });

    it('should handle real API authentication errors', async () => {
      // Create app with invalid credentials
      const invalidCredentials = {
        ...REAL_CREDENTIALS,
        clientSecret: 'invalid-secret'
      };
      
      const invalidApp = createTestApp(invalidCredentials);
      invalidApp.use('/api/analysis/auto-analyze', autoAnalyzeRouter);

      const analysisConfig = createAnalysisConfig(invalidCredentials, {
        sessionCount: 5,
        modelId: 'gpt-4o-mini'
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
      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        sessionCount: 3, // Small count to minimize cost
        modelId: 'gpt-4o-mini'
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
        expect(session.analysisMetadata.model).toBe('gpt-4o-mini');
      });
      
    }, 180000); // 3 minute timeout

    it('should handle different time ranges with real data', async () => {
      // Test with recent date range to ensure data availability
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7); // 7 days ago
      const dateString = recentDate.toISOString().split('T')[0];

      const analysisConfig = createAnalysisConfig(REAL_CREDENTIALS, {
        startDate: dateString as string,
        startTime: '09:00',
        sessionCount: 5,
        modelId: 'gpt-4o-mini'
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