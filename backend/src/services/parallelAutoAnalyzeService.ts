import { v4 as uuidv4 } from 'uuid';
import {
  AnalysisConfig,
  AnalysisProgress,
  SessionWithFacts,
  AnalysisResults,
  AutoAnalysisStartResponse,
  BackgroundJob,
  ParallelConfig,
  DiscoveryConfig,
  BatchTokenUsage,
  AnalysisSummary,
  ParallelAnalysisProgress
} from '../../../shared/types';
import { SessionSamplingService } from './sessionSamplingService';
import { StrategicDiscoveryService } from './strategicDiscoveryService';
import { ParallelProcessingOrchestratorService } from './parallelProcessingOrchestratorService';
import { ConflictResolutionService } from './conflictResolutionService';
import { TokenManagementService } from './tokenManagementService';
import { SessionValidationService } from './sessionValidationService';
import { getBackgroundJobQueue } from './backgroundJobQueue';
import { StreamProcessingService } from './streamProcessingService';
import { BatchAnalysisService } from './batchAnalysisService';
import { AnalysisSummaryService } from './analysisSummaryService';
import { MockAnalysisSummaryService } from '../__mocks__/analysisSummaryService.mock';
import { ServiceFactory } from '../factories/serviceFactory';
import { ServiceType } from '../interfaces';
import { IKoreApiService, IOpenAIService } from '../interfaces';

interface ParallelAnalysisSession {
  id: string;
  config: AnalysisConfig;
  progress: ParallelAnalysisProgress;
  results?: SessionWithFacts[];
  analysisSummary?: AnalysisSummary;
  cancelled: boolean;
}

/**
 * ✅ RECOMMENDED: Advanced parallel auto-analyze service with multi-phase processing.
 * This is the preferred implementation over the deprecated sequential AutoAnalyzeService.
 * Provides better performance, consistency, and scalability through intelligent parallel processing.
 */
export class ParallelAutoAnalyzeService {
  private activeSessions = new Map<string, ParallelAnalysisSession>();
  
  // Service dependencies
  private tokenManagementService: TokenManagementService;
  private sessionValidationService: SessionValidationService;
  private strategicDiscoveryService: StrategicDiscoveryService;
  private streamProcessingService: StreamProcessingService;
  private parallelProcessingOrchestratorService: ParallelProcessingOrchestratorService;
  private conflictResolutionService: ConflictResolutionService;

  constructor(
    private koreApiService: IKoreApiService,
    private sessionSamplingService: SessionSamplingService,
    private batchAnalysisService: BatchAnalysisService,
    private openaiAnalysisService: IOpenAIService,
    private botId: string,
    private credentials?: { clientId: string; clientSecret: string }
  ) {
    // Initialize all service dependencies
    this.tokenManagementService = new TokenManagementService();
    this.sessionValidationService = new SessionValidationService();
    
    this.strategicDiscoveryService = new StrategicDiscoveryService(
      this.batchAnalysisService,
      this.openaiAnalysisService
    );
    
    // Initialize ConflictResolutionService BEFORE ParallelProcessingOrchestratorService
    this.conflictResolutionService = new ConflictResolutionService(
      this.openaiAnalysisService
    );
    
    this.streamProcessingService = new StreamProcessingService(
      this.tokenManagementService,
      this.sessionValidationService,
      this.openaiAnalysisService
    );
    
    this.parallelProcessingOrchestratorService = new ParallelProcessingOrchestratorService(
      this.streamProcessingService,
      this.tokenManagementService,
      this.conflictResolutionService
    );
  }

  async startAnalysis(config: AnalysisConfig): Promise<AutoAnalysisStartResponse> {
    const analysisId = uuidv4();
    const backgroundJobId = `${analysisId}-parallel`;
    
    console.log(`🚀 [ParallelAutoAnalyzeService] Starting parallel analysis ${analysisId} with bot ${this.botId}`);
    console.log(`🚀 [ParallelAutoAnalyzeService] Using credentials: ${this.credentials ? 'real' : 'mock'}`);
    
    const analysisSession: ParallelAnalysisSession = {
      id: analysisId,
      config,
      progress: {
        analysisId,
        phase: 'sampling',
        currentStep: 'Initializing parallel analysis...',
        sessionsFound: 0,
        sessionsProcessed: 0,
        totalSessions: config.sessionCount,
        batchesCompleted: 0,
        totalBatches: 0,
        tokensUsed: 0,
        estimatedCost: 0,
        modelId: config.modelId,
        botId: this.botId,
        startTime: new Date().toISOString(),
        backgroundJobId,
        backgroundJobStatus: 'queued',
        // Parallel-specific fields
        roundsCompleted: 0,
        totalRounds: 0,
        streamsActive: 0
      },
      cancelled: false
    };

    this.activeSessions.set(analysisId, analysisSession);
    // Session stored in singleton instance for background job processing

    // Create background job for parallel processing
    const backgroundJob: BackgroundJob = {
      id: backgroundJobId,
      analysisId,
      status: 'queued',
      phase: 'sampling',
      createdAt: new Date(),
      progress: analysisSession.progress,
      config,
      ...(this.credentials ? {
        credentials: {
          botId: this.botId,
          clientId: this.credentials.clientId,
          clientSecret: this.credentials.clientSecret
        }
      } : {})
    };

    // Enqueue the background job for async processing
    const jobQueue = getBackgroundJobQueue();
    await jobQueue.enqueue(backgroundJob);

    return {
      analysisId,
      backgroundJobId,
      status: 'started',
      message: 'Parallel analysis started in background'
    };
  }

  async getProgress(analysisId: string): Promise<ParallelAnalysisProgress> {
    const session = this.activeSessions.get(analysisId);
    if (!session) {
      throw new Error('Analysis not found');
    }
    
    // Update progress from background job if available
    const jobQueue = getBackgroundJobQueue();
    if (session.progress.backgroundJobId) {
      const backgroundJob = await jobQueue.getJob(session.progress.backgroundJobId);
      if (backgroundJob) {
        session.progress = {
          ...session.progress,
          ...backgroundJob.progress,
          backgroundJobStatus: backgroundJob.status
        } as ParallelAnalysisProgress;
        
        if (backgroundJob.status === 'failed') {
          session.progress.phase = 'error';
          session.progress.error = backgroundJob.error || 'Background job failed';
          session.progress.endTime = new Date().toISOString();
        }
      }
    }
    
    return session.progress;
  }

  async getResults(analysisId: string): Promise<AnalysisResults> {
    const session = this.activeSessions.get(analysisId);
    if (!session) {
      throw new Error('Analysis not found');
    }
    
    if (session.progress.phase !== 'complete') {
      throw new Error('Analysis not complete');
    }

    if (!session.results) {
      throw new Error('Results not available');
    }

    return {
      sessions: session.results,
      analysisSummary: session.analysisSummary,
      botId: this.botId
    };
  }

  async getConfig(analysisId: string): Promise<AnalysisConfig> {
    const session = this.activeSessions.get(analysisId);
    if (!session) {
      throw new Error('Analysis not found');
    }
    return session.config;
  }

  async cancelAnalysis(analysisId: string): Promise<boolean> {
    const session = this.activeSessions.get(analysisId);
    if (!session) {
      throw new Error('Analysis not found');
    }

    if (session.progress.phase === 'complete') {
      return false;
    }

    session.cancelled = true;
    await this.updateProgress(analysisId, {
      phase: 'error',
      currentStep: 'Analysis cancelled by user',
      error: 'Cancelled',
      endTime: new Date().toISOString()
    });

    return true;
  }

  async storeResults(analysisId: string, results: AnalysisResults): Promise<void> {
    const session = this.activeSessions.get(analysisId);
    if (!session) {
      console.error(`Cannot store results: Analysis ${analysisId} not found`);
      return;
    }
    
    session.results = results.sessions;
    if (results.analysisSummary) {
      session.analysisSummary = results.analysisSummary;
    }
    
    this.updateProgress(analysisId, {
      phase: 'complete',
      currentStep: 'Parallel analysis complete',
      endTime: new Date().toISOString()
    });
  }

  // Main parallel analysis workflow - called by background job processor
  async runParallelAnalysis(analysisId: string): Promise<void> {
    console.log(`[ParallelAutoAnalyzeService] Running parallel analysis for ${analysisId}`);
    
    const session = this.activeSessions.get(analysisId);
    if (!session) {
      console.error(`[ParallelAutoAnalyzeService] Analysis session ${analysisId} not found in activeSessions`);
      throw new Error(`Analysis session ${analysisId} not found`);
    }

    try {
      // Phase 0: Session Sampling (same as sequential)
      console.log(`[ParallelAutoAnalyzeService] Phase 0: Starting session sampling for ${analysisId}`);
      const samplingResult = await this.runSamplingPhase(session);
      if (session.cancelled) return;

      // Phase 1: Strategic Discovery
      const discoveryResult = await this.runDiscoveryPhase(session, samplingResult);
      if (session.cancelled) return;

      // Phase 2: Parallel Processing
      const parallelResult = await this.runParallelProcessingPhase(session, discoveryResult);
      if (session.cancelled) return;

      // Phase 3: Conflict Resolution
      const resolvedSessions = await this.runConflictResolutionPhase(session, parallelResult);
      if (session.cancelled) return;

      // Phase 4: Summary Generation
      await this.runSummaryGenerationPhase(session, resolvedSessions);
      if (session.cancelled) return;

      // Complete the analysis
      session.results = resolvedSessions;
      this.updateProgress(analysisId, {
        phase: 'complete',
        currentStep: 'Parallel analysis complete',
        sessionsProcessed: resolvedSessions.length,
        endTime: new Date().toISOString()
      });

      console.log(`[ParallelAutoAnalyzeService] Parallel analysis ${analysisId} completed successfully`);

      // Cleanup after some time
      setTimeout(() => {
        this.activeSessions.delete(analysisId);
      }, 3600000); // 1 hour

    } catch (error) {
      console.error(`[ParallelAutoAnalyzeService] Analysis ${analysisId} failed:`, error);
      this.updateProgress(analysisId, {
        phase: 'error',
        currentStep: 'Parallel analysis failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: new Date().toISOString()
      });
    }
  }

  private async runSamplingPhase(session: ParallelAnalysisSession): Promise<any> {
    await this.updateProgress(session.id, {
      phase: 'sampling',
      currentStep: 'Initializing session search...'
    });

    try {
      const samplingResult = await this.sessionSamplingService.sampleSessions(
        session.config,
        async (currentStep: string, sessionsFound: number, windowIndex: number, windowLabel: string, messageProgress?: { sessionsWithMessages: number; totalSessions: number; currentBatch?: number; totalBatches?: number }) => {
          // Update progress with sampling details
          await this.updateProgress(session.id, {
            currentStep,
            sessionsFound,
            samplingProgress: {
              currentWindowIndex: windowIndex,
              totalWindows: 4,
              currentWindowLabel: windowLabel,
              targetSessionCount: session.config.sessionCount
            },
            ...(messageProgress && { messageProgress })
          });
        }
      );
      
      // Sampling completed successfully
      
      await this.updateProgress(session.id, {
        currentStep: `Sampling complete: found ${samplingResult.sessions.length} sessions`,
        sessionsFound: samplingResult.sessions.length,
        totalSessions: samplingResult.sessions.length
      });

      return samplingResult;
    } catch (error) {
      console.error('Error in sessionSamplingService.sampleSessions:', error);
      throw error;
    }
  }

  private async runDiscoveryPhase(session: ParallelAnalysisSession, samplingResult: any): Promise<any> {
    await this.updateProgress(session.id, {
      phase: 'discovery',
      currentStep: 'Starting strategic discovery phase...'
    });
    
    // Use adaptive discovery config based on session count
    const totalSessions = samplingResult.sessions.length;
    const discoveryConfig: DiscoveryConfig = this.getAdaptiveDiscoveryConfig(totalSessions);
    
    const discoveryResult = await this.strategicDiscoveryService.runDiscovery(
      samplingResult.sessions,
      discoveryConfig,
      async (step: string, progress: number, total: number, discoveries: number) => {
        await this.updateProgress(session.id, {
          currentStep: step,
          discoveryStats: {
            discoveredIntents: discoveries, // Use actual discovery count from callback
            discoveredReasons: 0, // Will be broken down in final update
            discoveredLocations: 0, // Will be broken down in final update
            discoveryRate: discoveries / Math.max(total, 1)
          }
        });
      },
      session.config.openaiApiKey,
      session.config.modelId
    );

    await this.updateProgress(session.id, {
      currentStep: `Discovery complete: ${discoveryResult.discoveryStats.totalProcessed} sessions processed`,
      discoveryStats: {
        discoveredIntents: discoveryResult.discoveryStats.uniqueIntents,
        discoveredReasons: discoveryResult.discoveryStats.uniqueReasons,
        discoveredLocations: discoveryResult.discoveryStats.uniqueLocations,
        discoveryRate: discoveryResult.discoveryStats.discoveryRate
      }
    });

    return { samplingResult, discoveryResult };
  }

  private async runParallelProcessingPhase(session: ParallelAnalysisSession, discoveryResult: any): Promise<any> {
    await this.updateProgress(session.id, {
      phase: 'parallel_processing',
      currentStep: 'Starting parallel processing...'
    });

    // Get optimal parallel configuration
    const parallelConfig = this.parallelProcessingOrchestratorService.getOptimalConfiguration(
      discoveryResult.discoveryResult.remainingSessions.length,
      session.config.modelId
    );

    console.log(`[ParallelAutoAnalyzeService] Using parallel config:`, parallelConfig);

    // Update progress with parallel processing info
    this.updateProgress(session.id, {
      totalRounds: Math.ceil(discoveryResult.discoveryResult.remainingSessions.length / (parallelConfig.streamCount * parallelConfig.sessionsPerStream)),
      streamsActive: parallelConfig.streamCount
    });

    const parallelResult = await this.parallelProcessingOrchestratorService.processInParallel(
      discoveryResult.discoveryResult.remainingSessions,
      discoveryResult.discoveryResult.baseClassifications,
      parallelConfig,
      session.config.openaiApiKey,
      session.config.modelId,
      (phase: string, streamsActive: number, totalProgress: number, streamProgress: any[]) => {
        this.updateProgress(session.id, {
          currentStep: `Parallel processing: ${phase}`,
          streamsActive
          // streamProgress removed - not displaying individual streams in simplified UI
        });
      }
    );

    // Combine discovery results with parallel processing results
    const allProcessedSessions = [
      ...discoveryResult.discoveryResult.processedSessions,
      ...parallelResult.processedSessions
    ];

    const combinedTokenUsage = this.accumulateTokenUsage(
      discoveryResult.discoveryResult.tokenUsage,
      parallelResult.totalTokenUsage
    );

    this.updateProgress(session.id, {
      currentStep: `Parallel processing complete: ${allProcessedSessions.length} sessions processed`,
      sessionsProcessed: allProcessedSessions.length,
      tokensUsed: combinedTokenUsage.totalTokens,
      estimatedCost: combinedTokenUsage.cost
    });

    return { allProcessedSessions, combinedTokenUsage, parallelResult };
  }

  private async runConflictResolutionPhase(session: ParallelAnalysisSession, parallelResult: any): Promise<SessionWithFacts[]> {
    this.updateProgress(session.id, {
      phase: 'conflict_resolution',
      currentStep: 'Resolving classification conflicts...'
    });

    const conflictResolutionResult = await this.conflictResolutionService.resolveConflicts(
      parallelResult.allProcessedSessions,
      session.config.openaiApiKey,
      session.config.modelId
    );

    this.updateProgress(session.id, {
      currentStep: 'Conflict resolution complete',
      conflictStats: conflictResolutionResult.resolutionStats,
      tokensUsed: parallelResult.combinedTokenUsage.totalTokens + conflictResolutionResult.tokenUsage.totalTokens,
      estimatedCost: parallelResult.combinedTokenUsage.cost + conflictResolutionResult.tokenUsage.cost
    });

    return conflictResolutionResult.resolvedSessions;
  }

  private async runSummaryGenerationPhase(session: ParallelAnalysisSession, resolvedSessions: SessionWithFacts[]): Promise<void> {
    this.updateProgress(session.id, {
      currentStep: 'Generating analysis summary...'
    });

    try {
      // Use mock or real service based on ServiceFactory configuration
      const serviceType = ServiceFactory.getServiceType();
      let analysisSummary;
      
      if (serviceType === ServiceType.MOCK || serviceType === ServiceType.HYBRID) {
        console.log('[ParallelAutoAnalyzeService] Using mock analysis summary service');
        const mockAnalysisSummaryService = new MockAnalysisSummaryService(session.config.openaiApiKey);
        analysisSummary = await mockAnalysisSummaryService.generateAnalysisSummary(resolvedSessions);
      } else {
        console.log('[ParallelAutoAnalyzeService] Using real analysis summary service');
        const analysisSummaryService = new AnalysisSummaryService(session.config.openaiApiKey);
        analysisSummary = await analysisSummaryService.generateAnalysisSummary(resolvedSessions);
      }
      
      session.analysisSummary = analysisSummary;

      // Approximate additional token usage for summary generation
      const currentProgress = session.progress;
      this.updateProgress(session.id, {
        tokensUsed: currentProgress.tokensUsed + 1000,
        estimatedCost: currentProgress.estimatedCost + 0.002
      });
    } catch (error) {
      console.error('[ParallelAutoAnalyzeService] Failed to generate analysis summary:', error);
    }
  }

  private async updateProgress(analysisId: string, updates: Partial<ParallelAnalysisProgress>): Promise<void> {
    const session = this.activeSessions.get(analysisId);
    if (!session) return;

    // Update local session progress
    session.progress = { ...session.progress, ...updates };
    
    // Also update background job progress if available so frontend can see real-time updates
    if (session.progress.backgroundJobId) {
      try {
        const jobQueue = getBackgroundJobQueue();
        const backgroundJob = await jobQueue.getJob(session.progress.backgroundJobId);
        if (backgroundJob) {
          // Update the background job's progress with the new data
          backgroundJob.progress = {
            ...backgroundJob.progress,
            ...updates,
            lastUpdated: new Date().toISOString()
          } as ParallelAnalysisProgress;
          
          await jobQueue.updateJob(session.progress.backgroundJobId, backgroundJob);
        }
      } catch (error) {
        console.error(`[ParallelAutoAnalyzeService] Failed to sync progress with background job: ${error}`);
        // Continue execution - local progress is still updated
      }
    }
  }

  private getAdaptiveDiscoveryConfig(totalSessions: number): DiscoveryConfig {
    const baseConfig = StrategicDiscoveryService.getDefaultConfig();
    
    // Always ensure discovery runs according to design: 10-15% of sessions
    // Minimum 5 sessions, maximum 150 sessions (as per design document)
    const targetPercentage = 15; // Always use 15% as per design
    const targetSessions = Math.ceil(totalSessions * (targetPercentage / 100));
    
    // Design requirements: minimum 5 sessions for meaningful discovery
    const minSessions = Math.max(5, Math.floor(totalSessions * 0.10)); // At least 10% 
    const maxSessions = Math.min(150, Math.floor(totalSessions * 0.15)); // At most 15%
    
    return {
      ...baseConfig,
      targetPercentage,
      minSessions,
      maxSessions: Math.max(minSessions, maxSessions) // Ensure maxSessions >= minSessions
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

  // Static methods for singleton pattern (similar to original AutoAnalyzeService)
  private static instances = new Map<string, ParallelAutoAnalyzeService>();
  
  static getInstance(botId: string): ParallelAutoAnalyzeService | undefined {
    return ParallelAutoAnalyzeService.instances.get(botId);
  }
  
  static create(
    botId: string, 
    jwtToken: string, 
    credentials?: { clientId: string; clientSecret: string }
  ): ParallelAutoAnalyzeService {
    // Create or retrieve singleton instance for bot
    if (!ParallelAutoAnalyzeService.instances.has(botId)) {
      // Creating new service instance
      
      const koreApiConfig = {
        botId,
        clientId: credentials?.clientId || 'mock-client-id',
        clientSecret: credentials?.clientSecret || 'mock-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };
      
      const koreApiService = ServiceFactory.createKoreApiService(koreApiConfig);
      const openaiAnalysisService = ServiceFactory.createOpenAIService();
      
      const swtService = new (require('./swtService').SWTService)(koreApiService);
      const sessionSamplingService = new SessionSamplingService(swtService, koreApiService);
      const batchAnalysisService = new BatchAnalysisService(openaiAnalysisService);

      const serviceInstance = new ParallelAutoAnalyzeService(
        koreApiService,
        sessionSamplingService,
        batchAnalysisService,
        openaiAnalysisService,
        botId,
        credentials
      );
      
      ParallelAutoAnalyzeService.instances.set(botId, serviceInstance);
      // Instance created and stored
    } else {
      // Using existing instance
    }
    
    return ParallelAutoAnalyzeService.instances.get(botId)!;
  }
}