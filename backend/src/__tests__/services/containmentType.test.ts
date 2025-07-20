import { SWTService, createSWTService } from '../../services/swtService';
import { createKoreApiService } from '../../services/koreApiService';
import { SWTBuilder } from '../../models/swtModels';

// Mock the KoreApiService
jest.mock('../../services/koreApiService');

const mockKoreApiService = {
  getSessions: jest.fn(),
  getMessages: jest.fn(),
  getSessionById: jest.fn(),
  getSessionMessages: jest.fn()
};

(createKoreApiService as jest.Mock).mockReturnValue(mockKoreApiService);

describe('SWT Containment Type Tests', () => {
  let swtService: SWTService;
  const mockConfig = {
    botId: 'test-bot-id',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    swtService = createSWTService(mockConfig);
  });

  describe('Containment Type in Session Data', () => {
    it('should properly tag sessions with containment type from API calls', async () => {
      // Mock sessions with different containment types
      const mockSessions = [
        {
          sessionId: 'session-1',
          userId: 'user-1',
          start_time: '2025-07-07T10:00:00Z',
          end_time: '2025-07-07T10:05:00Z',
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        },
        {
          sessionId: 'session-2',
          userId: 'user-2',
          start_time: '2025-07-07T11:00:00Z',
          end_time: '2025-07-07T11:10:00Z',
          containment_type: 'agent',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        },
        {
          sessionId: 'session-3',
          userId: 'user-3',
          start_time: '2025-07-07T12:00:00Z',
          end_time: '2025-07-07T12:02:00Z',
          containment_type: 'dropOff',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        }
      ];

      const mockMessages = [
        {
          sessionId: 'session-1',
          timestamp: '2025-07-07T10:01:00Z',
          message_type: 'user',
          message: 'Hello'
        },
        {
          sessionId: 'session-2',
          timestamp: '2025-07-07T11:01:00Z',
          message_type: 'bot',
          message: 'How can I help?'
        },
        {
          sessionId: 'session-3',
          timestamp: '2025-07-07T12:01:00Z',
          message_type: 'user',
          message: 'Goodbye'
        }
      ];

      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      mockKoreApiService.getMessages.mockResolvedValue(mockMessages);

      const result = await swtService.generateSWTs({
        dateFrom: '2025-07-07T00:00:00Z',
        dateTo: '2025-07-07T23:59:59Z',
        limit: 10
      });

      expect(result.swts).toHaveLength(3);
      expect(result.swts[0]?.containment_type).toBe('selfService');
      expect(result.swts[1]?.containment_type).toBe('agent');
      expect(result.swts[2]?.containment_type).toBe('dropOff');
    });

    it('should include containment type in SWT summary statistics', async () => {
      const mockSessions = [
        {
          sessionId: 'session-1',
          userId: 'user-1',
          start_time: '2025-07-07T10:00:00Z',
          end_time: '2025-07-07T10:05:00Z',
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        },
        {
          sessionId: 'session-2',
          userId: 'user-2',
          start_time: '2025-07-07T11:00:00Z',
          end_time: '2025-07-07T11:10:00Z',
          containment_type: 'agent',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        },
        {
          sessionId: 'session-3',
          userId: 'user-3',
          start_time: '2025-07-07T12:00:00Z',
          end_time: '2025-07-07T12:02:00Z',
          containment_type: 'dropOff',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        }
      ];

      const mockMessages = [
        {
          sessionId: 'session-1',
          timestamp: '2025-07-07T10:01:00Z',
          message_type: 'user',
          message: 'Hello'
        }
      ];

      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      mockKoreApiService.getMessages.mockResolvedValue(mockMessages);

      const result = await swtService.generateSWTs({
        dateFrom: '2025-07-07T00:00:00Z',
        dateTo: '2025-07-07T23:59:59Z',
        limit: 10
      });

      const summary = swtService.getSWTSummary(result.swts);
      
      expect(summary.containmentTypeBreakdown).toEqual({
        selfService: 1,
        agent: 1,
        dropOff: 1
      });
    });

    it('should filter SWTs by containment type', async () => {
      const mockSessions = [
        {
          sessionId: 'session-1',
          userId: 'user-1',
          start_time: '2025-07-07T10:00:00Z',
          end_time: '2025-07-07T10:05:00Z',
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        },
        {
          sessionId: 'session-2',
          userId: 'user-2',
          start_time: '2025-07-07T11:00:00Z',
          end_time: '2025-07-07T11:10:00Z',
          containment_type: 'agent',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        }
      ];

      const mockMessages = [
        {
          sessionId: 'session-1',
          timestamp: '2025-07-07T10:01:00Z',
          message_type: 'user',
          message: 'Hello'
        },
        {
          sessionId: 'session-2',
          timestamp: '2025-07-07T11:01:00Z',
          message_type: 'bot',
          message: 'How can I help?'
        }
      ];

      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      mockKoreApiService.getMessages.mockResolvedValue(mockMessages);

      const result = await swtService.generateSWTs({
        dateFrom: '2025-07-07T00:00:00Z',
        dateTo: '2025-07-07T23:59:59Z',
        limit: 10
      });

      // Filter by agent containment type
      const agentSWTs = swtService.filterSWTs(result.swts, { containmentType: 'agent' });
      expect(agentSWTs).toHaveLength(1);
      expect(agentSWTs[0]?.session_id).toBe('session-2');
      expect(agentSWTs[0]?.containment_type).toBe('agent');

      // Filter by selfService containment type
      const selfServiceSWTs = swtService.filterSWTs(result.swts, { containmentType: 'selfService' });
      expect(selfServiceSWTs).toHaveLength(1);
      expect(selfServiceSWTs[0]?.session_id).toBe('session-1');
      expect(selfServiceSWTs[0]?.containment_type).toBe('selfService');
    });
  });

  describe('SWTBuilder Containment Type Handling', () => {
    it('should preserve containment type when creating SWT', () => {
      const session = {
        sessionId: 'test-session',
        userId: 'test-user',
        start_time: '2025-07-07T10:00:00Z',
        end_time: '2025-07-07T10:05:00Z',
        containment_type: 'agent' as const,
        tags: { userTags: [], sessionTags: [] },
        metrics: {}
      };

      const messages = [
        {
          timestamp: '2025-07-07T10:01:00Z',
          message_type: 'user' as const,
          message: 'Hello'
        }
      ];

      const swt = SWTBuilder.createSWT(session, messages);
      
      expect(swt.containment_type).toBe('agent');
      expect(swt.session_id).toBe('test-session');
    });

    it('should handle null containment type gracefully', () => {
      const session = {
        sessionId: 'test-session',
        userId: 'test-user',
        start_time: '2025-07-07T10:00:00Z',
        end_time: '2025-07-07T10:05:00Z',
        containment_type: null,
        tags: { userTags: [], sessionTags: [] },
        metrics: {}
      };

      const messages = [
        {
          timestamp: '2025-07-07T10:01:00Z',
          message_type: 'user' as const,
          message: 'Hello'
        }
      ];

      const swt = SWTBuilder.createSWT(session, messages);
      
      expect(swt.containment_type).toBeNull();
    });

    it('should handle undefined containment type gracefully', () => {
      const session = {
        sessionId: 'test-session',
        userId: 'test-user',
        start_time: '2025-07-07T10:00:00Z',
        end_time: '2025-07-07T10:05:00Z',
        tags: { userTags: [], sessionTags: [] },
        metrics: {}
      };

      const messages = [
        {
          timestamp: '2025-07-07T10:01:00Z',
          message_type: 'user' as const,
          message: 'Hello'
        }
      ];

      const swt = SWTBuilder.createSWT(session, messages);
      
      expect(swt.containment_type).toBeNull();
    });
  });

  describe('Containment Type Edge Cases', () => {
    it('should handle sessions with no containment type as unknown in summary', async () => {
      const mockSessions = [
        {
          sessionId: 'session-1',
          userId: 'user-1',
          start_time: '2025-07-07T10:00:00Z',
          end_time: '2025-07-07T10:05:00Z',
          containment_type: null,
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        },
        {
          sessionId: 'session-2',
          userId: 'user-2',
          start_time: '2025-07-07T11:00:00Z',
          end_time: '2025-07-07T11:10:00Z',
          containment_type: 'agent',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        }
      ];

      const mockMessages = [
        {
          sessionId: 'session-1',
          timestamp: '2025-07-07T10:01:00Z',
          message_type: 'user',
          message: 'Hello'
        },
        {
          sessionId: 'session-2',
          timestamp: '2025-07-07T11:01:00Z',
          message_type: 'bot',
          message: 'How can I help?'
        }
      ];

      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      mockKoreApiService.getMessages.mockResolvedValue(mockMessages);

      const result = await swtService.generateSWTs({
        dateFrom: '2025-07-07T00:00:00Z',
        dateTo: '2025-07-07T23:59:59Z',
        limit: 10
      });

      const summary = swtService.getSWTSummary(result.swts);
      
      expect(summary.containmentTypeBreakdown).toEqual({
        unknown: 1,
        agent: 1
      });
    });

    it('should handle all three containment types correctly', async () => {
      const mockSessions = [
        {
          sessionId: 'session-1',
          userId: 'user-1',
          start_time: '2025-07-07T10:00:00Z',
          end_time: '2025-07-07T10:05:00Z',
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        },
        {
          sessionId: 'session-2',
          userId: 'user-2',
          start_time: '2025-07-07T11:00:00Z',
          end_time: '2025-07-07T11:10:00Z',
          containment_type: 'agent',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        },
        {
          sessionId: 'session-3',
          userId: 'user-3',
          start_time: '2025-07-07T12:00:00Z',
          end_time: '2025-07-07T12:02:00Z',
          containment_type: 'dropOff',
          tags: { userTags: [], sessionTags: [] },
          metrics: {}
        }
      ];

      const mockMessages = [
        {
          sessionId: 'session-1',
          timestamp: '2025-07-07T10:01:00Z',
          message_type: 'user',
          message: 'Hello'
        },
        {
          sessionId: 'session-2',
          timestamp: '2025-07-07T11:01:00Z',
          message_type: 'bot',
          message: 'How can I help?'
        },
        {
          sessionId: 'session-3',
          timestamp: '2025-07-07T12:01:00Z',
          message_type: 'user',
          message: 'Goodbye'
        }
      ];

      mockKoreApiService.getSessions.mockResolvedValue(mockSessions);
      mockKoreApiService.getMessages.mockResolvedValue(mockMessages);

      const result = await swtService.generateSWTs({
        dateFrom: '2025-07-07T00:00:00Z',
        dateTo: '2025-07-07T23:59:59Z',
        limit: 10
      });

      const summary = swtService.getSWTSummary(result.swts);
      
      expect(summary.containmentTypeBreakdown).toEqual({
        selfService: 1,
        agent: 1,
        dropOff: 1
      });

      // Verify each SWT has the correct containment type
      const selfServiceSWT = result.swts.find(swt => swt.session_id === 'session-1');
      const agentSWT = result.swts.find(swt => swt.session_id === 'session-2');
      const dropOffSWT = result.swts.find(swt => swt.session_id === 'session-3');

      expect(selfServiceSWT?.containment_type).toBe('selfService');
      expect(agentSWT?.containment_type).toBe('agent');
      expect(dropOffSWT?.containment_type).toBe('dropOff');
    });
  });
}); 