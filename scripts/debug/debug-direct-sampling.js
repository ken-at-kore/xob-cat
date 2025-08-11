/**
 * Test SessionSamplingService directly with real credentials
 */

const { ServiceFactory } = require('./backend/dist/backend/src/factories/serviceFactory');
const { SessionSamplingService } = require('./backend/dist/backend/src/services/sessionSamplingService');
const { SWTService } = require('./backend/dist/backend/src/services/swtService');

const credentials = {
  botId: 'st-90549a67-7f19-5074-afcf-3120db51a26d',
  clientId: 'cs-2a4298ea-947c-5a42-9846-670c660da0fd',
  clientSecret: 'CvRFRrwOOeUJLca4twBWJWdaf1TKaOa91UgTnLSCKDs='
};

async function testDirectSampling() {
  console.log('🔍 Testing SessionSamplingService directly with real credentials...');
  
  try {
    // Create services exactly like the backgroundJobQueue does
    const config = {
      botId: credentials.botId,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      baseUrl: 'https://bots.kore.ai'
    };
    
    console.log('Creating services...');
    const koreApiService = ServiceFactory.createKoreApiService(config);
    const swtService = new SWTService(koreApiService);
    const sessionSamplingService = new SessionSamplingService(swtService, koreApiService);
    
    console.log(`Service type: ${koreApiService.constructor.name}`);
    
    // Test the same configuration as the failing auto-analyze
    const analysisConfig = {
      startDate: '2025-08-01',
      startTime: '09:00', 
      sessionCount: 5,
      openaiApiKey: 'sk-test-key',
      modelId: 'gpt-4o-mini'
    };
    
    console.log('Calling sampleSessions...');
    const result = await sessionSamplingService.sampleSessions(
      analysisConfig,
      (currentStep, sessionsFound, windowIndex, windowLabel) => {
        console.log(`  Progress: ${currentStep} (${sessionsFound} sessions, window ${windowIndex}: ${windowLabel})`);
      }
    );
    
    console.log(`✅ Success! Found ${result.sessions.length} sessions`);
    console.log(`  Time windows used: ${result.timeWindows.length}`);
    console.log(`  Total found: ${result.totalFound}`);
    
  } catch (error) {
    console.error('❌ Error in direct sampling test:', error.message);
    console.error(error.stack);
  }
}

testDirectSampling().catch(console.error);