import { SessionWithTranscript } from '../../../shared/types';
import { IKoreApiService } from '../interfaces';
import { SessionMetadata, KoreMessage } from '../services/koreApiService';

export class MockKoreApiService implements IKoreApiService {
  private mockSessions: SessionWithTranscript[] = [
    {
      session_id: 'mock_session_1',
      user_id: 'mock_user_1',
      start_time: '2024-08-01T10:00:00.000Z',
      end_time: '2024-08-01T10:15:00.000Z',
      containment_type: 'selfService',
      tags: ['Claim Status', 'Contained'],
      metrics: {
        total_messages: 6,
        user_messages: 3,
        bot_messages: 3
      },
      messages: [
        {
          timestamp: '2024-08-01T10:00:00.000Z',
          message_type: 'user',
          message: 'I need to check the status of my claim'
        },
        {
          timestamp: '2024-08-01T10:00:30.000Z',
          message_type: 'bot',
          message: 'I can help you check your claim status. Please provide your claim number.'
        },
        {
          timestamp: '2024-08-01T10:01:00.000Z',
          message_type: 'user',
          message: 'My claim number is 123456789'
        },
        {
          timestamp: '2024-08-01T10:01:30.000Z',
          message_type: 'bot',
          message: 'Thank you. Let me look up your claim. I found claim 123456789. The status is currently "Under Review" and was submitted on 2024-01-15.'
        },
        {
          timestamp: '2024-08-01T10:02:00.000Z',
          message_type: 'user',
          message: 'How long does the review process take?'
        },
        {
          timestamp: '2024-08-01T10:02:30.000Z',
          message_type: 'bot',
          message: 'The typical review process takes 5-7 business days. Your claim is currently on day 3 of the review process.'
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
      start_time: '2024-08-01T11:00:00.000Z',
      end_time: '2024-08-01T11:10:00.000Z',
      containment_type: 'agent',
      tags: ['Billing', 'Transfer'],
      metrics: {
        total_messages: 5,
        user_messages: 3,
        bot_messages: 2
      },
      messages: [
        {
          timestamp: '2024-08-01T11:00:00.000Z',
          message_type: 'user',
          message: 'I have a question about my bill'
        },
        {
          timestamp: '2024-08-01T11:00:30.000Z',
          message_type: 'bot',
          message: 'I can help you with billing questions. Please provide your member ID or policy number.'
        },
        {
          timestamp: '2024-08-01T11:01:00.000Z',
          message_type: 'user',
          message: 'My member ID is MEM123456'
        },
        {
          timestamp: '2024-08-01T11:01:30.000Z',
          message_type: 'bot',
          message: 'I\'m sorry, but I couldn\'t find a member with ID MEM123456. Let me transfer you to a customer service representative who can help you verify your information.'
        },
        {
          timestamp: '2024-08-01T11:02:00.000Z',
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
      start_time: '2024-08-01T14:00:00.000Z',
      end_time: '2024-08-01T14:25:00.000Z',
      containment_type: 'selfService',
      tags: ['Eligibility', 'Contained'],
      metrics: {
        total_messages: 8,
        user_messages: 4,
        bot_messages: 4
      },
      messages: [
        {
          timestamp: '2024-08-01T14:00:00.000Z',
          message_type: 'user',
          message: 'I need to check if a procedure is covered under my plan'
        },
        {
          timestamp: '2024-08-01T14:00:30.000Z',
          message_type: 'bot',
          message: 'I can help you check your coverage. Please provide your member ID and the procedure code or name.'
        },
        {
          timestamp: '2024-08-01T14:01:00.000Z',
          message_type: 'user',
          message: 'My member ID is 987654321 and I need to check coverage for an MRI'
        },
        {
          timestamp: '2024-08-01T14:01:30.000Z',
          message_type: 'bot',
          message: 'Thank you. Let me check your coverage for an MRI. Based on your plan, MRIs are covered at 80% after your deductible is met. You have a $500 deductible and have met $300 so far this year.'
        },
        {
          timestamp: '2024-08-01T14:02:00.000Z',
          message_type: 'user',
          message: 'What about physical therapy?'
        },
        {
          timestamp: '2024-08-01T14:02:30.000Z',
          message_type: 'bot',
          message: 'Physical therapy is covered at 90% after your deductible. You have 20 sessions per year available.'
        },
        {
          timestamp: '2024-08-01T14:03:00.000Z',
          message_type: 'user',
          message: 'Perfect, thank you for the information'
        },
        {
          timestamp: '2024-08-01T14:03:30.000Z',
          message_type: 'bot',
          message: 'You\'re welcome! Is there anything else I can help you with today?'
        }
      ],
      duration_seconds: 1500,
      message_count: 8,
      user_message_count: 4,
      bot_message_count: 4
    }
  ];

  async getSessions(dateFrom: string, dateTo: string, skip = 0, limit = 1000): Promise<SessionWithTranscript[]> {
    console.log(`🧪 MockKoreApiService: Getting sessions from ${dateFrom} to ${dateTo}, skip=${skip}, limit=${limit}`);
    
    // Filter sessions by date range
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    
    const filteredSessions = this.mockSessions.filter(session => {
      const sessionDate = new Date(session.start_time);
      return sessionDate >= startDate && sessionDate <= endDate;
    });

    // Apply pagination
    const paginatedSessions = filteredSessions.slice(skip, skip + limit);
    
    console.log(`🧪 MockKoreApiService: Returning ${paginatedSessions.length} sessions`);
    return paginatedSessions;
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
    
    // Filter sessions by date range
    const startDate = new Date(options.dateFrom);
    const endDate = new Date(options.dateTo);
    
    const filteredSessions = this.mockSessions.filter(session => {
      const sessionDate = new Date(session.start_time);
      return sessionDate >= startDate && sessionDate <= endDate;
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

    console.log(`🧪 MockKoreApiService: Returning ${messages.length} KoreMessages`);
    return messages;
  }

  async getSessionMessages(sessionId: string): Promise<KoreMessage[]> {
    console.log(`🧪 MockKoreApiService: Getting messages for session: ${sessionId}`);
    
    const session = this.mockSessions.find(s => s.session_id === sessionId);
    if (!session) {
      console.log(`🧪 MockKoreApiService: Session ${sessionId} not found`);
      return [];
    }

    const messages: KoreMessage[] = session.messages.map(message => ({
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
    }));

    console.log(`🧪 MockKoreApiService: Returning ${messages.length} messages for session ${sessionId}`);
    return messages;
  }
}