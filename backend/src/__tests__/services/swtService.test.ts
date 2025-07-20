/**
 * SWT Service Unit Tests
 * 
 * Tests for Session with Transcript (SWT) generation, message extraction,
 * filtering, and summary statistics functionality.
 */

import { SWTService, createSWTService } from '../../services/swtService';
import { SWTBuilder } from '../../models/swtModels';
import { createKoreApiService } from '../../services/koreApiService';

// Mock the KoreApiService
jest.mock('../../services/koreApiService');
const mockCreateKoreApiService = createKoreApiService as jest.MockedFunction<typeof createKoreApiService>;

describe('SWTService', () => {
  let swtService: SWTService;
  let mockKoreService: any;

  const mockConfig = {
    botId: 'test-bot-id',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    baseUrl: 'https://bots.kore.ai'
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Kore service
    mockKoreService = {
      getSessions: jest.fn(),
      getMessages: jest.fn(),
      getSessionById: jest.fn(),
      getSessionMessages: jest.fn()
    };

    mockCreateKoreApiService.mockReturnValue(mockKoreService);

    // Create SWT service
    swtService = createSWTService(mockConfig);
  });

  describe('generateSWTs', () => {
    it('should generate SWTs from sessions and messages', async () => {
      // Mock data - using the actual structure returned by KoreApiService
      const mockSessions = [
        {
          session_id: 'session-1',
          user_id: 'user-1',
          start_time: '2025-07-20T10:00:00Z',
          end_time: '2025-07-20T10:05:00Z',
          containment_type: 'selfService',
          tags: ['tag1', 'tag2'],
          metrics: { score: 0.8 },
          messages: [],
          duration_seconds: 300,
          message_count: 0,
          user_message_count: 0,
          bot_message_count: 0
        },
        {
          session_id: 'session-2',
          user_id: 'user-2',
          start_time: '2025-07-20T11:00:00Z',
          end_time: '2025-07-20T11:03:00Z',
          containment_type: 'agent',
          tags: ['tag3'],
          metrics: { score: 0.6 },
          messages: [],
          duration_seconds: 180,
          message_count: 0,
          user_message_count: 0,
          bot_message_count: 0
        }
      ];

      const mockMessages = [
        {
          sessionId: 'session-1',
          createdOn: '2025-07-20T10:01:00Z',
          type: 'incoming',
          components: [{ cT: 'text', data: { text: 'Hello, I need help' } }]
        },
        {
          sessionId: 'session-1',
          createdOn: '2025-07-20T10:02:00Z',
          type: 'outgoing',
          components: [{ cT: 'text', data: { text: 'How can I assist you?' } }]
        },
        {
          sessionId: 'session-2',
          createdOn: '2025-07-20T11:01:00Z',
          type: 'incoming',
          components: [{ cT: 'text', data: { text: 'Transfer me to agent' } }]
        }
      ];

      // Setup mocks
      mockKoreService.getSessions.mockResolvedValue(mockSessions);
      mockKoreService.getMessages.mockResolvedValue(mockMessages);

      // Execute
      const result = await swtService.generateSWTs({
        dateFrom: '2025-07-20T00:00:00Z',
        dateTo: '2025-07-20T23:59:59Z',
        limit: 100
      });

      // Assertions
      expect(result.swts).toHaveLength(2);
      expect(result.totalSessions).toBe(2);
      expect(result.totalMessages).toBe(3);
      expect(result.sessionsWithMessages).toBe(2);
      expect(result.generationTime).toBeGreaterThan(0);

      // Check first SWT
      const firstSWT = result.swts[0]!;
      expect(firstSWT.session_id).toBe('session-1');
      expect(firstSWT.user_id).toBe('user-1');
      expect(firstSWT.message_count).toBe(2);
      expect(firstSWT.user_message_count).toBe(1);
      expect(firstSWT.bot_message_count).toBe(1);
      expect(firstSWT.duration_seconds).toBe(300); // 5 minutes
      expect(firstSWT.messages).toHaveLength(2);
      expect(firstSWT.messages[0]!.message).toBe('Hello, I need help');
      expect(firstSWT.messages[0]!.message_type).toBe('user');
      expect(firstSWT.messages[1]!.message).toBe('How can I assist you?');
      expect(firstSWT.messages[1]!.message_type).toBe('bot');

      // Check second SWT
      const secondSWT = result.swts[1]!;
      expect(secondSWT.session_id).toBe('session-2');
      expect(secondSWT.message_count).toBe(1);
      expect(secondSWT.user_message_count).toBe(1);
      expect(secondSWT.bot_message_count).toBe(0);
      expect(secondSWT.duration_seconds).toBe(180); // 3 minutes
    });

    it('should handle empty sessions', async () => {
      // Setup mocks
      mockKoreService.getSessions.mockResolvedValue([]);
      mockKoreService.getMessages.mockResolvedValue([]);

      // Execute
      const result = await swtService.generateSWTs({
        dateFrom: '2025-07-20T00:00:00Z',
        dateTo: '2025-07-20T23:59:59Z'
      });

      // Assertions
      expect(result.swts).toHaveLength(0);
      expect(result.totalSessions).toBe(0);
      expect(result.totalMessages).toBe(0);
      expect(result.sessionsWithMessages).toBe(0);
    });

    it('should handle sessions without messages', async () => {
      // Mock data
      const mockSessions = [
        {
          session_id: 'session-1',
          user_id: 'user-1',
          start_time: '2025-07-20T10:00:00Z',
          end_time: '2025-07-20T10:05:00Z',
          containment_type: 'selfService',
          tags: [],
          metrics: {}
        }
      ];

      // Setup mocks
      mockKoreService.getSessions.mockResolvedValue(mockSessions);
      mockKoreService.getMessages.mockResolvedValue([]);

      // Execute
      const result = await swtService.generateSWTs({
        dateFrom: '2025-07-20T00:00:00Z',
        dateTo: '2025-07-20T23:59:59Z'
      });

      // Assertions
      expect(result.swts).toHaveLength(1);
      expect(result.totalSessions).toBe(1);
      expect(result.totalMessages).toBe(0);
      expect(result.sessionsWithMessages).toBe(0);

      const swt = result.swts[0]!;
      expect(swt.message_count).toBe(0);
      expect(swt.user_message_count).toBe(0);
      expect(swt.bot_message_count).toBe(0);
      expect(swt.messages).toHaveLength(0);
    });
  });

  describe('generateSWTForSession', () => {
    it('should generate SWT for specific session', async () => {
      // Mock data
      const mockSession = {
        session_id: 'session-1',
        user_id: 'user-1',
        start_time: '2025-07-20T10:00:00Z',
        end_time: '2025-07-20T10:05:00Z',
        containment_type: 'selfService',
        tags: ['tag1'],
        metrics: { score: 0.8 },
        messages: [],
        duration_seconds: 300,
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0
      };

      const mockMessages = [
        {
          sessionId: 'session-1',
          createdOn: '2025-07-20T10:01:00Z',
          type: 'incoming',
          components: [{ cT: 'text', data: { text: 'Hello' } }]
        },
        {
          sessionId: 'session-1',
          createdOn: '2025-07-20T10:02:00Z',
          type: 'outgoing',
          components: [{ cT: 'text', data: { text: 'Hi there!' } }]
        }
      ];

      // Setup mocks
      mockKoreService.getSessionById.mockResolvedValue(mockSession);
      mockKoreService.getSessionMessages.mockResolvedValue(mockMessages);

      // Execute
      const result = await swtService.generateSWTForSession('session-1');

      // Assertions
      expect(result).not.toBeNull();
      expect(result!.session_id).toBe('session-1');
      expect(result!.message_count).toBe(2);
      expect(result!.messages).toHaveLength(2);
    });

    it('should return null for non-existent session', async () => {
      // Setup mocks
      mockKoreService.getSessionById.mockResolvedValue(null);

      // Execute
      const result = await swtService.generateSWTForSession('non-existent');

      // Assertions
      expect(result).toBeNull();
    });
  });

  describe('generateSWTsForSessions', () => {
    it('should generate SWTs for specific session IDs', async () => {
      // Mock data
      const mockSession1 = {
        session_id: 'session-1',
        user_id: 'user-1',
        start_time: '2025-07-20T10:00:00Z',
        end_time: '2025-07-20T10:05:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {}
      };

      const mockSession2 = {
        session_id: 'session-2',
        user_id: 'user-2',
        start_time: '2025-07-20T11:00:00Z',
        end_time: '2025-07-20T11:03:00Z',
        containment_type: 'agent',
        tags: [],
        metrics: {}
      };

      const mockMessages1 = [
        {
          sessionId: 'session-1',
          createdOn: '2025-07-20T10:01:00Z',
          type: 'incoming',
          components: [{ cT: 'text', data: { text: 'Message 1' } }]
        }
      ];

      const mockMessages2 = [
        {
          sessionId: 'session-2',
          createdOn: '2025-07-20T11:01:00Z',
          type: 'incoming',
          components: [{ cT: 'text', data: { text: 'Message 2' } }]
        }
      ];

      // Setup mocks
      mockKoreService.getSessionById
        .mockResolvedValueOnce(mockSession1)
        .mockResolvedValueOnce(mockSession2);
      mockKoreService.getSessionMessages
        .mockResolvedValueOnce(mockMessages1)
        .mockResolvedValueOnce(mockMessages2);

      // Execute
      const result = await swtService.generateSWTsForSessions(['session-1', 'session-2']);

      // Assertions
      expect(result.swts).toHaveLength(2);
      expect(result.totalSessions).toBe(2);
      expect(result.totalMessages).toBe(2);
      expect(result.sessionsWithMessages).toBe(2);
    });
  });

  describe('getSWTSummary', () => {
    it('should calculate summary statistics for SWTs', () => {
      // Create test SWTs
      const swts = [
        {
          session_id: 'session-1',
          user_id: 'user-1',
          start_time: '2025-07-20T10:00:00Z',
          end_time: '2025-07-20T10:05:00Z',
          containment_type: 'selfService' as const,
          tags: [],
          metrics: {},
          messages: [
            { timestamp: '2025-07-20T10:01:00Z', message_type: 'user' as const, message: 'Hello' },
            { timestamp: '2025-07-20T10:02:00Z', message_type: 'bot' as const, message: 'Hi there!' }
          ],
          duration_seconds: 300,
          message_count: 2,
          user_message_count: 1,
          bot_message_count: 1
        },
        {
          session_id: 'session-2',
          user_id: 'user-2',
          start_time: '2025-07-20T11:00:00Z',
          end_time: '2025-07-20T11:03:00Z',
          containment_type: 'agent' as const,
          tags: [],
          metrics: {},
          messages: [
            { timestamp: '2025-07-20T11:01:00Z', message_type: 'user' as const, message: 'Help me' }
          ],
          duration_seconds: 180,
          message_count: 1,
          user_message_count: 1,
          bot_message_count: 0
        }
      ];

      // Execute
      const summary = swtService.getSWTSummary(swts);

      // Assertions
      expect(summary.totalSessions).toBe(2);
      expect(summary.totalMessages).toBe(3);
      expect(summary.totalUserMessages).toBe(2);
      expect(summary.totalBotMessages).toBe(1);
      expect(summary.sessionsWithMessages).toBe(2);
      expect(summary.averageMessagesPerSession).toBe(1.5);
      expect(summary.averageDuration).toBe(240); // (300 + 180) / 2
      expect(summary.containmentTypeBreakdown).toEqual({
        selfService: 1,
        agent: 1
      });
      expect(summary.averageUserMessagesPerSession).toBe(1);
      expect(summary.averageBotMessagesPerSession).toBe(0.5);
    });

    it('should handle empty SWT array', () => {
      // Execute
      const summary = swtService.getSWTSummary([]);

      // Assertions
      expect(summary.totalSessions).toBe(0);
      expect(summary.totalMessages).toBe(0);
      expect(summary.totalUserMessages).toBe(0);
      expect(summary.totalBotMessages).toBe(0);
      expect(summary.sessionsWithMessages).toBe(0);
      expect(summary.averageMessagesPerSession).toBe(0);
      expect(summary.averageDuration).toBe(0);
      expect(summary.containmentTypeBreakdown).toEqual({});
    });
  });

  describe('filterSWTs', () => {
    it('should filter SWTs by containment type', () => {
      // Create test SWTs
      const swts = [
        {
          session_id: 'session-1',
          user_id: 'user-1',
          start_time: '2025-07-20T10:00:00Z',
          end_time: '2025-07-20T10:05:00Z',
          containment_type: 'selfService' as const,
          tags: [],
          metrics: {},
          messages: [],
          duration_seconds: 300,
          message_count: 0,
          user_message_count: 0,
          bot_message_count: 0
        },
        {
          session_id: 'session-2',
          user_id: 'user-2',
          start_time: '2025-07-20T11:00:00Z',
          end_time: '2025-07-20T11:03:00Z',
          containment_type: 'agent' as const,
          tags: [],
          metrics: {},
          messages: [],
          duration_seconds: 180,
          message_count: 0,
          user_message_count: 0,
          bot_message_count: 0
        }
      ];

             // Execute
       const filtered = swtService.filterSWTs(swts, { containmentType: 'selfService' });

       // Assertions
       expect(filtered).toHaveLength(1);
       expect(filtered[0]!.session_id).toBe('session-1');
    });

    it('should filter SWTs by message count', () => {
      // Create test SWTs
      const swts = [
        {
          session_id: 'session-1',
          user_id: 'user-1',
          start_time: '2025-07-20T10:00:00Z',
          end_time: '2025-07-20T10:05:00Z',
          containment_type: 'selfService' as const,
          tags: [],
          metrics: {},
          messages: [
            { timestamp: '2025-07-20T10:01:00Z', message_type: 'user' as const, message: 'Hello' }
          ],
          duration_seconds: 300,
          message_count: 1,
          user_message_count: 1,
          bot_message_count: 0
        },
        {
          session_id: 'session-2',
          user_id: 'user-2',
          start_time: '2025-07-20T11:00:00Z',
          end_time: '2025-07-20T11:03:00Z',
          containment_type: 'agent' as const,
          tags: [],
          metrics: {},
          messages: [],
          duration_seconds: 180,
          message_count: 0,
          user_message_count: 0,
          bot_message_count: 0
        }
      ];

             // Execute
       const filtered = swtService.filterSWTs(swts, { minMessages: 1 });

       // Assertions
       expect(filtered).toHaveLength(1);
       expect(filtered[0]!.session_id).toBe('session-1');
    });

    it('should filter SWTs by duration', () => {
      // Create test SWTs
      const swts = [
        {
          session_id: 'session-1',
          user_id: 'user-1',
          start_time: '2025-07-20T10:00:00Z',
          end_time: '2025-07-20T10:05:00Z',
          containment_type: 'selfService' as const,
          tags: [],
          metrics: {},
          messages: [],
          duration_seconds: 300,
          message_count: 0,
          user_message_count: 0,
          bot_message_count: 0
        },
        {
          session_id: 'session-2',
          user_id: 'user-2',
          start_time: '2025-07-20T11:00:00Z',
          end_time: '2025-07-20T11:03:00Z',
          containment_type: 'agent' as const,
          tags: [],
          metrics: {},
          messages: [],
          duration_seconds: 180,
          message_count: 0,
          user_message_count: 0,
          bot_message_count: 0
        }
      ];

             // Execute
       const filtered = swtService.filterSWTs(swts, { minDuration: 200 });

       // Assertions
       expect(filtered).toHaveLength(1);
       expect(filtered[0]!.session_id).toBe('session-1');
    });
  });
});

describe('SWTBuilder', () => {
  describe('createMessage', () => {
    it('should create message from valid message data', () => {
      const rawMessage = {
        createdOn: '2025-07-20T10:01:00Z',
        type: 'incoming',
        components: [{ cT: 'text', data: { text: 'Hello, world!' } }]
      };

      const message = SWTBuilder.createMessage(rawMessage);

      expect(message).not.toBeNull();
      expect(message!.timestamp).toBe('2025-07-20T10:01:00Z');
      expect(message!.message_type).toBe('user');
      expect(message!.message).toBe('Hello, world!');
    });

    it('should return null for message without text content', () => {
      const rawMessage = {
        createdOn: '2025-07-20T10:01:00Z',
        type: 'incoming',
        components: [{ cT: 'image', data: { url: 'image.jpg' } }]
      };

      const message = SWTBuilder.createMessage(rawMessage);

      expect(message).toBeNull();
    });

    it('should handle message without components', () => {
      const rawMessage = {
        createdOn: '2025-07-20T10:01:00Z',
        type: 'incoming',
        components: []
      };

      const message = SWTBuilder.createMessage(rawMessage);

      expect(message).toBeNull();
    });
  });

  describe('createSWT', () => {
    it('should create SWT with computed metrics', () => {
      const session = {
        sessionId: 'session-1',
        userId: 'user-1',
        start_time: '2025-07-20T10:00:00Z',
        end_time: '2025-07-20T10:05:00Z',
        containment_type: 'selfService',
        tags: ['tag1'],
        metrics: { score: 0.8 }
      };

      const messages = [
        {
          createdOn: '2025-07-20T10:01:00Z',
          type: 'incoming',
          components: [{ cT: 'text', data: { text: 'Hello' } }]
        },
        {
          createdOn: '2025-07-20T10:02:00Z',
          type: 'outgoing',
          components: [{ cT: 'text', data: { text: 'Hi there!' } }]
        }
      ];

      const swt = SWTBuilder.createSWT(session, messages);

      expect(swt.session_id).toBe('session-1');
      expect(swt.user_id).toBe('user-1');
      expect(swt.message_count).toBe(2);
      expect(swt.user_message_count).toBe(1);
      expect(swt.bot_message_count).toBe(1);
      expect(swt.duration_seconds).toBe(300);
             expect(swt.messages).toHaveLength(2);
       expect(swt.messages[0]!.message).toBe('Hello');
       expect(swt.messages[1]!.message).toBe('Hi there!');
    });

    it('should handle invalid duration timestamps', () => {
      const session = {
        sessionId: 'session-1',
        userId: 'user-1',
        start_time: 'invalid-time',
        end_time: 'also-invalid',
        containment_type: 'selfService',
        tags: [],
        metrics: {}
      };

             const messages: any[] = [];

      const swt = SWTBuilder.createSWT(session, messages);

      expect(swt.duration_seconds).toBeNull();
    });
  });

  describe('groupMessagesBySession', () => {
    it('should group messages by session ID', () => {
      const messages = [
        { sessionId: 'session-1', message: 'Hello' },
        { sessionId: 'session-1', message: 'Hi' },
        { sessionId: 'session-2', message: 'Help' },
        { sessionId: 'session-1', message: 'Bye' }
      ];

      const grouped = SWTBuilder.groupMessagesBySession(messages);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['session-1']).toHaveLength(3);
      expect(grouped['session-2']).toHaveLength(1);
    });

    it('should handle messages without session ID', () => {
      const messages = [
        { sessionId: 'session-1', message: 'Hello' },
        { message: 'No session' },
        { sessionId: 'session-2', message: 'Help' }
      ];

      const grouped = SWTBuilder.groupMessagesBySession(messages);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['session-1']).toHaveLength(1);
      expect(grouped['session-2']).toHaveLength(1);
    });
  });

  describe('getConversationSummary', () => {
    it('should generate summary for SWT with messages', () => {
      const swt = {
        session_id: 'session-1',
        user_id: 'user-1',
        start_time: '2025-07-20T10:00:00Z',
        end_time: '2025-07-20T10:05:00Z',
        containment_type: 'selfService' as const,
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2025-07-20T10:01:00Z', message_type: 'user' as const, message: 'Hello' },
          { timestamp: '2025-07-20T10:02:00Z', message_type: 'bot' as const, message: 'Hi there!' }
        ],
        duration_seconds: 300,
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1
      };

      const summary = SWTBuilder.getConversationSummary(swt);

      expect(summary).toBe('Session with 2 messages (1 user, 1 bot)');
    });

    it('should handle SWT without messages', () => {
      const swt = {
        session_id: 'session-1',
        user_id: 'user-1',
        start_time: '2025-07-20T10:00:00Z',
        end_time: '2025-07-20T10:05:00Z',
        containment_type: 'selfService' as const,
        tags: [],
        metrics: {},
        messages: [],
        duration_seconds: 300,
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0
      };

      const summary = SWTBuilder.getConversationSummary(swt);

      expect(summary).toBe('No messages in this session');
    });
  });
}); 