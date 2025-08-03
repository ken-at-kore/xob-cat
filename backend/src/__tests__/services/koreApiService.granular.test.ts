/**
 * Test suite for KoreApiService granular data access methods
 * Tests the new layered architecture with metadata-first approach
 */

import { KoreApiService } from '../../services/koreApiService';
import { SessionFilters } from '../../../../shared/types';

// Mock axios for API calls
jest.mock('axios');

describe('KoreApiService - Granular Data Access', () => {
  let koreApiService: KoreApiService;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      botId: 'test-bot-id',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      baseUrl: 'https://bots.kore.ai'
    };
    
    koreApiService = new KoreApiService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSessionsMetadata', () => {
    it('should fetch session metadata without messages for performance', async () => {
      // Mock API response with session metadata only
      const mockSessionsResponse = {
        data: [
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
            },
            duration_seconds: 600
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
            },
            duration_seconds: 600
          }
        ]
      };

      // Mock the underlying API calls (we'll need to mock axios properly)
      const axios = require('axios');
      axios.post
        .mockResolvedValueOnce({ data: mockSessionsResponse }) // agent
        .mockResolvedValueOnce({ data: { data: [] } }) // selfService
        .mockResolvedValueOnce({ data: { data: [] } }); // dropOff

      const options = {
        dateFrom: '2025-08-01T00:00:00Z',
        dateTo: '2025-08-01T23:59:59Z',
        limit: 100
      };

      const result = await koreApiService.getSessionsMetadata(options);

      // Verify results (only from agent containment type)
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        sessionId: 'session_1',
        userId: 'user_1',
        containment_type: 'agent'
      });

      // Verify no messages were fetched (metadata only)
      expect(result[0]).not.toHaveProperty('messages');
      
      // Verify API was called correctly for metadata
      expect(axios.post).toHaveBeenCalledTimes(3); // agent, selfService, dropOff
    });

    it('should handle time window filtering correctly', async () => {
      const axios = require('axios');
      axios.post.mockResolvedValue({ data: { data: [] } });

      const options = {
        dateFrom: '2025-08-01T15:00:00Z',
        dateTo: '2025-08-01T18:00:00Z',
        limit: 50
      };

      await koreApiService.getSessionsMetadata(options);

      // Verify API calls include correct date parameters
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/getSessions'),
        expect.objectContaining({
          dateFrom: '2025-08-01T15:00:00Z',
          dateTo: '2025-08-01T18:00:00Z',
          limit: 50
        }),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      const axios = require('axios');
      axios.post.mockRejectedValue(new Error('API Error'));

      const options = {
        dateFrom: '2025-08-01T00:00:00Z',
        dateTo: '2025-08-01T23:59:59Z'
      };

      // The method handles errors gracefully and continues, so should return empty array
      const result = await koreApiService.getSessionsMetadata(options);
      expect(result).toEqual([]);
    });
  });

  describe('getMessagesForSessions', () => {
    it('should fetch messages only for specified session IDs', async () => {
      const mockMessagesResponse = {
        data: {
          messages: [
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
              sessionId: 'session_1',
              createdBy: 'bot',
              createdOn: '2025-08-01T15:01:00Z',
              type: 'outgoing',
              timestampValue: 1725193260000,
              components: [{
                cT: 'text',
                data: { text: 'Hi there!' }
              }]
            }
          ],
          moreAvailable: false
        }
      };

      const axios = require('axios');
      axios.post.mockResolvedValue({ data: mockMessagesResponse });

      const sessionIds = ['session_1', 'session_2'];
      const dateRange = {
        dateFrom: '2025-08-01T14:00:00Z',
        dateTo: '2025-08-01T16:00:00Z'
      };

      const result = await koreApiService.getMessagesForSessions(sessionIds, dateRange);

      // Verify messages were returned
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        sessionId: 'session_1',
        type: 'incoming'
      });

      // Verify API was called with session filtering
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/getMessages'),
        expect.objectContaining({
          dateFrom: '2025-08-01T14:00:00Z',
          dateTo: '2025-08-01T16:00:00Z',
          sessionIds: ['session_1', 'session_2']
        }),
        expect.any(Object)
      );
    });

    it('should handle empty session ID list', async () => {
      const result = await koreApiService.getMessagesForSessions([]);
      expect(result).toEqual([]);
    });

    it('should use intelligent date range when not provided', async () => {
      const axios = require('axios');
      axios.post.mockResolvedValue({ data: { data: { messages: [], moreAvailable: false } } });

      const sessionIds = ['session_1'];
      await koreApiService.getMessagesForSessions(sessionIds);

      // Should use a reasonable default date range
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/getMessages'),
        expect.objectContaining({
          dateFrom: expect.any(String),
          dateTo: expect.any(String),
          sessionIds: ['session_1']
        }),
        expect.any(Object)
      );
    });
  });

  describe('getSessionsWithMessages (convenience method)', () => {
    it('should compose metadata and messages correctly', async () => {
      // This tests the convenience method that combines both operations
      const mockSessionsResponse = {
        data: [{
          sessionId: 'session_1',
          userId: 'user_1',
          start_time: '2025-08-01T15:00:00Z',
          end_time: '2025-08-01T15:10:00Z',
          containment_type: 'agent',
          tags: [],
          metrics: { total_messages: 2, user_messages: 1, bot_messages: 1 },
          duration_seconds: 600
        }]
      };

      const mockMessagesResponse = {
        data: {
          messages: [{
            sessionId: 'session_1',
            createdBy: 'user',
            createdOn: '2025-08-01T15:00:00Z',
            type: 'incoming',
            timestampValue: 1725193200000,
            components: [{ cT: 'text', data: { text: 'Hello' } }]
          }],
          moreAvailable: false
        }
      };

      const axios = require('axios');
      axios.post
        .mockResolvedValueOnce({ data: mockSessionsResponse }) // First call for sessions
        .mockResolvedValueOnce({ data: { data: [] } }) // selfService
        .mockResolvedValueOnce({ data: { data: [] } }) // dropOff
        .mockResolvedValueOnce({ data: mockMessagesResponse }); // Messages

      const options = {
        dateFrom: '2025-08-01T00:00:00Z',
        dateTo: '2025-08-01T23:59:59Z'
      };

      const result = await koreApiService.getSessionsWithMessages(options);

      // Verify complete sessions with messages
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        sessionId: 'session_1',
        userId: 'user_1'
      });
      expect(result[0]?.messages).toHaveLength(1);
      expect(result[0]?.messages?.[0]).toMatchObject({
        sessionId: 'session_1',
        type: 'incoming'
      });
    });
  });
});