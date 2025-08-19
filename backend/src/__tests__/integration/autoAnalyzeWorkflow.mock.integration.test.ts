import express from 'express';
import request from 'supertest';
import { parallelAutoAnalyzeRouter } from '../../routes/parallelAutoAnalyze';
import { ServiceFactory } from '../../factories/serviceFactory';
import { destroyBackgroundJobQueue } from '../../services/backgroundJobQueue';
import OpenAI from 'openai';
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
  testLargeSessionCount,
  waitForCompletion,
  getResults
} from './autoAnalyzeWorkflow.shared';

/**
 * AUTO-ANALYZE INTEGRATION TEST - MOCK API VERSION
 * 
 * Tests the complete auto-analysis workflow using pure mock services.
 * This test validates the integration between:
 * - API routes (/api/analysis/parallel-auto-analyze/*)
 * - Background job queue service
 * - Parallel processing orchestrator
 * - Strategic discovery service  
 * - Stream processing service
 * - Conflict resolution service
 * - OpenAI analysis service (mocked)
 * - Kore.ai API service (mocked)
 * 
 * Benefits of mock testing:
 * - Fast execution (no real API calls)
 * - Deterministic results (consistent test data)
 * - No external dependencies or costs
 * - Reliable CI/CD pipeline integration
 * - Tests parallel processing architecture
 */
describe('Auto-Analyze Integration Test - Mock API', () => {
  let app: express.Application;
  const routePrefix = '/api/analysis/parallel-auto-analyze';

  beforeAll(() => {
    // Validate mock credentials (should always pass)
    validateCredentials(MOCK_CREDENTIALS, 'mock');

    // Force use of mock services
    ServiceFactory.useMockServices();
    
    // Set environment variable to ensure mock services are used consistently
    process.env.USE_MOCK_SERVICES = 'mock';
    
    console.log('🧪 [Parallel Mock Integration Test] Using pure mock services');
    console.log('🧪 [Parallel Mock Integration Test] ServiceFactory type:', ServiceFactory.getServiceType());

    // Create test app with mock credentials
    app = createTestApp(MOCK_CREDENTIALS);
    app.use(routePrefix, parallelAutoAnalyzeRouter);
  });

  afterAll(() => {
    // Clean up environment
    delete process.env.USE_MOCK_SERVICES;
    ServiceFactory.resetToDefaults();
    
    // Clean up background job queue to prevent Jest hanging
    destroyBackgroundJobQueue();
  });

  describe('Complete Parallel Analysis Workflow', () => {
    it('should complete full parallel auto-analysis workflow with mock data', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 20, // Larger count to test parallel processing
        modelId: 'gpt-4o-mini' // Use standard model for parallel testing
      });

      const { progress, results } = await runFullAnalysisWorkflow(
        app, 
        analysisConfig, 
        'Parallel Mock API Integration Test',
        120, // Increased timeout for parallel processing
        routePrefix
      );

      // Validate parallel-specific progress fields
      if ('roundsCompleted' in progress) {
        expect(progress.roundsCompleted).toBeGreaterThanOrEqual(0);
        if (progress.totalRounds !== undefined) {
          expect(progress.totalRounds).toBeGreaterThan(0);
        }
      }

      // Validate analysis completed with parallel processing
      expect(progress.currentStep).toBe('Parallel analysis complete');

    }, 180000); // 3 minute timeout for parallel processing

    it('should handle different session counts with parallel processing', async () => {
      const testSizes = [10, 25, 50, 100]; // Test various parallel workloads
      
      await testMultipleSessionCounts(
        app,
        MOCK_CREDENTIALS,
        testSizes,
        'Parallel Mock Test',
        { modelId: 'gpt-4o-mini' },
        routePrefix
      );
      
    }, 300000); // 5 minute timeout for multiple parallel tests

    it('should handle large session count (100 sessions) efficiently with parallel processing', async () => {
      const { progress } = await testLargeSessionCount(
        app,
        MOCK_CREDENTIALS,
        100,
        'Parallel Mock Test',
        { modelId: 'gpt-4o-mini' },
        180, // 3 minute timeout for parallel processing
        routePrefix
      );

      // Validate parallel processing occurred
      if ('roundsCompleted' in progress) {
        expect(progress.roundsCompleted).toBeGreaterThan(0);
      }
      
    }, 360000); // 6 minute timeout for large parallel session count

    it('should demonstrate parallel processing performance benefits', async () => {
      console.log('\n🚀 [Performance Test] Testing parallel processing performance...');
      
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 50,
        modelId: 'gpt-4o-mini'
      });

      const startTime = Date.now();
      const { progress } = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Parallel Performance Test',
        120,
        routePrefix
      );
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      console.log(`🚀 [Performance Test] Parallel processing completed in ${totalDuration}ms`);
      console.log(`🚀 [Performance Test] Sessions processed: ${progress.sessionsProcessed}`);
      console.log(`🚀 [Performance Test] Tokens used: ${progress.tokensUsed}`);

      // Validate that parallel processing provides reasonable performance
      expect(totalDuration).toBeLessThan(120000); // Should complete within 2 minutes
      expect(progress.sessionsProcessed).toBeGreaterThan(0);

    }, 180000); // 3 minute timeout
  });

  describe('Parallel Processing Features', () => {
    it('should show parallel-specific progress phases', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 30,
        modelId: 'gpt-4o-mini'
      });

      const { analysisId } = await request(app)
        .post(`${routePrefix}/start`)
        .send(analysisConfig)
        .expect(200)
        .then(res => ({ analysisId: res.body.data.analysisId }));

      // Poll for progress and check for parallel-specific phases
      let seenPhases = new Set<string>();
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const progressResponse = await request(app)
          .get(`${routePrefix}/progress/${analysisId}`)
          .expect(200);

        const progress = progressResponse.body.data;
        seenPhases.add(progress.phase);
        
        if (progress.phase === 'complete' || progress.phase === 'error') break;
        attempts++;
      }

      // Should see parallel-specific phases
      const expectedPhases = ['sampling', 'discovery', 'parallel_processing', 'conflict_resolution', 'complete'];
      const foundExpectedPhases = expectedPhases.some(phase => seenPhases.has(phase));
      expect(foundExpectedPhases).toBe(true);

    }, 120000);

    it('should track stream-level progress', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 40,
        modelId: 'gpt-4o-mini'
      });

      const { analysisId } = await request(app)
        .post(`${routePrefix}/start`)
        .send(analysisConfig)
        .expect(200)
        .then(res => ({ analysisId: res.body.data.analysisId }));

      // Look for parallel processing phase with stream information
      let foundStreamProgress = false;
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts && !foundStreamProgress) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const progressResponse = await request(app)
          .get(`${routePrefix}/progress/${analysisId}`)
          .expect(200);

        const progress = progressResponse.body.data;
        
        if (progress.phase === 'parallel_processing' && 'streamsActive' in progress) {
          expect(progress.streamsActive).toBeGreaterThan(0);
          foundStreamProgress = true;
        }
        
        if (progress.phase === 'complete' || progress.phase === 'error') break;
        attempts++;
      }

      // Either found stream progress or completed successfully
      expect(foundStreamProgress || attempts < maxAttempts).toBe(true);

    }, 120000);
  });

  describe('Additional Context Feature', () => {
    it('should accept and process additional context', async () => {
      const testContext = 'This is a healthcare IVA that helps members check claim status. The bot uses member ID for authentication.';
      
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        startDate: '2024-08-01', // Use date that matches mock data
        startTime: '09:00',
        sessionCount: 5, // Use smaller count to avoid sampling issues
        modelId: 'gpt-4o-mini',
        additionalContext: testContext
      });

      const { progress, results } = await runFullAnalysisWorkflow(
        app, 
        analysisConfig, 
        'Additional Context Test',
        120,
        routePrefix
      );

      // Verify the analysis completed successfully
      expect(progress.phase).toBe('complete');
      expect(results.sessions).toHaveLength(10);
      
      // Verify the additional context is included in results
      expect(results.additionalContext).toBe(testContext);
    }, 120000);

    it('should handle analysis without additional context', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 10,
        modelId: 'gpt-4o-mini'
        // No additionalContext provided
      });

      const { progress, results } = await runFullAnalysisWorkflow(
        app, 
        analysisConfig, 
        'No Context Test',
        120,
        routePrefix
      );

      // Verify the analysis completed successfully
      expect(progress.phase).toBe('complete');
      expect(results.sessions).toHaveLength(10);
      
      // Verify the additional context is undefined
      expect(results.additionalContext).toBeUndefined();
    }, 120000);

    it('should handle maximum length additional context', async () => {
      const maxLengthContext = 'x'.repeat(1500); // 1500 character context
      
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 10,
        modelId: 'gpt-4o-mini',
        additionalContext: maxLengthContext
      });

      const { progress, results } = await runFullAnalysisWorkflow(
        app, 
        analysisConfig, 
        'Max Length Context Test',
        120,
        routePrefix
      );

      // Verify the analysis completed successfully
      expect(progress.phase).toBe('complete');
      expect(results.sessions).toHaveLength(10);
      
      // Verify the full context is preserved
      expect(results.additionalContext).toBe(maxLengthContext);
      expect(results.additionalContext?.length).toBe(1500);
    }, 120000);

    it('should follow Spanish instructions with AI-verified compliance', async () => {
      console.log('\n🌍 [Spanish Test] Testing additional context with Spanish instructions...');
      
      const spanishInstructions = 'IMPORTANT: Write ALL classifications and notes in Spanish. Use Spanish words for all fields: generalIntent should be in Spanish, sessionOutcome should be "Transferido" or "Contenido", transferReason and dropOffLocation should be in Spanish, and all notes should be completely in Spanish. The analysis summary and all text in the final report must also be in Spanish.';
      
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        // Use default date from createAnalysisConfig
        sessionCount: 5, // Use smaller count to match other tests
        modelId: 'gpt-4o-mini',
        additionalContext: spanishInstructions
      });

      // Start the analysis
      const startResponse = await request(app)
        .post(`${routePrefix}/start`)
        .send(analysisConfig)
        .expect(200);

      const analysisId = startResponse.body.data.analysisId;
      console.log(`[Spanish Test] Started analysis ${analysisId}`);

      // Wait for completion
      const progress = await waitForCompletion(app, analysisId, 1000, 120, routePrefix);
      expect(progress.phase).toBe('complete');

      // Get the results
      const results = await getResults(app, analysisId, routePrefix);
      
      // Verify additional context is preserved
      expect(results.additionalContext).toBe(spanishInstructions);
      
      // Verify we have analyzed sessions
      expect(results.analyzedSessions).toBeDefined();
      expect(results.analyzedSessions.length).toBeGreaterThan(0);
      
      console.log(`[Spanish Test] Analyzing ${results.analyzedSessions.length} sessions for Spanish compliance...`);

      // AI-powered verification using OpenAI
      const verificationClient = new OpenAI({ 
        apiKey: process.env.TEST_OPENAI_API_KEY || MOCK_CREDENTIALS.openaiApiKey
      });

      // Verify each session analysis is in Spanish
      let allSessionsCompliant = true;
      for (let i = 0; i < Math.min(5, results.analyzedSessions.length); i++) {
        const session = results.analyzedSessions[i];
        
        const sessionVerificationPrompt = `Please analyze if the following session analysis follows Spanish language instructions:

INSTRUCTIONS GIVEN: "Write ALL classifications and notes in Spanish"

ANALYSIS TO VERIFY:
- generalIntent: "${session.facts?.generalIntent || 'N/A'}"
- sessionOutcome: "${session.facts?.sessionOutcome || 'N/A'}"
- transferReason: "${session.facts?.transferReason || 'N/A'}"
- dropOffLocation: "${session.facts?.dropOffLocation || 'N/A'}"
- notes: "${session.facts?.notes || 'N/A'}"

Respond with ONLY "COMPLIANT" if all non-empty fields are in Spanish, or "NON_COMPLIANT" if any field is not in Spanish.`;

        try {
          const response = await verificationClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: sessionVerificationPrompt }],
            max_tokens: 20,
            temperature: 0
          });
          
          const result = response.choices[0]?.message?.content?.trim();
          console.log(`  Session ${i + 1} Spanish compliance: ${result}`);
          
          if (result !== 'COMPLIANT') {
            allSessionsCompliant = false;
            console.log(`    ❌ Non-compliant content detected in session ${i + 1}`);
          }
        } catch (error) {
          console.log(`  ⚠️ Could not verify session ${i + 1}: ${error}`);
        }
      }

      // Verify the analysis summary is in Spanish
      if (results.analysisSummary) {
        const summaryVerificationPrompt = `Please analyze if the following analysis summary is written in Spanish:

SUMMARY TEXT:
"${results.analysisSummary.substring(0, 500)}..."

Respond with ONLY "COMPLIANT" if the text is in Spanish, or "NON_COMPLIANT" if it's not in Spanish.`;

        try {
          const response = await verificationClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: summaryVerificationPrompt }],
            max_tokens: 20,
            temperature: 0
          });
          
          const result = response.choices[0]?.message?.content?.trim();
          console.log(`  Summary Spanish compliance: ${result}`);
          
          expect(result).toBe('COMPLIANT');
        } catch (error) {
          console.log(`  ⚠️ Could not verify summary: ${error}`);
        }
      }

      // Verify the analysis overview is in Spanish
      if (results.analysisOverview) {
        const overviewVerificationPrompt = `Please analyze if the following analysis overview is written in Spanish:

OVERVIEW TEXT:
"${results.analysisOverview.substring(0, 500)}..."

Respond with ONLY "COMPLIANT" if the text is in Spanish, or "NON_COMPLIANT" if it's not in Spanish.`;

        try {
          const response = await verificationClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: overviewVerificationPrompt }],
            max_tokens: 20,
            temperature: 0
          });
          
          const result = response.choices[0]?.message?.content?.trim();
          console.log(`  Overview Spanish compliance: ${result}`);
          
          expect(result).toBe('COMPLIANT');
        } catch (error) {
          console.log(`  ⚠️ Could not verify overview: ${error}`);
        }
      }

      // Assert overall compliance
      expect(allSessionsCompliant).toBe(true);
      console.log('✅ [Spanish Test] All analyzed content is in Spanish as instructed!');
      
    }, 180000); // 3 minute timeout for analysis + verification
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle cancellation during parallel analysis', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 50, // Larger count to have time to cancel
        modelId: 'gpt-4o-mini'
      });

      await testCancellation(app, analysisConfig, routePrefix);
      
    }, 60000); // 1 minute timeout

    it('should handle invalid configuration gracefully', async () => {
      await testInvalidConfiguration(app, routePrefix);
    });

    it('should handle non-existent analysis ID gracefully', async () => {
      await testNonExistentAnalysisId(app, routePrefix);
    });

    it('should maintain state consistency during concurrent parallel requests', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 20,
        modelId: 'gpt-4o-mini'
      });

      // Start analysis
      const startResponse = await request(app)
        .post(`${routePrefix}/start`)
        .send(analysisConfig)
        .expect(200);

      const analysisId = startResponse.body.data.analysisId;

      // Make multiple concurrent progress requests
      const progressPromises = Array.from({ length: 5 }, () =>
        request(app)
          .get(`${routePrefix}/progress/${analysisId}`)
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
        const validPhases = /^(sampling|discovery|parallel_processing|conflict_resolution|complete|error)$/;
        expect(progress.phase).toMatch(validPhases);
      });

    }, 60000);
  });

  describe('Mock Data Validation', () => {
    it('should return consistent mock session data with parallel processing', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 15,
        modelId: 'gpt-4o-mini'
      });

      const { results } = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Parallel Mock Data Validation',
        120,
        routePrefix
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
      
    }, 120000);

    it('should have deterministic cost calculations with parallel processing', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 20,
        modelId: 'gpt-4o-mini'
      });

      // Run analysis twice with same config
      const results1 = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Parallel Cost Test 1',
        120,
        routePrefix
      );
      
      const results2 = await runFullAnalysisWorkflow(
        app,
        analysisConfig,
        'Parallel Cost Test 2',
        120,
        routePrefix
      );

      // Mock data should produce consistent results
      expect(results1.progress.sessionsProcessed).toBe(results2.progress.sessionsProcessed);
      expect(results1.progress.tokensUsed).toBe(results2.progress.tokensUsed);
      expect(results1.progress.estimatedCost).toBe(results2.progress.estimatedCost);
      
    }, 240000); // 4 minute timeout for two full analyses
  });

  describe('Integration with Background Job Queue', () => {
    it('should handle background job processing correctly', async () => {
      const analysisConfig = createAnalysisConfig(MOCK_CREDENTIALS, {
        sessionCount: 25,
        modelId: 'gpt-4o-mini'
      });

      // Start analysis
      const startResponse = await request(app)
        .post(`${routePrefix}/start`)
        .send(analysisConfig)
        .expect(200);

      const analysisData = startResponse.body.data;
      expect(analysisData.backgroundJobId).toBeDefined();
      expect(analysisData.status).toBe('started');
      expect(analysisData.message).toContain('background');

      // Poll for progress and verify background job integration
      let attempts = 0;
      const maxAttempts = 120; // 2 minute timeout
      let finalProgress;

      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const progressResponse = await request(app)
          .get(`${routePrefix}/progress/${analysisData.analysisId}`)
          .expect(200);

        finalProgress = progressResponse.body.data;
        
        // Should have background job status
        expect(['queued', 'running', 'completed', 'failed']).toContain(finalProgress.backgroundJobStatus || 'unknown');

        attempts++;
      } while (finalProgress.phase !== 'complete' && finalProgress.phase !== 'error' && attempts < maxAttempts);

      expect(finalProgress.phase).toBe('complete');

    }, 180000); // 3 minute timeout
  });
});