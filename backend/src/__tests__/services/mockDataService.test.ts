import { jest } from '@jest/globals';
import { getSessions, generateMockSessions } from '../../services/mockDataService';

// Mock the config manager
jest.mock('../../utils/configManager', () => ({
  configManager: {
    getKoreConfig: jest.fn(),
  }
}));

// Mock the Kore API service
jest.mock('../../services/koreApiService', () => ({
  createKoreApiService: jest.fn(),
}));

describe('MockDataService', () => {
  const mockKoreConfig = {
    bot_id: 'test-bot-id',
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    base_url: 'https://bots.kore.ai',
    name: 'Test Bot'
  };

  const mockKoreService = {
    getSessions: jest.fn(),
    getSessionById: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { configManager } = require('../../utils/configManager');
    const { createKoreApiService } = require('../../services/koreApiService');
    
    configManager.getKoreConfig.mockImplementation(() => {
      throw new Error('No config found');
    });
    createKoreApiService.mockReturnValue(mockKoreService);
  });

  describe('generateMockSessions', () => {
    it('should generate mock sessions', () => {
      const filters = {
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-01-02T00:00:00Z'
      };
      const sessions = generateMockSessions(filters);

      expect(sessions).toBeInstanceOf(Array);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0]).toHaveProperty('session_id');
      expect(sessions[0]).toHaveProperty('user_id');
      expect(sessions[0]).toHaveProperty('start_time');
      expect(sessions[0]).toHaveProperty('end_time');
      expect(sessions[0]).toHaveProperty('messages');
    });

    it('should filter sessions by date range', () => {
      const filters = {
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-01-02T00:00:00Z'
      };
      
      const sessions = generateMockSessions(filters);

      expect(sessions).toBeInstanceOf(Array);
      sessions.forEach(session => {
        const startTime = new Date(session.start_time);
        const endTime = new Date(session.end_time);
        const filterStart = new Date(filters.start_date);
        const filterEnd = new Date(filters.end_date);

        expect(startTime.getTime()).toBeGreaterThanOrEqual(filterStart.getTime());
        expect(endTime.getTime()).toBeLessThanOrEqual(filterEnd.getTime());
      });
    });

    it('should filter sessions by containment type', () => {
      const filters = {
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-01-02T00:00:00Z',
        containment_type: 'agent'
      };
      
      const sessions = generateMockSessions(filters);

      expect(sessions).toBeInstanceOf(Array);
      sessions.forEach(session => {
        expect(session.containment_type).toBe('agent');
      });
    });
  });

  describe('getSessions', () => {
    it('should use mock data when no Kore API credentials available', async () => {
      const filters = {
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-01-02T00:00:00Z'
      };
      const sessions = await getSessions(filters);

      expect(sessions).toBeInstanceOf(Array);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0]).toHaveProperty('session_id');
    });

    it('should use real Kore API when credentials are available', async () => {
      const { configManager } = require('../../utils/configManager');
      const { createKoreApiService } = require('../../services/koreApiService');
      
      configManager.getKoreConfig.mockReturnValue(mockKoreConfig);
      createKoreApiService.mockReturnValue(mockKoreService);
      
      const mockRealSessions = [
        {
          session_id: 'real-session-1',
          user_id: 'real-user-1',
          start_time: '2025-01-01T00:00:00Z',
          end_time: '2025-01-01T00:01:00Z',
          containment_type: 'agent',
          tags: { userTags: [], sessionTags: [] },
          messages: []
        }
      ];
      
      (mockKoreService.getSessions as jest.Mock).mockResolvedValue(mockRealSessions);

      const filters = {
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-01-02T00:00:00Z'
      };
      const sessions = await getSessions(filters);

      expect(createKoreApiService).toHaveBeenCalledWith({
        botId: mockKoreConfig.bot_id,
        clientId: mockKoreConfig.client_id,
        clientSecret: mockKoreConfig.client_secret,
        baseUrl: mockKoreConfig.base_url
      });
      expect(mockKoreService.getSessions as jest.Mock).toHaveBeenCalled();
      expect(sessions).toEqual(mockRealSessions);
    });

    it('should fall back to mock data when Kore API fails', async () => {
      const { configManager } = require('../../utils/configManager');
      const { createKoreApiService } = require('../../services/koreApiService');
      
      configManager.getKoreConfig.mockReturnValue(mockKoreConfig);
      createKoreApiService.mockReturnValue(mockKoreService);
      (mockKoreService.getSessions as jest.Mock).mockRejectedValue(new Error('API Error'));

      const filters = {
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-01-02T00:00:00Z'
      };
      const sessions = await getSessions(filters);

      expect(sessions).toBeInstanceOf(Array);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0]).toHaveProperty('session_id');
    });
  });

  describe('Session Data Structure', () => {
    it('should generate sessions with correct data structure', () => {
      const filters = {
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-01-02T00:00:00Z'
      };
      const sessions = generateMockSessions(filters);

      sessions.forEach(session => {
        expect(session).toHaveProperty('session_id');
        expect(session).toHaveProperty('user_id');
        expect(session).toHaveProperty('start_time');
        expect(session).toHaveProperty('end_time');
        expect(session).toHaveProperty('containment_type');
        expect(session).toHaveProperty('tags');
        expect(session).toHaveProperty('messages');
        expect(session).toHaveProperty('duration_seconds');
        expect(session).toHaveProperty('metrics');

        expect(typeof session.session_id).toBe('string');
        expect(typeof session.user_id).toBe('string');
        expect(typeof session.start_time).toBe('string');
        expect(typeof session.end_time).toBe('string');
        expect(['agent', 'selfService', 'dropOff']).toContain(session.containment_type);
        expect(Array.isArray(session.messages)).toBe(true);
        expect(typeof session.duration_seconds).toBe('number');
        expect(typeof session.metrics.total_messages).toBe('number');
      });
    });

    it('should generate messages with correct structure', () => {
      const filters = {
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-01-02T00:00:00Z'
      };
      const sessions = generateMockSessions(filters);

      sessions.forEach(session => {
        if (session.messages.length > 0) {
          const message = session.messages[0];
          expect(message).toHaveProperty('timestamp');
          expect(message).toHaveProperty('message_type');
          expect(message).toHaveProperty('message');

          expect(typeof message.timestamp).toBe('string');
          expect(['user', 'bot']).toContain(message.message_type);
          expect(typeof message.message).toBe('string');
        }
      });
    });
  });
}); 