// Simple test to verify parallel analysis works end-to-end
process.env.NODE_ENV = 'test';
process.env.USE_MOCK_SERVICES = 'mock';

const request = require('supertest');
const express = require('express');
const { parallelAutoAnalyzeRouter } = require('./dist/backend/src/routes/parallelAutoAnalyze');
const { ServiceFactory } = require('./dist/backend/src/factories/serviceFactory');
const { destroyBackgroundJobQueue } = require('./dist/backend/src/services/backgroundJobQueue');

async function testParallelAnalysis() {
  console.log('🧪 Setting up mock services...');
  ServiceFactory.useMockServices();
  
  // Create test app
  const app = express();
  app.use(express.json());
  
  // Set up mock credentials  
  app.use((req, res, next) => {
    req.headers['x-bot-id'] = 'mock-bot-id';
    req.headers['x-client-id'] = 'mock-client-id';
    req.headers['x-client-secret'] = 'mock-client-secret';
    req.headers['x-jwt-token'] = 'test-jwt-token';
    next();
  });
  
  app.use('/api/analysis/parallel-auto-analyze', parallelAutoAnalyzeRouter);
  
  console.log('🚀 Starting parallel analysis...');
  
  // Start analysis
  const startResponse = await request(app)
    .post('/api/analysis/parallel-auto-analyze/start')
    .send({
      startDate: '2025-08-02', // Match mock data
      startTime: '12:00',
      sessionCount: 5, // Small count for testing
      openaiApiKey: 'sk-test-openai-key-12345',
      modelId: 'gpt-4.1-nano'
    });
    
  console.log('Start response:', startResponse.body);
  
  if (!startResponse.body.success) {
    console.error('❌ Failed to start analysis:', startResponse.body);
    return;
  }
  
  const analysisId = startResponse.body.data.analysisId;
  console.log(`📊 Analysis started: ${analysisId}`);
  
  // Poll for completion (simplified)
  console.log('🔄 Polling for completion...');
  let attempts = 0;
  let completed = false;
  
  while (attempts < 20 && !completed) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    attempts++;
    
    const progressResponse = await request(app)
      .get(`/api/analysis/parallel-auto-analyze/progress/${analysisId}`);
      
    console.log(`Attempt ${attempts}: ${progressResponse.body?.data?.phase} - ${progressResponse.body?.data?.currentStep}`);
    
    if (progressResponse.body?.data?.phase === 'complete') {
      completed = true;
      console.log('✅ Analysis completed!');
      
      // Get results
      const resultsResponse = await request(app)
        .get(`/api/analysis/parallel-auto-analyze/results/${analysisId}`);
        
      console.log('Results:', {
        sessionCount: resultsResponse.body?.data?.sessions?.length || 0,
        hasSummary: !!resultsResponse.body?.data?.analysisSummary
      });
    } else if (progressResponse.body?.data?.phase === 'error') {
      console.error('❌ Analysis failed:', progressResponse.body?.data?.error);
      break;
    }
  }
  
  if (!completed) {
    console.log('⏰ Test timed out after 20 attempts');
  }
  
  // Cleanup
  destroyBackgroundJobQueue();
  console.log('🧹 Cleanup completed');
}

testParallelAnalysis().catch(console.error);