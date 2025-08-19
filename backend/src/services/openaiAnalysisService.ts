import OpenAI from 'openai';
import { 
  SessionWithTranscript, 
  ExistingClassifications, 
  AUTO_ANALYZE_FUNCTION_SCHEMA,
  GPT_MODELS,
  getGptModelById
} from '../../../shared/types';
import { 
  SESSION_ANALYSIS_SYSTEM_MESSAGE, 
  createSessionAnalysisPrompt 
} from '../../../shared/prompts/session-analysis-prompts';

export interface OpenAIBatchResult {
  sessions: Array<{
    user_id: string;
    general_intent: string;
    session_outcome: 'Transfer' | 'Contained';
    transfer_reason: string;
    drop_off_location: string;
    notes: string;
  }>;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
}

export class OpenAIAnalysisService {
  private readonly enableLogging = process.env.OPENAI_LOGGING === 'true';

  async analyzeBatch(
    sessions: SessionWithTranscript[],
    existingClassifications: ExistingClassifications,
    apiKey: string,
    modelId: string = 'gpt-4o-mini',
    additionalContext?: string
  ): Promise<OpenAIBatchResult> {
    const client = new OpenAI({ apiKey });
    
    const prompt = createSessionAnalysisPrompt(sessions, existingClassifications, additionalContext);

    try {
      // Get the actual API model string from our model configuration
      const modelInfo = getGptModelById(modelId);
      const apiModelString = modelInfo?.apiModelString || modelId;
      
      // Log request details if enabled
      if (this.enableLogging) {
        console.log('\n🤖 OpenAI API Request:', {
          timestamp: new Date().toISOString(),
          model: apiModelString,
          modelId: modelId,
          sessionCount: sessions.length,
          apiKey: apiKey.substring(0, 8) + '...',
          promptLength: prompt.length,
          additionalContext: additionalContext || 'none',
          existingClassifications: {
            intents: existingClassifications.generalIntent.size,
            transferReasons: existingClassifications.transferReason.size,
            dropOffLocations: existingClassifications.dropOffLocation.size
          }
        });
        
        if (process.env.OPENAI_LOGGING_VERBOSE === 'true') {
          if (process.env.OPENAI_LOGGING_FULL_PROMPT === 'true') {
            console.log('📝 Full Request Prompt:', prompt);
          } else {
            console.log('📝 Request Prompt Preview:', prompt.substring(0, 500) + '...');
          }
        }
      }
      
      const requestStartTime = Date.now();
      const response = await client.chat.completions.create({
        model: apiModelString,
        messages: [
          {
            role: 'system',
            content: SESSION_ANALYSIS_SYSTEM_MESSAGE
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [{ type: 'function', function: AUTO_ANALYZE_FUNCTION_SCHEMA }],
        tool_choice: { type: 'function', function: { name: 'analyze_sessions_batch' } },
        temperature: 0 // Deterministic results
      });

      const requestDuration = Date.now() - requestStartTime;

      // Log response details if enabled
      if (this.enableLogging) {
        console.log('✅ OpenAI API Response:', {
          timestamp: new Date().toISOString(),
          duration: `${requestDuration}ms`,
          model: response.model,
          usage: response.usage,
          finishReason: response.choices[0]?.finish_reason,
          hasToolCalls: !!response.choices[0]?.message?.tool_calls?.length
        });
      }

      // Extract function call results
      if (!response.choices[0]?.message?.tool_calls?.[0]) {
        throw new Error('No tool calls in response');
      }

      const toolCall = response.choices[0].message.tool_calls[0];
      const functionArgs = JSON.parse(toolCall.function.arguments);

      if (!functionArgs.sessions || !Array.isArray(functionArgs.sessions)) {
        throw new Error('Invalid response format: missing sessions array');
      }

      // Log parsed results if enabled
      if (this.enableLogging) {
        console.log('📊 Parsed Analysis Results:', {
          sessionsAnalyzed: functionArgs.sessions.length,
          intentsFound: [...new Set(functionArgs.sessions.map((s: any) => s.general_intent))],
          transferCount: functionArgs.sessions.filter((s: any) => s.session_outcome === 'Transfer').length,
          containedCount: functionArgs.sessions.filter((s: any) => s.session_outcome === 'Contained').length
        });
        
        if (process.env.OPENAI_LOGGING_VERBOSE === 'true') {
          console.log('📋 Full Function Arguments:', JSON.stringify(functionArgs, null, 2));
        }
      }

      // Calculate cost
      const cost = this.calculateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0,
        modelId
      );

      if (this.enableLogging) {
        console.log('💰 Cost Calculation:', {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
          cost: `$${cost.toFixed(6)}`,
          modelUsedForCost: modelId
        });
      }

      return {
        sessions: functionArgs.sessions,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        cost,
        model: modelId // Use our modelId instead of OpenAI's response.model
      };

    } catch (error) {
      if (this.enableLogging) {
        console.error('❌ OpenAI API Error:', {
          timestamp: new Date().toISOString(),
          model: modelId,
          sessionCount: sessions.length,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
      throw error;
    }
  }


  calculateCost(promptTokens: number, completionTokens: number, modelId: string): number {
    const modelInfo = getGptModelById(modelId);
    if (!modelInfo) {
      return 0; // Unknown model
    }

    const inputCost = (promptTokens / 1_000_000) * modelInfo.inputPricePerMillion;
    const outputCost = (completionTokens / 1_000_000) * modelInfo.outputPricePerMillion;
    
    return inputCost + outputCost;
  }
}