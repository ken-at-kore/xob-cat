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
import { ConflictResolutionService } from './conflictResolutionService';

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
    private tokenManagementService: TokenManagementService,
    private conflictResolutionService?: ConflictResolutionService
  ) {}

  async processInParallel(
    sessions: SessionWithTranscript[],
    baseClassifications: ExistingClassifications,
    config: Partial<ParallelConfig>,
    apiKey: string,
    modelId: string,
    progressCallback?: ParallelProgressCallback
  ): Promise<ParallelProcessingResult> {
    const parallelStartTime = Date.now();
    console.log(`\n🚀 ============ PARALLEL PROCESSING STARTED ============`);
    console.log(`⏱️  Start Time: ${new Date().toISOString()}`);
    console.log(`📊 Total Sessions: ${sessions.length}`);
    
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    // Calculate optimal configuration based on model
    const configStartTime = Date.now();
    const optimalBatchConfig = this.tokenManagementService.getOptimalBatchConfig(modelId);
    fullConfig.maxSessionsPerLLMCall = optimalBatchConfig.maxSessionsPerCall;
    
    // Adjust stream count if recommended
    if (!config.streamCount) {
      fullConfig.streamCount = Math.min(
        optimalBatchConfig.recommendedStreamCount,
        Math.ceil(sessions.length / fullConfig.sessionsPerStream)
      );
    }
    const configDuration = Date.now() - configStartTime;
    
    console.log(`\n⚙️  ============ PARALLEL CONFIGURATION ============`);
    console.log(`⏱️  Config Time: ${configDuration}ms`);
    console.log(`🔧 Stream Count: ${fullConfig.streamCount}`);
    console.log(`📦 Sessions Per Stream: ${fullConfig.sessionsPerStream}`);
    console.log(`🧠 Model: ${modelId}`);
    console.log(`📊 Max Sessions Per API Call: ${fullConfig.maxSessionsPerLLMCall}`);
    console.log(`🎯 Debug Logging: ${fullConfig.debugLogging}`);

    if (fullConfig.debugLogging) {
      console.log(`[DEBUG] Model: ${modelId}, Max sessions per call: ${fullConfig.maxSessionsPerLLMCall}`);
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
      const roundStartTime = Date.now();
      console.log(`\n🔄 ============ ROUND ${roundNumber}/${totalRounds} STARTED ============`);
      console.log(`⏱️  Round ${roundNumber} Start: ${new Date().toISOString()}`);
      console.log(`📊 Sessions Remaining: ${remainingSessions.length}`);

      // Distribute sessions across streams for this round
      const distributionStartTime = Date.now();
      const sessionStreams = this.distributeSessionsAcrossStreams(
        remainingSessions,
        fullConfig.streamCount,
        fullConfig.sessionsPerStream
      );
      const distributionDuration = Date.now() - distributionStartTime;
      
      console.log(`⏱️  Session Distribution Time: ${distributionDuration}ms`);
      console.log(`🌊 Active Streams: ${sessionStreams.length}`);

      if (sessionStreams.length === 0) {
        console.warn(`⚠️  No sessions to distribute in round ${roundNumber}`);
        break;
      }

      // Process all streams in parallel
      const parallelProcessingStartTime = Date.now();
      console.log(`\n🚀 Starting parallel stream processing...`);
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
      const parallelProcessingDuration = Date.now() - parallelProcessingStartTime;
      console.log(`⏱️  Parallel Processing Time: ${parallelProcessingDuration}ms (${(parallelProcessingDuration/1000).toFixed(2)}s)`);

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
      const syncStartTime = Date.now();
      const syncResult = this.synchronizeClassifications(roundResults, currentClassifications);
      currentClassifications = syncResult.mergedClassifications;
      const syncDuration = Date.now() - syncStartTime;
      
      console.log(`\n🔄 ============ CLASSIFICATION SYNCHRONIZATION ============`);
      console.log(`⏱️  Sync Time: ${syncDuration}ms`);
      console.log(`🆕 New Classifications: ${syncResult.newClassificationsCount}`);
      console.log(`📊 Total Classifications: ${currentClassifications.generalIntent.size + currentClassifications.transferReason.size + currentClassifications.dropOffLocation.size}`);

      // NEW: Conflict resolution between rounds
      if (syncResult.newClassificationsCount > 0 && this.shouldRunConflictResolution(currentClassifications)) {
        const conflictResolutionStartTime = Date.now();
        console.log(`\n⚖️ ============ INTER-ROUND CONFLICT RESOLUTION ============`);
        console.log(`⏱️  Starting conflict resolution after round ${roundNumber}`);
        
        // Notify UI that conflict resolution is starting
        progressCallback?.(
          `Conflict resolution after round ${roundNumber}`,
          0,
          allProcessedSessions.length,
          []
        );
        
        try {
          // Run conflict resolution on current processed sessions
          const processedSessionsFromRound = roundResults.flatMap(r => r.processedSessions);
          const resolvedClassifications = await this.runInterRoundConflictResolution(
            processedSessionsFromRound,
            currentClassifications,
            apiKey,
            modelId
          );
          
          if (resolvedClassifications) {
            currentClassifications = resolvedClassifications;
            const conflictResolutionDuration = Date.now() - conflictResolutionStartTime;
            
            console.log(`⏱️  Conflict Resolution Time: ${conflictResolutionDuration}ms`);
            console.log(`✅ Classifications consolidated between rounds`);
            console.log(`📊 Consolidated Classifications: ${currentClassifications.generalIntent.size + currentClassifications.transferReason.size + currentClassifications.dropOffLocation.size}`);
            
            // Notify UI that conflict resolution completed
            progressCallback?.(
              `Conflict resolution complete (round ${roundNumber})`,
              0,
              allProcessedSessions.length,
              []
            );
          }
        } catch (error) {
          console.warn(`⚠️  Inter-round conflict resolution failed: ${error}. Continuing with unresolved classifications.`);
          progressCallback?.(
            `Conflict resolution failed (round ${roundNumber})`,
            0,
            allProcessedSessions.length,
            []
          );
        }
      }

      if (fullConfig.debugLogging) {
        console.log(`[DEBUG] Current classifications after sync:`, {
          intents: currentClassifications.generalIntent.size,
          reasons: currentClassifications.transferReason.size,
          locations: currentClassifications.dropOffLocation.size
        });
      }

      // Remove processed sessions from remaining pool
      const cleanupStartTime = Date.now();
      const processedUserIds = new Set(roundResults.flatMap(r => 
        r.processedSessions.map(s => s.user_id)
      ));
      remainingSessions = remainingSessions.filter(s => !processedUserIds.has(s.user_id));
      const cleanupDuration = Date.now() - cleanupStartTime;
      
      const roundDuration = Date.now() - roundStartTime;
      console.log(`\n✅ ============ ROUND ${roundNumber} COMPLETED ============`);
      console.log(`⏱️  Round ${roundNumber} Total Time: ${roundDuration}ms (${(roundDuration/1000).toFixed(2)}s)`);
      console.log(`⏱️  Session Cleanup Time: ${cleanupDuration}ms`);
      console.log(`📊 Sessions Remaining: ${remainingSessions.length}`);
      console.log(`🎯 Round Breakdown:`);
      console.log(`   • Distribution: ${distributionDuration}ms (${((distributionDuration/roundDuration)*100).toFixed(1)}%)`);
      console.log(`   • Parallel Processing: ${parallelProcessingDuration}ms (${((parallelProcessingDuration/roundDuration)*100).toFixed(1)}%)`);
      console.log(`   • Synchronization: ${syncDuration}ms (${((syncDuration/roundDuration)*100).toFixed(1)}%)`);
      console.log(`   • Cleanup: ${cleanupDuration}ms (${((cleanupDuration/roundDuration)*100).toFixed(1)}%)`);
    }

    const processingTime = Date.now() - parallelStartTime;
    
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

    console.log(`\n🎉 ============ PARALLEL PROCESSING COMPLETE ============`);
    console.log(`⏱️  TOTAL TIME: ${processingTime}ms (${(processingTime/1000).toFixed(2)}s)`);
    console.log(`📊 Sessions Processed: ${allProcessedSessions.length}/${sessions.length}`);
    console.log(`🔄 Total Rounds: ${roundNumber}`);
    console.log(`🌊 Stream Results: ${allStreamResults.length}`);
    console.log(`💰 Token Usage: ${totalTokenUsage.totalTokens} tokens ($${totalTokenUsage.cost.toFixed(4)})`);
    console.log(`📈 Stream Utilization: ${(result.processingStats.averageStreamUtilization * 100).toFixed(1)}%`);
    console.log(`🎯 Performance: ${(allProcessedSessions.length / (processingTime/1000)).toFixed(1)} sessions/second`);
    
    // Calculate average time per session
    const avgTimePerSession = processingTime / allProcessedSessions.length;
    console.log(`⚡ Avg Time Per Session: ${avgTimePerSession.toFixed(2)}ms`);
    
    // Show stream processing distribution
    const streamTimings = allStreamResults.map(sr => ({
      streamId: sr.streamId,
      sessions: sr.processedSessions.length,
      time: sr.processingTime,
      tokensPerSec: sr.tokenUsage.totalTokens / (sr.processingTime/1000)
    }));
    console.log(`\n📊 Stream Performance Breakdown:`);
    streamTimings.forEach(st => {
      console.log(`   Stream ${st.streamId}: ${st.sessions} sessions in ${st.time}ms (${st.tokensPerSec.toFixed(1)} tokens/sec)`);
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
    
    // Follow design specification: 8 streams × 4 sessions per stream = 32 sessions per round
    // This ensures proper multi-round processing with synchronization points
    const designStreamCount = this.DEFAULT_CONFIG.streamCount; // 8 streams
    const designSessionsPerStream = this.DEFAULT_CONFIG.sessionsPerStream; // 4 sessions per stream
    
    // Only adjust for very small session counts where 8 streams would be wasteful
    let optimalStreamCount = designStreamCount;
    let optimalSessionsPerStream = designSessionsPerStream;
    
    if (sessionCount < 16) {
      // For very small counts, reduce streams but keep 4 sessions per stream when possible
      optimalStreamCount = Math.max(1, Math.ceil(sessionCount / 4));
      optimalSessionsPerStream = Math.ceil(sessionCount / optimalStreamCount);
    }
    
    // Ensure sessions per stream doesn't exceed model limits
    if (optimalSessionsPerStream > batchConfig.maxSessionsPerCall) {
      optimalSessionsPerStream = batchConfig.maxSessionsPerCall;
      optimalStreamCount = Math.ceil(sessionCount / optimalSessionsPerStream);
    }
    
    console.log(`[ParallelProcessingOrchestrator] Configuration for ${sessionCount} sessions:`);
    console.log(`  Design: ${designStreamCount} streams × ${designSessionsPerStream} sessions = ${designStreamCount * designSessionsPerStream} per round`);
    console.log(`  Optimal: ${optimalStreamCount} streams × ${optimalSessionsPerStream} sessions = ${optimalStreamCount * optimalSessionsPerStream} per round`);
    console.log(`  Estimated Rounds: ${Math.ceil(sessionCount / (optimalStreamCount * optimalSessionsPerStream))}`);
    
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

  // NEW: Helper method to determine if conflict resolution should run
  private shouldRunConflictResolution(classifications: ExistingClassifications): boolean {
    // Run conflict resolution if we have enough classifications to potentially have conflicts
    const totalClassifications = classifications.generalIntent.size + 
                                classifications.transferReason.size + 
                                classifications.dropOffLocation.size;
    
    console.log(`🔍 [ConflictResolution] Checking if conflict resolution should run:`);
    console.log(`   • Total Classifications: ${totalClassifications}`);
    console.log(`   • Intents: ${classifications.generalIntent.size}`);
    console.log(`   • Reasons: ${classifications.transferReason.size}`);
    console.log(`   • Locations: ${classifications.dropOffLocation.size}`);
    
    const shouldRun = totalClassifications >= 3; // Lower threshold for testing
    console.log(`   • Should Run: ${shouldRun} (threshold: 3)`);
    
    return shouldRun;
  }

  // NEW: Inter-round conflict resolution method
  private async runInterRoundConflictResolution(
    processedSessions: SessionWithFacts[],
    currentClassifications: ExistingClassifications,
    apiKey: string,
    modelId: string
  ): Promise<ExistingClassifications | null> {
    if (!this.conflictResolutionService) {
      console.log(`⚠️  ConflictResolutionService not available, skipping inter-round resolution`);
      return null;
    }

    try {
      // Run conflict resolution on sessions processed in this round
      const conflictResult = await this.conflictResolutionService.resolveConflicts(
        processedSessions,
        apiKey,
        modelId
      );

      if (conflictResult.resolutions) {
        // Apply resolutions to update the current classifications
        const resolvedClassifications = this.applyResolutionsToClassifications(
          currentClassifications,
          conflictResult.resolutions
        );

        console.log(`⚖️  Conflict resolution applied: ${conflictResult.resolutionStats.conflictsResolved} conflicts resolved`);
        return resolvedClassifications;
      }

      return currentClassifications;
    } catch (error) {
      console.error(`❌ Inter-round conflict resolution failed:`, error);
      return null;
    }
  }

  // NEW: Apply conflict resolutions to current classifications
  private applyResolutionsToClassifications(
    classifications: ExistingClassifications,
    resolutions: any
  ): ExistingClassifications {
    const resolvedClassifications = this.cloneClassifications(classifications);

    // Create mapping from resolutions
    const intentMapping = this.createResolutionMapping(resolutions.generalIntents);
    const reasonMapping = this.createResolutionMapping(resolutions.transferReasons);
    const locationMapping = this.createResolutionMapping(resolutions.dropOffLocations);

    // Apply intent resolutions
    const resolvedIntents = new Set<string>();
    for (const intent of resolvedClassifications.generalIntent) {
      const resolved = intentMapping.get(intent) || intent;
      resolvedIntents.add(resolved);
    }
    resolvedClassifications.generalIntent = resolvedIntents;

    // Apply reason resolutions
    const resolvedReasons = new Set<string>();
    for (const reason of resolvedClassifications.transferReason) {
      const resolved = reasonMapping.get(reason) || reason;
      resolvedReasons.add(resolved);
    }
    resolvedClassifications.transferReason = resolvedReasons;

    // Apply location resolutions
    const resolvedLocations = new Set<string>();
    for (const location of resolvedClassifications.dropOffLocation) {
      const resolved = locationMapping.get(location) || location;
      resolvedLocations.add(resolved);
    }
    resolvedClassifications.dropOffLocation = resolvedLocations;

    return resolvedClassifications;
  }

  // NEW: Helper method to create resolution mapping
  private createResolutionMapping(resolutions: Array<{ canonical: string; aliases: string[] }>): Map<string, string> {
    const mapping = new Map<string, string>();
    
    for (const resolution of resolutions) {
      // Map canonical to itself
      mapping.set(resolution.canonical, resolution.canonical);
      
      // Map all aliases to canonical
      for (const alias of resolution.aliases) {
        mapping.set(alias, resolution.canonical);
      }
    }
    
    return mapping;
  }
}