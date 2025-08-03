import { SessionSamplingService } from '../../services/sessionSamplingService';
import { SWTService } from '../../services/swtService';
import { KoreApiService, KoreSession, KoreMessage } from '../../services/koreApiService';
import { SessionWithTranscript } from '../../models/swtModels';
import { TimeWindow } from '../../../../shared/types';

// Mock the services
jest.mock('../../services/swtService');
jest.mock('../../services/koreApiService');

describe('SessionSamplingService', () => {
  let sessionSamplingService: SessionSamplingService;
  let mockSWTService: jest.Mocked<SWTService>;
  let mockKoreApiService: jest.Mocked<KoreApiService>;

  beforeEach(() => {
    const mockConfig = {
      botId: 'mock-bot-id',
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret',
      baseUrl: 'https://bots.kore.ai'
    };
    mockSWTService = new SWTService(mockConfig) as jest.Mocked<SWTService>;
    mockKoreApiService = new KoreApiService(mockConfig) as jest.Mocked<KoreApiService>;
    
    // Set default mock to return empty SWT result for all calls
    mockSWTService.generateSWTs = jest.fn().mockResolvedValue({
      swts: [],
      totalSessions: 0,
      totalMessages: 0,
      sessionsWithMessages: 0,
      generationTime: 0
    });
    
    // Mock KoreApiService methods
    mockKoreApiService.getSessions = jest.fn().mockResolvedValue([]);
    mockKoreApiService.getMessages = jest.fn().mockResolvedValue([]);
    
    sessionSamplingService = new SessionSamplingService(mockSWTService, mockKoreApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('optimized session sampling', () => {
    it('should fetch sessions without messages first, then fetch messages only for sampled sessions', async () => {
      // Mock session data as returned by KoreApiService.getSessions (KoreSession format)
      const mockSessions: KoreSession[] = [
        {
          sessionId: 'session_1',
          userId: 'user_1',
          start_time: '2025-08-01T15:00:00Z',
          end_time: '2025-08-01T15:10:00Z',
          containment_type: 'agent',
          tags: [],
          metrics: {
            total_messages: 5,
            user_messages: 3,
            bot_messages: 2
          }
        },
        {
          sessionId: 'session_2',
          userId: 'user_2',
          start_time: '2025-08-01T15:05:00Z',
          end_time: '2025-08-01T15:15:00Z',
          containment_type: 'selfService',
          tags: [],
          metrics: {
            total_messages: 8,
            user_messages: 4,
            bot_messages: 4
          }
        }
      ];

      // Mock messages for sampled sessions (KoreMessage format)
      const mockMessages: KoreMessage[] = [
        {
          sessionId: 'session_1',
          createdBy: 'user',
          createdOn: '2025-08-01T15:00:00Z',
          type: 'incoming',
          timestampValue: 1725193200000,
          components: [{
            cT: 'text',
            data: { text: 'Hello' }
          }]
        },
        {
          sessionId: 'session_2',
          createdBy: 'user',
          createdOn: '2025-08-01T15:05:00Z',
          type: 'incoming',
          timestampValue: 1725193500000,
          components: [{
            cT: 'text',
            data: { text: 'Hi there' }
          }]
        }
      ];

      // Mock KoreApiService to return sessions without messages
      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      mockKoreApiService.getMessages.mockResolvedValue(mockMessages);

      const config = {
        startDate: '2025-08-01',
        startTime: '15:00',
        sessionCount: 2,
        openaiApiKey: 'test-key',
        modelId: 'gpt-4o-mini'
      };

      const result = await sessionSamplingService.sampleSessions(config);

      // Verify that getSessions was called (to get session metadata without messages)
      expect(mockKoreApiService.getSessions).toHaveBeenCalled();
      
      // Verify that getMessages was called (to get messages for sampled sessions only)
      expect(mockKoreApiService.getMessages).toHaveBeenCalled();
      
      // Verify that we got sessions with messages in the result
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0]?.messages).toBeDefined();
      expect(result.totalFound).toBe(2);
    });

    it('should handle insufficient sessions error', async () => {
      // Mock empty sessions to trigger insufficient sessions error
      mockKoreApiService.getSessions.mockResolvedValue([]);

      const config = {
        startDate: '2025-08-01',
        startTime: '15:00',
        sessionCount: 100, // Request more than available
        openaiApiKey: 'test-key',
        modelId: 'gpt-4o-mini'
      };

      await expect(sessionSamplingService.sampleSessions(config))
        .rejects
        .toThrow('Insufficient sessions found');
    });
  });

  describe('sampleSessions', () => {
    const mockConfig = {
      startDate: '2024-01-15',
      startTime: '09:00',
      sessionCount: 50,
      openaiApiKey: 'sk-test-key',
      modelId: 'gpt-4o-mini'
    };

    it('should successfully sample sessions from initial 3-hour window', async () => {
      const mockSessions: SessionWithTranscript[] = Array.from({ length: 50 }, (_, i) => ({
        session_id: `session-${i}`,
        user_id: `user-${i}`,
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T14:00:00Z', message_type: 'user', message: 'Hello' },
          { timestamp: '2024-01-15T14:01:00Z', message_type: 'bot', message: 'Hi there!' }
        ],
        duration_seconds: 1800,
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      }));

      // Override the default empty mock for this test
      mockSWTService.generateSWTs.mockResolvedValue({
        swts: mockSessions,
        totalSessions: mockSessions.length,
        totalMessages: mockSessions.length * 2,
        sessionsWithMessages: mockSessions.length,
        generationTime: 100
      });

      const result = await sessionSamplingService.sampleSessions(mockConfig);

      expect(result.sessions).toHaveLength(50);
      expect(result.timeWindows).toHaveLength(1);
      expect(result.timeWindows[0]?.label).toBe('Initial 3-hour window');
      expect(mockSWTService.generateSWTs).toHaveBeenCalledTimes(1);
    });

    it('should expand time window when insufficient sessions found', async () => {
      // First call returns 20 sessions (insufficient)
      const mockSessions1: SessionWithTranscript[] = Array.from({ length: 20 }, (_, i) => ({
        session_id: `session-${i}`,
        user_id: `user-${i}`,
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T14:00:00Z', message_type: 'user', message: 'Hello' },
          { timestamp: '2024-01-15T14:01:00Z', message_type: 'bot', message: 'Hi there!' }
        ],
        duration_seconds: 1800,
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      }));

      // Second call returns additional 35 sessions (total 55, sufficient)
      const mockSessions2: SessionWithTranscript[] = Array.from({ length: 35 }, (_, i) => ({
        session_id: `session-${i + 20}`,
        user_id: `user-${i + 20}`,
        start_time: '2024-01-15T16:00:00Z', // 11:00 ET = 16:00 UTC (EST)
        end_time: '2024-01-15T16:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T16:00:00Z', message_type: 'user', message: 'Hello' },
          { timestamp: '2024-01-15T16:01:00Z', message_type: 'bot', message: 'Hi there!' }
        ],
        duration_seconds: 1800,
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      }));

      mockSWTService.generateSWTs
        .mockResolvedValueOnce({
          swts: mockSessions1,
          totalSessions: mockSessions1.length,
          totalMessages: mockSessions1.length * 2,
          sessionsWithMessages: mockSessions1.length,
          generationTime: 100
        })
        .mockResolvedValueOnce({
          swts: mockSessions2,
          totalSessions: mockSessions2.length,
          totalMessages: mockSessions2.length * 2,
          sessionsWithMessages: mockSessions2.length,
          generationTime: 100
        });

      const result = await sessionSamplingService.sampleSessions(mockConfig);

      expect(result.sessions).toHaveLength(50); // Random sample of 50 from 55
      expect(result.timeWindows).toHaveLength(2);
      expect(result.timeWindows[0]?.label).toBe('Initial 3-hour window');
      expect(result.timeWindows[1]?.label).toBe('Extended to 6 hours');
      expect(mockSWTService.generateSWTs).toHaveBeenCalledTimes(2);
    });

    it('should throw error when fewer than 10 sessions found after all expansions', async () => {
      const mockSessions: SessionWithTranscript[] = Array.from({ length: 5 }, (_, i) => ({
        session_id: `session-${i}`,
        user_id: `user-${i}`,
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T14:00:00Z', message_type: 'user', message: 'Hello' }
        ],
        duration_seconds: 900,
        message_count: 1,
        user_message_count: 1,
        bot_message_count: 0
      }));

      // Mock all calls to return insufficient sessions
      mockSWTService.generateSWTs.mockResolvedValue({
        swts: mockSessions,
        totalSessions: mockSessions.length,
        totalMessages: mockSessions.length,
        sessionsWithMessages: mockSessions.length,
        generationTime: 100
      });

      await expect(sessionSamplingService.sampleSessions(mockConfig))
        .rejects.toThrow('Insufficient sessions found');
    });

    it('should filter out sessions with minimal content', async () => {
      const mockSessions: SessionWithTranscript[] = [
        // Valid session
        {
          session_id: 'session-1',
          user_id: 'user-1',
          start_time: '2024-01-15T09:00:00Z',
          end_time: '2024-01-15T09:30:00Z',
          containment_type: 'selfService',
          tags: [],
          metrics: {},
          messages: [
            { timestamp: '2024-01-15T14:00:00Z', message_type: 'user', message: 'Hello' },
            { timestamp: '2024-01-15T09:01:00Z', message_type: 'bot', message: 'Hi there!' }
          ],
          duration_seconds: 1800,
          message_count: 2,
          user_message_count: 1,
          bot_message_count: 1
        },
        // Invalid session (only 1 message)
        {
          session_id: 'session-2',
          user_id: 'user-2',
          start_time: '2024-01-15T09:00:00Z',
          end_time: '2024-01-15T09:30:00Z',
          containment_type: 'selfService',
          tags: [],
          metrics: {},
          messages: [
            { timestamp: '2024-01-15T14:00:00Z', message_type: 'user', message: 'Hello' }
          ],
          duration_seconds: 900,
          message_count: 1,
          user_message_count: 1,
          bot_message_count: 0
        }
      ];

      // Mock with sessions that have different message counts to test filtering
      const validSession: SessionWithTranscript = {
        session_id: 'session-1',
        user_id: 'user-1',
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T14:00:00Z', message_type: 'user', message: 'Hello' },
          { timestamp: '2024-01-15T14:01:00Z', message_type: 'bot', message: 'Hi there!' }
        ],
        duration_seconds: 1800,
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      };

      const invalidSession: SessionWithTranscript = {
        session_id: 'session-2',
        user_id: 'user-2',
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T14:00:00Z', message_type: 'user', message: 'Hello' }
        ],
        duration_seconds: 900,
        message_count: 1,
        user_message_count: 1,
        bot_message_count: 0
      };

      // Return both sessions - the service should filter out the invalid one
      mockSWTService.generateSWTs.mockResolvedValue({
        swts: [validSession, invalidSession],
        totalSessions: 2,
        totalMessages: 3,
        sessionsWithMessages: 2,
        generationTime: 100
      });

      // Should try all time windows but ultimately fail with insufficient sessions
      await expect(sessionSamplingService.sampleSessions({
        ...mockConfig,
        sessionCount: 10
      })).rejects.toThrow('Insufficient sessions found');

      // Should have called API multiple times (all time windows) due to insufficient sessions after filtering
      expect(mockSWTService.generateSWTs).toHaveBeenCalledTimes(4); // All time windows
    });

    it('should deduplicate sessions across time windows', async () => {
      const duplicateSession: SessionWithTranscript = {
        session_id: 'session-duplicate',
        user_id: 'user-duplicate',
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T14:00:00Z', message_type: 'user', message: 'Hello' },
          { timestamp: '2024-01-15T14:01:00Z', message_type: 'bot', message: 'Hi there!' }
        ],
        duration_seconds: 1800,
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      };

      // Both calls return the same session (simulating overlap)
      mockSWTService.generateSWTs.mockResolvedValue({
        swts: [duplicateSession],
        totalSessions: 1,
        totalMessages: 2,
        sessionsWithMessages: 1,
        generationTime: 100
      });

      // Should try all time windows but ultimately fail with insufficient sessions (only 1 unique session)
      await expect(sessionSamplingService.sampleSessions({
        ...mockConfig,
        sessionCount: 10
      })).rejects.toThrow('Insufficient sessions found');

      // Should have called API multiple times (all time windows) due to insufficient unique sessions
      expect(mockSWTService.generateSWTs).toHaveBeenCalledTimes(4); // All time windows
    });
  });

  describe('generateTimeWindows', () => {
    it('should generate correct time windows for expansion strategy', () => {
      const startDate = '2024-01-15';
      const startTime = '09:00';
      
      const windows = sessionSamplingService.generateTimeWindows(startDate, startTime);

      expect(windows).toHaveLength(4);
      
      // Check first window (3 hours)
      expect(windows[0]?.duration).toBe(3);
      expect(windows[0]?.label).toBe('Initial 3-hour window');
      
      // Check last window (6 days = 144 hours)
      expect(windows[3]?.duration).toBe(144);
      expect(windows[3]?.label).toBe('Extended to 6 days');
    });

    it('should handle ET timezone conversion correctly', () => {
      const startDate = '2024-01-15';
      const startTime = '14:30'; // 2:30 PM ET
      
      const windows = sessionSamplingService.generateTimeWindows(startDate, startTime);
      
      // Should convert to UTC properly (ET is UTC-5 in winter)
      const expectedStart = new Date('2024-01-15T19:30:00Z'); // 2:30 PM ET = 7:30 PM UTC
      expect(windows[0]?.start.getTime()).toBe(expectedStart.getTime());
    });
  });

  describe('randomSample', () => {
    it('should return all sessions when count equals array length', () => {
      const sessions: SessionWithTranscript[] = Array.from({ length: 10 }, (_, i) => ({
        session_id: `session-${i}`,
        user_id: `user-${i}`,
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [],
        duration_seconds: 0,
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0
      }));

      const result = sessionSamplingService.randomSample(sessions, 10);
      expect(result).toHaveLength(10);
    });

    it('should return requested count when fewer than total', () => {
      const sessions: SessionWithTranscript[] = Array.from({ length: 100 }, (_, i) => ({
        session_id: `session-${i}`,
        user_id: `user-${i}`,
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [],
        duration_seconds: 0,
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0
      }));

      const result = sessionSamplingService.randomSample(sessions, 25);
      expect(result).toHaveLength(25);

      // Should be a subset of original sessions
      result.forEach(session => {
        expect(sessions.find(s => s.session_id === session.session_id)).toBeDefined();
      });
    });

    it('should return all sessions when count exceeds array length', () => {
      const sessions: SessionWithTranscript[] = Array.from({ length: 5 }, (_, i) => ({
        session_id: `session-${i}`,
        user_id: `user-${i}`,
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [],
        duration_seconds: 0,
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0
      }));

      const result = sessionSamplingService.randomSample(sessions, 10);
      expect(result).toHaveLength(5);
    });
  });
});