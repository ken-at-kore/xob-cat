import { AutoAnalyzeService } from '../../services/autoAnalyzeService';
import { AnalysisConfig } from '../../../../shared/types';

describe('AutoAnalyzeService - Bot ID Integration (Simplified)', () => {
  const testBotId = 'st-test-bot-12345678-abcd-efgh-ijkl-mnopqrstuvwx';
  const testJwtToken = 'test-jwt-token';

  const mockConfig: AnalysisConfig = {
    startDate: '2025-01-15',
    startTime: '09:00',
    sessionCount: 10,
    openaiApiKey: 'sk-test-key',
    modelId: 'gpt-4o-mini'
  };

  beforeEach(() => {
    // Clear singleton instance before each test
    (AutoAnalyzeService as any).instance = null;
  });

  afterEach(() => {
    // Clear singleton instance after each test
    (AutoAnalyzeService as any).instance = null;
  });

  it('stores botId correctly in service instance', () => {
    const service = AutoAnalyzeService.create(testBotId, testJwtToken);
    
    // Access private botId field for testing
    const serviceBotId = (service as any).botId;
    expect(serviceBotId).toBe(testBotId);
  });

  it('includes botId in progress when starting analysis', async () => {
    const service = AutoAnalyzeService.create(testBotId, testJwtToken);
    
    const analysisId = await service.startAnalysis(mockConfig);
    expect(analysisId).toBeDefined();
    expect(typeof analysisId).toBe('string');

    const progress = await service.getProgress(analysisId);
    expect(progress.botId).toBe(testBotId);
    expect(progress.modelId).toBe(mockConfig.modelId);
  });

  it('handles different bot IDs correctly', () => {
    const botId1 = 'st-bot-1-12345678-abcd';
    const botId2 = 'st-bot-2-87654321-dcba';
    
    // Test first bot ID
    (AutoAnalyzeService as any).instance = null;
    const service1 = AutoAnalyzeService.create(botId1, testJwtToken);
    expect((service1 as any).botId).toBe(botId1);
    
    // Test second bot ID (create new instance)
    (AutoAnalyzeService as any).instance = null;
    const service2 = AutoAnalyzeService.create(botId2, testJwtToken);
    expect((service2 as any).botId).toBe(botId2);
  });

  it('validates botId format edge cases', () => {
    const edgeCaseBotIds = [
      '', // empty string
      'short-id', // short ID
      'st-very-long-bot-id-that-might-cause-issues-1234567890abcdefghijklmnopqrstuvwxyz', // very long ID
    ];

    edgeCaseBotIds.forEach(testBotId => {
      // Clear singleton for each test
      (AutoAnalyzeService as any).instance = null;
      
      const service = AutoAnalyzeService.create(testBotId, testJwtToken);
      expect((service as any).botId).toBe(testBotId);
    });
  });

  it('maintains botId consistency across multiple method calls', async () => {
    const service = AutoAnalyzeService.create(testBotId, testJwtToken);
    
    const analysisId = await service.startAnalysis(mockConfig);
    
    // Check progress multiple times
    const progress1 = await service.getProgress(analysisId);
    const progress2 = await service.getProgress(analysisId);
    
    expect(progress1.botId).toBe(testBotId);
    expect(progress2.botId).toBe(testBotId);
    expect(progress1.botId).toBe(progress2.botId);
  });
});