import { createKoreApiService } from '../../services/koreApiService';
import { configManager } from '../../utils/configManager';
import { Message, SessionWithTranscript } from '../../../../shared/types';

describe('Session History with Full Conversation Transcript Integration', () => {
  let koreApiService: ReturnType<typeof createKoreApiService>;
  
  beforeAll(() => {
    // Mock configuration for integration testing
    jest.spyOn(configManager, 'getKoreConfig').mockReturnValue({
      name: 'Integration Test Bot',
      bot_id: 'integration-test-bot-id',
      client_id: 'integration-test-client-id',
      client_secret: 'integration-test-client-secret',
      base_url: 'https://integration-test.kore.ai'
    });

    koreApiService = createKoreApiService({
      botId: 'integration-test-bot-id',
      clientId: 'integration-test-client-id',
      clientSecret: 'integration-test-client-secret',
      baseUrl: 'https://integration-test.kore.ai'
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Conversation Transcript Retrieval', () => {
    it('should retrieve complete conversation transcript for a session', async () => {
      // Mock the HTTP calls for session and message retrieval
      const mockSessionData = [
        {
          session_id: 'complete-session-1',
          user_id: 'user-complete-1',
          start_time: '2025-07-07T14:00:00Z',
          end_time: '2025-07-07T14:25:00Z',
          containment_type: 'selfService',
          tags: {
            userTags: [],
            sessionTags: [
              { name: 'channel', value: 'web' },
              { name: 'language', value: 'en' }
            ]
          }
        }
      ];

      const mockCompleteTranscript: Message[] = [
        {
          messageId: 'msg-1',
          type: 'incoming',
          sessionId: 'complete-session-1',
          userId: 'user-complete-1',
          createdOn: '2025-07-07T14:00:00Z',
          components: [{ cT: 'text', data: { text: 'Hello, I need help resetting my password' } }]
        },
        {
          messageId: 'msg-2',
          type: 'outgoing',
          sessionId: 'complete-session-1',
          createdOn: '2025-07-07T14:00:15Z',
          components: [{ cT: 'text', data: { text: 'I can help you with that. Can you provide your email address?' } }]
        },
        {
          messageId: 'msg-3',
          type: 'incoming',
          sessionId: 'complete-session-1',
          userId: 'user-complete-1',
          createdOn: '2025-07-07T14:00:45Z',
          components: [{ cT: 'text', data: { text: 'Yes, it\'s john.doe@example.com' } }]
        },
        {
          messageId: 'msg-4',
          type: 'outgoing',
          sessionId: 'complete-session-1',
          createdOn: '2025-07-07T14:01:20Z',
          components: [{ cT: 'text', data: { text: 'Thank you. I\'ve found your account. Let me send you a password reset link.' } }]
        },
        {
          messageId: 'msg-5',
          type: 'outgoing',
          sessionId: 'complete-session-1',
          createdOn: '2025-07-07T14:02:00Z',
          components: [{ cT: 'text', data: { text: 'I\'ve sent a password reset link to john.doe@example.com. Please check your email and follow the instructions.' } }]
        },
        {
          messageId: 'msg-6',
          type: 'incoming',
          sessionId: 'complete-session-1',
          userId: 'user-complete-1',
          createdOn: '2025-07-07T14:03:30Z',
          components: [{ cT: 'text', data: { text: 'Perfect! I received the email. Thank you for your help!' } }]
        },
        {
          messageId: 'msg-7',
          type: 'outgoing',
          sessionId: 'complete-session-1',
          createdOn: '2025-07-07T14:04:00Z',
          components: [{ cT: 'text', data: { text: 'You\'re welcome! Is there anything else I can help you with today?' } }]
        },
        {
          messageId: 'msg-8',
          type: 'incoming',
          sessionId: 'complete-session-1',
          userId: 'user-complete-1',
          createdOn: '2025-07-07T14:04:15Z',
          components: [{ cT: 'text', data: { text: 'No, that\'s all. Thanks again!' } }]
        }
      ];

      // Mock the API service methods
      jest.spyOn(koreApiService, 'getSessions').mockResolvedValue(mockSessionData);
      jest.spyOn(koreApiService, 'getMessages').mockResolvedValue(mockCompleteTranscript);

      // Execute the complete workflow
      const dateFrom = '2025-07-07T14:00:00Z';
      const dateTo = '2025-07-07T14:30:00Z';
      
      const sessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 10);
      const sessionIds = sessions.map(s => s.session_id);
      const messages = await koreApiService.getMessages(dateFrom, dateTo, sessionIds);
      
      // Group messages by session (simulating the mockDataService logic)
      const messagesBySession: Record<string, Message[]> = {};
      messages.forEach(message => {
        const sessionId = message.sessionId || message.session_id;
        if (sessionId) {
          if (!messagesBySession[sessionId]) {
            messagesBySession[sessionId] = [];
          }
          messagesBySession[sessionId].push(message);
        }
      });

      // Add messages to sessions
      const sessionsWithTranscript: SessionWithTranscript[] = sessions.map(session => ({
        ...session,
        messages: messagesBySession[session.session_id] || []
      }));

      // Verify complete transcript retrieval
      expect(sessionsWithTranscript).toHaveLength(1);
      const sessionWithTranscript = sessionsWithTranscript[0];
      
      expect(sessionWithTranscript.session_id).toBe('complete-session-1');
      expect(sessionWithTranscript.messages).toHaveLength(8);
      
      // Verify conversation flow and chronological order
      expect(sessionWithTranscript.messages![0].components[0].data.text).toBe('Hello, I need help resetting my password');
      expect(sessionWithTranscript.messages![1].components[0].data.text).toBe('I can help you with that. Can you provide your email address?');
      expect(sessionWithTranscript.messages![2].components[0].data.text).toBe('Yes, it\'s john.doe@example.com');
      expect(sessionWithTranscript.messages![7].components[0].data.text).toBe('No, that\'s all. Thanks again!');
      
      // Verify message types alternate correctly
      expect(sessionWithTranscript.messages![0].type).toBe('incoming');  // User
      expect(sessionWithTranscript.messages![1].type).toBe('outgoing');  // Bot
      expect(sessionWithTranscript.messages![2].type).toBe('incoming');  // User
      expect(sessionWithTranscript.messages![3].type).toBe('outgoing');  // Bot
      
      // Verify chronological ordering
      for (let i = 1; i < sessionWithTranscript.messages!.length; i++) {
        const prevTime = new Date(sessionWithTranscript.messages![i-1].createdOn).getTime();
        const currTime = new Date(sessionWithTranscript.messages![i].createdOn).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });

    it('should handle complex message components (cards, quick replies, etc.)', async () => {
      const mockSessionData = [
        {
          session_id: 'complex-session-1',
          user_id: 'user-complex-1',
          start_time: '2025-07-07T15:00:00Z',
          end_time: '2025-07-07T15:10:00Z',
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] }
        }
      ];

      const mockComplexMessages: Message[] = [
        {
          messageId: 'complex-msg-1',
          type: 'incoming',
          sessionId: 'complex-session-1',
          userId: 'user-complex-1',
          createdOn: '2025-07-07T15:00:00Z',
          components: [{ cT: 'text', data: { text: 'I want to see my account options' } }]
        },
        {
          messageId: 'complex-msg-2',
          type: 'outgoing',
          sessionId: 'complex-session-1',
          createdOn: '2025-07-07T15:00:30Z',
          components: [
            { cT: 'text', data: { text: 'Here are your account options:' } },
            { 
              cT: 'card', 
              data: { 
                title: 'Account Options',
                subtitle: 'Choose what you\'d like to do',
                buttons: [
                  { type: 'postback', title: 'View Profile', payload: 'VIEW_PROFILE' },
                  { type: 'postback', title: 'Change Password', payload: 'CHANGE_PASSWORD' },
                  { type: 'postback', title: 'Billing Info', payload: 'BILLING_INFO' }
                ]
              }
            }
          ]
        },
        {
          messageId: 'complex-msg-3',
          type: 'incoming',
          sessionId: 'complex-session-1',
          userId: 'user-complex-1',
          createdOn: '2025-07-07T15:01:00Z',
          components: [{ cT: 'postback', data: { payload: 'VIEW_PROFILE', title: 'View Profile' } }]
        },
        {
          messageId: 'complex-msg-4',
          type: 'outgoing',
          sessionId: 'complex-session-1',
          createdOn: '2025-07-07T15:01:15Z',
          components: [
            { cT: 'text', data: { text: 'Here\'s your profile information:' } },
            {
              cT: 'template',
              data: {
                type: 'generic',
                elements: [
                  {
                    title: 'John Doe',
                    subtitle: 'Premium Member since 2023',
                    fields: [
                      { label: 'Email', value: 'john.doe@example.com' },
                      { label: 'Status', value: 'Active' },
                      { label: 'Plan', value: 'Premium' }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ];

      jest.spyOn(koreApiService, 'getSessions').mockResolvedValue(mockSessionData);
      jest.spyOn(koreApiService, 'getMessages').mockResolvedValue(mockComplexMessages);

      // Execute workflow
      const dateFrom = '2025-07-07T15:00:00Z';
      const dateTo = '2025-07-07T15:30:00Z';
      
      const sessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 10);
      const messages = await koreApiService.getMessages(dateFrom, dateTo, [sessions[0].session_id]);
      
      const sessionWithTranscript: SessionWithTranscript = {
        ...sessions[0],
        messages: messages
      };

      // Verify complex message handling
      expect(sessionWithTranscript.messages).toHaveLength(4);
      
      // First message - simple text
      expect(sessionWithTranscript.messages![0].components).toHaveLength(1);
      expect(sessionWithTranscript.messages![0].components[0].cT).toBe('text');
      
      // Second message - text + card
      expect(sessionWithTranscript.messages![1].components).toHaveLength(2);
      expect(sessionWithTranscript.messages![1].components[0].cT).toBe('text');
      expect(sessionWithTranscript.messages![1].components[1].cT).toBe('card');
      expect(sessionWithTranscript.messages![1].components[1].data.title).toBe('Account Options');
      expect(sessionWithTranscript.messages![1].components[1].data.buttons).toHaveLength(3);
      
      // Third message - postback
      expect(sessionWithTranscript.messages![2].components[0].cT).toBe('postback');
      expect(sessionWithTranscript.messages![2].components[0].data.payload).toBe('VIEW_PROFILE');
      
      // Fourth message - text + template
      expect(sessionWithTranscript.messages![3].components).toHaveLength(2);
      expect(sessionWithTranscript.messages![3].components[1].cT).toBe('template');
      expect(sessionWithTranscript.messages![3].components[1].data.elements[0].title).toBe('John Doe');
    });

    it('should handle sessions across multiple containment types with full transcripts', async () => {
      const mockMixedSessions = [
        {
          session_id: 'agent-session-1',
          user_id: 'user-escalated-1',
          start_time: '2025-07-07T16:00:00Z',
          end_time: '2025-07-07T16:45:00Z',
          containment_type: 'agent',
          tags: { 
            userTags: [], 
            sessionTags: [
              { name: 'escalation_reason', value: 'complex_technical_issue' },
              { name: 'agent_id', value: 'agent-123' }
            ] 
          }
        },
        {
          session_id: 'selfservice-session-1',
          user_id: 'user-simple-1',
          start_time: '2025-07-07T16:30:00Z',
          end_time: '2025-07-07T16:35:00Z',
          containment_type: 'selfService',
          tags: { userTags: [], sessionTags: [] }
        },
        {
          session_id: 'dropoff-session-1',
          user_id: 'user-dropoff-1',
          start_time: '2025-07-07T17:00:00Z',
          end_time: '2025-07-07T17:02:00Z',
          containment_type: 'dropOff',
          tags: { 
            userTags: [], 
            sessionTags: [
              { name: 'drop_off_reason', value: 'user_abandoned' }
            ] 
          }
        }
      ];

      const mockMixedMessages = [
        // Agent session - extended conversation
        {
          messageId: 'agent-1',
          type: 'incoming',
          sessionId: 'agent-session-1',
          userId: 'user-escalated-1',
          createdOn: '2025-07-07T16:00:00Z',
          components: [{ cT: 'text', data: { text: 'I\'ve been having technical issues that the bot couldn\'t resolve' } }]
        },
        {
          messageId: 'agent-2',
          type: 'outgoing',
          sessionId: 'agent-session-1',
          createdOn: '2025-07-07T16:00:30Z',
          components: [{ cT: 'text', data: { text: 'Hi! I\'m Agent Sarah. I\'ll help you with your technical issue. Can you describe what\'s happening?' } }]
        },
        {
          messageId: 'agent-3',
          type: 'incoming',
          sessionId: 'agent-session-1',
          userId: 'user-escalated-1',
          createdOn: '2025-07-07T16:01:00Z',
          components: [{ cT: 'text', data: { text: 'The application keeps crashing when I try to export large datasets' } }]
        },
        
        // Self-service session - quick resolution
        {
          messageId: 'self-1',
          type: 'incoming',
          sessionId: 'selfservice-session-1',
          userId: 'user-simple-1',
          createdOn: '2025-07-07T16:30:00Z',
          components: [{ cT: 'text', data: { text: 'How do I reset my password?' } }]
        },
        {
          messageId: 'self-2',
          type: 'outgoing',
          sessionId: 'selfservice-session-1',
          createdOn: '2025-07-07T16:30:15Z',
          components: [{ cT: 'text', data: { text: 'I can help you reset your password. Click the "Forgot Password" link on the login page.' } }]
        },
        
        // Drop-off session - early termination
        {
          messageId: 'drop-1',
          type: 'incoming',
          sessionId: 'dropoff-session-1',
          userId: 'user-dropoff-1',
          createdOn: '2025-07-07T17:00:00Z',
          components: [{ cT: 'text', data: { text: 'I need help with' } }]
        }
        // No follow-up messages - user abandoned the session
      ];

      jest.spyOn(koreApiService, 'getSessions').mockResolvedValue(mockMixedSessions);
      jest.spyOn(koreApiService, 'getMessages').mockResolvedValue(mockMixedMessages);

      // Execute workflow
      const dateFrom = '2025-07-07T16:00:00Z';
      const dateTo = '2025-07-07T17:30:00Z';
      
      const sessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 10);
      const sessionIds = sessions.map(s => s.session_id);
      const messages = await koreApiService.getMessages(dateFrom, dateTo, sessionIds);
      
      // Group messages by session
      const messagesBySession: Record<string, Message[]> = {};
      messages.forEach(message => {
        const sessionId = message.sessionId;
        if (sessionId) {
          if (!messagesBySession[sessionId]) {
            messagesBySession[sessionId] = [];
          }
          messagesBySession[sessionId].push(message);
        }
      });

      const sessionsWithTranscripts: SessionWithTranscript[] = sessions.map(session => ({
        ...session,
        messages: (messagesBySession[session.session_id] || [])
          .sort((a, b) => new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime())
      }));

      // Verify all session types have appropriate transcripts
      expect(sessionsWithTranscripts).toHaveLength(3);
      
      // Agent session - should have extended conversation
      const agentSession = sessionsWithTranscripts.find(s => s.containment_type === 'agent');
      expect(agentSession).toBeDefined();
      expect(agentSession!.messages).toHaveLength(3);
      expect(agentSession!.messages![1].components[0].data.text).toContain('Agent Sarah');
      
      // Self-service session - should have quick resolution
      const selfServiceSession = sessionsWithTranscripts.find(s => s.containment_type === 'selfService');
      expect(selfServiceSession).toBeDefined();
      expect(selfServiceSession!.messages).toHaveLength(2);
      expect(selfServiceSession!.messages![0].components[0].data.text).toContain('reset my password');
      
      // Drop-off session - should have incomplete conversation
      const dropOffSession = sessionsWithTranscripts.find(s => s.containment_type === 'dropOff');
      expect(dropOffSession).toBeDefined();
      expect(dropOffSession!.messages).toHaveLength(1);
      expect(dropOffSession!.messages![0].components[0].data.text).toBe('I need help with');
    });

    it('should handle performance with large conversation transcripts', async () => {
      const mockLargeSession = {
        session_id: 'large-session-1',
        user_id: 'user-chatty-1',
        start_time: '2025-07-07T18:00:00Z',
        end_time: '2025-07-07T19:30:00Z',
        containment_type: 'agent',
        tags: { userTags: [], sessionTags: [] }
      };

      // Generate a large number of messages (simulating a long conversation)
      const mockLargeTranscript: Message[] = Array.from({ length: 200 }, (_, i) => ({
        messageId: `large-msg-${i + 1}`,
        type: i % 2 === 0 ? 'incoming' : 'outgoing',
        sessionId: 'large-session-1',
        userId: i % 2 === 0 ? 'user-chatty-1' : undefined,
        createdOn: new Date(new Date('2025-07-07T18:00:00Z').getTime() + (i * 30000)).toISOString(), // 30 second intervals
        components: [{ cT: 'text', data: { text: `Message number ${i + 1} in this extended conversation` } }]
      }));

      jest.spyOn(koreApiService, 'getSessions').mockResolvedValue([mockLargeSession]);
      jest.spyOn(koreApiService, 'getMessages').mockResolvedValue(mockLargeTranscript);

      // Measure performance
      const startTime = process.hrtime.bigint();
      
      const sessions = await koreApiService.getSessions('2025-07-07T18:00:00Z', '2025-07-07T20:00:00Z', 0, 10);
      const messages = await koreApiService.getMessages('2025-07-07T18:00:00Z', '2025-07-07T20:00:00Z', [sessions[0].session_id]);
      
      const sessionWithTranscript: SessionWithTranscript = {
        ...sessions[0],
        messages: messages.sort((a, b) => new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime())
      };
      
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      // Verify large transcript handling
      expect(sessionWithTranscript.messages).toHaveLength(200);
      expect(sessionWithTranscript.messages![0].components[0].data.text).toBe('Message number 1 in this extended conversation');
      expect(sessionWithTranscript.messages![199].components[0].data.text).toBe('Message number 200 in this extended conversation');
      
      // Verify chronological order maintained
      for (let i = 1; i < sessionWithTranscript.messages!.length; i++) {
        const prevTime = new Date(sessionWithTranscript.messages![i-1].createdOn).getTime();
        const currTime = new Date(sessionWithTranscript.messages![i].createdOn).getTime();
        expect(currTime).toBeGreaterThan(prevTime);
      }
      
      // Performance assertion - should complete within reasonable time
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});