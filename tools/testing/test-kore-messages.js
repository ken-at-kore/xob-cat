// Direct test of the Kore API service to check message retrieval
const { createKoreApiService } = require('./backend/dist/backend/src/services/koreApiService.js');
const { configManager } = require('./backend/dist/backend/src/utils/configManager.js');

async function testMessageRetrieval() {
  console.log('Starting message retrieval test...');
  
  try {
    // Initialize Kore API service
    const koreConfig = configManager.getKoreConfig();
    const config = {
      botId: koreConfig.bot_id,
      clientId: koreConfig.client_id,
      clientSecret: koreConfig.client_secret,
      baseUrl: koreConfig.base_url
    };
    
    console.log(`Using Kore.ai bot: ${koreConfig.name}`);
    const koreApiService = createKoreApiService(config);
    
    // Test date range with known data
    const dateFrom = '2025-07-07T04:00:00.000Z';
    const dateTo = '2025-07-09T03:59:59.999Z';
    
    console.log('1. Testing getSessions...');
    const sessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 5);
    console.log(`Retrieved ${sessions.length} sessions`);
    
    if (sessions.length > 0) {
      const firstSession = sessions[0];
      console.log(`First session ID: ${firstSession.session_id}`);
      console.log(`First session messages: ${firstSession.messages ? firstSession.messages.length : 'undefined'}`);
      
      // Test getMessages with specific session IDs
      console.log('\n2. Testing getMessages...');
      const sessionIds = sessions.slice(0, 3).map(s => s.session_id);
      console.log(`Getting messages for sessions: ${sessionIds.join(', ')}`);
      
      const messages = await koreApiService.getMessages(dateFrom, dateTo, sessionIds);
      console.log(`Retrieved ${messages.length} messages`);
      
      if (messages.length > 0) {
        console.log('\n=== SUCCESS! ===');
        console.log('Sample message:', messages[0]);
      } else {
        console.log('\n=== ISSUE: No messages retrieved ===');
        console.log('This suggests the getMessages API call is not working properly');
      }
    } else {
      console.log('No sessions found for the test date range');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testMessageRetrieval();