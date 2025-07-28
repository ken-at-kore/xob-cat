/**
 * Tests for AnalysisSummaryService
 * 
 * This test suite verifies the updated analysis summary service that uses
 * the shared LLMInferenceService for consistent prompt engineering.
 */

import { AnalysisSummaryService } from '../analysisSummaryService';
import { SessionWithFacts } from '../../../../shared/types';
import { LLMInferenceService } from '../../../../shared/services/llmInferenceService';

// Mock the shared LLM service
jest.mock('../../../../shared/services/llmInferenceService');

const MockedLLMService = LLMInferenceService as jest.MockedClass<typeof LLMInferenceService>;

describe('AnalysisSummaryService', () => {
  let service: AnalysisSummaryService;
  let mockLLMService: jest.Mocked<LLMInferenceService>;

  const mockSessions: SessionWithFacts[] = [
    {
      session_id: 'session1',
      user_id: 'user1',
      start_time: '2025-07-07T09:00:00Z',
      end_time: '2025-07-07T09:15:00Z',
      containment_type: 'selfService',
      tags: [],
      metrics: {},
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
      start_time: '2025-07-07T10:00:00Z',
      end_time: '2025-07-07T10:10:00Z',
      containment_type: 'agent',
      tags: [],
      metrics: {},
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
    mockLLMService = {
      generateAnalysisSummary: jest.fn(),
      createAnalysisSummary: jest.fn(),
      aggregateAnalysisData: jest.fn()
    } as any;

    MockedLLMService.mockImplementation(() => mockLLMService);
    service = new AnalysisSummaryService('test-api-key');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAnalysisSummary', () => {
    const mockLLMResponse = {
      overview: 'This report presents analysis of the **XO bot\'s performance** based on 2 sessions.',
      summary: '## Key Performance Patterns\n- **Transfer Rate**: 50% of sessions resulted in transfers',
      containmentSuggestion: 'Enhance provider ID verification flow to reduce 50% of transfers',
      tokensUsed: 1500,
      cost: 0.0011
    };

    const mockAnalysisSummary = {
      overview: mockLLMResponse.overview,
      summary: mockLLMResponse.summary,
      containmentSuggestion: mockLLMResponse.containmentSuggestion,
      generatedAt: '2025-07-28T17:00:00.000Z',
      sessionsAnalyzed: 2,
      statistics: {
        totalSessions: 2,
        transferRate: 50,
        containmentRate: 50,
        averageSessionLength: 12.5,
        averageMessagesPerSession: 7
      }
    };

    beforeEach(() => {
      mockLLMService.generateAnalysisSummary.mockResolvedValue(mockLLMResponse);
      mockLLMService.createAnalysisSummary.mockReturnValue(mockAnalysisSummary);
    });

    it('should generate analysis summary using shared LLM service', async () => {
      const result = await service.generateAnalysisSummary(mockSessions);

      expect(mockLLMService.generateAnalysisSummary).toHaveBeenCalledWith(mockSessions);
      expect(mockLLMService.createAnalysisSummary).toHaveBeenCalledWith(mockLLMResponse, mockSessions);
      expect(result).toEqual(mockAnalysisSummary);
    });

    it('should handle LLM service errors', async () => {
      const error = new Error('LLM service error');
      mockLLMService.generateAnalysisSummary.mockRejectedValue(error);

      await expect(service.generateAnalysisSummary(mockSessions)).rejects.toThrow('LLM service error');
    });

    it('should pass through structured analysis summary', async () => {
      const result = await service.generateAnalysisSummary(mockSessions);

      expect(result.overview).toContain('XO bot\'s performance');
      expect(result.summary).toContain('Key Performance Patterns');
      expect(result.containmentSuggestion).toContain('Enhance provider ID verification');
      expect(result.generatedAt).toBeDefined();
      expect(result.sessionsAnalyzed).toBe(2);
      expect(result.statistics).toEqual({
        totalSessions: 2,
        transferRate: 50,
        containmentRate: 50,
        averageSessionLength: 12.5,
        averageMessagesPerSession: 7
      });
    });

    it('should handle empty sessions array', async () => {
      const error = new Error('No sessions provided for analysis');
      mockLLMService.generateAnalysisSummary.mockRejectedValue(error);

      await expect(service.generateAnalysisSummary([])).rejects.toThrow('No sessions provided for analysis');
    });

    it('should use the correct API key for LLM service', () => {
      expect(MockedLLMService).toHaveBeenCalledWith('test-api-key');
    });
  });

  describe('error handling and edge cases', () => {
    it('should propagate LLM service analysis errors', async () => {
      const analysisError = new Error('OpenAI API rate limit exceeded');
      mockLLMService.generateAnalysisSummary.mockRejectedValue(analysisError);

      await expect(service.generateAnalysisSummary(mockSessions)).rejects.toThrow('OpenAI API rate limit exceeded');
      expect(mockLLMService.generateAnalysisSummary).toHaveBeenCalledWith(mockSessions);
    });

    it('should propagate LLM service parsing errors', async () => {
      const parsingError = new Error('Could not parse OpenAI response into required sections');
      mockLLMService.generateAnalysisSummary.mockRejectedValue(parsingError);

      await expect(service.generateAnalysisSummary(mockSessions)).rejects.toThrow('Could not parse OpenAI response');
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      mockLLMService.generateAnalysisSummary.mockRejectedValue(networkError);

      await expect(service.generateAnalysisSummary(mockSessions)).rejects.toThrow('Network timeout');
    });
  });

  describe('integration with shared LLM service', () => {
    it('should delegate aggregation logic to shared service', async () => {
      const mockLLMResponse = {
        overview: 'Test overview',
        summary: 'Test summary',
        containmentSuggestion: 'Test suggestion',
        tokensUsed: 1000,
        cost: 0.005
      };

      mockLLMService.generateAnalysisSummary.mockResolvedValue(mockLLMResponse);
      mockLLMService.createAnalysisSummary.mockReturnValue({
        overview: 'Test overview',
        summary: 'Test summary',
        containmentSuggestion: 'Test suggestion',
        generatedAt: '2025-07-28T17:00:00.000Z',
        sessionsAnalyzed: 2,
        statistics: {
          totalSessions: 2,
          transferRate: 50,
          containmentRate: 50,
          averageSessionLength: 12.5,
          averageMessagesPerSession: 7
        }
      });

      await service.generateAnalysisSummary(mockSessions);

      expect(mockLLMService.generateAnalysisSummary).toHaveBeenCalledTimes(1);
      expect(mockLLMService.createAnalysisSummary).toHaveBeenCalledWith(mockLLMResponse, mockSessions);
    });

    it('should maintain backwards compatibility with existing interface', async () => {
      const mockResult = {
        overview: 'Test',
        summary: 'Test',
        containmentSuggestion: 'Test',
        generatedAt: '2025-07-28T17:00:00.000Z',
        sessionsAnalyzed: 2,
        statistics: {
          totalSessions: 2,
          transferRate: 50,
          containmentRate: 50,
          averageSessionLength: 12.5,
          averageMessagesPerSession: 7
        }
      };

      mockLLMService.generateAnalysisSummary.mockResolvedValue({
        overview: 'Test',
        summary: 'Test',
        containmentSuggestion: 'Test',
        tokensUsed: 1000,
        cost: 0.005
      });
      mockLLMService.createAnalysisSummary.mockReturnValue(mockResult);

      const result = await service.generateAnalysisSummary(mockSessions);

      // Verify the result has all expected properties for backwards compatibility
      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('containmentSuggestion');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('sessionsAnalyzed');
      expect(result).toHaveProperty('statistics');
      expect(result.statistics).toHaveProperty('totalSessions');
      expect(result.statistics).toHaveProperty('transferRate');
      expect(result.statistics).toHaveProperty('containmentRate');
      expect(result.statistics).toHaveProperty('averageSessionLength');
      expect(result.statistics).toHaveProperty('averageMessagesPerSession');
    });
  });
});