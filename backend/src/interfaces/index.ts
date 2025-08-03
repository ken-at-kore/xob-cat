import { SessionWithTranscript, SessionFilters, AnalysisResult, Message } from '../../../shared/types';

// Kore.ai API Service Interface
export interface IKoreApiService {
  getSessions(dateFrom: string, dateTo: string, skip?: number, limit?: number): Promise<SessionWithTranscript[]>;
  getMessages(dateFrom: string, dateTo: string, sessionIds: string[]): Promise<unknown[]>;
  getSessionById(sessionId: string): Promise<SessionWithTranscript | null>;
}

// OpenAI Service Interface
export interface IOpenAIService {
  analyzeSession(messages: Message[], apiKey?: string): Promise<{
    analysis: AnalysisResult;
    cost: number;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
}

// Session Data Service Interface (combines mock data service functionality)
export interface ISessionDataService {
  getSessions(filters: SessionFilters, credentials?: { botId: string; clientId: string; clientSecret: string }): Promise<SessionWithTranscript[]>;
  generateMockSessions(filters: SessionFilters): SessionWithTranscript[];
}

// Configuration for service types
export enum ServiceType {
  REAL = 'real',
  MOCK = 'mock'
}

export interface ServiceConfig {
  type: ServiceType;
  environment: 'test' | 'development' | 'production';
}