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

import { KoreApiConfig, SessionMetadata, KoreMessage } from './koreApiService';
import { IKoreApiService } from '../interfaces';
import { SessionWithTranscript, SWTBuilder } from '../models/swtModels';
import { TranscriptSanitizationService } from './transcriptSanitizationService';

export interface SWTGenerationOptions {
  dateFrom: string;
  dateTo: string;
  limit?: number;
  sessionIds?: string[];
  populateMessages?: boolean; // New option to control message population
}

export interface SWTGenerationResult {
  swts: SessionWithTranscript[];
  totalSessions: number;
  totalMessages: number;
  sessionsWithMessages: number;
  generationTime: number;
}

export class SWTService {
  private koreService: IKoreApiService;

  constructor(koreApiService: IKoreApiService) {
    this.koreService = koreApiService;
  }

  /**
   * LAZY LOADING: Create SWTs from session metadata only (no messages)
   * Part of the new layered architecture for performance optimization
   */
  async createSWTsFromMetadata(sessionMetadata: SessionMetadata[]): Promise<SessionWithTranscript[]> {
    console.log(`Creating ${sessionMetadata.length} SWTs from metadata (no messages)`);
    
    const swts: SessionWithTranscript[] = sessionMetadata.map(metadata => ({
      session_id: metadata.sessionId,
      user_id: metadata.userId,
      start_time: metadata.start_time,
      end_time: metadata.end_time,
      containment_type: metadata.containment_type,
      tags: metadata.tags,
      metrics: metadata.metrics,
      duration_seconds: metadata.duration_seconds,
      message_count: metadata.metrics.total_messages,
      user_message_count: metadata.metrics.user_messages,
      bot_message_count: metadata.metrics.bot_messages,
      messages: [] // Empty - will be populated later if needed
    }));
    
    console.log(`Created ${swts.length} SWT objects from metadata`);
    return swts;
  }

  /**
   * LAZY LOADING: Populate messages for specific session IDs only
   * Part of the new layered architecture for selective data loading
   */
  async populateMessages(
    swts: SessionWithTranscript[], 
    sessionIds?: string[],
    progressCallback?: (
      sessionsWithMessages: number, 
      totalSessions: number,
      currentBatch?: number,
      totalBatches?: number
    ) => void
  ): Promise<SessionWithTranscript[]> {
    // If no specific session IDs provided, populate all sessions
    const targetSessionIds = sessionIds || swts.map(swt => swt.session_id);
    
    console.log(`Populating messages for ${targetSessionIds.length} sessions`);
    
    if (targetSessionIds.length === 0) {
      return swts;
    }
    
    // Create intelligent date range from SWT data
    const startTimes = swts
      .filter(swt => targetSessionIds.includes(swt.session_id))
      .map(swt => new Date(swt.start_time))
      .filter(date => !isNaN(date.getTime()));
    
    const endTimes = swts
      .filter(swt => targetSessionIds.includes(swt.session_id))
      .map(swt => new Date(swt.end_time))
      .filter(date => !isNaN(date.getTime()));
    
    const dateRange = startTimes.length > 0 && endTimes.length > 0 ? {
      dateFrom: new Date(Math.min(...startTimes.map(d => d.getTime()))).toISOString(),
      dateTo: new Date(Math.max(...endTimes.map(d => d.getTime()))).toISOString()
    } : undefined;
    
    // Fetch messages for specific sessions with progress tracking
    const messages = await this.koreService.getMessagesForSessions(
      targetSessionIds, 
      dateRange, 
      progressCallback ? (batchCompleted: number, totalBatches: number, currentBatchSessions: number) => {
        // Track cumulative progress across batches
        const estimatedSessionsCompleted = batchCompleted * 20 + currentBatchSessions; // 20 sessions per batch
        progressCallback(
          Math.min(estimatedSessionsCompleted, targetSessionIds.length), 
          targetSessionIds.length,
          batchCompleted + 1,
          totalBatches
        );
      } : undefined
    );
    console.log(`Retrieved ${messages.length} messages for ${targetSessionIds.length} sessions`);
    
    // Group messages by session
    const messagesBySession = this.groupMessagesBySession(messages);
    
    // Create new SWT array with messages populated
    const populatedSWTs = swts.map(swt => {
      if (targetSessionIds.includes(swt.session_id)) {
        const sessionMessages = messagesBySession[swt.session_id] || [];
        // Apply sanitization and filter out null results
        const sanitizedMessages = sessionMessages
          .map(msg => this.convertKoreMessageToSWTMessage(msg))
          .filter(msg => msg !== null);
        
        return {
          ...swt,
          messages: sanitizedMessages
        };
      }
      return swt; // Return unchanged if not in target list
    });
    
    console.log(`Populated messages for ${targetSessionIds.length} SWT objects`);
    return populatedSWTs;
  }

  /**
   * Helper method to group Kore messages by session ID
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
   * Helper method to convert KoreMessage to SWT Message format
   * Applies sanitization to ensure clean, user-friendly message display
   */
  private convertKoreMessageToSWTMessage(koreMessage: KoreMessage): any | null {
    // Extract text from components
    let messageText = '';
    for (const component of koreMessage.components || []) {
      if (component.cT === 'text' && component.data?.text) {
        messageText = component.data.text;
        break;
      }
    }
    
    // Convert Kore message type to UI-compatible format
    const messageType = koreMessage.type === 'incoming' ? 'user' : 'bot';
    
    // Apply sanitization to the message text
    const sanitizationResult = TranscriptSanitizationService.sanitizeMessage(messageText, messageType);
    
    // If message was filtered out (null), return null to exclude it
    if (sanitizationResult.text === null) {
      console.log(`🧼 SWTService: Filtered out message: "${messageText}" (${messageType})`);
      return null;
    }
    
    return {
      messageId: `${koreMessage.sessionId}_${koreMessage.timestampValue}`,
      message: sanitizationResult.text, // Use sanitized text
      // UI compatibility: provide both formats for maximum compatibility
      message_type: messageType,  // Legacy format expected by UI
      type: koreMessage.type,     // New format (keep for completeness)
      timestamp: koreMessage.createdOn,  // Legacy format expected by UI
      createdOn: koreMessage.createdOn,  // New format (keep for completeness)
      components: koreMessage.components
    };
  }

  /**
   * Generate SWT objects by retrieving sessions and their corresponding messages
   * Now uses the new layered architecture with lazy loading for better performance
   */
  async generateSWTs(options: SWTGenerationOptions): Promise<SWTGenerationResult> {
    const startTime = Date.now();
    
    console.log(`Retrieving sessions from ${options.dateFrom} to ${options.dateTo} (limit=${options.limit || 1000}), populateMessages=${options.populateMessages !== false}...`);
    
    // Step 1: Get session metadata first (fast operation)
    const sessionMetadata = await this.koreService.getSessionsMetadata({
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      limit: options.limit || 1000
    });
    
    console.log(`Retrieved ${sessionMetadata.length} session metadata objects`);
    
    if (sessionMetadata.length === 0) {
      console.log('No sessions found in the specified date range');
      return {
        swts: [],
        totalSessions: 0,
        totalMessages: 0,
        sessionsWithMessages: 0,
        generationTime: Date.now() - startTime
      };
    }

    // Step 2: Create SWTs from metadata (no messages yet)
    const swts = await this.createSWTsFromMetadata(sessionMetadata);
    
    let finalSWTs: SessionWithTranscript[];
    
    // Step 3: Conditionally populate messages based on option
    if (options.populateMessages !== false) {
      // Default behavior: populate messages for all sessions (for auto-analyze and legacy endpoints)
      console.log('Populating messages for all sessions (legacy behavior)');
      const sessionIds = swts.map(swt => swt.session_id);
      finalSWTs = await this.populateMessages(swts, sessionIds);
    } else {
      // Optimized behavior: return metadata-only SWTs (for view sessions performance)
      console.log('Skipping message population for performance (metadata-only SWTs)');
      finalSWTs = swts;
    }
    
    // Sort SWTs by start time (most recent first)
    finalSWTs.sort((a, b) => b.start_time.localeCompare(a.start_time));
    
    // Calculate statistics
    const totalMessages = finalSWTs.reduce((sum, swt) => sum + swt.message_count, 0);
    const sessionsWithMessages = finalSWTs.filter(swt => swt.message_count > 0).length;
    
    const generationTime = Date.now() - startTime;
    console.log(`Generated ${finalSWTs.length} SWT objects in ${generationTime}ms using layered architecture`);
    
    return {
      swts: finalSWTs,
      totalSessions: finalSWTs.length,
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
export function createSWTService(koreApiService: IKoreApiService): SWTService {
  return new SWTService(koreApiService);
} 