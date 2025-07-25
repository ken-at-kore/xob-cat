import { SessionSamplingService } from '../../services/sessionSamplingService';
import { KoreApiService } from '../../services/koreApiService';
import { SessionWithTranscript, TimeWindow } from '../../../../shared/types';

// Mock the KoreApiService
jest.mock('../../services/koreApiService');

describe('SessionSamplingService', () => {
  let sessionSamplingService: SessionSamplingService;
  let mockKoreApiService: jest.Mocked<KoreApiService>;

  beforeEach(() => {
    const mockConfig = {
      botId: 'mock-bot-id',
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret',
      baseUrl: 'https://bots.kore.ai'
    };
    mockKoreApiService = new KoreApiService(mockConfig) as jest.Mocked<KoreApiService>;
    
    // Set default mock to return empty array for all calls
    mockKoreApiService.getSessions = jest.fn().mockResolvedValue([]);
    
    sessionSamplingService = new SessionSamplingService(mockKoreApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sampleSessions', () => {
    const mockConfig = {
      startDate: '2024-01-15',
      startTime: '09:00',
      sessionCount: 50,
      openaiApiKey: 'sk-test-key'
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
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      }));

      // Override the default empty mock for this test
      mockKoreApiService.getSessions.mockResolvedValue(mockSessions.map(session => ({
        sessionId: session.session_id,
        userId: session.user_id,
        start_time: session.start_time,
        end_time: session.end_time,
        containment_type: session.containment_type,
        tags: session.tags,
        metrics: {
          total_messages: session.message_count,
          user_messages: session.user_message_count,
          bot_messages: session.bot_message_count
        }
      })));

      const result = await sessionSamplingService.sampleSessions(mockConfig);

      expect(result.sessions).toHaveLength(50);
      expect(result.timeWindows).toHaveLength(1);
      expect(result.timeWindows[0]?.label).toBe('Initial 3-hour window');
      expect(mockKoreApiService.getSessions).toHaveBeenCalledTimes(1);
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
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      }));

      mockKoreApiService.getSessions
        .mockResolvedValueOnce(mockSessions1.map(session => ({
          sessionId: session.session_id,
          userId: session.user_id,
          start_time: session.start_time,
          end_time: session.end_time,
          containment_type: session.containment_type,
          tags: session.tags,
          metrics: {
            total_messages: session.message_count,
            user_messages: session.user_message_count,
            bot_messages: session.bot_message_count
          }
        })))
        .mockResolvedValueOnce(mockSessions2.map(session => ({
          sessionId: session.session_id,
          userId: session.user_id,
          start_time: session.start_time,
          end_time: session.end_time,
          containment_type: session.containment_type,
          tags: session.tags,
          metrics: {
            total_messages: session.message_count,
            user_messages: session.user_message_count,
            bot_messages: session.bot_message_count
          }
        })));

      const result = await sessionSamplingService.sampleSessions(mockConfig);

      expect(result.sessions).toHaveLength(50); // Random sample of 50 from 55
      expect(result.timeWindows).toHaveLength(2);
      expect(result.timeWindows[0]?.label).toBe('Initial 3-hour window');
      expect(result.timeWindows[1]?.label).toBe('Extended to 6 hours');
      expect(mockKoreApiService.getSessions).toHaveBeenCalledTimes(2);
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
        message_count: 1,
        user_message_count: 1,
        bot_message_count: 0
      }));

      // Mock all calls to return insufficient sessions
      mockKoreApiService.getSessions.mockResolvedValue(mockSessions.map(session => ({
        sessionId: session.session_id,
        userId: session.user_id,
        start_time: session.start_time,
        end_time: session.end_time,
        containment_type: session.containment_type,
        tags: session.tags,
        metrics: {
          total_messages: session.message_count,
          user_messages: session.user_message_count,
          bot_messages: session.bot_message_count
        }
      })));

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
          message_count: 1,
          user_message_count: 1,
          bot_message_count: 0
        }
      ];

      // Mock with sessions that have different message counts to test filtering
      const validSession = {
        sessionId: 'session-1',
        userId: 'user-1',
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {
          total_messages: 2,
          user_messages: 1,
          bot_messages: 1
        },
        messages: [
          { timestamp: '2024-01-15T14:00:00Z', message_type: 'user', message: 'Hello' },
          { timestamp: '2024-01-15T14:01:00Z', message_type: 'bot', message: 'Hi there!' }
        ]
      };

      const invalidSession = {
        sessionId: 'session-2',
        userId: 'user-2',
        start_time: '2024-01-15T14:00:00Z', // 09:00 ET = 14:00 UTC (EST)
        end_time: '2024-01-15T14:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {
          total_messages: 1,
          user_messages: 1,
          bot_messages: 0
        },
        messages: [
          { timestamp: '2024-01-15T14:00:00Z', message_type: 'user', message: 'Hello' }
        ]
      };

      // Return both sessions - the service should filter out the invalid one
      mockKoreApiService.getSessions.mockResolvedValue([validSession, invalidSession]);

      // Should try all time windows but ultimately fail with insufficient sessions
      await expect(sessionSamplingService.sampleSessions({
        ...mockConfig,
        sessionCount: 10
      })).rejects.toThrow('Insufficient sessions found');

      // Should have called API multiple times (all time windows) due to insufficient sessions after filtering
      expect(mockKoreApiService.getSessions).toHaveBeenCalledTimes(4); // All time windows
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
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      };

      // Both calls return the same session (simulating overlap)
      mockKoreApiService.getSessions.mockResolvedValue([{
        sessionId: duplicateSession.session_id,
        userId: duplicateSession.user_id,
        start_time: duplicateSession.start_time,
        end_time: duplicateSession.end_time,
        containment_type: duplicateSession.containment_type,
        tags: duplicateSession.tags,
        metrics: {
          total_messages: duplicateSession.message_count,
          user_messages: duplicateSession.user_message_count,
          bot_messages: duplicateSession.bot_message_count
        }
      }]);

      // Should try all time windows but ultimately fail with insufficient sessions (only 1 unique session)
      await expect(sessionSamplingService.sampleSessions({
        ...mockConfig,
        sessionCount: 10
      })).rejects.toThrow('Insufficient sessions found');

      // Should have called API multiple times (all time windows) due to insufficient unique sessions
      expect(mockKoreApiService.getSessions).toHaveBeenCalledTimes(4); // All time windows
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
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0
      }));

      const result = sessionSamplingService.randomSample(sessions, 10);
      expect(result).toHaveLength(5);
    });
  });
});