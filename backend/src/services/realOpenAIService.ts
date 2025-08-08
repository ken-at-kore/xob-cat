import { IOpenAIService } from '../interfaces';
import { AnalysisResult, Message, SessionWithTranscript, ExistingClassifications } from '../../../shared/types';
import { OpenAIAnalysisService } from './openaiAnalysisService';

export class RealOpenAIService implements IOpenAIService {
  private openAIAnalysisService = new OpenAIAnalysisService();
  async analyzeSession(messages: Message[], apiKey?: string): Promise<{
    analysis: AnalysisResult;
    cost: number;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    // Generate a temporary session ID for the analysis
    const sessionId = `temp_${Date.now()}`;
    
    // Set the API key if provided
    if (apiKey) {
      const originalApiKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = apiKey;
      
      try {
        // Create a session for batch analysis
        const session: SessionWithTranscript = {
          session_id: sessionId,
          user_id: `user_${Date.now()}`,
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          containment_type: null,
          tags: [],
          metrics: {},
          messages: messages,
          message_count: messages.length,
          user_message_count: messages.filter(m => m.message_type === 'user').length,
          bot_message_count: messages.filter(m => m.message_type === 'bot').length
        };

        // Use batch analysis with single session
        const batchResult = await this.openAIAnalysisService.analyzeBatch(
          [session], 
          { generalIntent: new Set(), transferReason: new Set(), dropOffLocation: new Set() },
          apiKey,
          'gpt-4o-mini'
        );

        if (batchResult.sessions.length === 0) {
          throw new Error('No analysis results returned');
        }

        const batchSession = batchResult.sessions[0];
        if (!batchSession) {
          throw new Error('No session data in batch result');
        }

        // Convert batch result to AnalysisResult format
        const analysisResult: AnalysisResult = {
          session_id: sessionId,
          user_id: batchSession.user_id,
          general_intent: batchSession.general_intent,
          call_outcome: batchSession.session_outcome,
          ...(batchSession.transfer_reason && { transfer_reason: batchSession.transfer_reason }),
          ...(batchSession.drop_off_location && { drop_off_location: batchSession.drop_off_location }),
          notes: batchSession.notes,
          token_usage: {
            prompt_tokens: batchResult.promptTokens,
            completion_tokens: batchResult.completionTokens,
            total_tokens: batchResult.totalTokens,
            cost: batchResult.cost
          },
          analyzed_at: new Date().toISOString()
        };

        return {
          analysis: analysisResult,
          cost: batchResult.cost,
          tokenUsage: {
            promptTokens: batchResult.promptTokens,
            completionTokens: batchResult.completionTokens,
            totalTokens: batchResult.totalTokens
          }
        };
      } finally {
        // Restore original API key
        if (originalApiKey) {
          process.env.OPENAI_API_KEY = originalApiKey;
        } else {
          delete process.env.OPENAI_API_KEY;
        }
      }
    } else {
      // Create a session for batch analysis
      const session: SessionWithTranscript = {
        session_id: sessionId,
        user_id: `user_${Date.now()}`,
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        containment_type: null,
        tags: [],
        metrics: {},
        messages: messages,
        message_count: messages.length,
        user_message_count: messages.filter(m => m.message_type === 'user').length,
        bot_message_count: messages.filter(m => m.message_type === 'bot').length
      };

      // Use batch analysis with single session
      const batchResult = await this.openAIAnalysisService.analyzeBatch(
        [session], 
        { generalIntent: new Set(), transferReason: new Set(), dropOffLocation: new Set() },
        process.env.OPENAI_API_KEY!,
        'gpt-4o-mini'
      );

      if (batchResult.sessions.length === 0) {
        throw new Error('No analysis results returned');
      }

      const batchSession = batchResult.sessions[0];
      if (!batchSession) {
        throw new Error('No session data in batch result');
      }

      // Convert batch result to AnalysisResult format
      const analysisResult: AnalysisResult = {
        session_id: sessionId,
        user_id: batchSession.user_id,
        general_intent: batchSession.general_intent,
        call_outcome: batchSession.session_outcome,
        ...(batchSession.transfer_reason && { transfer_reason: batchSession.transfer_reason }),
        ...(batchSession.drop_off_location && { drop_off_location: batchSession.drop_off_location }),
        notes: batchSession.notes,
        token_usage: {
          prompt_tokens: batchResult.promptTokens,
          completion_tokens: batchResult.completionTokens,
          total_tokens: batchResult.totalTokens,
          cost: batchResult.cost
        },
        analyzed_at: new Date().toISOString()
      };

      return {
        analysis: analysisResult,
        cost: batchResult.cost,
        tokenUsage: {
          promptTokens: batchResult.promptTokens,
          completionTokens: batchResult.completionTokens,
          totalTokens: batchResult.totalTokens
        }
      };
    }
  }

  async analyzeBatch(
    sessions: SessionWithTranscript[],
    existingClassifications: ExistingClassifications,
    openaiApiKey: string,
    modelId: string = 'gpt-4o-mini'
  ): Promise<{
    sessions: any[];
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    model: string;
  }> {
    return this.openAIAnalysisService.analyzeBatch(sessions, existingClassifications, openaiApiKey, modelId);
  }

  calculateCost(promptTokens: number, completionTokens: number, modelId: string): number {
    return this.openAIAnalysisService.calculateCost(promptTokens, completionTokens, modelId);
  }
}

// Factory function for creating real OpenAI service
export function createRealOpenAIService(): IOpenAIService {
  return new RealOpenAIService();
}