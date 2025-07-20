/**
 * Session with Transcript (SWT) Service
 * 
 * This service retrieves both session history and conversation transcripts from Kore.ai bots
 * and combines them into unified SWT objects for analysis and display.
 * 
 * Features:
 * - Retrieves session history for the specified date range
 * - Retrieves conversation transcripts for those sessions
 * - Combines data into SWT objects with computed metrics
 * - Supports automatic pagination and rate limiting
 * - Comprehensive error handling and logging
 */

import { createKoreApiService, KoreApiConfig } from './koreApiService';
import { SessionWithTranscript, SWTBuilder } from '../models/swtModels';

export interface SWTGenerationOptions {
  dateFrom: string;
  dateTo: string;
  limit?: number;
  sessionIds?: string[];
}

export interface SWTGenerationResult {
  swts: SessionWithTranscript[];
  totalSessions: number;
  totalMessages: number;
  sessionsWithMessages: number;
  generationTime: number;
}

export class SWTService {
  private koreService: ReturnType<typeof createKoreApiService>;

  constructor(config: KoreApiConfig) {
    this.koreService = createKoreApiService(config);
  }

  /**
   * Generate SWT objects by retrieving sessions and their corresponding messages
   */
  async generateSWTs(options: SWTGenerationOptions): Promise<SWTGenerationResult> {
    const startTime = Date.now();
    
    console.log(`Retrieving sessions from ${options.dateFrom} to ${options.dateTo} (limit=${options.limit || 1000})...`);
    
    // Retrieve sessions
    const sessions = await this.koreService.getSessions(
      options.dateFrom,
      options.dateTo,
      0,
      options.limit || 1000
    );
    
    console.log(`Retrieved ${sessions.length} sessions`);
    
    if (sessions.length === 0) {
      console.log('No sessions found in the specified date range');
      return {
        swts: [],
        totalSessions: 0,
        totalMessages: 0,
        sessionsWithMessages: 0,
        generationTime: Date.now() - startTime
      };
    }

    // Extract session IDs for message retrieval
    const sessionIds = sessions
      .map(session => session.session_id)
      .filter(id => id && id.trim() !== '');
    
    console.log(`Retrieving messages for ${sessionIds.length} sessions...`);
    
    // Retrieve messages for these sessions
    const messageStartTime = Date.now();
    const messages = await this.koreService.getMessages(
      options.dateFrom,
      options.dateTo,
      sessionIds
    );
    const messageElapsedTime = Date.now() - messageStartTime;
    
    console.log(`Retrieved ${messages.length} messages in ${messageElapsedTime}ms`);
    
    // Group messages by session
    const messagesBySession = SWTBuilder.groupMessagesBySession(messages);
    console.log(`Messages grouped into ${Object.keys(messagesBySession).length} sessions`);
    
    // Create SWT objects
    const swts: SessionWithTranscript[] = [];
    let totalMessages = 0;
    let sessionsWithMessages = 0;
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      const sessionMessages = sessionId ? (messagesBySession[sessionId] || []) : [];
      
      // Create SWT from session and messages
      const swt = SWTBuilder.createSWT(session, sessionMessages);
      swts.push(swt);
      
      totalMessages += swt.message_count;
      if (swt.message_count > 0) {
        sessionsWithMessages++;
      }
    }
    
    // Sort SWTs by start time
    swts.sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    const generationTime = Date.now() - startTime;
    console.log(`Generated ${swts.length} SWT objects in ${generationTime}ms`);
    
    return {
      swts,
      totalSessions: swts.length,
      totalMessages,
      sessionsWithMessages,
      generationTime
    };
  }

  /**
   * Generate SWT for a specific session
   */
  async generateSWTForSession(sessionId: string): Promise<SessionWithTranscript | null> {
    console.log(`Generating SWT for session: ${sessionId}`);
    
    // Get the specific session
    const session = await this.koreService.getSessionById(sessionId);
    if (!session) {
      console.log(`Session ${sessionId} not found`);
      return null;
    }
    
    // Get messages for this session
    const messages = await this.koreService.getSessionMessages(sessionId);
    console.log(`Retrieved ${messages.length} messages for session ${sessionId}`);
    
    // Create SWT
    const swt = SWTBuilder.createSWT(session, messages);
    
    console.log(`Generated SWT for session ${sessionId}: ${SWTBuilder.getConversationSummary(swt)}`);
    
    return swt;
  }

  /**
   * Generate SWTs for specific session IDs
   */
  async generateSWTsForSessions(sessionIds: string[]): Promise<SWTGenerationResult> {
    const startTime = Date.now();
    
    console.log(`Generating SWTs for ${sessionIds.length} specific sessions...`);
    
    const swts: SessionWithTranscript[] = [];
    let totalMessages = 0;
    let sessionsWithMessages = 0;
    
    for (const sessionId of sessionIds) {
      const swt = await this.generateSWTForSession(sessionId);
      if (swt) {
        swts.push(swt);
        totalMessages += swt.message_count;
        if (swt.message_count > 0) {
          sessionsWithMessages++;
        }
      }
    }
    
    // Sort SWTs by start time
    swts.sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    const generationTime = Date.now() - startTime;
    console.log(`Generated ${swts.length} SWTs for specific sessions in ${generationTime}ms`);
    
    return {
      swts,
      totalSessions: swts.length,
      totalMessages,
      sessionsWithMessages,
      generationTime
    };
  }

  /**
   * Get summary statistics for SWTs
   */
  getSWTSummary(swts: SessionWithTranscript[]): Record<string, any> {
    if (swts.length === 0) {
      return {
        totalSessions: 0,
        totalMessages: 0,
        totalUserMessages: 0,
        totalBotMessages: 0,
        sessionsWithMessages: 0,
        averageMessagesPerSession: 0,
        averageDuration: 0,
        containmentTypeBreakdown: {},
        averageUserMessagesPerSession: 0,
        averageBotMessagesPerSession: 0
      };
    }

    const totalMessages = swts.reduce((sum, swt) => sum + swt.message_count, 0);
    const totalUserMessages = swts.reduce((sum, swt) => sum + swt.user_message_count, 0);
    const totalBotMessages = swts.reduce((sum, swt) => sum + swt.bot_message_count, 0);
    const sessionsWithMessages = swts.filter(swt => swt.message_count > 0).length;
    
    const validDurations = swts
      .map(swt => swt.duration_seconds)
      .filter(duration => duration !== null) as number[];
    const averageDuration = validDurations.length > 0 
      ? validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length 
      : 0;

    const containmentTypeBreakdown = swts.reduce((acc, swt) => {
      const type = swt.containment_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSessions: swts.length,
      totalMessages,
      totalUserMessages,
      totalBotMessages,
      sessionsWithMessages,
      averageMessagesPerSession: totalMessages / swts.length,
      averageDuration,
      containmentTypeBreakdown,
      averageUserMessagesPerSession: totalUserMessages / swts.length,
      averageBotMessagesPerSession: totalBotMessages / swts.length
    };
  }

  /**
   * Filter SWTs by various criteria
   */
  filterSWTs(swts: SessionWithTranscript[], filters: {
    containmentType?: 'agent' | 'selfService' | 'dropOff';
    hasMessages?: boolean;
    minDuration?: number;
    maxDuration?: number;
    minMessages?: number;
    maxMessages?: number;
  }): SessionWithTranscript[] {
    return swts.filter(swt => {
      // Filter by containment type
      if (filters.containmentType && swt.containment_type !== filters.containmentType) {
        return false;
      }
      
      // Filter by message presence
      if (filters.hasMessages !== undefined) {
        const hasMessages = swt.message_count > 0;
        if (filters.hasMessages !== hasMessages) {
          return false;
        }
      }
      
      // Filter by duration
      if (filters.minDuration && (swt.duration_seconds === null || swt.duration_seconds < filters.minDuration)) {
        return false;
      }
      if (filters.maxDuration && (swt.duration_seconds === null || swt.duration_seconds > filters.maxDuration)) {
        return false;
      }
      
      // Filter by message count
      if (filters.minMessages && swt.message_count < filters.minMessages) {
        return false;
      }
      if (filters.maxMessages && swt.message_count > filters.maxMessages) {
        return false;
      }
      
      return true;
    });
  }
}

// Factory function to create SWTService instance
export function createSWTService(config: KoreApiConfig): SWTService {
  return new SWTService(config);
} 