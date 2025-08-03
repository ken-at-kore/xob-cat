import { IKoreApiService } from '../interfaces';
import { SessionWithTranscript } from '../../../shared/types';
import { KoreApiService, KoreApiConfig, SessionMetadata, KoreMessage } from './koreApiService';

export class RealKoreApiService implements IKoreApiService {
  private koreApiService: KoreApiService;

  constructor(config: KoreApiConfig) {
    this.koreApiService = new KoreApiService(config);
  }

  async getSessions(dateFrom: string, dateTo: string, skip = 0, limit = 1000): Promise<SessionWithTranscript[]> {
    return this.koreApiService.getSessions(dateFrom, dateTo, skip, limit);
  }

  async getMessages(dateFrom: string, dateTo: string, sessionIds: string[]): Promise<unknown[]> {
    return this.koreApiService.getMessages(dateFrom, dateTo, sessionIds);
  }

  async getSessionById(sessionId: string): Promise<SessionWithTranscript | null> {
    // Note: This method doesn't exist in the current KoreApiService
    // For now, return null - this can be implemented later if needed
    console.warn(`getSessionById not implemented in KoreApiService for session: ${sessionId}`);
    return null;
  }

  async getSessionsMetadata(options: { dateFrom: string; dateTo: string; limit?: number }): Promise<SessionMetadata[]> {
    return this.koreApiService.getSessionsMetadata(options);
  }

  async getMessagesForSessions(sessionIds: string[], dateRange?: { dateFrom: string; dateTo: string }): Promise<KoreMessage[]> {
    return this.koreApiService.getMessagesForSessions(sessionIds, dateRange);
  }

  async getSessionMessages(sessionId: string): Promise<KoreMessage[]> {
    return this.koreApiService.getSessionMessages(sessionId);
  }
}

// Factory function for creating real Kore API service
export function createRealKoreApiService(config: KoreApiConfig): IKoreApiService {
  return new RealKoreApiService(config);
}