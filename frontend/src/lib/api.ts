import { SessionWithTranscript, AnalysisResult, SessionsResponse, AnalysisResponse, SessionFilters } from '@/shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Sessions API
  async getSessions(filters?: SessionFilters): Promise<SessionsResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    
    return this.request<SessionsResponse>(`/sessions?${params.toString()}`);
  }

  async getSession(sessionId: string): Promise<{ success: boolean; data: SessionWithTranscript }> {
    return this.request<{ success: boolean; data: SessionWithTranscript }>(`/sessions/${sessionId}`);
  }

  // Analysis API
  async analyzeSession(sessionId: string, messages: any[]): Promise<AnalysisResponse> {
    return this.request<AnalysisResponse>('/analysis/session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, messages }),
    });
  }

  async analyzeSessionsBatch(sessions: Array<{ session_id: string; messages: any[] }>): Promise<AnalysisResponse> {
    return this.request<AnalysisResponse>('/analysis/batch', {
      method: 'POST',
      body: JSON.stringify({ sessions }),
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; service: string }> {
    return this.request<{ status: string; timestamp: string; service: string }>('/health');
  }
}

export const apiClient = new ApiClient(API_BASE_URL); 