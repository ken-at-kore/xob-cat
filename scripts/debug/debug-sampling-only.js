/**
 * Test just the sampling phase to see detailed logs
 */

const axios = require('axios');

const credentials = {
  botId: '***REMOVED***',
  clientId: '***REMOVED***',
  clientSecret: '***REMOVED***'
};

async function testSampling() {
  console.log('\n=== TESTING SAMPLING PHASE ===');
  
  // First test direct API to confirm it works
  console.log('\n1. Testing direct API first...');
  try {
    const response = await axios.get('http://localhost:3001/api/analysis/sessions', {
      params: {
        start_date: '2025-08-01',
        start_time: '09:00',
        end_date: '2025-08-01', 
        end_time: '15:00',
        limit: 10
      },
      headers: {
        'x-bot-id': credentials.botId,
        'x-client-id': credentials.clientId,
        'x-client-secret': credentials.clientSecret
      }
    });

    console.log(`✅ Direct API: Found ${response.data.data?.length || 0} sessions`);
  } catch (error) {
    console.error('❌ Direct API Error:', error.message);
  }
  
  // Now test background job
  console.log('\n2. Starting background job...');
  try {
    const startResponse = await axios.post('http://localhost:3001/api/analysis/auto-analyze/start', {
      startDate: '2025-08-01',
      startTime: '09:00', 
      sessionCount: 5,
      openaiApiKey: 'sk-proj-test-key',
      modelId: 'gpt-4o-mini'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-bot-id': credentials.botId,
        'x-client-id': credentials.clientId,
        'x-client-secret': credentials.clientSecret
      }
    });

    const analysisId = startResponse.data.data?.analysisId;
    console.log('✅ Background job started:', analysisId);
    
    // Wait and check progress a few times
    console.log('\n3. Monitoring sampling progress...');
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const progressResponse = await axios.get(`http://localhost:3001/api/analysis/auto-analyze/progress/${analysisId}`, {
          headers: {
            'x-bot-id': credentials.botId,
            'x-client-id': credentials.clientId,
            'x-client-secret': credentials.clientSecret
          }
        });
        
        const progress = progressResponse.data.data;
        console.log(`  Attempt ${i+1}: Phase=${progress.phase}, Step="${progress.currentStep}", Found=${progress.sessionsFound}`);
        
        if (progress.phase !== 'sampling') {
          console.log(`  Phase changed to: ${progress.phase}`);
          if (progress.phase === 'error') {
            console.log(`  Error: ${progress.error}`);
          }
          break;
        }
      } catch (error) {
        console.error('  Progress error:', error.message);
        break;
      }
    }
    
  } catch (error) {
    console.error('❌ Background job error:', error.message);
  }
}

testSampling().catch(console.error);