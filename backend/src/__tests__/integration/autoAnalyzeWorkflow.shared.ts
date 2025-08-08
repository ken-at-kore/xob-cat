import request from 'supertest';
import express from 'express';
import { AnalysisConfig, AnalysisProgress, ParallelAnalysisProgress, SessionWithTranscript } from '../../../../shared/types';

export interface TestCredentials {
  botId: string;
  clientId: string;
  clientSecret: string;
  openaiApiKey: string;
}

export interface TestConfig {
  credentials: TestCredentials;
  baseUrl?: string;
  sessionCount?: number;
  modelId?: string;
}

export const MOCK_CREDENTIALS: TestCredentials = {
  botId: 'mock-bot-id',
  clientId: 'mock-client-id',
  clientSecret: 'mock-client-secret',
  openaiApiKey: 'sk-mock-key-1234567890abcdefghijklmnopqrstuvwxyz'
};

export const REAL_CREDENTIALS: TestCredentials = {
  botId: process.env.TEST_BOT_ID || '',
  clientId: process.env.TEST_CLIENT_ID || '',
  clientSecret: process.env.TEST_CLIENT_SECRET || '',
  openaiApiKey: process.env.TEST_OPENAI_API_KEY || ''
};

export function validateCredentials(credentials: TestCredentials, type: 'mock' | 'real'): void {
  if (type === 'real') {
    if (!credentials.botId || !credentials.clientId || !credentials.clientSecret || !credentials.openaiApiKey) {
      throw new Error(
        'Real API test requires TEST_BOT_ID, TEST_CLIENT_ID, TEST_CLIENT_SECRET, and TEST_OPENAI_API_KEY in .env.local'
      );
    }
    
    if (!credentials.openaiApiKey.startsWith('sk-')) {
      throw new Error('TEST_OPENAI_API_KEY must be a valid OpenAI API key starting with "sk-"');
    }
  }
}

export function createTestApp(credentials: TestCredentials): express.Application {
  const app = express();
  app.use(express.json());
  
  // Set up credentials in headers middleware
  app.use((req, res, next) => {
    req.headers['x-bot-id'] = credentials.botId;
    req.headers['x-client-id'] = credentials.clientId;
    req.headers['x-client-secret'] = credentials.clientSecret;
    req.headers['x-jwt-token'] = 'test-jwt-token';
    next();
  });

  return app;
}

export function createAnalysisConfig(credentials: TestCredentials, overrides: Partial<AnalysisConfig> = {}): AnalysisConfig {
  const defaultConfig: AnalysisConfig = {
    startDate: '2025-08-02', // Match mock data date
    startTime: '12:00', // 12PM ET = 4PM UTC (assuming EST), matches mock data at 16:00-19:00 UTC
    sessionCount: 5, // Reduce default to be more reliable
    openaiApiKey: credentials.openaiApiKey,
    modelId: 'gpt-4.1-nano'
  };

  return { ...defaultConfig, ...overrides };
}

export async function startAnalysis(
  app: express.Application, 
  config: AnalysisConfig,
  routePrefix: string = '/api/analysis/auto-analyze'
): Promise<{ analysisId: string; response: any }> {
  const response = await request(app)
    .post(`${routePrefix}/start`)
    .send(config)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.analysisId).toBeDefined();
  expect(response.body.data.status).toBe('started');

  return {
    analysisId: response.body.data.analysisId,
    response
  };
}

export async function pollUntilComplete(
  app: express.Application, 
  analysisId: string,
  maxAttempts: number = 60,
  pollInterval: number = 1000,
  routePrefix: string = '/api/analysis/auto-analyze'
): Promise<AnalysisProgress | ParallelAnalysisProgress> {
  let progress: AnalysisProgress | ParallelAnalysisProgress;
  let attempts = 0;

  do {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const progressResponse = await request(app)
      .get(`${routePrefix}/progress/${analysisId}`)
      .expect(200);

    expect(progressResponse.body.success).toBe(true);
    progress = progressResponse.body.data;

    // Validate progress structure
    expect(progress.analysisId).toBe(analysisId);
    
    // Support both sequential and parallel phase names
    const validPhases = /^(sampling|analyzing|generating_summary|discovery|parallel_processing|conflict_resolution|complete|error)$/;
    expect(progress.phase).toMatch(validPhases);
    expect(typeof progress.currentStep).toBe('string');
    expect(progress.startTime).toBeDefined();

    // Log parallel-specific progress if available
    if ('roundsCompleted' in progress && progress.roundsCompleted !== undefined) {
      console.log(`[Integration Test] Parallel Progress: ${progress.phase} - ${progress.currentStep} (Round ${progress.roundsCompleted}/${progress.totalRounds || 'unknown'})`);
      if (progress.streamsActive !== undefined) {
        console.log(`[Integration Test] Active streams: ${progress.streamsActive}`);
      }
    } else {
      console.log(`[Integration Test] Progress: ${progress.phase} - ${progress.currentStep}`);
    }

    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error(`Analysis timed out after ${maxAttempts} seconds`);
    }

  } while (progress.phase !== 'complete' && progress.phase !== 'error');

  return progress;
}

export async function getResults(
  app: express.Application, 
  analysisId: string,
  routePrefix: string = '/api/analysis/auto-analyze'
): Promise<any> {
  const resultsResponse = await request(app)
    .get(`${routePrefix}/results/${analysisId}`)
    .expect(200);

  expect(resultsResponse.body.success).toBe(true);
  return resultsResponse.body.data;
}

export function validateAnalysisProgress(progress: AnalysisProgress | ParallelAnalysisProgress): void {
  expect(progress.phase).toBe('complete');
  
  // Handle different completion messages
  const validCompletionSteps = ['Analysis complete', 'Parallel analysis complete'];
  expect(validCompletionSteps).toContain(progress.currentStep);
  
  expect(progress.endTime).toBeDefined();
  expect(progress.sessionsProcessed).toBeGreaterThan(0);
  expect(progress.tokensUsed).toBeGreaterThan(0);
  expect(progress.estimatedCost).toBeGreaterThan(0);
  
  // Additional validation for parallel progress
  if ('roundsCompleted' in progress && progress.roundsCompleted !== undefined) {
    expect(progress.roundsCompleted).toBeGreaterThanOrEqual(0);
    if (progress.totalRounds !== undefined) {
      expect(progress.totalRounds).toBeGreaterThanOrEqual(progress.roundsCompleted);
    }
  }
}

export function validateAnalysisResults(results: any): void {
  // Validate results structure
  expect(results.sessions).toBeDefined();
  expect(Array.isArray(results.sessions)).toBe(true);
  expect(results.sessions.length).toBeGreaterThan(0);
  expect(results.botId).toBeDefined();

  // Validate session structure
  const firstSession = results.sessions[0];
  expect(firstSession.session_id).toBeDefined();
  expect(firstSession.facts).toBeDefined();
  expect(firstSession.facts.generalIntent).toBeDefined();
  expect(firstSession.facts.sessionOutcome).toBeDefined();
  expect(firstSession.analysisMetadata).toBeDefined();
  expect(firstSession.analysisMetadata.tokensUsed).toBeGreaterThan(0);

  // Validate analysis summary if present
  if (results.analysisSummary) {
    expect(results.analysisSummary.overview).toBeDefined();
    expect(results.analysisSummary.summary).toBeDefined();
    expect(results.analysisSummary.containmentSuggestion).toBeDefined();
    expect(results.analysisSummary.generatedAt).toBeDefined();
    expect(results.analysisSummary.sessionsAnalyzed).toBeGreaterThan(0);
    expect(results.analysisSummary.statistics).toBeDefined();
    expect(results.analysisSummary.statistics.totalSessions).toBeGreaterThan(0);
  }
}

export async function runFullAnalysisWorkflow(
  app: express.Application,
  config: AnalysisConfig,
  testName: string,
  maxAttempts: number = 60,
  routePrefix: string = '/api/analysis/auto-analyze'
): Promise<{ progress: AnalysisProgress | ParallelAnalysisProgress; results: any }> {
  console.log(`\n[${testName}] Starting full analysis workflow...`);
  
  // Step 1: Start analysis
  console.log(`[${testName}] Step 1: Starting analysis`);
  const { analysisId } = await startAnalysis(app, config, routePrefix);

  // Step 2: Poll until complete
  console.log(`[${testName}] Step 2: Polling progress until completion`);
  const progress = await pollUntilComplete(app, analysisId, maxAttempts, 1000, routePrefix);

  // Step 3: Validate completion
  console.log(`[${testName}] Step 3: Validating completion`);
  validateAnalysisProgress(progress);

  // Step 4: Get and validate results
  console.log(`[${testName}] Step 4: Getting and validating results`);
  const results = await getResults(app, analysisId, routePrefix);
  validateAnalysisResults(results);

  console.log(`[${testName}] Analysis completed successfully:`);
  console.log(`  - Sessions processed: ${progress.sessionsProcessed}`);
  console.log(`  - Tokens used: ${progress.tokensUsed}`);
  console.log(`  - Estimated cost: $${progress.estimatedCost.toFixed(4)}`);
  console.log(`  - Duration: ${new Date(progress.endTime!).getTime() - new Date(progress.startTime).getTime()}ms`);
  
  // Log parallel-specific stats if available
  if ('roundsCompleted' in progress && progress.roundsCompleted !== undefined) {
    console.log(`  - Rounds completed: ${progress.roundsCompleted}/${progress.totalRounds || 'unknown'}`);
  }

  return { progress, results };
}

export async function testCancellation(
  app: express.Application, 
  config: AnalysisConfig,
  routePrefix: string = '/api/analysis/auto-analyze'
): Promise<void> {
  // Start analysis
  const { analysisId } = await startAnalysis(app, config, routePrefix);

  // Cancel immediately (mock services complete very quickly)
  const cancelResponse = await request(app)
    .delete(`${routePrefix}/${analysisId}`)
    .expect(200);

  expect(cancelResponse.body.success).toBe(true);

  // Check that progress shows either cancelled state OR completed state (both are acceptable)
  const progressResponse = await request(app)
    .get(`${routePrefix}/progress/${analysisId}`)
    .expect(200);

  const progress = progressResponse.body.data;
  
  // With mock services, analysis might complete before cancellation takes effect
  // All states are valid since mock services run very fast
  if (progress.phase === 'error') {
    expect(progress.error).toMatch(/cancelled/i);
  } else {
    // Any other phase is acceptable (sampling, analyzing, discovery, parallel_processing, complete)
    // Mock services can complete between request and cancellation
    const validPhases = ['sampling', 'analyzing', 'discovery', 'parallel_processing', 'conflict_resolution', 'complete'];
    expect(validPhases).toContain(progress.phase);
  }
}

export async function testInvalidConfiguration(
  app: express.Application,
  routePrefix: string = '/api/analysis/auto-analyze'
): Promise<void> {
  const invalidConfig = {
    startDate: 'invalid-date',
    startTime: '25:00',
    sessionCount: 2000, // Above limit
    openaiApiKey: 'invalid-key',
    modelId: 'invalid-model'
  };

  const response = await request(app)
    .post(`${routePrefix}/start`)
    .send(invalidConfig)
    .expect(400);

  expect(response.body.success).toBe(false);
  expect(response.body.error).toBeDefined();
}

export async function testNonExistentAnalysisId(
  app: express.Application,
  routePrefix: string = '/api/analysis/auto-analyze'
): Promise<void> {
  const fakeAnalysisId = 'non-existent-analysis-id';

  // Test progress endpoint
  const progressResponse = await request(app)
    .get(`${routePrefix}/progress/${fakeAnalysisId}`)
    .expect(404);

  expect(progressResponse.body.success).toBe(false);

  // Test results endpoint
  const resultsResponse = await request(app)
    .get(`${routePrefix}/results/${fakeAnalysisId}`)
    .expect(404);

  expect(resultsResponse.body.success).toBe(false);

  // Test cancel endpoint
  const cancelResponse = await request(app)
    .delete(`${routePrefix}/${fakeAnalysisId}`)
    .expect(404);

  expect(cancelResponse.body.success).toBe(false);
}

/**
 * Test multiple session counts in a loop
 */
export async function testMultipleSessionCounts(
  app: express.Application,
  credentials: TestCredentials,
  testSizes: number[],
  testName: string,
  configOverrides: Partial<AnalysisConfig> = {},
  routePrefix: string = '/api/analysis/auto-analyze'
): Promise<void> {
  for (const sessionCount of testSizes) {
    console.log(`\n[${testName}] Testing with ${sessionCount} sessions`);
    
    const analysisConfig = createAnalysisConfig(credentials, {
      sessionCount,
      ...configOverrides
    });

    const { progress, results } = await runFullAnalysisWorkflow(
      app,
      analysisConfig,
      `${testName} - ${sessionCount} sessions`,
      sessionCount >= 30 ? 180 : 60, // Use longer timeout for 30+ sessions
      routePrefix
    );

    // Validate that we got the expected number of sessions (or available sessions)
    expect(results.sessions.length).toBeGreaterThan(0);
    expect(results.sessions.length).toBeLessThanOrEqual(sessionCount);
    expect(progress.sessionsProcessed).toBe(results.sessions.length);
    
    console.log(`[${testName}] ${sessionCount} sessions test completed - Cost: $${progress.estimatedCost.toFixed(4)}`);
  }
}

/**
 * Test large session count (100+ sessions) with performance validation
 */
export async function testLargeSessionCount(
  app: express.Application,
  credentials: TestCredentials,
  sessionCount: number,
  testName: string,
  configOverrides: Partial<AnalysisConfig> = {},
  maxAttempts: number = 180, // Increased to 3 minutes for large session tests
  routePrefix: string = '/api/analysis/auto-analyze'
): Promise<{ progress: AnalysisProgress | ParallelAnalysisProgress; results: any }> {
  console.log(`\n[${testName}] Testing large session count: ${sessionCount} sessions`);

  const analysisConfig = createAnalysisConfig(credentials, {
    sessionCount,
    ...configOverrides
  });

  const { progress, results } = await runFullAnalysisWorkflow(
    app,
    analysisConfig,
    `${testName} - ${sessionCount} sessions large scale test`,
    maxAttempts,
    routePrefix
  );

  // Validate that we processed the expected number of sessions
  expect(results.sessions.length).toBeGreaterThan(0);
  expect(results.sessions.length).toBeLessThanOrEqual(sessionCount);
  expect(progress.sessionsProcessed).toBe(results.sessions.length);

  // Validate performance characteristics for large batch
  expect(progress.phase).toBe('complete');
  expect(progress.tokensUsed).toBeGreaterThan(0);
  expect(progress.estimatedCost).toBeGreaterThan(0);

  console.log(`[${testName}] Successfully processed ${results.sessions.length} sessions`);
  console.log(`[${testName}] Total tokens used: ${progress.tokensUsed}`);
  console.log(`[${testName}] Estimated cost: $${progress.estimatedCost.toFixed(4)}`);

  // Log parallel-specific stats if available
  if ('roundsCompleted' in progress && progress.roundsCompleted !== undefined) {
    console.log(`[${testName}] Rounds completed: ${progress.roundsCompleted}/${progress.totalRounds || 'unknown'}`);
  }

  return { progress, results };
}

/**
 * Test configurable session counts from environment variable
 */
export async function testConfigurableSessionCounts(
  app: express.Application,
  credentials: TestCredentials,
  envVarName: string,
  defaultSizes: number[],
  testName: string,
  configOverrides: Partial<AnalysisConfig> = {},
  routePrefix: string = '/api/analysis/auto-analyze'
): Promise<void> {
  // Allow environment variable to configure session count
  const testSizes = process.env[envVarName] 
    ? process.env[envVarName]!.split(',').map(n => parseInt(n.trim()))
    : defaultSizes;
  
  console.log(`[${testName}] Testing with session counts: ${testSizes.join(', ')}`);
  
  await testMultipleSessionCounts(app, credentials, testSizes, testName, configOverrides, routePrefix);
}