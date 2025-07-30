export interface Message {
    timestamp: string;
    message_type: 'user' | 'bot';
    message: string;
}
export interface SessionWithTranscript {
    session_id: string;
    user_id: string;
    start_time: string;
    end_time: string;
    containment_type: 'agent' | 'selfService' | 'dropOff';
    tags: string[];
    metrics: Record<string, any>;
    messages: Message[];
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
export declare const ANALYSIS_FUNCTION_SCHEMA: {
    readonly name: "analyze_session";
    readonly description: "Analyze a chatbot session and classify its intent, outcome, and key details";
    readonly parameters: {
        readonly type: "object";
        readonly properties: {
            readonly general_intent: {
                readonly type: "string";
                readonly description: "What the user is asking about (1-2 words). Examples: Claim Status, Billing, Eligibility, Live Agent, Provider Enrollment, Portal Access, Authorization. Use 'Unknown' if unclear.";
            };
            readonly call_outcome: {
                readonly type: "string";
                readonly enum: readonly ["Transfer", "Contained"];
                readonly description: "Whether the session was transferred to a live agent or contained by the bot";
            };
            readonly transfer_reason: {
                readonly type: "string";
                readonly description: "Why the session was transferred (only if call_outcome is 'Transfer'). Examples: Invalid Provider ID, Invalid Member ID, Invalid Claim Number, No Provider ID, Inactive Provider ID, Authentication Failed, Technical Issue, Policy Not Found, Can't Capture Policy Number. Leave empty if not transferred.";
            };
            readonly drop_off_location: {
                readonly type: "string";
                readonly description: "Where in the conversation flow the user dropped off (only if call_outcome is 'Transfer'). Examples: Policy Number Prompt, Authentication, Claim Details, Member Information, Provider ID, Date of Service, Caller Name. Leave empty if not transferred.";
            };
            readonly notes: {
                readonly type: "string";
                readonly description: "One sentence summary of what happened in the session";
            };
        };
        readonly required: readonly ["general_intent", "call_outcome", "notes"];
    };
};
export interface GptModel {
    id: string;
    name: string;
    apiModelString: string;
    inputPricePerMillion: number;
    outputPricePerMillion: number;
}
export declare const GPT_MODELS: GptModel[];
export declare function getGptModelById(id: string): GptModel | undefined;
export declare function calculateModelCost(inputTokens: number, outputTokens: number, model: GptModel): number;
export interface AnalysisConfig {
    startDate: string;
    startTime: string;
    sessionCount: number;
    openaiApiKey: string;
    modelId: string;
}
export interface SessionWithFacts extends SessionWithTranscript {
    facts: {
        generalIntent: string;
        sessionOutcome: 'Transfer' | 'Contained';
        transferReason: string;
        dropOffLocation: string;
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
    modelId?: string;
    eta?: number;
    error?: string;
    startTime: string;
    endTime?: string;
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
    duration: number;
    label: string;
}
export interface ClassificationStats {
    totalSessions: number;
    uniqueIntents: number;
    transferRate: number;
    containmentRate: number;
    topTransferReasons: Array<{
        reason: string;
        count: number;
        percentage: number;
    }>;
    topIntents: Array<{
        intent: string;
        count: number;
        percentage: number;
    }>;
    consistency: {
        intentConsistency: number;
        reasonConsistency: number;
        locationConsistency: number;
    };
}
export declare const AUTO_ANALYZE_FUNCTION_SCHEMA: {
    readonly name: "analyze_sessions_batch";
    readonly description: "Analyze a batch of session transcripts and classify each session";
    readonly parameters: {
        readonly type: "object";
        readonly properties: {
            readonly sessions: {
                readonly type: "array";
                readonly description: "Array of analyzed sessions";
                readonly items: {
                    readonly type: "object";
                    readonly properties: {
                        readonly user_id: {
                            readonly type: "string";
                            readonly description: "The user ID of the session";
                        };
                        readonly general_intent: {
                            readonly type: "string";
                            readonly description: "What the user is trying to accomplish (1-2 words). Examples: Claim Status, Billing, Eligibility, Live Agent, Provider Enrollment, Portal Access, Authorization. Use 'Unknown' if unclear.";
                        };
                        readonly session_outcome: {
                            readonly type: "string";
                            readonly enum: readonly ["Transfer", "Contained"];
                            readonly description: "Whether the session was transferred to a live agent or contained by the bot";
                        };
                        readonly transfer_reason: {
                            readonly type: "string";
                            readonly description: "Why the session was transferred (only if session_outcome is 'Transfer'). Examples: Invalid Provider ID, Invalid Member ID, Invalid Claim Number, No Provider ID, Inactive Provider ID, Authentication Failed, Technical Issue, Policy Not Found, Can't Capture Policy Number. Leave empty if not transferred.";
                        };
                        readonly drop_off_location: {
                            readonly type: "string";
                            readonly description: "Where in the session flow (at which prompt) the user dropped off (started getting routed to an agent). Will only have a value if session_outcome is 'Transfer'). Examples: Policy Number Prompt, Authentication, Claim Details, Member Information, Provider ID, Date of Service, User Name. Leave empty if not transferred.";
                        };
                        readonly notes: {
                            readonly type: "string";
                            readonly description: "One sentence summary of what happened in the session";
                        };
                    };
                    readonly required: readonly ["user_id", "general_intent", "session_outcome", "transfer_reason", "drop_off_location", "notes"];
                };
            };
        };
        readonly required: readonly ["sessions"];
    };
};
export interface AnalysisExportMetadata {
    version: string;
    schemaVersion: string;
    exportedAt: string;
    exportedBy: string;
    requiredFeatures: string[];
    optionalFeatures: string[];
}
export interface AnalysisExportSummary {
    overview: string;
    detailedAnalysis: string;
    totalSessions: number;
    containmentRate: number;
    topTransferReasons: Record<string, number>;
    topIntents: Record<string, number>;
    topDropOffLocations: Record<string, number>;
}
export interface AnalysisExportChartData {
    sessionOutcomes: Array<{
        name: string;
        value: number;
    }>;
    transferReasons: Array<{
        reason: string;
        count: number;
        percentage: number;
    }>;
    dropOffLocations: Array<{
        location: string;
        count: number;
    }>;
    generalIntents: Array<{
        intent: string;
        count: number;
    }>;
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
export interface VersionCompatibility {
    supportedVersions: string[];
    deprecatedVersions: string[];
    unsupportedVersions: string[];
    requiredFeatures: string[];
    optionalFeatures?: string[];
}
export declare const ANALYSIS_FILE_VERSION = "1.0.0";
export declare const ANALYSIS_FILE_SCHEMA_VERSION = "1.0";
export declare const ANALYSIS_FILE_APP_VERSION = "XOB-CAT-1.0.0";
export declare const VERSION_COMPATIBILITY_MATRIX: Record<string, VersionCompatibility>;
//# sourceMappingURL=index.d.ts.map