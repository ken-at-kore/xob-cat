import { createSessionDataService } from '../../factories/serviceFactory';
import { SessionWithTranscript, Message } from '../../../../shared/types';

// Import static test data
const staticSessionData = require('../../../../data/api-kore-sessions-selfservice-2025-07-23T17-05-08.json');
const staticMessageData = require('../../../../data/api-kore-messages-2025-07-23T17-05-31.json');

// Mock the createKoreApiService and configManager to force use of static data
jest.mock('../../services/koreApiService');
jest.mock('../../utils/configManager', () => ({
  configManager: {
    getKoreConfig: jest.fn().mockImplementation(() => {
      throw new Error('No config found - using static test data');
    })
  }
}));

describe('Session History + Conversation History Integration (Static Data)', () => {
  const sessionDataService = createSessionDataService();
  
  describe('Complete Session with Conversation History Retrieval', () => {
    it('should retrieve sessions using static data and validate structure', async () => {
      // Execute the workflow with realistic filters within past week for mock data
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const filters = {
        start_date: threeDaysAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 10,
        skip: 0
      };

      const result = await sessionDataService.getSessions(filters);

      // Verify sessions are returned from mock data (fallback when no real API)
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0); // Should have mock sessions

      const session = result[0];
      expect(session).toBeDefined();
      
      if (session) {
        // Verify session structure matches expected format
        expect(session).toHaveProperty('session_id');
        expect(session).toHaveProperty('user_id'); 
        expect(session).toHaveProperty('start_time');
        expect(session).toHaveProperty('end_time');
        expect(session).toHaveProperty('containment_type');
        expect(session).toHaveProperty('messages');
        expect(session).toHaveProperty('message_count');
        expect(session).toHaveProperty('user_message_count');
        expect(session).toHaveProperty('bot_message_count');
        
        // Verify containment type is valid
        expect(['agent', 'selfService', 'dropOff']).toContain(session.containment_type);
        
        // Verify messages structure if they exist
        if (session.messages && session.messages.length > 0) {
          const message = session.messages[0];
          if (message) {
            expect(message).toHaveProperty('timestamp');
            expect(message).toHaveProperty('message_type');
            expect(message).toHaveProperty('message');
            expect(['user', 'bot']).toContain(message.message_type);
          }
        }
      }
    });

    it('should handle filtering by containment type using mock data', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const filters = {
        start_date: twoDaysAgo.toISOString(),
        end_date: now.toISOString(), 
        containment_type: 'selfService',
        limit: 5,
        skip: 0
      };

      const result = await sessionDataService.getSessions(filters);

      expect(Array.isArray(result)).toBe(true);
      
      // If sessions are returned, verify they match the filter
      result.forEach(session => {
        expect(session.containment_type).toBe('selfService');
      });
    });

    it('should handle pagination parameters correctly', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const filtersPage1 = {
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 2,
        skip: 0
      };

      const filtersPage2 = {
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 2,
        skip: 2
      };

      const page1 = await sessionDataService.getSessions(filtersPage1);
      const page2 = await sessionDataService.getSessions(filtersPage2);

      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);
      
      // Verify pagination is working (different results)
      if (page1.length > 0 && page2.length > 0 && page1[0] && page2[0]) {
        expect(page1[0].session_id).not.toBe(page2[0].session_id);
      }
    });

    it('should validate static data structure compatibility', async () => {
      // Verify our static session data has the expected structure
      expect(staticSessionData).toHaveProperty('data');
      expect(Array.isArray(staticSessionData.data)).toBe(true);
      expect(staticSessionData.data.length).toBeGreaterThan(0);

      const session = staticSessionData.data[0];
      expect(session).toHaveProperty('session_id');
      expect(session).toHaveProperty('containment_type');
      expect(['agent', 'selfService', 'dropOff']).toContain(session.containment_type);

      // Verify our static message data has the expected structure
      expect(staticMessageData).toHaveProperty('data');
      expect(Array.isArray(staticMessageData.data)).toBe(true);
      expect(staticMessageData.data.length).toBeGreaterThan(0);

      const message = staticMessageData.data[0];
      expect(message).toHaveProperty('sessionId');
      expect(message).toHaveProperty('message_type');
      expect(['user', 'bot']).toContain(message.message_type);
    });

    it('should complete workflow within reasonable time using mock data', async () => {
      const startTime = Date.now();
      
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const filters = {
        start_date: twoDaysAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 10,
        skip: 0
      };

      const result = await sessionDataService.getSessions(filters);
      
      const executionTime = Date.now() - startTime;
      
      expect(Array.isArray(result)).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds with mock data
    }, 10000);

    it('should handle message chronological ordering', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const filters = {
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 0
      };

      const result = await sessionDataService.getSessions(filters);

      expect(Array.isArray(result)).toBe(true);
      
      // Check chronological ordering within sessions that have multiple messages
      result.forEach(session => {
        if (session && session.messages && session.messages.length > 1) {
          for (let i = 1; i < session.messages.length; i++) {
            const prevMessage = session.messages[i-1];
            const currMessage = session.messages[i];
            if (prevMessage && currMessage) {
              const prevTime = new Date(prevMessage.timestamp);
              const currTime = new Date(currMessage.timestamp);
              expect(prevTime.getTime()).toBeLessThanOrEqual(currTime.getTime());
            }
          }
        }
      });
    });
  });
});