// Quick debug script to test BackgroundJobQueue behavior with mock services
// Set up mock environment before requiring services
process.env.NODE_ENV = 'test';
process.env.USE_MOCK_SERVICES = 'mock';

const { getBackgroundJobQueue } = require('./dist/backend/src/services/backgroundJobQueue');
const { ServiceFactory } = require('./dist/backend/src/factories/serviceFactory');

console.log('Testing BackgroundJobQueue with parallel job...');

async function testBackgroundJob() {
  console.log('Step 1: Setting up mock services');
  ServiceFactory.useMockServices();
  console.log('ServiceFactory type:', ServiceFactory.getServiceType());
  
  console.log('Step 2: Getting background job queue instance');
  const jobQueue = getBackgroundJobQueue();
  
  console.log('Step 3: Creating test parallel job');
  const testJob = {
    id: 'test-analysis-parallel',
    analysisId: 'test-analysis',
    status: 'queued',
    phase: 'sampling',
    createdAt: new Date(),
    progress: {
      analysisId: 'test-analysis',
      phase: 'sampling',
      currentStep: 'Test job',
      sessionsFound: 0,
      sessionsProcessed: 0,
      totalSessions: 100,
      batchesCompleted: 0,
      totalBatches: 0,
      tokensUsed: 0,
      estimatedCost: 0,
      startTime: new Date().toISOString(),
      backgroundJobId: 'test-analysis-parallel',
      backgroundJobStatus: 'queued'
    },
    config: {
      startDate: '2024-01-01',
      startTime: '10:00',
      sessionCount: 100,
      openaiApiKey: 'test-key',
      modelId: 'gpt-4o-mini'
    },
    credentials: {
      botId: 'mock-bot-id',
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret'
    }
  };
  
  console.log('Step 4: Enqueueing job');
  await jobQueue.enqueue(testJob);
  
  console.log('Step 5: Waiting for job processing...');
  // Wait a bit to see if job gets processed
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('Step 6: Checking job status');
  const job = await jobQueue.getJob('test-analysis-parallel');
  console.log('Final job status:', job?.status);
  console.log('Final job progress:', job?.progress?.currentStep);
  
  console.log('Test completed');
  process.exit(0);
}

testBackgroundJob().catch(console.error);