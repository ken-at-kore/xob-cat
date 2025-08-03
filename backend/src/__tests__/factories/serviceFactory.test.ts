import { ServiceFactory, ServiceType } from '../../factories/serviceFactory';
import { MockKoreApiService } from '../../__mocks__/koreApiService.mock';
import { MockOpenAIService } from '../../__mocks__/openaiService.mock';
import { MockSessionDataService } from '../../__mocks__/sessionDataService.mock';

describe('ServiceFactory', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    ServiceFactory.resetToDefaults();
  });

  describe('getServiceType', () => {
    it('should return MOCK for test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      ServiceFactory.resetToDefaults();
      expect(ServiceFactory.getServiceType()).toBe(ServiceType.MOCK);
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should return REAL for development environment by default', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      ServiceFactory.resetToDefaults();
      expect(ServiceFactory.getServiceType()).toBe(ServiceType.REAL);
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should respect explicit configuration', () => {
      const originalEnv = process.env.NODE_ENV;
      
      // Temporarily set to development to test configuration override
      process.env.NODE_ENV = 'development';
      ServiceFactory.resetToDefaults();

      ServiceFactory.useMockServices();
      expect(ServiceFactory.getServiceType()).toBe(ServiceType.MOCK);

      ServiceFactory.useRealServices();
      expect(ServiceFactory.getServiceType()).toBe(ServiceType.REAL);

      ServiceFactory.useHybridServices();
      expect(ServiceFactory.getServiceType()).toBe(ServiceType.HYBRID);
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
      ServiceFactory.resetToDefaults();
    });
  });

  describe('createKoreApiService', () => {
    it('should create mock service when configured for mock', () => {
      ServiceFactory.useMockServices();
      
      const service = ServiceFactory.createKoreApiService();
      expect(service).toBeInstanceOf(MockKoreApiService);
    });

    it('should throw error for real service without config', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      ServiceFactory.resetToDefaults();
      ServiceFactory.useRealServices();
      
      expect(() => ServiceFactory.createKoreApiService()).toThrow('KoreApiConfig is required');
      
      process.env.NODE_ENV = originalEnv;
      ServiceFactory.resetToDefaults();
    });

    it('should create real service with valid config', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      ServiceFactory.resetToDefaults();
      ServiceFactory.useRealServices();
      
      const config = {
        botId: 'test-bot',
        clientId: 'test-client',
        clientSecret: 'test-secret'
      };
      
      const service = ServiceFactory.createKoreApiService(config);
      expect(service).toBeDefined();
      expect(service).not.toBeInstanceOf(MockKoreApiService);
      
      process.env.NODE_ENV = originalEnv;
      ServiceFactory.resetToDefaults();
    });
  });

  describe('createOpenAIService', () => {
    it('should create mock service when configured for mock', () => {
      ServiceFactory.useMockServices();
      
      const service = ServiceFactory.createOpenAIService();
      expect(service).toBeInstanceOf(MockOpenAIService);
    });

    it('should create real service when configured for real', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      ServiceFactory.resetToDefaults();
      ServiceFactory.useRealServices();
      
      const service = ServiceFactory.createOpenAIService();
      expect(service).toBeDefined();
      expect(service).not.toBeInstanceOf(MockOpenAIService);
      
      process.env.NODE_ENV = originalEnv;
      ServiceFactory.resetToDefaults();
    });
  });

  describe('createSessionDataService', () => {
    it('should create mock service when configured for mock', () => {
      ServiceFactory.useMockServices();
      
      const service = ServiceFactory.createSessionDataService();
      expect(service).toBeInstanceOf(MockSessionDataService);
    });

    it('should create real service when configured for real', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      ServiceFactory.resetToDefaults();
      ServiceFactory.useRealServices();
      
      const service = ServiceFactory.createSessionDataService();
      expect(service).toBeDefined();
      expect(service).not.toBeInstanceOf(MockSessionDataService);
      
      process.env.NODE_ENV = originalEnv;
      ServiceFactory.resetToDefaults();
    });
  });

  describe('hybrid mode', () => {
    it('should fallback to mock for Kore API service when real fails', () => {
      ServiceFactory.useHybridServices();
      
      // Should fallback to mock when no config provided
      const service = ServiceFactory.createKoreApiService();
      expect(service).toBeInstanceOf(MockKoreApiService);
    });
  });

  describe('configuration management', () => {
    it('should maintain configuration state', () => {
      ServiceFactory.useMockServices();
      expect(ServiceFactory.getConfig().type).toBe(ServiceType.MOCK);

      ServiceFactory.useRealServices();
      expect(ServiceFactory.getConfig().type).toBe(ServiceType.REAL);

      ServiceFactory.useHybridServices();
      expect(ServiceFactory.getConfig().type).toBe(ServiceType.HYBRID);
    });

    it('should reset to environment defaults', () => {
      ServiceFactory.useMockServices();
      expect(ServiceFactory.getConfig().type).toBe(ServiceType.MOCK);

      ServiceFactory.resetToDefaults();
      // In test environment, should reset to MOCK
      expect(ServiceFactory.getConfig().type).toBe(ServiceType.MOCK);
    });
  });
});