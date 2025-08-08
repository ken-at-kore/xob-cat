import { ParallelProcessingOrchestratorService } from '../../services/parallelProcessingOrchestratorService';
import { StreamProcessingService } from '../../services/streamProcessingService';
import { TokenManagementService } from '../../services/tokenManagementService';
import { 
  SessionWithTranscript, 
  ExistingClassifications, 
  ParallelConfig, 
  StreamResult,
  SessionStream
} from '../../../../shared/types';

// Mock dependencies
const mockStreamProcessingService = {
  processStream: jest.fn()
} as jest.Mocked<StreamProcessingService>;

const mockTokenManagementService = {
  getOptimalBatchConfig: jest.fn().mockReturnValue({
    maxSessionsPerCall: 20,
    contextWindow: 128000,
    recommendedStreamCount: 4
  })
} as jest.Mocked<TokenManagementService>;

describe('ParallelProcessingOrchestratorService', () => {
  let orchestratorService: ParallelProcessingOrchestratorService;

  const mockSessions: SessionWithTranscript[] = Array.from({ length: 50 }, (_, i) => ({
    user_id: `user${i + 1}`,
    session_id: `session${i + 1}`,
    start_time: '2024-01-01T10:00:00Z',
    end_time: '2024-01-01T10:30:00Z',
    messages: [
      { from: 'user', message: `Message ${i + 1}` },
      { from: 'bot', message: 'I can help with that' }
    ]
  }));

  const mockBaseClassifications: ExistingClassifications = {
    generalIntent: new Set(['Claim Status', 'Billing']),
    transferReason: new Set(['Technical Issue']),
    dropOffLocation: new Set(['Agent Queue'])
  };

  const mockStreamResult: StreamResult = {
    streamId: 1,
    processedSessions: [
      {
        ...mockSessions[0]!,
        facts: {
          generalIntent: 'Claim Status',
          sessionOutcome: 'Contained',
          transferReason: '',
          dropOffLocation: '',
          notes: 'Test'
        },
        analysisMetadata: {
          tokensUsed: 100,
          processingTime: 1000,
          batchNumber: 1,
          timestamp: '2024-01-01T12:00:00Z',
          model: 'gpt-4o-mini'
        }
      }
    ],
    newClassifications: {
      generalIntent: new Set(['Policy Status']),
      transferReason: new Set(),
      dropOffLocation: new Set()
    },
    tokenUsage: {
      promptTokens: 500,
      completionTokens: 250,
      totalTokens: 750,
      cost: 0.01,
      model: 'gpt-4o-mini'
    },
    validationResults: [{
      allSessionsProcessed: true,
      processedCount: 1,
      missingCount: 0,
      missingSessions: [],
      validationErrors: []
    }],
    retryAttempts: 0,
    processingTime: 1000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockStreamProcessingService.processStream.mockResolvedValue(mockStreamResult);
    
    orchestratorService = new ParallelProcessingOrchestratorService(
      mockStreamProcessingService,
      mockTokenManagementService
    );
  });

  describe('distributeSessionsAcrossStreams', () => {
    it('should distribute sessions evenly across streams', () => {
      const streams = orchestratorService.distributeSessionsAcrossStreams(
        mockSessions,
        4, // streamCount
        10 // sessionsPerStream
      );

      expect(streams).toHaveLength(4);
      expect(streams[0]!.sessions).toHaveLength(10);
      expect(streams[1]!.sessions).toHaveLength(10);
      expect(streams[2]!.sessions).toHaveLength(10);
      expect(streams[3]!.sessions).toHaveLength(10);
    });

    it('should handle uneven distribution', () => {
      const streams = orchestratorService.distributeSessionsAcrossStreams(
        mockSessions.slice(0, 25),
        4, // streamCount
        10 // sessionsPerStream
      );

      expect(streams).toHaveLength(3); // Only 3 streams needed for 25 sessions
      expect(streams[0]!.sessions).toHaveLength(10);
      expect(streams[1]!.sessions).toHaveLength(10);
      expect(streams[2]!.sessions).toHaveLength(5);
    });

    it('should assign correct stream IDs', () => {
      const streams = orchestratorService.distributeSessionsAcrossStreams(
        mockSessions.slice(0, 20),
        4,
        5
      );

      expect(streams[0]!.streamId).toBe(1);
      expect(streams[1]!.streamId).toBe(2);
      expect(streams[2]!.streamId).toBe(3);
      expect(streams[3]!.streamId).toBe(4);
    });

    it('should handle empty sessions array', () => {
      const streams = orchestratorService.distributeSessionsAcrossStreams([], 4, 10);
      expect(streams).toHaveLength(0);
    });

    it('should not create empty streams', () => {
      const streams = orchestratorService.distributeSessionsAcrossStreams(
        mockSessions.slice(0, 5),
        10, // More streams than sessions
        1
      );

      expect(streams).toHaveLength(5); // Only streams with sessions
      streams.forEach(stream => {
        expect(stream.sessions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('synchronizeClassifications', () => {
    const mockStreamResults: StreamResult[] = [
      {
        ...mockStreamResult,
        streamId: 1,
        newClassifications: {
          generalIntent: new Set(['New Intent 1', 'Shared Intent']),
          transferReason: new Set(['New Reason 1']),
          dropOffLocation: new Set(['New Location 1'])
        }
      },
      {
        ...mockStreamResult,
        streamId: 2,
        newClassifications: {
          generalIntent: new Set(['New Intent 2', 'Shared Intent']), // Duplicate
          transferReason: new Set(['New Reason 2']),
          dropOffLocation: new Set(['New Location 2'])
        }
      }
    ];

    it('should merge classifications from multiple streams', () => {
      const result = orchestratorService.synchronizeClassifications(
        mockStreamResults,
        mockBaseClassifications
      );

      expect(result.mergedClassifications.generalIntent.has('Claim Status')).toBe(true); // Base
      expect(result.mergedClassifications.generalIntent.has('Billing')).toBe(true); // Base
      expect(result.mergedClassifications.generalIntent.has('New Intent 1')).toBe(true); // Stream 1
      expect(result.mergedClassifications.generalIntent.has('New Intent 2')).toBe(true); // Stream 2
      expect(result.mergedClassifications.generalIntent.has('Shared Intent')).toBe(true); // Both streams
    });

    it('should count new classifications correctly', () => {
      const result = orchestratorService.synchronizeClassifications(
        mockStreamResults,
        mockBaseClassifications
      );

      // Should count unique new classifications only
      expect(result.newClassificationsCount).toBe(7); // 3 intents + 2 reasons + 2 locations
    });

    it('should handle empty stream results', () => {
      const result = orchestratorService.synchronizeClassifications(
        [],
        mockBaseClassifications
      );

      expect(result.mergedClassifications).toEqual(mockBaseClassifications);
      expect(result.newClassificationsCount).toBe(0);
    });

    it('should not duplicate existing classifications', () => {
      const streamResultsWithDuplicates: StreamResult[] = [
        {
          ...mockStreamResult,
          streamId: 1,
          newClassifications: {
            generalIntent: new Set(['Claim Status']), // Already in base
            transferReason: new Set(['Technical Issue']), // Already in base
            dropOffLocation: new Set(['Agent Queue']) // Already in base
          }
        }
      ];

      const result = orchestratorService.synchronizeClassifications(
        streamResultsWithDuplicates,
        mockBaseClassifications
      );

      expect(result.newClassificationsCount).toBe(0);
    });
  });

  describe('processInParallel', () => {
    const mockConfig: ParallelConfig = {
      streamCount: 2,
      sessionsPerStream: 10,
      maxSessionsPerLLMCall: 20,
      syncFrequency: 'after_each_round',
      retryAttempts: 3,
      debugLogging: false
    };

    it('should process sessions in parallel successfully', async () => {
      const result = await orchestratorService.processInParallel(
        mockSessions.slice(0, 20),
        mockBaseClassifications,
        mockConfig,
        'test-api-key',
        'gpt-4o-mini'
      );

      expect(result.processedSessions).toHaveLength(2); // 2 streams × 1 session per mock result
      expect(result.finalClassifications).toBeDefined();
      expect(result.streamResults).toHaveLength(2);
      expect(result.totalTokenUsage.totalTokens).toBeGreaterThan(0);
      expect(result.processingStats.totalRounds).toBe(1);
    });

    it('should handle multiple rounds when needed', async () => {
      const result = await orchestratorService.processInParallel(
        mockSessions, // 50 sessions
        mockBaseClassifications,
        mockConfig, // 2 streams × 10 sessions = 20 per round
        'test-api-key',
        'gpt-4o-mini'
      );

      expect(result.processingStats.totalRounds).toBe(3); // 50 sessions / 20 per round = 3 rounds
    });

    it('should use optimal configuration when not provided', async () => {
      const result = await orchestratorService.processInParallel(
        mockSessions.slice(0, 20),
        mockBaseClassifications,
        {}, // Empty config - should use optimal
        'test-api-key',
        'gpt-4o-mini'
      );

      expect(mockTokenManagementService.getOptimalBatchConfig).toHaveBeenCalledWith('gpt-4o-mini');
      expect(result.streamResults.length).toBeGreaterThan(0);
    });

    it('should handle stream processing failures gracefully', async () => {
      // Mock one successful stream and one failing stream
      mockStreamProcessingService.processStream
        .mockResolvedValueOnce(mockStreamResult)
        .mockRejectedValueOnce(new Error('Stream processing failed'));

      const result = await orchestratorService.processInParallel(
        mockSessions.slice(0, 20),
        mockBaseClassifications,
        mockConfig,
        'test-api-key',
        'gpt-4o-mini'
      );

      // Should continue with successful results
      expect(result.streamResults).toHaveLength(1);
      expect(result.processedSessions).toHaveLength(1);
    });

    it('should call progress callback with stream updates', async () => {
      const progressCallback = jest.fn();

      await orchestratorService.processInParallel(
        mockSessions.slice(0, 20),
        mockBaseClassifications,
        mockConfig,
        'test-api-key',
        'gpt-4o-mini',
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalled();
      
      // Should be called with stream progress information
      const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1];
      expect(lastCall).toEqual(
        expect.arrayContaining([
          expect.any(String), // phase description
          expect.any(Number), // streamsActive
          expect.any(Number), // totalProgress
          expect.any(Array)   // streamProgress
        ])
      );
    });
  });

  describe('getOptimalConfiguration', () => {
    it('should return optimal config for given parameters', () => {
      const config = orchestratorService.getOptimalConfiguration(100, 'gpt-4o-mini');

      expect(config.streamCount).toBeGreaterThan(0);
      expect(config.sessionsPerStream).toBeGreaterThan(0);
      expect(config.maxSessionsPerLLMCall).toBe(20);
      expect(config.syncFrequency).toBe('after_each_round');
      expect(config.retryAttempts).toBe(3);
    });

    it('should adjust stream count for small session counts', () => {
      const config = orchestratorService.getOptimalConfiguration(10, 'gpt-4o-mini');

      // Should not create more streams than needed
      expect(config.streamCount).toBeLessThanOrEqual(3); // 10 sessions / 4 sessions per stream
    });

    it('should handle very small session counts', () => {
      const config = orchestratorService.getOptimalConfiguration(2, 'gpt-4o-mini');

      expect(config.streamCount).toBe(1);
      expect(config.sessionsPerStream).toBeGreaterThanOrEqual(2);
    });

    it('should respect model-specific recommendations', () => {
      mockTokenManagementService.getOptimalBatchConfig.mockReturnValue({
        maxSessionsPerCall: 50,
        contextWindow: 1000000,
        recommendedStreamCount: 3
      });

      const config = orchestratorService.getOptimalConfiguration(100, 'gpt-4.1');

      expect(config.maxSessionsPerLLMCall).toBe(50);
      expect(mockTokenManagementService.getOptimalBatchConfig).toHaveBeenCalledWith('gpt-4.1');
    });
  });

  describe('calculateAverageStreamUtilization', () => {
    it('should calculate utilization correctly', () => {
      const streamResults: StreamResult[] = [
        { ...mockStreamResult, streamId: 1, processedSessions: [mockStreamResult.processedSessions[0]!] },
        { ...mockStreamResult, streamId: 2, processedSessions: [mockStreamResult.processedSessions[0]!] },
        { ...mockStreamResult, streamId: 3, processedSessions: [] } // No sessions processed
      ];

      const utilization = (orchestratorService as any).calculateAverageStreamUtilization(streamResults);
      expect(utilization).toBeCloseTo(0.67, 2); // 2/3 streams successful
    });

    it('should handle empty stream results', () => {
      const utilization = (orchestratorService as any).calculateAverageStreamUtilization([]);
      expect(utilization).toBe(0);
    });

    it('should return 1.0 for all successful streams', () => {
      const streamResults: StreamResult[] = [
        { ...mockStreamResult, streamId: 1, processedSessions: [mockStreamResult.processedSessions[0]!] },
        { ...mockStreamResult, streamId: 2, processedSessions: [mockStreamResult.processedSessions[0]!] }
      ];

      const utilization = (orchestratorService as any).calculateAverageStreamUtilization(streamResults);
      expect(utilization).toBe(1.0);
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

      const accumulated = (orchestratorService as any).accumulateTokenUsage(usage1, usage2);

      expect(accumulated.promptTokens).toBe(1800);
      expect(accumulated.completionTokens).toBe(900);
      expect(accumulated.totalTokens).toBe(2700);
      expect(accumulated.cost).toBeCloseTo(0.018, 3);
      expect(accumulated.model).toBe('gpt-4o-mini');
    });
  });

  describe('cloneClassifications', () => {
    it('should create independent copy of classifications', () => {
      const original = {
        generalIntent: new Set(['Intent1', 'Intent2']),
        transferReason: new Set(['Reason1']),
        dropOffLocation: new Set(['Location1'])
      };

      const cloned = (orchestratorService as any).cloneClassifications(original);

      // Should have same content
      expect(cloned.generalIntent.has('Intent1')).toBe(true);
      expect(cloned.generalIntent.has('Intent2')).toBe(true);
      expect(cloned.transferReason.has('Reason1')).toBe(true);
      expect(cloned.dropOffLocation.has('Location1')).toBe(true);

      // Should be independent objects
      cloned.generalIntent.add('Intent3');
      expect(original.generalIntent.has('Intent3')).toBe(false);
    });
  });
});