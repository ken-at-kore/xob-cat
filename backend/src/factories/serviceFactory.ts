import { IKoreApiService, IOpenAIService, ISessionDataService, ServiceType, ServiceConfig } from '../interfaces';
import { MockKoreApiService } from '../__mocks__/koreApiService.mock';
import { MockOpenAIService } from '../__mocks__/openaiService.mock';
import { MockSessionDataService } from '../__mocks__/sessionDataService.mock';

// Import real services
import { KoreApiConfig } from '../services/koreApiService';
import { createRealKoreApiService } from '../services/realKoreApiService';
import { createRealOpenAIService } from '../services/realOpenAIService';
import { createRealSessionDataService } from '../services/realSessionDataService';

export class ServiceFactory {
  private static config: ServiceConfig = {
    type: ServiceType.REAL,
    environment: (process.env.NODE_ENV as 'test' | 'development' | 'production') || 'development'
  };

  static configure(config: Partial<ServiceConfig>): void {
    ServiceFactory.config = { ...ServiceFactory.config, ...config };
  }

  static getServiceType(): ServiceType {
    // Force mock services in test environment
    if (ServiceFactory.config.environment === 'test') {
      return ServiceType.MOCK;
    }

    // Check environment variable for forcing mock services (useful for E2E tests)
    if (process.env.USE_MOCK_SERVICES === 'mock') {
      return ServiceType.MOCK;
    }

    // Use configured type for other environments
    return ServiceFactory.config.type;
  }

  static createKoreApiService(koreConfig?: KoreApiConfig): IKoreApiService {
    const serviceType = ServiceFactory.getServiceType();
    
    console.log(`🏭 ServiceFactory: Creating Kore API service (type: ${serviceType})`);
    console.log(`🏭 ServiceFactory: NODE_ENV=${process.env.NODE_ENV}, USE_MOCK_SERVICES=${process.env.USE_MOCK_SERVICES}`);
    console.log(`🏭 ServiceFactory: Config:`, ServiceFactory.config);
    console.log(`🏭 ServiceFactory: Has koreConfig:`, !!koreConfig, koreConfig ? `bot: ${koreConfig.botId}` : 'none');

    switch (serviceType) {
      case ServiceType.MOCK:
        return new MockKoreApiService();
        
      case ServiceType.REAL:
        if (!koreConfig) {
          throw new Error('KoreApiConfig is required for real Kore API service');
        }
        return createRealKoreApiService(koreConfig);
        
        
      default:
        throw new Error(`Unknown service type: ${serviceType}`);
    }
  }

  static createOpenAIService(): IOpenAIService {
    const serviceType = ServiceFactory.getServiceType();
    
    console.log(`🏭 ServiceFactory: Creating OpenAI service (type: ${serviceType})`);

    switch (serviceType) {
      case ServiceType.MOCK:
        return new MockOpenAIService();
        
      case ServiceType.REAL:
        return createRealOpenAIService();
        
        
      default:
        throw new Error(`Unknown service type: ${serviceType}`);
    }
  }

  static createSessionDataService(): ISessionDataService {
    const serviceType = ServiceFactory.getServiceType();
    
    console.log(`🏭 ServiceFactory: Creating Session Data service (type: ${serviceType})`);

    switch (serviceType) {
      case ServiceType.MOCK:
        return new MockSessionDataService();
        
      case ServiceType.REAL:
        return createRealSessionDataService();
        
        
      default:
        throw new Error(`Unknown service type: ${serviceType}`);
    }
  }

  // Convenience methods for common scenarios

  static useMockServices(): void {
    ServiceFactory.configure({ type: ServiceType.MOCK });
  }

  static useRealServices(): void {
    ServiceFactory.configure({ type: ServiceType.REAL });
  }


  static resetToDefaults(): void {
    const environment = (process.env.NODE_ENV as 'test' | 'development' | 'production') || 'development';
    
    ServiceFactory.config = {
      type: environment === 'test' ? ServiceType.MOCK : ServiceType.REAL,
      environment
    };
  }

  // For testing - get current configuration
  static getConfig(): ServiceConfig {
    return { ...ServiceFactory.config };
  }
}

// Auto-configure based on environment on module load
if (process.env.NODE_ENV === 'test') {
  ServiceFactory.configure({ 
    type: ServiceType.MOCK, 
    environment: 'test' 
  });
}

// Convenience exports for common use cases
export const createKoreApiService = (config?: KoreApiConfig) => ServiceFactory.createKoreApiService(config);
export const createOpenAIService = () => ServiceFactory.createOpenAIService();
export const createSessionDataService = () => ServiceFactory.createSessionDataService();

// Export service types for external use
export { ServiceType };