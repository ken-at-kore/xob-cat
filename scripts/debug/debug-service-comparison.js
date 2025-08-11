/**
 * Debug service comparison by calling the debug endpoint
 * Credentials should be set in .env.local file:
 * TEST_BOT_ID=st-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * TEST_CLIENT_ID=cs-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * TEST_CLIENT_SECRET=your-client-secret-here
 */

const axios = require('axios');

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

async function testServiceComparison() {
  console.log('🔍 Testing service comparison between session viewer and auto-analyze...');
  
  try {
    const response = await axios.get('http://localhost:3001/api/analysis/debug/service-comparison', {
      headers: {
        'x-bot-id': credentials.botId,
        'x-client-id': credentials.clientId,
        'x-client-secret': credentials.clientSecret
      }
    });
    
    console.log('\n✅ Debug endpoint response:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error calling debug endpoint:', error.response?.data || error.message);
  }
}

testServiceComparison().catch(console.error);