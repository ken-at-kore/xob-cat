#!/usr/bin/env node

/**
 * Test script for 100-session parallel auto-analyze timing analysis
 * This script bypasses Jest timeouts and provides detailed timing breakdown
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const TEST_CONFIG = {
  startDate: '2025-08-01',
  startTime: '09:00', 
  sessionCount: 100, // 100 sessions for scale testing
  openaiApiKey: process.env.TEST_OPENAI_API_KEY,
  modelId: 'gpt-4o-mini' // Reliable model for 100 sessions
};

const CREDENTIALS = {
  botId: process.env.TEST_BOT_ID,
  clientId: process.env.TEST_CLIENT_ID,
  clientSecret: process.env.TEST_CLIENT_SECRET
};

// Timing tracking
const phaseTimings = {
  sampling: { start: 0, end: 0, duration: 0 },
  discovery: { start: 0, end: 0, duration: 0 },
  parallelProcessing: { start: 0, end: 0, duration: 0 },
  conflictResolution: { start: 0, end: 0, duration: 0 },
  summaryGeneration: { start: 0, end: 0, duration: 0 },
  total: { start: 0, end: 0, duration: 0 }
};

let lastPhase = null;
let streamCount = 0;
let roundsCompleted = 0;

async function test100SessionsParallel() {
  console.log('🚀 Starting 100-Session Parallel Auto-Analyze Timing Test');
  console.log('📊 Configuration:', {
    ...TEST_CONFIG,
    openaiApiKey: TEST_CONFIG.openaiApiKey ? 'sk-***' : 'MISSING'
  });
  console.log('🔑 Credentials:', {
    botId: CREDENTIALS.botId ? CREDENTIALS.botId.substring(0, 15) + '...' : 'MISSING',
    clientId: CREDENTIALS.clientId ? CREDENTIALS.clientId.substring(0, 15) + '...' : 'MISSING',
    clientSecret: CREDENTIALS.clientSecret ? 'cs-***' : 'MISSING'
  });
  console.log('⏱️  Timeout Configuration: 10 minutes max');
  console.log('💰 WARNING: This test will incur significant OpenAI costs (~$0.20-0.40)');
  console.log('');
  
  if (!TEST_CONFIG.openaiApiKey || !CREDENTIALS.botId || !CREDENTIALS.clientId || !CREDENTIALS.clientSecret) {
    console.error('❌ Missing required environment variables in .env.local');
    process.exit(1);
  }
  
  try {
    phaseTimings.total.start = Date.now();
    
    // Step 1: Start parallel analysis
    console.log('📝 Step 1: Starting 100-session parallel analysis...');
    const startResponse = await axios.post('http://localhost:3001/api/analysis/auto-analyze/parallel/start', TEST_CONFIG, {
      headers: {
        'Content-Type': 'application/json',
        'x-bot-id': CREDENTIALS.botId,
        'x-client-id': CREDENTIALS.clientId,
        'x-client-secret': CREDENTIALS.clientSecret,
        'x-jwt-token': 'test-token'
      },
      timeout: 30000 // 30 second timeout for start request
    });
    
    const { analysisId } = startResponse.data.data;
    console.log('✅ Analysis started:', analysisId);
    console.log('');
    
    // Step 2: Monitor progress with phase timing
    console.log('⏳ Step 2: Monitoring progress and capturing phase timings...');
    console.log('');
    
    let completed = false;
    let attempts = 0;
    const maxAttempts = 600; // 10 minutes max (checking every second)
    let lastProgress = null;
    
    while (!completed && attempts < maxAttempts) {
      attempts++;
      
      try {
        const progressResponse = await axios.get(`http://localhost:3001/api/analysis/auto-analyze/parallel/progress/${analysisId}`, {
          headers: {
            'x-bot-id': CREDENTIALS.botId,
            'x-client-id': CREDENTIALS.clientId,
            'x-client-secret': CREDENTIALS.clientSecret,
            'x-jwt-token': 'test-token'
          },
          timeout: 5000
        });
        
        const progress = progressResponse.data.data;
        
        // Track phase transitions and timing
        if (progress.phase !== lastPhase) {
          const now = Date.now();
          
          // End timing for previous phase
          if (lastPhase && phaseTimings[lastPhase]) {
            phaseTimings[lastPhase].end = now;
            phaseTimings[lastPhase].duration = now - phaseTimings[lastPhase].start;
            console.log(`✅ Phase '${lastPhase}' completed in ${(phaseTimings[lastPhase].duration/1000).toFixed(2)}s`);
          }
          
          // Start timing for new phase
          if (progress.phase === 'sampling') {
            phaseTimings.sampling.start = now;
            console.log('🔄 PHASE 0: SESSION SAMPLING STARTED');
          } else if (progress.phase === 'discovery') {
            phaseTimings.discovery.start = now;
            console.log('🔄 PHASE 1: STRATEGIC DISCOVERY STARTED');
          } else if (progress.phase === 'parallel_processing') {
            phaseTimings.parallelProcessing.start = now;
            console.log('🔄 PHASE 2: PARALLEL PROCESSING STARTED');
          } else if (progress.phase === 'conflict_resolution') {
            phaseTimings.conflictResolution.start = now;
            console.log('🔄 PHASE 3: CONFLICT RESOLUTION STARTED');
          } else if (progress.phase === 'generating_summary') {
            phaseTimings.summaryGeneration.start = now;
            console.log('🔄 PHASE 4: SUMMARY GENERATION STARTED');
          }
          
          lastPhase = progress.phase;
        }
        
        // Log detailed progress every 5 seconds
        if (attempts % 5 === 0 || progress.phase !== lastProgress?.phase) {
          console.log(`📊 [${new Date().toISOString().split('T')[1].split('.')[0]}] Phase: ${progress.phase}`);
          console.log(`   Step: "${progress.currentStep}"`);
          console.log(`   Sessions: ${progress.sessionsProcessed}/${progress.totalSessions}`);
          
          if (progress.phase === 'sampling' && progress.samplingProgress) {
            console.log(`   Sampling Window: ${progress.samplingProgress.currentWindowLabel}`);
            console.log(`   Sessions Found: ${progress.sessionsFound}`);
          }
          
          if (progress.phase === 'parallel_processing' || progress.phase === 'discovery') {
            if (progress.streamsActive !== undefined) {
              streamCount = Math.max(streamCount, progress.streamsActive);
              console.log(`   Active Streams: ${progress.streamsActive}`);
            }
            if (progress.roundsCompleted !== undefined) {
              roundsCompleted = progress.roundsCompleted;
              console.log(`   Rounds Completed: ${progress.roundsCompleted}/${progress.totalRounds || '?'}`);
            }
          }
          
          if (progress.tokensUsed > 0) {
            console.log(`   Tokens Used: ${progress.tokensUsed} (~$${progress.estimatedCost.toFixed(4)})`);
          }
          console.log('');
        }
        
        lastProgress = progress;
        
        if (progress.phase === 'complete') {
          completed = true;
          phaseTimings.total.end = Date.now();
          phaseTimings.total.duration = phaseTimings.total.end - phaseTimings.total.start;
          
          // End timing for last phase if needed
          if (lastPhase && phaseTimings[lastPhase] && !phaseTimings[lastPhase].end) {
            phaseTimings[lastPhase].end = Date.now();
            phaseTimings[lastPhase].duration = phaseTimings[lastPhase].end - phaseTimings[lastPhase].start;
          }
          
          console.log('✅ ANALYSIS COMPLETED!');
          console.log('');
          
          // Fetch final results
          const resultsResponse = await axios.get(`http://localhost:3001/api/analysis/auto-analyze/parallel/results/${analysisId}`, {
            headers: {
              'x-bot-id': CREDENTIALS.botId,
              'x-client-id': CREDENTIALS.clientId,
              'x-client-secret': CREDENTIALS.clientSecret,
              'x-jwt-token': 'test-token'
            },
            timeout: 30000
          });
          
          const results = resultsResponse.data.data;
          
          // Display comprehensive timing breakdown
          console.log('========================================');
          console.log('📊 COMPLETE TIMING BREAKDOWN (100 SESSIONS)');
          console.log('========================================');
          console.log('');
          
          console.log('⏱️  TOTAL TIME: ' + (phaseTimings.total.duration/1000).toFixed(2) + ' seconds');
          console.log('');
          
          console.log('PHASE BREAKDOWN:');
          console.log('----------------');
          
          const phases = [
            { name: 'Session Sampling', key: 'sampling', phase: 0 },
            { name: 'Strategic Discovery', key: 'discovery', phase: 1 },
            { name: 'Parallel Processing', key: 'parallelProcessing', phase: 2 },
            { name: 'Conflict Resolution', key: 'conflictResolution', phase: 3 },
            { name: 'Summary Generation', key: 'summaryGeneration', phase: 4 }
          ];
          
          phases.forEach(({ name, key, phase }) => {
            if (phaseTimings[key].duration > 0) {
              const duration = phaseTimings[key].duration / 1000;
              const percentage = (phaseTimings[key].duration / phaseTimings.total.duration * 100).toFixed(1);
              console.log(`Phase ${phase}: ${name}`);
              console.log(`  ⏱️  Duration: ${duration.toFixed(2)}s (${percentage}% of total)`);
              
              if (key === 'parallelProcessing') {
                console.log(`  🌊 Streams Used: ${streamCount}`);
                console.log(`  🔄 Rounds Completed: ${roundsCompleted}`);
              }
            }
          });
          
          console.log('');
          console.log('PERFORMANCE METRICS:');
          console.log('-------------------');
          console.log(`📊 Sessions Analyzed: ${results.sessions.length}`);
          console.log(`⚡ Overall Performance: ${(100 / (phaseTimings.total.duration/1000)).toFixed(2)} sessions/second`);
          console.log(`💰 Total Cost: $${progress.estimatedCost.toFixed(4)}`);
          console.log(`🔢 Total Tokens: ${progress.tokensUsed}`);
          console.log(`📈 Tokens per Session: ${Math.round(progress.tokensUsed / 100)}`);
          
          console.log('');
          console.log('⚠️  BOTTLENECK ANALYSIS:');
          console.log('------------------------');
          
          // Identify bottlenecks
          const sortedPhases = phases
            .filter(p => phaseTimings[p.key].duration > 0)
            .sort((a, b) => phaseTimings[b.key].duration - phaseTimings[a.key].duration);
          
          sortedPhases.forEach((phase, index) => {
            const duration = phaseTimings[phase.key].duration / 1000;
            const percentage = (phaseTimings[phase.key].duration / phaseTimings.total.duration * 100).toFixed(1);
            
            if (index === 0) {
              console.log(`🔴 PRIMARY BOTTLENECK: ${phase.name}`);
              console.log(`   Taking ${duration.toFixed(2)}s (${percentage}% of total time)`);
              
              if (phase.key === 'parallelProcessing') {
                const sequentialEstimate = 100 * 0.35; // ~350ms per session sequential
                const timeSaved = sequentialEstimate - duration;
                const efficiency = (timeSaved / sequentialEstimate * 100).toFixed(1);
                console.log(`   Parallel Efficiency: ${efficiency}% time saved vs sequential`);
                console.log(`   Estimated Sequential Time: ${sequentialEstimate.toFixed(2)}s`);
                console.log(`   Time Saved: ${timeSaved.toFixed(2)}s`);
              }
            } else if (percentage > 20) {
              console.log(`🟡 SECONDARY BOTTLENECK: ${phase.name} (${percentage}%)`);
            }
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
        if (error.response?.status === 404) {
          console.error(`⚠️ Analysis ${analysisId} not found (attempt ${attempts}) - Wrong endpoint?`);
          console.error(`⚠️ Check that parallel analysis endpoint is correct: /api/analysis/auto-analyze/parallel/progress/`);
        } else if (error.code === 'ECONNREFUSED') {
          console.error(`⚠️ Backend server not reachable (attempt ${attempts})`);
        } else {
          console.error(`⚠️ Error checking progress (attempt ${attempts}):`, error.message);
        }
        
        // Exit early on repeated 404s (likely endpoint mismatch)
        if (error.response?.status === 404 && attempts > 3) {
          console.error('❌ Multiple 404 errors - analysis may have completed but using wrong progress endpoint');
          break;
        }
        
        if (attempts >= maxAttempts) break;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!completed && attempts >= maxAttempts) {
      console.error('❌ Analysis timed out after 10 minutes');
      console.log('Partial timing data:');
      Object.entries(phaseTimings).forEach(([phase, timing]) => {
        if (timing.duration > 0) {
          console.log(`  ${phase}: ${(timing.duration/1000).toFixed(2)}s`);
        }
      });
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
  console.log('🎯 100-Session Parallel Auto-Analyze Timing Analysis');
  console.log('====================================================');
  console.log('');
  
  test100SessionsParallel()
    .then(() => {
      console.log('\n🎉 Test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}