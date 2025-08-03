import { ISessionDataService, IKoreApiService } from '../interfaces';
import { SessionWithTranscript, SessionFilters } from '../../../shared/types';
import { ServiceFactory } from '../factories/serviceFactory';
import { MockSessionDataService } from '../__mocks__/sessionDataService.mock';

export class RealSessionDataService implements ISessionDataService {
  private mockService = new MockSessionDataService();

  async getSessions(
    filters: SessionFilters, 
    credentials?: { botId: string; clientId: string; clientSecret: string }
  ): Promise<SessionWithTranscript[]> {
    // If credentials are provided, try to use real Kore API service
    if (credentials) {
      try {
        const koreApiService = ServiceFactory.createKoreApiService({
          botId: credentials.botId,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret
        });

        // Convert filters to date range for Kore.ai API
        let dateFrom: string;
        let dateTo: string;
        
        if (filters.start_date) {
          dateFrom = filters.start_date;
          if (filters.end_date) {
            // When both dates provided, add 1 day to end_date to make it inclusive
            const endDate = new Date(filters.end_date);
            endDate.setDate(endDate.getDate() + 1);
            dateTo = endDate.toISOString().split('T')[0] || '';
          } else {
            // If only start_date is provided, filter for that entire day
            const startDate = new Date(filters.start_date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            dateTo = endDate.toISOString().split('T')[0] || '';
          }
        } else {
          // Default: last 7 days
          dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          dateTo = new Date().toISOString();
        }

        console.log('🔗 RealSessionDataService: Using real Kore.ai API');
        const sessions = await koreApiService.getSessions(
          dateFrom,
          dateTo,
          filters.skip || 0,
          filters.limit || 1000
        );

        if (sessions && sessions.length > 0) {
          console.log(`🔗 RealSessionDataService: Found ${sessions.length} sessions from real API`);
          
          // Apply additional filtering that isn't handled by the API
          let filteredSessions = sessions;
          
          if (filters.containment_type) {
            filteredSessions = filteredSessions.filter((s) => 
              s.containment_type === filters.containment_type
            );
          }

          // Apply time filtering if needed
          if (filters.start_date && filters.start_time) {
            const timeParts = filters.start_time.split(':');
            if (timeParts.length === 2) {
              const hours = parseInt(timeParts[0] || '0');
              const minutes = parseInt(timeParts[1] || '0');
              const startDate = new Date(`${filters.start_date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00.000-04:00`);
              filteredSessions = filteredSessions.filter((s) => new Date(s.start_time) >= startDate);
            }
          }
          
          if (filters.end_date && filters.end_time) {
            const timeParts = filters.end_time.split(':');
            if (timeParts.length === 2) {
              const hours = parseInt(timeParts[0] || '23');
              const minutes = parseInt(timeParts[1] || '59');
              const endDate = new Date(`${filters.end_date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:59.999-04:00`);
              filteredSessions = filteredSessions.filter((s) => new Date(s.start_time) <= endDate);
            }
          }

          return filteredSessions;
        }
      } catch (error) {
        console.error('🔗 RealSessionDataService: Error with real API, falling back to mock:', error);
      }
    }

    // Fall back to mock data
    console.log('🔗 RealSessionDataService: Using mock data');
    return this.mockService.getSessions(filters);
  }

  generateMockSessions(filters: SessionFilters): SessionWithTranscript[] {
    return this.mockService.generateMockSessions(filters);
  }
}

// Factory function for creating real session data service
export function createRealSessionDataService(): ISessionDataService {
  return new RealSessionDataService();
}