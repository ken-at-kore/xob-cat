import { SessionWithTranscript, Message, SessionFilters } from '../../../shared/types';
import { createKoreApiService, KoreApiConfig } from './koreApiService';
import { configManager } from '../utils/configManager';

// Sample conversation templates
const conversationTemplates = [
  {
    intent: 'Claim Status',
    messages: [
      { message_type: 'user' as const, message: 'I need to check the status of my claim' },
      { message_type: 'bot' as const, message: 'I can help you check your claim status. Please provide your claim number.' },
      { message_type: 'user' as const, message: 'My claim number is 123456789' },
      { message_type: 'bot' as const, message: 'Thank you. Let me look up your claim. I found claim 123456789. The status is currently "Under Review" and was submitted on 2024-01-15.' },
      { message_type: 'user' as const, message: 'How long does the review process take?' },
      { message_type: 'bot' as const, message: 'The typical review process takes 5-7 business days. Your claim is currently on day 3 of the review process.' },
      { message_type: 'user' as const, message: 'Thank you for the information' },
      { message_type: 'bot' as const, message: 'You\'re welcome! Is there anything else I can help you with today?' }
    ],
    outcome: 'Contained' as const
  },
  {
    intent: 'Billing',
    messages: [
      { message_type: 'user' as const, message: 'I have a question about my bill' },
      { message_type: 'bot' as const, message: 'I can help you with billing questions. Please provide your member ID or policy number.' },
      { message_type: 'user' as const, message: 'My member ID is MEM123456' },
      { message_type: 'bot' as const, message: 'I\'m sorry, but I couldn\'t find a member with ID MEM123456. Could you please verify the member ID or provide your policy number?' },
      { message_type: 'user' as const, message: 'Let me check my card... I think it might be MEM654321' },
      { message_type: 'bot' as const, message: 'I\'m still unable to locate your account. Let me transfer you to a customer service representative who can help you verify your information.' }
    ],
    outcome: 'Transfer' as const,
    transfer_reason: 'Invalid Member ID'
  },
  {
    intent: 'Eligibility',
    messages: [
      { message_type: 'user' as const, message: 'I need to check if a procedure is covered under my plan' },
      { message_type: 'bot' as const, message: 'I can help you check your coverage. Please provide your member ID and the procedure code or name.' },
      { message_type: 'user' as const, message: 'My member ID is 987654321 and I need to check coverage for an MRI' },
      { message_type: 'bot' as const, message: 'Thank you. Let me check your coverage for an MRI. Based on your plan, MRIs are covered at 80% after your deductible is met. You have a $500 deductible and have met $300 so far this year.' },
      { message_type: 'user' as const, message: 'What about physical therapy?' },
      { message_type: 'bot' as const, message: 'Physical therapy is covered at 90% after your deductible. You have 20 sessions per year available.' }
    ],
    outcome: 'Contained' as const
  }
];

// Kore.ai API service instance
let koreApiService: any = null;

// Initialize Kore.ai API service if credentials are available
function initializeKoreApiService(): any {
  try {
    // First try to load from config file
    const koreConfig = configManager.getKoreConfig();
    const config: KoreApiConfig = {
      botId: koreConfig.bot_id,
      clientId: koreConfig.client_id,
      clientSecret: koreConfig.client_secret,
      baseUrl: koreConfig.base_url
    };
    console.log(`🔗 Using Kore.ai API with bot: ${koreConfig.name}`);
    return createKoreApiService(config);
  } catch (error) {
    console.log('📁 No config file found, checking environment variables...');
    
    // Fall back to environment variables
    const botId = process.env.KORE_BOT_ID;
    const clientId = process.env.KORE_CLIENT_ID;
    const clientSecret = process.env.KORE_CLIENT_SECRET;
    const baseUrl = process.env.KORE_BASE_URL;

    if (botId && clientId && clientSecret) {
      const config: KoreApiConfig = {
        botId,
        clientId,
        clientSecret,
        ...(baseUrl && { baseUrl })
      };
      console.log('🔗 Using Kore.ai API with environment variables');
      return createKoreApiService(config);
    }
    
    console.log('📝 No Kore.ai credentials found, will use mock data');
    return null;
  }
}

export async function getSessions(filters: SessionFilters): Promise<SessionWithTranscript[]> {
  // Try to use real Kore.ai API first
  if (!koreApiService) {
    koreApiService = initializeKoreApiService();
  }

  if (koreApiService) {
    try {
      console.log('Using real Kore.ai API to fetch sessions');
      
      // Convert filters to date range for Kore.ai API
      const dateFrom = filters.start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const dateTo = filters.end_date || new Date().toISOString();
      
      const sessions = await koreApiService.getSessions(
        dateFrom,
        dateTo,
        filters.skip || 0,
        filters.limit || 1000
      );

      // If we got sessions from the API, fetch their messages too
      if (sessions && sessions.length > 0) {
        console.log(`Found ${sessions.length} sessions from Kore.ai API`);
        
        // Extract session IDs for message retrieval
        const sessionIds = sessions
          .map((session: any) => session.session_id)
          .filter((id: any) => id && id.trim() !== '');
        
        console.log(`Fetching messages for ${sessionIds.length} sessions...`);
        
        // Fetch messages for all sessions
        let messages: any[] = [];
        try {
          messages = await koreApiService.getMessages(dateFrom, dateTo, sessionIds);
          console.log(`Retrieved ${messages.length} messages from Kore.ai API`);
        } catch (messageError) {
          console.error('Error fetching messages from Kore.ai API:', messageError);
          console.log('Continuing with sessions without messages...');
        }
        
        // Group messages by session ID
        const messagesBySession: Record<string, any[]> = {};
        messages.forEach((message: any) => {
          const sessionId = message.sessionId || message.session_id;
          if (sessionId) {
            if (!messagesBySession[sessionId]) {
              messagesBySession[sessionId] = [];
            }
            messagesBySession[sessionId].push(message);
          }
        });
        
        // Add messages to sessions
        const sessionsWithMessages = sessions.map((session: any) => {
          const sessionMessages = messagesBySession[session.session_id] || [];
          return {
            ...session,
            messages: sessionMessages
          };
        });
        
        console.log(`Sessions with messages: ${Object.keys(messagesBySession).length}/${sessions.length}`);
        
        // Apply additional filters that aren't handled by the API
        let filteredSessions = sessionsWithMessages;
        
        if (filters.containment_type) {
          filteredSessions = filteredSessions.filter((s: SessionWithTranscript) => 
            s.containment_type === filters.containment_type
          );
        }

        return filteredSessions;
      } else {
        console.log('No sessions found from Kore.ai API, falling back to mock data');
      }
    } catch (error) {
      console.error('Error fetching sessions from Kore.ai API:', error);
      console.log('Falling back to mock data');
    }
  }

  // Fall back to mock data
  console.log('Using mock data for sessions');
  return generateMockSessions(filters);
}

export function generateMockSessions(filters: SessionFilters): SessionWithTranscript[] {
  const sessions: SessionWithTranscript[] = [];
  const now = new Date();

  // Generate 20 mock sessions as before
  for (let i = 0; i < 20; i++) {
    const templateIndex = i % conversationTemplates.length;
    const template = conversationTemplates[templateIndex]!;
    const startTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + Math.random() * 30 * 60 * 1000); // 0-30 minutes duration
    const messages: Message[] = template.messages.map((msg, index) => ({
      timestamp: new Date(startTime.getTime() + index * 30 * 1000).toISOString(),
      message_type: msg.message_type,
      message: msg.message
    }));
    sessions.push({
      session_id: `session_${Date.now()}_${i}`,
      user_id: `user_${Math.floor(Math.random() * 1000)}`,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      containment_type: template.outcome === 'Contained' ? 'selfService' : 'agent',
      tags: [template.intent, template.outcome],
      metrics: {
        total_messages: messages.length,
        user_messages: messages.filter(m => m.message_type === 'user').length,
        bot_messages: messages.filter(m => m.message_type === 'bot').length
      },
      messages,
      duration_seconds: (endTime.getTime() - startTime.getTime()) / 1000,
      message_count: messages.length,
      user_message_count: messages.filter(m => m.message_type === 'user').length,
      bot_message_count: messages.filter(m => m.message_type === 'bot').length
    });
  }
  
  // Apply filters
  let filteredSessions = sessions;
  
  if (filters.start_date) {
    const startDate = new Date(filters.start_date);
    if (filters.start_time) {
      // Combine date and time
      const timeParts = filters.start_time.split(':');
      if (timeParts.length === 2) {
        const hours = timeParts[0];
        const minutes = timeParts[1];
        startDate.setHours(parseInt(hours || '0'), parseInt(minutes || '0'), 0, 0);
      }
    }
    filteredSessions = filteredSessions.filter(s => new Date(s.start_time) >= startDate);
  }
  
  if (filters.end_date) {
    const endDate = new Date(filters.end_date);
    if (filters.end_time) {
      // Combine date and time
      const timeParts = filters.end_time.split(':');
      if (timeParts.length === 2) {
        const hours = timeParts[0];
        const minutes = timeParts[1];
        endDate.setHours(parseInt(hours || '0'), parseInt(minutes || '0'), 59, 999);
      }
    } else {
      // If no end time specified, include the whole end date
      endDate.setHours(23, 59, 59, 999);
    }
    filteredSessions = filteredSessions.filter(s => new Date(s.start_time) <= endDate);
  }
  
  if (filters.containment_type) {
    filteredSessions = filteredSessions.filter(s => s.containment_type === filters.containment_type);
  }
  
  // Apply pagination
  if (filters.skip) {
    filteredSessions = filteredSessions.slice(filters.skip);
  }
  
  if (filters.limit) {
    filteredSessions = filteredSessions.slice(0, filters.limit);
  }
  
  return filteredSessions;
} 