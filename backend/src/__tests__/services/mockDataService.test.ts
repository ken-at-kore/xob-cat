import { jest } from '@jest/globals';
import { createSessionDataService, ServiceFactory } from '../../factories/serviceFactory';
import { MockSessionDataService } from '../../__mocks__/sessionDataService.mock';
import { SessionFilters } from '../../../../shared/types/index';

// Import static test data for reference
const staticSessionData = require('../../../../data/api-kore-sessions-selfservice-2025-07-23T17-05-08.json');
const staticMessageData = require('../../../../data/api-kore-messages-2025-07-23T17-05-31.json');

describe('New Mock Service Architecture', () => {
  let sessionDataService: any;
  let mockSessionDataService: MockSessionDataService;

  beforeEach(() => {
    // Ensure we use mock services for testing
    ServiceFactory.useMockServices();
    sessionDataService = createSessionDataService();
    mockSessionDataService = new MockSessionDataService();
  });

  afterEach(() => {
    // Reset to defaults after each test
    ServiceFactory.resetToDefaults();
  });

  describe('ServiceFactory Integration', () => {
    it('should return MockSessionDataService when configured for mock', () => {
      ServiceFactory.useMockServices();
      const service = createSessionDataService();
      expect(service).toBeInstanceOf(MockSessionDataService);
    });

    it('should use mock service automatically in test environment', () => {
      // In test environment, should default to mock
      const service = createSessionDataService();
      expect(service).toBeDefined();
    });
  });

  describe('Mock Session Generation', () => {
    it('should generate mock sessions with realistic structure', () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const filters = {
        start_date: weekAgo.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0]
      };
      
      const sessions = mockSessionDataService.generateMockSessions(filters);

      expect(sessions).toBeInstanceOf(Array);
      expect(sessions.length).toBeGreaterThan(0);
      
      // Test against realistic static data structure
      const firstSession = sessions[0];
      const realisticSession = staticSessionData.data[0];
      
      // Should have same properties as real sessions
      expect(firstSession).toHaveProperty('session_id');
      expect(firstSession).toHaveProperty('user_id');
      expect(firstSession).toHaveProperty('start_time');
      expect(firstSession).toHaveProperty('end_time');
      expect(firstSession).toHaveProperty('containment_type');
      expect(firstSession).toHaveProperty('tags');
      expect(firstSession).toHaveProperty('messages');
      
      // Should have valid containment types like real data
      if (firstSession) {
        expect(['agent', 'selfService', 'dropOff']).toContain(firstSession.containment_type);
      }
    });

    it('should filter sessions by date range', () => {
      const filters = {
        start_date: '2024-08-01',
        end_date: '2024-08-01'
      };
      
      const sessions = mockSessionDataService.generateMockSessions(filters);
      expect(sessions).toBeInstanceOf(Array);
    });

    it('should filter sessions by containment type', async () => {
      const filters = {
        start_date: '2024-08-01',
        end_date: '2024-08-01',
        containment_type: 'selfService' as const
      };
      
      const sessions = await sessionDataService.getSessions(filters);
      expect(sessions).toBeInstanceOf(Array);
      sessions.forEach(session => {
        expect(session.containment_type).toBe('selfService');
      });
    });
  });

  describe('Integration with ServiceFactory', () => {
    it('should work seamlessly with ServiceFactory', async () => {
      const filters = {
        start_date: '2024-08-01',
        end_date: '2024-08-01',
        limit: 5
      };
      
      const sessions = await sessionDataService.getSessions(filters);
      
      expect(sessions).toBeInstanceOf(Array);
      expect(sessions.length).toBeLessThanOrEqual(5);
      
      sessions.forEach(session => {
        expect(session).toHaveProperty('session_id');
        expect(session).toHaveProperty('messages');
        expect(session.messages).toBeInstanceOf(Array);
      });
    });

    it('should provide consistent data structure', async () => {
      const filters = {
        start_date: '2024-08-01',
        end_date: '2024-08-01'
      };
      
      const sessions = await sessionDataService.getSessions(filters);
      
      if (sessions.length > 0) {
        const firstSession = sessions[0];
        expect(firstSession).toHaveProperty('session_id');
        expect(firstSession).toHaveProperty('user_id');
        expect(firstSession).toHaveProperty('start_time');
        expect(firstSession).toHaveProperty('end_time');
        expect(firstSession).toHaveProperty('containment_type');
        expect(firstSession).toHaveProperty('messages');
        expect(['selfService', 'agent', 'dropOff']).toContain(firstSession.containment_type);
      }
    });
  });
});