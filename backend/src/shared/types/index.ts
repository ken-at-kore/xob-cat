// Shared types for XOB CAT - used by both frontend and backend

export interface Message {
  timestamp: string;
  message_type: 'user' | 'bot';
  message: string;
}

export interface SessionWithTranscript {
  // Session metadata
  session_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  containment_type: 'agent' | 'selfService' | 'dropOff';
  tags: string[];
  metrics: Record<string, any>;
  
  // Conversation data
  messages: Message[];
  
  // Computed properties
  duration_seconds?: number;
  message_count: number;
  user_message_count: number;
  bot_message_count: number;
}

export interface AnalysisResult {
  session_id: string;
  user_id: string;
  general_intent: string;
  call_outcome: 'Transfer' | 'Contained';
  transfer_reason?: string;
  drop_off_location?: string;
  notes: string;
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost: number;
  };
  analyzed_at: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  timestamp: string;
}

export interface SessionFilters {
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  bot_id?: string;
  containment_type?: string;
  limit?: number;
  skip?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SessionsResponse extends ApiResponse<SessionWithTranscript[]> {
  total_count?: number;
  has_more?: boolean;
}

export interface AnalysisResponse extends ApiResponse<AnalysisResult[]> {
  token_usage?: TokenUsage;
}

// OpenAI function calling schema for session analysis
export const ANALYSIS_FUNCTION_SCHEMA = {
  name: "analyze_session",
  description: "Analyze a chatbot session and classify its intent, outcome, and key details",
  parameters: {
    type: "object",
    properties: {
      general_intent: {
        type: "string",
        description: "What the user is asking about (1-2 words). Examples: Claim Status, Billing, Eligibility, Live Agent, Provider Enrollment, Portal Access, Authorization. Use 'Unknown' if unclear."
      },
      call_outcome: {
        type: "string",
        enum: ["Transfer", "Contained"],
        description: "Whether the session was transferred to a live agent or contained by the bot"
      },
      transfer_reason: {
        type: "string",
        description: "Why the session was transferred (only if call_outcome is 'Transfer'). Examples: Invalid Provider ID, Invalid Member ID, Invalid Claim Number, No Provider ID, Inactive Provider ID, Authentication Failed, Technical Issue, Policy Not Found, Can't Capture Policy Number. Leave empty if not transferred."
      },
      drop_off_location: {
        type: "string",
        description: "Where in the conversation flow the user dropped off (only if call_outcome is 'Transfer'). Examples: Policy Number Prompt, Authentication, Claim Details, Member Information, Provider ID, Date of Service, Caller Name. Leave empty if not transferred."
      },
      notes: {
        type: "string",
        description: "One sentence summary of what happened in the session"
      }
    },
    required: ["general_intent", "call_outcome", "notes"]
  }
} as const;

// GPT model selection types
export interface GptModel {
  id: string;
  name: string;
  apiModelString: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

export const GPT_MODELS: GptModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    apiModelString: 'gpt-4o',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    apiModelString: 'gpt-4o-mini',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1 (base)',
    apiModelString: 'gpt-4.1',
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 8.00
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 mini',
    apiModelString: 'gpt-4.1-mini',
    inputPricePerMillion: 0.40,
    outputPricePerMillion: 1.60
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 nano',
    apiModelString: 'gpt-4.1-nano',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40
  }
];

// Utility functions for GPT models
export function getGptModelById(id: string): GptModel | undefined {
  return GPT_MODELS.find(model => model.id === id);
}

export function calculateModelCost(inputTokens: number, outputTokens: number, model: GptModel): number {
  const inputCost = (inputTokens / 1_000_000) * model.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * model.outputPricePerMillion;
  return inputCost + outputCost;
}

// Auto-Analyze feature types
export interface AnalysisConfig {
  startDate: string; // ISO date string
  startTime: string; // HH:MM format in ET
  sessionCount: number; // 10-1000
  openaiApiKey: string;
  modelId: string; // GPT model ID
}

export interface SessionWithFacts extends SessionWithTranscript {
  facts: {
    generalIntent: string;
    sessionOutcome: 'Transfer' | 'Contained';
    transferReason: string; // Empty if Contained
    dropOffLocation: string; // Empty if Contained
    notes: string;
  };
  analysisMetadata: {
    tokensUsed: number;
    processingTime: number;
    batchNumber: number;
    timestamp: string;
    model?: string;
  };
}

export interface AnalysisProgress {
  analysisId: string;
  phase: 'sampling' | 'analyzing' | 'generating_summary' | 'complete' | 'error';
  currentStep: string;
  sessionsFound: number;
  sessionsProcessed: number;
  totalSessions: number;
  batchesCompleted: number;
  totalBatches: number;
  tokensUsed: number;
  estimatedCost: number;
  modelId?: string; // Selected GPT model for analysis
  eta?: number; // seconds
  error?: string;
  startTime: string;
  endTime?: string;
  // Sampling phase specific progress
  samplingProgress?: {
    currentWindowIndex: number;
    totalWindows: number;
    currentWindowLabel: string;
    targetSessionCount: number;
  };
}

export interface AnalysisSummary {
  overview: string;
  summary: string;
  containmentSuggestion: string;
  generatedAt: string;
  sessionsAnalyzed: number;
  statistics: {
    totalSessions: number;
    transferRate: number;
    containmentRate: number;
    averageSessionLength: number;
    averageMessagesPerSession: number;
  };
}

export interface AnalysisResults {
  sessions: SessionWithFacts[];
  analysisSummary?: AnalysisSummary | undefined;
}

export interface BatchTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
}

export interface ExistingClassifications {
  generalIntent: Set<string>;
  transferReason: Set<string>;
  dropOffLocation: Set<string>;
}

export interface TimeWindow {
  start: Date;
  end: Date;
  duration: number; // hours
  label: string;
}

export interface ClassificationStats {
  totalSessions: number;
  uniqueIntents: number;
  transferRate: number;
  containmentRate: number;
  topTransferReasons: Array<{ reason: string; count: number; percentage: number }>;
  topIntents: Array<{ intent: string; count: number; percentage: number }>;
  consistency: {
    intentConsistency: number; // 0-1 score
    reasonConsistency: number; // 0-1 score
    locationConsistency: number; // 0-1 score
  };
}

// Auto-Analyze OpenAI function calling schema for batch processing
export const AUTO_ANALYZE_FUNCTION_SCHEMA = {
  name: "analyze_sessions_batch",
  description: "Analyze a batch of session transcripts and classify each session",
  parameters: {
    type: "object",
    properties: {
      sessions: {
        type: "array",
        description: "Array of analyzed sessions",
        items: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "The user ID of the session"
            },
            general_intent: {
              type: "string",
              description: "What the user is trying to accomplish (1-2 words). Examples: Claim Status, Billing, Eligibility, Live Agent, Provider Enrollment, Portal Access, Authorization. Use 'Unknown' if unclear."
            },
            session_outcome: {
              type: "string",
              enum: ["Transfer", "Contained"],
              description: "Whether the session was transferred to a live agent or contained by the bot"
            },
            transfer_reason: {
              type: "string",
              description: "Why the session was transferred (only if session_outcome is 'Transfer'). Examples: Invalid Provider ID, Invalid Member ID, Invalid Claim Number, No Provider ID, Inactive Provider ID, Authentication Failed, Technical Issue, Policy Not Found, Can't Capture Policy Number. Leave empty if not transferred."
            },
            drop_off_location: {
              type: "string",
              description: "Where in the session flow (at which prompt) the user dropped off (started getting routed to an agent). Will only have a value if session_outcome is 'Transfer'). Examples: Policy Number Prompt, Authentication, Claim Details, Member Information, Provider ID, Date of Service, User Name. Leave empty if not transferred."
            },
            notes: {
              type: "string",
              description: "One sentence summary of what happened in the session"
            }
          },
          required: ["user_id", "general_intent", "session_outcome", "transfer_reason", "drop_off_location", "notes"]
        }
      }
    },
    required: ["sessions"]
  }
} as const;

// Analysis Export File Types for Report Viewer Feature
export interface AnalysisExportMetadata {
  version: string;              // Semantic version (e.g., "1.0.0")
  schemaVersion: string;        // Schema compatibility (e.g., "1.0")
  exportedAt: string;           // ISO 8601 timestamp
  exportedBy: string;           // App version (e.g., "XOB-CAT-1.0.0")
  requiredFeatures: string[];   // Features needed to display properly
  optionalFeatures: string[];   // Enhanced features if available
}

export interface AnalysisExportSummary {
  overview: string;                               // AI-generated overview
  detailedAnalysis: string;                      // AI-generated detailed analysis
  totalSessions: number;
  containmentRate: number;
  topTransferReasons: Record<string, number>;
  topIntents: Record<string, number>;
  topDropOffLocations: Record<string, number>;
}

export interface AnalysisExportChartData {
  sessionOutcomes: Array<{ name: string; value: number }>;
  transferReasons: Array<{ reason: string; count: number; percentage: number }>;
  dropOffLocations: Array<{ location: string; count: number }>;
  generalIntents: Array<{ intent: string; count: number }>;
}

export interface AnalysisExportCostAnalysis {
  totalTokens: number;
  estimatedCost: number;
  modelUsed: string;
}

export interface AnalysisExportFile {
  metadata: AnalysisExportMetadata;
  analysisConfig: {
    startDate: string;
    startTime: string;
    sessionCount: number;
    requestedAt: string;
    completedAt: string;
  };
  sessions: SessionWithFacts[];
  summary: AnalysisExportSummary;
  chartData: AnalysisExportChartData;
  costAnalysis: AnalysisExportCostAnalysis;
}

// Version compatibility types
export interface VersionCompatibility {
  supportedVersions: string[];
  deprecatedVersions: string[];
  unsupportedVersions: string[];
  requiredFeatures: string[];
  optionalFeatures?: string[];
}

export const ANALYSIS_FILE_VERSION = "1.0.0";
export const ANALYSIS_FILE_SCHEMA_VERSION = "1.0";
export const ANALYSIS_FILE_APP_VERSION = "XOB-CAT-1.0.0";

export const VERSION_COMPATIBILITY_MATRIX: Record<string, VersionCompatibility> = {
  "1.0": {
    supportedVersions: ["1.0.0", "1.0.1", "1.0.2"],
    deprecatedVersions: [],
    unsupportedVersions: [],
    requiredFeatures: ["basic-charts", "session-analysis"],
    optionalFeatures: ["advanced-charts", "ai-summary"]
  }
}; 