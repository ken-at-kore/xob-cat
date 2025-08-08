// Quick debug script to test ParallelAutoAnalyzeService singleton
const { ParallelAutoAnalyzeService } = require('./dist/services/parallelAutoAnalyzeService');

console.log('Testing ParallelAutoAnalyzeService singleton pattern...');

// Create first instance
const service1 = ParallelAutoAnalyzeService.create('test-bot', 'jwt-token');
console.log('Instance 1 created');

// Try to get the same instance
const service2 = ParallelAutoAnalyzeService.getInstance('test-bot');
console.log('Instance 2 retrieved:', !!service2);

// Check if they're the same
console.log('Same instance?', service1 === service2);

// Create a mock session in first instance
service1.activeSessions.set('test-analysis-id', {
  id: 'test-analysis-id',
  config: { sessionCount: 10, startDate: '2024-01-01', startTime: '10:00', openaiApiKey: 'test' },
  progress: { analysisId: 'test-analysis-id', phase: 'sampling', currentStep: 'test' },
  cancelled: false
});

console.log('Session added to instance 1. Active sessions:', service1.activeSessions.size);

// Check if second instance sees the session
console.log('Instance 2 active sessions:', service2?.activeSessions?.size || 'No instance 2');

// Try third instance creation
const service3 = ParallelAutoAnalyzeService.create('test-bot', 'jwt-token-2');
console.log('Instance 3 same as 1?', service1 === service3);
console.log('Instance 3 active sessions:', service3.activeSessions.size);