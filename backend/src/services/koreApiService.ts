import jwt from 'jsonwebtoken';
import axios, { AxiosResponse } from 'axios';

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

  constructor(config: KoreApiConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://bots.kore.ai';
  }

  /**
   * Generate JWT token for Kore.ai API authentication
   */
  private generateJwtToken(): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      clientId: this.config.clientId,
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
   * Make authenticated API request with rate limiting
   */
  private async makeRequest<T>(url: string, payload: any): Promise<T> {
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

    return {
      sessionId: koreMessage.sessionId,
      timestamp: koreMessage.createdOn,
      message_type: koreMessage.type === 'incoming' ? 'user' : 'bot',
      message: messageText
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
   * Retrieve session history from Kore.ai API
   */
  async getSessions(dateFrom: string, dateTo: string, skip: number = 0, limit: number = 1000): Promise<any[]> {
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
        allSessions.push(...sessions);
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
  async getMessages(dateFrom: string, dateTo: string, sessionIds?: string[]): Promise<any[]> {
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
  async getSessionById(sessionId: string): Promise<any | null> {
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
  async getSessionMessages(sessionId: string): Promise<any[]> {
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