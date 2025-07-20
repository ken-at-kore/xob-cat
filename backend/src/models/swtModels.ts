/**
 * Session with Transcript (SWT) Data Models
 * 
 * This module defines the data structures for combining session history and conversation
 * transcripts into unified objects for analysis and display.
 * 
 * Classes:
 *   Message: Individual message within a conversation
 *   SessionWithTranscript: Combined session metadata and conversation transcript
 */

export interface Message {
  timestamp: string;
  message_type: 'user' | 'bot';
  message: string;
}

export interface SessionWithTranscript {
  // Session metadata (from session history)
  session_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  containment_type: 'agent' | 'selfService' | 'dropOff' | null;
  tags: any; // Can be array or object based on Kore.ai response
  metrics: Record<string, any>;
  
  // Conversation data (from conversation history)
  messages: Message[];
  
  // Computed properties
  duration_seconds: number | null;
  message_count: number;
  user_message_count: number;
  bot_message_count: number;
}

export class SWTBuilder {
  /**
   * Create a Message object from raw message data
   */
  static createMessage(rawMessage: any): Message | null {
    // Handle already converted messages (from KoreApiService)
    if (rawMessage.message && rawMessage.timestamp && rawMessage.message_type) {
      return {
        timestamp: rawMessage.timestamp,
        message_type: rawMessage.message_type,
        message: rawMessage.message
      };
    }

    // Handle raw Kore.ai messages
    const messageText = this.extractMessageText(rawMessage);
    if (!messageText) return null;

    return {
      timestamp: rawMessage.createdOn || '',
      message_type: rawMessage.type === 'incoming' ? 'user' : 'bot',
      message: messageText
    };
  }

  /**
   * Extract text content from Kore.ai message
   */
  private static extractMessageText(message: any): string | null {
    for (const component of message.components || []) {
      if (component.cT === 'text' && component.data?.text) {
        return component.data.text;
      }
    }
    return null;
  }

  /**
   * Create a SessionWithTranscript object from session data and messages
   */
  static createSWT(session: any, messages: any[]): SessionWithTranscript {
    // Convert messages to Message objects and filter out nulls
    const messageObjects = messages
      .map(msg => this.createMessage(msg))
      .filter((msg): msg is Message => msg !== null);

    // Sort messages by timestamp
    messageObjects.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Calculate metrics
    const messageCount = messageObjects.length;
    const userMessageCount = messageObjects.filter(msg => msg.message_type === 'user').length;
    const botMessageCount = messageObjects.filter(msg => msg.message_type === 'bot').length;

    // Calculate duration
    let durationSeconds: number | null = null;
    if (session.start_time && session.end_time) {
      try {
        const startTime = new Date(session.start_time).getTime();
        const endTime = new Date(session.end_time).getTime();
        const duration = (endTime - startTime) / 1000;
        durationSeconds = isNaN(duration) ? null : duration;
      } catch (error) {
        durationSeconds = null;
      }
    }

    return {
      session_id: session.sessionId || session.session_id || '',
      user_id: session.userId || session.user_id || '',
      start_time: session.start_time || '',
      end_time: session.end_time || '',
      containment_type: session.containment_type || null,
      tags: session.tags || [],
      metrics: session.metrics || {},
      messages: messageObjects,
      duration_seconds: durationSeconds,
      message_count: messageCount,
      user_message_count: userMessageCount,
      bot_message_count: botMessageCount
    };
  }

  /**
   * Group messages by session ID
   */
  static groupMessagesBySession(messages: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const message of messages) {
      const sessionId = message.sessionId;
      if (sessionId) {
        if (!grouped[sessionId]) {
          grouped[sessionId] = [];
        }
        grouped[sessionId].push(message);
      }
    }
    
    return grouped;
  }

  /**
   * Get user messages from a SWT
   */
  static getUserMessages(swt: SessionWithTranscript): Message[] {
    return swt.messages.filter(msg => msg.message_type === 'user');
  }

  /**
   * Get bot messages from a SWT
   */
  static getBotMessages(swt: SessionWithTranscript): Message[] {
    return swt.messages.filter(msg => msg.message_type === 'bot');
  }

  /**
   * Get conversation summary for a SWT
   */
  static getConversationSummary(swt: SessionWithTranscript): string {
    if (swt.messages.length === 0) {
      return 'No messages in this session';
    }

    const userMessages = this.getUserMessages(swt);
    const botMessages = this.getBotMessages(swt);

    return `Session with ${swt.message_count} messages (${userMessages.length} user, ${botMessages.length} bot)`;
  }

  /**
   * Convert SWT to plain object for JSON serialization
   */
  static toPlainObject(swt: SessionWithTranscript): Record<string, any> {
    return {
      session_id: swt.session_id,
      user_id: swt.user_id,
      start_time: swt.start_time,
      end_time: swt.end_time,
      containment_type: swt.containment_type,
      tags: swt.tags,
      metrics: swt.metrics,
      messages: swt.messages,
      duration_seconds: swt.duration_seconds,
      message_count: swt.message_count,
      user_message_count: swt.user_message_count,
      bot_message_count: swt.bot_message_count
    };
  }

  /**
   * Create SWT from plain object
   */
  static fromPlainObject(data: Record<string, any>): SessionWithTranscript {
    return {
      session_id: data.session_id || '',
      user_id: data.user_id || '',
      start_time: data.start_time || '',
      end_time: data.end_time || '',
      containment_type: data.containment_type || null,
      tags: data.tags || [],
      metrics: data.metrics || {},
      messages: data.messages || [],
      duration_seconds: data.duration_seconds || null,
      message_count: data.message_count || 0,
      user_message_count: data.user_message_count || 0,
      bot_message_count: data.bot_message_count || 0
    };
  }
} 