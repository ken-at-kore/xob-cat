import { createKoreApiService } from '../../services/koreApiService';
import { getSessions } from '../../services/mockDataService';
import { configManager } from '../../utils/configManager';
import { SessionWithTranscript, Message } from '../../../../shared/types';

describe('Session History + Conversation History Integration Tests', () => {
  let mockKoreApiService: any;
  
  beforeEach(() => {
    // Mock the configManager
    jest.spyOn(configManager, 'getKoreConfig').mockReturnValue({
      name: 'Test Bot',
      bot_id: 'test-bot-id',
      client_id: 'test-client-id', 
      client_secret: 'test-client-secret',
      base_url: 'https://test.kore.ai'
    });

    // Create mock Kore API service
    mockKoreApiService = {
      getSessions: jest.fn(),
      getMessages: jest.fn()
    };

    // Mock the createKoreApiService function
    jest.doMock('../../services/koreApiService', () => ({
      createKoreApiService: jest.fn(() => mockKoreApiService)
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Complete Session with Conversation History Retrieval', () => {
    it('should retrieve sessions and populate with conversation messages', async () => {
      // Mock session data from getSessions API
      const mockSessions = [
        {
          session_id: 'session-1',
          user_id: 'user-1',
          start_time: '2025-07-07T10:00:00Z',
          end_time: '2025-07-07T10:15:00Z',
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] }
        },
        {
          session_id: 'session-2', 
          user_id: 'user-2',
          start_time: '2025-07-07T11:00:00Z',
          end_time: '2025-07-07T11:10:00Z',
          containment_type: 'dropOff',
          tags: { userTags: [], sessionTags: [] }
        }
      ];

      // Mock message data from getMessages API
      const mockMessages: Message[] = [
        {
          messageId: 'msg-1',
          type: 'incoming',
          sessionId: 'session-1',
          userId: 'user-1',
          createdOn: '2025-07-07T10:00:00Z',
          components: [{ cT: 'text', data: { text: 'Hello, I need help with my account' } }]
        },
        {
          messageId: 'msg-2',
          type: 'outgoing', 
          sessionId: 'session-1',
          createdOn: '2025-07-07T10:00:30Z',
          components: [{ cT: 'text', data: { text: 'I can help you with that. What specific issue are you having?' } }]
        },
        {
          messageId: 'msg-3',
          type: 'incoming',
          sessionId: 'session-1', 
          userId: 'user-1',
          createdOn: '2025-07-07T10:01:00Z',
          components: [{ cT: 'text', data: { text: 'I cannot access my billing information' } }]
        },
        {
          messageId: 'msg-4',
          type: 'incoming',
          sessionId: 'session-2',
          userId: 'user-2', 
          createdOn: '2025-07-07T11:00:00Z',
          components: [{ cT: 'text', data: { text: 'I want to cancel my subscription' } }]
        }
      ];

      // Setup mocks
      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      mockKoreApiService.getMessages.mockResolvedValue(mockMessages);

      // Execute the workflow
      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z',
        limit: 10,
        offset: 0
      };

      const result = await getSessions(filters);

      // Verify API calls were made correctly
      expect(mockKoreApiService.getSessions).toHaveBeenCalledWith(
        '2025-07-07T00:00:00Z',
        '2025-07-07T23:59:59Z', 
        0,
        10
      );

      expect(mockKoreApiService.getMessages).toHaveBeenCalledWith(
        '2025-07-07T00:00:00Z',
        '2025-07-07T23:59:59Z',
        ['session-1', 'session-2']
      );

      // Verify sessions have populated conversation messages
      expect(result).toHaveLength(2);
      
      // First session should have 3 messages
      const session1 = result.find((s: any) => s.session_id === 'session-1');
      expect(session1).toBeDefined();
      expect(session1!.messages).toHaveLength(3);
      expect(session1!.messages![0].message).toBe('Hello, I need help with my account');
      expect(session1!.messages![1].message).toBe('I can help you with that. What specific issue are you having?');
      expect(session1!.messages![2].message).toBe('I cannot access my billing information');

      // Second session should have 1 message
      const session2 = result.find((s: any) => s.session_id === 'session-2');
      expect(session2).toBeDefined(); 
      expect(session2!.messages).toHaveLength(1);
      expect(session2!.messages![0].message).toBe('I want to cancel my subscription');
    });

    it('should handle sessions with no conversation messages', async () => {
      const mockSessions = [
        {
          session_id: 'session-empty',
          user_id: 'user-1',
          start_time: '2025-07-07T10:00:00Z',
          end_time: '2025-07-07T10:01:00Z',
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] }
        }
      ];

      // No messages returned for this session
      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      mockKoreApiService.getMessages.mockResolvedValue([]);

      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z',
        limit: 10,
        offset: 0
      };

      const result = await getSessions(filters);

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].messages).toHaveLength(0);
    });

    it('should handle partial message retrieval failures gracefully', async () => {
      const mockSessions = [
        {
          session_id: 'session-1',
          user_id: 'user-1',
          start_time: '2025-07-07T10:00:00Z',
          end_time: '2025-07-07T10:15:00Z',
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] }
        }
      ];

      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      // Message retrieval fails
      mockKoreApiService.getMessages.mockRejectedValue(new Error('Message API unavailable'));

      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z',
        limit: 10,
        offset: 0
      };

      const result = await getSessions(filters);

      // Sessions should still be returned, but without messages
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].messages).toHaveLength(0);
    });

    it('should maintain message chronological order within each session', async () => {
      const mockSessions = [
        {
          session_id: 'session-1',
          user_id: 'user-1', 
          start_time: '2025-07-07T10:00:00Z',
          end_time: '2025-07-07T10:15:00Z',
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] }
        }
      ];

      // Messages returned in random order
      const mockMessages = [
        {
          messageId: 'msg-3',
          type: 'incoming',
          sessionId: 'session-1',
          userId: 'user-1',
          createdOn: '2025-07-07T10:02:00Z', // Latest timestamp
          components: [{ cT: 'text', data: { text: 'Third message' } }]
        },
        {
          messageId: 'msg-1', 
          type: 'incoming',
          sessionId: 'session-1',
          userId: 'user-1',
          createdOn: '2025-07-07T10:00:00Z', // Earliest timestamp
          components: [{ cT: 'text', data: { text: 'First message' } }]
        },
        {
          messageId: 'msg-2',
          type: 'outgoing',
          sessionId: 'session-1',
          createdOn: '2025-07-07T10:01:00Z', // Middle timestamp
          components: [{ cT: 'text', data: { text: 'Second message' } }]
        }
      ];

      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      mockKoreApiService.getMessages.mockResolvedValue(mockMessages);

      const filters = {
        start_date: '2025-07-07T00:00:00Z', 
        end_date: '2025-07-07T23:59:59Z',
        limit: 10,
        offset: 0
      };

      const result = await getSessions(filters);

      // Messages should be sorted chronologically
      const session = result.sessions[0];
      expect(session.messages).toHaveLength(3);
      expect(session.messages![0].components[0].data.text).toBe('First message');
      expect(session.messages![1].components[0].data.text).toBe('Second message');
      expect(session.messages![2].components[0].data.text).toBe('Third message');
      
      // Verify timestamps are in ascending order
      expect(new Date(session.messages![0].createdOn).getTime())
        .toBeLessThan(new Date(session.messages![1].createdOn).getTime());
      expect(new Date(session.messages![1].createdOn).getTime())
        .toBeLessThan(new Date(session.messages![2].createdOn).getTime());
    });

    it('should handle large datasets with pagination correctly', async () => {
      // Generate mock data for pagination scenario
      const mockSessions = Array.from({ length: 100 }, (_, i) => ({
        session_id: `session-${i + 1}`,
        user_id: `user-${i + 1}`,
        start_time: `2025-07-07T${String(10 + Math.floor(i / 10)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
        end_time: `2025-07-07T${String(10 + Math.floor(i / 10)).padStart(2, '0')}:${String((i % 60) + 5).padStart(2, '0')}:00Z`,
        containment_type: i % 3 === 0 ? 'agent' : i % 3 === 1 ? 'selfService' : 'dropOff',
        tags: { userTags: [], sessionTags: [] }
      }));

      // Generate corresponding messages
      const mockMessages = mockSessions.flatMap((session, sessionIndex) => 
        Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, msgIndex) => ({
          messageId: `msg-${sessionIndex}-${msgIndex}`,
          type: msgIndex % 2 === 0 ? 'incoming' : 'outgoing',
          sessionId: session.session_id,
          userId: session.user_id,
          createdOn: `2025-07-07T${String(10 + Math.floor(sessionIndex / 10)).padStart(2, '0')}:${String((sessionIndex % 60) + msgIndex).padStart(2, '0')}:${String(msgIndex * 10).padStart(2, '0')}Z`,
          components: [{ cT: 'text', data: { text: `Message ${msgIndex + 1} in session ${sessionIndex + 1}` } }]
        }))
      );

      mockKoreApiService.getSessions.mockResolvedValue(mockSessions.slice(20, 30)); // Return page 3
      mockKoreApiService.getMessages.mockResolvedValue(
        mockMessages.filter(msg => mockSessions.slice(20, 30).some(s => s.session_id === msg.sessionId))
      );

      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z',
        limit: 10,
        offset: 20
      };

      const result = await getSessions(filters);

      // Verify correct page returned
      expect(result.sessions).toHaveLength(10);
      expect(result.sessions[0].session_id).toBe('session-21');
      expect(result.sessions[9].session_id).toBe('session-30');

      // Verify each session has its messages
      result.sessions.forEach(session => {
        expect(session.messages).toBeDefined();
        expect(session.messages!.length).toBeGreaterThan(0);
        // Verify all messages belong to this session
        session.messages!.forEach(message => {
          expect(message.sessionId).toBe(session.session_id);
        });
      });
    });

    it('should filter messages by session ID correctly', async () => {
      const mockSessions = [
        {
          session_id: 'session-target',
          user_id: 'user-1',
          start_time: '2025-07-07T10:00:00Z',
          end_time: '2025-07-07T10:15:00Z', 
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] }
        }
      ];

      // Messages include some for other sessions (should be filtered out)
      const mockMessages = [
        {
          messageId: 'msg-target-1',
          type: 'incoming',
          sessionId: 'session-target', // Should be included
          userId: 'user-1',
          createdOn: '2025-07-07T10:00:00Z',
          components: [{ cT: 'text', data: { text: 'Target session message 1' } }]
        },
        {
          messageId: 'msg-other-1',
          type: 'incoming', 
          sessionId: 'session-other', // Should be filtered out
          userId: 'user-2',
          createdOn: '2025-07-07T10:00:00Z',
          components: [{ cT: 'text', data: { text: 'Other session message' } }]
        },
        {
          messageId: 'msg-target-2',
          type: 'outgoing',
          sessionId: 'session-target', // Should be included
          createdOn: '2025-07-07T10:01:00Z',
          components: [{ cT: 'text', data: { text: 'Target session message 2' } }]
        }
      ];

      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      mockKoreApiService.getMessages.mockResolvedValue(mockMessages);

      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z',
        limit: 10,
        offset: 0
      };

      const result = await getSessions(filters);

      expect(result.sessions).toHaveLength(1);
      const session = result.sessions[0];
      
      // Should only have messages for 'session-target', not 'session-other'
      expect(session.messages).toHaveLength(2);
      expect(session.messages![0].components[0].data.text).toBe('Target session message 1');
      expect(session.messages![1].components[0].data.text).toBe('Target session message 2');
      
      // Verify no messages from other sessions leaked in
      session.messages!.forEach(message => {
        expect(message.sessionId).toBe('session-target');
      });
    });
  });
});