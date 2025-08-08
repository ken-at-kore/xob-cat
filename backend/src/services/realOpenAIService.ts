import { IOpenAIService } from '../interfaces';
import { AnalysisResult, Message, SessionWithTranscript, ExistingClassifications } from '../../../shared/types';
import { analyzeSessionWithOpenAI } from './openaiService';
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
        const analysisResult = await analyzeSessionWithOpenAI(sessionId, messages);
        
        // Extract cost and token usage from the result
        // The function includes tokenUsage with cost
        const cost = (analysisResult as any).tokenUsage?.cost || 0;
        const tokenUsage = (analysisResult as any).tokenUsage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        };

        return {
          analysis: analysisResult,
          cost,
          tokenUsage: {
            promptTokens: tokenUsage.prompt_tokens,
            completionTokens: tokenUsage.completion_tokens,
            totalTokens: tokenUsage.total_tokens
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
      const analysisResult = await analyzeSessionWithOpenAI(sessionId, messages);
      
      // Extract cost and token usage from the result
      const cost = (analysisResult as any).tokenUsage?.cost || 0;
      const tokenUsage = (analysisResult as any).tokenUsage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };

      return {
        analysis: analysisResult,
        cost,
        tokenUsage: {
          promptTokens: tokenUsage.prompt_tokens,
          completionTokens: tokenUsage.completion_tokens,
          totalTokens: tokenUsage.total_tokens
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