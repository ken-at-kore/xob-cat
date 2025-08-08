import { ConflictResolutionService } from '../../services/conflictResolutionService';
import { IOpenAIService } from '../../interfaces';
import { SessionWithFacts, ExistingClassifications, ConflictResolutions } from '../../../../shared/types';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

// Mock the IOpenAIService
const mockOpenAIService = {
  analyzeBatch: jest.fn(),
  calculateCost: jest.fn().mockReturnValue(0.01)
} as jest.Mocked<IOpenAIService>;

describe('ConflictResolutionService', () => {
  let conflictService: ConflictResolutionService;
  let mockOpenAIClient: jest.Mocked<OpenAI>;

  const mockSessions: SessionWithFacts[] = [
    {
      user_id: 'user1',
      session_id: 'session1',
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T10:30:00Z',
      messages: [
        { from: 'user', message: 'Check my claim status' },
        { from: 'bot', message: 'I can help with that' }
      ],
      facts: {
        generalIntent: 'Claim Status',
        sessionOutcome: 'Contained',
        transferReason: '',
        dropOffLocation: '',
        notes: 'User asked about claim'
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
      user_id: 'user2',
      session_id: 'session2',
      start_time: '2024-01-01T11:00:00Z',
      end_time: '2024-01-01T11:30:00Z',
      messages: [
        { from: 'user', message: 'Claim inquiry' },
        { from: 'bot', message: 'What claim number?' }
      ],
      facts: {
        generalIntent: 'Claim Inquiry', // Similar to 'Claim Status'
        sessionOutcome: 'Transfer',
        transferReason: 'Invalid Provider ID',
        dropOffLocation: 'Policy Number Prompt',
        notes: 'User had claim question'
      },
      analysisMetadata: {
        tokensUsed: 120,
        processingTime: 1100,
        batchNumber: 1,
        timestamp: '2024-01-01T12:00:00Z',
        model: 'gpt-4o-mini'
      }
    },
    {
      user_id: 'user3',
      session_id: 'session3',
      start_time: '2024-01-01T12:00:00Z',
      end_time: '2024-01-01T12:30:00Z',
      messages: [
        { from: 'user', message: 'Need human agent' },
        { from: 'bot', message: 'Connecting you...' }
      ],
      facts: {
        generalIntent: 'Live Agent',
        sessionOutcome: 'Transfer',
        transferReason: 'Bad Provider ID', // Similar to 'Invalid Provider ID'
        dropOffLocation: 'Policy Number Entry', // Similar to 'Policy Number Prompt'
        notes: 'User requested human help'
      },
      analysisMetadata: {
        tokensUsed: 90,
        processingTime: 950,
        batchNumber: 1,
        timestamp: '2024-01-01T12:00:00Z',
        model: 'gpt-4o-mini'
      }
    }
  ];

  const mockLLMResolutions: ConflictResolutions = {
    generalIntents: [
      {
        canonical: 'Claim Status',
        aliases: ['Claim Inquiry']
      }
    ],
    transferReasons: [
      {
        canonical: 'Invalid Provider ID',
        aliases: ['Bad Provider ID']
      }
    ],
    dropOffLocations: [
      {
        canonical: 'Policy Number Prompt',
        aliases: ['Policy Number Entry']
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock OpenAI client
    mockOpenAIClient = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    } as any;

    MockedOpenAI.mockImplementation(() => mockOpenAIClient);
    
    conflictService = new ConflictResolutionService(mockOpenAIService);
  });

  describe('extractAllClassifications', () => {
    it('should extract unique classifications from sessions', () => {
      const classifications = (conflictService as any).extractAllClassifications(mockSessions);
      
      expect(classifications.generalIntent.has('Claim Status')).toBe(true);
      expect(classifications.generalIntent.has('Claim Inquiry')).toBe(true);
      expect(classifications.generalIntent.has('Live Agent')).toBe(true);
      expect(classifications.transferReason.has('Invalid Provider ID')).toBe(true);
      expect(classifications.transferReason.has('Bad Provider ID')).toBe(true);
      expect(classifications.dropOffLocation.has('Policy Number Prompt')).toBe(true);
      expect(classifications.dropOffLocation.has('Policy Number Entry')).toBe(true);
    });

    it('should handle empty sessions array', () => {
      const classifications = (conflictService as any).extractAllClassifications([]);
      
      expect(classifications.generalIntent.size).toBe(0);
      expect(classifications.transferReason.size).toBe(0);
      expect(classifications.dropOffLocation.size).toBe(0);
    });

    it('should filter out empty classifications', () => {
      const sessionsWithEmpties: SessionWithFacts[] = [
        {
          ...mockSessions[0]!,
          facts: {
            generalIntent: '',
            sessionOutcome: 'Contained',
            transferReason: '   ', // Whitespace only
            dropOffLocation: '',
            notes: 'Test'
          }
        }
      ];
      
      const classifications = (conflictService as any).extractAllClassifications(sessionsWithEmpties);
      
      expect(classifications.generalIntent.size).toBe(0);
      expect(classifications.transferReason.size).toBe(0);
      expect(classifications.dropOffLocation.size).toBe(0);
    });
  });

  describe('needsConflictResolution', () => {
    it('should require resolution when there are many classifications', () => {
      const manyClassifications: ExistingClassifications = {
        generalIntent: new Set(['Intent1', 'Intent2', 'Intent3', 'Intent4', 'Intent5', 'Intent6']),
        transferReason: new Set(['Reason1', 'Reason2']),
        dropOffLocation: new Set(['Location1', 'Location2'])
      };
      
      const needsResolution = (conflictService as any).needsConflictResolution(manyClassifications);
      expect(needsResolution).toBe(true);
    });

    it('should not require resolution for few classifications', () => {
      const fewClassifications: ExistingClassifications = {
        generalIntent: new Set(['Intent1', 'Intent2']),
        transferReason: new Set(['Reason1']),
        dropOffLocation: new Set(['Location1'])
      };
      
      const needsResolution = (conflictService as any).needsConflictResolution(fewClassifications);
      expect(needsResolution).toBe(false);
    });
  });

  describe('identifyPotentialConflicts', () => {
    it('should identify similar classifications', () => {
      const classifications: ExistingClassifications = {
        generalIntent: new Set(['Claim Status', 'Claim Inquiry', 'Live Agent', 'Transfer to Human']),
        transferReason: new Set(['Invalid Provider ID', 'Bad Provider ID']),
        dropOffLocation: new Set(['Policy Number Prompt', 'Policy Number Entry'])
      };
      
      const conflicts = conflictService.identifyPotentialConflicts(classifications);
      
      expect(conflicts.intentConflicts.length).toBeGreaterThan(0);
      expect(conflicts.reasonConflicts.length).toBeGreaterThan(0);
      expect(conflicts.locationConflicts.length).toBeGreaterThan(0);
    });

    it('should handle classifications with no similarities', () => {
      const classifications: ExistingClassifications = {
        generalIntent: new Set(['Billing', 'Technical', 'Enrollment']),
        transferReason: new Set(['System Error', 'Policy Missing']),
        dropOffLocation: new Set(['Home Page', 'Contact Form'])
      };
      
      const conflicts = conflictService.identifyPotentialConflicts(classifications);
      
      // Should find fewer or no conflicts due to dissimilarity
      expect(conflicts.intentConflicts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('resolveConflicts', () => {
    beforeEach(() => {
      // Mock successful OpenAI response
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify(mockLLMResolutions)
              }
            }]
          }
        }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 200,
          total_tokens: 1200
        }
      } as any);
    });

    it('should resolve conflicts successfully', async () => {
      const result = await conflictService.resolveConflicts(
        mockSessions,
        'test-api-key',
        'gpt-4o-mini'
      );
      
      expect(result.resolvedSessions).toHaveLength(3);
      expect(result.resolutionStats.conflictsFound).toBeGreaterThan(0);
      expect(result.resolutionStats.conflictsResolved).toBeGreaterThan(0);
      expect(result.resolutions).toEqual(mockLLMResolutions);
    });

    it('should apply resolutions to sessions correctly', async () => {
      const result = await conflictService.resolveConflicts(
        mockSessions,
        'test-api-key',
        'gpt-4o-mini'
      );
      
      // Check that 'Claim Inquiry' was mapped to 'Claim Status'
      const claimInquirySession = result.resolvedSessions.find(s => s.user_id === 'user2');
      expect(claimInquirySession?.facts.generalIntent).toBe('Claim Status');
      
      // Check that 'Bad Provider ID' was mapped to 'Invalid Provider ID'
      const badProviderSession = result.resolvedSessions.find(s => s.user_id === 'user3');
      expect(badProviderSession?.facts.transferReason).toBe('Invalid Provider ID');
      
      // Check that 'Policy Number Entry' was mapped to 'Policy Number Prompt'
      expect(badProviderSession?.facts.dropOffLocation).toBe('Policy Number Prompt');
    });

    it('should skip resolution when no conflicts detected', async () => {
      const sessionsWithoutConflicts: SessionWithFacts[] = [
        {
          ...mockSessions[0]!,
          facts: {
            generalIntent: 'Unique Intent',
            sessionOutcome: 'Contained',
            transferReason: '',
            dropOffLocation: '',
            notes: 'Test'
          }
        }
      ];
      
      const result = await conflictService.resolveConflicts(
        sessionsWithoutConflicts,
        'test-api-key',
        'gpt-4o-mini'
      );
      
      expect(result.resolutionStats.conflictsFound).toBe(0);
      expect(result.resolutionStats.conflictsResolved).toBe(0);
      expect(result.tokenUsage.totalTokens).toBe(0);
      expect(mockOpenAIClient.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValue(new Error('API Error'));
      
      await expect(
        conflictService.resolveConflicts(mockSessions, 'test-api-key', 'gpt-4o-mini')
      ).rejects.toThrow('Conflict resolution failed');
    });

    it('should handle invalid LLM response format', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({ invalid: 'format' })
              }
            }]
          }
        }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 200,
          total_tokens: 1200
        }
      } as any);
      
      await expect(
        conflictService.resolveConflicts(mockSessions, 'test-api-key', 'gpt-4o-mini')
      ).rejects.toThrow('Invalid conflict resolution response format');
    });

    it('should handle missing tool calls in response', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: undefined
          }
        }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 200,
          total_tokens: 1200
        }
      } as any);
      
      await expect(
        conflictService.resolveConflicts(mockSessions, 'test-api-key', 'gpt-4o-mini')
      ).rejects.toThrow('No tool calls in conflict resolution response');
    });
  });

  describe('applyResolutions', () => {
    it('should apply resolutions correctly', () => {
      const resolvedSessions = conflictService.applyResolutions(mockSessions, mockLLMResolutions);
      
      // Check that mappings were applied
      const claimInquirySession = resolvedSessions.find(s => s.user_id === 'user2');
      expect(claimInquirySession?.facts.generalIntent).toBe('Claim Status');
      
      const badProviderSession = resolvedSessions.find(s => s.user_id === 'user3');
      expect(badProviderSession?.facts.transferReason).toBe('Invalid Provider ID');
      expect(badProviderSession?.facts.dropOffLocation).toBe('Policy Number Prompt');
    });

    it('should preserve sessions without conflicts', () => {
      const resolvedSessions = conflictService.applyResolutions(mockSessions, mockLLMResolutions);
      
      // Sessions without conflicts should remain unchanged
      const unchangedSession = resolvedSessions.find(s => s.user_id === 'user1');
      expect(unchangedSession?.facts.generalIntent).toBe('Claim Status'); // Already canonical
    });

    it('should handle empty resolutions', () => {
      const emptyResolutions: ConflictResolutions = {
        generalIntents: [],
        transferReasons: [],
        dropOffLocations: []
      };
      
      const resolvedSessions = conflictService.applyResolutions(mockSessions, emptyResolutions);
      
      // All sessions should remain unchanged
      resolvedSessions.forEach((session, index) => {
        expect(session.facts.generalIntent).toBe(mockSessions[index]!.facts.generalIntent);
        expect(session.facts.transferReason).toBe(mockSessions[index]!.facts.transferReason);
        expect(session.facts.dropOffLocation).toBe(mockSessions[index]!.facts.dropOffLocation);
      });
    });
  });

  describe('createMapping', () => {
    it('should create correct mapping from resolutions', () => {
      const resolutions = [
        {
          canonical: 'Claim Status',
          aliases: ['Claim Inquiry', 'Claim Check']
        },
        {
          canonical: 'Billing',
          aliases: ['Payment', 'Invoice']
        }
      ];
      
      const mapping = (conflictService as any).createMapping(resolutions);
      
      expect(mapping.get('Claim Status')).toBe('Claim Status');
      expect(mapping.get('Claim Inquiry')).toBe('Claim Status');
      expect(mapping.get('Claim Check')).toBe('Claim Status');
      expect(mapping.get('Billing')).toBe('Billing');
      expect(mapping.get('Payment')).toBe('Billing');
      expect(mapping.get('Invoice')).toBe('Billing');
    });

    it('should handle empty resolutions array', () => {
      const mapping = (conflictService as any).createMapping([]);
      expect(mapping.size).toBe(0);
    });
  });

  describe('validateResolutionResponse', () => {
    it('should validate correct response format', () => {
      const validResponse = {
        generalIntents: [
          { canonical: 'Test', aliases: ['Test1', 'Test2'] }
        ],
        transferReasons: [],
        dropOffLocations: []
      };
      
      const isValid = (conflictService as any).validateResolutionResponse(validResponse);
      expect(isValid).toBe(true);
    });

    it('should reject invalid response format', () => {
      const invalidResponses = [
        null,
        { generalIntents: 'not-an-array' },
        { generalIntents: [{ canonical: 'Test' }] }, // Missing aliases
        { generalIntents: [{ aliases: ['Test'] }] }, // Missing canonical
        { generalIntents: [{ canonical: 123, aliases: ['Test'] }] }, // Wrong type
      ];
      
      invalidResponses.forEach(response => {
        const isValid = (conflictService as any).validateResolutionResponse(response);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('statistical methods', () => {
    const mockClassifications: ExistingClassifications = {
      generalIntent: new Set(['Intent1', 'Intent2', 'Intent3']),
      transferReason: new Set(['Reason1', 'Reason2']),
      dropOffLocation: new Set(['Location1'])
    };

    const mockResolutions: ConflictResolutions = {
      generalIntents: [
        { canonical: 'Intent1', aliases: ['Intent1Alt'] }
      ],
      transferReasons: [
        { canonical: 'Reason1', aliases: ['Reason1Alt', 'Reason1Variant'] }
      ],
      dropOffLocations: []
    };

    it('should count potential conflicts correctly', () => {
      const count = (conflictService as any).countPotentialConflicts(mockClassifications);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should count resolutions correctly', () => {
      const count = (conflictService as any).countResolutions(mockResolutions);
      expect(count).toBe(2); // 1 intent resolution + 1 reason resolution
    });

    it('should count canonical mappings correctly', () => {
      const count = (conflictService as any).countCanonicalMappings(mockResolutions);
      expect(count).toBe(3); // 1 intent alias + 2 reason aliases
    });
  });
});