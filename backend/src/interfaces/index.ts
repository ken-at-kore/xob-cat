import { SessionWithTranscript, SessionFilters, AnalysisResult, Message, ExistingClassifications } from '../../../shared/types';
import { SessionMetadata, KoreMessage } from '../services/koreApiService';

// Kore.ai API Service Interface
export interface IKoreApiService {
  getSessions(dateFrom: string, dateTo: string, skip?: number, limit?: number): Promise<SessionWithTranscript[]>;
  getMessages(dateFrom: string, dateTo: string, sessionIds: string[]): Promise<unknown[]>;
  getSessionById(sessionId: string): Promise<SessionWithTranscript | null>;
  getSessionsMetadata(options: { dateFrom: string; dateTo: string; limit?: number }): Promise<SessionMetadata[]>;
  getMessagesForSessions(sessionIds: string[], dateRange?: { dateFrom: string; dateTo: string }): Promise<KoreMessage[]>;
  getSessionMessages(sessionId: string): Promise<KoreMessage[]>;
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
  analyzeBatch(
    sessions: SessionWithTranscript[],
    existingClassifications: ExistingClassifications,
    openaiApiKey: string,
    modelId?: string
  ): Promise<{
    sessions: any[];
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    model: string;
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