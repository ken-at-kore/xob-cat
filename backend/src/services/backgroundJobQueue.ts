import { BackgroundJob, BackgroundJobResult, AnalysisConfig, SessionWithTranscript } from '../../../shared/types';
import { SessionSamplingService } from './sessionSamplingService';
import { BatchAnalysisService } from './batchAnalysisService';
import { OpenAIAnalysisService } from './openaiAnalysisService';
import { AutoAnalyzeService } from './autoAnalyzeService';
import { KoreApiService } from './koreApiService';
import { SWTService } from './swtService';
import { ServiceFactory } from '../factories/serviceFactory';

/**
 * Background Job Queue for handling async auto-analysis processing
 * Works both locally (in-memory with setTimeout) and in AWS Lambda (event-driven)
 */
export class BackgroundJobQueue {
  private jobs: Map<string, BackgroundJob> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    // Start cleanup timer for expired jobs
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredJobs();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Add a job to the queue and schedule processing
   */
  async enqueue(job: BackgroundJob): Promise<void> {
    this.jobs.set(job.id, job);
    
    // Schedule processing based on environment
    if (process.env.NODE_ENV === 'production' && process.env.AWS_LAMBDA_FUNCTION_NAME) {
      // In AWS Lambda, trigger async processing via event
      await this.scheduleAwsLambdaProcessing(job);
    } else {
      // In local development, use setTimeout for async processing
      await this.scheduleLocalProcessing(job);
    }

    // Set timeout for job failure
    this.setJobTimeout(job.id);
  }

  /**
   * Get a job by ID
   */
  async getJob(id: string): Promise<BackgroundJob | undefined> {
    return this.jobs.get(id);
  }

  /**
   * Update an existing job
   */
  async updateJob(id: string, job: BackgroundJob): Promise<void> {
    if (!this.jobs.has(id)) {
      throw new Error('Job not found');
    }
    
    job.progress.lastUpdated = new Date().toISOString();
    this.jobs.set(id, job);
  }

  /**
   * Cancel a job
   */
  async cancelJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) {
      return false;
    }

    if (job.status === 'completed') {
      return false; // Cannot cancel completed job
    }

    // Clear any timers
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    // Mark job as failed with cancellation message
    job.status = 'failed';
    job.error = 'Job cancelled by user';
    job.completedAt = new Date();
    job.progress.phase = 'error';
    job.progress.error = 'Analysis cancelled by user';
    job.progress.lastUpdated = new Date().toISOString();

    await this.updateJob(id, job);
    return true;
  }

  /**
   * Schedule job processing in AWS Lambda environment
   */
  private async scheduleAwsLambdaProcessing(job: BackgroundJob): Promise<void> {
    // In production, this would invoke a separate Lambda function
    // For now, we'll fall back to local processing
    console.log(`[BackgroundJobQueue] AWS Lambda processing not implemented, falling back to local processing for job ${job.id}`);
    await this.scheduleLocalProcessing(job);
  }

  /**
   * Schedule job processing in local development environment
   */
  private async scheduleLocalProcessing(job: BackgroundJob): Promise<void> {
    const timer = setTimeout(async () => {
      try {
        console.log(`[BackgroundJobQueue] Starting job processing after delay for job ${job.id}`);
        await this.processJob(job.id);
      } catch (error) {
        console.error(`[BackgroundJobQueue] Error processing job ${job.id}:`, error);
        await this.markJobAsFailed(job.id, error instanceof Error ? error.message : 'Unknown error');
      }
    }, 1000); // Increased delay to ensure services are ready

    this.timers.set(job.id, timer);
  }

  /**
   * Process a background job
   */
  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'queued') {
      console.log(`[BackgroundJobQueue] Job ${jobId} not found or not queued (status: ${job?.status})`);
      return;
    }

    console.log(`[BackgroundJobQueue] Starting processing for job ${jobId}, phase: ${job.phase}`);
    console.log(`[BackgroundJobQueue] Job credentials available: ${!!job.credentials}`);

    // Mark job as running
    job.status = 'running';
    job.startedAt = new Date();
    job.progress.backgroundJobStatus = 'running';
    await this.updateJob(jobId, job);

    try {
      if (job.phase === 'sampling') {
        await this.processSamplingPhase(job);
      } else if (job.phase === 'analyzing') {
        await this.processAnalyzingPhase(job);
      }
    } catch (error) {
      console.error(`[BackgroundJobQueue] Job ${jobId} failed:`, error);
      await this.markJobAsFailed(jobId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Process the session sampling phase
   */
  private async processSamplingPhase(job: BackgroundJob): Promise<void> {
    if (!job.config) {
      throw new Error('Job configuration missing');
    }

    console.log(`[BackgroundJobQueue] Processing sampling phase for job ${job.id}`);

    console.log(`[BackgroundJobQueue] Processing sampling phase for bot: ${job.credentials?.botId || 'mock-bot'}`);
    
    // Create service using EXACT same pattern as working direct API routes
    let koreApiService;
    if (job.credentials) {
      // CRITICAL: Use the same configuration format as the middleware/direct API
      const config = {
        botId: job.credentials.botId,
        clientId: job.credentials.clientId,
        clientSecret: job.credentials.clientSecret,
        baseUrl: 'https://bots.kore.ai'
      };
      
      console.log(`[BackgroundJobQueue] Creating real service for bot: ${config.botId}`);
      console.log(`[BackgroundJobQueue] Full config:`, JSON.stringify(config, null, 2));
      koreApiService = ServiceFactory.createKoreApiService(config);
      console.log(`[BackgroundJobQueue] Created service type: ${koreApiService.constructor.name}`);
    } else {
      console.log(`[BackgroundJobQueue] Using mock service (no credentials)`);
      koreApiService = ServiceFactory.createKoreApiService();
    }
    const swtService = new SWTService(koreApiService);
    const sessionSamplingService = new SessionSamplingService(swtService, koreApiService);

    // Update progress
    job.progress.phase = 'sampling';
    job.progress.currentStep = 'Finding sessions in time window';
    await this.updateJob(job.id, job);

    // Find sessions for analysis
    let samplingResult;
    try {
      samplingResult = await sessionSamplingService.sampleSessions(
        job.config,
        (currentStep: string, sessionsFound: number, windowIndex: number, windowLabel: string) => {
          job.progress.currentStep = currentStep;
          job.progress.sessionsFound = sessionsFound;
          this.updateJob(job.id, job);
        }
      );
    } catch (error) {
      console.error(`[BackgroundJobQueue] Session sampling failed for job ${job.id}:`, error);
      throw error; // Re-throw to be caught by processJob
    }
    
    if (!samplingResult || !samplingResult.sessions) {
      throw new Error('Session sampling returned invalid result');
    }
    
    const sessions = samplingResult.sessions;

    console.log(`[BackgroundJobQueue] Found ${sessions.length} sessions for job ${job.id}`);

    // Update progress with session count
    job.progress.sessionsFound = sessions.length;
    job.progress.totalSessions = sessions.length;
    job.progress.currentStep = `Found ${sessions.length} sessions, starting AI analysis`;
    await this.updateJob(job.id, job);

    // Store session data for next phase
    job.sessionData = sessions;

    // Create and enqueue analysis job
    const analysisJob: BackgroundJob = {
      id: `${job.id}-analysis`,
      analysisId: job.analysisId,
      status: 'queued',
      phase: 'analyzing',
      createdAt: new Date(),
      progress: {
        ...job.progress,
        phase: 'analyzing',
        currentStep: 'Starting AI analysis of sessions',
        batchesCompleted: 0,
        totalBatches: Math.ceil(sessions.length / 5), // 5 sessions per batch
      },
      config: job.config,
      sessionData: sessions,
      ...(job.credentials ? { credentials: job.credentials } : {}) // Pass credentials to analysis phase
    };

    // Mark sampling job as completed
    job.status = 'completed';
    job.completedAt = new Date();
    job.progress.backgroundJobStatus = 'completed';
    await this.updateJob(job.id, job);

    // Enqueue analysis job
    await this.enqueue(analysisJob);
  }

  /**
   * Process the AI analysis phase
   */
  private async processAnalyzingPhase(job: BackgroundJob): Promise<void> {
    if (!job.config || !job.sessionData) {
      throw new Error('Job configuration or session data missing');
    }

    console.log(`[BackgroundJobQueue] Processing analysis phase for job ${job.id} with ${job.sessionData.length} sessions`);

    // Create batch analysis service
    const openaiAnalysisService = ServiceFactory.createOpenAIService();
    const batchAnalysisService = new BatchAnalysisService(openaiAnalysisService);

    // Update progress
    job.progress.phase = 'analyzing';
    job.progress.currentStep = 'Analyzing sessions with AI';
    await this.updateJob(job.id, job);

    // Process sessions in batches
    const allResults: any[] = [];
    const batchSize = 5;
    let totalTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0, model: job.config.modelId || 'gpt-4o-mini' };
    let existingClassifications = { generalIntent: new Set<string>(), transferReason: new Set<string>(), dropOffLocation: new Set<string>() };
    
    const totalBatches = Math.ceil(job.sessionData.length / batchSize);
    
    for (let i = 0; i < job.sessionData.length; i += batchSize) {
      const batch = job.sessionData.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      job.progress.currentStep = `Processing batch ${batchNumber} of ${totalBatches}`;
      job.progress.batchesCompleted = batchNumber - 1;
      job.progress.totalBatches = totalBatches;
      await this.updateJob(job.id, job);
      
      try {
        const batchResult = await batchAnalysisService.processSessionsBatch(
          batch,
          existingClassifications,
          job.config.openaiApiKey,
          job.config.modelId || 'gpt-4o-mini'
        );
        
        allResults.push(...batchResult.results);
        existingClassifications = batchResult.updatedClassifications;
        totalTokenUsage.promptTokens += batchResult.tokenUsage.promptTokens;
        totalTokenUsage.completionTokens += batchResult.tokenUsage.completionTokens;
        totalTokenUsage.totalTokens += batchResult.tokenUsage.totalTokens;
        totalTokenUsage.cost += batchResult.tokenUsage.cost;
        
        job.progress.sessionsProcessed = allResults.length;
        job.progress.tokensUsed = totalTokenUsage.totalTokens;
        job.progress.estimatedCost = totalTokenUsage.cost;
        await this.updateJob(job.id, job);
        
        // Rate limiting between batches
        if (i + batchSize < job.sessionData.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Batch ${batchNumber} failed:`, error);
        // Continue with next batch
      }
    }
    
    console.log(`[BackgroundJobQueue] Session analysis completed for job ${job.id}, processed ${allResults.length} sessions`);

    // Phase 3: Generate Analysis Summary
    job.progress.phase = 'generating_summary';
    job.progress.currentStep = 'Generating analysis summary...';
    await this.updateJob(job.id, job);

    let analysisSummary = undefined;
    try {
      const { AnalysisSummaryService } = await import('./analysisSummaryService');
      const analysisSummaryService = new AnalysisSummaryService(job.config.openaiApiKey);
      analysisSummary = await analysisSummaryService.generateAnalysisSummary(allResults);

      // Update token usage to include summary generation
      totalTokenUsage.totalTokens += 1000; // Approximate tokens for summary generation
      totalTokenUsage.cost += 0.002; // Approximate cost for summary generation
      
      console.log(`[BackgroundJobQueue] Analysis summary generated for job ${job.id}`);
    } catch (error) {
      console.error(`[BackgroundJobQueue] Failed to generate analysis summary for job ${job.id}:`, error);
      // Continue without summary - non-critical feature
    }

    const results = { sessions: allResults, analysisSummary };

    console.log(`[BackgroundJobQueue] Analysis completed for job ${job.id}, processed ${allResults.length} sessions`);

    // Mark job as completed
    job.status = 'completed';
    job.completedAt = new Date();
    job.progress.phase = 'complete';
    job.progress.currentStep = 'Analysis complete';
    job.progress.sessionsProcessed = allResults.length;
    job.progress.backgroundJobStatus = 'completed';
    job.progress.endTime = new Date().toISOString();

    // Store results in the job for retrieval
    job.sessionData = allResults;
    
    await this.updateJob(job.id, job);

    // Store results in the AutoAnalyzeService
    try {
      const { AutoAnalyzeService } = await import('./autoAnalyzeService');
      // Get the service instance for this bot
      const serviceInstance = AutoAnalyzeService.getInstance(job.credentials?.botId || 'default-bot');
      
      if (serviceInstance) {
        // Store the results in the AutoAnalyzeService
        await serviceInstance.storeResults(job.analysisId, {
          sessions: allResults,
          analysisSummary,
          ...(job.credentials?.botId ? { botId: job.credentials.botId } : {})
        });
        console.log(`[BackgroundJobQueue] Results successfully stored in AutoAnalyzeService for analysis ${job.analysisId}`);
      } else {
        console.warn(`[BackgroundJobQueue] AutoAnalyzeService instance not found for bot ${job.credentials?.botId}, results stored in job only`);
      }
    } catch (error) {
      console.error(`[BackgroundJobQueue] Failed to store results in AutoAnalyzeService:`, error);
      // Continue - results are still available in the job
    }
    
    console.log(`[BackgroundJobQueue] Analysis ${job.analysisId} completed with ${allResults.length} sessions`)
  }

  /**
   * Mark a job as failed
   */
  private async markJobAsFailed(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();
    job.progress.phase = 'error';
    job.progress.error = error;
    job.progress.backgroundJobStatus = 'failed';
    job.progress.lastUpdated = new Date().toISOString();
    job.progress.endTime = new Date().toISOString();

    await this.updateJob(jobId, job);
    
    // Notify AutoAnalyzeService about the failure
    try {
      const { AutoAnalyzeService } = await import('./autoAnalyzeService');
      // Find the analysis service instance that might be tracking this job
      // This is a workaround for the current architecture - in a real system this would use events
      console.log(`[BackgroundJobQueue] Job ${jobId} failed, analysis ${job.analysisId} should be updated`);
    } catch (err) {
      console.error(`[BackgroundJobQueue] Failed to notify AutoAnalyzeService about job failure:`, err);
    }

    // Clear any timers
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
  }

  /**
   * Set timeout for job failure
   */
  private setJobTimeout(jobId: string): void {
    const timeoutTimer = setTimeout(async () => {
      const job = this.jobs.get(jobId);
      if (job && job.status !== 'completed' && job.status !== 'failed') {
        console.log(`[BackgroundJobQueue] Job ${jobId} timed out after ${this.TIMEOUT_MS}ms`);
        await this.markJobAsFailed(jobId, `Job timed out after ${this.TIMEOUT_MS / 1000} seconds`);
      }
    }, this.TIMEOUT_MS);

    // Store timeout timer separately from processing timer
    this.timers.set(`${jobId}-timeout`, timeoutTimer);
  }

  /**
   * Clean up expired jobs (completed/failed jobs older than 1 hour)
   */
  private cleanupExpiredJobs(): void {
    const now = new Date();
    const expiredJobs: string[] = [];

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        const completedAt = job.completedAt || job.createdAt;
        const ageMs = now.getTime() - completedAt.getTime();
        
        if (ageMs > this.CLEANUP_INTERVAL_MS) {
          expiredJobs.push(jobId);
        }
      }
    }

    // Remove expired jobs
    for (const jobId of expiredJobs) {
      this.jobs.delete(jobId);
      
      // Clear any associated timers
      const timer = this.timers.get(jobId);
      const timeoutTimer = this.timers.get(`${jobId}-timeout`);
      
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(jobId);
      }
      
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        this.timers.delete(`${jobId}-timeout`);
      }
    }

    if (expiredJobs.length > 0) {
      console.log(`[BackgroundJobQueue] Cleaned up ${expiredJobs.length} expired jobs`);
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

// Singleton instance for the background job queue
let backgroundJobQueueInstance: BackgroundJobQueue | null = null;

export function getBackgroundJobQueue(): BackgroundJobQueue {
  if (!backgroundJobQueueInstance) {
    backgroundJobQueueInstance = new BackgroundJobQueue();
  }
  return backgroundJobQueueInstance;
}