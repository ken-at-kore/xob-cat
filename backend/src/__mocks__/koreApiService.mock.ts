import { SessionWithTranscript } from '../../../shared/types';
import { IKoreApiService } from '../interfaces';
import { SessionMetadata, KoreMessage } from '../services/koreApiService';
import { TranscriptSanitizationService } from '../services/transcriptSanitizationService';

export class MockKoreApiService implements IKoreApiService {
  private mockSessions: SessionWithTranscript[] = [
    {
      session_id: 'mock_session_1',
      user_id: 'mock_user_1',
      start_time: '2025-08-02T16:15:00.000Z',
      end_time: '2025-08-02T16:30:00.000Z',
      containment_type: 'selfService',
      tags: ['Claim Status', 'Contained', 'Sanitization Test'],
      metrics: {
        total_messages: 6,
        user_messages: 3,
        bot_messages: 3
      },
      messages: [
        {
          timestamp: '2025-08-02T16:00:00.000Z',
          message_type: 'user',
          message: 'Welcome Task'  // Should be filtered out by sanitization
        },
        {
          timestamp: '2025-08-02T16:00:30.000Z',
          message_type: 'bot',
          message: '{"type":"command","command":"redirect","queueCommand":false,"data":[{"verb":"config","synthesizer":{"vendor":"microsoft","voice":"en-US-AvaMultilingualNeural","language":"en-US"},"recognizer":{"vendor":"microsoft","language":"en-US","punctuation":false,"azureOptions":{"speechSegmentationSilenceTimeoutMs":2000}},"record":{"recordingID":"688fcb1b41b2bcbda1c50d05","siprecServerURL":["3.217.118.136:5068","3.216.241.238:5068"],"headers":{"x-audc-call-id":"688fcb1b41b2bcbda1c50d05"},"action":"startCallRecording"}},{"verb":"gather","actionHook":"/actions/hooks","input":["digits","speech"],"interDigitTimeout":2,"minDigits":1,"finishOnKey":"#","numDigits":8,"say":{"text":["Hello. You can talk to me in complete sentences about claim status, time entry, and more. So, how can I help you today?"]},"bargein":false,"listenDuringPrompt":false,"timeout":10,"dtmfBargein":false}]}'  // Should extract the say.text content
        },
        {
          timestamp: '2025-08-02T16:01:00.000Z',
          message_type: 'user',
          message: 'I need to check the status of my claim'
        },
        {
          timestamp: '2025-08-02T16:01:30.000Z',
          message_type: 'bot',
          message: '<speak>I can help you check your claim status. Please provide your claim number.</speak>'  // Should remove SSML tags
        },
        {
          timestamp: '2025-08-02T16:02:00.000Z',
          message_type: 'user',
          message: 'My claim number is 123456789'
        },
        {
          timestamp: '2025-08-02T16:02:30.000Z',
          message_type: 'bot',
          message: 'Thank you. Let me look up your claim. I found claim 123456789. The status is currently &quot;Under Review&quot; and was submitted on 2025-01-15.'  // Should decode HTML entities
        }
      ],
      duration_seconds: 900,
      message_count: 6,
      user_message_count: 3,
      bot_message_count: 3
    },
    {
      session_id: 'mock_session_2',
      user_id: 'mock_user_2',
      start_time: '2025-08-02T16:45:00.000Z',
      end_time: '2025-08-02T16:55:00.000Z',
      containment_type: 'agent',
      tags: ['Billing', 'Transfer'],
      metrics: {
        total_messages: 5,
        user_messages: 3,
        bot_messages: 2
      },
      messages: [
        {
          timestamp: '2025-08-02T16:00:00.000Z',
          message_type: 'user',
          message: 'I have a question about my bill'
        },
        {
          timestamp: '2025-08-02T16:00:30.000Z',
          message_type: 'bot',
          message: 'I can help you with billing questions. Please provide your member ID or policy number.'
        },
        {
          timestamp: '2025-08-02T16:01:00.000Z',
          message_type: 'user',
          message: 'My member ID is MEM123456'
        },
        {
          timestamp: '2025-08-02T16:01:30.000Z',
          message_type: 'bot',
          message: 'I\'m sorry, but I couldn\'t find a member with ID MEM123456. Let me transfer you to a customer service representative who can help you verify your information.'
        },
        {
          timestamp: '2025-08-02T16:02:00.000Z',
          message_type: 'user',
          message: 'Okay, thank you'
        }
      ],
      duration_seconds: 600,
      message_count: 5,
      user_message_count: 3,
      bot_message_count: 2
    },
    {
      session_id: 'mock_session_3',
      user_id: 'mock_user_3',
      start_time: '2025-08-02T17:15:00.000Z',
      end_time: '2025-08-02T17:40:00.000Z',
      containment_type: 'selfService',
      tags: ['Eligibility', 'Contained'],
      metrics: {
        total_messages: 8,
        user_messages: 4,
        bot_messages: 4
      },
      messages: [
        {
          timestamp: '2025-08-02T17:00:00.000Z',
          message_type: 'user',
          message: 'I need to check if a procedure is covered under my plan'
        },
        {
          timestamp: '2025-08-02T17:00:30.000Z',
          message_type: 'bot',
          message: 'I can help you check your coverage. Please provide your member ID and the procedure code or name.'
        },
        {
          timestamp: '2025-08-02T17:01:00.000Z',
          message_type: 'user',
          message: 'My member ID is 987654321 and I need to check coverage for an MRI'
        },
        {
          timestamp: '2025-08-02T17:01:30.000Z',
          message_type: 'bot',
          message: 'Thank you. Let me check your coverage for an MRI. Based on your plan, MRIs are covered at 80% after your deductible is met. You have a $500 deductible and have met $300 so far this year.'
        },
        {
          timestamp: '2025-08-02T17:02:00.000Z',
          message_type: 'user',
          message: 'What about physical therapy?'
        },
        {
          timestamp: '2025-08-02T17:02:30.000Z',
          message_type: 'bot',
          message: 'Physical therapy is covered at 90% after your deductible. You have 20 sessions per year available.'
        },
        {
          timestamp: '2025-08-02T17:03:00.000Z',
          message_type: 'user',
          message: 'Perfect, thank you for the information'
        },
        {
          timestamp: '2025-08-02T17:03:30.000Z',
          message_type: 'bot',
          message: 'You\'re welcome! Is there anything else I can help you with today?'
        }
      ],
      duration_seconds: 1500,
      message_count: 8,
      user_message_count: 4,
      bot_message_count: 4
    },
    // Add more sessions to ensure we have enough for testing
    {
      session_id: 'mock_session_4',
      user_id: 'mock_user_4',
      start_time: '2025-08-02T16:30:00.000Z',
      end_time: '2025-08-02T16:50:00.000Z',
      containment_type: 'selfService',
      tags: ['Password Reset', 'Contained'],
      metrics: {
        total_messages: 4,
        user_messages: 2,
        bot_messages: 2
      },
      messages: [
        {
          timestamp: '2025-08-02T16:00:00.000Z',
          message_type: 'user',
          message: 'I need to reset my password'
        },
        {
          timestamp: '2025-08-02T16:00:30.000Z',
          message_type: 'bot',
          message: 'I can help you reset your password. Please provide your email address.'
        },
        {
          timestamp: '2025-08-02T16:01:00.000Z',
          message_type: 'user',
          message: 'my.email@example.com'
        },
        {
          timestamp: '2025-08-02T16:01:30.000Z',
          message_type: 'bot',
          message: 'Password reset link sent to my.email@example.com. Please check your email.'
        }
      ],
      duration_seconds: 1200,
      message_count: 4,
      user_message_count: 2,
      bot_message_count: 2
    },
    {
      session_id: 'mock_session_5',
      user_id: 'mock_user_5',
      start_time: '2025-08-02T18:30:00.000Z',
      end_time: '2025-08-02T18:45:00.000Z',
      containment_type: 'agent',
      tags: ['Technical Support', 'Transfer'],
      metrics: {
        total_messages: 6,
        user_messages: 3,
        bot_messages: 3
      },
      messages: [
        {
          timestamp: '2025-08-02T18:00:00.000Z',
          message_type: 'user',
          message: 'My app is crashing constantly'
        },
        {
          timestamp: '2025-08-02T18:00:30.000Z',
          message_type: 'bot',
          message: 'I can help with technical issues. What device are you using?'
        },
        {
          timestamp: '2025-08-02T18:01:00.000Z',
          message_type: 'user',
          message: 'iPhone 12 with latest iOS'
        },
        {
          timestamp: '2025-08-02T18:01:30.000Z',
          message_type: 'bot',
          message: 'This requires technical diagnosis. Let me transfer you to our technical support team.'
        },
        {
          timestamp: '2025-08-02T18:02:00.000Z',
          message_type: 'user',
          message: 'Okay, thank you'
        },
        {
          timestamp: '2025-08-02T18:02:30.000Z',
          message_type: 'bot',
          message: 'Transferring you now. Please hold.'
        }
      ],
      duration_seconds: 900,
      message_count: 6,
      user_message_count: 3,
      bot_message_count: 3
    },
    {
      session_id: 'mock_session_6',
      user_id: 'mock_user_6',
      start_time: '2025-08-02T17:30:00.000Z',
      end_time: '2025-08-02T17:35:00.000Z',
      containment_type: 'selfService',
      tags: ['Account Balance', 'Contained'],
      metrics: {
        total_messages: 4,
        user_messages: 2,
        bot_messages: 2
      },
      messages: [
        {
          timestamp: '2025-08-02T16:00:00.000Z',
          message_type: 'user',
          message: 'What is my account balance?'
        },
        {
          timestamp: '2025-08-02T16:00:30.000Z',
          message_type: 'bot',
          message: 'Your current account balance is $1,250.75.'
        },
        {
          timestamp: '2025-08-02T16:01:00.000Z',
          message_type: 'user',
          message: 'Thank you'
        },
        {
          timestamp: '2025-08-02T16:01:30.000Z',
          message_type: 'bot',
          message: 'You\'re welcome! Is there anything else I can help you with?'
        }
      ],
      duration_seconds: 300,
      message_count: 4,
      user_message_count: 2,
      bot_message_count: 2
    },
    {
      session_id: 'mock_session_7',
      user_id: 'mock_user_7',
      start_time: '2025-08-02T16:00:00.000Z',
      end_time: '2025-08-02T16:12:00.000Z',
      containment_type: 'selfService',
      tags: ['Store Hours', 'Contained'],
      metrics: {
        total_messages: 4,
        user_messages: 2,
        bot_messages: 2
      },
      messages: [
        {
          timestamp: '2025-08-02T16:00:00.000Z',
          message_type: 'user',
          message: 'What are your store hours?'
        },
        {
          timestamp: '2025-08-02T16:00:30.000Z',
          message_type: 'bot',
          message: 'Our stores are open Monday-Friday 9am-8pm, Saturday 9am-6pm, Sunday 11am-5pm.'
        },
        {
          timestamp: '2025-08-02T16:01:00.000Z',
          message_type: 'user',
          message: 'Perfect, thanks!'
        },
        {
          timestamp: '2025-08-02T16:01:30.000Z',
          message_type: 'bot',
          message: 'Happy to help! Have a great day!'
        }
      ],
      duration_seconds: 720,
      message_count: 4,
      user_message_count: 2,
      bot_message_count: 2
    },
    {
      session_id: 'mock_session_8',
      user_id: 'mock_user_8',
      start_time: '2025-08-02T17:00:00.000Z',
      end_time: '2025-08-02T17:18:00.000Z',
      containment_type: 'agent',
      tags: ['Complex Inquiry', 'Transfer'],
      metrics: {
        total_messages: 8,
        user_messages: 4,
        bot_messages: 4
      },
      messages: [
        {
          timestamp: '2025-08-02T17:00:00.000Z',
          message_type: 'user',
          message: 'I have a complex billing dispute'
        },
        {
          timestamp: '2025-08-02T17:00:30.000Z',
          message_type: 'bot',
          message: 'I can help with billing questions. Can you describe the issue?'
        },
        {
          timestamp: '2025-08-02T17:01:00.000Z',
          message_type: 'user',
          message: 'I was charged twice for the same service last month'
        },
        {
          timestamp: '2025-08-02T17:01:30.000Z',
          message_type: 'bot',
          message: 'I understand your concern. Let me check your account details.'
        },
        {
          timestamp: '2025-08-02T17:02:00.000Z',
          message_type: 'user',
          message: 'I have the transaction IDs if that helps'
        },
        {
          timestamp: '2025-08-02T17:02:30.000Z',
          message_type: 'bot',
          message: 'That would be helpful. However, billing disputes require manual review. Let me transfer you to our billing specialist.'
        },
        {
          timestamp: '2025-08-02T17:03:00.000Z',
          message_type: 'user',
          message: 'Okay, I understand'
        },
        {
          timestamp: '2025-08-02T17:03:30.000Z',
          message_type: 'bot',
          message: 'Connecting you now. They will be able to resolve this for you.'
        }
      ],
      duration_seconds: 1080,
      message_count: 8,
      user_message_count: 4,
      bot_message_count: 4
    },
    {
      session_id: 'mock_session_9',
      user_id: 'mock_user_9',
      start_time: '2025-08-02T18:00:00.000Z',
      end_time: '2025-08-02T18:08:00.000Z',
      containment_type: 'selfService',
      tags: ['Product Information', 'Contained'],
      metrics: {
        total_messages: 6,
        user_messages: 3,
        bot_messages: 3
      },
      messages: [
        {
          timestamp: '2025-08-02T18:00:00.000Z',
          message_type: 'user',
          message: 'Do you have product X in stock?'
        },
        {
          timestamp: '2025-08-02T18:00:30.000Z',
          message_type: 'bot',
          message: 'Let me check our inventory for product X.'
        },
        {
          timestamp: '2025-08-02T18:01:00.000Z',
          message_type: 'user',
          message: 'Thank you'
        },
        {
          timestamp: '2025-08-02T18:01:30.000Z',
          message_type: 'bot',
          message: 'Yes, product X is available. We have 15 units in stock.'
        },
        {
          timestamp: '2025-08-02T18:02:00.000Z',
          message_type: 'user',
          message: 'Great! How much does it cost?'
        },
        {
          timestamp: '2025-08-02T18:02:30.000Z',
          message_type: 'bot',
          message: 'Product X is $49.99. Would you like to place an order?'
        }
      ],
      duration_seconds: 480,
      message_count: 6,
      user_message_count: 3,
      bot_message_count: 3
    },
    {
      session_id: 'mock_session_10',
      user_id: 'mock_user_10',
      start_time: '2025-08-02T19:00:00.000Z',
      end_time: '2025-08-02T19:05:00.000Z',
      containment_type: 'selfService',
      tags: ['Quick Question', 'Contained'],
      metrics: {
        total_messages: 4,
        user_messages: 2,
        bot_messages: 2
      },
      messages: [
        {
          timestamp: '2025-08-02T19:00:00.000Z',
          message_type: 'user',
          message: 'Do you accept credit cards?'
        },
        {
          timestamp: '2025-08-02T19:00:30.000Z',
          message_type: 'bot',
          message: '<speak>Yes, we accept all major credit cards including Visa, MasterCard, American Express, and Discover.</speak>'  // Should remove SSML tags
        },
        {
          timestamp: '2025-08-02T19:01:00.000Z',
          message_type: 'user',
          message: 'Perfect, thanks!'
        },
        {
          timestamp: '2025-08-02T19:01:30.000Z',
          message_type: 'bot',
          message: 'You\'re welcome! We&apos;re here to help with all your &quot;banking&quot; needs.'  // Should decode HTML entities
        }
      ],
      duration_seconds: 300,
      message_count: 4,
      user_message_count: 2,
      bot_message_count: 2
    }
  ];

  async getSessions(dateFrom: string, dateTo: string, skip = 0, limit = 1000): Promise<SessionWithTranscript[]> {
    console.log(`🧪 MockKoreApiService: Getting sessions from ${dateFrom} to ${dateTo}, skip=${skip}, limit=${limit}`);
    console.log(`🧪 MockKoreApiService: Available mock sessions:`, this.mockSessions.map(s => ({
      id: s.session_id,
      start_time: s.start_time,
      end_time: s.end_time 
    })));
    
    // Filter sessions by date range
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    
    console.log(`🧪 MockKoreApiService: Date range filter - start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`);
    
    const filteredSessions = this.mockSessions.filter(session => {
      const sessionDate = new Date(session.start_time);
      const isInRange = sessionDate >= startDate && sessionDate <= endDate;
      console.log(`🧪 MockKoreApiService: Session ${session.session_id} (${session.start_time}) - in range: ${isInRange}`);
      return isInRange;
    });

    // Apply pagination
    const paginatedSessions = filteredSessions.slice(skip, skip + limit);
    
    // Apply sanitization to all sessions (similar to real KoreApiService)
    const sanitizedSessions = paginatedSessions.map(session => this.applySanitizationToSession(session));
    
    console.log(`🧪 MockKoreApiService: After filtering, pagination, and sanitization - returning ${sanitizedSessions.length} sessions`);
    return sanitizedSessions;
  }

  async getMessages(dateFrom: string, dateTo: string, sessionIds: string[]): Promise<unknown[]> {
    console.log(`🧪 MockKoreApiService: Getting messages for ${sessionIds.length} sessions`);
    
    // Return messages from sessions that match the requested session IDs
    const messages: unknown[] = [];
    
    for (const sessionId of sessionIds) {
      const session = this.mockSessions.find(s => s.session_id === sessionId);
      if (session) {
        for (const message of session.messages) {
          messages.push({
            sessionId: session.session_id,
            createdBy: message.message_type === 'user' ? 'user' : 'bot',
            createdOn: message.timestamp,
            type: message.message_type === 'user' ? 'incoming' : 'outgoing',
            timestampValue: new Date(message.timestamp).getTime(),
            components: [{
              cT: 'text',
              data: {
                text: message.message
              }
            }]
          });
        }
      }
    }

    console.log(`🧪 MockKoreApiService: Returning ${messages.length} messages`);
    return messages;
  }

  async getSessionById(sessionId: string): Promise<SessionWithTranscript | null> {
    console.log(`🧪 MockKoreApiService: Getting session by ID: ${sessionId}`);
    
    const session = this.mockSessions.find(s => s.session_id === sessionId);
    if (session) {
      console.log(`🧪 MockKoreApiService: Found session ${sessionId}`);
      return session;
    }
    
    console.log(`🧪 MockKoreApiService: Session ${sessionId} not found`);
    return null;
  }

  // Helper method for testing - add more mock sessions
  addMockSession(session: SessionWithTranscript): void {
    this.mockSessions.push(session);
  }

  // Helper method for testing - clear all mock sessions
  clearMockSessions(): void {
    this.mockSessions = [];
  }

  // Helper method for testing - get all mock sessions
  getAllMockSessions(): SessionWithTranscript[] {
    return [...this.mockSessions];
  }

  async getSessionsMetadata(options: { dateFrom: string; dateTo: string; limit?: number }): Promise<SessionMetadata[]> {
    console.log(`🧪 MockKoreApiService: Getting session metadata from ${options.dateFrom} to ${options.dateTo}, limit=${options.limit || 1000}`);
    console.log(`🧪 MockKoreApiService: Available sessions for metadata:`, this.mockSessions.map(s => s.session_id + ' @ ' + s.start_time));
    
    // Filter sessions by date range
    const startDate = new Date(options.dateFrom);
    const endDate = new Date(options.dateTo);
    
    console.log(`🧪 MockKoreApiService: Metadata date filter - start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`);
    
    const filteredSessions = this.mockSessions.filter(session => {
      const sessionDate = new Date(session.start_time);
      const isInRange = sessionDate >= startDate && sessionDate <= endDate;
      console.log(`🧪 MockKoreApiService: Metadata filter - Session ${session.session_id} (${session.start_time}) - in range: ${isInRange}`);
      return isInRange;
    });

    // Apply limit
    const limitedSessions = filteredSessions.slice(0, options.limit || 1000);
    
    // Convert to SessionMetadata format
    const metadata: SessionMetadata[] = limitedSessions.map(session => ({
      sessionId: session.session_id,
      userId: session.user_id,
      start_time: session.start_time,
      end_time: session.end_time,
      containment_type: session.containment_type || 'selfService', // Ensure non-null
      tags: session.tags || [],
      metrics: { 
        total_messages: session.metrics?.total_messages || session.message_count, 
        user_messages: session.metrics?.user_messages || session.user_message_count, 
        bot_messages: session.metrics?.bot_messages || session.bot_message_count 
      },
      duration_seconds: session.duration_seconds || 0
    }));
    
    console.log(`🧪 MockKoreApiService: Returning ${metadata.length} session metadata objects`);
    return metadata;
  }

  async getMessagesForSessions(sessionIds: string[], dateRange?: { dateFrom: string; dateTo: string }): Promise<KoreMessage[]> {
    console.log(`🧪 MockKoreApiService: Getting messages for ${sessionIds.length} sessions`);
    
    const messages: KoreMessage[] = [];
    
    for (const sessionId of sessionIds) {
      const session = this.mockSessions.find(s => s.session_id === sessionId);
      if (session) {
        // Apply sanitization to this session before processing messages
        const sanitizedSession = this.applySanitizationToSession(session);
        
        for (const message of sanitizedSession.messages) {
          messages.push({
            sessionId: sanitizedSession.session_id,
            createdBy: message.message_type === 'user' ? 'user' : 'bot',
            createdOn: message.timestamp,
            type: message.message_type === 'user' ? 'incoming' : 'outgoing',
            timestampValue: new Date(message.timestamp).getTime(),
            components: [{
              cT: 'text',
              data: {
                text: message.message  // This is now the sanitized message text
              }
            }]
          });
        }
      }
    }

    console.log(`🧪 MockKoreApiService: Returning ${messages.length} sanitized KoreMessages`);
    return messages;
  }

  async getSessionMessages(sessionId: string): Promise<KoreMessage[]> {
    console.log(`🧪 MockKoreApiService: Getting messages for session: ${sessionId}`);
    
    const session = this.mockSessions.find(s => s.session_id === sessionId);
    if (!session) {
      console.log(`🧪 MockKoreApiService: Session ${sessionId} not found`);
      return [];
    }

    // Apply sanitization to this session before processing messages
    const sanitizedSession = this.applySanitizationToSession(session);

    const messages: KoreMessage[] = sanitizedSession.messages.map(message => ({
      sessionId: sanitizedSession.session_id,
      createdBy: message.message_type === 'user' ? 'user' : 'bot',
      createdOn: message.timestamp,
      type: message.message_type === 'user' ? 'incoming' : 'outgoing',
      timestampValue: new Date(message.timestamp).getTime(),
      components: [{
        cT: 'text',
        data: {
          text: message.message  // This is now the sanitized message text
        }
      }]
    }));

    console.log(`🧪 MockKoreApiService: Returning ${messages.length} sanitized messages for session ${sessionId}`);
    return messages;
  }

  /**
   * Apply sanitization to a session's messages, similar to how the real KoreApiService does
   * This ensures mock services behave consistently with real services regarding message cleaning
   */
  private applySanitizationToSession(session: SessionWithTranscript): SessionWithTranscript {
    console.log(`🧼 MockKoreApiService: Applying sanitization to session ${session.session_id}`);
    
    const sanitizedMessages = session.messages
      .map(message => {
        const messageType = message.message_type;
        const sanitizationResult = TranscriptSanitizationService.sanitizeMessage(message.message, messageType);
        
        // If message is filtered out (null), return null to remove it
        if (sanitizationResult.text === null) {
          console.log(`🧼 MockKoreApiService: Filtered out message: "${message.message}" (${messageType})`);
          return null;
        }
        
        // Return sanitized message
        return {
          ...message,
          message: sanitizationResult.text
        };
      })
      .filter((message): message is NonNullable<typeof message> => message !== null);
    
    console.log(`🧼 MockKoreApiService: Session ${session.session_id} - ${session.messages.length} messages → ${sanitizedMessages.length} after sanitization`);
    
    return {
      ...session,
      messages: sanitizedMessages,
      message_count: sanitizedMessages.length,
      user_message_count: sanitizedMessages.filter(m => m.message_type === 'user').length,
      bot_message_count: sanitizedMessages.filter(m => m.message_type === 'bot').length
    };
  }
}