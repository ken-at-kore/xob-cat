import { ParallelAutoAnalyzeService } from '../../services/parallelAutoAnalyzeService';
import { SessionSamplingService } from '../../services/sessionSamplingService';
import { StrategicDiscoveryService } from '../../services/strategicDiscoveryService';
import { ParallelProcessingOrchestratorService } from '../../services/parallelProcessingOrchestratorService';
import { ConflictResolutionService } from '../../services/conflictResolutionService';
import { BatchAnalysisService } from '../../services/batchAnalysisService';
import { AnalysisSummaryService } from '../../services/analysisSummaryService';
import { getBackgroundJobQueue } from '../../services/backgroundJobQueue';
import { IKoreApiService, IOpenAIService } from '../../interfaces';
import { 
  AnalysisConfig, 
  SessionWithTranscript,
  SessionWithFacts,
  AnalysisResults,
  BackgroundJob,
  ParallelAnalysisProgress 
} from '../../../../shared/types';

// Mock dependencies
jest.mock('../../services/backgroundJobQueue');
jest.mock('../../services/analysisSummaryService');

const mockKoreApiService = {
  authenticate: jest.fn(),
  getSessionsMetadata: jest.fn(),
  getMessagesForSessions: jest.fn()
} as jest.Mocked<IKoreApiService>;

const mockSessionSamplingService = {
  sampleSessions: jest.fn()
} as jest.Mocked<SessionSamplingService>;

const mockBatchAnalysisService = {
  processSessionsBatch: jest.fn()
} as jest.Mocked<BatchAnalysisService>;

const mockOpenAIService = {
  analyzeBatch: jest.fn(),
  calculateCost: jest.fn()
} as jest.Mocked<IOpenAIService>;

const mockBackgroundJobQueue = {
  enqueue: jest.fn(),
  getJob: jest.fn(),
  updateJob: jest.fn()
};

const mockAnalysisSummaryService = {
  generateAnalysisSummary: jest.fn()
};

(getBackgroundJobQueue as jest.Mock).mockReturnValue(mockBackgroundJobQueue);
(AnalysisSummaryService as jest.MockedClass<typeof AnalysisSummaryService>).mockImplementation(() => mockAnalysisSummaryService as any);

describe('ParallelAutoAnalyzeService', () => {
  let parallelAutoAnalyzeService: ParallelAutoAnalyzeService;

  const mockConfig: AnalysisConfig = {
    startDate: '2024-01-01',
    startTime: '10:00',
    sessionCount: 50,
    openaiApiKey: 'sk-test-key',
    modelId: 'gpt-4o-mini',
    timezone: 'America/New_York'
  };

  const mockSessions: SessionWithTranscript[] = Array.from({ length: 50 }, (_, i) => ({
    user_id: `user${i + 1}`,
    session_id: `session${i + 1}`,
    start_time: '2024-01-01T10:00:00Z',
    end_time: '2024-01-01T10:30:00Z',
    messages: [
      { from: 'user', message: `Test message ${i + 1}` },
      { from: 'bot', message: 'I can help with that' }
    ]
  }));

  const mockProcessedSessions: SessionWithFacts[] = mockSessions.slice(0, 10).map((session, i) => ({
    ...session,
    facts: {
      generalIntent: `Intent ${i + 1}`,
      sessionOutcome: i % 2 === 0 ? 'Contained' : 'Transfer',
      transferReason: i % 2 === 0 ? '' : 'Technical Issue',
      dropOffLocation: i % 2 === 0 ? '' : 'Agent Queue',
      notes: `Analysis ${i + 1}`
    },
    analysisMetadata: {
      tokensUsed: 100,
      processingTime: 1000,
      batchNumber: 1,
      timestamp: '2024-01-01T12:00:00Z',
      model: 'gpt-4o-mini'
    }
  }));

  const mockSamplingResult = {
    sessions: mockSessions,
    samplingStats: {
      targetCount: 50,
      actualCount: 50,
      windows: []
    }
  };

  const mockDiscoveryResult = {
    baseClassifications: {
      generalIntent: new Set(['Intent1', 'Intent2']),
      transferReason: new Set(['Technical Issue']),
      dropOffLocation: new Set(['Agent Queue'])
    },
    processedSessions: mockProcessedSessions.slice(0, 5),
    remainingSessions: mockSessions.slice(5),
    discoveryStats: {
      totalProcessed: 5,
      uniqueIntents: 2,
      uniqueReasons: 1,
      uniqueLocations: 1,
      discoveryRate: 0.8
    },
    tokenUsage: {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      cost: 0.01,
      model: 'gpt-4o-mini'
    }
  };

  const mockParallelResult = {
    processedSessions: mockProcessedSessions.slice(5),
    finalClassifications: {
      generalIntent: new Set(['Intent3', 'Intent4']),
      transferReason: new Set(['System Error']),
      dropOffLocation: new Set(['Home Page'])
    },
    totalTokenUsage: {
      promptTokens: 2000,
      completionTokens: 1000,
      totalTokens: 3000,
      cost: 0.02,
      model: 'gpt-4o-mini'
    },
    streamResults: [],
    processingStats: {
      totalRounds: 2,
      averageStreamUtilization: 0.9
    }
  };

  const mockConflictResult = {
    resolvedSessions: mockProcessedSessions,
    resolutions: {
      generalIntents: [],
      transferReasons: [],
      dropOffLocations: []
    },
    resolutionStats: {
      conflictsFound: 2,
      conflictsResolved: 2
    },
    tokenUsage: {
      promptTokens: 500,
      completionTokens: 250,
      totalTokens: 750,
      cost: 0.005,
      model: 'gpt-4o-mini'
    }
  };

  const mockAnalysisSummary = {
    overview: 'Test analysis overview',
    summary: 'Test analysis summary',
    containmentSuggestion: 'Improve bot training',
    generatedAt: '2025-08-15T00:00:00Z',
    sessionsAnalyzed: 50,
    statistics: {
      totalSessions: 50,
      transferRate: 50,
      containmentRate: 50,
      averageSessionLength: 120,
      averageMessagesPerSession: 8
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockSessionSamplingService.sampleSessions.mockResolvedValue(mockSamplingResult);
    mockBackgroundJobQueue.enqueue.mockResolvedValue(undefined);
    mockBackgroundJobQueue.getJob.mockResolvedValue(null);
    mockAnalysisSummaryService.generateAnalysisSummary.mockResolvedValue(mockAnalysisSummary);
    
    parallelAutoAnalyzeService = new ParallelAutoAnalyzeService(
      mockKoreApiService,
      mockSessionSamplingService,
      mockBatchAnalysisService,
      mockOpenAIService,
      'test-bot-id'
    );
  });

  describe('startAnalysis', () => {
    it('should start analysis and return job information', async () => {
      const result = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      expect(result.status).toBe('started');
      expect(result.message).toBe('Parallel analysis started in background');
      expect(result.analysisId).toBeDefined();
      expect(result.backgroundJobId).toBeDefined();
      expect(mockBackgroundJobQueue.enqueue).toHaveBeenCalled();
    });

    it('should create background job with correct configuration', async () => {
      await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      const enqueuedJob = mockBackgroundJobQueue.enqueue.mock.calls[0]![0] as BackgroundJob;
      expect(enqueuedJob.config).toEqual(mockConfig);
      expect(enqueuedJob.status).toBe('queued');
      expect(enqueuedJob.phase).toBe('sampling');
      expect(enqueuedJob.progress.modelId).toBe('gpt-4o-mini');
      expect(enqueuedJob.progress.totalSessions).toBe(50);
    });

    it('should handle credentials correctly', async () => {
      const serviceWithCredentials = new ParallelAutoAnalyzeService(
        mockKoreApiService,
        mockSessionSamplingService,
        mockBatchAnalysisService,
        mockOpenAIService,
        'test-bot-id',
        { clientId: 'test-client', clientSecret: 'test-secret' }
      );

      await serviceWithCredentials.startAnalysis(mockConfig);
      
      const enqueuedJob = mockBackgroundJobQueue.enqueue.mock.calls[0]![0] as BackgroundJob;
      expect(enqueuedJob.credentials).toEqual({
        botId: 'test-bot-id',
        clientId: 'test-client',
        clientSecret: 'test-secret'
      });
    });
  });

  describe('getProgress', () => {
    it('should return progress for active analysis', async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      const progress = await parallelAutoAnalyzeService.getProgress(startResult.analysisId);
      
      expect(progress.analysisId).toBe(startResult.analysisId);
      expect(progress.phase).toBe('sampling');
      expect(progress.totalSessions).toBe(50);
      expect(progress.botId).toBe('test-bot-id');
    });

    it('should update progress from background job', async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      const mockBackgroundJob: BackgroundJob = {
        id: startResult.backgroundJobId,
        analysisId: startResult.analysisId,
        status: 'running',
        phase: 'discovery',
        createdAt: new Date(),
        progress: {
          analysisId: startResult.analysisId,
          phase: 'discovery',
          currentStep: 'Processing discovery phase',
          sessionsFound: 50,
          sessionsProcessed: 10,
          totalSessions: 50,
          batchesCompleted: 2,
          totalBatches: 10,
          tokensUsed: 1500,
          estimatedCost: 0.01,
          modelId: 'gpt-4o-mini',
          botId: 'test-bot-id',
          startTime: new Date().toISOString(),
          backgroundJobId: startResult.backgroundJobId,
          backgroundJobStatus: 'running',
          roundsCompleted: 1,
          totalRounds: 3,
          streamsActive: 2
        } as ParallelAnalysisProgress,
        config: mockConfig
      };
      
      mockBackgroundJobQueue.getJob.mockResolvedValue(mockBackgroundJob);
      
      const progress = await parallelAutoAnalyzeService.getProgress(startResult.analysisId);
      
      expect(progress.phase).toBe('discovery');
      expect(progress.currentStep).toBe('Processing discovery phase');
      expect(progress.sessionsProcessed).toBe(10);
      expect(progress.backgroundJobStatus).toBe('running');
    });

    it('should handle failed background jobs', async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      const failedJob: BackgroundJob = {
        id: startResult.backgroundJobId,
        analysisId: startResult.analysisId,
        status: 'failed',
        phase: 'error',
        createdAt: new Date(),
        progress: {} as ParallelAnalysisProgress,
        config: mockConfig,
        error: 'Background processing failed'
      };
      
      mockBackgroundJobQueue.getJob.mockResolvedValue(failedJob);
      
      const progress = await parallelAutoAnalyzeService.getProgress(startResult.analysisId);
      
      expect(progress.phase).toBe('error');
      expect(progress.error).toBe('Background processing failed');
      expect(progress.endTime).toBeDefined();
    });

    it('should throw error for unknown analysis', async () => {
      await expect(parallelAutoAnalyzeService.getProgress('unknown-id')).rejects.toThrow('Analysis not found');
    });
  });

  describe('getResults', () => {
    it('should return results for completed analysis', async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      // Store mock results
      const mockResults: AnalysisResults = {
        sessions: mockProcessedSessions,
        analysisSummary: mockAnalysisSummary,
        botId: 'test-bot-id'
      };
      
      await parallelAutoAnalyzeService.storeResults(startResult.analysisId, mockResults);
      
      const results = await parallelAutoAnalyzeService.getResults(startResult.analysisId);
      
      expect(results.sessions).toEqual(mockProcessedSessions);
      expect(results.analysisSummary).toEqual(mockAnalysisSummary);
      expect(results.botId).toBe('test-bot-id');
    });

    it('should throw error for incomplete analysis', async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      await expect(parallelAutoAnalyzeService.getResults(startResult.analysisId)).rejects.toThrow('Analysis not complete');
    });

    it('should throw error for unknown analysis', async () => {
      await expect(parallelAutoAnalyzeService.getResults('unknown-id')).rejects.toThrow('Analysis not found');
    });
  });

  describe('getConfig', () => {
    it('should return config for active analysis', async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      const config = await parallelAutoAnalyzeService.getConfig(startResult.analysisId);
      
      expect(config).toEqual(mockConfig);
    });

    it('should throw error for unknown analysis', async () => {
      await expect(parallelAutoAnalyzeService.getConfig('unknown-id')).rejects.toThrow('Analysis not found');
    });
  });

  describe('cancelAnalysis', () => {
    it('should cancel active analysis', async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      const cancelled = await parallelAutoAnalyzeService.cancelAnalysis(startResult.analysisId);
      
      expect(cancelled).toBe(true);
      
      const progress = await parallelAutoAnalyzeService.getProgress(startResult.analysisId);
      expect(progress.phase).toBe('error');
      expect(progress.error).toBe('Cancelled');
      expect(progress.endTime).toBeDefined();
    });

    it('should not cancel completed analysis', async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      // Mark as complete
      const mockResults: AnalysisResults = {
        sessions: mockProcessedSessions,
        analysisSummary: mockAnalysisSummary,
        botId: 'test-bot-id'
      };
      await parallelAutoAnalyzeService.storeResults(startResult.analysisId, mockResults);
      
      const cancelled = await parallelAutoAnalyzeService.cancelAnalysis(startResult.analysisId);
      
      expect(cancelled).toBe(false);
    });

    it('should throw error for unknown analysis', async () => {
      await expect(parallelAutoAnalyzeService.cancelAnalysis('unknown-id')).rejects.toThrow('Analysis not found');
    });
  });

  describe('storeResults', () => {
    it('should store results and mark analysis complete', async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      const mockResults: AnalysisResults = {
        sessions: mockProcessedSessions,
        analysisSummary: mockAnalysisSummary,
        botId: 'test-bot-id'
      };
      
      await parallelAutoAnalyzeService.storeResults(startResult.analysisId, mockResults);
      
      const progress = await parallelAutoAnalyzeService.getProgress(startResult.analysisId);
      expect(progress.phase).toBe('complete');
      expect(progress.currentStep).toBe('Parallel analysis complete');
      expect(progress.endTime).toBeDefined();
    });

    it('should handle unknown analysis gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockResults: AnalysisResults = {
        sessions: mockProcessedSessions,
        botId: 'test-bot-id'
      };
      
      await parallelAutoAnalyzeService.storeResults('unknown-id', mockResults);
      
      expect(consoleSpy).toHaveBeenCalledWith('Cannot store results: Analysis unknown-id not found');
      consoleSpy.mockRestore();
    });
  });

  describe('runParallelAnalysis', () => {
    let startResult: any;

    beforeEach(async () => {
      startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      // Mock all phase methods
      jest.spyOn(parallelAutoAnalyzeService as any, 'runSamplingPhase').mockResolvedValue(mockSamplingResult);
      jest.spyOn(parallelAutoAnalyzeService as any, 'runDiscoveryPhase').mockResolvedValue({
        samplingResult: mockSamplingResult,
        discoveryResult: mockDiscoveryResult
      });
      jest.spyOn(parallelAutoAnalyzeService as any, 'runParallelProcessingPhase').mockResolvedValue({
        allProcessedSessions: mockProcessedSessions,
        combinedTokenUsage: mockParallelResult.totalTokenUsage,
        parallelResult: mockParallelResult
      });
      jest.spyOn(parallelAutoAnalyzeService as any, 'runConflictResolutionPhase').mockResolvedValue(mockProcessedSessions);
      jest.spyOn(parallelAutoAnalyzeService as any, 'runSummaryGenerationPhase').mockResolvedValue(undefined);
    });

    it('should complete full parallel analysis workflow', async () => {
      await parallelAutoAnalyzeService.runParallelAnalysis(startResult.analysisId);
      
      const progress = await parallelAutoAnalyzeService.getProgress(startResult.analysisId);
      expect(progress.phase).toBe('complete');
      expect(progress.currentStep).toBe('Parallel analysis complete');
      expect(progress.endTime).toBeDefined();
    });

    it('should handle analysis cancellation', async () => {
      // Cancel the analysis mid-workflow
      jest.spyOn(parallelAutoAnalyzeService as any, 'runDiscoveryPhase').mockImplementation(async () => {
        await parallelAutoAnalyzeService.cancelAnalysis(startResult.analysisId);
        return { samplingResult: mockSamplingResult, discoveryResult: mockDiscoveryResult };
      });
      
      await parallelAutoAnalyzeService.runParallelAnalysis(startResult.analysisId);
      
      const progress = await parallelAutoAnalyzeService.getProgress(startResult.analysisId);
      expect(progress.phase).toBe('error');
      expect(progress.error).toBe('Cancelled');
    });

    it('should handle workflow errors', async () => {
      jest.spyOn(parallelAutoAnalyzeService as any, 'runDiscoveryPhase').mockRejectedValue(new Error('Discovery failed'));
      
      await parallelAutoAnalyzeService.runParallelAnalysis(startResult.analysisId);
      
      const progress = await parallelAutoAnalyzeService.getProgress(startResult.analysisId);
      expect(progress.phase).toBe('error');
      expect(progress.error).toBe('Discovery failed');
      expect(progress.endTime).toBeDefined();
    });

    it('should throw error for unknown analysis', async () => {
      await expect(parallelAutoAnalyzeService.runParallelAnalysis('unknown-id')).rejects.toThrow('Analysis session unknown-id not found');
    });
  });

  describe('accumulateTokenUsage', () => {
    it('should accumulate token usage correctly', () => {
      const usage1 = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        cost: 0.01,
        model: 'gpt-4o-mini'
      };

      const usage2 = {
        promptTokens: 800,
        completionTokens: 400,
        totalTokens: 1200,
        cost: 0.008,
        model: 'gpt-4o-mini'
      };

      const result = (parallelAutoAnalyzeService as any).accumulateTokenUsage(usage1, usage2);
      
      expect(result.promptTokens).toBe(1800);
      expect(result.completionTokens).toBe(900);
      expect(result.totalTokens).toBe(2700);
      expect(result.cost).toBeCloseTo(0.018, 3);
      expect(result.model).toBe('gpt-4o-mini');
    });
  });

  describe('phase methods', () => {
    let session: any;

    beforeEach(async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      session = (parallelAutoAnalyzeService as any).activeSessions.get(startResult.analysisId);
    });

    describe('runSamplingPhase', () => {
      it('should complete sampling phase successfully', async () => {
        const result = await (parallelAutoAnalyzeService as any).runSamplingPhase(session);
        
        expect(result.sessions).toEqual(mockSessions);
        expect(mockSessionSamplingService.sampleSessions).toHaveBeenCalledWith(
          mockConfig,
          expect.any(Function)
        );
      });
    });

    describe('runDiscoveryPhase', () => {
      it('should complete discovery phase successfully', async () => {
        jest.spyOn(parallelAutoAnalyzeService as any, 'runSamplingPhase').mockResolvedValue(mockSamplingResult);
        jest.spyOn(StrategicDiscoveryService.prototype, 'runDiscovery').mockResolvedValue(mockDiscoveryResult);
        
        const result = await (parallelAutoAnalyzeService as any).runDiscoveryPhase(session);
        
        expect(result.samplingResult).toEqual(mockSamplingResult);
        expect(result.discoveryResult).toEqual(mockDiscoveryResult);
      });
    });

    describe('runSummaryGenerationPhase', () => {
      it('should generate analysis summary', async () => {
        await (parallelAutoAnalyzeService as any).runSummaryGenerationPhase(session, mockProcessedSessions);
        
        expect(mockAnalysisSummaryService.generateAnalysisSummary).toHaveBeenCalledWith(mockProcessedSessions);
        expect(session.analysisSummary).toEqual(mockAnalysisSummary);
      });

      it('should handle summary generation errors', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockAnalysisSummaryService.generateAnalysisSummary.mockRejectedValue(new Error('Summary failed'));
        
        await (parallelAutoAnalyzeService as any).runSummaryGenerationPhase(session, mockProcessedSessions);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith('[ParallelAutoAnalyzeService] Failed to generate analysis summary:', expect.any(Error));
        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('static methods', () => {
    describe('create', () => {
      it('should create service instance with credentials', () => {
        const instance = ParallelAutoAnalyzeService.create(
          'static-bot-id',
          'jwt-token',
          { clientId: 'test-client', clientSecret: 'test-secret' }
        );
        
        expect(instance).toBeInstanceOf(ParallelAutoAnalyzeService);
        expect(ParallelAutoAnalyzeService.getInstance('static-bot-id')).toBe(instance);
      });

      it('should return existing instance', () => {
        const instance1 = ParallelAutoAnalyzeService.create('static-bot-id-2', 'jwt-token');
        const instance2 = ParallelAutoAnalyzeService.create('static-bot-id-2', 'jwt-token');
        
        expect(instance1).toBe(instance2);
      });
    });

    describe('getInstance', () => {
      it('should return undefined for non-existent instance', () => {
        const instance = ParallelAutoAnalyzeService.getInstance('non-existent-bot');
        expect(instance).toBeUndefined();
      });

      it('should return existing instance', () => {
        const createdInstance = ParallelAutoAnalyzeService.create('existing-bot', 'jwt-token');
        const retrievedInstance = ParallelAutoAnalyzeService.getInstance('existing-bot');
        
        expect(retrievedInstance).toBe(createdInstance);
      });
    });
  });

  describe('session cleanup', () => {
    it('should cleanup session after timeout', async () => {
      const startResult = await parallelAutoAnalyzeService.startAnalysis(mockConfig);
      
      // Mock setTimeout to execute immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((callback: () => void) => {
        callback();
        return null as any;
      }) as typeof setTimeout;
      
      // Simulate completion to trigger cleanup
      await parallelAutoAnalyzeService.runParallelAnalysis(startResult.analysisId);
      
      // Wait for cleanup to trigger
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify session is cleaned up
      await expect(() => parallelAutoAnalyzeService.getProgress(startResult.analysisId)).rejects.toThrow('Analysis not found');
      
      global.setTimeout = originalSetTimeout;
    }, 10000);
  });

  describe('error handling', () => {
    it('should handle service initialization errors gracefully', () => {
      expect(() => {
        new ParallelAutoAnalyzeService(
          mockKoreApiService,
          mockSessionSamplingService,
          mockBatchAnalysisService,
          mockOpenAIService,
          'test-bot-id'
        );
      }).not.toThrow();
    });

    it('should handle background job queue errors', async () => {
      mockBackgroundJobQueue.enqueue.mockRejectedValue(new Error('Queue error'));
      
      await expect(parallelAutoAnalyzeService.startAnalysis(mockConfig)).rejects.toThrow('Queue error');
    });
  });
});