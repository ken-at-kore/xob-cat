import { SWTService } from './swtService';
import { KoreApiService } from './koreApiService';
import { SessionWithTranscript } from '../models/swtModels';
import type { TimeWindow, AnalysisConfig, SessionFilters } from '../../../shared/types';

export interface SamplingResult {
  sessions: SessionWithTranscript[];
  timeWindows: TimeWindow[];
  totalFound: number;
}

export class SessionSamplingService {
  private readonly EXPANSION_STRATEGY = [
    { duration: 3, label: 'Initial 3-hour window' },
    { duration: 6, label: 'Extended to 6 hours' },
    { duration: 12, label: 'Extended to 12 hours' },
    { duration: 144, label: 'Extended to 6 days' } // 6 * 24 = 144 hours
  ];

  private readonly MIN_SESSION_COUNT = 10;
  private readonly MIN_MESSAGES_PER_SESSION = 2;

  constructor(
    private swtService: SWTService,
    private koreApiService: KoreApiService
  ) {}

  async sampleSessions(
    config: AnalysisConfig, 
    progressCallback?: (
      currentStep: string, 
      sessionsFound: number, 
      windowIndex: number, 
      windowLabel: string
    ) => void
  ): Promise<SamplingResult> {
    const timeWindows = this.generateTimeWindows(config.startDate, config.startTime);
    const allSessions = new Map<string, SessionWithTranscript>(); // Use Map for deduplication
    const usedWindows: TimeWindow[] = [];

    for (let i = 0; i < timeWindows.length; i++) {
      const window = timeWindows[i]!;
      const windowIndex = i;
      
      progressCallback?.(`Searching in ${window.label}...`, allSessions.size, windowIndex, window.label);
      
      const sessionsInWindow = await this.getSessionsInTimeWindow(window);
      const validSessions = this.filterValidSessions(sessionsInWindow);

      // Add sessions to our collection (Map handles deduplication by session_id)
      validSessions.forEach(session => {
        allSessions.set(session.session_id, session);
      });

      usedWindows.push(window);
      
      progressCallback?.(`Found ${allSessions.size} sessions in ${window.label}`, allSessions.size, windowIndex, window.label);

      // Check if we have enough sessions
      if (allSessions.size >= config.sessionCount) {
        progressCallback?.(`Found sufficient sessions (${allSessions.size}), completing search...`, allSessions.size, windowIndex, window.label);
        break;
      }
    }

    const sessionArray = Array.from(allSessions.values());

    // Check minimum threshold
    if (sessionArray.length < this.MIN_SESSION_COUNT) {
      throw new Error(
        `Insufficient sessions found. Found ${sessionArray.length} sessions, but need at least ${this.MIN_SESSION_COUNT}. ` +
        `Try expanding your time range or choosing a different date.`
      );
    }

    // Random sample to target count
    const sampledSessions = this.randomSample(sessionArray, config.sessionCount);

    // Now fetch messages ONLY for the sampled sessions to avoid timeout
    console.log(`Fetching messages for ${sampledSessions.length} sampled sessions...`);
    const sessionsWithMessages = await this.fetchMessagesForSessions(sampledSessions);

    return {
      sessions: sessionsWithMessages,
      timeWindows: usedWindows,
      totalFound: sessionArray.length
    };
  }

  generateTimeWindows(startDate: string, startTime: string): TimeWindow[] {
    const windows: TimeWindow[] = [];
    
    // Parse the start date and time (assuming ET timezone)
    const startDateTime = this.parseETDateTime(startDate, startTime);

    for (const strategy of this.EXPANSION_STRATEGY) {
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(endDateTime.getHours() + strategy.duration);

      windows.push({
        start: new Date(startDateTime),
        end: endDateTime,
        duration: strategy.duration,
        label: strategy.label
      });
    }

    return windows;
  }

  randomSample<T>(array: T[], count: number): T[] {
    if (array.length <= count) {
      return [...array];
    }

    // Fisher-Yates shuffle algorithm for unbiased sampling
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    return shuffled.slice(0, count);
  }

  private async fetchMessagesForSessions(sessions: SessionWithTranscript[]): Promise<SessionWithTranscript[]> {
    try {
      // Get the session IDs
      const sessionIds = sessions
        .map(s => s.session_id)
        .filter(id => id && id.trim() !== '');
      
      if (sessionIds.length === 0) {
        console.log('No valid session IDs to fetch messages for');
        return sessions;
      }

      // Find date range from sessions
      const startTimes = sessions.map(s => new Date(s.start_time).getTime());
      const endTimes = sessions.map(s => new Date(s.end_time).getTime());
      const minTime = new Date(Math.min(...startTimes));
      const maxTime = new Date(Math.max(...endTimes));
      
      // Add buffer to ensure we get all messages
      minTime.setHours(minTime.getHours() - 1);
      maxTime.setHours(maxTime.getHours() + 1);

      console.log(`Fetching messages for ${sessionIds.length} sessions from ${minTime.toISOString()} to ${maxTime.toISOString()}`);
      
      // Use the kore service to fetch messages
      const messages = await this.koreApiService.getMessages(
        minTime.toISOString(),
        maxTime.toISOString(),
        sessionIds
      );

      console.log(`Retrieved ${messages.length} messages for sampled sessions`);

      // Group messages by session
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
      return sessions.map(session => ({
        ...session,
        messages: messagesBySession[session.session_id] || []
      }));
    } catch (error) {
      console.error('Error fetching messages for sampled sessions:', error);
      // Return sessions without messages on error
      return sessions;
    }
  }

  private async getSessionsInTimeWindow(window: TimeWindow): Promise<SessionWithTranscript[]> {
    try {
      console.log(`Fetching sessions for ${window.label} from ${window.start.toISOString()} to ${window.end.toISOString()}`);
      
      // Get ONLY session metadata first (without messages) to avoid timeout
      // We'll fetch messages later only for the sampled sessions
      const sessions = await this.koreApiService.getSessions(
        window.start.toISOString(),
        window.end.toISOString(),
        0,
        10000 // fetch up to 10k sessions
      );
      
      console.log(`Found ${sessions.length} sessions in window ${window.label}`);
      
      // Convert to SessionWithTranscript format but with empty messages for now
      // We'll populate messages later only for sampled sessions
      const swts: SessionWithTranscript[] = sessions.map(session => ({
        ...session,
        messages: [], // Empty for now, will populate later for sampled sessions only
        user_message_count: session.user_message_count || 0,
        bot_message_count: session.bot_message_count || 0,
        duration_seconds: session.duration_seconds || 0 // Ensure duration_seconds is always present
      }));
      
      return swts;
    } catch (error) {
      console.error(`Error fetching sessions for window ${window.label}:`, error);
      return [];
    }
  }

  private filterValidSessions(sessions: SessionWithTranscript[]): SessionWithTranscript[] {
    return sessions.filter(session => {
      // If messages are not populated (empty array), use message count as proxy
      if (session.messages.length === 0) {
        // Use message_count metadata instead
        return session.message_count >= this.MIN_MESSAGES_PER_SESSION;
      }

      // Must have minimum number of messages
      if (session.messages.length < this.MIN_MESSAGES_PER_SESSION) {
        return false;
      }

      // Must have at least some meaningful content
      const totalContent = session.messages
        .map(msg => msg.message?.trim() || '')
        .join(' ')
        .trim();

      if (totalContent.length < 10) { // Minimum content threshold
        return false;
      }

      return true;
    });
  }

  private parseETDateTime(dateString: string, timeString: string): Date {
    // Parse date and time in ET timezone
    // Note: This is a simplified conversion. In production, you'd want to use a proper timezone library like date-fns-tz
    const [year, month, day] = dateString.split('-').map(Number);
    const [hours, minutes] = timeString.split(':').map(Number);

    // Create date assuming it's already in ET, then convert to UTC
    const etOffset = this.getETOffset(new Date(year!, (month! - 1), day!));
    
    // Create date in UTC by directly adjusting for ET offset
    // ET time + offset = UTC time
    const utcHours = (hours! + etOffset) % 24;
    const date = new Date(Date.UTC(year!, (month! - 1), day!, utcHours, minutes!));
    
    // Handle day rollover if needed
    if (hours! + etOffset >= 24) {
      date.setUTCDate(date.getUTCDate() + 1);
    }

    return date;
  }

  private getETOffset(date: Date): number {
    // Simplified ET offset calculation
    // In reality, you'd want to handle DST transitions properly
    const month = date.getMonth();
    const day = date.getDate();
    const dayOfWeek = date.getDay();

    // Rough DST calculation (second Sunday in March to first Sunday in November)
    const isDST = month > 2 && month < 10; // Simplified - March through October
    
    return isDST ? 4 : 5; // EDT is UTC-4, EST is UTC-5
  }

  private formatTimeForAPI(date: Date): string {
    return date.getUTCHours().toString().padStart(2, '0') + ':' + 
           date.getUTCMinutes().toString().padStart(2, '0');
  }
}