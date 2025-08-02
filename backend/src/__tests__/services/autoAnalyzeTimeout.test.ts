import { AutoAnalyzeService } from '../../services/autoAnalyzeService';
import { SessionSamplingService } from '../../services/sessionSamplingService';
import { KoreApiService } from '../../services/koreApiService';
import { AnalysisConfig } from '../../../../shared/types';

// Mock the dependencies
jest.mock('../../services/sessionSamplingService');
jest.mock('../../services/koreApiService');

describe('AutoAnalyzeService - Timeout Issues (TDD)', () => {
  let autoAnalyzeService: AutoAnalyzeService;
  let mockSessionSamplingService: jest.Mocked<SessionSamplingService>;
  let mockKoreApiService: jest.Mocked<KoreApiService>;

  beforeEach(() => {
    mockSessionSamplingService = {
      sampleSessions: jest.fn()
    } as any;

    mockKoreApiService = {} as any;

    (SessionSamplingService as jest.MockedClass<typeof SessionSamplingService>)
      .mockImplementation(() => mockSessionSamplingService);

    autoAnalyzeService = AutoAnalyzeService.create('test-bot-id', 'test-jwt-token', {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret'
    });
    
    // Replace the internal service with our mock
    (autoAnalyzeService as any).sessionSamplingService = mockSessionSamplingService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Current Implementation Issues', () => {
    it('SHOULD NOW PASS: startAnalysis returns immediately despite long session sampling (async fixed)', async () => {
      const config: AnalysisConfig = {
        startDate: '2025-08-01',
        startTime: '13:00',
        sessionCount: 100,
        openaiApiKey: 'sk-test-key',
        modelId: 'gpt-4o-mini'
      };

      // Mock session sampling to take 45 seconds (exceeds API Gateway 29s timeout)
      mockSessionSamplingService.sampleSessions.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ sessions: [], timeWindows: [], totalFound: 0 });
          }, 45000); // 45 seconds - will cause timeout
        });
      });

      // With async implementation, this should return immediately
      const startTime = Date.now();
      
      const result = await autoAnalyzeService.startAnalysis(config);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should return immediately (under 1 second), not wait for the 45-second sampling
      expect(duration).toBeLessThan(1000);
      expect(result).toEqual(expect.objectContaining({
        analysisId: expect.any(String),
        backgroundJobId: expect.any(String),
        status: 'started'
      }));
    });

    it('SHOULD FAIL: progress polling continues for dead analysis', async () => {
      const config: AnalysisConfig = {
        startDate: '2025-08-01',
        startTime: '13:00',
        sessionCount: 100,
        openaiApiKey: 'sk-test-key',
        modelId: 'gpt-4o-mini'
      };

      // Mock session sampling to fail after timeout
      mockSessionSamplingService.sampleSessions.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Lambda timeout'));
          }, 100);
        });
      });

      // Start analysis - should fail quickly
      let analysisId: string;
      try {
        const result = await autoAnalyzeService.startAnalysis(config);
        analysisId = result.analysisId;
      } catch (error) {
        // Analysis start fails, but analysisId was created
        analysisId = 'orphaned-analysis-id';
      }

      // Progress polling should detect that the analysis is dead/orphaned
      // With async architecture, the background job should fail and update progress
      const progress1 = await autoAnalyzeService.getProgress(analysisId);
      
      // Wait for background job to fail and update progress
      await new Promise(resolve => setTimeout(resolve, 500));
      const progress2 = await autoAnalyzeService.getProgress(analysisId);
      
      // The async implementation should detect background job failures
      expect(progress2.phase).toBe('error'); // Should be 'error' due to background job failure
      expect(progress2.error).toBeDefined(); // Should have error information
    });

    it('SHOULD NOW PASS: multiple concurrent analyses start immediately (async fixed)', async () => {
      const config: AnalysisConfig = {
        startDate: '2025-08-01',
        startTime: '13:00',
        sessionCount: 100,
        openaiApiKey: 'sk-test-key',
        modelId: 'gpt-4o-mini'
      };

      // Mock session sampling to take significant time
      mockSessionSamplingService.sampleSessions.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ sessions: [], timeWindows: [], totalFound: 0 }), 1000);
        });
      });

      // Start multiple analyses concurrently
      const promises = Array.from({ length: 5 }, () => 
        autoAnalyzeService.startAnalysis(config)
      );

      // With async implementation, these should all start immediately
      const startTime = Date.now();
      
      const results = await Promise.allSettled(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // With async processing, all analyses start immediately (parallel execution)
      expect(duration).toBeLessThan(2000); // Should be very fast now
      
      // All analyses should succeed in starting
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value).toEqual(expect.objectContaining({
            analysisId: expect.any(String),
            backgroundJobId: expect.any(String),
            status: 'started'
          }));
        }
      });
    });

    it('SHOULD NOW PASS: analysis starts immediately even when background job will fail (async fixed)', async () => {
      const config: AnalysisConfig = {
        startDate: '2025-08-01',
        startTime: '13:00',
        sessionCount: 100,
        openaiApiKey: 'sk-test-key',
        modelId: 'gpt-4o-mini'
      };

      // Start analysis
      mockSessionSamplingService.sampleSessions.mockImplementation(() => {
        // Simulate Lambda being killed mid-process
        throw new Error('Lambda timeout - process terminated');
      });

      // Analysis start should succeed immediately, even though background job will fail
      const result = await autoAnalyzeService.startAnalysis(config);
      
      expect(result).toEqual(expect.objectContaining({
        analysisId: expect.any(String),
        backgroundJobId: expect.any(String),
        status: 'started'
      }));

      // Analysis start should succeed immediately, even though background job will fail
      const startResult = await autoAnalyzeService.startAnalysis(config);
      const analysisId = startResult.analysisId;
      
      expect(startResult).toEqual(expect.objectContaining({
        analysisId: expect.any(String),
        backgroundJobId: expect.any(String),
        status: 'started'
      }));
      
      // Wait for background job to fail and propagate error back
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Analysis progress should now reflect the background job failure
      const progress = await autoAnalyzeService.getProgress(analysisId);
      expect(progress.phase).toBe('error');
      expect(progress.error).toBeDefined();
    });
  });

  describe('Required Async Architecture (Currently Missing)', () => {
    it('SHOULD PASS WHEN IMPLEMENTED: startAnalysis returns immediately with background processing', async () => {
      const config: AnalysisConfig = {
        startDate: '2025-08-01',
        startTime: '13:00',
        sessionCount: 100,
        openaiApiKey: 'sk-test-key',
        modelId: 'gpt-4o-mini'
      };

      // Mock long-running session sampling
      mockSessionSamplingService.sampleSessions.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ sessions: [], timeWindows: [], totalFound: 0 }), 30000); // 30 seconds
        });
      });

      const startTime = Date.now();
      
      // With async architecture, this should return immediately
      const result = await autoAnalyzeService.startAnalysis(config);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should return in under 1 second with analysis result object
      expect(duration).toBeLessThan(1000);
      expect(result).toEqual(expect.objectContaining({
        analysisId: expect.any(String),
        backgroundJobId: expect.any(String),
        status: 'started'
      }));
    });

    it('SHOULD PASS WHEN IMPLEMENTED: progress tracking works with background jobs', async () => {
      const config: AnalysisConfig = {
        startDate: '2025-08-01',
        startTime: '13:00',
        sessionCount: 100,
        openaiApiKey: 'sk-test-key',
        modelId: 'gpt-4o-mini'
      };

      // Start analysis with async architecture
      const result = await autoAnalyzeService.startAnalysis(config);
      const analysisId = result.analysisId;

      // Initial progress should show background job queued
      const initialProgress = await autoAnalyzeService.getProgress(analysisId);
      expect(initialProgress).toEqual(expect.objectContaining({
        phase: 'sampling'
      }));

      // Progress should update as background job runs
      // This would require the background job system to be implemented
    });

    it('SHOULD PASS WHEN IMPLEMENTED: timeout protection with proper error handling', async () => {
      const config: AnalysisConfig = {
        startDate: '2025-08-01',
        startTime: '13:00',
        sessionCount: 100,
        openaiApiKey: 'sk-test-key',
        modelId: 'gpt-4o-mini'
      };

      // Start analysis - should succeed immediately
      const analysisResult = await autoAnalyzeService.startAnalysis(config);
      const analysisId = analysisResult.analysisId;

      // Wait for background job to fail (mocks will cause immediate failure)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check that analysis progress reflects the background job failure
      const finalProgress = await autoAnalyzeService.getProgress(analysisId);
      expect(finalProgress.phase).toBe('error');
      expect(finalProgress.error).toBeDefined();
    });
  });
});