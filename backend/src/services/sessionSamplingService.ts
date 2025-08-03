import { SWTService } from './swtService';
import { IKoreApiService } from '../interfaces';
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
    private koreApiService: IKoreApiService
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
    console.log(`[SessionSamplingService] Starting session sampling for ${config.startDate} ${config.startTime} (target: ${config.sessionCount})`);
    console.log(`[SessionSamplingService] Using service: ${this.koreApiService.constructor.name}`);
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

      console.log(`Using new lazy loading approach to populate messages for ${sessionIds.length} sampled sessions`);
      
      // NEW OPTIMIZED APPROACH: Use SWTService lazy loading to populate messages
      const sessionsWithMessages = await this.swtService.populateMessages(sessions, sessionIds);

      console.log(`Successfully populated messages for ${sessionIds.length} sessions using lazy loading`);

      // IMPORTANT: Apply filtering again now that messages are populated
      // This ensures sessions with insufficient messages are excluded from the final result
      console.log(`Applying final filtering to ${sessionsWithMessages.length} sessions with populated messages`);
      const finalFilteredSessions = this.filterValidSessions(sessionsWithMessages);
      console.log(`Final result: ${finalFilteredSessions.length} sessions passed filtering with populated messages`);

      return finalFilteredSessions;
    } catch (error) {
      console.error('Error fetching messages for sampled sessions:', error);
      // Return sessions without messages on error
      return sessions;
    }
  }

  private async getSessionsInTimeWindow(window: TimeWindow): Promise<SessionWithTranscript[]> {
    try {
      console.log(`[SessionSamplingService] Fetching session metadata for ${window.label}: ${window.start.toISOString()} to ${window.end.toISOString()}`);
      console.log(`[SessionSamplingService] Using koreApiService type: ${this.koreApiService.constructor.name}`);
      console.log(`[SessionSamplingService] Service config botId: ${(this.koreApiService as any).config?.botId}`);
      
      // NEW OPTIMIZED APPROACH: Get ONLY session metadata (no messages) using granular method
      const sessionMetadata = await this.koreApiService.getSessionsMetadata({
        dateFrom: window.start.toISOString(),
        dateTo: window.end.toISOString(),
        limit: 10000 // fetch up to 10k session metadata objects
      });
      
      console.log(`[SessionSamplingService] Found ${sessionMetadata.length} session metadata objects in window ${window.label}`);
      
      // Convert metadata to SWT format (no messages yet - will be populated later for sampled sessions only)
      const swts = await this.swtService.createSWTsFromMetadata(sessionMetadata);
      
      console.log(`Created ${swts.length} SWT objects from metadata (no messages) in ${window.label}`);
      
      return swts;
    } catch (error) {
      console.error(`Error fetching session metadata for window ${window.label}:`, error);
      return [];
    }
  }

  private filterValidSessions(sessions: SessionWithTranscript[]): SessionWithTranscript[] {
    return sessions.filter(session => {
      // If messages are not populated (empty array), we're in metadata-only mode
      if (session.messages.length === 0) {
        // In metadata-only mode, check if we have basic session info
        // The Kore.ai API returns metrics.total_messages as 0 even for sessions with messages,
        // so we can't rely on message_count for filtering at this stage.
        // Instead, allow all sessions through if they have basic required fields.
        
        // Must have session ID (essential for later message fetching)
        if (!session.session_id || session.session_id.trim() === '') {
          return false;
        }
        
        // Must have user ID (indicates real user interaction)
        if (!session.user_id || session.user_id.trim() === '') {
          return false;
        }
        
        // Must have start time (essential for time-based queries)
        if (!session.start_time) {
          return false;
        }
        
        // Allow all sessions with basic metadata through
        // They will be properly filtered after messages are populated
        return true;
      }

      // Messages are populated - apply full filtering logic
      
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