import { 
  SessionWithTranscript, 
  AnalysisResult, 
  SessionsResponse, 
  AnalysisResponse, 
  SessionFilters,
  AnalysisConfig,
  AnalysisProgress,
  SessionWithFacts,
  ApiResponse
} from '@/shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// API Error class for better error handling
export class ApiError extends Error {
  public status: number;
  public statusText: string;
  public data?: any;

  constructor(status: number, statusText: string, data?: any, message?: string) {
    super(message || `API request failed: ${status} ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

// Standard API response interface to match backend
interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  meta?: {
    total_count?: number;
    has_more?: boolean;
    page?: number;
    limit?: number;
    [key: string]: any;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      const responseData: StandardApiResponse<T> = await response.json();

      if (!response.ok) {
        throw new ApiError(
          response.status,
          response.statusText,
          responseData,
          responseData.message || responseData.error || 'Request failed'
        );
      }

      if (!responseData.success) {
        throw new ApiError(
          response.status,
          'Request failed',
          responseData,
          responseData.message || responseData.error || 'Request was not successful'
        );
      }

      return responseData.data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Network error or other fetch errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(0, 'Network Error', null, 'Unable to connect to the server. Please check your internet connection.');
      }

      // JSON parsing error
      if (error instanceof SyntaxError) {
        throw new ApiError(0, 'Parse Error', null, 'Invalid response format from server.');
      }

      // Unknown error
      throw new ApiError(0, 'Unknown Error', null, error instanceof Error ? error.message : 'An unknown error occurred.');
    }
  }

  // Sessions API
  async getSessions(filters?: SessionFilters): Promise<SessionWithTranscript[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    
    return this.request<SessionWithTranscript[]>(`/api/analysis/sessions?${params.toString()}`);
  }

  async getSession(sessionId: string): Promise<SessionWithTranscript> {
    return this.request<SessionWithTranscript>(`/api/analysis/sessions/${sessionId}`);
  }

  // Analysis API
  async analyzeSession(sessionId: string, messages: any[]): Promise<{ analyses: AnalysisResult[]; token_usage?: any }> {
    return this.request<{ analyses: AnalysisResult[]; token_usage?: any }>('/api/analysis/session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, messages }),
    });
  }

  async analyzeSessionsBatch(sessions: Array<{ session_id: string; messages: any[] }>): Promise<{ analyses: AnalysisResult[]; token_usage?: any }> {
    return this.request<{ analyses: AnalysisResult[]; token_usage?: any }>('/api/analysis/batch', {
      method: 'POST',
      body: JSON.stringify({ sessions }),
    });
  }

  // Auto-Analyze API
  async startAutoAnalysis(config: AnalysisConfig): Promise<ApiResponse<{ analysisId: string }>> {
    const response = await fetch(`${this.baseUrl}/api/analysis/auto-analyze/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // In a real implementation, these would come from authentication context
        'x-bot-id': 'default-bot',
        'x-jwt-token': 'default-token'
      },
      body: JSON.stringify(config)
    });
    
    return response.json();
  }

  async getAutoAnalysisProgress(analysisId: string): Promise<ApiResponse<AnalysisProgress>> {
    const response = await fetch(`${this.baseUrl}/api/analysis/auto-analyze/progress/${analysisId}`, {
      headers: {
        'x-bot-id': 'default-bot',
        'x-jwt-token': 'default-token'
      }
    });
    
    return response.json();
  }

  async getAutoAnalysisResults(analysisId: string): Promise<ApiResponse<SessionWithFacts[]>> {
    const response = await fetch(`${this.baseUrl}/api/analysis/auto-analyze/results/${analysisId}`, {
      headers: {
        'x-bot-id': 'default-bot',
        'x-jwt-token': 'default-token'
      }
    });
    
    return response.json();
  }

  async cancelAutoAnalysis(analysisId: string): Promise<ApiResponse<{ cancelled: boolean }>> {
    const response = await fetch(`${this.baseUrl}/api/analysis/auto-analyze/${analysisId}`, {
      method: 'DELETE',
      headers: {
        'x-bot-id': 'default-bot',
        'x-jwt-token': 'default-token'
      }
    });
    
    return response.json();
  }

  // Health check
  async healthCheck(): Promise<{ status: string; service: string; environment: string; uptime: number }> {
    return this.request<{ status: string; service: string; environment: string; uptime: number }>('/health');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// Auto-Analyze API convenience object
export const autoAnalyze = {
  startAnalysis: (config: AnalysisConfig) => apiClient.startAutoAnalysis(config),
  getProgress: (analysisId: string) => apiClient.getAutoAnalysisProgress(analysisId),
  getResults: (analysisId: string) => apiClient.getAutoAnalysisResults(analysisId),
  cancel: (analysisId: string) => apiClient.cancelAutoAnalysis(analysisId)
}; 