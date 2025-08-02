import { BackgroundJobQueue } from '../../services/backgroundJobQueue';
import { BackgroundJob, AnalysisConfig } from '../../../../shared/types';

describe('BackgroundJobQueue', () => {
  let jobQueue: BackgroundJobQueue;
  let mockSetTimeout: jest.SpyInstance;
  let mockClearTimeout: jest.SpyInstance;

  beforeEach(() => {
    jobQueue = new BackgroundJobQueue();
    mockSetTimeout = jest.spyOn(global, 'setTimeout');
    mockClearTimeout = jest.spyOn(global, 'clearTimeout');
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockSetTimeout.mockRestore();
    mockClearTimeout.mockRestore();
  });

  describe('enqueue', () => {
    it('should add job to queue with queued status', async () => {
      const job: BackgroundJob = {
        id: 'job-123',
        analysisId: 'analysis-123',
        status: 'queued',
        phase: 'sampling',
        createdAt: new Date(),
        progress: {
          analysisId: 'analysis-123',
          phase: 'sampling',
          currentStep: 'Starting session sampling',
          sessionsFound: 0,
          sessionsProcessed: 0,
          totalSessions: 0,
          batchesCompleted: 0,
          totalBatches: 0,
          tokensUsed: 0,
          estimatedCost: 0,
          startTime: new Date().toISOString()
        }
      };

      await jobQueue.enqueue(job);

      const retrievedJob = await jobQueue.getJob(job.id);
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.status).toBe('queued');
      expect(retrievedJob?.id).toBe(job.id);
    });

    it('should schedule job processing immediately in local environment', async () => {
      process.env.NODE_ENV = 'development';

      const job: BackgroundJob = {
        id: 'job-123',
        analysisId: 'analysis-123',
        status: 'queued',
        phase: 'sampling',
        createdAt: new Date(),
        progress: {
          analysisId: 'analysis-123',
          phase: 'sampling',
          currentStep: 'Starting session sampling',
          sessionsFound: 0,
          sessionsProcessed: 0,
          totalSessions: 0,
          batchesCompleted: 0,
          totalBatches: 0,
          tokensUsed: 0,
          estimatedCost: 0,
          startTime: new Date().toISOString()
        }
      };

      await jobQueue.enqueue(job);

      // Should schedule processing with setTimeout in local environment
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
    });
  });

  describe('getJob', () => {
    it('should return undefined for non-existent job', async () => {
      const job = await jobQueue.getJob('non-existent');
      expect(job).toBeUndefined();
    });

    it('should return job if it exists', async () => {
      const job: BackgroundJob = {
        id: 'job-123',
        analysisId: 'analysis-123',
        status: 'queued',
        phase: 'sampling',
        createdAt: new Date(),
        progress: {
          analysisId: 'analysis-123',
          phase: 'sampling',
          currentStep: 'Starting session sampling',
          sessionsFound: 0,
          sessionsProcessed: 0,
          totalSessions: 0,
          batchesCompleted: 0,
          totalBatches: 0,
          tokensUsed: 0,
          estimatedCost: 0,
          startTime: new Date().toISOString()
        }
      };

      await jobQueue.enqueue(job);
      const retrievedJob = await jobQueue.getJob(job.id);

      expect(retrievedJob).toEqual(job);
    });
  });

  describe('updateJob', () => {
    it('should update existing job', async () => {
      const job: BackgroundJob = {
        id: 'job-123',
        analysisId: 'analysis-123',
        status: 'queued',
        phase: 'sampling',
        createdAt: new Date(),
        progress: {
          analysisId: 'analysis-123',
          phase: 'sampling',
          currentStep: 'Starting session sampling',
          sessionsFound: 0,
          sessionsProcessed: 0,
          totalSessions: 0,
          batchesCompleted: 0,
          totalBatches: 0,
          tokensUsed: 0,
          estimatedCost: 0,
          startTime: new Date().toISOString()
        }
      };

      await jobQueue.enqueue(job);

      const updatedJob = {
        ...job,
        status: 'running' as const,
        startedAt: new Date(),
        progress: {
          ...job.progress,
          currentStep: 'Processing sessions',
          sessionsFound: 50
        }
      };

      await jobQueue.updateJob(job.id, updatedJob);
      const retrievedJob = await jobQueue.getJob(job.id);

      expect(retrievedJob?.status).toBe('running');
      expect(retrievedJob?.progress.sessionsFound).toBe(50);
    });

    it('should throw error when updating non-existent job', async () => {
      const job: BackgroundJob = {
        id: 'non-existent',
        analysisId: 'analysis-123',
        status: 'running',
        phase: 'sampling',
        createdAt: new Date(),
        progress: {
          analysisId: 'analysis-123',
          phase: 'sampling',
          currentStep: 'Processing',
          sessionsFound: 0,
          sessionsProcessed: 0,
          totalSessions: 0,
          batchesCompleted: 0,
          totalBatches: 0,
          tokensUsed: 0,
          estimatedCost: 0,
          startTime: new Date().toISOString()
        }
      };

      await expect(jobQueue.updateJob('non-existent', job)).rejects.toThrow('Job not found');
    });
  });

  describe('cancelJob', () => {
    it('should cancel queued job', async () => {
      const job: BackgroundJob = {
        id: 'job-123',
        analysisId: 'analysis-123',
        status: 'queued',
        phase: 'sampling',
        createdAt: new Date(),
        progress: {
          analysisId: 'analysis-123',
          phase: 'sampling',
          currentStep: 'Starting session sampling',
          sessionsFound: 0,
          sessionsProcessed: 0,
          totalSessions: 0,
          batchesCompleted: 0,
          totalBatches: 0,
          tokensUsed: 0,
          estimatedCost: 0,
          startTime: new Date().toISOString()
        }
      };

      await jobQueue.enqueue(job);
      const cancelled = await jobQueue.cancelJob(job.id);

      expect(cancelled).toBe(true);
      
      const retrievedJob = await jobQueue.getJob(job.id);
      expect(retrievedJob?.status).toBe('failed');
      expect(retrievedJob?.error).toContain('cancelled');
    });

    it('should not cancel completed job', async () => {
      const job: BackgroundJob = {
        id: 'job-123',
        analysisId: 'analysis-123',
        status: 'completed',
        phase: 'analyzing',
        createdAt: new Date(),
        completedAt: new Date(),
        progress: {
          analysisId: 'analysis-123',
          phase: 'complete',
          currentStep: 'Analysis complete',
          sessionsFound: 100,
          sessionsProcessed: 100,
          totalSessions: 100,
          batchesCompleted: 5,
          totalBatches: 5,
          tokensUsed: 15000,
          estimatedCost: 0.45,
          startTime: new Date().toISOString()
        }
      };

      await jobQueue.enqueue(job);
      await jobQueue.updateJob(job.id, job);
      
      const cancelled = await jobQueue.cancelJob(job.id);

      expect(cancelled).toBe(false);
      
      const retrievedJob = await jobQueue.getJob(job.id);
      expect(retrievedJob?.status).toBe('completed');
    });
  });

  describe('timeout handling', () => {
    it('should fail job after timeout period', async () => {
      jest.useFakeTimers();

      const job: BackgroundJob = {
        id: 'job-123',
        analysisId: 'analysis-123',
        status: 'queued',
        phase: 'sampling',
        createdAt: new Date(),
        progress: {
          analysisId: 'analysis-123',
          phase: 'sampling',
          currentStep: 'Starting session sampling',
          sessionsFound: 0,
          sessionsProcessed: 0,
          totalSessions: 0,
          batchesCompleted: 0,
          totalBatches: 0,
          tokensUsed: 0,
          estimatedCost: 0,
          startTime: new Date().toISOString()
        }
      };

      await jobQueue.enqueue(job);

      // Fast-forward time to trigger timeout (10 minutes = 600,000ms)
      jest.advanceTimersByTime(600000);

      const retrievedJob = await jobQueue.getJob(job.id);
      expect(retrievedJob?.status).toBe('failed');
      expect(retrievedJob?.error).toContain('timed out');

      jest.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('should remove expired jobs after 1 hour', async () => {
      jest.useFakeTimers();

      const job: BackgroundJob = {
        id: 'job-123',
        analysisId: 'analysis-123',
        status: 'completed',
        phase: 'analyzing',
        createdAt: new Date(),
        completedAt: new Date(),
        progress: {
          analysisId: 'analysis-123',
          phase: 'complete',
          currentStep: 'Analysis complete',
          sessionsFound: 100,
          sessionsProcessed: 100,
          totalSessions: 100,
          batchesCompleted: 5,
          totalBatches: 5,
          tokensUsed: 15000,
          estimatedCost: 0.45,
          startTime: new Date().toISOString()
        }
      };

      await jobQueue.enqueue(job);
      
      // Mark job as completed to make it eligible for cleanup
      job.status = 'completed';
      job.completedAt = new Date(Date.now() - 3660000); // 1 hour + 1 minute ago
      await jobQueue.updateJob(job.id, job);
      
      // Fast-forward time by 1 hour + 1 minute to trigger cleanup
      jest.advanceTimersByTime(3660000);

      const retrievedJob = await jobQueue.getJob(job.id);
      expect(retrievedJob).toBeUndefined();

      jest.useRealTimers();
    });
  });
});