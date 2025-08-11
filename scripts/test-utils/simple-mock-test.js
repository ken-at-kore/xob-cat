// Simple test to validate mock credentials work
const { ServiceFactory } = require('./backend/dist/backend/src/factories/serviceFactory');

async function testMockCredentials() {
  console.log('🧪 Testing mock credentials...');
  
  try {
    const mockConfig = {
      botId: 'st-mock-bot-id-12345',
      clientId: 'cs-mock-client-id-67890', 
      clientSecret: 'mock-client-secret-abcdef',
      baseUrl: 'https://bots.kore.ai'
    };
    
    const koreApiService = ServiceFactory.createKoreApiService(mockConfig);
    console.log('Service created:', koreApiService.constructor.name);
    
    // Test if service detects mock credentials
    console.log('Is mock credentials:', koreApiService.isMockCredentials());
    
    // Try to get some session data
    const sessions = await koreApiService.getSessionsMetadata({
      dateFrom: '2025-07-01T10:00:00.000Z',
      dateTo: '2025-07-01T13:00:00.000Z',
      limit: 5
    });
    
    console.log(`Found ${sessions.length} mock sessions`);
    
    if (sessions.length > 0) {
      console.log('First session:', JSON.stringify(sessions[0], null, 2));
    }
    
    console.log('✅ Mock credentials test passed');
    
  } catch (error) {
    console.error('❌ Mock credentials test failed:', error.message);
  }
}

testMockCredentials().catch(console.error);