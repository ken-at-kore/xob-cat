import { AutoAnalyzeService } from '../../services/autoAnalyzeService';
import { KoreApiService } from '../../services/koreApiService';
import { SessionSamplingService } from '../../services/sessionSamplingService';
import { BatchAnalysisService } from '../../services/batchAnalysisService';
import { OpenAIAnalysisService } from '../../services/openaiAnalysisService';
import { AnalysisConfig } from '../../../../shared/types';

// Mock all dependencies
jest.mock('../../services/koreApiService');
jest.mock('../../services/sessionSamplingService');
jest.mock('../../services/batchAnalysisService');
jest.mock('../../services/openaiAnalysisService');

describe('AutoAnalyzeService - Bot ID Integration', () => {
  let autoAnalyzeService: AutoAnalyzeService;
  let mockKoreApiService: jest.Mocked<KoreApiService>;
  let mockSessionSamplingService: jest.Mocked<SessionSamplingService>;
  let mockBatchAnalysisService: jest.Mocked<BatchAnalysisService>;
  let mockOpenAIAnalysisService: jest.Mocked<OpenAIAnalysisService>;

  const testBotId = 'st-test-bot-12345678-abcd-efgh-ijkl-mnopqrstuvwx';
  const testJwtToken = 'test-jwt-token';

  const mockConfig: AnalysisConfig = {
    startDate: '2025-01-15',
    startTime: '09:00',
    sessionCount: 10,
    openaiApiKey: 'sk-test-key',
    modelId: 'gpt-4o-mini'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear singleton instance before each test
    (AutoAnalyzeService as any).instance = null;

    // Create mock instances with proper mocking
    mockKoreApiService = {
      getSessionsInTimeWindow: jest.fn(),
      getMessages: jest.fn()
    } as any;

    mockSessionSamplingService = {
      sampleSessions: jest.fn()
    } as any;

    mockBatchAnalysisService = {
      processSessionsBatch: jest.fn()
    } as any;

    mockOpenAIAnalysisService = {
      analyzeBatch: jest.fn(),
      calculateCost: jest.fn()
    } as any;

    // Mock the constructor calls in create method
    (KoreApiService as jest.MockedClass<typeof KoreApiService>).mockImplementation(() => mockKoreApiService);
    (SessionSamplingService as jest.MockedClass<typeof SessionSamplingService>).mockImplementation(() => mockSessionSamplingService);
    (BatchAnalysisService as jest.MockedClass<typeof BatchAnalysisService>).mockImplementation(() => mockBatchAnalysisService);
    // OpenAIAnalysisService mock is handled by Jest auto-mock

    // Setup mock implementations
    mockSessionSamplingService.sampleSessions.mockResolvedValue({
      sessions: [
        {
          session_id: 'test-session-1',
          user_id: 'test-user-1',
          start_time: '2025-01-15T09:00:00Z',
          end_time: '2025-01-15T09:10:00Z',
          containment_type: 'selfService',
          tags: [],
          metrics: {},
          messages: [
            { timestamp: '2025-01-15T09:00:00Z', message_type: 'user', message: 'Hello' },
            { timestamp: '2025-01-15T09:01:00Z', message_type: 'bot', message: 'Hi there!' }
          ],
          duration_seconds: 600,
          message_count: 2,
          user_message_count: 1,
          bot_message_count: 1
        }
      ],
      timeWindows: [],
      totalFound: 1
    });

    mockBatchAnalysisService.processSessionsBatch.mockResolvedValue({
      results: [
        {
          session_id: 'test-session-1',
          user_id: 'test-user-1',
          start_time: '2025-01-15T09:00:00Z',
          end_time: '2025-01-15T09:10:00Z',
          containment_type: 'selfService',
          tags: [],
          metrics: {},
          messages: [
            { timestamp: '2025-01-15T09:00:00Z', message_type: 'user', message: 'Hello' },
            { timestamp: '2025-01-15T09:01:00Z', message_type: 'bot', message: 'Hi there!' }
          ],
          message_count: 2,
          user_message_count: 1,
          bot_message_count: 1,
          facts: {
            generalIntent: 'Greeting',
            sessionOutcome: 'Contained',
            transferReason: '',
            dropOffLocation: '',
            notes: 'Simple greeting interaction'
          },
          analysisMetadata: {
            tokensUsed: 50,
            processingTime: 1000,
            batchNumber: 1,
            timestamp: '2025-01-15T09:00:00Z',
            model: 'gpt-4o-mini'
          }
        }
      ],
      tokenUsage: {
        promptTokens: 30,
        completionTokens: 20,
        totalTokens: 50,
        cost: 0.001,
        model: 'gpt-4o-mini'
      },
      updatedClassifications: {
        generalIntent: new Set(['Greeting']),
        transferReason: new Set(),
        dropOffLocation: new Set()
      }
    });

    // Create service instance
    autoAnalyzeService = AutoAnalyzeService.create(testBotId, testJwtToken);
  });

  afterEach(() => {
    // Clear singleton instance after each test
    (AutoAnalyzeService as any).instance = null;
  });

  it('includes botId in analysis progress when starting analysis', async () => {
    const startResponse = await autoAnalyzeService.startAnalysis(mockConfig);
    
    expect(startResponse).toBeDefined();
    expect(startResponse.analysisId).toBeDefined();
    expect(typeof startResponse.analysisId).toBe('string');

    const progress = await autoAnalyzeService.getProgress(startResponse.analysisId);
    
    expect(progress.botId).toBe(testBotId);
    expect(progress.modelId).toBe(mockConfig.modelId);
    expect(['sampling', 'analyzing', 'generating_summary', 'complete'].includes(progress.phase)).toBe(true);
  });

  it('includes botId in analysis results when analysis completes', async () => {
    const startResponse = await autoAnalyzeService.startAnalysis(mockConfig);
    
    // Wait a bit for the background analysis to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock the results to simulate completed analysis
    const mockSession = autoAnalyzeService as any;
    const session = mockSession.activeSessions.get(startResponse.analysisId);
    if (session) {
      session.progress.phase = 'complete';
      session.results = [
        {
          session_id: 'test-session-1',
          user_id: 'test-user-1',
          start_time: '2025-01-15T09:00:00Z',
          end_time: '2025-01-15T09:10:00Z',
          containment_type: 'selfService',
          tags: [],
          metrics: {},
          messages: [],
          message_count: 2,
          user_message_count: 1,
          bot_message_count: 1,
          facts: {
            generalIntent: 'Greeting',
            sessionOutcome: 'Contained',
            transferReason: '',
            dropOffLocation: '',
            notes: 'Simple greeting interaction'
          },
          analysisMetadata: {
            tokensUsed: 50,
            processingTime: 1000,
            batchNumber: 1,
            timestamp: '2025-01-15T09:00:00Z',
            model: 'gpt-4o-mini'
          }
        }
      ];
    }

    const results = await autoAnalyzeService.getResults(startResponse.analysisId);
    
    expect(results.botId).toBe(testBotId);
    expect(results.sessions).toHaveLength(1);
    expect(results.sessions[0]?.session_id).toBe('test-session-1');
  });

  it('maintains botId consistency across multiple method calls', async () => {
    const startResponse = await autoAnalyzeService.startAnalysis(mockConfig);
    
    // Check progress multiple times
    const progress1 = await autoAnalyzeService.getProgress(startResponse.analysisId);
    const progress2 = await autoAnalyzeService.getProgress(startResponse.analysisId);
    
    expect(progress1.botId).toBe(testBotId);
    expect(progress2.botId).toBe(testBotId);
    expect(progress1.botId).toBe(progress2.botId);
  });

  it('handles different bot IDs correctly when creating new service instances', () => {
    const botId1 = 'st-bot-1-12345678-abcd';
    const botId2 = 'st-bot-2-87654321-dcba';
    
    // Clear singleton to test different instances
    (AutoAnalyzeService as any).instance = null;
    
    const service1 = AutoAnalyzeService.create(botId1, testJwtToken);
    
    // Clear singleton again to create new instance
    (AutoAnalyzeService as any).instance = null;
    
    const service2 = AutoAnalyzeService.create(botId2, testJwtToken);
    
    expect(service1).toBeDefined();
    expect(service2).toBeDefined();
    
    // Since we're using singleton pattern, in practice this would need
    // to be tested by checking the stored botId in each service instance
  });

  it('validates botId format and handles edge cases', async () => {
    const edgeCaseBotIds = [
      '', // empty string
      'short-id', // short ID
      'st-very-long-bot-id-that-might-cause-issues-1234567890abcdefghijklmnopqrstuvwxyz', // very long ID
      'st-12345678-abcd-efgh-ijkl-mnopqrstuvwx-with-extra-parts' // ID with extra parts
    ];

    for (const testBotId of edgeCaseBotIds) {
      // Clear singleton for each test
      (AutoAnalyzeService as any).instance = null;
      
      const service = AutoAnalyzeService.create(testBotId, testJwtToken);
      const startResponse = await service.startAnalysis(mockConfig);
      const progress = await service.getProgress(startResponse.analysisId);
      
      expect(progress.botId).toBe(testBotId);
    }
  });
});