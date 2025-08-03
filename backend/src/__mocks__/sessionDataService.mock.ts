import { SessionWithTranscript, SessionFilters, Message } from '../../../shared/types';
import { ISessionDataService } from '../interfaces';
import { ProductionDataLoader } from './productionDataLoader';

export class MockSessionDataService implements ISessionDataService {
  private productionDataLoader = ProductionDataLoader.getInstance();
  private conversationTemplates = [
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
    },
    {
      intent: 'Appointment Scheduling',
      messages: [
        { message_type: 'user' as const, message: 'I need to schedule an appointment' },
        { message_type: 'bot' as const, message: 'I can help you schedule an appointment. What type of appointment do you need?' },
        { message_type: 'user' as const, message: 'I need to see a doctor for a check-up' },
        { message_type: 'bot' as const, message: 'Great! I can help you schedule a check-up. Please select your preferred date and time.' },
        { message_type: 'user' as const, message: 'Actually, I need to check my calendar first' }
      ],
      outcome: 'Drop-off' as const,
      dropoff_location: 'Date Selection'
    },
    {
      intent: 'Password Reset',
      messages: [
        { message_type: 'user' as const, message: 'I forgot my password' },
        { message_type: 'bot' as const, message: 'I can help you reset your password. Please provide your username or email address.' },
        { message_type: 'user' as const, message: 'My email is user@example.com' },
        { message_type: 'bot' as const, message: 'Thank you. I\'ve sent a password reset link to user@example.com. Please check your email and follow the instructions.' },
        { message_type: 'user' as const, message: 'Perfect, I received it. Thank you!' }
      ],
      outcome: 'Contained' as const
    }
  ];

  async getSessions(
    filters: SessionFilters, 
    credentials?: { botId: string; clientId: string; clientSecret: string }
  ): Promise<SessionWithTranscript[]> {
    console.log(`🧪 MockSessionDataService: Getting sessions with filters:`, filters);
    console.log(`🧪 MockSessionDataService: Credentials provided: ${credentials ? 'Yes' : 'No'}`);
    
    // Pure mock - never attempt real API calls
    // Try to use production data first, fall back to generated mock data
    if (this.productionDataLoader.isDataAvailable()) {
      return this.getProductionBasedSessions(filters);
    } else {
      return this.generateMockSessions(filters);
    }
  }

  private getProductionBasedSessions(filters: SessionFilters): SessionWithTranscript[] {
    console.log(`🧪 MockSessionDataService: Using production data with filters:`, filters);
    
    // Convert SessionFilters to ProductionDataLoader filters
    const dateFrom = filters.start_date ? new Date(filters.start_date) : undefined;
    const dateTo = filters.end_date ? new Date(filters.end_date) : undefined;
    
    // If specific date range is requested and it doesn't match production data timeframe,
    // generate mock sessions based on production patterns
    const productionTimeframe = new Date('2025-07-07T17:00:00Z');
    const isProductionTimeframe = dateFrom && 
      Math.abs(dateFrom.getTime() - productionTimeframe.getTime()) < 24 * 60 * 60 * 1000; // Within 24 hours

    if (isProductionTimeframe) {
      // Use actual production data
      const productionFilters: {
        dateFrom?: string;
        dateTo?: string;
        containment_type?: 'selfService' | 'agent' | 'dropOff';
        limit?: number;
        skip?: number;
      } = {};
      
      if (dateFrom) productionFilters.dateFrom = dateFrom.toISOString();
      if (dateTo) productionFilters.dateTo = dateTo.toISOString();
      if (filters.containment_type) productionFilters.containment_type = filters.containment_type as 'selfService' | 'agent' | 'dropOff';
      if (filters.limit) productionFilters.limit = filters.limit;
      if (filters.skip) productionFilters.skip = filters.skip;
      
      return this.productionDataLoader.getSessionsWithTranscripts(productionFilters);
    } else {
      // Generate mock sessions with production data patterns but new timestamps
      const sessionCount = Math.min(filters.limit || 20, 50);
      const timeRange = {
        start: dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: dateTo || new Date()
      };
      
      const mockSessions = this.productionDataLoader.generateMockSessionsFromPatterns(sessionCount, timeRange);
      
      // Apply additional filters
      let filteredSessions = mockSessions;
      
      if (filters.containment_type) {
        filteredSessions = filteredSessions.filter(s => s.containment_type === filters.containment_type);
      }
      
      if (filters.skip) {
        filteredSessions = filteredSessions.slice(filters.skip);
      }
      
      if (filters.limit) {
        filteredSessions = filteredSessions.slice(0, filters.limit);
      }
      
      return filteredSessions;
    }
  }

  generateMockSessions(filters: SessionFilters): SessionWithTranscript[] {
    console.log(`🧪 MockSessionDataService: Generating mock sessions with filters:`, filters);
    
    const sessions: SessionWithTranscript[] = [];
    const now = new Date();
    const sessionCount = Math.min(filters.limit || 20, 50); // Cap at 50 for performance

    // Generate sessions across the requested time range
    let startDate: Date;
    let endDate: Date;

    if (filters.start_date) {
      startDate = new Date(filters.start_date);
      if (filters.start_time) {
        const [hours, minutes] = filters.start_time.split(':').map(Number);
        startDate.setHours(hours || 0, minutes || 0, 0, 0);
      }
    } else {
      // Default to last 7 days
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    if (filters.end_date) {
      endDate = new Date(filters.end_date);
      if (filters.end_time) {
        const [hours, minutes] = filters.end_time.split(':').map(Number);
        endDate.setHours(hours || 23, minutes || 59, 59, 999);
      } else {
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      endDate = now;
    }

    const timeRange = endDate.getTime() - startDate.getTime();

    for (let i = 0; i < sessionCount; i++) {
      const templateIndex = i % this.conversationTemplates.length;
      const template = this.conversationTemplates[templateIndex]!;
      
      // Generate random session start time within the specified range
      const sessionStartTime = new Date(startDate.getTime() + Math.random() * timeRange);
      const sessionDuration = Math.random() * 30 * 60 * 1000; // 0-30 minutes
      const sessionEndTime = new Date(sessionStartTime.getTime() + sessionDuration);

      // Create messages with timestamps
      const messages: Message[] = template.messages.map((msg, index) => ({
        timestamp: new Date(sessionStartTime.getTime() + index * 30 * 1000).toISOString(),
        message_type: msg.message_type,
        message: msg.message
      }));

      // Determine containment type based on outcome
      let containment_type: 'selfService' | 'agent' | 'dropOff';
      switch (template.outcome) {
        case 'Contained':
          containment_type = 'selfService';
          break;
        case 'Transfer':
          containment_type = 'agent';
          break;
        case 'Drop-off':
          containment_type = 'dropOff';
          break;
        default:
          containment_type = 'selfService';
      }

      const session: SessionWithTranscript = {
        session_id: `mock_session_${Date.now()}_${i}`,
        user_id: `mock_user_${Math.floor(Math.random() * 1000)}`,
        start_time: sessionStartTime.toISOString(),
        end_time: sessionEndTime.toISOString(),
        containment_type,
        tags: [template.intent, template.outcome],
        metrics: {
          total_messages: messages.length,
          user_messages: messages.filter(m => m.message_type === 'user').length,
          bot_messages: messages.filter(m => m.message_type === 'bot').length
        },
        messages,
        duration_seconds: Math.floor(sessionDuration / 1000),
        message_count: messages.length,
        user_message_count: messages.filter(m => m.message_type === 'user').length,
        bot_message_count: messages.filter(m => m.message_type === 'bot').length
      };

      sessions.push(session);
    }

    // Apply additional filters
    let filteredSessions = sessions;

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

    console.log(`🧪 MockSessionDataService: Generated ${filteredSessions.length} mock sessions`);
    return filteredSessions;
  }

  // Helper methods for testing

  addConversationTemplate(template: {
    intent: string;
    messages: Array<{ message_type: 'user' | 'bot'; message: string }>;
    outcome: 'Contained' | 'Transfer' | 'Drop-off';
    transfer_reason?: string | undefined;
    dropoff_location?: string | undefined;
  }): void {
    this.conversationTemplates.push(template as any);
  }

  clearConversationTemplates(): void {
    this.conversationTemplates = [];
  }

  getConversationTemplates() {
    return [...this.conversationTemplates];
  }
}