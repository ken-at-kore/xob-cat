import { v4 as uuidv4 } from 'uuid';
import { SessionSamplingService } from './sessionSamplingService';
import { BatchAnalysisService } from './batchAnalysisService';
import { OpenAIAnalysisService } from './openaiAnalysisService';
import { KoreApiService } from './koreApiService';
import { SWTService } from './swtService';
import { AnalysisSummaryService } from './analysisSummaryService';
import { getBackgroundJobQueue } from './backgroundJobQueue';
import { ServiceFactory } from '../factories/serviceFactory';
import { IKoreApiService, IOpenAIService } from '../interfaces';
import { 
  AnalysisConfig, 
  AnalysisProgress, 
  SessionWithFacts, 
  ExistingClassifications,
  BatchTokenUsage,
  AnalysisSummary,
  AnalysisResults,
  BackgroundJob,
  AutoAnalysisStartResponse
} from '../../../shared/types';

interface AnalysisSession {
  id: string;
  config: AnalysisConfig;
  progress: AnalysisProgress;
  results?: SessionWithFacts[];
  analysisSummary?: AnalysisSummary;
  cancelled: boolean;
}

export class AutoAnalyzeService {
  private readonly BATCH_SIZE = 5;
  private readonly POLLING_INTERVAL = 2000; // 2 seconds between batches
  
  private activeSessions = new Map<string, AnalysisSession>();

  constructor(
    private koreApiService: IKoreApiService,
    private sessionSamplingService: SessionSamplingService,
    private batchAnalysisService: BatchAnalysisService,
    private openaiAnalysisService: IOpenAIService,
    private botId: string,
    private credentials?: { clientId: string; clientSecret: string }
  ) {}

  async startAnalysis(config: AnalysisConfig): Promise<AutoAnalysisStartResponse> {
    const analysisId = uuidv4();
    const backgroundJobId = `${analysisId}-sampling`;
    
    console.log(`🚀 [AutoAnalyzeService] Starting analysis ${analysisId} with bot ${this.botId}`);
    console.log(`🚀 [AutoAnalyzeService] Using credentials: ${this.credentials ? 'real' : 'mock'}`);
    
    const analysisSession: AnalysisSession = {
      id: analysisId,
      config,
      progress: {
        analysisId,
        phase: 'sampling',
        currentStep: 'Initializing analysis...',
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
        backgroundJobStatus: 'queued'
      },
      cancelled: false
    };

    this.activeSessions.set(analysisId, analysisSession);

    // Create background job for session sampling
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
      message: 'Analysis started in background'
    };
  }

  async getProgress(analysisId: string): Promise<AnalysisProgress> {
    const session = this.activeSessions.get(analysisId);
    if (!session) {
      throw new Error('Analysis not found');
    }
    
    // Update progress from background job if available
    const jobQueue = getBackgroundJobQueue();
    if (session.progress.backgroundJobId) {
      const backgroundJob = await jobQueue.getJob(session.progress.backgroundJobId);
      if (backgroundJob) {
        // Merge background job progress with session progress
        session.progress = {
          ...session.progress,
          ...backgroundJob.progress,
          backgroundJobStatus: backgroundJob.status
        };
        
        // If the background job failed, update the session progress accordingly
        if (backgroundJob.status === 'failed') {
          session.progress.phase = 'error';
          session.progress.error = backgroundJob.error || 'Background job failed';
          session.progress.endTime = new Date().toISOString();
        }
        
        // Check for analysis job as well
        const analysisJobId = `${session.progress.backgroundJobId}-analysis`;
        const analysisJob = await jobQueue.getJob(analysisJobId);
        if (analysisJob) {
          session.progress = {
            ...session.progress,
            ...analysisJob.progress,
            backgroundJobStatus: analysisJob.status
          };
          
          // If the analysis job failed, update the session progress accordingly
          if (analysisJob.status === 'failed') {
            session.progress.phase = 'error';
            session.progress.error = analysisJob.error || 'Analysis job failed';
            session.progress.endTime = new Date().toISOString();
          }
        }
      } else {
        // Background job not found - it might have been cleaned up or never started
        // Check if enough time has passed to consider it orphaned
        const startTime = new Date(session.progress.startTime).getTime();
        const now = new Date().getTime();
        const elapsedMinutes = (now - startTime) / (1000 * 60);
        
        if (elapsedMinutes > 15) { // Consider orphaned after 15 minutes
          session.progress.phase = 'error';
          session.progress.error = 'Analysis appears to have been orphaned or timed out';
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
      return false; // Already complete
    }

    session.cancelled = true;
    this.updateProgress(analysisId, {
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
    
    // Update progress to complete
    this.updateProgress(analysisId, {
      phase: 'complete',
      currentStep: 'Analysis complete',
      endTime: new Date().toISOString()
    });
  }

  private async runAnalysis(analysisId: string): Promise<void> {
    const session = this.activeSessions.get(analysisId);
    if (!session) return;

    try {
      // Phase 1: Sample sessions
      this.updateProgress(analysisId, {
        currentStep: 'Initializing session search...',
        phase: 'sampling'
      });

      const samplingResult = await this.sessionSamplingService.sampleSessions(
        session.config, 
        (currentStep: string, sessionsFound: number, windowIndex: number, windowLabel: string) => {
          this.updateProgress(analysisId, {
            currentStep,
            sessionsFound,
            samplingProgress: {
              currentWindowIndex: windowIndex,
              totalWindows: 4, // We have 4 expansion strategy windows
              currentWindowLabel: windowLabel,
              targetSessionCount: session.config.sessionCount
            }
          });
        }
      );
      
      if (session.cancelled) return;

      const calculatedTotalBatches = Math.ceil(samplingResult.sessions.length / this.BATCH_SIZE);
      
      this.updateProgress(analysisId, {
        currentStep: `Found ${samplingResult.sessions.length} sessions`,
        sessionsFound: samplingResult.sessions.length,
        totalSessions: samplingResult.sessions.length,
        totalBatches: calculatedTotalBatches
      });

      // Phase 2: Analyze sessions in batches
      this.updateProgress(analysisId, {
        phase: 'analyzing',
        currentStep: 'Starting session analysis...'
        // totalBatches already set above
      });

      const allResults: SessionWithFacts[] = [];
      let existingClassifications: ExistingClassifications = {
        generalIntent: new Set(),
        transferReason: new Set(),
        dropOffLocation: new Set()
      };

      let totalTokenUsage: BatchTokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        model: session.config.modelId
      };

      // Process sessions in batches
      for (let i = 0; i < samplingResult.sessions.length; i += this.BATCH_SIZE) {
        if (session.cancelled) return;

        const batch = samplingResult.sessions.slice(i, i + this.BATCH_SIZE);
        const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;

        this.updateProgress(analysisId, {
          currentStep: `Processing batch ${batchNumber} of ${Math.ceil(samplingResult.sessions.length / this.BATCH_SIZE)} (${batch.length} sessions)`
        });

        try {
          const batchResult = await this.batchAnalysisService.processSessionsBatch(
            batch,
            existingClassifications,
            session.config.openaiApiKey,
            session.config.modelId
          );

          allResults.push(...batchResult.results);
          existingClassifications = batchResult.updatedClassifications;
          totalTokenUsage = this.accumulateTokenUsage(totalTokenUsage, batchResult.tokenUsage);

          this.updateProgress(analysisId, {
            sessionsProcessed: allResults.length,
            batchesCompleted: batchNumber,
            tokensUsed: totalTokenUsage.totalTokens,
            estimatedCost: totalTokenUsage.cost,
            eta: this.calculateETA(
              batchNumber,
              Math.ceil(samplingResult.sessions.length / this.BATCH_SIZE),
              Date.now() - new Date(session.progress.startTime).getTime()
            )
          });

          // Rate limiting between batches
          if (i + this.BATCH_SIZE < samplingResult.sessions.length) {
            await this.sleep(this.POLLING_INTERVAL);
          }

        } catch (error) {
          console.error(`Batch ${batchNumber} failed:`, error);
          // Continue with next batch - the batch service handles individual failures
        }
      }

      if (session.cancelled) return;

      // Phase 3: Generate Analysis Summary
      this.updateProgress(analysisId, {
        phase: 'generating_summary',
        currentStep: 'Generating analysis summary...'
      });

      try {
        const analysisSummaryService = new AnalysisSummaryService(session.config.openaiApiKey);
        const analysisSummary = await analysisSummaryService.generateAnalysisSummary(allResults);
        session.analysisSummary = analysisSummary;

        // Update token usage to include summary generation
        totalTokenUsage.totalTokens += 1000; // Approximate tokens for summary generation
        totalTokenUsage.cost += 0.002; // Approximate cost for summary generation
      } catch (error) {
        console.error('Failed to generate analysis summary:', error);
        // Continue without summary - non-critical feature
      }

      if (session.cancelled) return;

      // Phase 4: Complete
      session.results = allResults;
      this.updateProgress(analysisId, {
        phase: 'complete',
        currentStep: 'Analysis complete',
        sessionsProcessed: allResults.length,
        tokensUsed: totalTokenUsage.totalTokens,
        estimatedCost: totalTokenUsage.cost,
        endTime: new Date().toISOString()
      });

      // Clean up after some time (could be moved to a separate cleanup service)
      setTimeout(() => {
        this.activeSessions.delete(analysisId);
      }, 3600000); // 1 hour

    } catch (error) {
      console.error(`Analysis ${analysisId} failed:`, error);
      this.updateProgress(analysisId, {
        phase: 'error',
        currentStep: 'Analysis failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: new Date().toISOString()
      });
    }
  }

  private updateProgress(analysisId: string, updates: Partial<AnalysisProgress>): void {
    const session = this.activeSessions.get(analysisId);
    if (!session) return;

    session.progress = { ...session.progress, ...updates };
  }

  private calculateETA(
    completedBatches: number, 
    totalBatches: number, 
    elapsedMs: number
  ): number {
    if (completedBatches === 0) return 0;
    
    const avgBatchTime = elapsedMs / completedBatches;
    const remainingBatches = totalBatches - completedBatches;
    
    return Math.round((remainingBatches * avgBatchTime) / 1000); // seconds
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

  // Singleton pattern modified to handle multiple bot IDs correctly
  private static instances = new Map<string, AutoAnalyzeService>();
  
  static getInstance(botId: string): AutoAnalyzeService | undefined {
    return AutoAnalyzeService.instances.get(botId);
  }
  
  static create(
    botId: string, 
    jwtToken: string, 
    credentials?: { clientId: string; clientSecret: string }
  ): AutoAnalyzeService {
    // Use botId as the key to support multiple bots
    if (!AutoAnalyzeService.instances.has(botId)) {
      console.log(`🚀 AutoAnalyzeService: Creating services for bot ${botId}`);
      
      const koreApiConfig = {
        botId,
        clientId: credentials?.clientId || 'mock-client-id',
        clientSecret: credentials?.clientSecret || 'mock-client-secret',
        baseUrl: 'https://bots.kore.ai'
      };
      
      // Use ServiceFactory to create services (respects mock/real configuration)
      const koreApiService = ServiceFactory.createKoreApiService(koreApiConfig);
      const openaiAnalysisService = ServiceFactory.createOpenAIService();
      
      // These services depend on the Kore API service
      const swtService = new SWTService(koreApiService);
      const sessionSamplingService = new SessionSamplingService(swtService, koreApiService);
      const batchAnalysisService = new BatchAnalysisService(openaiAnalysisService);

      const serviceInstance = new AutoAnalyzeService(
        koreApiService,
        sessionSamplingService,
        batchAnalysisService,
        openaiAnalysisService,
        botId,
        credentials
      );
      
      AutoAnalyzeService.instances.set(botId, serviceInstance);
    }
    
    return AutoAnalyzeService.instances.get(botId)!;
  }
}