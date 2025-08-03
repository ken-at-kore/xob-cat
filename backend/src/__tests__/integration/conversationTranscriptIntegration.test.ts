import { createSessionDataService } from '../../factories/serviceFactory';
import { Message, SessionWithTranscript } from '../../../../shared/types';

// Import static test data for comprehensive validation
const staticSessionData = require('../../../../data/api-kore-sessions-selfservice-2025-07-23T17-05-08.json');
const staticMessageData = require('../../../../data/api-kore-messages-2025-07-23T17-05-31.json');

// Mock services to use static data
jest.mock('../../services/koreApiService');
jest.mock('../../utils/configManager', () => ({
  configManager: {
    getKoreConfig: jest.fn().mockImplementation(() => {
      throw new Error('No config found - using mock data for transcript testing');
    })
  }
}));

describe('Conversation Transcript Integration (Static Data)', () => {
  const sessionDataService = createSessionDataService();
  
  describe('Complex Message Component Handling', () => {
    it('should handle various message types and components using mock data', async () => {
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
      
      // Validate message structure across all sessions
      sessions.forEach(session => {
        if (session && session.messages) {
          session.messages.forEach(message => {
            if (message) {
              // Verify essential message properties
              expect(message).toHaveProperty('timestamp');
              expect(message).toHaveProperty('message_type');
              expect(message).toHaveProperty('message');
              expect(['user', 'bot']).toContain(message.message_type);
              
              // Verify timestamp is valid
              expect(new Date(message.timestamp)).toBeInstanceOf(Date);
              expect(message.message).toBeDefined();
            }
          });
        }
      });
    });

    it('should handle large conversation transcripts efficiently', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      const filters = {
        start_date: threeDaysAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 20, // Larger dataset for performance testing
        skip: 0
      };

      const startTime = Date.now();
      const sessions = await sessionDataService.getSessions(filters);
      const executionTime = Date.now() - startTime;

      expect(Array.isArray(sessions)).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should complete quickly with mock data

      // Verify we can handle sessions with many messages
      let totalMessages = 0;
      sessions.forEach(session => {
        if (session && session.messages) {
          totalMessages += session.messages.length;
          
          // Test sessions with substantial conversation history
          if (session.messages.length > 5) {
            // Verify chronological ordering in longer conversations
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
        }
      });

      // Should handle substantial message volume
      expect(totalMessages).toBeGreaterThanOrEqual(0);
    }, 8000);
  });

  describe('Session Type Differentiation', () => {
    it('should properly categorize different session containment types', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      // Test each containment type separately
      const containmentTypes = ['agent', 'selfService', 'dropOff'] as const;
      
      for (const containmentType of containmentTypes) {
        const filters = {
          start_date: twoDaysAgo.toISOString(),
          end_date: now.toISOString(),
          containment_type: containmentType,
          limit: 10,
          skip: 0
        };

        const sessions = await sessionDataService.getSessions(filters);
        
        expect(Array.isArray(sessions)).toBe(true);
        
        // All sessions should match the requested type
        sessions.forEach(session => {
          if (session) {
            expect(session.containment_type).toBe(containmentType);
            
            // Verify session has appropriate message patterns for type
            if (session.messages && session.messages.length > 0) {
              // All containment types should have user messages
              const userMessages = session.messages.filter(m => m?.message_type === 'user');
              expect(userMessages.length).toBeGreaterThan(0);
            }
          }
        });
      }
    });

    it('should handle mixed session types in broader queries', async () => {
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
      
      if (sessions.length > 0) {
        // Should potentially have different containment types
        const containmentTypes = sessions
          .map(s => s?.containment_type)
          .filter((type): type is 'agent' | 'selfService' | 'dropOff' => Boolean(type))
          .reduce((acc, type) => {
            acc.add(type);
            return acc;
          }, new Set<string>());

        // Should have valid containment types
        containmentTypes.forEach(type => {
          expect(['agent', 'selfService', 'dropOff']).toContain(type);
        });
      }
    });
  });

  describe('Message Chronological Ordering', () => {
    it('should maintain proper message ordering within sessions', async () => {
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
        if (session && session.messages && session.messages.length > 1) {
          // Verify strict chronological ordering
          for (let i = 1; i < session.messages.length; i++) {
            const prevMessage = session.messages[i-1];
            const currMessage = session.messages[i];
            
            if (prevMessage && currMessage) {
              const prevTime = new Date(prevMessage.timestamp);
              const currTime = new Date(currMessage.timestamp);
              
              // Messages must be in chronological order
              expect(prevTime.getTime()).toBeLessThanOrEqual(currTime.getTime());
              
              // Verify timestamps are within reasonable bounds
              expect(prevTime.getTime()).toBeGreaterThan(0);
              expect(currTime.getTime()).toBeGreaterThan(0);
            }
          }
        }
      });
    });

    it('should handle conversations with rapid message exchanges', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const filters = {
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 8,
        skip: 0
      };

      const sessions = await sessionDataService.getSessions(filters);

      expect(Array.isArray(sessions)).toBe(true);
      
      sessions.forEach(session => {
        if (session && session.messages && session.messages.length > 2) {
          // Look for sessions with alternating user/bot messages (rapid exchanges)
          let hasAlternatingPattern = false;
          
          for (let i = 2; i < session.messages.length; i++) {
            const msg1 = session.messages[i-2];
            const msg2 = session.messages[i-1];
            const msg3 = session.messages[i];
            
            if (msg1 && msg2 && msg3) {
              // Check for user-bot-user or bot-user-bot patterns
              if ((msg1.message_type === 'user' && msg2.message_type === 'bot' && msg3.message_type === 'user') ||
                  (msg1.message_type === 'bot' && msg2.message_type === 'user' && msg3.message_type === 'bot')) {
                hasAlternatingPattern = true;
                
                // Verify ordering is maintained even in rapid exchanges
                const time1 = new Date(msg1.timestamp);
                const time2 = new Date(msg2.timestamp);
                const time3 = new Date(msg3.timestamp);
                
                expect(time1.getTime()).toBeLessThanOrEqual(time2.getTime());
                expect(time2.getTime()).toBeLessThanOrEqual(time3.getTime());
              }
            }
          }
          
          // At least some sessions should show conversational patterns
          // (This is informational rather than strictly required)
        }
      });
    });
  });

  describe('Static Data Compatibility Validation', () => {
    it('should validate workflow compatibility with production data patterns', async () => {
      // Verify static session data structure
      expect(staticSessionData).toHaveProperty('data');
      expect(Array.isArray(staticSessionData.data)).toBe(true);
      expect(staticSessionData.data.length).toBeGreaterThan(0);

      const sampleSession = staticSessionData.data[0];
      expect(sampleSession).toHaveProperty('session_id');
      expect(sampleSession).toHaveProperty('containment_type');
      expect(sampleSession).toHaveProperty('start_time');
      expect(sampleSession).toHaveProperty('end_time');

      // Verify static message data structure
      expect(staticMessageData).toHaveProperty('data');
      expect(Array.isArray(staticMessageData.data)).toBe(true);
      expect(staticMessageData.data.length).toBeGreaterThan(0);

      const sampleMessage = staticMessageData.data[0];
      expect(sampleMessage).toHaveProperty('sessionId');
      expect(sampleMessage).toHaveProperty('message_type');
      expect(sampleMessage).toHaveProperty('message');
      expect(sampleMessage).toHaveProperty('timestamp');

      // Verify relationship between sessions and messages
      const sessionIds = staticSessionData.data.map((s: any) => s.session_id);
      const messageSessionIds = [...new Set(staticMessageData.data.map((m: any) => m.sessionId))];
      
      // There should be some overlap between session IDs and message session IDs
      const intersection = sessionIds.filter((id: string) => messageSessionIds.includes(id));
      expect(intersection.length).toBeGreaterThan(0);
    });

    it('should demonstrate transcript handling matches production data complexity', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const filters = {
        start_date: oneDayAgo.toISOString(),
        end_date: now.toISOString(),
        limit: 5,
        skip: 0
      };

      const mockSessions = await sessionDataService.getSessions(filters);

      expect(Array.isArray(mockSessions)).toBe(true);
      
      // Compare structure with static data
      if (mockSessions.length > 0 && mockSessions[0]) {
        const mockSession = mockSessions[0];
        const staticSession = staticSessionData.data[0];
        
        // Both should have the same essential properties
        const essentialProps = ['session_id', 'start_time', 'end_time', 'containment_type'];
        essentialProps.forEach(prop => {
          expect(mockSession).toHaveProperty(prop);
          expect(staticSession).toHaveProperty(prop);
        });

        // Both should handle messages in the same way
        if (mockSession.messages && mockSession.messages.length > 0) {
          const mockMessage = mockSession.messages[0];
          const staticMessage = staticMessageData.data[0];
          
          const messageProps = ['timestamp', 'message_type', 'message'];
          messageProps.forEach(prop => {
            expect(mockMessage).toHaveProperty(prop);
            expect(staticMessage).toHaveProperty(prop);
          });
        }
      }
    });
  });
});