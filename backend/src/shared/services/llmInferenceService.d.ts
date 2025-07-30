import { SessionWithFacts, AnalysisSummary } from '../types';
import { AnalysisAggregation } from '../prompts/analysis-prompts';
export interface LLMAnalysisResponse {
    overview: string;
    summary: string;
    containmentSuggestion: string;
    tokensUsed: number | undefined;
    cost: number | undefined;
}
export declare class LLMInferenceService {
    private openai;
    constructor(apiKey: string);
    aggregateAnalysisData(sessions: SessionWithFacts[]): AnalysisAggregation;
    generateAnalysisSummary(sessions: SessionWithFacts[]): Promise<LLMAnalysisResponse>;
    private parseAnalysisResponse;
    private calculateCost;
    createAnalysisSummary(llmResponse: LLMAnalysisResponse, sessions: SessionWithFacts[]): AnalysisSummary;
}
//# sourceMappingURL=llmInferenceService.d.ts.map