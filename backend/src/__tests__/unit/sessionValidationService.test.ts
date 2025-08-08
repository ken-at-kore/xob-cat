import { SessionValidationService } from '../../services/sessionValidationService';
import { SessionWithTranscript, SessionWithFacts } from '../../../../shared/types';
import { OpenAIBatchResult } from '../../services/openaiAnalysisService';

describe('SessionValidationService', () => {
  let validationService: SessionValidationService;

  beforeEach(() => {
    validationService = new SessionValidationService();
  });

  const mockInputSessions: SessionWithTranscript[] = [
    {
      user_id: 'user1',
      session_id: 'session1',
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T10:30:00Z',
      messages: [
        { from: 'user', message: 'I need help with my claim' },
        { from: 'bot', message: 'What is your claim number?' }
      ]
    },
    {
      user_id: 'user2',
      session_id: 'session2',
      start_time: '2024-01-01T11:00:00Z',
      end_time: '2024-01-01T11:30:00Z',
      messages: [
        { from: 'user', message: 'Check my policy status' },
        { from: 'bot', message: 'I can help with that' }
      ]
    }
  ];

  const mockLLMResponse: OpenAIBatchResult = {
    sessions: [
      {
        user_id: 'user1',
        general_intent: 'Claim Status',
        session_outcome: 'Contained',
        transfer_reason: '',
        drop_off_location: '',
        notes: 'User asked about claim status'
      },
      {
        user_id: 'user2',
        general_intent: 'Policy Status',
        session_outcome: 'Contained',
        transfer_reason: '',
        drop_off_location: '',
        notes: 'User checked policy status'
      }
    ],
    promptTokens: 1000,
    completionTokens: 500,
    totalTokens: 1500,
    cost: 0.01,
    model: 'gpt-4o-mini'
  };

  describe('validateBatchResponse', () => {
    it('should validate successful response with all sessions present', () => {
      const result = validationService.validateBatchResponse(mockInputSessions, mockLLMResponse);
      
      expect(result.allSessionsProcessed).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.missingCount).toBe(0);
      expect(result.missingSessions).toHaveLength(0);
      expect(result.validationErrors).toHaveLength(0);
    });

    it('should detect missing sessions', () => {
      const incompleteResponse = {
        ...mockLLMResponse,
        sessions: [mockLLMResponse.sessions[0]!] // Only first session
      };

      const result = validationService.validateBatchResponse(mockInputSessions, incompleteResponse);
      
      expect(result.allSessionsProcessed).toBe(false);
      expect(result.processedCount).toBe(1);
      expect(result.missingCount).toBe(1);
      expect(result.missingSessions).toHaveLength(1);
      expect(result.missingSessions[0]!.user_id).toBe('user2');
    });

    it('should detect unexpected sessions in response', () => {
      const responseWithExtra = {
        ...mockLLMResponse,
        sessions: [
          ...mockLLMResponse.sessions,
          {
            user_id: 'user3', // Unexpected session
            general_intent: 'Unknown',
            session_outcome: 'Contained' as const,
            transfer_reason: '',
            drop_off_location: '',
            notes: 'Unexpected session'
          }
        ]
      };

      const result = validationService.validateBatchResponse(mockInputSessions, responseWithExtra);
      
      expect(result.allSessionsProcessed).toBe(false);
      expect(result.validationErrors).toContain('Unexpected sessions in response: user3');
    });

    it('should detect duplicate sessions in response', () => {
      const responseWithDuplicates = {
        ...mockLLMResponse,
        sessions: [
          mockLLMResponse.sessions[0]!,
          mockLLMResponse.sessions[0]!, // Duplicate
          mockLLMResponse.sessions[1]!
        ]
      };

      const result = validationService.validateBatchResponse(mockInputSessions, responseWithDuplicates);
      
      expect(result.allSessionsProcessed).toBe(false);
      expect(result.validationErrors.some(error => error.includes('Duplicate sessions'))).toBe(true);
    });

    it('should detect malformed sessions', () => {
      const responseWithMalformed = {
        ...mockLLMResponse,
        sessions: [
          {
            user_id: '', // Invalid user_id
            general_intent: 'Test',
            session_outcome: 'InvalidOutcome' as any, // Invalid outcome
            transfer_reason: '',
            drop_off_location: '',
            notes: 123 as any // Invalid notes type
          }
        ]
      };

      const result = validationService.validateBatchResponse(mockInputSessions, responseWithMalformed);
      
      expect(result.allSessionsProcessed).toBe(false);
      expect(result.validationErrors.some(error => error.includes('Malformed sessions'))).toBe(true);
    });
  });

  describe('identifyMissingSessions', () => {
    const mockProcessedSessions: SessionWithFacts[] = [
      {
        ...mockInputSessions[0]!,
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
    ];

    it('should identify missing sessions correctly', () => {
      const missingSessions = validationService.identifyMissingSessions(
        mockInputSessions, 
        mockProcessedSessions
      );
      
      expect(missingSessions).toHaveLength(1);
      expect(missingSessions[0]!.user_id).toBe('user2');
    });

    it('should return empty array when all sessions processed', () => {
      const allProcessedSessions: SessionWithFacts[] = [
        {
          ...mockInputSessions[0]!,
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
        },
        {
          ...mockInputSessions[1]!,
          facts: {
            generalIntent: 'Policy Status',
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
      ];

      const missingSessions = validationService.identifyMissingSessions(
        mockInputSessions, 
        allProcessedSessions
      );
      
      expect(missingSessions).toHaveLength(0);
    });
  });

  describe('mergeRetryResults', () => {
    const originalResults: SessionWithFacts[] = [
      {
        ...mockInputSessions[0]!,
        facts: {
          generalIntent: 'Claim Status',
          sessionOutcome: 'Contained',
          transferReason: '',
          dropOffLocation: '',
          notes: 'Original'
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

    const retryResults: SessionWithFacts[] = [
      {
        ...mockInputSessions[1]!,
        facts: {
          generalIntent: 'Policy Status',
          sessionOutcome: 'Contained',
          transferReason: '',
          dropOffLocation: '',
          notes: 'Retry'
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

    it('should merge results correctly without duplicates', () => {
      const merged = validationService.mergeRetryResults(originalResults, retryResults);
      
      expect(merged).toHaveLength(2);
      expect(merged.map(s => s.user_id)).toContain('user1');
      expect(merged.map(s => s.user_id)).toContain('user2');
    });

    it('should handle retry overwriting original', () => {
      const retryOverwrite: SessionWithFacts[] = [
        {
          ...mockInputSessions[0]!, // Same user_id as original
          facts: {
            generalIntent: 'Updated Intent',
            sessionOutcome: 'Transfer',
            transferReason: 'Updated reason',
            dropOffLocation: 'Updated location',
            notes: 'Updated in retry'
          },
          analysisMetadata: {
            tokensUsed: 200,
            processingTime: 2000,
            batchNumber: 2,
            timestamp: '2024-01-01T13:00:00Z',
            model: 'gpt-4o-mini'
          }
        }
      ];

      const merged = validationService.mergeRetryResults(originalResults, retryOverwrite);
      
      expect(merged).toHaveLength(1);
      expect(merged[0]!.facts.generalIntent).toBe('Updated Intent');
      expect(merged[0]!.facts.notes).toBe('Updated in retry');
    });
  });

  describe('validateProcessedSessionsFormat', () => {
    const validSession: SessionWithFacts = {
      ...mockInputSessions[0]!,
      facts: {
        generalIntent: 'Claim Status',
        sessionOutcome: 'Contained',
        transferReason: '',
        dropOffLocation: '',
        notes: 'Valid session'
      },
      analysisMetadata: {
        tokensUsed: 100,
        processingTime: 1000,
        batchNumber: 1,
        timestamp: '2024-01-01T12:00:00Z',
        model: 'gpt-4o-mini'
      }
    };

    it('should validate correctly formatted sessions', () => {
      const result = validationService.validateProcessedSessionsFormat([validSession]);
      
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidSession = {
        ...validSession,
        user_id: '', // Missing user_id
        facts: {
          ...validSession.facts,
          generalIntent: '', // Missing general intent
          sessionOutcome: 'InvalidOutcome' as any // Invalid outcome
        }
      };

      const result = validationService.validateProcessedSessionsFormat([invalidSession as any]);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should detect missing transfer fields for Transfer sessions', () => {
      const transferSessionMissingFields = {
        ...validSession,
        facts: {
          ...validSession.facts,
          sessionOutcome: 'Transfer' as const,
          transferReason: '', // Missing for transfer
          dropOffLocation: '' // Missing for transfer
        }
      };

      const result = validationService.validateProcessedSessionsFormat([transferSessionMissingFields]);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.includes('missing transferReason'))).toBe(true);
      expect(result.issues.some(issue => issue.includes('missing dropOffLocation'))).toBe(true);
    });

    it('should detect missing analysisMetadata', () => {
      const sessionMissingMetadata = {
        ...validSession,
        analysisMetadata: undefined
      };

      const result = validationService.validateProcessedSessionsFormat([sessionMissingMetadata as any]);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.includes('missing analysisMetadata'))).toBe(true);
    });
  });

  describe('shouldRetry', () => {
    it('should not retry when all sessions processed', () => {
      const successResult = {
        allSessionsProcessed: true,
        processedCount: 2,
        missingCount: 0,
        missingSessions: [],
        validationErrors: []
      };

      const decision = validationService.shouldRetry(successResult, 3);
      
      expect(decision.shouldRetry).toBe(false);
      expect(decision.reason).toContain('successfully');
    });

    it('should retry when sessions are missing and retries available', () => {
      const failedResult = {
        allSessionsProcessed: false,
        processedCount: 1,
        missingCount: 1,
        missingSessions: [mockInputSessions[1]!],
        validationErrors: []
      };

      const decision = validationService.shouldRetry(failedResult, 3);
      
      expect(decision.shouldRetry).toBe(true);
      expect(decision.reason).toContain('missing');
    });

    it('should not retry when no retries left', () => {
      const failedResult = {
        allSessionsProcessed: false,
        processedCount: 1,
        missingCount: 1,
        missingSessions: [mockInputSessions[1]!],
        validationErrors: []
      };

      const decision = validationService.shouldRetry(failedResult, 0);
      
      expect(decision.shouldRetry).toBe(false);
      expect(decision.reason).toContain('retry limit');
    });
  });

  describe('createFallbackResults', () => {
    it('should create fallback results for failed sessions', () => {
      const missingSessions = [mockInputSessions[0]!];
      const errorMessage = 'LLM processing failed';
      
      const fallbacks = validationService.createFallbackResults(
        missingSessions, 
        errorMessage, 
        'gpt-4o-mini'
      );
      
      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0]!.facts.generalIntent).toBe('Unknown');
      expect(fallbacks[0]!.facts.sessionOutcome).toBe('Contained');
      expect(fallbacks[0]!.facts.notes).toContain(errorMessage);
      expect(fallbacks[0]!.analysisMetadata.batchNumber).toBe(-1); // Indicates fallback
    });

    it('should preserve original session data in fallbacks', () => {
      const missingSessions = [mockInputSessions[0]!];
      const fallbacks = validationService.createFallbackResults(missingSessions, 'Error', 'gpt-4o-mini');
      
      expect(fallbacks[0]!.user_id).toBe(mockInputSessions[0]!.user_id);
      expect(fallbacks[0]!.session_id).toBe(mockInputSessions[0]!.session_id);
      expect(fallbacks[0]!.messages).toEqual(mockInputSessions[0]!.messages);
    });
  });
});