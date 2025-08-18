/**
 * Shared LLM Inference Service
 * 
 * This service provides common LLM inference functionality that can be used
 * by both the main application and utility scripts. It centralizes prompt
 * engineering and response parsing for consistency.
 */

import OpenAI from 'openai';
import { SessionWithFacts, AnalysisSummary } from '../types';
import { createAnalysisPrompt, AnalysisAggregation } from '../prompts/analysis-prompts';

export interface LLMAnalysisResponse {
  overview: string;
  summary: string;
  containmentSuggestion: string;
  tokensUsed: number | undefined;
  cost: number | undefined;
}

export class LLMInferenceService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  /**
   * Aggregate session data for analysis context
   */
  aggregateAnalysisData(sessions: SessionWithFacts[]): AnalysisAggregation {
    const totalSessions = sessions.length;
    const transferCount = sessions.filter(s => s.facts.sessionOutcome === 'Transfer').length;
    const containedCount = sessions.filter(s => s.facts.sessionOutcome === 'Contained').length;
    
    // Calculate session lengths in minutes
    const sessionLengths = sessions.map(s => {
      if (s.duration_seconds && s.duration_seconds > 0) {
        return s.duration_seconds / 60;
      }
      // Calculate from start/end time if duration not available
      const start = new Date(s.start_time).getTime();
      const end = new Date(s.end_time).getTime();
      return (end - start) / (1000 * 60);
    });
    
    const averageSessionLength = sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length;
    const totalMessages = sessions.reduce((sum, s) => {
      // Use message_count if available, otherwise count messages array
      return sum + (s.message_count || (s.messages?.length || 0));
    }, 0);
    
    // Create breakdowns
    const intentBreakdown: Record<string, number> = {};
    const transferReasonBreakdown: Record<string, number> = {};
    const dropOffLocationBreakdown: Record<string, number> = {};
    
    sessions.forEach(session => {
      // Intent breakdown
      intentBreakdown[session.facts.generalIntent] = (intentBreakdown[session.facts.generalIntent] || 0) + 1;
      
      // Transfer reason breakdown (only for transfers)
      if (session.facts.sessionOutcome === 'Transfer' && session.facts.transferReason) {
        transferReasonBreakdown[session.facts.transferReason] = (transferReasonBreakdown[session.facts.transferReason] || 0) + 1;
      }
      
      // Drop-off location breakdown (only for transfers)
      if (session.facts.sessionOutcome === 'Transfer' && session.facts.dropOffLocation) {
        dropOffLocationBreakdown[session.facts.dropOffLocation] = (dropOffLocationBreakdown[session.facts.dropOffLocation] || 0) + 1;
      }
    });
    
    // Collect all session notes
    const allSessionNotes = sessions.map(s => s.facts.notes);
    
    // Select 5 random sessions for transcript samples
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

  /**
   * Generate analysis summaries using OpenAI
   */
  async generateAnalysisSummary(sessions: SessionWithFacts[], modelId: string = 'gpt-4o-mini'): Promise<LLMAnalysisResponse> {
    if (!sessions || sessions.length === 0) {
      throw new Error('No sessions provided for analysis');
    }

    // Aggregate data for analysis
    const aggregation = this.aggregateAnalysisData(sessions);
    
    // Create prompt using centralized prompt engineering
    const prompt = createAnalysisPrompt(aggregation, sessions);
    
    // Debug logging if enabled
    if (process.env.HYBRID_SUMMARY_DEBUG === 'true') {
      console.log('\n🔍 [DEBUG] OpenAI API Request Details:');
      console.log('─'.repeat(80));
      console.log('Model:', modelId);
      console.log('Temperature:', 0.7);
      console.log('Max Tokens:', 2000);
      console.log('Prompt Length:', prompt.length, 'characters');
      console.log('\n📝 [DEBUG] Full Prompt Being Sent to OpenAI:');
      console.log('─'.repeat(80));
      console.log(prompt);
      console.log('─'.repeat(80));
      console.log('\n');
    }
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: modelId,
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

      // Debug logging for response if enabled
      if (process.env.HYBRID_SUMMARY_DEBUG === 'true') {
        console.log('\n✅ [DEBUG] OpenAI API Response Received:');
        console.log('─'.repeat(80));
        console.log('Response Length:', response.length, 'characters');
        console.log('Tokens Used:', completion.usage?.total_tokens);
        console.log('\n📄 [DEBUG] Full Response from OpenAI:');
        console.log('─'.repeat(80));
        console.log(response);
        console.log('─'.repeat(80));
        console.log('\n');
      }

      // Parse the response into sections
      const parsedResponse = this.parseAnalysisResponse(response);
      
      // Add usage metrics
      return {
        ...parsedResponse,
        tokensUsed: completion.usage?.total_tokens,
        cost: this.calculateCost(completion.usage?.total_tokens || 0, modelId)
      };
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  /**
   * Parse OpenAI response into structured sections
   */
  private parseAnalysisResponse(response: string): Omit<LLMAnalysisResponse, 'tokensUsed' | 'cost'> {
    // Parse the response into overview, summary, and containment suggestion sections
    // Be flexible with section headers to handle variations in GPT responses
    const overviewMatch = response.match(/#+ ANALYSIS[_\s]OVERVIEW\s*([\s\S]*?)(?=#+ ANALYSIS[_\s]SUMMARY|#+ CONTAINMENT[_\s]SUGGESTION|$)/i);
    const summaryMatch = response.match(/#+ ANALYSIS[_\s]SUMMARY\s*([\s\S]*?)(?=#+ CONTAINMENT[_\s]SUGGESTION|$)/i);
    const containmentMatch = response.match(/#+ CONTAINMENT[_\s]SUGGESTION\s*([\s\S]*?)$/i);

    if (!overviewMatch || !summaryMatch || !containmentMatch) {
      // Log debug info if parsing fails
      if (process.env.HYBRID_SUMMARY_DEBUG === 'true') {
        console.error('Failed to parse response. Looking for sections:');
        console.error('- ANALYSIS_OVERVIEW:', !!overviewMatch);
        console.error('- ANALYSIS_SUMMARY:', !!summaryMatch);
        console.error('- CONTAINMENT_SUGGESTION:', !!containmentMatch);
      }
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

  /**
   * Calculate cost based on token usage for different models
   * Assuming roughly 60% input, 40% output for analysis tasks
   */
  private calculateCost(totalTokens: number, modelId: string = 'gpt-4o-mini'): number {
    const inputTokens = totalTokens * 0.6;
    const outputTokens = totalTokens * 0.4;
    
    // Use model-specific pricing
    let inputPricePerMillion: number;
    let outputPricePerMillion: number;
    
    switch (modelId) {
      case 'gpt-4o':
        inputPricePerMillion = 5.0; // $5.00 per 1M input tokens
        outputPricePerMillion = 15.0; // $15.00 per 1M output tokens
        break;
      case 'gpt-4o-mini':
      default:
        inputPricePerMillion = 0.15; // $0.15 per 1M input tokens
        outputPricePerMillion = 0.6;  // $0.60 per 1M output tokens
        break;
    }
    
    const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion;
    const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion;
    return inputCost + outputCost;
  }

  /**
   * Create structured AnalysisSummary object
   */
  createAnalysisSummary(
    llmResponse: LLMAnalysisResponse, 
    sessions: SessionWithFacts[]
  ): AnalysisSummary {
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