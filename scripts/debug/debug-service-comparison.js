/**
 * Debug service comparison by calling the debug endpoint
 */

const axios = require('axios');

const credentials = {
  botId: 'st-90549a67-7f19-5074-afcf-3120db51a26d',
  clientId: 'cs-2a4298ea-947c-5a42-9846-670c660da0fd',
  clientSecret: 'CvRFRrwOOeUJLca4twBWJWdaf1TKaOa91UgTnLSCKDs='
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