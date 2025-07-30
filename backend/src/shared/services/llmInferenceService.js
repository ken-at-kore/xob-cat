"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMInferenceService = void 0;
const openai_1 = __importDefault(require("openai"));
const analysis_prompts_1 = require("../prompts/analysis-prompts");
class LLMInferenceService {
    openai;
    constructor(apiKey) {
        this.openai = new openai_1.default({
            apiKey: apiKey
        });
    }
    aggregateAnalysisData(sessions) {
        const totalSessions = sessions.length;
        const transferCount = sessions.filter(s => s.facts.sessionOutcome === 'Transfer').length;
        const containedCount = sessions.filter(s => s.facts.sessionOutcome === 'Contained').length;
        const sessionLengths = sessions.map(s => {
            if (s.duration_seconds && s.duration_seconds > 0) {
                return s.duration_seconds / 60;
            }
            const start = new Date(s.start_time).getTime();
            const end = new Date(s.end_time).getTime();
            return (end - start) / (1000 * 60);
        });
        const averageSessionLength = sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length;
        const totalMessages = sessions.reduce((sum, s) => {
            return sum + (s.message_count || (s.messages?.length || 0));
        }, 0);
        const intentBreakdown = {};
        const transferReasonBreakdown = {};
        const dropOffLocationBreakdown = {};
        sessions.forEach(session => {
            intentBreakdown[session.facts.generalIntent] = (intentBreakdown[session.facts.generalIntent] || 0) + 1;
            if (session.facts.sessionOutcome === 'Transfer' && session.facts.transferReason) {
                transferReasonBreakdown[session.facts.transferReason] = (transferReasonBreakdown[session.facts.transferReason] || 0) + 1;
            }
            if (session.facts.sessionOutcome === 'Transfer' && session.facts.dropOffLocation) {
                dropOffLocationBreakdown[session.facts.dropOffLocation] = (dropOffLocationBreakdown[session.facts.dropOffLocation] || 0) + 1;
            }
        });
        const allSessionNotes = sessions.map(s => s.facts.notes);
        const shuffled = [...sessions].sort(() => 0.5 - Math.random());
        const sampleTranscripts = shuffled.slice(0, 5).map(session => ({
            sessionId: session.session_id,
            intent: session.facts.generalIntent,
            outcome: session.facts.sessionOutcome,
            messages: (session.messages || []).map(m => ({
                message: m.message,
                message_type: m.message_type,
                timestamp: m.timestamp
            }))
        }));
        return {
            totalSessions,
            transferCount,
            containedCount,
            transferRate: (transferCount / totalSessions) * 100,
            containmentRate: (containedCount / totalSessions) * 100,
            averageSessionLength,
            totalMessages,
            averageMessagesPerSession: totalMessages / totalSessions,
            intentBreakdown,
            transferReasonBreakdown,
            dropOffLocationBreakdown,
            allSessionNotes,
            sampleTranscripts
        };
    }
    async generateAnalysisSummary(sessions) {
        if (!sessions || sessions.length === 0) {
            throw new Error('No sessions provided for analysis');
        }
        const aggregation = this.aggregateAnalysisData(sessions);
        const prompt = (0, analysis_prompts_1.createAnalysisPrompt)(aggregation, sessions);
        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            });
            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No response from OpenAI');
            }
            const parsedResponse = this.parseAnalysisResponse(response);
            return {
                ...parsedResponse,
                tokensUsed: completion.usage?.total_tokens,
                cost: this.calculateCost(completion.usage?.total_tokens || 0)
            };
        }
        catch (error) {
            console.error('Error calling OpenAI API:', error);
            throw error;
        }
    }
    parseAnalysisResponse(response) {
        const overviewMatch = response.match(/# ANALYSIS_OVERVIEW\s*([\s\S]*?)(?=# ANALYSIS_SUMMARY|# CONTAINMENT_SUGGESTION|$)/);
        const summaryMatch = response.match(/# ANALYSIS_SUMMARY\s*([\s\S]*?)(?=# CONTAINMENT_SUGGESTION|$)/);
        const containmentMatch = response.match(/# CONTAINMENT_SUGGESTION\s*([\s\S]*?)$/);
        if (!overviewMatch || !summaryMatch || !containmentMatch) {
            throw new Error('Could not parse OpenAI response into required sections');
        }
        const overview = overviewMatch[1]?.trim() || '';
        const summary = summaryMatch[1]?.trim() || '';
        const containmentSuggestion = containmentMatch[1]?.trim() || '';
        return {
            overview,
            summary,
            containmentSuggestion
        };
    }
    calculateCost(totalTokens) {
        const inputTokens = totalTokens * 0.6;
        const outputTokens = totalTokens * 0.4;
        const inputCost = (inputTokens / 1000) * 0.00015;
        const outputCost = (outputTokens / 1000) * 0.0006;
        return inputCost + outputCost;
    }
    createAnalysisSummary(llmResponse, sessions) {
        const aggregation = this.aggregateAnalysisData(sessions);
        return {
            overview: llmResponse.overview,
            summary: llmResponse.summary,
            containmentSuggestion: llmResponse.containmentSuggestion,
            generatedAt: new Date().toISOString(),
            sessionsAnalyzed: sessions.length,
            statistics: {
                totalSessions: aggregation.totalSessions,
                transferRate: aggregation.transferRate,
                containmentRate: aggregation.containmentRate,
                averageSessionLength: aggregation.averageSessionLength,
                averageMessagesPerSession: aggregation.averageMessagesPerSession
            }
        };
    }
}
exports.LLMInferenceService = LLMInferenceService;
//# sourceMappingURL=llmInferenceService.js.map