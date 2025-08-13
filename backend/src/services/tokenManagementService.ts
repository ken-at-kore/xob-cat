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
    const startTime = Date.now();
    let totalTokens = 0;
    let sessionTokenDetails: { sessionId: string; tokens: number }[] = [];
    
    // Calculate tokens for each session
    for (const session of sessions) {
      const sessionStartTime = Date.now();
      const sessionTokens = this.estimateSessionTokens(session);
      const sessionDuration = Date.now() - sessionStartTime;
      
      totalTokens += sessionTokens;
      sessionTokenDetails.push({
        sessionId: session.session_id,
        tokens: sessionTokens
      });
      
      if (sessionDuration > 10) { // Only log slow sessions
        console.log(`⏱️  Session ${session.session_id} token estimation: ${sessionDuration}ms (${sessionTokens} tokens)`);
      }
    }
    
    // Add reserved tokens for system components
    totalTokens += this.RESERVED_TOKENS;
    const estimationDuration = Date.now() - startTime;
    
    console.log(`📊 Token Usage Estimation Results:`);
    console.log(`   • Sessions Processed: ${sessions.length}`);
    console.log(`   • Session Tokens: ${totalTokens - this.RESERVED_TOKENS}`);
    console.log(`   • Reserved Tokens: ${this.RESERVED_TOKENS}`);
    console.log(`   • Total Tokens: ${totalTokens}`);
    console.log(`   • Avg Per Session: ${Math.round((totalTokens - this.RESERVED_TOKENS) / sessions.length)} tokens`);
    console.log(`   • Estimation Time: ${estimationDuration}ms`);
    
    // Show token distribution if debug logging enabled
    if (process.env.PARALLEL_PROCESSING_DEBUG === 'true') {
      const tokenCounts = sessionTokenDetails.map(s => s.tokens).sort((a, b) => b - a);
      console.log(`[DEBUG] Token Distribution:`);
      console.log(`   • Min: ${Math.min(...tokenCounts)} tokens`);
      console.log(`   • Max: ${Math.max(...tokenCounts)} tokens`);
      console.log(`   • Median: ${tokenCounts[Math.floor(tokenCounts.length/2)]} tokens`);
    }
    
    return totalTokens;
  }

  splitSessionsIntoBatches(
    sessions: SessionWithTranscript[], 
    maxSessionsPerCall: number
  ): SessionWithTranscript[][] {
    const startTime = Date.now();
    
    if (sessions.length === 0) {
      return [];
    }
    
    console.log(`\n🔄 ===== BATCH SPLITTING =====`);
    console.log(`⏱️  Split Start: ${new Date().toISOString()}`);
    console.log(`📊 Total Sessions: ${sessions.length}`);
    console.log(`📦 Max Per Batch: ${maxSessionsPerCall}`);
    
    const batches: SessionWithTranscript[][] = [];
    
    for (let i = 0; i < sessions.length; i += maxSessionsPerCall) {
      const batch = sessions.slice(i, i + maxSessionsPerCall);
      batches.push(batch);
    }
    
    const splitDuration = Date.now() - startTime;
    
    console.log(`\n✅ ===== BATCH SPLITTING COMPLETE =====`);
    console.log(`⏱️  Split Time: ${splitDuration}ms`);
    console.log(`📦 Batches Created: ${batches.length}`);
    console.log(`📊 Batch Sizes: ${batches.map(b => b.length).join(', ')}`);
    console.log(`📊 Avg Batch Size: ${(sessions.length / batches.length).toFixed(1)}`);
    
    return batches;
  }

  calculateTokenEstimation(
    sessions: SessionWithTranscript[], 
    modelId: string
  ): TokenEstimation {
    const estimationStartTime = Date.now();
    console.log(`\n🧠 ===== TOKEN ESTIMATION =====`);
    console.log(`⏱️  Estimation Start: ${new Date().toISOString()}`);
    console.log(`📊 Sessions to Estimate: ${sessions.length}`);
    console.log(`🧠 Model: ${modelId}`);
    
    const tokenUsageStartTime = Date.now();
    const estimatedTokens = this.estimateTokenUsage(sessions, modelId);
    const tokenUsageDuration = Date.now() - tokenUsageStartTime;
    
    const maxSessionsStartTime = Date.now();
    const maxSessionsPerCall = this.calculateMaxSessionsPerCall(modelId);
    const maxSessionsDuration = Date.now() - maxSessionsStartTime;
    
    const costEstimateStartTime = Date.now();
    const costEstimate = this.calculateCostEstimate(estimatedTokens, modelId);
    const costEstimateDuration = Date.now() - costEstimateStartTime;
    
    const requiresSplitting = sessions.length > maxSessionsPerCall;
    const estimationDuration = Date.now() - estimationStartTime;
    
    console.log(`\n✅ ===== TOKEN ESTIMATION COMPLETE =====`);
    console.log(`⏱️  Total Estimation Time: ${estimationDuration}ms`);
    console.log(`📊 Estimated Tokens: ${estimatedTokens}`);
    console.log(`📦 Max Sessions Per Call: ${maxSessionsPerCall}`);
    console.log(`🔄 Requires Splitting: ${requiresSplitting}`);
    console.log(`💰 Cost Estimate: $${costEstimate.toFixed(4)}`);
    console.log(`📊 Recommended Batch Size: ${Math.min(sessions.length, maxSessionsPerCall)}`);
    console.log(`\n⏱️  Timing Breakdown:`);
    console.log(`   • Token Usage Calculation: ${tokenUsageDuration}ms`);
    console.log(`   • Max Sessions Calculation: ${maxSessionsDuration}ms`);
    console.log(`   • Cost Estimation: ${costEstimateDuration}ms`);
    
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
    const configStartTime = Date.now();
    console.log(`\n⚙️  ===== OPTIMAL BATCH CONFIG =====`);
    console.log(`⏱️  Config Start: ${new Date().toISOString()}`);
    console.log(`🧠 Model: ${modelId}`);
    
    const modelInfo = getGptModelById(modelId);
    const maxSessionsStartTime = Date.now();
    const maxSessionsPerCall = this.calculateMaxSessionsPerCall(modelId);
    const maxSessionsDuration = Date.now() - maxSessionsStartTime;
    
    // Recommend fewer streams for models with larger context windows
    let recommendedStreamCount = 8; // Default
    if (modelInfo && modelInfo.contextWindow >= 1_000_000) {
      recommendedStreamCount = 3; // GPT-4.1 variants
    } else if (modelInfo && modelInfo.contextWindow >= 128_000) {
      recommendedStreamCount = 4; // GPT-4o variants
    }
    
    const configDuration = Date.now() - configStartTime;
    
    const config = {
      maxSessionsPerCall,
      contextWindow: modelInfo?.contextWindow || 8192,
      recommendedStreamCount
    };
    
    console.log(`\n✅ ===== OPTIMAL BATCH CONFIG COMPLETE =====`);
    console.log(`⏱️  Config Time: ${configDuration}ms`);
    console.log(`📦 Max Sessions Per Call: ${config.maxSessionsPerCall}`);
    console.log(`🕰️ Context Window: ${config.contextWindow.toLocaleString()} tokens`);
    console.log(`🌊 Recommended Streams: ${config.recommendedStreamCount}`);
    console.log(`⏱️  Timing:`);
    console.log(`   • Max Sessions Calculation: ${maxSessionsDuration}ms`);
    
    return config;
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