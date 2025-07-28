/**
 * Tests for LLMInferenceService
 * 
 * This test suite verifies the functionality of the shared LLM inference service
 * including data aggregation, analysis generation, and response parsing.
 */

import { LLMInferenceService } from '../llmInferenceService';
import { SessionWithFacts } from '../../types';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

describe('LLMInferenceService', () => {
  let service: LLMInferenceService;
  let mockOpenAI: any;

  const mockSessions: SessionWithFacts[] = [
    {
      session_id: 'session1',
      user_id: 'user1',
      containment_type: 'selfService',
      tags: [],
      metrics: {},
      start_time: '2025-07-07T09:00:00Z',
      end_time: '2025-07-07T09:15:00Z',
      duration_seconds: 900,
      message_count: 8,
      user_message_count: 4,
      bot_message_count: 4,
      messages: [
        { message: 'Hello, I need help', message_type: 'user', timestamp: '2025-07-07T09:00:00Z' },
        { message: 'How can I help you?', message_type: 'bot', timestamp: '2025-07-07T09:00:30Z' }
      ],
      facts: {
        generalIntent: 'Technical Support',
        sessionOutcome: 'Transfer',
        transferReason: 'No Provider ID',
        dropOffLocation: 'Provider ID Prompt',
        notes: 'User needed help with provider verification but could not provide ID'
      },
      analysisMetadata: {
        tokensUsed: 450,
        processingTime: 2000,
        batchNumber: 1,
        timestamp: '2025-07-07T09:00:00Z'
      }
    },
    {
      session_id: 'session2',
      user_id: 'user2',
      containment_type: 'agent',
      tags: [],
      metrics: {},
      start_time: '2025-07-07T10:00:00Z',
      end_time: '2025-07-07T10:10:00Z',
      duration_seconds: 600,
      message_count: 6,
      user_message_count: 3,
      bot_message_count: 3,
      messages: [
        { message: 'I want to check my eligibility', message_type: 'user', timestamp: '2025-07-07T10:00:00Z' },
        { message: 'I can help with that', message_type: 'bot', timestamp: '2025-07-07T10:00:30Z' }
      ],
      facts: {
        generalIntent: 'Eligibility',
        sessionOutcome: 'Contained',
        transferReason: '',
        dropOffLocation: '',
        notes: 'User successfully checked eligibility through self-service'
      },
      analysisMetadata: {
        tokensUsed: 380,
        processingTime: 1800,
        batchNumber: 1,
        timestamp: '2025-07-07T10:00:00Z'
      }
    }
  ];

  beforeEach(() => {
    const OpenAI = require('openai').default;
    mockOpenAI = new OpenAI();
    service = new LLMInferenceService('test-api-key');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('aggregateAnalysisData', () => {
    it('should correctly aggregate session data', () => {
      const aggregation = service.aggregateAnalysisData(mockSessions);

      expect(aggregation.totalSessions).toBe(2);
      expect(aggregation.transferCount).toBe(1);
      expect(aggregation.containedCount).toBe(1);
      expect(aggregation.transferRate).toBe(50);
      expect(aggregation.containmentRate).toBe(50);
      expect(aggregation.averageSessionLength).toBe(12.5); // (15 + 10) / 2
      expect(aggregation.totalMessages).toBe(14);
      expect(aggregation.averageMessagesPerSession).toBe(7);
    });

    it('should create correct intent breakdown', () => {
      const aggregation = service.aggregateAnalysisData(mockSessions);

      expect(aggregation.intentBreakdown).toEqual({
        'Technical Support': 1,
        'Eligibility': 1
      });
    });

    it('should create correct transfer reason breakdown', () => {
      const aggregation = service.aggregateAnalysisData(mockSessions);

      expect(aggregation.transferReasonBreakdown).toEqual({
        'No Provider ID': 1
      });
    });

    it('should create correct drop-off location breakdown', () => {
      const aggregation = service.aggregateAnalysisData(mockSessions);

      expect(aggregation.dropOffLocationBreakdown).toEqual({
        'Provider ID Prompt': 1
      });
    });

    it('should collect all session notes', () => {
      const aggregation = service.aggregateAnalysisData(mockSessions);

      expect(aggregation.allSessionNotes).toEqual([
        'User needed help with provider verification but could not provide ID',
        'User successfully checked eligibility through self-service'
      ]);
    });

    it('should create sample transcripts', () => {
      const aggregation = service.aggregateAnalysisData(mockSessions);

      expect(aggregation.sampleTranscripts).toHaveLength(2);
      expect(aggregation.sampleTranscripts[0]).toEqual({
        sessionId: expect.any(String),
        intent: expect.any(String),
        outcome: expect.any(String),
        messages: expect.any(Array)
      });
    });
  });

  describe('generateAnalysisSummary', () => {
    const mockOpenAIResponse = `# ANALYSIS_OVERVIEW
This report presents analysis of the **XO bot's performance** based on 2 sessions.

Key findings:
- **Transfer rate**: 50%
- **Top intent**: Technical Support

# ANALYSIS_SUMMARY
## Key Performance Patterns
- **Transfer Rate**: 50% of sessions resulted in transfers
- **Top Intents**: Technical Support (50%), Eligibility (50%)

## Recommendations
- **Priority 1**: Improve provider ID capture process

# CONTAINMENT_SUGGESTION
Enhance provider ID verification flow to reduce 50% of transfers caused by missing provider information.`;

    beforeEach(() => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: mockOpenAIResponse
          }
        }],
        usage: {
          total_tokens: 1500
        }
      });
    });

    it('should generate analysis summary successfully', async () => {
      const result = await service.generateAnalysisSummary(mockSessions);

      expect(result.overview).toContain('XO bot\'s performance');
      expect(result.summary).toContain('Key Performance Patterns');
      expect(result.containmentSuggestion).toContain('Enhance provider ID verification');
      expect(result.tokensUsed).toBe(1500);
      expect(result.cost).toBeGreaterThan(0);
    });

    it('should throw error when no sessions provided', async () => {
      await expect(service.generateAnalysisSummary([])).rejects.toThrow('No sessions provided for analysis');
    });

    it('should throw error when OpenAI returns no response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }]
      });

      await expect(service.generateAnalysisSummary(mockSessions)).rejects.toThrow('No response from OpenAI');
    });

    it('should throw error when response cannot be parsed', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid response format'
          }
        }]
      });

      await expect(service.generateAnalysisSummary(mockSessions)).rejects.toThrow('Could not parse OpenAI response');
    });

    it('should handle OpenAI API errors', async () => {
      const apiError = new Error('OpenAI API Error');
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      await expect(service.generateAnalysisSummary(mockSessions)).rejects.toThrow('OpenAI API Error');
    });
  });

  describe('createAnalysisSummary', () => {
    it('should create structured AnalysisSummary object', () => {
      const llmResponse = {
        overview: 'Test overview',
        summary: 'Test summary',
        containmentSuggestion: 'Test suggestion',
        tokensUsed: 1000,
        cost: 0.05
      };

      const result = service.createAnalysisSummary(llmResponse, mockSessions);

      expect(result).toEqual({
        overview: 'Test overview',
        summary: 'Test summary',
        containmentSuggestion: 'Test suggestion',
        generatedAt: expect.any(String),
        sessionsAnalyzed: 2,
        statistics: {
          totalSessions: 2,
          transferRate: 50,
          containmentRate: 50,
          averageSessionLength: 12.5,
          averageMessagesPerSession: 7
        }
      });
    });
  });

  describe('cost calculation', () => {
    it('should calculate cost correctly based on token usage', async () => {
      const mockResponse = `# ANALYSIS_OVERVIEW
Test overview
# ANALYSIS_SUMMARY
Test summary
# CONTAINMENT_SUGGESTION
Test suggestion`;

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: mockResponse }
        }],
        usage: { total_tokens: 2000 }
      });

      const result = await service.generateAnalysisSummary(mockSessions);

      // Expected cost calculation:
      // Input tokens (60%): 1200 * 0.00015 / 1000 = 0.00018
      // Output tokens (40%): 800 * 0.0006 / 1000 = 0.00048
      // Total: 0.00066
      expect(result.cost).toBeCloseTo(0.00066, 5);
    });
  });

  describe('edge cases', () => {
    it('should handle sessions with missing duration', () => {
      const sessionsWithoutDuration = mockSessions.map(s => {
        const { duration_seconds, ...sessionWithoutDuration } = s;
        return sessionWithoutDuration as SessionWithFacts;
      });

      const aggregation = service.aggregateAnalysisData(sessionsWithoutDuration);

      // Should calculate from start/end time
      expect(aggregation.averageSessionLength).toBeGreaterThan(0);
    });

    it('should handle sessions with no messages', () => {
      const sessionsWithoutMessages = mockSessions.map(s => ({
        ...s,
        messages: []
      }));

      const aggregation = service.aggregateAnalysisData(sessionsWithoutMessages);

      expect(aggregation.sampleTranscripts[0]?.messages).toEqual([]);
    });

    it('should handle sessions with no transfer reasons', () => {
      const containedSessions = mockSessions.map(s => ({
        ...s,
        facts: {
          ...s.facts,
          sessionOutcome: 'Contained' as const,
          transferReason: '',
          dropOffLocation: ''
        }
      }));

      const aggregation = service.aggregateAnalysisData(containedSessions);

      expect(aggregation.transferReasonBreakdown).toEqual({});
      expect(aggregation.dropOffLocationBreakdown).toEqual({});
    });
  });
});