import { OpenAIAnalysisService } from '../../services/openaiAnalysisService';
import { SessionWithTranscript, ExistingClassifications } from '../../../../shared/types';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');

describe('OpenAIAnalysisService', () => {
  let openaiAnalysisService: OpenAIAnalysisService;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockChatCompletions: jest.MockedObject<OpenAI.Chat.Completions>;

  beforeEach(() => {
    mockChatCompletions = {
      create: jest.fn()
    } as any;

    mockOpenAI = {
      chat: {
        completions: mockChatCompletions
      }
    } as any;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    openaiAnalysisService = new OpenAIAnalysisService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeBatch', () => {
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
          { timestamp: '2024-01-15T09:00:00Z', message_type: 'user', message: 'I need help with my claim status' },
          { timestamp: '2024-01-15T09:01:00Z', message_type: 'bot', message: 'I can help you check your claim status' }
        ],
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      }
    ];

    const mockExistingClassifications: ExistingClassifications = {
      generalIntent: new Set(['Claim Status']),
      transferReason: new Set(),
      dropOffLocation: new Set()
    };

    it('should successfully analyze batch and return structured results', async () => {
      const mockResponse = {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  sessions: [{
                    user_id: 'user-1',
                    general_intent: 'Claim Status',
                    session_outcome: 'Contained',
                    transfer_reason: '',
                    drop_off_location: '',
                    notes: 'User inquired about claim status and received assistance.'
                  }]
                })
              }
            }]
          }
        }],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 75,
          total_tokens: 225
        },
        model: 'gpt-4o-mini-2024-07-18'
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse as any);

      const result = await openaiAnalysisService.analyzeBatch(
        mockSessions,
        mockExistingClassifications,
        'sk-test-key'
      );

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]?.user_id).toBe('user-1');
      expect(result.sessions[0]?.general_intent).toBe('Claim Status');
      expect(result.sessions[0]?.session_outcome).toBe('Contained');
      expect(result.promptTokens).toBe(150);
      expect(result.completionTokens).toBe(75);
      expect(result.totalTokens).toBe(225);
      expect(result.cost).toBeCloseTo(0.00675); // (150 * 0.000015 + 75 * 0.000060) / 1
    });

    it('should include existing classifications in prompt for consistency', async () => {
      const classificationsWithData: ExistingClassifications = {
        generalIntent: new Set(['Claim Status', 'Billing', 'Eligibility']),
        transferReason: new Set(['Invalid Provider ID', 'Authentication Failed']),
        dropOffLocation: new Set(['Provider ID Prompt', 'Member Information'])
      };

      const mockResponse = {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  sessions: [{
                    user_id: 'user-1',
                    general_intent: 'Claim Status',
                    session_outcome: 'Contained',
                    transfer_reason: '',
                    drop_off_location: '',
                    notes: 'User inquired about claim status.'
                  }]
                })
              }
            }]
          }
        }],
        usage: { prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 },
        model: 'gpt-4o-mini-2024-07-18'
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse as any);

      await openaiAnalysisService.analyzeBatch(
        mockSessions,
        classificationsWithData,
        'sk-test-key'
      );

      // Verify the prompt includes existing classifications
      const callArgs = mockChatCompletions.create.mock.calls[0]?.[0];
      const prompt = callArgs?.messages[1]?.content;
      
      expect(prompt).toContain('Existing General Intent classifications: Billing, Claim Status, Eligibility');
      expect(prompt).toContain('Existing Transfer Reason classifications: Authentication Failed, Invalid Provider ID');
      expect(prompt).toContain('Existing Drop-Off Location classifications: Member Information, Provider ID Prompt');
    });

    it('should handle missing tool calls in response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            tool_calls: null // No tool calls
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gpt-4o-mini-2024-07-18'
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse as any);

      await expect(openaiAnalysisService.analyzeBatch(
        mockSessions,
        mockExistingClassifications,
        'sk-test-key'
      )).rejects.toThrow('No tool calls in response');
    });

    it('should handle invalid JSON in function arguments', async () => {
      const mockResponse = {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: 'invalid json{'
              }
            }]
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gpt-4o-mini-2024-07-18'
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse as any);

      await expect(openaiAnalysisService.analyzeBatch(
        mockSessions,
        mockExistingClassifications,
        'sk-test-key'
      )).rejects.toThrow();
    });

    it('should handle OpenAI API errors', async () => {
      mockChatCompletions.create.mockRejectedValue(new Error('OpenAI API Error'));

      await expect(openaiAnalysisService.analyzeBatch(
        mockSessions,
        mockExistingClassifications,
        'sk-test-key'
      )).rejects.toThrow('OpenAI API Error');
    });

    it('should use correct model and temperature settings', async () => {
      const mockResponse = {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  sessions: [{
                    user_id: 'user-1',
                    general_intent: 'Unknown',
                    session_outcome: 'Contained',
                    transfer_reason: '',
                    drop_off_location: '',
                    notes: 'Test session.'
                  }]
                })
              }
            }]
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        model: 'gpt-4o-mini-2024-07-18'
      };

      mockChatCompletions.create.mockResolvedValue(mockResponse as any);

      await openaiAnalysisService.analyzeBatch(
        mockSessions,
        mockExistingClassifications,
        'sk-test-key'
      );

      const callArgs = mockChatCompletions.create.mock.calls[0]?.[0];
      expect(callArgs?.model).toBe('gpt-4o-mini');
      expect(callArgs?.temperature).toBe(0);
      expect(callArgs?.tools).toHaveLength(1);
      expect(callArgs?.tool_choice).toEqual({
        type: 'function',
        function: { name: 'analyze_sessions_batch' }
      });
    });
  });

  describe('createAnalysisPrompt', () => {
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
          { timestamp: '2024-01-15T09:00:00Z', message_type: 'user', message: 'Hello' },
          { timestamp: '2024-01-15T09:01:00Z', message_type: 'bot', message: 'Hi there!' }
        ],
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      }
    ];

    it('should generate prompt with session transcripts formatted correctly', () => {
      const emptyClassifications: ExistingClassifications = {
        generalIntent: new Set(),
        transferReason: new Set(),
        dropOffLocation: new Set()
      };

      const prompt = openaiAnalysisService.createAnalysisPrompt(mockSessions, emptyClassifications);

      expect(prompt).toContain('--- Session 1 ---');
      expect(prompt).toContain('User ID: user-1');
      expect(prompt).toContain('user: Hello');
      expect(prompt).toContain('bot: Hi there!');
    });

    it('should include existing classifications when provided', () => {
      const classifications: ExistingClassifications = {
        generalIntent: new Set(['Claim Status', 'Billing']),
        transferReason: new Set(['Invalid ID']),
        dropOffLocation: new Set(['Authentication'])
      };

      const prompt = openaiAnalysisService.createAnalysisPrompt(mockSessions, classifications);

      expect(prompt).toContain('Existing General Intent classifications: Billing, Claim Status');
      expect(prompt).toContain('Existing Transfer Reason classifications: Invalid ID');
      expect(prompt).toContain('Existing Drop-Off Location classifications: Authentication');
    });

    it('should handle empty classification sets', () => {
      const emptyClassifications: ExistingClassifications = {
        generalIntent: new Set(),
        transferReason: new Set(),
        dropOffLocation: new Set()
      };

      const prompt = openaiAnalysisService.createAnalysisPrompt(mockSessions, emptyClassifications);

      expect(prompt).not.toContain('Existing General Intent classifications:');
      expect(prompt).not.toContain('Existing Transfer Reason classifications:');
      expect(prompt).not.toContain('Existing Drop-Off Location classifications:');
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for GPT-4o-mini', () => {
      const cost = openaiAnalysisService.calculateCost(1000, 500, 'gpt-4o-mini-2024-07-18');
      
      // (1000 * 0.000015 + 500 * 0.000060) / 1000000 * 1000000 = 0.000015 + 0.00003 = 0.000045
      expect(cost).toBeCloseTo(0.000045);
    });

    it('should return 0 for unknown models', () => {
      const cost = openaiAnalysisService.calculateCost(1000, 500, 'unknown-model');
      expect(cost).toBe(0);
    });
  });
});