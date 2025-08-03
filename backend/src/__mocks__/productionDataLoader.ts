/**
 * Production Data Loader for Mock Services
 * 
 * Loads sanitized production data from the data/ directory for use in mock services.
 * This provides more realistic testing data than hardcoded templates.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SessionWithTranscript, Message } from '../../../shared/types';

interface KoreApiResponse<T> {
  success: boolean;
  data: T[];
  message: string;
  timestamp: string;
  meta?: any;
}

interface KoreSession {
  session_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  containment_type: 'selfService' | 'agent' | 'dropOff';
  tags: any;
  metrics: any;
}

interface KoreMessage {
  sessionId: string;
  timestamp: string;
  message_type: 'user' | 'bot';
  message: string;
}

export class ProductionDataLoader {
  private static instance: ProductionDataLoader;
  private sessionsData: KoreSession[] = [];
  private messagesData: KoreMessage[] = [];
  private loaded = false;

  private constructor() {}

  static getInstance(): ProductionDataLoader {
    if (!ProductionDataLoader.instance) {
      ProductionDataLoader.instance = new ProductionDataLoader();
    }
    return ProductionDataLoader.instance;
  }

  private loadData(): void {
    if (this.loaded) return;

    try {
      const dataDir = path.join(__dirname, '../../../data');
      
      // Load all session files
      const sessionFiles = [
        'api-kore-sessions-selfservice-2025-07-23T17-05-08.json',
        'api-kore-sessions-agent-2025-07-23T17-04-55.json',
        'api-kore-sessions-dropoff-2025-07-23T17-05-21.json'
      ];

      for (const filename of sessionFiles) {
        const filePath = path.join(dataDir, filename);
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const response: KoreApiResponse<KoreSession> = JSON.parse(fileContent);
          if (response.success && response.data) {
            this.sessionsData.push(...response.data);
          }
        }
      }

      // Load messages file
      const messagesFile = path.join(dataDir, 'api-kore-messages-2025-07-23T17-05-31.json');
      if (fs.existsSync(messagesFile)) {
        const fileContent = fs.readFileSync(messagesFile, 'utf-8');
        const response: KoreApiResponse<KoreMessage> = JSON.parse(fileContent);
        if (response.success && response.data) {
          this.messagesData = response.data;
        }
      }

      console.log(`🧪 ProductionDataLoader: Loaded ${this.sessionsData.length} sessions and ${this.messagesData.length} messages`);
      this.loaded = true;

    } catch (error) {
      console.error('🚨 ProductionDataLoader: Failed to load production data:', error);
      // Fall back to empty data rather than crashing
      this.sessionsData = [];
      this.messagesData = [];
      this.loaded = true;
    }
  }

  /**
   * Get sessions with transcripts, combining session metadata with messages
   */
  getSessionsWithTranscripts(filters?: {
    dateFrom?: string;
    dateTo?: string;
    containment_type?: 'selfService' | 'agent' | 'dropOff';
    limit?: number;
    skip?: number;
  }): SessionWithTranscript[] {
    this.loadData();

    let filteredSessions = [...this.sessionsData];

    // Apply containment type filter
    if (filters?.containment_type) {
      filteredSessions = filteredSessions.filter(s => s.containment_type === filters.containment_type);
    }

    // Apply date filters
    if (filters?.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filteredSessions = filteredSessions.filter(s => new Date(s.start_time) >= fromDate);
    }

    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      filteredSessions = filteredSessions.filter(s => new Date(s.start_time) <= toDate);
    }

    // Apply pagination
    if (filters?.skip) {
      filteredSessions = filteredSessions.slice(filters.skip);
    }

    if (filters?.limit) {
      filteredSessions = filteredSessions.slice(0, filters.limit);
    }

    // Group messages by session ID
    const messagesBySession = new Map<string, KoreMessage[]>();
    for (const message of this.messagesData) {
      if (!messagesBySession.has(message.sessionId)) {
        messagesBySession.set(message.sessionId, []);
      }
      messagesBySession.get(message.sessionId)!.push(message);
    }

    // Convert to SessionWithTranscript format
    const sessionsWithTranscripts: SessionWithTranscript[] = filteredSessions.map(session => {
      const sessionMessages = messagesBySession.get(session.session_id) || [];
      
      // Sort messages by timestamp
      sessionMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Convert to Message format
      const messages: Message[] = sessionMessages.map(msg => ({
        timestamp: msg.timestamp,
        message_type: msg.message_type,
        message: msg.message
      }));

      // Calculate duration
      const startTime = new Date(session.start_time);
      const endTime = new Date(session.end_time);
      const duration_seconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      // Count messages by type
      const user_message_count = messages.filter(m => m.message_type === 'user').length;
      const bot_message_count = messages.filter(m => m.message_type === 'bot').length;

      return {
        session_id: session.session_id,
        user_id: session.user_id,
        start_time: session.start_time,
        end_time: session.end_time,
        containment_type: session.containment_type,
        tags: session.tags,
        metrics: session.metrics,
        messages,
        duration_seconds,
        message_count: messages.length,
        user_message_count,
        bot_message_count
      };
    });

    console.log(`🧪 ProductionDataLoader: Returning ${sessionsWithTranscripts.length} sessions with transcripts`);
    return sessionsWithTranscripts;
  }

  /**
   * Get sample session for specific containment type
   */
  getSampleSession(containmentType: 'selfService' | 'agent' | 'dropOff'): SessionWithTranscript | null {
    const sessions = this.getSessionsWithTranscripts({ containment_type: containmentType, limit: 1 });
    return sessions.length > 0 ? sessions[0]! : null;
  }

  /**
   * Get sessions count by containment type
   */
  getSessionStats(): { selfService: number; agent: number; dropOff: number } {
    this.loadData();
    
    const stats = {
      selfService: this.sessionsData.filter(s => s.containment_type === 'selfService').length,
      agent: this.sessionsData.filter(s => s.containment_type === 'agent').length,
      dropOff: this.sessionsData.filter(s => s.containment_type === 'dropOff').length
    };

    return stats;
  }

  /**
   * Check if production data is available
   */
  isDataAvailable(): boolean {
    this.loadData();
    return this.sessionsData.length > 0;
  }

  /**
   * Generate mock sessions based on production data patterns
   * but with new session IDs and timestamps for testing
   */
  generateMockSessionsFromPatterns(count: number, timeRange: { start: Date; end: Date }): SessionWithTranscript[] {
    this.loadData();
    
    if (this.sessionsData.length === 0) {
      console.warn('🚨 ProductionDataLoader: No production data available, falling back to empty array');
      return [];
    }

    const mockSessions: SessionWithTranscript[] = [];
    const timeSpan = timeRange.end.getTime() - timeRange.start.getTime();

    for (let i = 0; i < count; i++) {
      // Pick a random session from production data as template
      const templateSession = this.sessionsData[i % this.sessionsData.length];
      if (!templateSession) continue; // Skip if no template session available
      
      const templateMessages = this.messagesData.filter(m => m.sessionId === templateSession.session_id);

      // Generate new timestamps within the specified range
      const sessionStart = new Date(timeRange.start.getTime() + Math.random() * timeSpan);
      const sessionDuration = Math.random() * 30 * 60 * 1000; // 0-30 minutes
      const sessionEnd = new Date(sessionStart.getTime() + sessionDuration);

      // Create new messages with updated timestamps and session ID
      const newSessionId = `mock_${Date.now()}_${i}`;
      const messages: Message[] = templateMessages.map((msg, index) => ({
        timestamp: new Date(sessionStart.getTime() + index * 30 * 1000).toISOString(),
        message_type: msg.message_type,
        message: msg.message
      }));

      const user_message_count = messages.filter(m => m.message_type === 'user').length;
      const bot_message_count = messages.filter(m => m.message_type === 'bot').length;

      const mockSession: SessionWithTranscript = {
        session_id: newSessionId,
        user_id: `mock_user_${Math.floor(Math.random() * 1000)}`,
        start_time: sessionStart.toISOString(),
        end_time: sessionEnd.toISOString(),
        containment_type: templateSession.containment_type,
        tags: templateSession.tags,
        metrics: templateSession.metrics,
        messages,
        duration_seconds: Math.floor(sessionDuration / 1000),
        message_count: messages.length,
        user_message_count,
        bot_message_count
      };

      mockSessions.push(mockSession);
    }

    console.log(`🧪 ProductionDataLoader: Generated ${mockSessions.length} mock sessions from production patterns`);
    return mockSessions;
  }
}