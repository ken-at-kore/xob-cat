import express from 'express';
import request from 'supertest';
import { autoAnalyzeRouter } from '../../routes/autoAnalyze';
import { ServiceFactory } from '../../factories/serviceFactory';
import { destroyBackgroundJobQueue } from '../../services/backgroundJobQueue';
import {
  MOCK_CREDENTIALS,
  createTestApp,
  createAnalysisConfig,
  runFullAnalysisWorkflow,
  testCancellation,
  testInvalidConfiguration,
  testNonExistentAnalysisId,
  validateCredentials,
  testMultipleSessionCounts,
  testLargeSessionCount
} from './autoAnalyzeWorkflow.shared';

/**
 * AUTO-ANALYZE INTEGRATION TEST - MOCK API VERSION
 * 
 * Tests the complete auto-analysis workflow using pure mock services.
 * This test validates the integration between:
 * - API routes (/api/analysis/auto-analyze/*)
 * - Background job queue service
 * - Session sampling service  
 * - OpenAI analysis service (mocked)
 * - Kore.ai API service (mocked)
 * 
 * Benefits of mock testing:
 * - Fast execution (no real API calls)
 * - Deterministic results (consistent test data)
 * - No external dependencies or costs
 * - Reliable CI/CD pipeline integration
 */
describe('Auto-Analyze Integration Test - Mock API', () => {
  let app: express.Application;

  beforeAll(() => {
    // Validate mock credentials (should always pass)
    validateCredentials(MOCK_CREDENTIALS, 'mock');

    // Force use of mock services
    ServiceFactory.useMockServices();
    
    // Set environment variable to ensure mock services are used consistently
    process.env.USE_MOCK_SERVICES = 'mock';
    
    console.log('🧪 [Mock Integration Test] Using pure mock services');
    console.log('🧪 [Mock Integration Test] ServiceFactory type:', ServiceFactory.getServiceType());

    // Create test app with mock credentials
    app = createTestApp(MOCK_CREDENTIALS);
    app.use('/api/analysis/auto-analyze', autoAnalyzeRouter);
  });

  afterAll(() => {
    // Clean up environment
    delete process.env.USE_MOCK_SERVICES;
    ServiceFactory.resetToDefaults();
    
    // Clean up background job queue to prevent Jest hanging
    destroyBackgroundJobQueue();
  });

  describe('Complete Analysis Workflow', () => {
    it('should complete full auto-analysis workflow with mock data', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 10, // Reasonable count for mock data
        modelId: 'gpt-4.1-nano'
      });

      await runFullAnalysisWorkflow(
        app, 
        analysisConfig, 
        'Mock API Integration Test'
      );

    }, 120000); // 2 minute timeout

    it('should handle different session counts correctly', async () => {
      const testSizes = [5, 15, 25, 100];
      
      await testMultipleSessionCounts(
        app,
        MOCK_CREDENTIALS,
        testSizes,
        'Mock Test',
        { modelId: 'gpt-4.1-nano' }
      );
      
    }, 180000); // 3 minute timeout for multiple tests

    it('should handle large session count (100 sessions) efficiently', async () => {
      await testLargeSessionCount(
        app,
        MOCK_CREDENTIALS,
        100,
        'Mock Test',
        { modelId: 'gpt-4.1-nano' }
      );
      
    }, 300000); // 5 minute timeout for large session count
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle cancellation during analysis', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 50, // Larger count to have time to cancel
        modelId: 'gpt-4.1-nano'
      });

      await testCancellation(app, analysisConfig);
      
    }, 30000); // 30 second timeout

    it('should handle invalid configuration gracefully', async () => {
      await testInvalidConfiguration(app);
    });

    it('should handle non-existent analysis ID gracefully', async () => {
      await testNonExistentAnalysisId(app);
    });

    it('should maintain state consistency during concurrent requests', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 10,
        modelId: 'gpt-4.1-nano'
      });

      // Start analysis
      const startResponse = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(analysisConfig)
        .expect(200);

      const analysisId = startResponse.body.data.analysisId;

      // Make multiple concurrent progress requests
      const progressPromises = Array.from({ length: 5 }, () =>
        request(app)
          .get(`/api/analysis/auto-analyze/progress/${analysisId}`)
          .expect(200)
      );

      const progressResponses = await Promise.all(progressPromises);

      // All responses should be consistent
      const firstResponse = progressResponses[0];
      expect(firstResponse).toBeDefined();
      expect(firstResponse?.body?.data).toBeDefined();
      const firstProgress = firstResponse!.body.data;
      
      progressResponses.forEach(response => {
        const progress = response.body.data;
        expect(progress.analysisId).toBe(firstProgress.analysisId);
        expect(progress.botId).toBe(firstProgress.botId);
        // Phase might change between requests, but should be valid
        expect(progress.phase).toMatch(/^(sampling|analyzing|generating_summary|complete|error)$/);
      });

    }, 30000);
  });

  describe('Mock Data Validation', () => {
    it('should return consistent mock session data', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 5,
        modelId: 'gpt-4.1-nano'
      });

      const { results } = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Mock Data Validation'
      );

      // Validate mock-specific characteristics
      expect(results.botId).toBe('mock-bot-id');
      
      // Check that sessions have expected mock data patterns
      results.sessions.forEach((session: any) => {
        expect(session.session_id).toBeDefined();
        expect(session.messages).toBeDefined();
        expect(Array.isArray(session.messages)).toBe(true);
        expect(session.messages.length).toBeGreaterThan(0);
        
        // Mock data should have analysis facts
        expect(session.facts).toBeDefined();
        expect(session.facts.generalIntent).toBeDefined();
        expect(session.facts.sessionOutcome).toBeDefined();
        
        // Mock analysis metadata
        expect(session.analysisMetadata).toBeDefined();
        expect(session.analysisMetadata.model).toBe('gpt-4o-mini');
        expect(session.analysisMetadata.tokensUsed).toBeGreaterThan(0);
      });
      
    }, 60000);

    it('should have deterministic cost calculations', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 10,
        modelId: 'gpt-4.1-nano'
      });

      // Run analysis twice with same config
      const results1 = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Cost Test 1'
      );
      
      const results2 = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Cost Test 2'
      );

      // Mock data should produce consistent results
      expect(results1.progress.sessionsProcessed).toBe(results2.progress.sessionsProcessed);
      expect(results1.progress.tokensUsed).toBe(results2.progress.tokensUsed);
      expect(results1.progress.estimatedCost).toBe(results2.progress.estimatedCost);
      
    }, 120000);
  });
});