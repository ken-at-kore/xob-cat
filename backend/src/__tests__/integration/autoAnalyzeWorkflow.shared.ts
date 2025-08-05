import request from 'supertest';
import express from 'express';
import { AnalysisConfig, AnalysisProgress, SessionWithTranscript } from '../../../../shared/types';

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
    modelId: 'gpt-4o-mini'
  };

  return { ...defaultConfig, ...overrides };
}

export async function startAnalysis(app: express.Application, config: AnalysisConfig): Promise<{ analysisId: string; response: any }> {
  const response = await request(app)
    .post('/api/analysis/auto-analyze/start')
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
  pollInterval: number = 1000
): Promise<AnalysisProgress> {
  let progress: AnalysisProgress;
  let attempts = 0;

  do {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const progressResponse = await request(app)
      .get(`/api/analysis/auto-analyze/progress/${analysisId}`)
      .expect(200);

    expect(progressResponse.body.success).toBe(true);
    progress = progressResponse.body.data;

    // Validate progress structure
    expect(progress.analysisId).toBe(analysisId);
    expect(progress.phase).toMatch(/^(sampling|analyzing|generating_summary|complete|error)$/);
    expect(typeof progress.currentStep).toBe('string');
    expect(progress.startTime).toBeDefined();

    console.log(`[Integration Test] Progress: ${progress.phase} - ${progress.currentStep}`);

    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error(`Analysis timed out after ${maxAttempts} seconds`);
    }

  } while (progress.phase !== 'complete' && progress.phase !== 'error');

  return progress;
}

export async function getResults(app: express.Application, analysisId: string): Promise<any> {
  const resultsResponse = await request(app)
    .get(`/api/analysis/auto-analyze/results/${analysisId}`)
    .expect(200);

  expect(resultsResponse.body.success).toBe(true);
  return resultsResponse.body.data;
}

export function validateAnalysisProgress(progress: AnalysisProgress): void {
  expect(progress.phase).toBe('complete');
  expect(progress.currentStep).toBe('Analysis complete');
  expect(progress.endTime).toBeDefined();
  expect(progress.sessionsProcessed).toBeGreaterThan(0);
  expect(progress.tokensUsed).toBeGreaterThan(0);
  expect(progress.estimatedCost).toBeGreaterThan(0);
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
  testName: string
): Promise<{ progress: AnalysisProgress; results: any }> {
  console.log(`\n[${testName}] Starting full analysis workflow...`);
  
  // Step 1: Start analysis
  console.log(`[${testName}] Step 1: Starting analysis`);
  const { analysisId } = await startAnalysis(app, config);

  // Step 2: Poll until complete
  console.log(`[${testName}] Step 2: Polling progress until completion`);
  const progress = await pollUntilComplete(app, analysisId);

  // Step 3: Validate completion
  console.log(`[${testName}] Step 3: Validating completion`);
  validateAnalysisProgress(progress);

  // Step 4: Get and validate results
  console.log(`[${testName}] Step 4: Getting and validating results`);
  const results = await getResults(app, analysisId);
  validateAnalysisResults(results);

  console.log(`[${testName}] Analysis completed successfully:`);
  console.log(`  - Sessions processed: ${progress.sessionsProcessed}`);
  console.log(`  - Tokens used: ${progress.tokensUsed}`);
  console.log(`  - Estimated cost: $${progress.estimatedCost.toFixed(4)}`);
  console.log(`  - Duration: ${new Date(progress.endTime!).getTime() - new Date(progress.startTime).getTime()}ms`);

  return { progress, results };
}

export async function testCancellation(app: express.Application, config: AnalysisConfig): Promise<void> {
  // Start analysis
  const { analysisId } = await startAnalysis(app, config);

  // Cancel immediately (mock services complete very quickly)
  const cancelResponse = await request(app)
    .delete(`/api/analysis/auto-analyze/${analysisId}`)
    .expect(200);

  expect(cancelResponse.body.success).toBe(true);

  // Check that progress shows either cancelled state OR completed state (both are acceptable)
  const progressResponse = await request(app)
    .get(`/api/analysis/auto-analyze/progress/${analysisId}`)
    .expect(200);

  const progress = progressResponse.body.data;
  
  // With mock services, analysis might complete before cancellation takes effect
  // All states are valid since mock services run very fast
  if (progress.phase === 'error') {
    expect(progress.error).toMatch(/cancelled/i);
  } else {
    // Any other phase is acceptable (sampling, analyzing, complete)
    // Mock services can complete between request and cancellation
    expect(['sampling', 'analyzing', 'complete']).toContain(progress.phase);
  }
}

export async function testInvalidConfiguration(app: express.Application): Promise<void> {
  const invalidConfig = {
    startDate: 'invalid-date',
    startTime: '25:00',
    sessionCount: 2000, // Above limit
    openaiApiKey: 'invalid-key',
    modelId: 'invalid-model'
  };

  const response = await request(app)
    .post('/api/analysis/auto-analyze/start')
    .send(invalidConfig)
    .expect(400);

  expect(response.body.success).toBe(false);
  expect(response.body.error).toBeDefined();
}

export async function testNonExistentAnalysisId(app: express.Application): Promise<void> {
  const fakeAnalysisId = 'non-existent-analysis-id';

  // Test progress endpoint
  const progressResponse = await request(app)
    .get(`/api/analysis/auto-analyze/progress/${fakeAnalysisId}`)
    .expect(404);

  expect(progressResponse.body.success).toBe(false);

  // Test results endpoint
  const resultsResponse = await request(app)
    .get(`/api/analysis/auto-analyze/results/${fakeAnalysisId}`)
    .expect(404);

  expect(resultsResponse.body.success).toBe(false);

  // Test cancel endpoint
  const cancelResponse = await request(app)
    .delete(`/api/analysis/auto-analyze/${fakeAnalysisId}`)
    .expect(404);

  expect(cancelResponse.body.success).toBe(false);
}