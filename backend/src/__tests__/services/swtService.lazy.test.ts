/**
 * Test suite for SWTService lazy loading capabilities
 * Tests the transformation layer with selective message population
 */

import { SWTService } from '../../services/swtService';
import { KoreApiService } from '../../services/koreApiService';

// Mock the KoreApiService
jest.mock('../../services/koreApiService');

describe('SWTService - Lazy Loading', () => {
  let swtService: SWTService;
  let mockKoreApiService: jest.Mocked<KoreApiService>;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      botId: 'test-bot-id',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      baseUrl: 'https://bots.kore.ai'
    };

    mockKoreApiService = new KoreApiService(mockConfig) as jest.Mocked<KoreApiService>;
    swtService = new SWTService(mockConfig);

    // Replace the internal koreService with our mock
    (swtService as any).koreService = mockKoreApiService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSWTsFromMetadata', () => {
    it('should transform session metadata to SWT format without messages', async () => {
      const mockSessionMetadata = [
        {
          sessionId: 'session_1',
          userId: 'user_1',
          start_time: '2025-08-01T15:00:00Z',
          end_time: '2025-08-01T15:10:00Z',
          containment_type: 'agent' as const,
          tags: ['tag1'],
          metrics: {
            total_messages: 5,
            user_messages: 3,
            bot_messages: 2
          },
          duration_seconds: 600
        },
        {
          sessionId: 'session_2',
          userId: 'user_2',
          start_time: '2025-08-01T15:05:00Z',
          end_time: '2025-08-01T15:15:00Z',
          containment_type: 'selfService' as const,
          tags: [],
          metrics: {
            total_messages: 8,
            user_messages: 4,
            bot_messages: 4
          },
          duration_seconds: 600
        }
      ];

      const result = await swtService.createSWTsFromMetadata(mockSessionMetadata);

      // Verify transformation to SWT format
      expect(result).toHaveLength(2);
      
      // Check first session transformation
      expect(result[0]).toMatchObject({
        session_id: 'session_1', // Note: field name transformation
        user_id: 'user_1',
        start_time: '2025-08-01T15:00:00Z',
        end_time: '2025-08-01T15:10:00Z',
        containment_type: 'agent',
        tags: ['tag1'],
        duration_seconds: 600,
        message_count: 5,
        user_message_count: 3,
        bot_message_count: 2,
        messages: [] // Empty array - no messages populated yet
      });

      // Check second session transformation
      expect(result[1]).toMatchObject({
        session_id: 'session_2',
        user_id: 'user_2',
        containment_type: 'selfService',
        messages: [] // Empty array - no messages populated yet
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockSessionMetadata = [
        {
          sessionId: 'session_1',
          userId: 'user_1',
          start_time: '2025-08-01T15:00:00Z',
          end_time: '2025-08-01T15:10:00Z',
          containment_type: 'agent' as const,
          tags: [],
          metrics: {
            total_messages: 0,
            user_messages: 0,
            bot_messages: 0
          },
          duration_seconds: 0
          // Missing duration_seconds, user_messages, bot_messages
        }
      ];

      const result = await swtService.createSWTsFromMetadata(mockSessionMetadata);

      expect(result[0]).toMatchObject({
        session_id: 'session_1',
        duration_seconds: 0, // Should default to 0
        message_count: 0,
        user_message_count: 0, // Should default to 0
        bot_message_count: 0,
        messages: []
      });
    });
  });

  describe('populateMessages', () => {
    it('should populate messages for specified session IDs only', async () => {
      // Setup SWTs without messages
      const swtsWithoutMessages = [
        {
          session_id: 'session_1',
          user_id: 'user_1',
          start_time: '2025-08-01T15:00:00Z',
          end_time: '2025-08-01T15:10:00Z',
          containment_type: 'agent' as const,
          tags: [],
          metrics: {},
          duration_seconds: 600,
          message_count: 2,
          user_message_count: 1,
          bot_message_count: 1,
          messages: []
        },
        {
          session_id: 'session_2',
          user_id: 'user_2',
          start_time: '2025-08-01T15:05:00Z',
          end_time: '2025-08-01T15:15:00Z',
          containment_type: 'selfService' as const,
          tags: [],
          metrics: {},
          duration_seconds: 600,
          message_count: 1,
          user_message_count: 1,
          bot_message_count: 0,
          messages: []
        }
      ];

      // Mock messages response
      const mockMessages = [
        {
          sessionId: 'session_1',
          createdBy: 'user',
          createdOn: '2025-08-01T15:00:00Z',
          type: 'incoming' as const,
          timestampValue: 1725193200000,
          components: [{ cT: 'text', data: { text: 'Hello' } }]
        },
        {
          sessionId: 'session_1',
          createdBy: 'bot',
          createdOn: '2025-08-01T15:01:00Z',
          type: 'outgoing' as const,
          timestampValue: 1725193260000,
          components: [{ cT: 'text', data: { text: 'Hi there!' } }]
        }
      ];

      mockKoreApiService.getMessagesForSessions.mockResolvedValue(mockMessages);

      // Populate messages for session_1 only
      const result = await swtService.populateMessages(swtsWithoutMessages, ['session_1']);

      // Verify only session_1 has messages populated
      expect(result).toHaveLength(2);
      expect(result[0]?.messages).toHaveLength(2);
      expect(result[1]?.messages).toHaveLength(0); // session_2 should still be empty

      // Verify message transformation
      expect(result[0]?.messages?.[0]).toMatchObject({
        messageId: expect.any(String),
        message: 'Hello',
        type: 'incoming',
        createdOn: '2025-08-01T15:00:00Z'
      });

      // Verify API was called with correct session IDs
      expect(mockKoreApiService.getMessagesForSessions).toHaveBeenCalledWith(
        ['session_1'],
        expect.objectContaining({
          dateFrom: expect.any(String),
          dateTo: expect.any(String)
        })
      );
    });

    it('should populate messages for all sessions when no session IDs specified', async () => {
      const swtsWithoutMessages = [
        {
          session_id: 'session_1',
          user_id: 'user_1',
          start_time: '2025-08-01T15:00:00Z',
          end_time: '2025-08-01T15:10:00Z',
          containment_type: 'agent' as const,
          tags: [],
          metrics: {},
          duration_seconds: 600,
          message_count: 1,
          user_message_count: 1,
          bot_message_count: 0,
          messages: []
        }
      ];

      const mockMessages = [
        {
          sessionId: 'session_1',
          createdBy: 'user',
          createdOn: '2025-08-01T15:00:00Z',
          type: 'incoming' as const,
          timestampValue: 1725193200000,
          components: [{ cT: 'text', data: { text: 'Hello' } }]
        }
      ];

      mockKoreApiService.getMessagesForSessions.mockResolvedValue(mockMessages);

      // Don't specify session IDs - should populate all
      const result = await swtService.populateMessages(swtsWithoutMessages);

      expect(result[0]?.messages).toHaveLength(1);
      expect(mockKoreApiService.getMessagesForSessions).toHaveBeenCalledWith(
        ['session_1'], // All session IDs
        expect.any(Object)
      );
    });

    it('should handle missing messages gracefully', async () => {
      const swtsWithoutMessages = [
        {
          session_id: 'session_1',
          user_id: 'user_1',
          start_time: '2025-08-01T15:00:00Z',
          end_time: '2025-08-01T15:10:00Z',
          containment_type: 'agent' as const,
          tags: [],
          metrics: {},
          duration_seconds: 600,
          message_count: 0,
          user_message_count: 0,
          bot_message_count: 0,
          messages: []
        }
      ];

      mockKoreApiService.getMessagesForSessions.mockResolvedValue([]);

      const result = await swtService.populateMessages(swtsWithoutMessages, ['session_1']);

      expect(result[0]?.messages).toHaveLength(0);
    });
  });

  describe('generateSWTs (convenience method)', () => {
    it('should compose metadata creation and message population', async () => {
      const mockOptions = {
        dateFrom: '2025-08-01T00:00:00Z',
        dateTo: '2025-08-01T23:59:59Z',
        limit: 100
      };

      // Mock metadata response
      const mockSessionMetadata = [
        {
          sessionId: 'session_1',
          userId: 'user_1',
          start_time: '2025-08-01T15:00:00Z',
          end_time: '2025-08-01T15:10:00Z',
          containment_type: 'agent' as const,
          tags: [],
          metrics: { total_messages: 1, user_messages: 1, bot_messages: 0 },
          duration_seconds: 600
        }
      ];

      // Mock messages response
      const mockMessages = [
        {
          sessionId: 'session_1',
          createdBy: 'user',
          createdOn: '2025-08-01T15:00:00Z',
          type: 'incoming' as const,
          timestampValue: 1725193200000,
          components: [{ cT: 'text', data: { text: 'Hello' } }]
        }
      ];

      mockKoreApiService.getSessionsMetadata.mockResolvedValue(mockSessionMetadata);
      mockKoreApiService.getMessagesForSessions.mockResolvedValue(mockMessages);

      const result = await swtService.generateSWTs(mockOptions);

      // Verify complete SWTs with messages
      expect(result.swts).toHaveLength(1);
      expect(result.swts[0]).toMatchObject({
        session_id: 'session_1',
        user_id: 'user_1'
      });
      expect(result.swts[0]?.messages).toHaveLength(1);

      // Verify both API calls were made
      expect(mockKoreApiService.getSessionsMetadata).toHaveBeenCalledWith(mockOptions);
      expect(mockKoreApiService.getMessagesForSessions).toHaveBeenCalledWith(
        ['session_1'],
        expect.any(Object)
      );
    });
  });
});