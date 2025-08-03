/**
 * Test if the provided Kore.ai credentials are valid and have data
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');

// The credentials you provided
const credentials = {
  botId: '***REMOVED***',
  clientId: '***REMOVED***',
  clientSecret: '***REMOVED***'
};

function generateJwtToken(clientId, clientSecret) {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    clientId: clientId,
    iat: now,
    exp: now + 3600, // 1 hour expiration
    aud: 'https://bots.kore.ai'
  };

  return jwt.sign(payload, clientSecret, { algorithm: 'HS256' });
}

async function testRealKoreAPI() {
  console.log('=== TESTING REAL KORE.AI API ===');
  console.log(`Bot ID: ${credentials.botId}`);
  console.log(`Client ID: ${credentials.clientId.substring(0, 10)}...`);
  
  try {
    // Generate JWT token
    const token = generateJwtToken(credentials.clientId, credentials.clientSecret);
    console.log('\n✅ JWT token generated successfully');
    
    // Try to get sessions from the real Kore.ai API
    const url = `https://bots.kore.ai/api/public/bot/${credentials.botId}/getSessions?containmentType=agent`;
    
    console.log('\n📡 Making request to Kore.ai API...');
    console.log(`URL: ${url}`);
    
    const payload = {
      dateFrom: '2025-01-01T00:00:00.000Z', // Start of 2025
      dateTo: new Date().toISOString(), // Now
      skip: 0,
      limit: 10
    };
    
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'auth': token
      }
    });
    
    console.log('\n✅ API Response received!');
    console.log(`Status: ${response.status}`);
    console.log(`Sessions found: ${response.data.sessions?.length || 0}`);
    
    if (response.data.sessions && response.data.sessions.length > 0) {
      console.log('\n🎉 This bot has real data on Kore.ai!');
      console.log('Sample sessions:');
      response.data.sessions.slice(0, 3).forEach(session => {
        console.log(`  - ${session.sessionId}: ${session.start_time}`);
      });
    } else {
      console.log('\n⚠️ The bot exists but has no conversation data');
      console.log('You need to have some conversations with the bot first');
    }
    
  } catch (error) {
    console.error('\n❌ Error calling Kore.ai API:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.data?.message || error.response.statusText}`);
      
      if (error.response.status === 401) {
        console.error('→ Authentication failed. The credentials may be invalid.');
      } else if (error.response.status === 404) {
        console.error('→ Bot not found. The bot ID may be incorrect.');
      }
    } else {
      console.error(error.message);
    }
  }
}

testRealKoreAPI().catch(console.error);