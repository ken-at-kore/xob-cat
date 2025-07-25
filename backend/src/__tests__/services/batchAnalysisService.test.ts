import { BatchAnalysisService } from '../../services/batchAnalysisService';
import { OpenAIAnalysisService } from '../../services/openaiAnalysisService';
import { SessionWithTranscript, SessionWithFacts, ExistingClassifications } from '../../../../shared/types';

// Mock the OpenAIAnalysisService
jest.mock('../../services/openaiAnalysisService');

describe('BatchAnalysisService', () => {
  let batchAnalysisService: BatchAnalysisService;
  let mockOpenaiService: jest.Mocked<OpenAIAnalysisService>;

  beforeEach(() => {
    mockOpenaiService = new OpenAIAnalysisService() as jest.Mocked<OpenAIAnalysisService>;
    batchAnalysisService = new BatchAnalysisService(mockOpenaiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processSessionsBatch', () => {
    const mockSessions: SessionWithTranscript[] = [
      {
        session_id: 'session-1',
        user_id: 'user-1',
        start_time: '2024-01-15T09:00:00Z',
        end_time: '2024-01-15T09:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T09:00:00Z', message_type: 'user', message: 'I need help with my claim' },
          { timestamp: '2024-01-15T09:01:00Z', message_type: 'bot', message: 'I can help you with that' }
        ],
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      },
      {
        session_id: 'session-2',
        user_id: 'user-2',
        start_time: '2024-01-15T10:00:00Z',
        end_time: '2024-01-15T10:30:00Z',
        containment_type: 'agent',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T10:00:00Z', message_type: 'user', message: 'Transfer me to an agent' },
          { timestamp: '2024-01-15T10:01:00Z', message_type: 'bot', message: 'Let me connect you' }
        ],
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      }
    ];

    const mockExistingClassifications: ExistingClassifications = {
      generalIntent: new Set(['Claim Status', 'Live Agent']),
      transferReason: new Set(['User Request']),
      dropOffLocation: new Set(['Initial Greeting'])
    };

    it('should successfully process batch with consistent classifications', async () => {
      const mockAnalysisResult = {
        sessions: [
          {
            user_id: 'user-1',
            general_intent: 'Claim Status',
            session_outcome: 'Contained' as const,
            transfer_reason: '',
            drop_off_location: '',
            notes: 'User inquired about claim status and received help.'
          },
          {
            user_id: 'user-2',
            general_intent: 'Live Agent',
            session_outcome: 'Transfer' as const,
            transfer_reason: 'User Request',
            drop_off_location: 'Initial Greeting',
            notes: 'User requested transfer to live agent.'
          }
        ],
        promptTokens: 150,
        completionTokens: 75,
        totalTokens: 225,
        cost: 0.0045,
        model: 'gpt-4o-mini-2024-07-18'
      };

      mockOpenaiService.analyzeBatch.mockResolvedValue(mockAnalysisResult);

      const result = await batchAnalysisService.processSessionsBatch(
        mockSessions,
        mockExistingClassifications,
        'sk-test-key'
      );

      expect(result.results).toHaveLength(2);
      expect(result.results[0]?.facts.generalIntent).toBe('Claim Status');
      expect(result.results[1]?.facts.sessionOutcome).toBe('Transfer');
      expect(result.updatedClassifications.generalIntent.has('Claim Status')).toBe(true);
      expect(result.updatedClassifications.generalIntent.has('Live Agent')).toBe(true);
      expect(result.tokenUsage.totalTokens).toBe(225);
    });

    it('should handle partial batch failures gracefully', async () => {
      const mockAnalysisResult = {
        sessions: [
          {
            user_id: 'user-1',
            general_intent: 'Claim Status',
            session_outcome: 'Contained' as const,
            transfer_reason: '',
            drop_off_location: '',
            notes: 'User inquired about claim status.'
          }
          // Missing user-2 result (partial failure)
        ],
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.003,
        model: 'gpt-4o-mini-2024-07-18'
      };

      mockOpenaiService.analyzeBatch.mockResolvedValue(mockAnalysisResult);

      const result = await batchAnalysisService.processSessionsBatch(
        mockSessions,
        mockExistingClassifications,
        'sk-test-key'
      );

      expect(result.results).toHaveLength(2);
      expect(result.results[0]?.facts.generalIntent).toBe('Claim Status');
      // Should have fallback result for missing session
      expect(result.results[1]?.facts.generalIntent).toBe('Unknown');
      expect(result.results[1]?.facts.notes).toContain('Failed individual processing');
    });

    it('should handle complete batch failure with fallback results', async () => {
      mockOpenaiService.analyzeBatch.mockRejectedValue(new Error('OpenAI API error'));

      const result = await batchAnalysisService.processSessionsBatch(
        mockSessions,
        mockExistingClassifications,
        'sk-test-key'
      );

      expect(result.results).toHaveLength(2);
      // All results should be fallback
      result.results.forEach(sessionWithFacts => {
        expect(sessionWithFacts.facts.generalIntent).toBe('Unknown');
        expect(sessionWithFacts.facts.sessionOutcome).toBe('Contained');
        expect(sessionWithFacts.facts.notes).toContain('Error processing session');
      });
    });

    it('should update classification sets correctly', async () => {
      const mockAnalysisResult = {
        sessions: [
          {
            user_id: 'user-1',
            general_intent: 'New Intent',
            session_outcome: 'Transfer' as const,
            transfer_reason: 'New Reason',
            drop_off_location: 'New Location',
            notes: 'Test session.'
          }
        ],
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.003,
        model: 'gpt-4o-mini-2024-07-18'
      };

      mockOpenaiService.analyzeBatch.mockResolvedValue(mockAnalysisResult);

      const result = await batchAnalysisService.processSessionsBatch(
        [mockSessions[0]!], // Single session
        mockExistingClassifications,
        'sk-test-key'
      );

      // Should preserve existing classifications
      expect(result.updatedClassifications.generalIntent.has('Claim Status')).toBe(true);
      expect(result.updatedClassifications.generalIntent.has('Live Agent')).toBe(true);
      
      // Should add new classifications
      expect(result.updatedClassifications.generalIntent.has('New Intent')).toBe(true);
      expect(result.updatedClassifications.transferReason.has('New Reason')).toBe(true);
      expect(result.updatedClassifications.dropOffLocation.has('New Location')).toBe(true);
    });

    it('should not add empty classifications to sets', async () => {
      const mockAnalysisResult = {
        sessions: [
          {
            user_id: 'user-1',
            general_intent: 'Claim Status',
            session_outcome: 'Contained' as const,
            transfer_reason: '', // Empty - should not be added
            drop_off_location: '', // Empty - should not be added
            notes: 'Contained session.'
          }
        ],
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.003,
        model: 'gpt-4o-mini-2024-07-18'
      };

      mockOpenaiService.analyzeBatch.mockResolvedValue(mockAnalysisResult);

      const initialClassifications: ExistingClassifications = {
        generalIntent: new Set(),
        transferReason: new Set(),
        dropOffLocation: new Set()
      };

      const result = await batchAnalysisService.processSessionsBatch(
        [mockSessions[0]!],
        initialClassifications,
        'sk-test-key'
      );

      expect(result.updatedClassifications.generalIntent.has('Claim Status')).toBe(true);
      expect(result.updatedClassifications.transferReason.size).toBe(0);
      expect(result.updatedClassifications.dropOffLocation.size).toBe(0);
    });

    it('should include proper metadata in results', async () => {
      const mockAnalysisResult = {
        sessions: [
          {
            user_id: 'user-1',
            general_intent: 'Claim Status',
            session_outcome: 'Contained' as const,
            transfer_reason: '',
            drop_off_location: '',
            notes: 'Test session.'
          }
        ],
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.003,
        model: 'gpt-4o-mini-2024-07-18'
      };

      mockOpenaiService.analyzeBatch.mockResolvedValue(mockAnalysisResult);

      const result = await batchAnalysisService.processSessionsBatch(
        [mockSessions[0]!],
        mockExistingClassifications,
        'sk-test-key'
      );

      const sessionWithFacts = result.results[0];
      expect(sessionWithFacts?.analysisMetadata.tokensUsed).toBe(150);
      expect(sessionWithFacts?.analysisMetadata.batchNumber).toBe(1);
      expect(sessionWithFacts?.analysisMetadata.processingTime).toBeGreaterThan(0);
      expect(sessionWithFacts?.analysisMetadata.timestamp).toBeDefined();
    });
  });

  describe('splitOversizedSessions', () => {
    it('should separate long sessions for individual processing', () => {
      const shortSession: SessionWithTranscript = {
        session_id: 'short',
        user_id: 'user-1',
        start_time: '2024-01-15T09:00:00Z',
        end_time: '2024-01-15T09:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T09:00:00Z', message_type: 'user', message: 'Short message' }
        ],
        message_count: 1,
        user_message_count: 1,
        bot_message_count: 0
      };

      const longSession: SessionWithTranscript = {
        session_id: 'long',
        user_id: 'user-2',
        start_time: '2024-01-15T10:00:00Z',
        end_time: '2024-01-15T10:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T10:00:00Z', message_type: 'user', message: 'x'.repeat(10000) }
        ],
        message_count: 1,
        user_message_count: 1,
        bot_message_count: 0
      };

      const result = batchAnalysisService.splitOversizedSessions(
        [shortSession, longSession],
        8000 // Max session length
      );

      expect(result.regularSessions).toHaveLength(1);
      expect(result.regularSessions[0]?.session_id).toBe('short');
      expect(result.oversizedSessions).toHaveLength(1);
      expect(result.oversizedSessions[0]?.session_id).toBe('long');
    });
  });

  describe('calculateSessionLength', () => {
    it('should calculate total character length of session messages', () => {
      const session: SessionWithTranscript = {
        session_id: 'test',
        user_id: 'user',
        start_time: '2024-01-15T09:00:00Z',
        end_time: '2024-01-15T09:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T09:00:00Z', message_type: 'user', message: 'Hello' }, // 5 chars
          { timestamp: '2024-01-15T09:01:00Z', message_type: 'bot', message: 'Hi there!' } // 9 chars
        ],
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      };

      const length = batchAnalysisService.calculateSessionLength(session);
      expect(length).toBe(14); // 5 + 9
    });
  });
});