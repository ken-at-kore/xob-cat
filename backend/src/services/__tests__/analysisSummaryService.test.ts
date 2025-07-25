import { AnalysisSummaryService } from '../analysisSummaryService';
import { SessionWithFacts, AnalysisSummary } from '../../../../shared/types';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('AnalysisSummaryService', () => {
  let service: AnalysisSummaryService;
  let mockOpenAI: jest.Mocked<OpenAI>;

  const mockSessions: SessionWithFacts[] = [
    {
      session_id: 'session1',
      user_id: 'user1',
      start_time: '2025-07-25T09:00:00Z',
      end_time: '2025-07-25T09:10:00Z',
      containment_type: 'selfService',
      tags: [],
      metrics: {},
      messages: [
        { message: 'Hello', message_type: 'bot', timestamp: '2025-07-25T09:00:00Z' },
        { message: 'Hi, I need help', message_type: 'user', timestamp: '2025-07-25T09:01:00Z' }
      ],
      duration_seconds: 600,
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1,
      facts: {
        generalIntent: 'Billing',
        sessionOutcome: 'Contained',
        transferReason: '',
        dropOffLocation: '',
        notes: 'User successfully completed billing inquiry'
      },
      analysisMetadata: {
        tokensUsed: 500,
        processingTime: 2000,
        batchNumber: 1,
        timestamp: '2025-07-25T09:10:00Z'
      }
    },
    {
      session_id: 'session2',
      user_id: 'user2',
      start_time: '2025-07-25T10:00:00Z',
      end_time: '2025-07-25T10:15:00Z',
      containment_type: 'agent',
      tags: [],
      metrics: {},
      messages: [
        { message: 'Hello', message_type: 'bot', timestamp: '2025-07-25T10:00:00Z' },
        { message: 'I need help with claims', message_type: 'user', timestamp: '2025-07-25T10:01:00Z' }
      ],
      duration_seconds: 900,
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1,
      facts: {
        generalIntent: 'Claim Status',
        sessionOutcome: 'Transfer',
        transferReason: 'Technical Issue',
        dropOffLocation: 'Authentication',
        notes: 'User encountered technical issue and was transferred to agent'
      },
      analysisMetadata: {
        tokensUsed: 450,
        processingTime: 1800,
        batchNumber: 1,
        timestamp: '2025-07-25T10:15:00Z'
      }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    service = new AnalysisSummaryService('test-api-key');
    // Access the mocked instance
    mockOpenAI = (service as any).openai;
  });

  describe('generateAnalysisSummary', () => {
    it('should generate analysis summary successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: `# ANALYSIS_OVERVIEW
This analysis examined 2 chatbot sessions from Jul 25, 2025, revealing a 50% transfer rate with 1 transferred and 1 contained session.

# ANALYSIS_SUMMARY  
## Performance Analysis
The analysis shows mixed performance with opportunities for improvement in technical issue handling.`
          }
        }],
        usage: {
          total_tokens: 1000,
          prompt_tokens: 800,
          completion_tokens: 200
        }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.generateAnalysisSummary(mockSessions);

      expect(result).toEqual({
        overview: 'This analysis examined 2 chatbot sessions from Jul 25, 2025, revealing a 50% transfer rate with 1 transferred and 1 contained session.',
        summary: '## Performance Analysis\nThe analysis shows mixed performance with opportunities for improvement in technical issue handling.',
        generatedAt: expect.any(String),
        sessionsAnalyzed: 2,
        statistics: {
          totalSessions: 2,
          transferRate: 50,
          containmentRate: 50,
          averageSessionLength: 12.5, // (10 + 15) / 2
          averageMessagesPerSession: 2
        }
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: expect.stringContaining('XOB CAT Bot Analysis Context') }],
        temperature: 0.7,
        max_tokens: 2000
      });
    });

    it('should handle empty sessions array', async () => {
      await expect(service.generateAnalysisSummary([])).rejects.toThrow('No sessions provided for analysis');
    });

    it('should handle malformed OpenAI response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid response without proper sections'
          }
        }],
        usage: { total_tokens: 100 }
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      await expect(service.generateAnalysisSummary(mockSessions)).rejects.toThrow('Could not parse OpenAI response into required sections');
    });

    it('should handle OpenAI API errors', async () => {
      const apiError = new Error('OpenAI API error');
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(apiError);

      await expect(service.generateAnalysisSummary(mockSessions)).rejects.toThrow('OpenAI API error');
    });
  });

  describe('aggregateAnalysisData', () => {
    it('should correctly aggregate session statistics', () => {
      const aggregation = (service as any).aggregateAnalysisData(mockSessions);

      expect(aggregation).toEqual({
        totalSessions: 2,
        transferCount: 1,
        containedCount: 1,
        transferRate: 50,
        containmentRate: 50,
        averageSessionLength: 12.5,
        totalMessages: 4,
        averageMessagesPerSession: 2,
        intentBreakdown: {
          'Billing': 1,
          'Claim Status': 1
        },
        transferReasonBreakdown: {
          'Technical Issue': 1
        },
        dropOffLocationBreakdown: {
          'Authentication': 1
        },
        allSessionNotes: [
          'User successfully completed billing inquiry',
          'User encountered technical issue and was transferred to agent'
        ],
        sampleTranscripts: expect.arrayContaining([
          expect.objectContaining({
            sessionId: expect.any(String),
            intent: expect.any(String),
            outcome: expect.any(String),
            messages: expect.any(Array)
          })
        ])
      });
    });
  });

  describe('calculateAnalysisPeriod', () => {
    it('should return single date for same-day sessions', () => {
      const sameDaySessions = mockSessions.map(s => ({
        ...s,
        start_time: '2025-07-25T09:00:00Z'
      }));
      
      const period = (service as any).calculateAnalysisPeriod(sameDaySessions);
      expect(period).toBe('Jul 25, 2025');
    });

    it('should return date range for multi-day sessions', () => {
      const multiDaySessions = [
        { ...mockSessions[0], start_time: '2025-07-25T09:00:00Z' },
        { ...mockSessions[1], start_time: '2025-07-26T10:00:00Z' }
      ];
      
      const period = (service as any).calculateAnalysisPeriod(multiDaySessions);
      expect(period).toBe('Jul 25, 2025 - Jul 26, 2025');
    });
  });
});