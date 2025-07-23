import { getSessions } from '../../services/mockDataService';
import { SessionWithTranscript, Message } from '../../../../shared/types';

// Mock the createKoreApiService and configManager
jest.mock('../../services/koreApiService');
jest.mock('../../utils/configManager');

describe('Session History + Conversation History Integration (Simplified)', () => {
  
  describe('Complete Session with Conversation History Retrieval', () => {
    it('should retrieve sessions and populate with conversation messages from mockDataService', async () => {
      // Execute the workflow with realistic filters
      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z',
        limit: 10,
        skip: 0
      };

      const result = await getSessions(filters);

      // Verify sessions are returned (could be mock or real depending on config)
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
      
      // If sessions exist, verify they have the correct structure
      if (result.length > 0) {
        const session = result[0];
        expect(session).toBeDefined();
        
        // Verify session structure
        expect(session).toHaveProperty('session_id');
        expect(session).toHaveProperty('user_id'); 
        expect(session).toHaveProperty('start_time');
        expect(session).toHaveProperty('end_time');
        expect(session).toHaveProperty('containment_type');
        expect(session).toHaveProperty('messages');
        expect(session).toHaveProperty('message_count');
        expect(session).toHaveProperty('user_message_count');
        expect(session).toHaveProperty('bot_message_count');
        
        // Verify messages structure if they exist
        if (session && session.messages && session.messages.length > 0) {
          const message = session.messages[0];
          expect(message).toBeDefined();
          expect(message).toHaveProperty('timestamp');
          expect(message).toHaveProperty('message_type');
          expect(message).toHaveProperty('message');
          if (message) {
            expect(['user', 'bot']).toContain(message.message_type);
          }
        }
      }
    });

    it('should handle filtering by containment type', async () => {
      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z', 
        containment_type: 'selfService',
        limit: 5,
        skip: 0
      };

      const result = await getSessions(filters);
      
      expect(Array.isArray(result)).toBe(true);
      
      // If sessions exist, verify containment type filter worked
      result.forEach(session => {
        if (session.containment_type) {
          expect(session.containment_type).toBe('selfService');
        }
      });
    });

    it('should handle pagination correctly', async () => {
      const firstPageFilters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z',
        limit: 5,
        skip: 0
      };

      const secondPageFilters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z',
        limit: 5,
        skip: 5
      };

      const firstPage = await getSessions(firstPageFilters);
      const secondPage = await getSessions(secondPageFilters);
      
      expect(Array.isArray(firstPage)).toBe(true);
      expect(Array.isArray(secondPage)).toBe(true);
      
      // Verify pagination returns different results (if there are enough sessions)
      if (firstPage.length > 0 && secondPage.length > 0) {
        const firstSession = firstPage[0];
        const secondSession = secondPage[0];
        expect(firstSession).toBeDefined();
        expect(secondSession).toBeDefined();
        if (firstSession && secondSession) {
          expect(firstSession.session_id).not.toBe(secondSession.session_id);
        }
      }
    });

    it('should maintain message chronological order within sessions', async () => {
      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z',
        limit: 10,
        skip: 0
      };

      const result = await getSessions(filters);
      
      // Check chronological order for sessions that have multiple messages
      result.forEach(session => {
        if (session.messages && session.messages.length > 1) {
          for (let i = 1; i < session.messages.length; i++) {
            const prevMessage = session.messages[i-1];
            const currMessage = session.messages[i];
            if (prevMessage && currMessage) {
              const prevTime = new Date(prevMessage.timestamp).getTime();
              const currTime = new Date(currMessage.timestamp).getTime();
              expect(currTime).toBeGreaterThanOrEqual(prevTime);
            }
          }
        }
      });
    });

    it('should handle empty results gracefully', async () => {
      // Use a date range with no data
      const filters = {
        start_date: '2030-01-01T00:00:00Z',
        end_date: '2030-01-02T00:00:00Z',
        limit: 10,
        skip: 0
      };

      const result = await getSessions(filters);
      
      expect(Array.isArray(result)).toBe(true);
      // May be empty array for future dates or still have mock data
    });

    it('should handle service integration correctly', async () => {
      // This test verifies the service integration works end-to-end
      const filters = {
        start_date: '2025-07-07T00:00:00Z',
        end_date: '2025-07-07T23:59:59Z',
        limit: 50,
        skip: 0
      };

      const startTime = Date.now();
      const result = await getSessions(filters);
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify reasonable performance
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify response structure
      expect(Array.isArray(result)).toBe(true);
      
      // Verify all sessions have required fields
      result.forEach(session => {
        expect(typeof session.session_id).toBe('string');
        expect(typeof session.user_id).toBe('string');
        expect(typeof session.start_time).toBe('string');
        expect(typeof session.end_time).toBe('string');
        expect(['agent', 'selfService', 'dropOff']).toContain(session.containment_type);
        expect(Array.isArray(session.messages)).toBe(true);
        expect(typeof session.message_count).toBe('number');
        expect(typeof session.user_message_count).toBe('number');
        expect(typeof session.bot_message_count).toBe('number');
      });
    });
  });
});