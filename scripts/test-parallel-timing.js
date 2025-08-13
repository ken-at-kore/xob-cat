#!/usr/bin/env node

/**
 * Test script for parallel auto-analyze timing analysis
 * This script calls the parallel auto-analyze endpoint directly to capture detailed timing logs
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const TEST_CONFIG = {
  startDate: '2025-08-01',
  startTime: '09:00', 
  sessionCount: 10,
  openaiApiKey: process.env.TEST_OPENAI_API_KEY,
  modelId: 'gpt-4.1-nano' // Fast, cheap model for timing analysis
};

const CREDENTIALS = {
  botId: process.env.TEST_BOT_ID,
  clientId: process.env.TEST_CLIENT_ID,
  clientSecret: process.env.TEST_CLIENT_SECRET
};

async function testParallelTiming() {
  console.log('🚀 Starting Parallel Auto-Analyze Timing Test');
  console.log('📊 Configuration:', {
    ...TEST_CONFIG,
    openaiApiKey: TEST_CONFIG.openaiApiKey ? 'sk-***' : 'MISSING'
  });
  console.log('🔑 Credentials:', {
    botId: CREDENTIALS.botId ? CREDENTIALS.botId.substring(0, 15) + '...' : 'MISSING',
    clientId: CREDENTIALS.clientId ? CREDENTIALS.clientId.substring(0, 15) + '...' : 'MISSING',
    clientSecret: CREDENTIALS.clientSecret ? 'cs-***' : 'MISSING'
  });
  
  if (!TEST_CONFIG.openaiApiKey || !CREDENTIALS.botId || !CREDENTIALS.clientId || !CREDENTIALS.clientSecret) {
    console.error('❌ Missing required environment variables in .env.local:');
    console.error('   - TEST_OPENAI_API_KEY (for OpenAI API)');
    console.error('   - TEST_BOT_ID (for Kore.ai bot)');
    console.error('   - TEST_CLIENT_ID (for Kore.ai API)');
    console.error('   - TEST_CLIENT_SECRET (for Kore.ai API)');
    process.exit(1);
  }
  
  try {
    // Step 1: Start parallel analysis
    console.log('\\n📝 Step 1: Starting parallel analysis...');
    const startResponse = await axios.post('http://localhost:3001/api/analysis/auto-analyze/parallel/start', TEST_CONFIG, {
      headers: {
        'Content-Type': 'application/json',
        'x-bot-id': CREDENTIALS.botId,
        'x-client-id': CREDENTIALS.clientId,
        'x-client-secret': CREDENTIALS.clientSecret,
        'x-jwt-token': 'test-token'
      },
      timeout: 10000
    });
    
    const { analysisId } = startResponse.data.data;
    console.log('✅ Analysis started:', analysisId);
    
    // Step 2: Monitor progress and capture timing logs
    console.log('\\n⏳ Step 2: Monitoring progress for timing data...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max
    
    while (!completed && attempts < maxAttempts) {
      attempts++;
      
      try {
        const progressResponse = await axios.get(`http://localhost:3001/api/analysis/auto-analyze/progress/${analysisId}`, {
          headers: {
            'x-bot-id': CREDENTIALS.botId,
            'x-client-id': CREDENTIALS.clientId,
            'x-client-secret': CREDENTIALS.clientSecret,
            'x-jwt-token': 'test-token'
          },
          timeout: 5000
        });
        
        const progress = progressResponse.data.data;
        
        console.log(`📊 Progress Update ${attempts}: Phase=${progress.phase}, Step="${progress.currentStep}"`);
        
        if (progress.phase === 'complete') {
          completed = true;
          console.log('✅ Analysis completed!');
          
          // Fetch final results
          const resultsResponse = await axios.get(`http://localhost:3001/api/analysis/auto-analyze/results/${analysisId}`, {
            headers: {
              'x-bot-id': CREDENTIALS.botId,
              'x-client-id': CREDENTIALS.clientId,
              'x-client-secret': CREDENTIALS.clientSecret,
              'x-jwt-token': 'test-token'
            },
            timeout: 10000
          });
          
          const results = resultsResponse.data.data;
          console.log('📈 Final Results:', {
            sessionsAnalyzed: results.sessions.length,
            hasSummary: !!results.analysisSummary,
            botId: results.botId
          });
          
        } else if (progress.phase === 'error') {
          console.error('❌ Analysis failed:', progress.error);
          break;
        }
        
        // Wait before next check
        if (!completed) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`⚠️ Error checking progress (attempt ${attempts}):`, error.message);
        if (attempts >= maxAttempts) break;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!completed && attempts >= maxAttempts) {
      console.error('❌ Analysis timed out after 2 minutes');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('📋 Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  console.log('🎯 Parallel Auto-Analyze Timing Analysis');
  console.log('💰 WARNING: This test uses real APIs and will incur OpenAI costs');
  console.log('🎯 Watch the backend logs for detailed timing information');
  console.log('');
  
  testParallelTiming()
    .then(() => {
      console.log('\\n🎉 Test completed successfully!');
      console.log('📋 Check backend logs for detailed timing breakdown');
    })
    .catch(error => {
      console.error('\\n💥 Test failed:', error);
      process.exit(1);
    });
}