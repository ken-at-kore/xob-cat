/**
 * Direct comparison: call getSessionsMetadata from both code paths
 */

const axios = require('axios');

const credentials = {
  botId: '***REMOVED***',
  clientId: '***REMOVED***',
  clientSecret: '***REMOVED***'
};

async function testBothPaths() {
  console.log('\n=== TESTING BOTH CODE PATHS DIRECTLY ===');
  
  const dateFrom = '2025-08-01T13:00:00.000Z'; // 9am ET = 1pm UTC
  const dateTo = '2025-08-01T16:00:00.000Z';   // 12pm ET = 4pm UTC
  
  console.log(`Testing with dateFrom: ${dateFrom}, dateTo: ${dateTo}`);
  
  // Path 1: Session Viewer (works)
  console.log('\n1. Session Viewer path:');
  try {
    const response1 = await axios.get('http://localhost:3001/api/analysis/sessions', {
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
    console.log(`   Sessions found: ${response1.data.data?.length || 0}`);
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // Wait a bit to let logs settle
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Path 2: Auto-analyze (fails) - start it and just check the first progress
  console.log('\n2. Auto-analyze path:');
  try {
    const response2 = await axios.post('http://localhost:3001/api/analysis/auto-analyze/start', {
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

    const analysisId = response2.data.data?.analysisId;
    console.log(`   Analysis started: ${analysisId}`);
    
    // Check progress once to trigger the sampling
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const progressResponse = await axios.get(`http://localhost:3001/api/analysis/auto-analyze/progress/${analysisId}`, {
      headers: {
        'x-bot-id': credentials.botId,
        'x-client-id': credentials.clientId,
        'x-client-secret': credentials.clientSecret
      }
    });
    
    const progress = progressResponse.data.data;
    console.log(`   First progress check: ${progress.currentStep}, sessions found: ${progress.sessionsFound}`);
    
  } catch (error) {
    console.error('   Error:', error.response?.data || error.message);
  }
  
  console.log('\nCheck the backend console for [getSessionsMetadata] logs to see the difference!');
}

testBothPaths().catch(console.error);