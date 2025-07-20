import { jest } from '@jest/globals';
import { generateMockSessions } from '../../services/mockDataService';
import { SessionFilters } from '../../../../shared/types';

describe('Session and Conversation History Retrieval', () => {
  describe('Session History Retrieval', () => {
    it('should retrieve session history with full conversation transcripts', async () => {
      const filters: SessionFilters = {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      };
      
      const sessions = generateMockSessions(filters);

      expect(sessions).toBeInstanceOf(Array);
      expect(sessions.length).toBeGreaterThan(0);
      
      // Verify session structure
      const session = sessions[0];
      expect(session).toBeDefined();
      expect(session).toHaveProperty('session_id');
      expect(session).toHaveProperty('user_id');
      expect(session).toHaveProperty('start_time');
      expect(session).toHaveProperty('end_time');
      expect(session).toHaveProperty('containment_type');
      expect(session).toHaveProperty('messages');
      expect(session).toHaveProperty('message_count');
      expect(session).toHaveProperty('duration_seconds');
      
      // Verify session has conversation history
      expect(session!.messages).toBeInstanceOf(Array);
      expect(session!.messages.length).toBeGreaterThan(0);
      expect(session!.message_count).toBeGreaterThan(0);
    });

    it('should filter sessions by containment type', async () => {
      const filters: SessionFilters = {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString(),
        containment_type: 'agent'
      };
      
      const sessions = generateMockSessions(filters);

      expect(sessions).toBeInstanceOf(Array);
      sessions.forEach(session => {
        expect(session.containment_type).toBe('agent');
        expect(session.messages).toBeInstanceOf(Array);
        expect(session.message_count).toBeGreaterThan(0);
      });
    });

    it('should apply date range filters to session history', async () => {
      const filters: SessionFilters = {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      };
      
      const sessions = generateMockSessions(filters);

      expect(sessions).toBeInstanceOf(Array);
      sessions.forEach(session => {
        const startTime = new Date(session.start_time);
        const filterStart = new Date(filters.start_date);
        const filterEnd = new Date(filters.end_date);

        expect(startTime.getTime()).toBeGreaterThanOrEqual(filterStart.getTime());
        expect(startTime.getTime()).toBeLessThanOrEqual(filterEnd.getTime());
        
        // Verify each session has conversation history
        expect(session.messages).toBeInstanceOf(Array);
        expect(session.message_count).toBeGreaterThan(0);
      });
    });
  });

  describe('Conversation History Retrieval', () => {
    it('should include full conversation transcripts in sessions', async () => {
      const filters: SessionFilters = {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      };
      
      const sessions = generateMockSessions(filters);

      sessions.forEach(session => {
        // Verify conversation structure
        expect(session.messages).toBeInstanceOf(Array);
        expect(session.messages.length).toBeGreaterThan(0);
        
        // Verify message structure
        session.messages.forEach(message => {
          expect(message).toHaveProperty('timestamp');
          expect(message).toHaveProperty('message_type');
          expect(message).toHaveProperty('message');
          expect(['user', 'bot']).toContain(message.message_type);
          expect(typeof message.message).toBe('string');
          expect(message.message.length).toBeGreaterThan(0);
        });
        
        // Verify conversation flow (alternating user/bot messages)
        for (let i = 0; i < session.messages.length - 1; i++) {
          const current = session.messages[i];
          const next = session.messages[i + 1];
          if (current && next) {
            expect(current.message_type).not.toBe(next.message_type);
          }
        }
      });
    });

    it('should include conversation metrics in session data', async () => {
      const filters: SessionFilters = {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      };
      
      const sessions = generateMockSessions(filters);

      sessions.forEach(session => {
        // Verify metrics are calculated correctly
        const userMessages = session.messages.filter(m => m.message_type === 'user');
        const botMessages = session.messages.filter(m => m.message_type === 'bot');
        
        expect(session.message_count).toBe(session.messages.length);
        expect(session.user_message_count).toBe(userMessages.length);
        expect(session.bot_message_count).toBe(botMessages.length);
        expect(session.metrics.total_messages).toBe(session.messages.length);
        expect(session.metrics.user_messages).toBe(userMessages.length);
        expect(session.metrics.bot_messages).toBe(botMessages.length);
      });
    });

    it('should handle different conversation templates with various intents', async () => {
      const filters: SessionFilters = {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      };
      
      const sessions = generateMockSessions(filters);

      // Verify different conversation types
      const intents = sessions.map(s => s.tags[0]).filter(Boolean);
      expect(intents.length).toBeGreaterThan(0);
      
      // Should have different conversation patterns
      const uniqueIntents = [...new Set(intents)];
      expect(uniqueIntents.length).toBeGreaterThan(1);
      
      sessions.forEach(session => {
        expect(session.messages.length).toBeGreaterThan(0);
        expect(session.duration_seconds).toBeGreaterThan(0);
      });
    });
  });

  describe('Pagination and Performance', () => {
    it('should handle pagination for large session datasets', async () => {
      const filters: SessionFilters = {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString(),
        skip: 10,
        limit: 5
      };
      
      const sessions = generateMockSessions(filters);

      expect(sessions.length).toBeLessThanOrEqual(5);
      sessions.forEach(session => {
        expect(session.messages).toBeInstanceOf(Array);
        expect(session.message_count).toBeGreaterThan(0);
      });
    });

    it('should maintain conversation history integrity across pagination', async () => {
      const filters: SessionFilters = {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString(),
        limit: 3
      };
      
      const sessions = generateMockSessions(filters);

      expect(sessions.length).toBeLessThanOrEqual(3);
      sessions.forEach(session => {
        // Each session should have complete conversation history
        expect(session.messages.length).toBe(session.message_count);
        expect(session.messages.length).toBeGreaterThan(0);
        
        // Verify conversation flow
        for (let i = 0; i < session.messages.length - 1; i++) {
          const current = session.messages[i];
          const next = session.messages[i + 1];
          if (current && next) {
            expect(current.message_type).not.toBe(next.message_type);
          }
        }
      });
    });
  });

  describe('Real-world Session Data Structure', () => {
    it('should demonstrate complete session with conversation history', async () => {
      const filters: SessionFilters = {
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString(),
        limit: 1
      };
      
      const sessions = generateMockSessions(filters);
      const session = sessions[0];

      expect(session).toBeDefined();

      // Demonstrate the complete session structure
      console.log('Session ID:', session!.session_id);
      console.log('User ID:', session!.user_id);
      console.log('Start Time:', session!.start_time);
      console.log('End Time:', session!.end_time);
      console.log('Duration (seconds):', session!.duration_seconds);
      console.log('Containment Type:', session!.containment_type);
      console.log('Total Messages:', session!.message_count);
      console.log('User Messages:', session!.user_message_count);
      console.log('Bot Messages:', session!.bot_message_count);
      console.log('Tags:', session!.tags);
      
      // Demonstrate conversation history
      console.log('\nConversation History:');
      session!.messages.forEach((message, index) => {
        console.log(`${index + 1}. [${message.timestamp}] ${message.message_type.toUpperCase()}: ${message.message}`);
      });

      // Verify the session contains all required conversation data
      expect(session!.session_id).toBeTruthy();
      expect(session!.user_id).toBeTruthy();
      expect(session!.start_time).toBeTruthy();
      expect(session!.end_time).toBeTruthy();
      expect(session!.duration_seconds).toBeGreaterThan(0);
      expect(session!.message_count).toBeGreaterThan(0);
      expect(session!.messages.length).toBeGreaterThan(0);
      expect(session!.messages.length).toBe(session!.message_count);
    });
  });
}); 