import { StrategicDiscoveryService } from '../../services/strategicDiscoveryService';
import { BatchAnalysisService } from '../../services/batchAnalysisService';
import { IOpenAIService } from '../../interfaces';
import { SessionWithTranscript, DiscoveryConfig, ExistingClassifications } from '../../../../shared/types';

// Mock the BatchAnalysisService and IOpenAIService
const mockBatchAnalysisService = {
  processSessionsBatch: jest.fn()
} as jest.Mocked<BatchAnalysisService>;

const mockOpenAIService = {
  analyzeBatch: jest.fn(),
  calculateCost: jest.fn()
} as jest.Mocked<IOpenAIService>;

describe('StrategicDiscoveryService', () => {
  let discoveryService: StrategicDiscoveryService;
  
  const mockSessions: SessionWithTranscript[] = Array.from({ length: 100 }, (_, i) => ({
    user_id: `user${i + 1}`,
    session_id: `session${i + 1}`,
    start_time: new Date(Date.now() + i * 1000 * 60 * 60).toISOString(), // Spread over time
    end_time: new Date(Date.now() + (i + 1) * 1000 * 60 * 60).toISOString(),
    messages: [
      { from: 'user', message: i % 3 === 0 ? 'Short' : i % 3 === 1 ? 'This is a medium length message about my insurance claim' : 'This is a very long message that contains lots of details about my insurance policy and I need help understanding the coverage details and benefits that are available to me under this specific policy' },
      { from: 'bot', message: 'I can help you with that' }
    ]
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    discoveryService = new StrategicDiscoveryService(mockBatchAnalysisService, mockOpenAIService);
    
    // Setup default mock responses
    mockBatchAnalysisService.processSessionsBatch.mockResolvedValue({
      results: [{
        ...mockSessions[0]!,
        facts: {
          generalIntent: 'Test Intent',
          sessionOutcome: 'Contained',
          transferReason: '',
          dropOffLocation: '',
          notes: 'Test analysis'
        },
        analysisMetadata: {
          tokensUsed: 100,
          processingTime: 1000,
          batchNumber: 1,
          timestamp: new Date().toISOString(),
          model: 'gpt-4o-mini'
        }
      }],
      updatedClassifications: {
        generalIntent: new Set(['Test Intent']),
        transferReason: new Set(),
        dropOffLocation: new Set()
      },
      tokenUsage: {
        promptTokens: 500,
        completionTokens: 250,
        totalTokens: 750,
        cost: 0.01,
        model: 'gpt-4o-mini'
      }
    });
  });

  describe('calculateDiscoverySize', () => {
    it('should calculate discovery size based on percentage', () => {
      const config: DiscoveryConfig = {
        targetPercentage: 15,
        minSessions: 50,
        maxSessions: 150,
        diversityStrategy: {
          sessionLengths: ['short', 'medium', 'long'],
          containmentTypes: ['agent', 'selfService', 'dropOff'],
          timeDistribution: 'spread'
        }
      };

      const size = discoveryService.calculateDiscoverySize(1000, config);
      expect(size).toBe(150); // 15% of 1000 = 150, within bounds
    });

    it('should enforce minimum size', () => {
      const config: DiscoveryConfig = {
        targetPercentage: 5, // 5% of 100 = 5
        minSessions: 50,
        maxSessions: 150,
        diversityStrategy: {
          sessionLengths: ['short', 'medium', 'long'],
          containmentTypes: ['agent', 'selfService', 'dropOff'],
          timeDistribution: 'spread'
        }
      };

      const size = discoveryService.calculateDiscoverySize(100, config);
      expect(size).toBe(50); // Should use minimum
    });

    it('should enforce maximum size', () => {
      const config: DiscoveryConfig = {
        targetPercentage: 20, // 20% of 1000 = 200
        minSessions: 50,
        maxSessions: 150,
        diversityStrategy: {
          sessionLengths: ['short', 'medium', 'long'],
          containmentTypes: ['agent', 'selfService', 'dropOff'],
          timeDistribution: 'spread'
        }
      };

      const size = discoveryService.calculateDiscoverySize(1000, config);
      expect(size).toBe(150); // Should use maximum
    });

    it('should not exceed total sessions', () => {
      const config: DiscoveryConfig = {
        targetPercentage: 50,
        minSessions: 200, // Larger than total sessions
        maxSessions: 300,
        diversityStrategy: {
          sessionLengths: ['short', 'medium', 'long'],
          containmentTypes: ['agent', 'selfService', 'dropOff'],
          timeDistribution: 'spread'
        }
      };

      const size = discoveryService.calculateDiscoverySize(100, config);
      expect(size).toBe(100); // Should not exceed total
    });
  });

  describe('selectDiverseSessions', () => {
    const config: DiscoveryConfig = {
      targetPercentage: 15,
      minSessions: 10,
      maxSessions: 50,
      diversityStrategy: {
        sessionLengths: ['short', 'medium', 'long'],
        containmentTypes: ['agent', 'selfService', 'dropOff'],
        timeDistribution: 'spread'
      }
    };

    it('should select requested number of sessions', () => {
      const selected = discoveryService.selectDiverseSessions(mockSessions, 20, config);
      expect(selected).toHaveLength(20);
    });

    it('should return all sessions if target exceeds available', () => {
      const smallSessionSet = mockSessions.slice(0, 10);
      const selected = discoveryService.selectDiverseSessions(smallSessionSet, 20, config);
      expect(selected).toHaveLength(10);
    });

    it('should include sessions of different lengths', () => {
      const selected = discoveryService.selectDiverseSessions(mockSessions, 30, config);
      
      // Check that we have variety in session lengths
      const sessionLengths = selected.map(session => {
        const totalChars = session.messages.reduce((total, msg) => total + (msg.message?.length || 0), 0);
        return totalChars;
      });
      
      const uniqueLengthRanges = new Set(sessionLengths.map(length => 
        length < 50 ? 'short' : length < 200 ? 'medium' : 'long'
      ));
      
      expect(uniqueLengthRanges.size).toBeGreaterThan(1); // Should have variety
    });

    it('should distribute across time periods', () => {
      const selected = discoveryService.selectDiverseSessions(mockSessions, 30, config);
      
      // Check time distribution
      const times = selected.map(s => new Date(s.start_time).getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      expect(maxTime - minTime).toBeGreaterThan(0); // Should span time range
    });
  });

  describe('runDiscovery', () => {
    it('should complete discovery process successfully', async () => {
      const progressCallback = jest.fn();
      
      const result = await discoveryService.runDiscovery(
        mockSessions.slice(0, 50), 
        {},
        progressCallback
      );

      expect(result.baseClassifications).toBeDefined();
      expect(result.processedSessions).toBeDefined();
      expect(result.remainingSessions).toBeDefined();
      expect(result.discoveryStats).toBeDefined();
      expect(result.tokenUsage).toBeDefined();
      
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should handle custom discovery config', async () => {
      const customConfig: Partial<DiscoveryConfig> = {
        targetPercentage: 20,
        minSessions: 5,
        maxSessions: 25
      };

      const result = await discoveryService.runDiscovery(
        mockSessions.slice(0, 50),
        customConfig
      );

      expect(result.processedSessions.length).toBeLessThanOrEqual(25);
    });

    it('should accumulate classifications across batches', async () => {
      // Mock multiple batches with different classifications
      mockBatchAnalysisService.processSessionsBatch
        .mockResolvedValueOnce({
          results: [{
            ...mockSessions[0]!,
            facts: {
              generalIntent: 'Intent 1',
              sessionOutcome: 'Contained',
              transferReason: '',
              dropOffLocation: '',
              notes: 'First batch'
            },
            analysisMetadata: {
              tokensUsed: 100,
              processingTime: 1000,
              batchNumber: 1,
              timestamp: new Date().toISOString(),
              model: 'gpt-4o-mini'
            }
          }],
          updatedClassifications: {
            generalIntent: new Set(['Intent 1']),
            transferReason: new Set(),
            dropOffLocation: new Set()
          },
          tokenUsage: {
            promptTokens: 500,
            completionTokens: 250,
            totalTokens: 750,
            cost: 0.01,
            model: 'gpt-4o-mini'
          }
        })
        .mockResolvedValueOnce({
          results: [{
            ...mockSessions[1]!,
            facts: {
              generalIntent: 'Intent 2',
              sessionOutcome: 'Transfer',
              transferReason: 'Technical Issue',
              dropOffLocation: 'Agent Queue',
              notes: 'Second batch'
            },
            analysisMetadata: {
              tokensUsed: 100,
              processingTime: 1000,
              batchNumber: 2,
              timestamp: new Date().toISOString(),
              model: 'gpt-4o-mini'
            }
          }],
          updatedClassifications: {
            generalIntent: new Set(['Intent 1', 'Intent 2']),
            transferReason: new Set(['Technical Issue']),
            dropOffLocation: new Set(['Agent Queue'])
          },
          tokenUsage: {
            promptTokens: 500,
            completionTokens: 250,
            totalTokens: 750,
            cost: 0.01,
            model: 'gpt-4o-mini'
          }
        });

      const result = await discoveryService.runDiscovery(
        mockSessions.slice(0, 12) // Enough for 2+ batches
      );

      expect(result.baseClassifications.generalIntent.size).toBe(2);
      expect(result.baseClassifications.transferReason.size).toBe(1);
      expect(result.baseClassifications.dropOffLocation.size).toBe(1);
    });

    it('should calculate discovery stats correctly', async () => {
      const result = await discoveryService.runDiscovery(
        mockSessions.slice(0, 20)
      );

      expect(result.discoveryStats.totalProcessed).toBeGreaterThan(0);
      expect(result.discoveryStats.uniqueIntents).toBeGreaterThanOrEqual(0);
      expect(result.discoveryStats.uniqueReasons).toBeGreaterThanOrEqual(0);
      expect(result.discoveryStats.uniqueLocations).toBeGreaterThanOrEqual(0);
      expect(result.discoveryStats.discoveryRate).toBeGreaterThanOrEqual(0);
      expect(result.discoveryStats.discoveryRate).toBeLessThanOrEqual(1);
    });

    it('should handle batch processing errors gracefully', async () => {
      // Mock one successful batch and one failed batch
      mockBatchAnalysisService.processSessionsBatch
        .mockResolvedValueOnce({
          results: [{
            ...mockSessions[0]!,
            facts: {
              generalIntent: 'Test Intent',
              sessionOutcome: 'Contained',
              transferReason: '',
              dropOffLocation: '',
              notes: 'Success'
            },
            analysisMetadata: {
              tokensUsed: 100,
              processingTime: 1000,
              batchNumber: 1,
              timestamp: new Date().toISOString(),
              model: 'gpt-4o-mini'
            }
          }],
          updatedClassifications: {
            generalIntent: new Set(['Test Intent']),
            transferReason: new Set(),
            dropOffLocation: new Set()
          },
          tokenUsage: {
            promptTokens: 500,
            completionTokens: 250,
            totalTokens: 750,
            cost: 0.01,
            model: 'gpt-4o-mini'
          }
        })
        .mockRejectedValueOnce(new Error('Batch processing failed'));

      const result = await discoveryService.runDiscovery(
        mockSessions.slice(0, 12) // Enough for 2+ batches
      );

      // Should still have results from successful batch
      expect(result.processedSessions.length).toBeGreaterThan(0);
      expect(result.baseClassifications.generalIntent.size).toBeGreaterThan(0);
    });
  });

  describe('validateDiscoveryQuality', () => {
    it('should validate good discovery results', () => {
      const goodResult = {
        baseClassifications: {
          generalIntent: new Set(['Intent1', 'Intent2', 'Intent3', 'Intent4']),
          transferReason: new Set(['Reason1', 'Reason2']),
          dropOffLocation: new Set(['Location1'])
        },
        processedSessions: [],
        remainingSessions: [],
        discoveryStats: {
          totalProcessed: 25,
          uniqueIntents: 4,
          uniqueReasons: 2,
          uniqueLocations: 1,
          discoveryRate: 0.8
        },
        tokenUsage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
          cost: 0.02,
          model: 'gpt-4o-mini'
        }
      };

      const validation = discoveryService.validateDiscoveryQuality(goodResult);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.recommendations).toHaveLength(0);
    });

    it('should identify issues with poor discovery results', () => {
      const poorResult = {
        baseClassifications: {
          generalIntent: new Set(['Intent1', 'Intent2']), // Only 2 intents
          transferReason: new Set(),
          dropOffLocation: new Set()
        },
        processedSessions: [],
        remainingSessions: [],
        discoveryStats: {
          totalProcessed: 5, // Very few sessions
          uniqueIntents: 2,
          uniqueReasons: 0,
          uniqueLocations: 0,
          discoveryRate: 0.2 // Low discovery rate
        },
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cost: 0.001,
          model: 'gpt-4o-mini'
        }
      };

      const validation = discoveryService.validateDiscoveryQuality(poorResult);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide specific recommendations for improvement', () => {
      const poorResult = {
        baseClassifications: {
          generalIntent: new Set(['Intent1']), // Too few intents
          transferReason: new Set(),
          dropOffLocation: new Set()
        },
        processedSessions: [],
        remainingSessions: [],
        discoveryStats: {
          totalProcessed: 15,
          uniqueIntents: 1,
          uniqueReasons: 0,
          uniqueLocations: 0,
          discoveryRate: 0.1
        },
        tokenUsage: {
          promptTokens: 500,
          completionTokens: 250,
          totalTokens: 750,
          cost: 0.01,
          model: 'gpt-4o-mini'
        }
      };

      const validation = discoveryService.validateDiscoveryQuality(poorResult);
      expect(validation.recommendations.some(r => r.includes('discovery'))).toBe(true);
    });
  });

  describe('static getDefaultConfig', () => {
    it('should return valid default configuration', () => {
      const defaultConfig = StrategicDiscoveryService.getDefaultConfig();
      
      expect(defaultConfig.targetPercentage).toBe(15);
      expect(defaultConfig.minSessions).toBe(50);
      expect(defaultConfig.maxSessions).toBe(150);
      expect(defaultConfig.diversityStrategy).toBeDefined();
      expect(defaultConfig.diversityStrategy.sessionLengths).toContain('short');
      expect(defaultConfig.diversityStrategy.sessionLengths).toContain('medium');
      expect(defaultConfig.diversityStrategy.sessionLengths).toContain('long');
    });

    it('should read from environment variables when available', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DISCOVERY_TARGET_PERCENTAGE: '20',
        DISCOVERY_MIN_SESSIONS: '30',
        DISCOVERY_MAX_SESSIONS: '100'
      };

      const config = StrategicDiscoveryService.getDefaultConfig();
      expect(config.targetPercentage).toBe(20);
      expect(config.minSessions).toBe(30);
      expect(config.maxSessions).toBe(100);

      process.env = originalEnv;
    });
  });
});