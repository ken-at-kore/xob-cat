/**
 * Test SessionSamplingService directly with real credentials
 * Credentials should be set in .env.local file:
 * TEST_BOT_ID=st-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * TEST_CLIENT_ID=cs-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * TEST_CLIENT_SECRET=your-client-secret-here
 */

const { ServiceFactory } = require('./backend/dist/backend/src/factories/serviceFactory');
const { SessionSamplingService } = require('./backend/dist/backend/src/services/sessionSamplingService');
const { SWTService } = require('./backend/dist/backend/src/services/swtService');

// Check for required environment variables
const requiredVars = ['TEST_BOT_ID', 'TEST_CLIENT_ID', 'TEST_CLIENT_SECRET'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please set these variables in your .env.local file and try again.');
  process.exit(1);
}

const credentials = {
  botId: process.env.TEST_BOT_ID,
  clientId: process.env.TEST_CLIENT_ID,
  clientSecret: process.env.TEST_CLIENT_SECRET
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