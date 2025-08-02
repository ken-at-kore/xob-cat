import request from 'supertest';
import express from 'express';
import { analysisRouter } from '../../routes/analysis';
import * as mockDataService from '../../services/mockDataService';
import { SessionWithTranscript, Message } from '../../../../shared/types';

// Import static test data
const staticSessionData = require('../../../../data/api-kore-sessions-selfservice-2025-07-23T17-05-08.json');
const staticMessageData = require('../../../../data/api-kore-messages-2025-07-23T17-05-31.json');

// Mock the mockDataService
jest.mock('../../services/mockDataService');
const mockGetSessions = mockDataService.getSessions as jest.MockedFunction<typeof mockDataService.getSessions>;

// Mock the swtService
jest.mock('../../services/swtService', () => ({
  createSWTService: jest.fn()
}));
const { createSWTService } = require('../../services/swtService');

// Mock the credentials middleware
jest.mock('../../middleware/credentials', () => ({
  loadKoreCredentials: (req: any, res: any, next: any) => {
    req.koreCredentials = {
      config: {
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        baseUrl: 'https://bots.kore.ai'
      },
      botName: 'Test Bot'
    };
    next();
  },
  getKoreCredentials: (req: any) => req.koreCredentials
}));

describe('Analysis Routes - Session History Integration Tests', () => {
  let app: express.Application;
  let mockGenerateSWTs: jest.Mock;

  // Silence console logs during tests
  const originalConsoleLog = console.log;
  beforeAll(() => {
    console.log = jest.fn();
  });
  afterAll(() => {
    console.log = originalConsoleLog;
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/analysis', analysisRouter);
    jest.clearAllMocks();

    // Mock the SWT service
    mockGenerateSWTs = jest.fn();
    createSWTService.mockReturnValue({
      generateSWTs: mockGenerateSWTs
    });
  });

  describe('GET /api/analysis/sessions', () => {
    // Use realistic static data for testing
    const realisticSessions = staticSessionData.data.slice(0, 2); // Use first 2 sessions
    
    // Add messages to sessions based on static message data
    const mockSessionsWithMessages: SessionWithTranscript[] = realisticSessions.map((session: any) => {
      const sessionMessages = staticMessageData.data
        .filter((msg: any) => msg.sessionId === session.session_id)
        .slice(0, 5) // Limit to 5 messages per session for test performance
        .map((msg: any) => ({
          timestamp: msg.timestamp,
          message_type: msg.message_type,
          message: msg.message
        }));
      
      return {
        ...session,
        messages: sessionMessages,
        message_count: sessionMessages.length,
        user_message_count: sessionMessages.filter((m: any) => m.message_type === 'user').length,
        bot_message_count: sessionMessages.filter((m: any) => m.message_type === 'bot').length
      };
    });

    it('should return sessions with conversation history', async () => {
      mockGenerateSWTs.mockResolvedValue({
        swts: mockSessionsWithMessages,
        totalSessions: 2,
        totalMessages: 10,
        sessionsWithMessages: 2,
        generationTime: 100
      });

      const response = await request(app)
        .get('/api/analysis/sessions')
        .query({
          start_date: '2025-07-07T00:00:00Z',
          end_date: '2025-07-07T23:59:59Z',
          limit: '10'
        })
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total_count', 2);

      // Verify sessions have conversation history
      const sessions = response.body.data;
      expect(sessions).toHaveLength(2);
      
      // First session should have realistic messages from static data
      expect(sessions[0]).toHaveProperty('session_id', '686bfd1580e5cfcc18780f4c');
      expect(sessions[0]).toHaveProperty('messages');
      expect(sessions[0].messages.length).toBeGreaterThan(0);
      expect(sessions[0].messages[0].message).toBe('StartFlow');
      expect(sessions[0].messages[0].message_type).toBe('user');

      // Second session should have realistic messages from static data
      expect(sessions[1]).toHaveProperty('session_id', '686bfd2b71436049267cc4f8');
      expect(sessions[1]).toHaveProperty('messages');
      expect(sessions[1].messages.length).toBeGreaterThan(0);
      expect(sessions[1].messages[0].message).toBe('StartFlow');
      expect(sessions[1].messages[0].message_type).toBe('user');
    });

    it('should handle date range filtering', async () => {
      const firstSession = mockSessionsWithMessages[0];
      if (!firstSession) throw new Error('Test data missing');
      mockGenerateSWTs.mockResolvedValue({
        swts: [firstSession],
        totalSessions: 1,
        totalMessages: 5,
        sessionsWithMessages: 1,
        generationTime: 50
      });

      const response = await request(app)
        .get('/api/analysis/sessions')
        .query({
          start_date: '2025-07-07T10:00:00Z',
          end_date: '2025-07-07T10:30:00Z',
          limit: '10'
        })
        .expect(200);

      expect(mockGenerateSWTs).toHaveBeenCalledWith({
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
        limit: 10
      });

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].session_id).toBe('686bfd1580e5cfcc18780f4c');
    });

    it('should handle containment type filtering', async () => {
      const secondSession = mockSessionsWithMessages[1];
      if (!secondSession) throw new Error('Test data missing');
      const dropOffSessions = [secondSession];
      mockGenerateSWTs.mockResolvedValue({
        swts: dropOffSessions,
        totalSessions: 1,
        totalMessages: 5,
        sessionsWithMessages: 1,
        generationTime: 50
      });

      const response = await request(app)
        .get('/api/analysis/sessions')
        .query({
          start_date: '2025-07-07T00:00:00Z',
          end_date: '2025-07-07T23:59:59Z',
          containment_type: 'dropOff',
          limit: '10'
        })
        .expect(200);

      expect(mockGenerateSWTs).toHaveBeenCalledWith({
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
        limit: 10
      });

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].containment_type).toBe('selfService');
    });

    it('should handle pagination parameters', async () => {
      const secondSession = mockSessionsWithMessages[1];
      if (!secondSession) throw new Error('Test data missing');
      mockGenerateSWTs.mockResolvedValue({
        swts: [secondSession],
        totalSessions: 1,
        totalMessages: 5,
        sessionsWithMessages: 1,
        generationTime: 50
      });

      const response = await request(app)
        .get('/api/analysis/sessions')
        .query({
          start_date: '2025-07-07T00:00:00Z',
          end_date: '2025-07-07T23:59:59Z',
          limit: '5',
          skip: '10'
        })
        .expect(200);

      expect(mockGenerateSWTs).toHaveBeenCalledWith({
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
        limit: 5
      });

      expect(response.body.meta.total_count).toBe(1);
    });

    it('should handle sessions without conversation messages', async () => {
      const firstSession = mockSessionsWithMessages[0];
      if (!firstSession) throw new Error('Test data missing');
      const sessionsWithoutMessages: SessionWithTranscript[] = [
        {
          ...firstSession,
          messages: [] // No conversation messages
        }
      ];

      mockGenerateSWTs.mockResolvedValue({
        swts: sessionsWithoutMessages,
        totalSessions: 1,
        totalMessages: 0,
        sessionsWithMessages: 0,
        generationTime: 50
      });

      const response = await request(app)
        .get('/api/analysis/sessions')
        .expect(200);

      expect(response.body.data[0]).toHaveProperty('messages');
      expect(response.body.data[0].messages).toHaveLength(0);
    });

    it('should handle optional date parameters', async () => {
      mockGenerateSWTs.mockResolvedValue({
        swts: mockSessionsWithMessages,
        totalSessions: 2,
        totalMessages: 10,
        sessionsWithMessages: 2,
        generationTime: 100
      });

      // The API currently doesn't validate required parameters
      // It returns sessions even without date filters
      const response1 = await request(app)
        .get('/api/analysis/sessions')
        .query({ end_date: '2025-07-07T23:59:59Z' })
        .expect(200);
      
      expect(response1.body.data).toBeDefined();

      const response2 = await request(app)
        .get('/api/analysis/sessions')
        .query({ start_date: '2025-07-07T00:00:00Z' })
        .expect(200);
      
      expect(response2.body.data).toBeDefined();
    });

    it('should handle service errors gracefully', async () => {
      mockGenerateSWTs.mockRejectedValue(new Error('Kore.ai API unavailable'));

      const response = await request(app)
        .get('/api/analysis/sessions')
        .query({
          start_date: '2025-07-07T00:00:00Z',
          end_date: '2025-07-07T23:59:59Z'
        })
        .expect(500);

      // Should return some kind of error response
      expect(response.status).toBe(500);
    });

    it('should apply default pagination if not provided', async () => {
      mockGenerateSWTs.mockResolvedValue({
        swts: mockSessionsWithMessages,
        totalSessions: 2,
        totalMessages: 10,
        sessionsWithMessages: 2,
        generationTime: 100
      });

      await request(app)
        .get('/api/analysis/sessions')
        .query({
          start_date: '2025-07-07T00:00:00Z',
          end_date: '2025-07-07T23:59:59Z'
        })
        .expect(200);

      expect(mockGenerateSWTs).toHaveBeenCalledWith({
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
        limit: 100
      });
    });

    it('should preserve message chronological order within sessions', async () => {
      const firstSession = mockSessionsWithMessages[0];
      if (!firstSession) throw new Error('Test data missing');
      const sessionWithOrderedMessages: SessionWithTranscript = {
        ...firstSession,
        messages: [
          {
            timestamp: '2025-07-07T10:00:00Z',
            message_type: 'user' as const,
            message: 'First message'
          },
          {
            timestamp: '2025-07-07T10:00:30Z',
            message_type: 'bot' as const,
            message: 'Second message'
          },
          {
            timestamp: '2025-07-07T10:01:00Z',
            message_type: 'user' as const,
            message: 'Third message'
          }
        ],
        message_count: 3,
        user_message_count: 2,
        bot_message_count: 1
      };

      mockGenerateSWTs.mockResolvedValue({
        swts: [sessionWithOrderedMessages],
        totalSessions: 1,
        totalMessages: 3,
        sessionsWithMessages: 1,
        generationTime: 50
      });

      const response = await request(app)
        .get('/api/analysis/sessions')
        .query({
          start_date: '2025-07-07T00:00:00Z',
          end_date: '2025-07-07T23:59:59Z'
        })
        .expect(200);

      const messages = response.body.data[0].messages;
      expect(messages).toHaveLength(3);
      expect(messages[0].message).toBe('First message');
      expect(messages[1].message).toBe('Second message');
      expect(messages[2].message).toBe('Third message');
      
      // Verify chronological order
      expect(new Date(messages[0].timestamp).getTime()).toBeLessThan(new Date(messages[1].timestamp).getTime());
      expect(new Date(messages[1].timestamp).getTime()).toBeLessThan(new Date(messages[2].timestamp).getTime());
    });
  });
});