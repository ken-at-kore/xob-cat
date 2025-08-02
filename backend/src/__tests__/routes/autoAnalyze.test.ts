import request from 'supertest';
import express from 'express';
import { autoAnalyzeRouter } from '../../routes/autoAnalyze';
import { AutoAnalyzeService } from '../../services/autoAnalyzeService';
import { AnalysisConfig, AnalysisProgress, SessionWithFacts } from '../../../../shared/types';

// Mock the AutoAnalyzeService
jest.mock('../../services/autoAnalyzeService');

describe('Auto-Analyze API Routes', () => {
  let app: express.Application;
  let mockAutoAnalyzeService: jest.Mocked<AutoAnalyzeService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    mockAutoAnalyzeService = {
      startAnalysis: jest.fn(),
      getProgress: jest.fn(),
      getResults: jest.fn(),
      cancelAnalysis: jest.fn()
    } as any;

    (AutoAnalyzeService as jest.MockedClass<typeof AutoAnalyzeService>).mockImplementation(() => mockAutoAnalyzeService);
    
    // Mock the static create method
    (AutoAnalyzeService.create as jest.Mock) = jest.fn().mockReturnValue(mockAutoAnalyzeService);

    app.use('/api/analysis/auto-analyze', autoAnalyzeRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /start', () => {
    const validConfig: AnalysisConfig = {
      startDate: '2024-01-15',
      startTime: '09:00',
      sessionCount: 100,
      openaiApiKey: 'sk-test-key-1234567890abcdef',
      modelId: 'gpt-4o-mini'
    };

    it('should start analysis with valid configuration', async () => {
      const mockResult = {
        analysisId: 'analysis-123',
        backgroundJobId: 'job-123',
        status: 'started' as const,
        message: 'Analysis started in background'
      };
      mockAutoAnalyzeService.startAnalysis.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(validConfig)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });

      expect(mockAutoAnalyzeService.startAnalysis).toHaveBeenCalledWith(validConfig);
    });

    it('should validate session count range (5-1000)', async () => {
      const invalidConfig = { ...validConfig, sessionCount: 3 };

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('sessionCount must be between 5 and 1000');
    });

    it('should validate OpenAI API key format', async () => {
      const invalidConfig = { ...validConfig, openaiApiKey: 'invalid-key' };

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid OpenAI API key format');
    });

    it('should validate date format', async () => {
      const invalidConfig = { ...validConfig, startDate: 'invalid-date' };

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid date format');
    });

    it('should validate time format', async () => {
      const invalidConfig = { ...validConfig, startTime: '25:00' };

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid time format');
    });

    it('should handle service errors gracefully', async () => {
      mockAutoAnalyzeService.startAnalysis.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(validConfig)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Service unavailable');
    });

    it('should require all fields', async () => {
      const incompleteConfig = {
        startDate: '2024-01-15',
        sessionCount: 100
        // Missing startTime and openaiApiKey
      };

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(incompleteConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });
  });

  describe('GET /progress/:analysisId', () => {
    const mockAnalysisId = 'analysis-123';

    it('should return progress for valid analysis ID', async () => {
      const mockProgress: AnalysisProgress = {
        analysisId: mockAnalysisId,
        phase: 'analyzing',
        currentStep: 'Processing batch 2 of 5',
        sessionsFound: 100,
        sessionsProcessed: 40,
        totalSessions: 100,
        batchesCompleted: 2,
        totalBatches: 5,
        tokensUsed: 15000,
        estimatedCost: 0.45,
        eta: 180,
        startTime: '2024-01-15T14:00:00Z'
      };

      mockAutoAnalyzeService.getProgress.mockResolvedValue(mockProgress);

      const response = await request(app)
        .get(`/api/analysis/auto-analyze/progress/${mockAnalysisId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockProgress
      });

      expect(mockAutoAnalyzeService.getProgress).toHaveBeenCalledWith(mockAnalysisId);
    });

    it('should handle non-existent analysis ID', async () => {
      mockAutoAnalyzeService.getProgress.mockRejectedValue(new Error('Analysis not found'));

      const response = await request(app)
        .get('/api/analysis/auto-analyze/progress/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Analysis not found');
    });

    it('should validate analysis ID format', async () => {
      const response = await request(app)
        .get('/api/analysis/auto-analyze/progress/')
        .expect(404); // Express will return 404 for missing param
    });
  });

  describe('GET /results/:analysisId', () => {
    const mockAnalysisId = 'analysis-123';

    it('should return results for completed analysis', async () => {
      const mockResults: SessionWithFacts[] = [
        {
          session_id: 'session-1',
          user_id: 'user-1',
          start_time: '2024-01-15T09:00:00Z',
          end_time: '2024-01-15T09:30:00Z',
          containment_type: 'selfService',
          tags: [],
          metrics: {},
          messages: [
            { timestamp: '2024-01-15T09:00:00Z', message_type: 'user', message: 'Hello' },
            { timestamp: '2024-01-15T09:01:00Z', message_type: 'bot', message: 'Hi there!' }
          ],
          message_count: 2,
          user_message_count: 1,
          bot_message_count: 1,
          facts: {
            generalIntent: 'Greeting',
            sessionOutcome: 'Contained',
            transferReason: '',
            dropOffLocation: '',
            notes: 'Simple greeting exchange.'
          },
          analysisMetadata: {
            tokensUsed: 150,
            processingTime: 2500,
            batchNumber: 1,
            timestamp: '2024-01-15T14:05:00Z'
          }
        }
      ];

      mockAutoAnalyzeService.getResults.mockResolvedValue({ sessions: mockResults });

      const response = await request(app)
        .get(`/api/analysis/auto-analyze/results/${mockAnalysisId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { sessions: mockResults }
      });

      expect(mockAutoAnalyzeService.getResults).toHaveBeenCalledWith(mockAnalysisId);
    });

    it('should handle analysis not ready', async () => {
      mockAutoAnalyzeService.getResults.mockRejectedValue(new Error('Analysis not complete'));

      const response = await request(app)
        .get(`/api/analysis/auto-analyze/results/${mockAnalysisId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Analysis not complete');
    });

    it('should handle non-existent analysis', async () => {
      mockAutoAnalyzeService.getResults.mockRejectedValue(new Error('Analysis not found'));

      const response = await request(app)
        .get('/api/analysis/auto-analyze/results/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Analysis not found');
    });
  });

  describe('DELETE /:analysisId', () => {
    const mockAnalysisId = 'analysis-123';

    it('should cancel running analysis', async () => {
      mockAutoAnalyzeService.cancelAnalysis.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/analysis/auto-analyze/${mockAnalysisId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { cancelled: true }
      });

      expect(mockAutoAnalyzeService.cancelAnalysis).toHaveBeenCalledWith(mockAnalysisId);
    });

    it('should handle already completed analysis', async () => {
      mockAutoAnalyzeService.cancelAnalysis.mockResolvedValue(false);

      const response = await request(app)
        .delete(`/api/analysis/auto-analyze/${mockAnalysisId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { cancelled: false }
      });
    });

    it('should handle non-existent analysis', async () => {
      mockAutoAnalyzeService.cancelAnalysis.mockRejectedValue(new Error('Analysis not found'));

      const response = await request(app)
        .delete('/api/analysis/auto-analyze/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Analysis not found');
    });
  });

  describe('Error handling middleware', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockAutoAnalyzeService.startAnalysis.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const validConfig: AnalysisConfig = {
        startDate: '2024-01-15',
        startTime: '09:00',
        sessionCount: 100,
        openaiApiKey: 'sk-test-key-1234567890abcdef',
        modelId: 'gpt-4o-mini'
      };

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(validConfig)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should not expose sensitive information in errors', async () => {
      const configWithApiKey: AnalysisConfig = {
        startDate: '2024-01-15',
        startTime: '09:00',
        sessionCount: 100,
        openaiApiKey: 'sk-secret-key-abcdef123456',
        modelId: 'gpt-4o-mini'
      };

      mockAutoAnalyzeService.startAnalysis.mockRejectedValue(
        new Error('OpenAI API key sk-secret-key-abcdef123456 is invalid')
      );

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(configWithApiKey)
        .expect(500);

      // Should not expose the API key
      expect(response.body.error).not.toContain('sk-secret-key-abcdef123456');
    });
  });

  describe('Input sanitization', () => {
    it('should sanitize XSS attempts in error messages', async () => {
      const maliciousConfig = {
        startDate: '<script>alert("xss")</script>',
        startTime: '09:00',
        sessionCount: 100,
        openaiApiKey: 'sk-test-key'
      };

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(maliciousConfig)
        .expect(400);

      expect(response.body.error).not.toContain('<script>');
    });

    it('should handle SQL injection attempts safely', async () => {
      const maliciousConfig = {
        startDate: "'; DROP TABLE sessions; --",
        startTime: '09:00',
        sessionCount: 100,
        openaiApiKey: 'sk-test-key'
      };

      const response = await request(app)
        .post('/api/analysis/auto-analyze/start')
        .send(maliciousConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});