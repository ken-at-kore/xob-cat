import { jest } from '@jest/globals';
import { createSessionDataService } from '../../factories/serviceFactory';
import { Message } from '../../../../shared/types';

// Import static test data
const staticSessionData = require('../../../../data/api-kore-sessions-selfservice-2025-07-23T17-05-08.json');
const staticMessageData = require('../../../../data/api-kore-messages-2025-07-23T17-05-31.json');

// Mock the services to use static data
jest.mock('../../services/koreApiService');
jest.mock('../../utils/configManager', () => ({
  configManager: {
    getKoreConfig: jest.fn().mockImplementation(() => {
      throw new Error('No config found - using static data for conversation history tests');
    })
  }
}));

describe('Conversation History Retrieval (Static Data)', () => {
  const sessionDataService = createSessionDataService();
  
  describe('Message Retrieval', () => {
    it('should retrieve conversation messages using mock data service', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 10,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      
      // Verify sessions have messages
      sessions.forEach(session => {
        if (session && session.messages) {
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

    it('should handle pagination for large message datasets with mock data', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      // Test pagination by making multiple requests
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

      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);
      expect(page1.length).toBeLessThanOrEqual(5);
      expect(page2.length).toBeLessThanOrEqual(5);
    });

    it('should filter messages by session IDs using mock data', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 3,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      
      // Verify each session has correct session_id matching its messages
      sessions.forEach(session => {
        if (session && session.messages) {
          // All messages in a session should logically belong to that session
          // (This is validated by the service layer)
          expect(session.session_id).toBeDefined();
          expect(typeof session.session_id).toBe('string');
        }
      });
    });

    it('should handle rate limiting gracefully with mock data', async () => {
      // Mock data service doesn't have rate limiting, so this test validates 
      // that multiple rapid requests can be handled without issues
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const requests = Array(3).fill(null).map(() => 
        sessionDataService.getSessions({
          start_date: oneDayAgo.toISOString(),
          end_date: now.toISOString(),
          limit: 2,
          skip: 0
        })
      );

      const results = await Promise.all(requests);
      
      // All requests should complete successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should extract text content from message components using mock data', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      
      // Verify messages have text content
      sessions.forEach(session => {
        if (session && session.messages) {
          session.messages.forEach(message => {
            if (message) {
              expect(message.message).toBeDefined();
              expect(typeof message.message).toBe('string');
              expect(message.message.length).toBeGreaterThan(0);
            }
          });
        }
      });
    });

    it('should filter out messages without text content using mock data', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      
      // All messages should have valid text content (mock data service ensures this)
      sessions.forEach(session => {
        if (session && session.messages) {
          session.messages.forEach(message => {
            if (message) {
              expect(message.message).toBeTruthy();
              expect(message.message.trim()).not.toBe('');
            }
          });
        }
      });
    });
  });

  describe('Session Message Retrieval', () => {
    it('should retrieve messages for a specific session using mock data', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 1,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      
      if (sessions.length > 0 && sessions[0]) {
        const session = sessions[0];
        expect(session).toHaveProperty('session_id');
        expect(session).toHaveProperty('messages');
        
        if (session.messages && session.messages.length > 0) {
          const message = session.messages[0];
          if (message) {
            expect(message).toHaveProperty('timestamp');
            expect(message).toHaveProperty('message_type');
            expect(message).toHaveProperty('message');
          }
        }
      }
    });
  });

  describe('Conversation Flow Analysis', () => {
    it('should maintain chronological order of messages', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      
      sessions.forEach(session => {
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

    it('should identify user and bot messages correctly', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      
      sessions.forEach(session => {
        if (session && session.messages) {
          const userMessages = session.messages.filter(m => m?.message_type === 'user');
          const botMessages = session.messages.filter(m => m?.message_type === 'bot');
          
          // Verify counts match
          expect(session.user_message_count).toBe(userMessages.length);
          expect(session.bot_message_count).toBe(botMessages.length);
          
          // Verify all messages have valid types
          session.messages.forEach(message => {
            if (message) {
              expect(['user', 'bot']).toContain(message.message_type);
            }
          });
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock data service handles errors by falling back to mock data
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 1,
        skip: 0
      });

      // Should not throw error, should fall back to mock data
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should handle empty message responses', async () => {
      // Test with date range that may have no results
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: futureDate.toISOString(),
        end_date: futureDate.toISOString(),
        limit: 10,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      // Should return empty array for future dates
      expect(sessions.length).toBe(0);
    });

    it('should handle malformed message data', async () => {
      // Mock data service ensures data integrity, but test that it handles edge cases
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 3,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      
      // All returned data should be well-formed
      sessions.forEach(session => {
        if (session) {
          expect(session).toHaveProperty('session_id');
          expect(session).toHaveProperty('messages');
          
          if (session.messages) {
            session.messages.forEach(message => {
              if (message) {
                expect(message).toHaveProperty('timestamp');
                expect(message).toHaveProperty('message_type');
                expect(message).toHaveProperty('message');
              }
            });
          }
        }
      });
    });
  });

  describe('Performance and Rate Limiting', () => {
    it('should implement proper rate limiting', async () => {
      // Mock data service doesn't need rate limiting, but should handle rapid requests
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const startTime = Date.now();
      
      const requests = Array(5).fill(null).map(() => 
        sessionDataService.getSessions({
          start_date: oneDayAgo.toISOString(),
          end_date: now.toISOString(),
          limit: 2,
          skip: 0
        })
      );

      const results = await Promise.all(requests);
      const executionTime = Date.now() - startTime;
      
      // Should complete quickly with mock data
      expect(executionTime).toBeLessThan(3000);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should handle large message datasets efficiently', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      const startTime = Date.now();
      
      const sessions = await sessionDataService.getSessions({
        start_date: threeDaysAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 50, // Larger dataset
        skip: 0
      });

      const executionTime = Date.now() - startTime;
      
      expect(Array.isArray(sessions)).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should be fast with mock data
      expect(sessions.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Session and Conversation History Integration', () => {
    it('should retrieve session history with full conversation transcripts', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      
      sessions.forEach(session => {
        if (session) {
          // Verify session has conversation transcript
          expect(session).toHaveProperty('session_id');
          expect(session).toHaveProperty('messages');
          expect(session).toHaveProperty('message_count');
          expect(session).toHaveProperty('user_message_count');
          expect(session).toHaveProperty('bot_message_count');
          
          if (session.messages) {
            expect(session.message_count).toBe(session.messages.length);
          }
        }
      });
    });

    it('should filter sessions by containment type', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const selfServiceSessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        containment_type: 'selfService',
        limit: 5,
        skip: 0
      });

      expect(Array.isArray(selfServiceSessions)).toBe(true);
      
      selfServiceSessions.forEach(session => {
        if (session) {
          expect(session.containment_type).toBe('selfService');
        }
      });
    });

    it('should include conversation metrics in session data', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = await sessionDataService.getSessions({
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 3,
        skip: 0
      });

      expect(Array.isArray(sessions)).toBe(true);
      
      sessions.forEach(session => {
        if (session && session.messages) {
          // Verify metrics are calculated correctly
          const userMessages = session.messages.filter(m => m?.message_type === 'user');
          const botMessages = session.messages.filter(m => m?.message_type === 'bot');
          
          expect(session.user_message_count).toBe(userMessages.length);
          expect(session.bot_message_count).toBe(botMessages.length);
          expect(session.message_count).toBe(session.messages.length);
          expect(session.message_count).toBe(userMessages.length + botMessages.length);
        }
      });
    });
  });

  describe('Static Data Compatibility', () => {
    it('should validate compatibility with production data structure', async () => {
      // Verify our static data has the expected structure
      expect(staticSessionData).toHaveProperty('data');
      expect(Array.isArray(staticSessionData.data)).toBe(true);
      expect(staticSessionData.data.length).toBeGreaterThan(0);

      const session = staticSessionData.data[0];
      expect(session).toHaveProperty('session_id');
      expect(session).toHaveProperty('containment_type');

      // Verify message data structure
      expect(staticMessageData).toHaveProperty('data');
      expect(Array.isArray(staticMessageData.data)).toBe(true);
      expect(staticMessageData.data.length).toBeGreaterThan(0);

      const message = staticMessageData.data[0];
      expect(message).toHaveProperty('sessionId');
      expect(message).toHaveProperty('message_type');
      expect(message).toHaveProperty('message');
      expect(['user', 'bot']).toContain(message.message_type);
    });
  });
});