/**
 * Call getSessionsMetadata directly from both service creation contexts
 */

const axios = require('axios');

const credentials = {
  botId: '***REMOVED***',
  clientId: '***REMOVED***',
  clientSecret: '***REMOVED***'
};

async function testSameMethodCall() {
  console.log('\n=== TESTING getSessionsMetadata FROM BOTH CONTEXTS ===');
  
  const testOptions = {
    dateFrom: '2025-08-01T13:00:00.000Z',
    dateTo: '2025-08-01T16:00:00.000Z',
    limit: 10
  };
  
  console.log('Using identical parameters:', JSON.stringify(testOptions, null, 2));
  
  // Test 1: Direct API call to sessions endpoint (which uses getSessionsMetadata via SWTService)
  console.log('\n1. Via Session Viewer API (which calls getSessionsMetadata):');
  try {
    const response = await axios.get('http://localhost:3001/api/analysis/sessions', {
      params: {
        start_date: '2025-08-01',
        start_time: '09:00',
        end_date: '2025-08-01', 
        end_time: '12:00',
        limit: 10
      },
      headers: {
        'x-bot-id': credentials.botId,
        'x-client-id': credentials.clientId,
        'x-client-secret': credentials.clientSecret
      }
    });
    console.log(`   Result: ${response.data.data?.length || 0} sessions found`);
  } catch (error) {
    console.error('   Error:', error.message);
  }
  
  // Test 2: Create a debug endpoint that directly calls getSessionsMetadata
  console.log('\n2. Need to create debug endpoint to test getSessionsMetadata directly...');
  console.log('   The issue is we can\'t directly call getSessionsMetadata from here');
  console.log('   But we can infer the issue from the backend logs');
  
  // Test 3: Trigger auto-analyze to see what getSessionsMetadata gets called with
  console.log('\n3. Triggering auto-analyze to compare logging:');
  try {
    const response = await axios.post('http://localhost:3001/api/analysis/auto-analyze/start', {
      startDate: '2025-08-01',
      startTime: '09:00',
      sessionCount: 5,
      openaiApiKey: 'sk-test-key',
      modelId: 'gpt-4o-mini'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-bot-id': credentials.botId,
        'x-client-id': credentials.clientId,
        'x-client-secret': credentials.clientSecret
      }
    });

    const analysisId = response.data.data?.analysisId;
    console.log(`   Analysis ID: ${analysisId}`);
    
    // Wait for first sampling attempt
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const progressResponse = await axios.get(`http://localhost:3001/api/analysis/auto-analyze/progress/${analysisId}`, {
      headers: {
        'x-bot-id': credentials.botId,
        'x-client-id': credentials.clientId,
        'x-client-secret': credentials.clientSecret
      }
    });
    
    console.log(`   Current step: ${progressResponse.data.data.currentStep}`);
    console.log(`   Sessions found: ${progressResponse.data.data.sessionsFound}`);
    
  } catch (error) {
    console.error('   Error:', error.response?.data || error.message);
  }
  
  console.log('\n🔍 Check the backend console output!');
  console.log('Look for [getSessionsMetadata] logs to see:');
  console.log('1. What parameters each call receives');
  console.log('2. Whether isMockCredentials differs');
  console.log('3. What the actual API responses are');
}

testSameMethodCall().catch(console.error);