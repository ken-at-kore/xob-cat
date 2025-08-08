import { StreamProcessingService } from '../../services/streamProcessingService';
import { TokenManagementService } from '../../services/tokenManagementService';
import { SessionValidationService } from '../../services/sessionValidationService';
import { IOpenAIService } from '../../interfaces';
import { 
  SessionWithTranscript, 
  StreamConfig, 
  ExistingClassifications,
  SessionValidationResult,
  BatchTokenUsage
} from '../../../../shared/types';

// Mock dependencies
const mockTokenManagementService = {
  calculateTokenEstimation: jest.fn(),
  splitSessionsIntoBatches: jest.fn()
} as jest.Mocked<TokenManagementService>;

const mockSessionValidationService = {
  validateBatchResponse: jest.fn(),
  mergeRetryResults: jest.fn(),
  createFallbackResults: jest.fn()
} as jest.Mocked<SessionValidationService>;

const mockOpenAIService = {
  analyzeBatch: jest.fn(),
  calculateCost: jest.fn()
} as jest.Mocked<IOpenAIService>;

describe('StreamProcessingService', () => {
  let streamProcessingService: StreamProcessingService;

  const mockSessions: SessionWithTranscript[] = [
    {
      user_id: 'user1',
      session_id: 'session1',
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T10:30:00Z',
      messages: [
        { from: 'user', message: 'Check my claim status' },
        { from: 'bot', message: 'I can help with that' }
      ]
    },
    {
      user_id: 'user2',
      session_id: 'session2',
      start_time: '2024-01-01T11:00:00Z',
      end_time: '2024-01-01T11:30:00Z',
      messages: [
        { from: 'user', message: 'Need billing information' },
        { from: 'bot', message: 'What is your policy number?' }
      ]
    }
  ];

  const mockStreamConfig: StreamConfig = {
    streamId: 1,
    sessions: mockSessions,
    baseClassifications: {
      generalIntent: new Set(['Existing Intent']),
      transferReason: new Set(['Existing Reason']),
      dropOffLocation: new Set(['Existing Location'])
    },
    apiKey: 'test-api-key',
    modelId: 'gpt-4o-mini',
    maxSessionsPerCall: 20
  };

  const mockOpenAIResponse = {
    sessions: [
      {
        user_id: 'user1',
        general_intent: 'Claim Status',
        session_outcome: 'Contained' as const,
        transfer_reason: '',
        drop_off_location: '',
        notes: 'User checked claim status'
      },
      {
        user_id: 'user2',
        general_intent: 'Billing',
        session_outcome: 'Transfer' as const,
        transfer_reason: 'Missing Policy',
        drop_off_location: 'Agent Queue',
        notes: 'User needed billing help'
      }
    ],
    promptTokens: 1000,
    completionTokens: 500,
    totalTokens: 1500,
    cost: 0.01,
    model: 'gpt-4o-mini'
  };

  const mockSuccessValidation: SessionValidationResult = {
    allSessionsProcessed: true,
    processedCount: 2,
    missingCount: 0,
    missingSessions: [],
    validationErrors: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockTokenManagementService.calculateTokenEstimation.mockReturnValue({
      estimatedTokens: 6000,
      recommendedBatchSize: 20,
      costEstimate: 0.012,
      requiresSplitting: false
    });

    mockOpenAIService.analyzeBatch.mockResolvedValue(mockOpenAIResponse);
    mockSessionValidationService.validateBatchResponse.mockReturnValue(mockSuccessValidation);
    mockSessionValidationService.mergeRetryResults.mockImplementation((original, retry) => [...original, ...retry]);
    
    streamProcessingService = new StreamProcessingService(
      mockTokenManagementService,
      mockSessionValidationService,
      mockOpenAIService
    );
  });

  describe('processStream', () => {
    it('should process stream successfully in single batch', async () => {
      const progressCallback = jest.fn();
      
      const result = await streamProcessingService.processStream(mockStreamConfig, progressCallback);
      
      expect(result.streamId).toBe(1);
      expect(result.processedSessions).toHaveLength(2);
      expect(result.tokenUsage.totalTokens).toBe(1500);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should process stream in batches when token limit exceeded', async () => {
      // Mock token estimation to require splitting
      mockTokenManagementService.calculateTokenEstimation.mockReturnValue({
        estimatedTokens: 150000, // Exceeds limit
        recommendedBatchSize: 10,
        costEstimate: 0.05,
        requiresSplitting: true
      });

      mockTokenManagementService.splitSessionsIntoBatches.mockReturnValue([
        [mockSessions[0]!],
        [mockSessions[1]!]
      ]);

      const progressCallback = jest.fn();
      const result = await streamProcessingService.processStream(mockStreamConfig, progressCallback);
      
      expect(result.streamId).toBe(1);
      expect(result.processedSessions).toHaveLength(4); // 2 sessions × 2 batches
      expect(mockTokenManagementService.splitSessionsIntoBatches).toHaveBeenCalled();
    });

    it('should handle processing errors with fallback results', async () => {
      mockOpenAIService.analyzeBatch.mockRejectedValue(new Error('API Error'));
      mockSessionValidationService.createFallbackResults.mockReturnValue([
        {
          ...mockSessions[0]!,
          facts: {
            generalIntent: 'Unknown',
            sessionOutcome: 'Contained',
            transferReason: '',
            dropOffLocation: '',
            notes: 'Stream processing failed: Error: API Error'
          },
          analysisMetadata: {
            tokensUsed: 0,
            processingTime: 0,
            batchNumber: -1,
            timestamp: '2024-01-01T12:00:00Z',
            model: 'gpt-4o-mini'
          }
        }
      ]);

      const result = await streamProcessingService.processStream(mockStreamConfig);
      
      expect(result.processedSessions).toHaveLength(1);
      expect(result.tokenUsage.totalTokens).toBe(0);
      expect(result.validationResults[0]!.allSessionsProcessed).toBe(false);
      expect(mockSessionValidationService.createFallbackResults).toHaveBeenCalled();
    });

    it('should call progress callback with correct parameters', async () => {
      const progressCallback = jest.fn();
      
      await streamProcessingService.processStream(mockStreamConfig, progressCallback);
      
      expect(progressCallback).toHaveBeenCalledWith(1, 0, 2, 0); // Initial call
      expect(progressCallback).toHaveBeenCalledWith(1, 2, 2, 1500); // Final call
    });
  });

  describe('processSingleBatch', () => {
    it('should process batch without retries when all sessions successful', async () => {
      const result = await (streamProcessingService as any).processSingleBatch(
        mockStreamConfig,
        mockSessions
      );
      
      expect(result.processedSessions).toHaveLength(2);
      expect(result.retryAttempts).toBe(0);
      expect(result.totalTokenUsage.totalTokens).toBe(1500);
      expect(mockOpenAIService.analyzeBatch).toHaveBeenCalledTimes(1);
    });

    it('should handle missing sessions with retry logic', async () => {
      const failedValidation: SessionValidationResult = {
        allSessionsProcessed: false,
        processedCount: 1,
        missingCount: 1,
        missingSessions: [mockSessions[1]!],
        validationErrors: []
      };

      const retryValidation: SessionValidationResult = {
        allSessionsProcessed: true,
        processedCount: 1,
        missingCount: 0,
        missingSessions: [],
        validationErrors: []
      };

      mockSessionValidationService.validateBatchResponse
        .mockReturnValueOnce(failedValidation)
        .mockReturnValueOnce(retryValidation)
        .mockReturnValueOnce(mockSuccessValidation); // Final validation

      mockOpenAIService.analyzeBatch
        .mockResolvedValueOnce({
          ...mockOpenAIResponse,
          sessions: [mockOpenAIResponse.sessions[0]!] // Only first session
        })
        .mockResolvedValueOnce({
          ...mockOpenAIResponse,
          sessions: [mockOpenAIResponse.sessions[1]!] // Second session in retry
        });

      const result = await (streamProcessingService as any).processSingleBatch(
        mockStreamConfig,
        mockSessions
      );
      
      expect(result.retryAttempts).toBe(1);
      expect(mockOpenAIService.analyzeBatch).toHaveBeenCalledTimes(2);
      expect(mockSessionValidationService.mergeRetryResults).toHaveBeenCalled();
    });

    it('should create fallback results after max retries', async () => {
      const persistentFailure: SessionValidationResult = {
        allSessionsProcessed: false,
        processedCount: 0,
        missingCount: 2,
        missingSessions: mockSessions,
        validationErrors: []
      };

      mockSessionValidationService.validateBatchResponse.mockReturnValue(persistentFailure);
      mockSessionValidationService.createFallbackResults.mockReturnValue([
        {
          ...mockSessions[0]!,
          facts: {
            generalIntent: 'Unknown',
            sessionOutcome: 'Contained',
            transferReason: '',
            dropOffLocation: '',
            notes: 'Failed after 3 retry attempts'
          },
          analysisMetadata: {
            tokensUsed: 0,
            processingTime: 0,
            batchNumber: -1,
            timestamp: '2024-01-01T12:00:00Z',
            model: 'gpt-4o-mini'
          }
        }
      ]);

      const result = await (streamProcessingService as any).processSingleBatch(
        mockStreamConfig,
        mockSessions
      );
      
      expect(result.retryAttempts).toBe(3);
      expect(mockSessionValidationService.createFallbackResults).toHaveBeenCalledWith(
        expect.any(Array),
        'Failed after 3 retry attempts',
        'gpt-4o-mini'
      );
    });

    it('should handle retry API errors gracefully', async () => {
      const failedValidation: SessionValidationResult = {
        allSessionsProcessed: false,
        processedCount: 0,
        missingCount: 2,
        missingSessions: mockSessions,
        validationErrors: []
      };

      mockSessionValidationService.validateBatchResponse.mockReturnValue(failedValidation);
      mockOpenAIService.analyzeBatch
        .mockResolvedValueOnce(mockOpenAIResponse)
        .mockRejectedValueOnce(new Error('Retry API Error'))
        .mockRejectedValueOnce(new Error('Retry API Error'))
        .mockRejectedValueOnce(new Error('Retry API Error'));

      const result = await (streamProcessingService as any).processSingleBatch(
        mockStreamConfig,
        mockSessions
      );
      
      expect(result.retryAttempts).toBe(3);
      expect(mockOpenAIService.analyzeBatch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('callOpenAIAnalysis', () => {
    it('should call OpenAI service and format response correctly', async () => {
      const result = await (streamProcessingService as any).callOpenAIAnalysis(
        mockSessions,
        mockStreamConfig.baseClassifications,
        'test-api-key',
        'gpt-4o-mini'
      );
      
      expect(mockOpenAIService.analyzeBatch).toHaveBeenCalledWith(
        mockSessions,
        mockStreamConfig.baseClassifications,
        'test-api-key',
        'gpt-4o-mini'
      );
      
      expect(result.llmResponse.sessions).toEqual(mockOpenAIResponse.sessions);
      expect(result.llmResponse.totalTokens).toBe(1500);
      expect(result.llmResponse.cost).toBe(0.01);
    });
  });

  describe('convertToSessionsWithFacts', () => {
    it('should convert LLM results to SessionWithFacts format', () => {
      const result = (streamProcessingService as any).convertToSessionsWithFacts(
        mockSessions,
        mockOpenAIResponse.sessions,
        'gpt-4o-mini'
      );
      
      expect(result).toHaveLength(2);
      expect(result[0]!.facts.generalIntent).toBe('Claim Status');
      expect(result[0]!.facts.sessionOutcome).toBe('Contained');
      expect(result[1]!.facts.generalIntent).toBe('Billing');
      expect(result[1]!.facts.sessionOutcome).toBe('Transfer');
      expect(result[1]!.facts.transferReason).toBe('Missing Policy');
      expect(result[1]!.analysisMetadata.model).toBe('gpt-4o-mini');
    });

    it('should handle missing original sessions gracefully', () => {
      const llmResults = [
        {
          user_id: 'unknown_user',
          general_intent: 'Unknown Intent',
          session_outcome: 'Contained' as const,
          transfer_reason: '',
          drop_off_location: '',
          notes: 'Unknown session'
        }
      ];
      
      const result = (streamProcessingService as any).convertToSessionsWithFacts(
        mockSessions,
        llmResults,
        'gpt-4o-mini'
      );
      
      expect(result).toHaveLength(0); // Should skip unknown sessions
    });

    it('should provide defaults for missing fields', () => {
      const incompleteResults = [
        {
          user_id: 'user1',
          general_intent: '',
          session_outcome: undefined,
          transfer_reason: undefined,
          drop_off_location: undefined,
          notes: undefined
        }
      ];
      
      const result = (streamProcessingService as any).convertToSessionsWithFacts(
        mockSessions,
        incompleteResults as any,
        'gpt-4o-mini'
      );
      
      expect(result[0]!.facts.generalIntent).toBe('Unknown');
      expect(result[0]!.facts.sessionOutcome).toBe('Contained');
      expect(result[0]!.facts.transferReason).toBe('');
      expect(result[0]!.facts.notes).toBe('Analysis completed');
    });
  });

  describe('extractNewClassifications', () => {
    const mockProcessedSessions = [
      {
        ...mockSessions[0]!,
        facts: {
          generalIntent: 'New Intent', // New
          sessionOutcome: 'Contained' as const,
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
      },
      {
        ...mockSessions[1]!,
        facts: {
          generalIntent: 'Existing Intent', // Already exists
          sessionOutcome: 'Transfer' as const,
          transferReason: 'New Reason', // New
          dropOffLocation: 'New Location', // New
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
    ];

    it('should extract new classifications correctly', () => {
      const result = (streamProcessingService as any).extractNewClassifications(
        mockProcessedSessions,
        mockStreamConfig.baseClassifications
      );
      
      expect(result.generalIntent.has('New Intent')).toBe(true);
      expect(result.generalIntent.has('Existing Intent')).toBe(false); // Should not include existing
      expect(result.transferReason.has('New Reason')).toBe(true);
      expect(result.dropOffLocation.has('New Location')).toBe(true);
    });

    it('should filter out empty classifications', () => {
      const sessionsWithEmpties = [
        {
          ...mockProcessedSessions[0]!,
          facts: {
            ...mockProcessedSessions[0]!.facts,
            generalIntent: '', // Empty
            transferReason: '   ', // Whitespace only
            dropOffLocation: 'Valid Location'
          }
        }
      ];
      
      const result = (streamProcessingService as any).extractNewClassifications(
        sessionsWithEmpties,
        mockStreamConfig.baseClassifications
      );
      
      expect(result.generalIntent.size).toBe(0);
      expect(result.transferReason.size).toBe(0);
      expect(result.dropOffLocation.has('Valid Location')).toBe(true);
    });

    it('should handle empty processed sessions', () => {
      const result = (streamProcessingService as any).extractNewClassifications(
        [],
        mockStreamConfig.baseClassifications
      );
      
      expect(result.generalIntent.size).toBe(0);
      expect(result.transferReason.size).toBe(0);
      expect(result.dropOffLocation.size).toBe(0);
    });
  });

  describe('accumulateTokenUsage', () => {
    it('should accumulate token usage correctly', () => {
      const usage1: BatchTokenUsage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        cost: 0.01,
        model: 'gpt-4o-mini'
      };

      const usage2: BatchTokenUsage = {
        promptTokens: 800,
        completionTokens: 400,
        totalTokens: 1200,
        cost: 0.008,
        model: 'gpt-4o-mini'
      };

      const result = (streamProcessingService as any).accumulateTokenUsage(usage1, usage2);
      
      expect(result.promptTokens).toBe(1800);
      expect(result.completionTokens).toBe(900);
      expect(result.totalTokens).toBe(2700);
      expect(result.cost).toBeCloseTo(0.018, 3);
      expect(result.model).toBe('gpt-4o-mini');
    });

    it('should handle zero values', () => {
      const zeroUsage: BatchTokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        model: 'gpt-4o-mini'
      };

      const nonZeroUsage: BatchTokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.001,
        model: 'gpt-4o-mini'
      };

      const result = (streamProcessingService as any).accumulateTokenUsage(zeroUsage, nonZeroUsage);
      
      expect(result.totalTokens).toBe(150);
      expect(result.cost).toBe(0.001);
    });
  });

  describe('logStreamAnalysis', () => {
    it('should log stream analysis information', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      streamProcessingService.logStreamAnalysis(mockStreamConfig);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Stream 1] Analysis:',
        expect.objectContaining({
          sessionCount: 2,
          modelId: 'gpt-4o-mini',
          maxSessionsPerCall: 20,
          baseClassifications: expect.objectContaining({
            intents: 1,
            reasons: 1,
            locations: 1
          })
        })
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle token estimation errors', async () => {
      mockTokenManagementService.calculateTokenEstimation.mockImplementation(() => {
        throw new Error('Token estimation failed');
      });

      const result = await streamProcessingService.processStream(mockStreamConfig);
      
      expect(result.processedSessions).toBeDefined();
      expect(result.validationResults[0]!.allSessionsProcessed).toBe(false);
    });

    it('should handle validation service errors', async () => {
      mockSessionValidationService.validateBatchResponse.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      const result = await streamProcessingService.processStream(mockStreamConfig);
      
      expect(result.processedSessions).toBeDefined();
      expect(result.tokenUsage.totalTokens).toBe(0);
    });
  });

  describe('retry mechanism', () => {
    it('should implement exponential backoff', async () => {
      const sleepSpy = jest.spyOn(streamProcessingService as any, 'sleep').mockResolvedValue(undefined);
      
      const failedValidation: SessionValidationResult = {
        allSessionsProcessed: false,
        processedCount: 0,
        missingCount: 2,
        missingSessions: mockSessions,
        validationErrors: []
      };

      mockSessionValidationService.validateBatchResponse.mockReturnValue(failedValidation);
      mockOpenAIService.analyzeBatch.mockResolvedValue(mockOpenAIResponse);

      await (streamProcessingService as any).processSingleBatch(mockStreamConfig, mockSessions);
      
      // Should call sleep with increasing delays: 2000ms, 4000ms
      expect(sleepSpy).toHaveBeenCalledWith(2000);
      expect(sleepSpy).toHaveBeenCalledWith(4000);
      
      sleepSpy.mockRestore();
    });

    it('should not sleep on first retry attempt', async () => {
      const sleepSpy = jest.spyOn(streamProcessingService as any, 'sleep').mockResolvedValue(undefined);
      
      const failedValidation: SessionValidationResult = {
        allSessionsProcessed: false,
        processedCount: 1,
        missingCount: 1,
        missingSessions: [mockSessions[0]!],
        validationErrors: []
      };

      const successValidation: SessionValidationResult = {
        allSessionsProcessed: true,
        processedCount: 1,
        missingCount: 0,
        missingSessions: [],
        validationErrors: []
      };

      mockSessionValidationService.validateBatchResponse
        .mockReturnValueOnce(failedValidation)
        .mockReturnValueOnce(successValidation)
        .mockReturnValueOnce(mockSuccessValidation);

      await (streamProcessingService as any).processSingleBatch(mockStreamConfig, mockSessions);
      
      // Should not call sleep for first retry
      expect(sleepSpy).not.toHaveBeenCalled();
      
      sleepSpy.mockRestore();
    });
  });
});