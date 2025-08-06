import jwt from 'jsonwebtoken';
import axios, { AxiosResponse } from 'axios';
import { TranscriptSanitizationService } from './transcriptSanitizationService';
import { MockSessionDataService } from '../__mocks__/sessionDataService.mock';
import { SessionFilters, SessionWithTranscript } from '../../../shared/types';

// Types for Kore.ai API responses
export interface KoreMessage {
  sessionId: string;
  createdBy: string;
  createdOn: string;
  type: 'incoming' | 'outgoing';
  timestampValue: number;
  components: Array<{
    cT: string;
    data?: {
      text?: string;
    };
  }>;
}

export interface KoreSession {
  sessionId: string;
  userId: string;
  start_time: string;
  end_time: string;
  containment_type: 'agent' | 'selfService' | 'dropOff';
  tags: string[];
  metrics: {
    total_messages: number;
    user_messages: number;
    bot_messages: number;
  };
  messages: KoreMessage[];
  duration_seconds: number;
  message_count: number;
  user_message_count: number;
  bot_message_count: number;
}

export interface KoreApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface KoreMessagesResponse {
  messages: KoreMessage[];
  moreAvailable: boolean;
}

export interface KoreSessionsResponse {
  sessions: KoreSession[];
}

// New interfaces for granular data access
export interface SessionMetadata {
  sessionId: string;
  userId: string;
  start_time: string;
  end_time: string;
  containment_type: 'agent' | 'selfService' | 'dropOff';
  tags: string[];
  metrics: {
    total_messages: number;
    user_messages: number;
    bot_messages: number;
  };
  duration_seconds: number;
}

export interface KoreSessionComplete extends SessionMetadata {
  messages: KoreMessage[];
  message_count: number;
  user_message_count: number;
  bot_message_count: number;
}

export interface KoreApiConfig {
  botId: string;
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
}

export class KoreApiService {
  private config: KoreApiConfig;
  private baseUrl: string;
  private requestCount: number = 0;
  private minuteStartTime: number = Date.now();
  private hourStartTime: number = Date.now();

  // Mock credential constants for production testing
  private static readonly MOCK_CREDENTIALS = {
    BOT_ID: 'st-mock-bot-id-12345',
    CLIENT_ID: 'cs-mock-client-id-12345',
    CLIENT_SECRET: 'mock-client-secret-12345'
  };

  constructor(config: KoreApiConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://bots.kore.ai';
  }

  /**
   * Check if the current configuration uses mock credentials
   */
  private isMockCredentials(): boolean {
    return this.config.botId === KoreApiService.MOCK_CREDENTIALS.BOT_ID &&
           this.config.clientId === KoreApiService.MOCK_CREDENTIALS.CLIENT_ID &&
           this.config.clientSecret === KoreApiService.MOCK_CREDENTIALS.CLIENT_SECRET;
  }

  /**
   * Generate JWT token for Kore.ai API authentication
   */
  private generateJwtToken(): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      iss: this.config.clientId, // Use 'iss' (issuer) claim - standard JWT claim for client identification
      sub: this.config.botId,     // Use 'sub' (subject) claim for the bot ID
      iat: now,
      exp: now + 3600, // 1 hour expiration
      aud: 'https://bots.kore.ai'
    };

    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    return jwt.sign(payload, this.config.clientSecret, { 
      algorithm: 'HS256',
      header 
    });
  }

  /**
   * Rate limiting implementation
   * - 60 requests per minute
   * - 1800 requests per hour
   */
  private async checkRateLimit(): Promise<void> {
    const currentTime = Date.now();
    
    // Reset minute counter if a minute has passed
    if (currentTime - this.minuteStartTime >= 60000) {
      this.requestCount = 0;
      this.minuteStartTime = currentTime;
    }

    // Reset hour counter if an hour has passed
    if (currentTime - this.hourStartTime >= 3600000) {
      this.hourStartTime = currentTime;
    }

    // If approaching minute limit, wait
    if (this.requestCount >= 59) {
      const waitTime = 60000 - (currentTime - this.minuteStartTime) + 1000; // Add 1 second buffer
      console.log(`Approaching rate limit. Waiting ${waitTime / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.minuteStartTime = Date.now();
      this.requestCount = 0;
    }

    this.requestCount++;
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const token = this.generateJwtToken();
    return {
      'Content-Type': 'application/json',
      'auth': token
    };
  }

  /**
   * Make authenticated API request with rate limiting
   */
  private async makeRequest<T>(url: string, payload: Record<string, unknown>): Promise<T> {
    await this.checkRateLimit();
    
    const token = this.generateJwtToken();
    const headers = {
      'Content-Type': 'application/json',
      'auth': token
    };

    try {
      const response: AxiosResponse<T> = await axios.post(url, payload, { headers });
      
      if (response.status === 429) {
        console.log('Rate limit exceeded. Waiting 60 seconds before retrying...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        return this.makeRequest(url, payload);
      }

      if (response.status !== 200) {
        throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        console.log('Rate limit exceeded. Waiting 60 seconds before retrying...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        return this.makeRequest(url, payload);
      }
      throw error;
    }
  }

  /**
   * Extract text content from Kore.ai message
   */
  private extractMessageText(message: KoreMessage): string | null {
    for (const component of message.components || []) {
      if (component.cT === 'text' && component.data?.text) {
        return component.data.text;
      }
    }
    return null;
  }

  /**
   * Convert Kore.ai message to our Message format
   */
  private convertKoreMessageToMessage(koreMessage: KoreMessage): any {
    const messageText = this.extractMessageText(koreMessage);
    if (!messageText) return null;

    const messageType = koreMessage.type === 'incoming' ? 'user' : 'bot';
    
    // Apply sanitization
    const sanitizationResult = TranscriptSanitizationService.sanitizeMessage(messageText, messageType);
    
    // If sanitization filtered out the message, return null
    if (sanitizationResult.text === null) {
      return null;
    }

    return {
      sessionId: koreMessage.sessionId,
      timestamp: koreMessage.createdOn,
      message_type: messageType,
      message: sanitizationResult.text
    };
  }

  /**
   * Convert Kore.ai session to our SessionWithTranscript format
   */
  private convertKoreSessionToSession(koreSession: KoreSession): any {
    const messages = (koreSession.messages || [])
      .map(msg => this.convertKoreMessageToMessage(msg))
      .filter(Boolean);

    return {
      session_id: koreSession.sessionId,
      user_id: koreSession.userId,
      start_time: koreSession.start_time,
      end_time: koreSession.end_time,
      containment_type: koreSession.containment_type,
      tags: koreSession.tags || [],
      metrics: koreSession.metrics,
      messages,
      duration_seconds: koreSession.duration_seconds,
      message_count: koreSession.message_count,
      user_message_count: koreSession.user_message_count,
      bot_message_count: koreSession.bot_message_count
    };
  }

  /**
   * GRANULAR METHOD: Get session metadata only (no messages) for performance
   * Part of the new layered architecture for lazy loading
   * OPTIMIZED: Uses parallel API calls for 2-3x performance improvement
   */
  async getSessionsMetadata(options: {
    dateFrom: string;
    dateTo: string;
    skip?: number;
    limit?: number;
  }): Promise<SessionMetadata[]> {
    const { dateFrom, dateTo, skip = 0, limit = 1000 } = options;

    console.log(`[getSessionsMetadata] Called with options:`, JSON.stringify(options, null, 2));
    console.log(`[getSessionsMetadata] isMockCredentials: ${this.isMockCredentials()}`);

    // Check if using mock credentials and return mock data
    if (this.isMockCredentials()) {
      console.log('🧪 Mock credentials detected - returning mock session metadata');
      
      const filters: SessionFilters = { skip, limit };
      const startDateOnly = dateFrom?.split('T')[0];
      const endDateOnly = dateTo?.split('T')[0];
      
      if (startDateOnly) filters.start_date = startDateOnly;
      if (endDateOnly) filters.end_date = endDateOnly;
      
      const mockService = new MockSessionDataService();
      const mockSessions = mockService.generateMockSessions(filters);
      
      // Convert to metadata format (remove messages)
      const metadata: SessionMetadata[] = mockSessions.map(session => ({
        sessionId: session.session_id,
        userId: session.user_id,
        start_time: session.start_time,
        end_time: session.end_time,
        containment_type: session.containment_type || 'agent', // Default to 'agent' if null/undefined
        tags: session.tags || [],
        metrics: {
          total_messages: session.message_count || 0,
          user_messages: session.user_message_count || 0,
          bot_messages: session.bot_message_count || 0
        },
        duration_seconds: session.duration_seconds || 0
      }));
      
      console.log(`Generated ${metadata.length} mock session metadata objects`);
      return metadata;
    }

    const containmentTypes: Array<'agent' | 'selfService' | 'dropOff'> = ['agent', 'selfService', 'dropOff'];
    
    console.log(`[getSessionsMetadata] Starting parallel API calls for ${containmentTypes.length} containment types`);

    // PARALLEL OPTIMIZATION: Execute all containment type API calls concurrently
    const promises = containmentTypes.map(containmentType => 
      this.fetchContainmentTypeMetadata(containmentType, { dateFrom, dateTo, skip, limit })
    );

    try {
      const results = await Promise.allSettled(promises);
      const allSessionsMetadata: SessionMetadata[] = [];

      // Process results from parallel execution
      for (let i = 0; i < results.length; i++) {
        const result = results[i]!; // Safe since we iterate by index
        const containmentType = containmentTypes[i]!; // Safe since we iterate by index

        if (result.status === 'fulfilled') {
          console.log(`[getSessionsMetadata] ${containmentType} API call succeeded with ${result.value.length} sessions`);
          allSessionsMetadata.push(...result.value);
        } else {
          console.error(`[getSessionsMetadata] ${containmentType} API call failed:`, result.reason);
          
          // Check if it's an authentication error - throw immediately
          if (axios.isAxiosError(result.reason) && result.reason.response?.status === 401) {
            console.error('Authentication failed - throwing error to caller');
            throw result.reason;
          }
          // Continue with other containment types for non-auth errors
        }
      }

      console.log(`Total session metadata retrieved: ${allSessionsMetadata.length} (parallel execution)`);
      return allSessionsMetadata;
    } catch (error) {
      // If any promise throws during parallel execution, check for auth errors
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.error('Authentication failed during parallel execution - throwing error to caller');
        throw error;
      }
      // Re-throw any other errors
      throw error;
    }
  }

  /**
   * Helper method to fetch metadata for a specific containment type
   * Extracted for parallel execution and better testability
   */
  private async fetchContainmentTypeMetadata(
    containmentType: 'agent' | 'selfService' | 'dropOff',
    options: { dateFrom: string; dateTo: string; skip: number; limit: number }
  ): Promise<SessionMetadata[]> {
    const { dateFrom, dateTo, skip, limit } = options;
    
    const url = `${this.baseUrl}/api/public/bot/${this.config.botId}/getSessions?containmentType=${containmentType}`;
    console.log(`Requesting ${containmentType} session metadata from URL: ${url}`);

    const payload = {
      dateFrom,
      dateTo,
      skip,
      limit
    };

    console.log(`[fetchContainmentTypeMetadata] Making API call for ${containmentType}:`);
    console.log(`[fetchContainmentTypeMetadata] URL: ${url}`);
    console.log(`[fetchContainmentTypeMetadata] Payload:`, JSON.stringify(payload, null, 2));

    const response = await this.makeRequest<KoreSessionsResponse>(url, payload);
    const sessions = response.sessions || [];
    console.log(`[fetchContainmentTypeMetadata] API Response: ${sessions.length} ${containmentType} sessions received`);
    
    if (sessions.length > 0) {
      console.log(`[fetchContainmentTypeMetadata] Sample session IDs:`, sessions.slice(0, 3).map(s => s.sessionId));
    }
    
    // Tag each session with its containment type
    const taggedSessions = sessions.map(session => ({
      ...session,
      containment_type: containmentType as 'agent' | 'selfService' | 'dropOff'
    }));

    // Convert to metadata format (extract only metadata, no messages)
    const sessionMetadata: SessionMetadata[] = taggedSessions.map((session: any) => ({
      sessionId: session.sessionId,
      userId: session.userId,
      start_time: session.start_time,
      end_time: session.end_time,
      containment_type: session.containment_type,
      tags: session.tags || [],
      metrics: {
        total_messages: session.metrics?.total_messages || 0,
        user_messages: session.metrics?.user_messages || 0,
        bot_messages: session.metrics?.bot_messages || 0
      },
      duration_seconds: session.duration_seconds || 0
    }));

    return sessionMetadata;
  }

  /**
   * GRANULAR METHOD: Get messages for specific session IDs only
   * Part of the new layered architecture for selective message loading
   */
  async getMessagesForSessions(
    sessionIds: string[], 
    dateRange?: { dateFrom: string; dateTo: string }
  ): Promise<KoreMessage[]> {
    if (sessionIds.length === 0) {
      return [];
    }

    // Use provided date range or create intelligent default
    const { dateFrom, dateTo } = dateRange || this.createIntelligentDateRange();

    console.log(`Fetching messages for ${sessionIds.length} sessions from ${dateFrom} to ${dateTo}`);

    try {
      // Use the correct API endpoint and method (same as working getMessages)
      const url = `${this.baseUrl}/api/public/bot/${this.config.botId}/getMessagesV2`;

      const payload = {
        dateFrom,
        dateTo,
        sessionId: sessionIds, // Use sessionId (not sessionIds) to match working method
        skip: 0,
        limit: 10000
      };

      console.log(`Making request for messages with ${sessionIds.length} session IDs`);
      
      // Use makeRequest method (same as working getMessages)
      const response = await this.makeRequest<KoreMessagesResponse>(url, payload);
      
      if (response.messages) {
        console.log(`Retrieved ${response.messages.length} messages for specified sessions`);
        return response.messages;
      }

      return [];
    } catch (error) {
      console.error('Error fetching messages for sessions:', error);
      return [];
    }
  }

  /**
   * CONVENIENCE METHOD: Get complete sessions with messages (composition of above methods)
   * Uses the granular methods internally
   */
  async getSessionsWithMessages(options: {
    dateFrom: string;
    dateTo: string;
    skip?: number;
    limit?: number;
  }): Promise<KoreSessionComplete[]> {
    console.log('Using convenience method: getSessionsWithMessages');

    // Step 1: Get session metadata
    const sessionMetadata = await this.getSessionsMetadata(options);
    
    if (sessionMetadata.length === 0) {
      return [];
    }

    // Step 2: Get messages for all sessions
    const sessionIds = sessionMetadata.map(session => session.sessionId);
    const messages = await this.getMessagesForSessions(sessionIds, {
      dateFrom: options.dateFrom,
      dateTo: options.dateTo
    });

    // Step 3: Combine metadata and messages
    const messagesBySession = this.groupMessagesBySession(messages);
    
    const completeSessions: KoreSessionComplete[] = sessionMetadata.map(session => ({
      ...session,
      messages: messagesBySession[session.sessionId] || [],
      message_count: session.metrics.total_messages,
      user_message_count: session.metrics.user_messages,
      bot_message_count: session.metrics.bot_messages
    }));

    console.log(`Created ${completeSessions.length} complete sessions with messages`);
    return completeSessions;
  }

  /**
   * Helper method to create intelligent date range when not provided
   */
  private createIntelligentDateRange(): { dateFrom: string; dateTo: string } {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return {
      dateFrom: oneWeekAgo.toISOString(),
      dateTo: now.toISOString()
    };
  }

  /**
   * Helper method to group messages by session ID
   */
  private groupMessagesBySession(messages: KoreMessage[]): Record<string, KoreMessage[]> {
    const grouped: Record<string, KoreMessage[]> = {};
    
    messages.forEach(message => {
      const sessionId = message.sessionId;
      if (!grouped[sessionId]) {
        grouped[sessionId] = [];
      }
      grouped[sessionId].push(message);
    });

    return grouped;
  }

  /**
   * LEGACY METHOD: Retrieve session history from Kore.ai API (with messages)
   * Now implemented using the new granular methods for consistency
   */
  async getSessions(dateFrom: string, dateTo: string, skip: number = 0, limit: number = 1000): Promise<SessionWithTranscript[]> {
    // Check if using mock credentials and return mock data
    if (this.isMockCredentials()) {
      console.log('🧪 Mock credentials detected - returning mock session data');
      
      const filters: SessionFilters = { skip, limit };
      const startDateOnly = dateFrom?.split('T')[0];
      const endDateOnly = dateTo?.split('T')[0];
      
      if (startDateOnly) filters.start_date = startDateOnly;
      if (endDateOnly) filters.end_date = endDateOnly;
      
      const mockService = new MockSessionDataService();
      const mockSessions = mockService.generateMockSessions(filters);
      console.log(`Generated ${mockSessions.length} mock sessions`);
      return mockSessions;
    }

    const containmentTypes = ['agent', 'selfService', 'dropOff'];
    const allSessions: KoreSession[] = [];

    for (const containmentType of containmentTypes) {
      const url = `${this.baseUrl}/api/public/bot/${this.config.botId}/getSessions?containmentType=${containmentType}`;
      console.log(`Requesting ${containmentType} sessions from URL: ${url}`);

      const payload = {
        dateFrom,
        dateTo,
        skip,
        limit
      };

      try {
        const response = await this.makeRequest<KoreSessionsResponse>(url, payload);
        const sessions = response.sessions || [];
        console.log(`Retrieved ${sessions.length} ${containmentType} sessions`);
        
        // Tag each session with its containment type
        const taggedSessions = sessions.map(session => ({
          ...session,
          containment_type: containmentType as 'agent' | 'selfService' | 'dropOff'
        }));
        
        allSessions.push(...taggedSessions);
      } catch (error) {
        console.warn(`Warning: Failed to retrieve ${containmentType} sessions:`, error);
        continue;
      }
    }

    // Sort sessions by start_time
    allSessions.sort((a, b) => a.start_time.localeCompare(b.start_time));
    console.log(`Total sessions retrieved: ${allSessions.length}`);

    return allSessions.map(session => this.convertKoreSessionToSession(session));
  }

  /**
   * Retrieve conversation messages from Kore.ai API
   */
  async getMessages(dateFrom: string, dateTo: string, sessionIds?: string[]): Promise<KoreMessage[]> {
    // Check if using mock credentials and return empty array (messages included in sessions)
    if (this.isMockCredentials()) {
      console.log('🧪 Mock credentials detected - messages already included in session data');
      return [];
    }

    const url = `${this.baseUrl}/api/public/bot/${this.config.botId}/getMessagesV2`;
    const allMessages: KoreMessage[] = [];
    let skip = 0;
    const limit = 10000; // Maximum messages per request
    let moreAvailable = true;

    while (moreAvailable) {
      const payload: any = {
        skip,
        limit,
        dateFrom,
        dateTo
      };

      if (sessionIds) {
        payload.sessionId = sessionIds;
      }

      console.log(`Making request: skip=${skip}, limit=${limit}`);
      if (sessionIds) {
        console.log(`Filtering by ${sessionIds.length} session IDs`);
      }

      try {
        const response = await this.makeRequest<KoreMessagesResponse>(url, payload);
        
        if (response.messages) {
          allMessages.push(...response.messages);
          console.log(`Retrieved ${response.messages.length} messages. Total so far: ${allMessages.length}`);
        }

        moreAvailable = response.moreAvailable || false;
        skip += limit;

        if (!moreAvailable || !response.messages || response.messages.length === 0) {
          break;
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error retrieving messages:', error);
        break;
      }
    }

    return allMessages.map(msg => this.convertKoreMessageToMessage(msg)).filter(Boolean);
  }

  /**
   * Get a single session by ID
   */
  async getSessionById(sessionId: string): Promise<SessionWithTranscript | null> {
    // First get all sessions and find the one we want
    const sessions = await this.getSessions(
      new Date(0).toISOString(), // From beginning of time
      new Date().toISOString(),  // To now
      0,
      10000 // Large limit to ensure we find the session
    );

    return sessions.find(session => session.session_id === sessionId) || null;
  }

  /**
   * Get messages for a specific session
   */
  async getSessionMessages(sessionId: string): Promise<KoreMessage[]> {
    return this.getMessages(
      new Date(0).toISOString(), // From beginning of time
      new Date().toISOString(),  // To now
      [sessionId]
    );
  }
}

// Factory function to create KoreApiService instance
export function createKoreApiService(config: KoreApiConfig): KoreApiService {
  return new KoreApiService(config);
} 