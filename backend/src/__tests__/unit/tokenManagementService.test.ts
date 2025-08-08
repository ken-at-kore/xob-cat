import { TokenManagementService } from '../../services/tokenManagementService';
import { SessionWithTranscript } from '../../../../shared/types';

describe('TokenManagementService', () => {
  let tokenService: TokenManagementService;

  beforeEach(() => {
    tokenService = new TokenManagementService();
  });

  describe('calculateMaxSessionsPerCall', () => {
    it('should calculate max sessions for GPT-4o-mini', () => {
      const maxSessions = tokenService.calculateMaxSessionsPerCall('gpt-4o-mini');
      expect(maxSessions).toBe(50); // Capped at 50 for quality
    });

    it('should calculate max sessions for GPT-4.1', () => {
      const maxSessions = tokenService.calculateMaxSessionsPerCall('gpt-4.1');
      expect(maxSessions).toBe(50); // Capped at 50 for quality
    });

    it('should return conservative default for unknown model', () => {
      const maxSessions = tokenService.calculateMaxSessionsPerCall('unknown-model');
      expect(maxSessions).toBe(5);
    });

    it('should ensure at least 1 session per call', () => {
      const maxSessions = tokenService.calculateMaxSessionsPerCall('gpt-4o-mini');
      expect(maxSessions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('estimateTokenUsage', () => {
    const mockSessions: SessionWithTranscript[] = [
      {
        user_id: 'user1',
        session_id: 'session1',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T10:30:00Z',
        messages: [
          { from: 'user', message: 'Hello, I need help with my claim' },
          { from: 'bot', message: 'I can help you with that. What is your claim number?' }
        ]
      }
    ];

    it('should estimate tokens for single session', () => {
      const estimatedTokens = tokenService.estimateTokenUsage(mockSessions, 'gpt-4o-mini');
      expect(estimatedTokens).toBeGreaterThan(5500); // Should include reserved tokens
    });

    it('should estimate tokens for multiple sessions', () => {
      const multipleSessions = [mockSessions[0], mockSessions[0], mockSessions[0]];
      const estimatedTokens = tokenService.estimateTokenUsage(multipleSessions, 'gpt-4o-mini');
      expect(estimatedTokens).toBeGreaterThan(estimatedTokens);
    });

    it('should handle empty sessions array', () => {
      const estimatedTokens = tokenService.estimateTokenUsage([], 'gpt-4o-mini');
      expect(estimatedTokens).toBe(5500); // Just reserved tokens
    });
  });

  describe('splitSessionsIntoBatches', () => {
    const mockSessions = Array.from({ length: 25 }, (_, i) => ({
      user_id: `user${i + 1}`,
      session_id: `session${i + 1}`,
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T10:30:00Z',
      messages: []
    }));

    it('should split sessions into batches correctly', () => {
      const batches = tokenService.splitSessionsIntoBatches(mockSessions, 10);
      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(10);
      expect(batches[1]).toHaveLength(10);
      expect(batches[2]).toHaveLength(5);
    });

    it('should handle empty sessions array', () => {
      const batches = tokenService.splitSessionsIntoBatches([], 10);
      expect(batches).toEqual([]);
    });

    it('should handle single session', () => {
      const batches = tokenService.splitSessionsIntoBatches([mockSessions[0]!], 10);
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1);
    });

    it('should handle batch size larger than session count', () => {
      const batches = tokenService.splitSessionsIntoBatches(mockSessions.slice(0, 5), 10);
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(5);
    });
  });

  describe('calculateTokenEstimation', () => {
    const mockSessions: SessionWithTranscript[] = [
      {
        user_id: 'user1',
        session_id: 'session1',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T10:30:00Z',
        messages: [
          { from: 'user', message: 'Short message' }
        ]
      }
    ];

    it('should provide complete token estimation', () => {
      const estimation = tokenService.calculateTokenEstimation(mockSessions, 'gpt-4o-mini');
      expect(estimation.estimatedTokens).toBeGreaterThan(0);
      expect(estimation.recommendedBatchSize).toBeGreaterThan(0);
      expect(estimation.costEstimate).toBeGreaterThan(0);
      expect(typeof estimation.requiresSplitting).toBe('boolean');
    });

    it('should indicate splitting required for large session counts', () => {
      const manySessions = Array.from({ length: 100 }, (_, i) => ({
        ...mockSessions[0]!,
        user_id: `user${i + 1}`,
        session_id: `session${i + 1}`
      }));
      
      const estimation = tokenService.calculateTokenEstimation(manySessions, 'gpt-4o-mini');
      expect(estimation.requiresSplitting).toBe(true);
    });
  });

  describe('calculateCostEstimate', () => {
    it('should calculate cost from BatchTokenUsage', () => {
      const tokenUsage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        cost: 0,
        model: 'gpt-4o-mini'
      };
      
      const cost = tokenService.calculateCostEstimate(tokenUsage);
      expect(cost).toBeGreaterThan(0);
    });

    it('should calculate cost from total tokens and model', () => {
      const cost = tokenService.calculateCostEstimate(1500, 'gpt-4o-mini');
      expect(cost).toBeGreaterThan(0);
    });

    it('should return 0 for unknown model', () => {
      const cost = tokenService.calculateCostEstimate(1500, 'unknown-model');
      expect(cost).toBe(0);
    });
  });

  describe('canProcessInSingleCall', () => {
    it('should return true for small session count', () => {
      const sessions = Array.from({ length: 5 }, (_, i) => ({
        user_id: `user${i + 1}`,
        session_id: `session${i + 1}`,
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T10:30:00Z',
        messages: []
      }));
      
      const canProcess = tokenService.canProcessInSingleCall(sessions, 'gpt-4o-mini');
      expect(canProcess).toBe(true);
    });

    it('should return false for large session count', () => {
      const sessions = Array.from({ length: 100 }, (_, i) => ({
        user_id: `user${i + 1}`,
        session_id: `session${i + 1}`,
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T10:30:00Z',
        messages: []
      }));
      
      const canProcess = tokenService.canProcessInSingleCall(sessions, 'gpt-4o-mini');
      expect(canProcess).toBe(false);
    });
  });

  describe('getOptimalBatchConfig', () => {
    it('should return config for GPT-4o-mini', () => {
      const config = tokenService.getOptimalBatchConfig('gpt-4o-mini');
      expect(config.maxSessionsPerCall).toBeGreaterThan(0);
      expect(config.contextWindow).toBe(128000);
      expect(config.recommendedStreamCount).toBe(4);
    });

    it('should return config for GPT-4.1', () => {
      const config = tokenService.getOptimalBatchConfig('gpt-4.1');
      expect(config.maxSessionsPerCall).toBeGreaterThan(0);
      expect(config.contextWindow).toBe(1000000);
      expect(config.recommendedStreamCount).toBe(3);
    });

    it('should handle unknown model', () => {
      const config = tokenService.getOptimalBatchConfig('unknown');
      expect(config.maxSessionsPerCall).toBe(5);
      expect(config.contextWindow).toBe(8192);
      expect(config.recommendedStreamCount).toBe(8);
    });
  });
});