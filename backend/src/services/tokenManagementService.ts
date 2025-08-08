import { 
  SessionWithTranscript, 
  TokenEstimation, 
  BatchTokenUsage,
  getGptModelById 
} from '../../../shared/types';

export class TokenManagementService {
  private readonly AVG_TOKENS_PER_SESSION = 1500;
  private readonly SAFETY_MARGIN = 1.2; // 20% safety margin
  private readonly RESERVED_TOKENS = 5500; // System message, classifications, function schema, response buffer
  private readonly MAX_SESSIONS_CAP = 50; // Cap at 50 for response quality

  calculateMaxSessionsPerCall(modelId: string): number {
    const modelInfo = getGptModelById(modelId);
    if (!modelInfo) {
      console.warn(`Unknown model ID: ${modelId}, using conservative defaults`);
      return 5; // Conservative fallback
    }

    const contextWindow = modelInfo.contextWindow; // tokens
    
    console.log(`[TokenManagementService] Model ${modelId} context window: ${contextWindow} tokens`);
    
    // Calculate available tokens after reserving for system components
    const availableTokens = contextWindow - this.RESERVED_TOKENS;
    
    // Calculate max sessions with safety margin
    const maxSessions = Math.floor(availableTokens / (this.AVG_TOKENS_PER_SESSION * this.SAFETY_MARGIN));
    
    // Apply practical limits
    const finalLimit = Math.min(maxSessions, this.MAX_SESSIONS_CAP);
    
    console.log(`[TokenManagementService] Max sessions per call for ${modelId}: ${finalLimit}`);
    
    return Math.max(finalLimit, 1); // Ensure at least 1 session per call
  }

  estimateTokenUsage(sessions: SessionWithTranscript[], modelId: string): number {
    let totalTokens = 0;
    
    // Calculate tokens for each session
    for (const session of sessions) {
      const sessionTokens = this.estimateSessionTokens(session);
      totalTokens += sessionTokens;
    }
    
    // Add reserved tokens for system components
    totalTokens += this.RESERVED_TOKENS;
    
    console.log(`[TokenManagementService] Estimated tokens for ${sessions.length} sessions: ${totalTokens}`);
    
    return totalTokens;
  }

  splitSessionsIntoBatches(
    sessions: SessionWithTranscript[], 
    maxSessionsPerCall: number
  ): SessionWithTranscript[][] {
    if (sessions.length === 0) {
      return [];
    }
    
    const batches: SessionWithTranscript[][] = [];
    
    for (let i = 0; i < sessions.length; i += maxSessionsPerCall) {
      const batch = sessions.slice(i, i + maxSessionsPerCall);
      batches.push(batch);
    }
    
    console.log(`[TokenManagementService] Split ${sessions.length} sessions into ${batches.length} batches (max ${maxSessionsPerCall} per batch)`);
    
    return batches;
  }

  calculateTokenEstimation(
    sessions: SessionWithTranscript[], 
    modelId: string
  ): TokenEstimation {
    const estimatedTokens = this.estimateTokenUsage(sessions, modelId);
    const maxSessionsPerCall = this.calculateMaxSessionsPerCall(modelId);
    const requiresSplitting = sessions.length > maxSessionsPerCall;
    const costEstimate = this.calculateCostEstimate(estimatedTokens, modelId);
    
    return {
      estimatedTokens,
      recommendedBatchSize: Math.min(sessions.length, maxSessionsPerCall),
      requiresSplitting,
      costEstimate
    };
  }

  calculateCostEstimate(tokenUsage: BatchTokenUsage): number;
  calculateCostEstimate(totalTokens: number, modelId: string): number;
  calculateCostEstimate(
    tokenUsageOrTotalTokens: BatchTokenUsage | number, 
    modelId?: string
  ): number {
    if (typeof tokenUsageOrTotalTokens === 'object') {
      // BatchTokenUsage object provided
      const tokenUsage = tokenUsageOrTotalTokens;
      const modelInfo = getGptModelById(tokenUsage.model);
      if (!modelInfo) return 0;
      
      const inputCost = (tokenUsage.promptTokens / 1_000_000) * modelInfo.inputPricePerMillion;
      const outputCost = (tokenUsage.completionTokens / 1_000_000) * modelInfo.outputPricePerMillion;
      
      return inputCost + outputCost;
    } else {
      // Total tokens and modelId provided
      const totalTokens = tokenUsageOrTotalTokens;
      if (!modelId) return 0;
      
      const modelInfo = getGptModelById(modelId);
      if (!modelInfo) return 0;
      
      // Estimate 80% prompt tokens, 20% completion tokens (typical ratio)
      const promptTokens = Math.floor(totalTokens * 0.8);
      const completionTokens = Math.floor(totalTokens * 0.2);
      
      const inputCost = (promptTokens / 1_000_000) * modelInfo.inputPricePerMillion;
      const outputCost = (completionTokens / 1_000_000) * modelInfo.outputPricePerMillion;
      
      return inputCost + outputCost;
    }
  }

  private estimateSessionTokens(session: SessionWithTranscript): number {
    if (!session.messages || session.messages.length === 0) {
      return 100; // Minimal tokens for session metadata
    }
    
    // Calculate character count for all messages
    const totalChars = session.messages.reduce((total, message) => {
      return total + (message.message?.length || 0);
    }, 0);
    
    // Rough estimation: 4 characters per token (OpenAI's general rule)
    const estimatedTokens = Math.ceil(totalChars / 4);
    
    // Add tokens for session metadata (user_id, timestamps, etc.)
    const metadataTokens = 50;
    
    return estimatedTokens + metadataTokens;
  }

  // Utility method to check if sessions can fit in a single call
  canProcessInSingleCall(sessions: SessionWithTranscript[], modelId: string): boolean {
    const maxSessions = this.calculateMaxSessionsPerCall(modelId);
    return sessions.length <= maxSessions;
  }

  // Get model-specific configuration for optimal batching
  getOptimalBatchConfig(modelId: string): {
    maxSessionsPerCall: number;
    contextWindow: number;
    recommendedStreamCount: number;
  } {
    const modelInfo = getGptModelById(modelId);
    const maxSessionsPerCall = this.calculateMaxSessionsPerCall(modelId);
    
    // Recommend fewer streams for models with larger context windows
    let recommendedStreamCount = 8; // Default
    if (modelInfo && modelInfo.contextWindow >= 1_000_000) {
      recommendedStreamCount = 3; // GPT-4.1 variants
    } else if (modelInfo && modelInfo.contextWindow >= 128_000) {
      recommendedStreamCount = 4; // GPT-4o variants
    }
    
    return {
      maxSessionsPerCall,
      contextWindow: modelInfo?.contextWindow || 8192,
      recommendedStreamCount
    };
  }

  // Debug method to log detailed token analysis
  logTokenAnalysis(sessions: SessionWithTranscript[], modelId: string): void {
    const analysis = {
      totalSessions: sessions.length,
      modelId,
      maxSessionsPerCall: this.calculateMaxSessionsPerCall(modelId),
      totalEstimatedTokens: this.estimateTokenUsage(sessions, modelId),
      averageTokensPerSession: sessions.length > 0 
        ? Math.round(this.estimateTokenUsage(sessions, modelId) / sessions.length)
        : 0,
      batchesRequired: Math.ceil(sessions.length / this.calculateMaxSessionsPerCall(modelId)),
      estimatedCost: this.calculateCostEstimate(this.estimateTokenUsage(sessions, modelId), modelId)
    };
    
    console.log(`[TokenManagementService] Token Analysis:`, analysis);
  }
}