import { createSessionDataService } from '../../factories/serviceFactory';
import { SessionWithTranscript, Message } from '../../../../shared/types';

// Import static test data for validation
const staticSessionData = require('../../../../data/api-kore-sessions-selfservice-2025-07-23T17-05-08.json');
const staticMessageData = require('../../../../data/api-kore-messages-2025-07-23T17-05-31.json');

// Mock the createKoreApiService and configManager to force use of mock data
jest.mock('../../services/koreApiService');
jest.mock('../../utils/configManager', () => ({
  configManager: {
    getKoreConfig: jest.fn().mockImplementation(() => {
      throw new Error('No config found - using mock data for workflow tests');
    })
  }
}));

describe('Session History + Conversation History Integration Workflows', () => {
  const sessionDataService = createSessionDataService();
  
  describe('Large Dataset Handling', () => {
    it('should handle large session datasets efficiently with mock data', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const filters = {
        start_date: weekAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 100, // Large dataset test
        skip: 0
      };

      const startTime = Date.now();
      const result = await sessionDataService.getSessions(filters);
      const executionTime = Date.now() - startTime;

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(100); // Respects limit
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds with mock data
      
      // Verify each session has the expected structure
      result.forEach(session => {
        if (session) {
          expect(session).toHaveProperty('session_id');
          expect(session).toHaveProperty('messages');
          expect(session).toHaveProperty('containment_type');
          expect(['agent', 'selfService', 'dropOff']).toContain(session.containment_type);
        }
      });
    }, 15000);

    it('should handle complex pagination scenarios', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      // Test multiple pages
      const page1 = await sessionDataService.getSessions({
        start_date: twoDaysAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 0
      });

      const page2 = await sessionDataService.getSessions({
        start_date: twoDaysAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 5
      });

      const page3 = await sessionDataService.getSessions({
        start_date: twoDaysAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 10
      });

      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);
      expect(Array.isArray(page3)).toBe(true);

      // Verify pagination consistency
      expect(page1.length).toBeLessThanOrEqual(5);
      expect(page2.length).toBeLessThanOrEqual(5);
      expect(page3.length).toBeLessThanOrEqual(5);

      // Verify no duplicate sessions across pages
      const allSessionIds = [
        ...page1.map(s => s?.session_id).filter(Boolean),
        ...page2.map(s => s?.session_id).filter(Boolean),
        ...page3.map(s => s?.session_id).filter(Boolean)
      ];
      const uniqueSessionIds = [...new Set(allSessionIds)];
      expect(allSessionIds.length).toBe(uniqueSessionIds.length);
    });
  });

  describe('Message-Session Correlation', () => {
    it('should correctly correlate messages with sessions', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const filters = {
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 10,
        skip: 0
      };

      const sessions = await sessionDataService.getSessions(filters);

      expect(Array.isArray(sessions)).toBe(true);
      
      sessions.forEach(session => {
        if (session && session.messages) {
          // Verify message counts match actual message arrays
          const userMessages = session.messages.filter(m => m?.message_type === 'user');
          const botMessages = session.messages.filter(m => m?.message_type === 'bot');
          
          expect(session.user_message_count).toBe(userMessages.length);
          expect(session.bot_message_count).toBe(botMessages.length);
          expect(session.message_count).toBe(session.messages.length);
          
          // Verify all messages have required fields
          session.messages.forEach(message => {
            if (message) {
              expect(message).toHaveProperty('timestamp');
              expect(message).toHaveProperty('message_type');
              expect(message).toHaveProperty('message');
              expect(['user', 'bot']).toContain(message.message_type);
            }
          });
        }
      });
    });

    it('should maintain message chronological order within sessions', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      const filters = {
        start_date: twoDaysAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 15,
        skip: 0
      };

      const sessions = await sessionDataService.getSessions(filters);

      expect(Array.isArray(sessions)).toBe(true);
      
      sessions.forEach(session => {
        if (session && session.messages && session.messages.length > 1) {
          for (let i = 1; i < session.messages.length; i++) {
            const prevMessage = session.messages[i-1];
            const currMessage = session.messages[i];
            
            if (prevMessage && currMessage) {
              const prevTime = new Date(prevMessage.timestamp);
              const currTime = new Date(currMessage.timestamp);
              
              // Messages should be in chronological order
              expect(prevTime.getTime()).toBeLessThanOrEqual(currTime.getTime());
            }
          }
        }
      });
    });
  });

  describe('Filtering and Search', () => {
    it('should properly filter by containment type', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      // Test each containment type
      const containmentTypes = ['agent', 'selfService', 'dropOff'] as const;
      
      for (const containmentType of containmentTypes) {
        const filters = {
          start_date: threeDaysAgo.toISOString(),
          end_date: now.toISOString(),
          containment_type: containmentType,
          limit: 10,
          skip: 0
        };

        const sessions = await sessionDataService.getSessions(filters);
        
        expect(Array.isArray(sessions)).toBe(true);
        
        // All returned sessions should match the filter
        sessions.forEach(session => {
          if (session) {
            expect(session.containment_type).toBe(containmentType);
          }
        });
      }
    });

    it('should handle date range filtering accurately', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      // Narrow date range
      const narrowFilters = {
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 20,
        skip: 0
      };

      // Broader date range
      const broadFilters = {
        start_date: twoDaysAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 20,
        skip: 0
      };

      const narrowResults = await sessionDataService.getSessions(narrowFilters);
      const broadResults = await sessionDataService.getSessions(broadFilters);

      expect(Array.isArray(narrowResults)).toBe(true);
      expect(Array.isArray(broadResults)).toBe(true);
      
      // Broader date range should return same or more sessions
      expect(broadResults.length).toBeGreaterThanOrEqual(narrowResults.length);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent requests without interference', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const filters = {
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 10,
        skip: 0
      };

      // Execute multiple concurrent requests
      const promises = Array(3).fill(null).map(() => sessionDataService.getSessions(filters));
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const executionTime = Date.now() - startTime;

      // All requests should complete successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });

      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(8000); // 8 seconds for 3 concurrent requests
    }, 12000);

    it('should provide consistent results across multiple calls', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const filters = {
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 0
      };

      // Make multiple identical requests
      const result1 = await sessionDataService.getSessions(filters);
      const result2 = await sessionDataService.getSessions(filters);
      const result3 = await sessionDataService.getSessions(filters);

      expect(Array.isArray(result1)).toBe(true);
      expect(Array.isArray(result2)).toBe(true);
      expect(Array.isArray(result3)).toBe(true);

      // Results should be reasonably consistent (within expected variance)
      // Mock data generation may have some variance, so we allow for small differences
      const lengths = [result1.length, result2.length, result3.length];
      const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      
      // All results should be within reasonable range of average
      lengths.forEach(length => {
        expect(Math.abs(length - avgLength)).toBeLessThanOrEqual(2); // Allow for small variance
      });
      
      // Verify consistent session structure
      if (result1.length > 0 && result1[0]) {
        const firstSession = result1[0];
        expect(firstSession).toHaveProperty('session_id');
        expect(firstSession).toHaveProperty('containment_type');
        expect(firstSession).toHaveProperty('messages');
      }
    });
  });

  describe('Static Data Validation', () => {
    it('should validate compatibility with production data structure', async () => {
      // Validate that our static data has expected structure
      expect(staticSessionData).toHaveProperty('data');
      expect(Array.isArray(staticSessionData.data)).toBe(true);
      expect(staticSessionData.data.length).toBeGreaterThan(0);

      // Test with a session from static data
      const staticSession = staticSessionData.data[0];
      expect(staticSession).toHaveProperty('session_id');
      expect(staticSession).toHaveProperty('containment_type');
      expect(['agent', 'selfService', 'dropOff']).toContain(staticSession.containment_type);

      // Validate message data structure
      expect(staticMessageData).toHaveProperty('data');
      expect(Array.isArray(staticMessageData.data)).toBe(true);
      
      if (staticMessageData.data.length > 0) {
        const staticMessage = staticMessageData.data[0];
        expect(staticMessage).toHaveProperty('sessionId');
        expect(staticMessage).toHaveProperty('message_type');
        expect(['user', 'bot']).toContain(staticMessage.message_type);
      }
    });

    it('should demonstrate workflow compatibility with real data patterns', async () => {
      // This test shows that our workflow can handle the same data patterns as production
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const filters = {
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 10,
        skip: 0
      };

      const sessions = await sessionDataService.getSessions(filters);

      // Verify the workflow produces data in the same format as our static examples
      if (sessions.length > 0 && sessions[0]) {
        const session = sessions[0];
        const staticSession = staticSessionData.data[0];
        
        // Both should have the same essential properties
        const expectedProperties = ['session_id', 'user_id', 'start_time', 'end_time', 'containment_type', 'messages'];
        expectedProperties.forEach(prop => {
          expect(session).toHaveProperty(prop);
          expect(staticSession).toHaveProperty(prop);
        });
      }
    });
  });
});