/**
 * Transcript Sanitization Service
 * 
 * Centralizes all message sanitization logic for cleaning up bot and user messages
 * from the Kore.ai API. This service handles various patterns including JSON bot
 * messages, SSML speak tags, and system-generated messages.
 * 
 * Sanitization Patterns:
 * 1. JSON Bot Messages - Extracts text from JSON-formatted bot responses
 * 2. SSML Speak Tags - Removes SSML markup and extracts plain text
 * 3. Welcome Task Messages - Filters out system-generated "Welcome Task" messages
 * 4. Hangup Command Messages - Filters out JSON bot messages containing hangup commands
 * 5. HTML Entity Decoding - Converts HTML entities like &quot; to actual characters
 * 6. MAX_NO_INPUT Replacement - Replaces "MAX_NO_INPUT" with "<User is silent>"
 * 7. Closing Message Filtering - Filters out bot closing messages that occur >8s after previous message
 * 
 * @module transcriptSanitizationService
 */

export interface SanitizationResult {
  sanitized: boolean;
  text: string | null;
  reason?: string;
}

export class TranscriptSanitizationService {
  // Pattern 7: Closing message text
  private static readonly CLOSING_MESSAGE = 'I am closing our current conversation as I have not received any input from you. We can start over when you need.';
  private static readonly CLOSING_MESSAGE_THRESHOLD_MS = 8000; // 8 seconds
  /**
   * Main entry point for sanitizing message text
   * @param text - The raw message text to sanitize
   * @param messageType - Whether this is a 'user' or 'bot' message
   * @returns SanitizationResult with cleaned text or null if message should be filtered
   */
  static sanitizeMessage(text: string, messageType: 'user' | 'bot'): SanitizationResult {
    if (!text || typeof text !== 'string') {
      return { sanitized: false, text: null, reason: 'Empty or invalid text' };
    }

    // Check if message should be filtered out entirely
    if (this.shouldFilterMessage(text, messageType)) {
      return { sanitized: true, text: null, reason: 'Filtered system message' };
    }

    // Apply sanitization patterns
    let sanitizedText = text;
    let wasSanitized = false;

    // Pattern 1: Extract text from JSON bot messages
    if (messageType === 'bot' && this.isJsonMessage(sanitizedText)) {
      const extracted = this.extractTextFromJson(sanitizedText);
      if (extracted) {
        sanitizedText = extracted;
        wasSanitized = true;
      }
    }

    // Pattern 2: Remove SSML speak tags
    if (this.hasSsmlTags(sanitizedText)) {
      sanitizedText = this.removeSsmlTags(sanitizedText);
      wasSanitized = true;
    }

    // Pattern 5: Decode HTML entities
    if (this.hasHtmlEntities(sanitizedText)) {
      sanitizedText = this.decodeHtmlEntities(sanitizedText);
      wasSanitized = true;
    }

    // Pattern 6: Replace MAX_NO_INPUT messages
    if (messageType === 'user' && this.isMaxNoInputMessage(sanitizedText)) {
      sanitizedText = '<User is silent>';
      wasSanitized = true;
    }

    // Trim whitespace
    sanitizedText = sanitizedText.trim();

    return {
      sanitized: wasSanitized,
      text: sanitizedText || null,
      reason: wasSanitized ? 'Text extracted and cleaned' : 'No sanitization needed'
    };
  }

  /**
   * Check if a message should be filtered out entirely
   */
  private static shouldFilterMessage(text: string, messageType: 'user' | 'bot'): boolean {
    // Pattern 3: Filter "Welcome Task" messages
    if (messageType === 'user' && text.trim().toLowerCase() === 'welcome task') {
      return true;
    }

    // Pattern 4: Filter hangup command JSON messages
    if (messageType === 'bot' && this.isHangupCommandMessage(text)) {
      return true;
    }

    return false;
  }

  /**
   * Check if text appears to be JSON
   */
  private static isJsonMessage(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.startsWith('{') && trimmed.endsWith('}');
  }

  /**
   * Extract bot message text from JSON-formatted messages
   * Handles the specific Kore.ai JSON format with "say" field
   */
  private static extractTextFromJson(jsonText: string): string | null {
    try {
      const parsed = JSON.parse(jsonText);
      
      // Look for the say.text field in various locations
      // Direct say.text
      if (parsed.say?.text) {
        if (Array.isArray(parsed.say.text)) {
          return parsed.say.text.join(' ');
        }
        return String(parsed.say.text);
      }

      // In data array (as shown in the example)
      if (Array.isArray(parsed.data)) {
        for (const item of parsed.data) {
          if (item.say?.text) {
            if (Array.isArray(item.say.text)) {
              return item.say.text.join(' ');
            }
            return String(item.say.text);
          }
        }
      }

      // Fallback: look for any "text" field
      const findText = (obj: any): string | null => {
        if (typeof obj !== 'object' || obj === null) return null;
        
        if ('text' in obj && typeof obj.text === 'string') {
          return obj.text;
        }
        
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const found = findText(item);
            if (found) return found;
          }
        } else {
          for (const key of Object.keys(obj)) {
            const found = findText(obj[key]);
            if (found) return found;
          }
        }
        
        return null;
      };

      return findText(parsed);
    } catch (error) {
      // If JSON parsing fails, return null to keep original text
      return null;
    }
  }

  /**
   * Check if text contains SSML speak tags
   */
  private static hasSsmlTags(text: string): boolean {
    return /<speak\b[^>]*>[\s\S]*<\/speak>/i.test(text) || 
           /<prosody\b[^>]*>[\s\S]*<\/prosody>/i.test(text);
  }

  /**
   * Remove SSML speak tags and extract inner text
   */
  private static removeSsmlTags(text: string): string {
    // Remove speak tags
    let cleaned = text.replace(/<speak\b[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/speak>/gi, '');
    
    // Remove prosody tags but keep the content
    cleaned = cleaned.replace(/<prosody\b[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/prosody>/gi, '');
    
    // Remove any other SSML tags
    cleaned = cleaned.replace(/<break\s*\/>/gi, ' ');
    cleaned = cleaned.replace(/<emphasis\b[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/emphasis>/gi, '');
    cleaned = cleaned.replace(/<say-as\b[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/say-as>/gi, '');
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * Check if text is a hangup command JSON message that should be filtered
   * Matches JSON messages with hangup commands like:
   * {"type":"command","command":"redirect","data":[{"verb":"hangup","headers":{}}]}
   */
  private static isHangupCommandMessage(text: string): boolean {
    if (!this.isJsonMessage(text)) {
      return false;
    }

    try {
      const parsed = JSON.parse(text);
      
      // Check if it's a command type message
      if (parsed.type !== 'command' || parsed.command !== 'redirect') {
        return false;
      }

      // Check if data array contains a hangup verb
      if (Array.isArray(parsed.data)) {
        for (const item of parsed.data) {
          if (item && typeof item === 'object' && item.verb === 'hangup') {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      // If JSON parsing fails, don't filter
      return false;
    }
  }

  /**
   * Check if text contains HTML entities
   */
  private static hasHtmlEntities(text: string): boolean {
    return /&[a-zA-Z][a-zA-Z0-9]*;|&#[0-9]+;|&#x[0-9a-fA-F]+;/.test(text);
  }

  /**
   * Decode HTML entities to their corresponding characters
   * Handles common entities like &quot;, &amp;, &lt;, &gt;, etc.
   */
  private static decodeHtmlEntities(text: string): string {
    // Common HTML entities mapping
    const htmlEntities: Record<string, string> = {
      '&quot;': '"',
      '&apos;': "'",
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&nbsp;': ' ',
      '&ndash;': '–',
      '&mdash;': '—',
      '&lsquo;': '\u2018',
      '&rsquo;': '\u2019',
      '&ldquo;': '\u201C',
      '&rdquo;': '\u201D',
      '&hellip;': '…',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™'
    };

    let decoded = text;

    // Replace named entities
    for (const [entity, replacement] of Object.entries(htmlEntities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), replacement);
    }

    // Replace numeric entities (decimal)
    decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
      return String.fromCharCode(parseInt(num, 10));
    });

    // Replace numeric entities (hexadecimal)
    decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    return decoded;
  }

  /**
   * Check if text is a MAX_NO_INPUT message that should be replaced
   * MAX_NO_INPUT indicates a timeout or no user input scenario
   */
  private static isMaxNoInputMessage(text: string): boolean {
    return text.trim().toUpperCase() === 'MAX_NO_INPUT';
  }

  /**
   * Check if text is the closing conversation message
   */
  private static isClosingMessage(text: string): boolean {
    return text.trim() === this.CLOSING_MESSAGE;
  }

  /**
   * Calculate time difference in milliseconds between two timestamps
   */
  private static getTimeDifferenceMs(timestamp1: string, timestamp2: string): number | null {
    try {
      const time1 = new Date(timestamp1).getTime();
      const time2 = new Date(timestamp2).getTime();
      if (isNaN(time1) || isNaN(time2)) {
        return null;
      }
      return Math.abs(time2 - time1);
    } catch {
      return null;
    }
  }

  /**
   * Batch sanitize an array of messages
   */
  static sanitizeMessages(messages: Array<{ message: string; message_type: 'user' | 'bot' }>): Array<{ 
    message: string; 
    message_type: 'user' | 'bot';
    sanitized?: boolean;
  }> {
    return messages
      .map(msg => {
        const result = this.sanitizeMessage(msg.message, msg.message_type);
        if (result.text === null) {
          // Filter out messages with null text
          return null;
        }
        return {
          ...msg,
          message: result.text,
          sanitized: result.sanitized
        };
      })
      .filter((msg): msg is NonNullable<typeof msg> => msg !== null);
  }

  /**
   * Batch sanitize an array of messages with timestamp-aware filtering
   * Pattern 7: Filters out closing messages that are last and occur >8s after previous
   */
  static sanitizeMessagesWithTimestamps(messages: Array<{ 
    message: string; 
    message_type: 'user' | 'bot';
    timestamp?: string;
  }>): Array<{ 
    message: string; 
    message_type: 'user' | 'bot';
    timestamp?: string;
    sanitized?: boolean;
  }> {
    // First pass: Apply all individual message sanitization
    const sanitized = messages
      .map(msg => {
        const result = this.sanitizeMessage(msg.message, msg.message_type);
        if (result.text === null) {
          // Filter out messages with null text
          return null;
        }
        return {
          ...msg,
          message: result.text,
          sanitized: result.sanitized
        };
      })
      .filter((msg): msg is NonNullable<typeof msg> => msg !== null);

    // Second pass: Check for closing message pattern
    if (sanitized.length >= 2) {
      const lastMessage = sanitized[sanitized.length - 1];
      const secondToLastMessage = sanitized[sanitized.length - 2];

      // Check if last message is the closing message from bot
      if (
        lastMessage &&
        secondToLastMessage &&
        lastMessage.message_type === 'bot' &&
        this.isClosingMessage(lastMessage.message) &&
        lastMessage.timestamp &&
        secondToLastMessage.timestamp
      ) {
        // Calculate time difference
        const timeDiff = this.getTimeDifferenceMs(secondToLastMessage.timestamp, lastMessage.timestamp);
        
        // Filter out if > 8 seconds
        if (timeDiff !== null && timeDiff > this.CLOSING_MESSAGE_THRESHOLD_MS) {
          return sanitized.slice(0, -1); // Remove last message
        }
      }
    }

    return sanitized;
  }
}