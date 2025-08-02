import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { koreRouter } from '../../routes/kore';

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

describe('Kore Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/api/kore', koreRouter);
  });

  describe('GET /api/kore/test', () => {
    it('should return error when no credentials are available', async () => {
      const { configManager } = require('../../utils/configManager');
      configManager.getKoreConfig.mockImplementation(() => {
        throw new Error('No config found');
      });

      const response = await request(app)
        .get('/api/kore/test')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing Kore.ai credentials',
        message: expect.stringContaining('Please provide credentials via headers')
      });
    });

    it('should return success when credentials are available', async () => {
      const { configManager } = require('../../utils/configManager');
      const { createKoreApiService } = require('../../services/koreApiService');
      
      const mockKoreConfig = {
        bot_id: 'test-bot-id',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        base_url: 'https://bots.kore.ai',
        name: 'Test Bot'
      };

      const mockKoreService = {
        getSessions: jest.fn()
      } as any;
      
      mockKoreService.getSessions.mockResolvedValue([
        {
          session_id: 'test-session-1',
          user_id: 'test-user-1',
          start_time: '2025-01-01T00:00:00Z',
          end_time: '2025-01-01T00:01:00Z',
          containment_type: 'agent',
          tags: { userTags: [], sessionTags: [] },
          messages: []
        }
      ]);

      configManager.getKoreConfig.mockReturnValue(mockKoreConfig);
      createKoreApiService.mockReturnValue(mockKoreService);

      const response = await request(app)
        .get('/api/kore/test')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: expect.stringContaining('Test Bot'),
        data: {
          bot_name: 'Test Bot',
          sessions_count: 1,
          sample_session: expect.any(Object),
          date_range: expect.any(Object)
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /api/kore/sessions', () => {
    it('should return error when no credentials are available', async () => {
      const { configManager } = require('../../utils/configManager');
      configManager.getKoreConfig.mockImplementation(() => {
        throw new Error('No config found');
      });

      const response = await request(app)
        .get('/api/kore/sessions')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing Kore.ai credentials',
        message: expect.stringContaining('Please provide credentials via headers')
      });
    });

    it('should return sessions when credentials are available', async () => {
      const { configManager } = require('../../utils/configManager');
      const { createKoreApiService } = require('../../services/koreApiService');
      
      const mockKoreConfig = {
        bot_id: 'test-bot-id',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        base_url: 'https://bots.kore.ai',
        name: 'Test Bot'
      };

      const mockSessions = [
        {
          session_id: 'test-session-1',
          user_id: 'test-user-1',
          start_time: '2025-01-01T00:00:00Z',
          end_time: '2025-01-01T00:01:00Z',
          containment_type: 'agent',
          tags: { userTags: [], sessionTags: [] },
          messages: []
        }
      ];

      const mockKoreService = {
        getSessions: jest.fn()
      } as any;
      
      mockKoreService.getSessions.mockResolvedValue(mockSessions);

      configManager.getKoreConfig.mockReturnValue(mockKoreConfig);
      createKoreApiService.mockReturnValue(mockKoreService);

      const response = await request(app)
        .get('/api/kore/sessions')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: expect.any(String),
        data: mockSessions,
        meta: {
          total_count: 1,
          has_more: false,
          date_range: expect.any(Object),
          bot_name: 'Test Bot'
        },
        timestamp: expect.any(String)
      });
    });
  });
}); 