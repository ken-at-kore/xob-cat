import { AutoAnalyzeService } from '../../services/autoAnalyzeService';

describe('AutoAnalyzeService Bot ID Fix', () => {
  beforeEach(() => {
    // Clear any existing instances before each test
    (AutoAnalyzeService as any).instances = new Map();
  });

  test('should create separate instances for different bot IDs', () => {
    const mockBotId1 = 'st-mock-bot-id-1';
    const mockBotId2 = 'st-mock-bot-id-2';
    const jwtToken = 'mock-jwt-token';

    // Create service instance for Optum bot
    const optumService = AutoAnalyzeService.create(mockBotId1, jwtToken);
    
    // Create service instance for ComPsych bot
    const compsychService = AutoAnalyzeService.create(mockBotId2, jwtToken);

    // They should be different instances
    expect(optumService).not.toBe(compsychService);

    // Each instance should have the correct bot ID
    expect((optumService as any).botId).toBe(mockBotId1);
    expect((compsychService as any).botId).toBe(mockBotId2);
  });

  test('should reuse same instance for same bot ID', () => {
    const botId = 'st-mock-bot-id-1';
    const jwtToken = 'mock-jwt-token';

    // Create service instance twice with same bot ID
    const service1 = AutoAnalyzeService.create(botId, jwtToken, undefined);
    const service2 = AutoAnalyzeService.create(botId, jwtToken, undefined);

    // They should be the same instance (singleton for same bot)
    expect(service1).toBe(service2);
    expect((service1 as any).botId).toBe(botId);
  });

  test('should maintain separate instance maps per bot ID', () => {
    const mockBotId1 = 'st-mock-bot-id-1';
    const mockBotId2 = 'st-mock-bot-id-2';
    const jwtToken = 'mock-jwt-token';

    // Create multiple instances
    const optumService1 = AutoAnalyzeService.create(mockBotId1, jwtToken);
    const compsychService1 = AutoAnalyzeService.create(mockBotId2, jwtToken);
    const optumService2 = AutoAnalyzeService.create(mockBotId1, jwtToken);
    const compsychService2 = AutoAnalyzeService.create(mockBotId2, jwtToken);

    // Same bot ID should return same instance
    expect(optumService1).toBe(optumService2);
    expect(compsychService1).toBe(compsychService2);

    // Different bot IDs should return different instances
    expect(optumService1).not.toBe(compsychService1);
    expect(optumService2).not.toBe(compsychService2);

    // Verify bot IDs are correct
    expect((optumService1 as any).botId).toBe(mockBotId1);
    expect((compsychService1 as any).botId).toBe(mockBotId2);
  });

  test('should handle clearing instances correctly', () => {
    const botId1 = 'st-mock-bot-id-1';
    const botId2 = 'st-mock-bot-id-2';
    const jwtToken = 'mock-jwt-token';

    // Create instances
    const service1 = AutoAnalyzeService.create(botId1, jwtToken);
    const service2 = AutoAnalyzeService.create(botId2, jwtToken);

    // Verify they exist and are different
    expect(service1).not.toBe(service2);
    expect((service1 as any).botId).toBe(botId1);
    expect((service2 as any).botId).toBe(botId2);

    // Clear instances
    (AutoAnalyzeService as any).instances = new Map();

    // Create new instances - should be new objects
    const newService1 = AutoAnalyzeService.create(botId1, jwtToken);
    const newService2 = AutoAnalyzeService.create(botId2, jwtToken);

    // Should be new instances
    expect(newService1).not.toBe(service1);
    expect(newService2).not.toBe(service2);

    // But should still have correct bot IDs
    expect((newService1 as any).botId).toBe(botId1);
    expect((newService2 as any).botId).toBe(botId2);
  });
});