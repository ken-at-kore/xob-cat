import { 
  SessionWithTranscript, 
  SessionWithFacts, 
  StreamConfig,
  StreamResult,
  StreamProgressCallback,
  ExistingClassifications,
  SessionValidationResult,
  BatchTokenUsage
} from '../../../shared/types';
import { TokenManagementService } from './tokenManagementService';
import { SessionValidationService } from './sessionValidationService';
import { IOpenAIService } from '../interfaces';

export class StreamProcessingService {
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000; // 1 second base delay
  
  constructor(
    private tokenManagementService: TokenManagementService,
    private sessionValidationService: SessionValidationService,
    private openaiService: IOpenAIService
  ) {}

  async processStream(
    streamConfig: StreamConfig,
    progressCallback?: StreamProgressCallback
  ): Promise<StreamResult> {
    const startTime = Date.now();
    const streamId = streamConfig.streamId;
    
    console.log(`[Stream ${streamId}] Starting processing of ${streamConfig.sessions.length} sessions`);
    
    progressCallback?.(streamId, 0, streamConfig.sessions.length, 0);

    try {
      // Calculate token usage and determine batching strategy
      const tokenEstimation = this.tokenManagementService.calculateTokenEstimation(
        streamConfig.sessions, 
        streamConfig.modelId
      );
      
      console.log(`[Stream ${streamId}] Token estimation:`, tokenEstimation);
      
      let processedSessions: SessionWithFacts[] = [];
      let totalTokenUsage: BatchTokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        model: streamConfig.modelId
      };
      let validationResults: SessionValidationResult[] = [];
      let retryAttempts = 0;

      if (tokenEstimation.requiresSplitting) {
        // Process in multiple batches
        console.log(`[Stream ${streamId}] Token limit exceeded, processing in batches`);
        const result = await this.processStreamInBatches(
          streamConfig, 
          tokenEstimation.recommendedBatchSize,
          progressCallback
        );
        processedSessions = result.processedSessions;
        totalTokenUsage = result.totalTokenUsage;
        validationResults = result.validationResults;
        retryAttempts = result.retryAttempts;
      } else {
        // Process all sessions in single call
        console.log(`[Stream ${streamId}] Processing all sessions in single call`);
        const result = await this.processSingleBatch(
          streamConfig,
          streamConfig.sessions,
          progressCallback
        );
        processedSessions = result.processedSessions;
        totalTokenUsage = result.totalTokenUsage;
        validationResults = [result.validationResult];
        retryAttempts = result.retryAttempts;
      }

      // Extract new classifications discovered by this stream
      const newClassifications = this.extractNewClassifications(
        processedSessions, 
        streamConfig.baseClassifications
      );

      const processingTime = Date.now() - startTime;
      
      console.log(`[Stream ${streamId}] Completed in ${processingTime}ms, ${totalTokenUsage.totalTokens} tokens used`);
      
      progressCallback?.(streamId, streamConfig.sessions.length, streamConfig.sessions.length, totalTokenUsage.totalTokens);

      return {
        streamId,
        processedSessions,
        newClassifications,
        tokenUsage: totalTokenUsage,
        validationResults,
        retryAttempts,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[Stream ${streamId}] Processing failed after ${processingTime}ms:`, error);
      
      // Create fallback results for all sessions
      const fallbackSessions = this.sessionValidationService.createFallbackResults(
        streamConfig.sessions,
        `Stream processing failed: ${error}`,
        streamConfig.modelId
      );
      
      const fallbackValidation: SessionValidationResult = {
        allSessionsProcessed: false,
        processedCount: 0,
        missingCount: streamConfig.sessions.length,
        missingSessions: streamConfig.sessions,
        validationErrors: [`Stream processing failed: ${error}`]
      };

      return {
        streamId,
        processedSessions: fallbackSessions,
        newClassifications: {
          generalIntent: new Set(),
          transferReason: new Set(),
          dropOffLocation: new Set()
        },
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
          model: streamConfig.modelId
        },
        validationResults: [fallbackValidation],
        retryAttempts: this.MAX_RETRY_ATTEMPTS,
        processingTime
      };
    }
  }

  private async processStreamInBatches(
    streamConfig: StreamConfig,
    batchSize: number,
    progressCallback?: StreamProgressCallback
  ): Promise<{
    processedSessions: SessionWithFacts[];
    totalTokenUsage: BatchTokenUsage;
    validationResults: SessionValidationResult[];
    retryAttempts: number;
  }> {
    const streamId = streamConfig.streamId;
    const batches = this.tokenManagementService.splitSessionsIntoBatches(
      streamConfig.sessions,
      batchSize
    );
    
    console.log(`[Stream ${streamId}] Split into ${batches.length} batches`);
    
    let allProcessedSessions: SessionWithFacts[] = [];
    let totalTokenUsage: BatchTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      model: streamConfig.modelId
    };
    let validationResults: SessionValidationResult[] = [];
    let totalRetryAttempts = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      const batchNumber = i + 1;
      
      console.log(`[Stream ${streamId}] Processing batch ${batchNumber}/${batches.length} (${batch.length} sessions)`);
      
      const batchResult = await this.processSingleBatch(
        streamConfig,
        batch,
        (streamId, progress, total, tokens) => {
          const overallProgress = allProcessedSessions.length + progress;
          const overallTotal = streamConfig.sessions.length;
          progressCallback?.(streamId, overallProgress, overallTotal, totalTokenUsage.totalTokens + tokens);
        }
      );
      
      allProcessedSessions.push(...batchResult.processedSessions);
      totalTokenUsage = this.accumulateTokenUsage(totalTokenUsage, batchResult.totalTokenUsage);
      validationResults.push(batchResult.validationResult);
      totalRetryAttempts += batchResult.retryAttempts;
    }

    return {
      processedSessions: allProcessedSessions,
      totalTokenUsage,
      validationResults,
      retryAttempts: totalRetryAttempts
    };
  }

  private async processSingleBatch(
    streamConfig: StreamConfig,
    sessions: SessionWithTranscript[],
    progressCallback?: StreamProgressCallback
  ): Promise<{
    processedSessions: SessionWithFacts[];
    totalTokenUsage: BatchTokenUsage;
    validationResult: SessionValidationResult;
    retryAttempts: number;
  }> {
    const streamId = streamConfig.streamId;
    let retryAttempts = 0;
    let processedSessions: SessionWithFacts[] = [];
    let totalTokenUsage: BatchTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      model: streamConfig.modelId
    };

    // Initial processing attempt
    const initialResult = await this.callOpenAIAnalysis(
      sessions,
      streamConfig.baseClassifications,
      streamConfig.apiKey,
      streamConfig.modelId
    );

    // Validate the response
    const validationResult = this.sessionValidationService.validateBatchResponse(
      sessions,
      initialResult.llmResponse
    );

    // Process successful results
    processedSessions = this.convertToSessionsWithFacts(
      sessions,
      initialResult.llmResponse.sessions,
      initialResult.llmResponse.model
    );
    
    totalTokenUsage = initialResult.llmResponse;

    // Handle missing sessions with retry logic
    if (!validationResult.allSessionsProcessed && validationResult.missingSessions.length > 0) {
      console.warn(`[Stream ${streamId}] ${validationResult.missingCount} sessions missing, attempting retries`);
      
      let remainingMissingSessions = [...validationResult.missingSessions];
      
      while (remainingMissingSessions.length > 0 && retryAttempts < this.MAX_RETRY_ATTEMPTS) {
        retryAttempts++;
        console.log(`[Stream ${streamId}] Retry attempt ${retryAttempts}/${this.MAX_RETRY_ATTEMPTS} for ${remainingMissingSessions.length} sessions`);
        
        // Add exponential backoff delay
        if (retryAttempts > 1) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, retryAttempts - 1);
          console.log(`[Stream ${streamId}] Waiting ${delay}ms before retry`);
          await this.sleep(delay);
        }

        try {
          const retryResult = await this.callOpenAIAnalysis(
            remainingMissingSessions,
            streamConfig.baseClassifications,
            streamConfig.apiKey,
            streamConfig.modelId
          );

          // Validate retry response
          const retryValidation = this.sessionValidationService.validateBatchResponse(
            remainingMissingSessions,
            retryResult.llmResponse
          );

          // Process retry results
          const retrySessions = this.convertToSessionsWithFacts(
            remainingMissingSessions,
            retryResult.llmResponse.sessions,
            retryResult.llmResponse.model
          );

          // Merge results
          processedSessions = this.sessionValidationService.mergeRetryResults(
            processedSessions,
            retrySessions
          );

          // Accumulate token usage
          totalTokenUsage = this.accumulateTokenUsage(totalTokenUsage, retryResult.llmResponse);

          // Update remaining missing sessions
          remainingMissingSessions = retryValidation.missingSessions;

          console.log(`[Stream ${streamId}] Retry ${retryAttempts} processed ${retrySessions.length} sessions, ${remainingMissingSessions.length} still missing`);

        } catch (retryError) {
          console.error(`[Stream ${streamId}] Retry ${retryAttempts} failed:`, retryError);
          // Continue with remaining retry attempts
        }
      }

      // Create fallback results for any remaining missing sessions
      if (remainingMissingSessions.length > 0) {
        console.warn(`[Stream ${streamId}] ${remainingMissingSessions.length} sessions still missing after ${retryAttempts} retries, creating fallbacks`);
        const fallbackSessions = this.sessionValidationService.createFallbackResults(
          remainingMissingSessions,
          `Failed after ${retryAttempts} retry attempts`,
          streamConfig.modelId
        );
        processedSessions = this.sessionValidationService.mergeRetryResults(
          processedSessions,
          fallbackSessions
        );
      }
    }

    // Update progress
    progressCallback?.(streamId, processedSessions.length, sessions.length, totalTokenUsage.totalTokens);

    // Final validation to ensure all sessions are accounted for
    const finalValidation = this.sessionValidationService.validateBatchResponse(
      sessions,
      {
        sessions: processedSessions.map(s => ({
          user_id: s.user_id,
          general_intent: s.facts.generalIntent,
          session_outcome: s.facts.sessionOutcome,
          transfer_reason: s.facts.transferReason,
          drop_off_location: s.facts.dropOffLocation,
          notes: s.facts.notes
        })),
        promptTokens: totalTokenUsage.promptTokens,
        completionTokens: totalTokenUsage.completionTokens,
        totalTokens: totalTokenUsage.totalTokens,
        cost: totalTokenUsage.cost,
        model: totalTokenUsage.model
      }
    );

    return {
      processedSessions,
      totalTokenUsage,
      validationResult: finalValidation,
      retryAttempts
    };
  }

  private async callOpenAIAnalysis(
    sessions: SessionWithTranscript[],
    baseClassifications: ExistingClassifications,
    apiKey: string,
    modelId: string
  ): Promise<{
    llmResponse: BatchTokenUsage & {
      sessions: Array<{
        user_id: string;
        general_intent: string;
        session_outcome: 'Transfer' | 'Contained';
        transfer_reason: string;
        drop_off_location: string;
        notes: string;
      }>;
      model: string;
    }
  }> {
    const result = await this.openaiService.analyzeBatch(
      sessions,
      baseClassifications,
      apiKey,
      modelId
    );

    return {
      llmResponse: {
        sessions: result.sessions,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        cost: result.cost,
        model: result.model
      }
    };
  }

  private convertToSessionsWithFacts(
    originalSessions: SessionWithTranscript[],
    llmResults: Array<{
      user_id: string;
      general_intent: string;
      session_outcome: 'Transfer' | 'Contained';
      transfer_reason: string;
      drop_off_location: string;
      notes: string;
    }>,
    modelId: string
  ): SessionWithFacts[] {
    const sessionsById = new Map(originalSessions.map(s => [s.user_id, s]));
    const results: SessionWithFacts[] = [];

    for (const llmResult of llmResults) {
      const originalSession = sessionsById.get(llmResult.user_id);
      if (originalSession) {
        results.push({
          ...originalSession,
          facts: {
            generalIntent: llmResult.general_intent || 'Unknown',
            sessionOutcome: llmResult.session_outcome || 'Contained',
            transferReason: llmResult.transfer_reason || '',
            dropOffLocation: llmResult.drop_off_location || '',
            notes: llmResult.notes || 'Analysis completed'
          },
          analysisMetadata: {
            tokensUsed: 0, // Will be updated by caller
            processingTime: 0, // Will be updated by caller
            batchNumber: -1, // Will be updated by caller
            timestamp: new Date().toISOString(),
            model: modelId
          }
        });
      }
    }

    return results;
  }

  private extractNewClassifications(
    processedSessions: SessionWithFacts[],
    baseClassifications: ExistingClassifications
  ): ExistingClassifications {
    const newClassifications: ExistingClassifications = {
      generalIntent: new Set(),
      transferReason: new Set(),
      dropOffLocation: new Set()
    };

    for (const session of processedSessions) {
      const { facts } = session;

      // Check for new general intents
      if (facts.generalIntent && facts.generalIntent.trim() && 
          !baseClassifications.generalIntent.has(facts.generalIntent)) {
        newClassifications.generalIntent.add(facts.generalIntent);
      }

      // Check for new transfer reasons
      if (facts.transferReason && facts.transferReason.trim() && 
          !baseClassifications.transferReason.has(facts.transferReason)) {
        newClassifications.transferReason.add(facts.transferReason);
      }

      // Check for new drop-off locations
      if (facts.dropOffLocation && facts.dropOffLocation.trim() && 
          !baseClassifications.dropOffLocation.has(facts.dropOffLocation)) {
        newClassifications.dropOffLocation.add(facts.dropOffLocation);
      }
    }

    const totalNew = newClassifications.generalIntent.size + 
                    newClassifications.transferReason.size + 
                    newClassifications.dropOffLocation.size;

    if (totalNew > 0) {
      console.log(`[StreamProcessingService] Discovered ${totalNew} new classifications:`, {
        intents: newClassifications.generalIntent.size,
        reasons: newClassifications.transferReason.size,
        locations: newClassifications.dropOffLocation.size
      });
    }

    return newClassifications;
  }

  private accumulateTokenUsage(
    accumulated: BatchTokenUsage,
    newUsage: BatchTokenUsage
  ): BatchTokenUsage {
    return {
      promptTokens: accumulated.promptTokens + newUsage.promptTokens,
      completionTokens: accumulated.completionTokens + newUsage.completionTokens,
      totalTokens: accumulated.totalTokens + newUsage.totalTokens,
      cost: accumulated.cost + newUsage.cost,
      model: newUsage.model
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility method for debugging stream processing
  logStreamAnalysis(streamConfig: StreamConfig): void {
    console.log(`[Stream ${streamConfig.streamId}] Analysis:`, {
      sessionCount: streamConfig.sessions.length,
      modelId: streamConfig.modelId,
      maxSessionsPerCall: streamConfig.maxSessionsPerCall,
      baseClassifications: {
        intents: streamConfig.baseClassifications.generalIntent.size,
        reasons: streamConfig.baseClassifications.transferReason.size,
        locations: streamConfig.baseClassifications.dropOffLocation.size
      }
    });
  }
}