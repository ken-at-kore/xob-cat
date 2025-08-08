import {
  SessionWithTranscript,
  SessionWithFacts,
  ParallelConfig,
  ParallelProcessingResult,
  ParallelProgressCallback,
  ExistingClassifications,
  StreamConfig,
  StreamResult,
  SessionStream,
  StreamProgress,
  BatchTokenUsage
} from '../../../shared/types';
import { StreamProcessingService } from './streamProcessingService';
import { TokenManagementService } from './tokenManagementService';

export class ParallelProcessingOrchestratorService {
  private readonly DEFAULT_CONFIG: ParallelConfig = {
    streamCount: parseInt(process.env.PARALLEL_STREAM_COUNT || '8'),
    sessionsPerStream: parseInt(process.env.SESSIONS_PER_STREAM || '4'),
    maxSessionsPerLLMCall: 0, // Will be calculated dynamically
    syncFrequency: 'after_each_round',
    retryAttempts: 3,
    debugLogging: process.env.PARALLEL_PROCESSING_DEBUG === 'true'
  };

  constructor(
    private streamProcessingService: StreamProcessingService,
    private tokenManagementService: TokenManagementService
  ) {}

  async processInParallel(
    sessions: SessionWithTranscript[],
    baseClassifications: ExistingClassifications,
    config: Partial<ParallelConfig>,
    apiKey: string,
    modelId: string,
    progressCallback?: ParallelProgressCallback
  ): Promise<ParallelProcessingResult> {
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    // Calculate optimal configuration based on model
    const optimalBatchConfig = this.tokenManagementService.getOptimalBatchConfig(modelId);
    fullConfig.maxSessionsPerLLMCall = optimalBatchConfig.maxSessionsPerCall;
    
    // Adjust stream count if recommended
    if (!config.streamCount) {
      fullConfig.streamCount = Math.min(
        optimalBatchConfig.recommendedStreamCount,
        Math.ceil(sessions.length / fullConfig.sessionsPerStream)
      );
    }

    console.log(`[ParallelProcessingOrchestrator] Starting parallel processing with config:`, fullConfig);
    console.log(`[ParallelProcessingOrchestrator] Processing ${sessions.length} sessions with ${fullConfig.streamCount} streams`);

    if (fullConfig.debugLogging) {
      console.log(`[ParallelProcessingOrchestrator] Model: ${modelId}, Max sessions per call: ${fullConfig.maxSessionsPerLLMCall}`);
    }

    const startTime = Date.now();
    let currentClassifications = this.cloneClassifications(baseClassifications);
    let allProcessedSessions: SessionWithFacts[] = [];
    let allStreamResults: StreamResult[] = [];
    let totalTokenUsage: BatchTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      model: modelId
    };

    let remainingSessions = [...sessions];
    let roundNumber = 0;
    let totalRounds = Math.ceil(sessions.length / (fullConfig.streamCount * fullConfig.sessionsPerStream));

    progressCallback?.(
      'parallel_processing',
      0,
      0,
      []
    );

    while (remainingSessions.length > 0) {
      roundNumber++;
      console.log(`[ParallelProcessingOrchestrator] Starting round ${roundNumber}/${totalRounds} with ${remainingSessions.length} sessions`);

      // Distribute sessions across streams for this round
      const sessionStreams = this.distributeSessionsAcrossStreams(
        remainingSessions,
        fullConfig.streamCount,
        fullConfig.sessionsPerStream
      );

      if (sessionStreams.length === 0) {
        console.warn(`[ParallelProcessingOrchestrator] No sessions to distribute in round ${roundNumber}`);
        break;
      }

      // Process all streams in parallel
      const roundResults = await this.processStreamsInParallel(
        sessionStreams,
        currentClassifications,
        fullConfig,
        apiKey,
        modelId,
        (streamProgress) => {
          progressCallback?.(
            `Round ${roundNumber}/${totalRounds}`,
            sessionStreams.length,
            allProcessedSessions.length,
            streamProgress
          );
        }
      );

      // Collect results from all streams
      for (const streamResult of roundResults) {
        allProcessedSessions.push(...streamResult.processedSessions);
        allStreamResults.push(streamResult);
        totalTokenUsage = this.accumulateTokenUsage(totalTokenUsage, streamResult.tokenUsage);
        
        if (fullConfig.debugLogging) {
          console.log(`[ParallelProcessingOrchestrator] Stream ${streamResult.streamId} completed: ${streamResult.processedSessions.length} sessions, ${streamResult.tokenUsage.totalTokens} tokens`);
        }
      }

      // Synchronization point - merge new classifications
      const syncResult = this.synchronizeClassifications(roundResults, currentClassifications);
      currentClassifications = syncResult.mergedClassifications;

      console.log(`[ParallelProcessingOrchestrator] Round ${roundNumber} sync complete: ${syncResult.newClassificationsCount} new classifications discovered`);

      if (fullConfig.debugLogging) {
        console.log(`[ParallelProcessingOrchestrator] Current classifications after sync:`, {
          intents: currentClassifications.generalIntent.size,
          reasons: currentClassifications.transferReason.size,
          locations: currentClassifications.dropOffLocation.size
        });
      }

      // Remove processed sessions from remaining pool
      const processedUserIds = new Set(roundResults.flatMap(r => 
        r.processedSessions.map(s => s.user_id)
      ));
      remainingSessions = remainingSessions.filter(s => !processedUserIds.has(s.user_id));

      console.log(`[ParallelProcessingOrchestrator] Round ${roundNumber} complete: ${remainingSessions.length} sessions remaining`);
    }

    const processingTime = Date.now() - startTime;
    
    const result: ParallelProcessingResult = {
      processedSessions: allProcessedSessions,
      finalClassifications: currentClassifications,
      streamResults: allStreamResults,
      totalTokenUsage,
      processingStats: {
        totalRounds: roundNumber,
        averageStreamUtilization: this.calculateAverageStreamUtilization(allStreamResults),
        syncPoints: roundNumber
      }
    };

    console.log(`[ParallelProcessingOrchestrator] Parallel processing complete in ${processingTime}ms:`, {
      totalSessions: allProcessedSessions.length,
      totalRounds: roundNumber,
      totalTokens: totalTokenUsage.totalTokens,
      totalCost: totalTokenUsage.cost,
      averageUtilization: result.processingStats.averageStreamUtilization
    });

    return result;
  }

  distributeSessionsAcrossStreams(
    sessions: SessionWithTranscript[],
    streamCount: number,
    sessionsPerStream: number
  ): SessionStream[] {
    if (sessions.length === 0) {
      return [];
    }

    // Calculate how many sessions to process in this round
    const maxSessionsThisRound = streamCount * sessionsPerStream;
    const sessionsToProcess = sessions.slice(0, maxSessionsThisRound);
    
    const streams: SessionStream[] = [];
    
    for (let streamId = 0; streamId < streamCount; streamId++) {
      const startIndex = streamId * sessionsPerStream;
      const endIndex = Math.min(startIndex + sessionsPerStream, sessionsToProcess.length);
      
      if (startIndex < sessionsToProcess.length) {
        const streamSessions = sessionsToProcess.slice(startIndex, endIndex);
        streams.push({
          streamId: streamId + 1, // 1-based indexing for display
          sessions: streamSessions
        });
      }
    }

    console.log(`[ParallelProcessingOrchestrator] Distributed ${sessionsToProcess.length} sessions across ${streams.length} streams:`, 
      streams.map(s => `Stream ${s.streamId}: ${s.sessions.length} sessions`)
    );

    return streams;
  }

  private async processStreamsInParallel(
    sessionStreams: SessionStream[],
    baseClassifications: ExistingClassifications,
    config: ParallelConfig,
    apiKey: string,
    modelId: string,
    progressCallback?: (streamProgress: StreamProgress[]) => void
  ): Promise<StreamResult[]> {
    console.log(`[ParallelProcessingOrchestrator] Starting ${sessionStreams.length} streams in parallel`);
    
    // Track progress for all streams
    const streamProgress: Map<number, StreamProgress> = new Map();
    
    // Initialize progress tracking
    sessionStreams.forEach(stream => {
      streamProgress.set(stream.streamId, {
        streamId: stream.streamId,
        sessionsAssigned: stream.sessions.length,
        sessionsProcessed: 0,
        status: 'idle',
        tokensUsed: 0
      });
    });

    // Create stream processing promises
    const streamPromises = sessionStreams.map(sessionStream => {
      const streamConfig: StreamConfig = {
        streamId: sessionStream.streamId,
        sessions: sessionStream.sessions,
        baseClassifications,
        modelId,
        apiKey,
        maxSessionsPerCall: config.maxSessionsPerLLMCall
      };

      return this.streamProcessingService.processStream(
        streamConfig,
        (streamId, processed, total, tokens) => {
          // Update progress for this stream
          const progress = streamProgress.get(streamId);
          if (progress) {
            progress.sessionsProcessed = processed;
            progress.tokensUsed = tokens;
            progress.status = processed >= total ? 'completed' : 'processing';
            
            // Report overall progress
            progressCallback?.(Array.from(streamProgress.values()));
          }
        }
      );
    });

    // Wait for all streams to complete
    const streamResults = await Promise.allSettled(streamPromises);
    
    // Process results and handle any failures
    const successfulResults: StreamResult[] = [];
    const failedStreams: number[] = [];

    streamResults.forEach((result, index) => {
      const streamId = sessionStreams[index]!.streamId;
      
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
        const progress = streamProgress.get(streamId);
        if (progress) {
          progress.status = 'completed';
        }
      } else {
        console.error(`[ParallelProcessingOrchestrator] Stream ${streamId} failed:`, result.reason);
        failedStreams.push(streamId);
        const progress = streamProgress.get(streamId);
        if (progress) {
          progress.status = 'error';
        }
      }
    });

    // Report final progress
    progressCallback?.(Array.from(streamProgress.values()));

    if (failedStreams.length > 0) {
      console.warn(`[ParallelProcessingOrchestrator] ${failedStreams.length} streams failed:`, failedStreams);
    }

    console.log(`[ParallelProcessingOrchestrator] Parallel processing complete: ${successfulResults.length}/${sessionStreams.length} streams succeeded`);

    return successfulResults;
  }

  synchronizeClassifications(
    streamResults: StreamResult[],
    baseClassifications: ExistingClassifications
  ): {
    mergedClassifications: ExistingClassifications;
    newClassificationsCount: number;
  } {
    console.log(`[ParallelProcessingOrchestrator] Synchronizing classifications from ${streamResults.length} streams`);
    
    const mergedClassifications = this.cloneClassifications(baseClassifications);
    let newClassificationsCount = 0;

    // Merge new classifications from all streams
    for (const streamResult of streamResults) {
      const newClassifications = streamResult.newClassifications;
      
      // Add new general intents
      for (const intent of newClassifications.generalIntent) {
        if (!mergedClassifications.generalIntent.has(intent)) {
          mergedClassifications.generalIntent.add(intent);
          newClassificationsCount++;
        }
      }
      
      // Add new transfer reasons
      for (const reason of newClassifications.transferReason) {
        if (!mergedClassifications.transferReason.has(reason)) {
          mergedClassifications.transferReason.add(reason);
          newClassificationsCount++;
        }
      }
      
      // Add new drop-off locations
      for (const location of newClassifications.dropOffLocation) {
        if (!mergedClassifications.dropOffLocation.has(location)) {
          mergedClassifications.dropOffLocation.add(location);
          newClassificationsCount++;
        }
      }
    }

    console.log(`[ParallelProcessingOrchestrator] Synchronization complete: ${newClassificationsCount} new classifications added`);
    
    return {
      mergedClassifications,
      newClassificationsCount
    };
  }

  private calculateAverageStreamUtilization(streamResults: StreamResult[]): number {
    if (streamResults.length === 0) return 0;
    
    const totalUtilization = streamResults.reduce((sum, result) => {
      // Calculate utilization as a ratio of processed vs assigned sessions
      const utilization = result.processedSessions.length > 0 ? 1.0 : 0.0;
      return sum + utilization;
    }, 0);
    
    return Math.round((totalUtilization / streamResults.length) * 100) / 100;
  }

  private cloneClassifications(classifications: ExistingClassifications): ExistingClassifications {
    return {
      generalIntent: new Set(classifications.generalIntent),
      transferReason: new Set(classifications.transferReason),
      dropOffLocation: new Set(classifications.dropOffLocation)
    };
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

  // Method to get optimal configuration for a given model and session count
  getOptimalConfiguration(
    sessionCount: number,
    modelId: string
  ): ParallelConfig {
    const batchConfig = this.tokenManagementService.getOptimalBatchConfig(modelId);
    
    // Calculate optimal stream count based on session count and model capabilities
    let optimalStreamCount = batchConfig.recommendedStreamCount;
    let optimalSessionsPerStream = Math.ceil(sessionCount / optimalStreamCount);
    
    // Adjust if sessions per stream is too low (inefficient) or too high (overwhelming)
    if (optimalSessionsPerStream < 4) {
      optimalStreamCount = Math.max(1, Math.ceil(sessionCount / 4));
      optimalSessionsPerStream = Math.ceil(sessionCount / optimalStreamCount);
    } else if (optimalSessionsPerStream > batchConfig.maxSessionsPerCall) {
      optimalSessionsPerStream = batchConfig.maxSessionsPerCall;
      optimalStreamCount = Math.ceil(sessionCount / optimalSessionsPerStream);
    }
    
    return {
      streamCount: optimalStreamCount,
      sessionsPerStream: optimalSessionsPerStream,
      maxSessionsPerLLMCall: batchConfig.maxSessionsPerCall,
      syncFrequency: 'after_each_round',
      retryAttempts: 3,
      debugLogging: process.env.PARALLEL_PROCESSING_DEBUG === 'true'
    };
  }

  // Debug method to log detailed processing analysis
  logProcessingAnalysis(
    sessions: SessionWithTranscript[],
    config: ParallelConfig,
    modelId: string
  ): void {
    const analysis = {
      totalSessions: sessions.length,
      modelId,
      streamCount: config.streamCount,
      sessionsPerStream: config.sessionsPerStream,
      maxSessionsPerCall: config.maxSessionsPerLLMCall,
      estimatedRounds: Math.ceil(sessions.length / (config.streamCount * config.sessionsPerStream)),
      estimatedParallelism: Math.min(config.streamCount, Math.ceil(sessions.length / config.sessionsPerStream))
    };
    
    console.log(`[ParallelProcessingOrchestrator] Processing Analysis:`, analysis);
  }
}