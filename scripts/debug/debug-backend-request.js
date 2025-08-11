// Simple script to manually test the sessions endpoint
const axios = require('axios');

async function testSessionsEndpoint() {
  console.log('🧪 Testing /api/analysis/sessions endpoint...');
  
  try {
    const response = await axios.get('http://localhost:3001/api/analysis/sessions', {
      params: {
        limit: 5
      },
      headers: {
        'x-bot-id': 'st-mock-bot-id-12345',
        'x-client-id': 'cs-mock-client-id-67890',
        'x-client-secret': 'mock-client-secret-abcdef'
      },
      timeout: 30000
    });
    
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

testSessionsEndpoint().catch(console.error);