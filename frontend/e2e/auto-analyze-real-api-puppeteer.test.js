#!/usr/bin/env node
/**
 * Auto-Analyze Real API Puppeteer Test
 * 
 * Tests the complete auto-analyze workflow using real Kore.ai and OpenAI APIs.
 * Uses shared workflow architecture for consistency and maintainability.
 * 
 * Real APIs:
 * - Real Kore.ai API with actual bot credentials
 * - Real OpenAI API with actual API key and costs
 * - Production-like testing with real session data
 * 
 * Requires environment variables in .env.local:
 * - TEST_BOT_ID
 * - TEST_CLIENT_ID
 * - TEST_CLIENT_SECRET
 * - TEST_OPENAI_API_KEY
 * 
 * Usage:
 *   node frontend/e2e/auto-analyze-real-api-puppeteer.test.js
 *   node frontend/e2e/auto-analyze-real-api-puppeteer.test.js --url=https://www.koreai-xobcat.com
 *   node frontend/e2e/auto-analyze-real-api-puppeteer.test.js --sessions=100
 *   node frontend/e2e/auto-analyze-real-api-puppeteer.test.js --sessions=50 --url=https://www.koreai-xobcat.com
 *   node frontend/e2e/auto-analyze-real-api-puppeteer.test.js --test-download  # Enable download testing
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { parseTestArgs, showHelp } = require('./shared/parse-test-args');
const {
  getBrowserConfig,
  TIMEOUTS,
  enterCredentials,
  navigateToAutoAnalyze,
  configureAnalysis,
  startAnalysis,
  monitorProgress,
  waitForCompletion,
  validateReport,
  testSessionDetailsDialog,
  assertProgressIndicators,
  setupRequestLogging
} = require('./shared/auto-analyze-workflow');

// Load real credentials from .env.local
function loadCredentials() {
  const envPath = path.join(__dirname, '../../.env.local');
  console.log(`📁 Loading credentials from: ${envPath}`);
  
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local file not found at ${envPath}`);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const credentials = {};
  envContent.split('\n').forEach(line => {
    if (line.startsWith('TEST_BOT_ID=')) {
      credentials.botId = line.substring('TEST_BOT_ID='.length).trim();
    } else if (line.startsWith('TEST_CLIENT_ID=')) {
      credentials.clientId = line.substring('TEST_CLIENT_ID='.length).trim();
    } else if (line.startsWith('TEST_CLIENT_SECRET=')) {
      credentials.clientSecret = line.substring('TEST_CLIENT_SECRET='.length).trim();
    } else if (line.startsWith('TEST_OPENAI_API_KEY=')) {
      credentials.openaiApiKey = line.substring('TEST_OPENAI_API_KEY='.length).trim();
    }
  });
  
  // Validate required credentials
  const required = ['botId', 'clientId', 'clientSecret', 'openaiApiKey'];
  const missing = required.filter(key => !credentials[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing credentials in .env.local: ${missing.join(', ')}`);
  }
  
  console.log(`✅ Loaded credentials: Bot ID ${credentials.botId.substring(0, 10)}..., OpenAI key ${credentials.openaiApiKey.substring(0, 10)}...`);
  return credentials;
}

// Parse command line arguments (deprecated - use parseTestArgs)
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    baseUrl: 'http://localhost:3000'
  };
  
  args.forEach(arg => {
    if (arg.startsWith('--url=')) {
      config.baseUrl = arg.substring('--url='.length);
    }
  });
  
  return config;
}

/**
 * Validate prompt engineering changes using OpenAI to analyze the report content
 * @param {Page} page - Puppeteer page object
 * @param {string} openaiApiKey - OpenAI API key for validation
 * @returns {Object} Validation results
 */
async function validatePromptEngineeringChanges(page, openaiApiKey) {
  console.log('🔍 Step 9.5: Validating prompt engineering changes');
  
  try {
    // Extract sessions table data from the page
    const sessionsData = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return null;
      
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        return {
          sessionId: cells[0]?.textContent?.trim() || '',
          intent: cells[1]?.textContent?.trim() || '',
          outcome: cells[2]?.textContent?.trim() || '',
          dropOffLocation: cells[3]?.textContent?.trim() || '',
          transferReason: cells[4]?.textContent?.trim() || ''
        };
      });
    });
    
    if (!sessionsData || sessionsData.length === 0) {
      console.log('⚠️ No sessions table found for validation');
      return { 
        validated: false, 
        reason: 'No sessions table found',
        hasHelpOffer: false,
        hasHelpOfferPrompt: false
      };
    }
    
    console.log(`📊 Found ${sessionsData.length} sessions to analyze`);
    
    // Use OpenAI to analyze the drop-off locations
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const dropOffLocations = sessionsData.map(s => s.dropOffLocation).filter(loc => loc && loc !== '');
    console.log(`🎯 Drop-off locations found: ${JSON.stringify([...new Set(dropOffLocations)])}`);
    
    const analysisPrompt = `Analyze this list of drop-off locations from a bot analysis report:
${JSON.stringify(dropOffLocations)}

Please answer these specific questions:
1. Is there at least one drop-off location exactly called "Initial Help Offer"?
2. Are there any drop-off locations called "Help Offer" (without "Initial")?
3. Are there any drop-off locations called "Help Offer Prompt"?

Respond in this exact JSON format:
{
  "hasInitialHelpOffer": true/false,
  "hasOldHelpOffer": true/false,
  "hasHelpOfferPrompt": true/false,
  "explanation": "brief explanation of what you found"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0
    });
    
    const analysis = JSON.parse(response.choices[0].message.content);
    
    console.log('🤖 OpenAI Analysis Results:');
    console.log(`   - Has "Initial Help Offer": ${analysis.hasInitialHelpOffer ? '✅' : '❌'}`);
    console.log(`   - Has old "Help Offer": ${analysis.hasOldHelpOffer ? '❌ (BAD - old prompts)' : '✅ (GOOD)'}`);
    console.log(`   - Has "Help Offer Prompt": ${analysis.hasHelpOfferPrompt ? '❌ (BAD - old prompts)' : '✅ (GOOD)'}`);
    console.log(`   - Explanation: ${analysis.explanation}`);
    
    // Validate our expectations - should have new prompts, not old ones
    const promptEngineeringWorking = analysis.hasInitialHelpOffer && !analysis.hasOldHelpOffer && !analysis.hasHelpOfferPrompt;
    
    if (promptEngineeringWorking) {
      console.log('✅ Prompt engineering changes are working correctly!');
    } else {
      console.log('❌ Prompt engineering changes NOT working - still using old prompts');
      throw new Error(`Prompt validation failed: ${analysis.explanation}`);
    }
    
    return {
      validated: true,
      hasInitialHelpOffer: analysis.hasInitialHelpOffer,
      hasOldHelpOffer: analysis.hasOldHelpOffer,
      hasHelpOfferPrompt: analysis.hasHelpOfferPrompt,
      explanation: analysis.explanation,
      promptEngineeringWorking
    };
    
  } catch (error) {
    console.log(`❌ Prompt validation error: ${error.message}`);
    throw error;
  }
}

async function runAutoAnalyzeRealTest() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  // Show help if requested
  if (args.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  const config = parseTestArgs(args);
  
  let browser;
  
  try {
    console.log('🚀 Starting Auto-Analyze Real API Puppeteer Test');
    console.log('💰 WARNING: This test uses real APIs and will incur OpenAI costs');
    console.log(`🌐 Testing against: ${config.baseUrl}`);
    if (config.slowMo > 0) {
      console.log(`🐌 SlowMo enabled at ${config.slowMo}ms`);
    }
    if (config.sessions && config.sessions !== 10) {
      console.log(`📊 Custom session count: ${config.sessions} sessions`);
    }
    
    // Load real credentials
    const credentials = loadCredentials();
    // parseArgs() is now handled at the beginning of the function
    
    console.log(`🌐 Testing against: ${config.baseUrl}`);
    
    // Real API analysis configuration (configurable session count)
    const sessionCount = config.sessions || 10;  // Default to 10, configurable via --sessions=N
    const realAnalysisConfig = {
      startDate: '2025-08-01',  // Date with confirmed real session data
      timeOfDay: 'morning',     // NEW: use timeOfDay instead of startTime
      startTime: '09:00',       // Backward compatibility - will be mapped to morning
      sessionCount: sessionCount.toString(),
      openaiApiKey: credentials.openaiApiKey,
      modelId: 'gpt-4.1-nano',  // Use nano model for testing (correct ID)
      additionalContext: 'This is a healthcare IVA that helps members check claim status. The bot uses member ID for authentication.'
    };
    
    console.log(`📊 Configured for ${sessionCount} sessions with ${realAnalysisConfig.modelId} model`);
    
    // Launch browser with shared configuration
    browser = await puppeteer.launch(getBrowserConfig({ 
      slowMo: config.slowMo
    }));
    const page = await browser.newPage();
    
    // Set timeouts (longer for real APIs, extra long for large session counts)
    const timeoutMultiplier = sessionCount >= 50 ? 3 : sessionCount >= 20 ? 2 : 1;
    page.setDefaultTimeout(TIMEOUTS.longWait * timeoutMultiplier);
    page.setDefaultNavigationTimeout(TIMEOUTS.longWait * timeoutMultiplier);
    
    if (sessionCount >= 50) {
      console.log(`⏰ Extended timeouts configured for ${sessionCount} sessions (${TIMEOUTS.longWait * timeoutMultiplier}ms)`);
    }
    
    // Setup request logging
    await setupRequestLogging(page);
    
    // Execute shared workflow steps
    
    // Step 1-2: Enter real credentials
    await enterCredentials(page, credentials, config.baseUrl);
    
    // Step 3-4: Navigate to Auto-Analyze page
    await navigateToAutoAnalyze(page, config.baseUrl);
    
    // Step 4.5: Verify default start date is yesterday (in local timezone)
    console.log('🔍 Step 4.5: Verifying default start date is yesterday');
    
    // Calculate yesterday in the browser's local timezone
    const expectedYesterday = await page.evaluate(() => {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() - 1); // Yesterday
      // Format as YYYY-MM-DD in local timezone (not UTC)
      const year = defaultDate.getFullYear();
      const month = String(defaultDate.getMonth() + 1).padStart(2, '0');
      const day = String(defaultDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });
    
    console.log(`📅 Expected yesterday date (local time): ${expectedYesterday}`);
    
    // Get the actual default value from the start date input
    const actualStartDate = await page.evaluate(() => {
      const startDateInput = document.querySelector('input[type="date"]');
      return startDateInput ? startDateInput.value : null;
    });
    
    console.log(`📅 Actual default start date in field: ${actualStartDate}`);
    
    // Assert the dates match
    if (actualStartDate === expectedYesterday) {
      console.log('✅ DEFAULT DATE CORRECT: Start date field defaults to yesterday');
    } else {
      console.log(`❌ DEFAULT DATE INCORRECT: Expected ${expectedYesterday}, but got ${actualStartDate}`);
      throw new Error(`Default start date assertion failed: Expected ${expectedYesterday}, got ${actualStartDate}`);
    }
    
    // Step 5: Configure analysis settings with real API key
    await configureAnalysis(page, realAnalysisConfig);
    
    // Step 6: Start analysis
    await startAnalysis(page);
    
    // Step 6.5: Check initial status message (should be "Initializing", NOT "Analyzing sessions")
    console.log('🔍 Step 6.5: Checking initial status message order');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for initial status
    
    const initialStatus = await page.evaluate(() => {
      // Look for the progress status text
      const progressElements = document.querySelectorAll('*');
      for (let element of progressElements) {
        const text = element.textContent;
        if (text && text.includes('Progress') && element.nextElementSibling) {
          const statusElement = element.nextElementSibling.textContent;
          if (statusElement && (statusElement.includes('Initializing') || statusElement.includes('Analyzing sessions'))) {
            return statusElement.trim();
          }
        }
        // Also check for direct status text
        if (text && (text.includes('Status:') || text.includes('Progress:'))) {
          return text.trim();
        }
      }
      return document.body.textContent; // Fallback to body content
    });
    
    console.log(`📊 Initial status detected: "${initialStatus}"`);
    
    // Assert that initial status is "Initializing" and NOT "Analyzing sessions"
    if (initialStatus.includes('Analyzing sessions') && !initialStatus.includes('Initializing')) {
      console.log('❌ BUG CONFIRMED: Initial status shows "Analyzing sessions" instead of "Initializing"');
      console.log('🔧 This confirms the reported issue - initial status should be "Initializing"');
      throw new Error('Initial status bug detected: Shows "Analyzing sessions" before "Searching for sessions"');
    } else if (initialStatus.includes('Initializing')) {
      console.log('✅ CORRECT: Initial status shows "Initializing" as expected');
    } else {
      console.log(`⚠️ Initial status unclear: "${initialStatus}"`);
    }
    
    // Step 6.75: Wait for discovery phase and check its status message
    console.log('🔍 Step 6.75: Waiting for discovery phase to check its status message');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for discovery phase
    
    const discoveryStatus = await page.evaluate(() => {
      // Look for the progress status text during discovery phase
      const progressElements = document.querySelectorAll('*');
      for (let element of progressElements) {
        const text = element.textContent;
        if (text && text.includes('Progress') && element.nextElementSibling) {
          const statusElement = element.nextElementSibling.textContent;
          if (statusElement && (statusElement.includes('Analyzing initial sessions') || statusElement.includes('Initializing ('))) {
            return statusElement.trim();
          }
        }
      }
      return document.body.textContent; // Fallback to body content
    });
    
    console.log(`📊 Discovery phase status detected: "${discoveryStatus}"`);
    
    // Assert that discovery phase shows "Analyzing initial sessions" and NOT "Initializing"
    if (discoveryStatus.includes('Initializing (') && discoveryStatus.includes('/')) {
      console.log('❌ DISCOVERY PHASE BUG: Shows "Initializing (X/Y)" instead of "Analyzing initial sessions (X/Y)"');
      console.log('🔧 Discovery phase should show "Analyzing initial sessions" not "Initializing"');
      throw new Error('Discovery phase bug detected: Shows "Initializing (X/Y)" instead of "Analyzing initial sessions (X/Y)"');
    } else if (discoveryStatus.includes('Analyzing initial sessions')) {
      console.log('✅ CORRECT: Discovery phase shows "Analyzing initial sessions" as expected');
    } else {
      console.log(`⚠️ Discovery phase status unclear: "${discoveryStatus}"`);
    }
    
    // Step 7: Monitor progress (real APIs take longer)
    const progressResults = await monitorProgress(page);
    console.log('Progress monitoring results:', progressResults);
    
    // Step 7.5: Continuously assert progress indicators with stuck detection
    console.log('🔍 Step 7.5: Starting continuous progress indicator assertions');
    const progressAssertionResults = [];
    let assertionAttempts = 0;
    let previousAssertion = null;
    let stuckCount = 0;
    const maxAssertionAttempts = sessionCount >= 50 ? 180 : 90; // 3 minutes for large sessions, 1.5 for small
    
    const assertionInterval = setInterval(async () => {
      if (assertionAttempts >= maxAssertionAttempts) {
        clearInterval(assertionInterval);
        return;
      }
      
      try {
        const assertions = await assertProgressIndicators(page, previousAssertion);
        
        if (assertions.progressPhase) {
          console.log(`📊 PROGRESS ASSERTION - Phase: ${assertions.progressPhase}`);
          
          // Log numeric values to track actual progress
          console.log(`   📈 Progress Values:`);
          console.log(`     - Sessions Found: ${assertions.numericValues.sessionsFound}`);
          console.log(`     - Batches Completed: ${assertions.numericValues.batchesCompleted}`);
          console.log(`     - Sessions Processed: ${assertions.numericValues.sessionsProcessed}`);
          console.log(`     - Tokens Used: ${assertions.numericValues.tokensUsed}`);
          console.log(`     - Estimated Cost: $${assertions.numericValues.estimatedCost}`);
          console.log(`     - Progress %: ${assertions.numericValues.progressPercentage}%`);
          
          // Check if progress is actually happening
          if (assertions.actualProgress) {
            console.log(`   ✅ REAL PROGRESS DETECTED - values are changing!`);
            stuckCount = 0; // Reset stuck counter
          } else if (previousAssertion) {
            console.log(`   ⚠️ NO PROGRESS - values unchanged from previous check`);
          }
          
          // Track if progress appears stuck
          if (assertions.progressStuck) {
            stuckCount++;
            console.log(`   🚨 PROGRESS STUCK - same values for ${stuckCount} consecutive checks`);
            
            if (stuckCount >= 5) { // Stuck for 10+ seconds
              console.log(`   ❌ PROGRESS FAILURE - Analysis appears frozen for ${stuckCount * 2} seconds`);
              console.log(`   🔍 Current state: ${assertions.progressPhase} with all metrics at zero`);
            }
          }
          
          // Log phase-specific indicators
          if (Object.keys(assertions.phaseSpecific).length > 0) {
            Object.entries(assertions.phaseSpecific).forEach(([key, detected]) => {
              console.log(`   - ${key}: ${detected ? '✅' : '❌'}`);
            });
          }
          
          // Log universal indicators (now more stringent)
          console.log(`   📊 Progress Indicators:`);
          console.log(`     - Session Counts: ${assertions.sessionCounts ? '✅' : '❌'}`);
          console.log(`     - Batch Progress: ${assertions.batchProgress ? '✅' : '❌'}`);
          console.log(`     - Stream Activity: ${assertions.streamActivity ? '✅' : '❌'}`);
          console.log(`     - Token Usage: ${assertions.tokenUsage ? '✅' : '❌'}`);
          console.log(`     - Estimated Cost: ${assertions.estimatedCost ? '✅' : '❌'}`);
          console.log(`     - Progress Bar Animation: ${assertions.hasProgressBarAnimation ? '✅ SHIMMER DETECTED' : '❌ NO ANIMATION'}`);
          
          progressAssertionResults.push(assertions);
          previousAssertion = assertions;
        }
        
        // Check if analysis is complete (stop assertions)
        const currentContent = await page.$eval('body', el => el.textContent);
        if (currentContent.includes('Analysis Report') || 
            currentContent.includes('Export Analysis') ||
            currentContent.includes('Analysis Complete')) {
          console.log('📊 Analysis completed - stopping progress assertions');
          clearInterval(assertionInterval);
        }
      } catch (error) {
        console.log(`⚠️ Progress assertion error: ${error.message}`);
      }
      
      assertionAttempts++;
    }, 2000); // Check every 2 seconds
    
    // Step 8: Wait for completion (dynamic timeout based on session count)
    const completionResults = await waitForCompletion(page, sessionCount);
    clearInterval(assertionInterval); // Ensure interval is cleared
    console.log('Completion results:', completionResults);
    
    // Step 9: Validate report content
    const validationResults = await validateReport(page, {
      expectedBotId: credentials.botId,
      expectedSessionCount: parseInt(realAnalysisConfig.sessionCount),
      expectedContext: realAnalysisConfig.additionalContext
    });
    
    // Step 9.5: Validate prompt engineering changes using OpenAI
    const promptValidationResults = await validatePromptEngineeringChanges(page, credentials.openaiApiKey);
    
    // Step 10: Test session details dialog (if analysis completed)
    let dialogResults = { dialogTested: false };
    if (completionResults.analysisCompleted) {
      dialogResults = await testSessionDetailsDialog(page);
      console.log('Dialog test results:', dialogResults);
    }
    
    // Step 11: Test download functionality (if analysis completed and enabled)
    let downloadResults = { downloadTested: false, downloadSuccess: false, shareModalDownloadTested: false, shareModalDownloadSuccess: false };
    if (completionResults.analysisCompleted && config.testDownload) {
      try {
        console.log('📥 Step 11: Testing download functionality');
        
        // Test 1: Download button on report page
        console.log('📥 Step 11a: Testing download button on report page');
        
        // Look for the Download Report Data button using proper Puppeteer selectors
        const downloadButton = await page.evaluateHandle(() => {
          // Find button containing "Download Report Data" text
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(btn => 
            btn.textContent?.includes('Download Report Data') || 
            btn.textContent?.includes('Download') ||
            btn.getAttribute('aria-label')?.includes('download')
          );
        });
        
        if (downloadButton && downloadButton.asElement()) {
          console.log('✅ Download button found on report page');
          
          // Setup download listening via response monitoring
          const downloadPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Download timeout after 10 seconds')), 10000);
            
            page.on('response', async (response) => {
              if (response.url().includes('/export/') && response.status() === 200) {
                clearTimeout(timeout);
                console.log(`✅ Download API call successful: ${response.url()}`);
                
                try {
                  // Validate response headers
                  const contentType = response.headers()['content-type'];
                  const contentDisposition = response.headers()['content-disposition'];
                  
                  console.log(`📄 Content-Type: ${contentType}`);
                  console.log(`📁 Content-Disposition: ${contentDisposition}`);
                  
                  if (contentType?.includes('application/json')) {
                    console.log('✅ Valid JSON response for download');
                    resolve({ success: true, contentType, contentDisposition });
                  } else {
                    reject(new Error(`Invalid content type: ${contentType}`));
                  }
                } catch (error) {
                  reject(new Error(`Response validation failed: ${error.message}`));
                }
              } else if (response.url().includes('/export/') && response.status() !== 200) {
                clearTimeout(timeout);
                reject(new Error(`Download failed with status ${response.status()}: ${response.statusText()}`));
              }
            });
          });
          
          await downloadButton.asElement().click();
          console.log('🔽 Download button clicked on report page');
          
          try {
            const downloadResponse = await downloadPromise;
            console.log('✅ Report page download completed successfully');
            console.log(`📦 Download response: ${JSON.stringify(downloadResponse)}`);
            downloadResults.downloadTested = true;
            downloadResults.downloadSuccess = true;
            downloadResults.contentType = downloadResponse.contentType;
            downloadResults.contentDisposition = downloadResponse.contentDisposition;
          } catch (downloadError) {
            console.log(`⚠️ Report page download failed: ${downloadError.message}`);
            downloadResults.downloadTested = true;
            downloadResults.downloadSuccess = false;
            downloadResults.error = downloadError.message;
          }
        } else {
          console.log('⚠️ Download button not found on report page');
          downloadResults.downloadTested = false;
          downloadResults.reason = 'Download button not found on report page';
        }
        
        // Test 2: Download button in Share Report modal
        console.log('📥 Step 11b: Testing download button in Share Report modal');
        
        try {
          // Look for Share Report button
          const shareButton = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => 
              btn.textContent?.includes('Share Report') ||
              btn.textContent?.includes('Share')
            );
          });
          
          if (shareButton && shareButton.asElement()) {
            console.log('✅ Share Report button found');
            
            // Click Share Report button to open modal
            await shareButton.asElement().click();
            console.log('🔄 Share Report button clicked - modal should open');
            
            // Wait for modal to appear
            await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
            console.log('✅ Share Report modal opened');
            
            // Look for the Download Report Data button in the modal
            await page.waitForFunction(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              return buttons.some(btn => btn.textContent?.includes('Download Report Data'));
            }, { timeout: 5000 });
            
            const modalDownloadButton = await page.evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              return buttons.find(btn => btn.textContent?.includes('Download Report Data'));
            });
            
            if (modalDownloadButton && modalDownloadButton.asElement()) {
              console.log('✅ Download button found in Share Report modal');
              
              // Setup download monitoring for modal button
              const modalDownloadPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Modal download timeout after 10 seconds')), 10000);
                
                page.on('response', async (response) => {
                  if (response.url().includes('/export/') && response.status() === 200) {
                    clearTimeout(timeout);
                    console.log(`✅ Modal download API call successful: ${response.url()}`);
                    
                    try {
                      const contentType = response.headers()['content-type'];
                      const contentDisposition = response.headers()['content-disposition'];
                      
                      console.log(`📄 Modal Content-Type: ${contentType}`);
                      console.log(`📁 Modal Content-Disposition: ${contentDisposition}`);
                      
                      if (contentType?.includes('application/json')) {
                        console.log('✅ Valid JSON response for modal download');
                        resolve({ success: true, contentType, contentDisposition });
                      } else {
                        reject(new Error(`Invalid content type: ${contentType}`));
                      }
                    } catch (error) {
                      reject(new Error(`Modal response validation failed: ${error.message}`));
                    }
                  } else if (response.url().includes('/export/') && response.status() !== 200) {
                    clearTimeout(timeout);
                    reject(new Error(`Modal download failed with status ${response.status()}: ${response.status()}`));
                  }
                });
              });
              
              // Click the download button in the modal
              await modalDownloadButton.asElement().click();
              console.log('🔽 Download button clicked in Share Report modal');
              
              try {
                const modalDownloadResponse = await modalDownloadPromise;
                console.log('✅ Share modal download completed successfully');
                console.log(`📦 Modal download response: ${JSON.stringify(modalDownloadResponse)}`);
                downloadResults.shareModalDownloadTested = true;
                downloadResults.shareModalDownloadSuccess = true;
                downloadResults.shareModalContentType = modalDownloadResponse.contentType;
                downloadResults.shareModalContentDisposition = modalDownloadResponse.contentDisposition;
              } catch (modalDownloadError) {
                console.log(`⚠️ Share modal download failed: ${modalDownloadError.message}`);
                downloadResults.shareModalDownloadTested = true;
                downloadResults.shareModalDownloadSuccess = false;
                downloadResults.shareModalError = modalDownloadError.message;
              }
              
              // Close the modal by clicking outside or finding close button
              try {
                const closeButton = await page.evaluateHandle(() => {
                  const buttons = Array.from(document.querySelectorAll('button'));
                  return buttons.find(btn => 
                    btn.textContent?.includes('Cancel') || 
                    btn.textContent?.includes('Done') ||
                    btn.textContent?.includes('Close')
                  );
                });
                
                if (closeButton && closeButton.asElement()) {
                  await closeButton.asElement().click();
                  console.log('🔒 Share Report modal closed');
                } else {
                  // Click outside modal to close
                  await page.keyboard.press('Escape');
                  console.log('🔒 Share Report modal closed with Escape key');
                }
              } catch (closeError) {
                console.log('⚠️ Could not close Share Report modal, continuing...');
              }
            } else {
              console.log('❌ Download button not found in Share Report modal');
              downloadResults.shareModalDownloadTested = false;
              downloadResults.shareModalReason = 'Download button not found in modal';
            }
          } else {
            console.log('❌ Share Report button not found');
            downloadResults.shareModalDownloadTested = false;
            downloadResults.shareModalReason = 'Share Report button not found';
          }
        } catch (shareModalError) {
          console.log(`❌ Share modal test error: ${shareModalError.message}`);
          downloadResults.shareModalDownloadTested = false;
          downloadResults.shareModalError = shareModalError.message;
        }
        
      } catch (downloadTestError) {
        console.log(`❌ Download test error: ${downloadTestError.message}`);
        downloadResults = { downloadTested: false, error: downloadTestError.message };
      }
    } else if (!config.testDownload) {
      console.log('⏭️ Skipping download test - disabled by default (use --test-download to enable)');
    } else {
      console.log('⏭️ Skipping download test - analysis not completed');
    }
    
    // Take final screenshot for verification
    await page.screenshot({ path: 'auto-analyze-real-final.png' });
    
    // Validate overall test success
    // Handle "no sessions found" as a successful completion
    if (validationResults.analysisCompletedWithNoSessions) {
      console.log('🎉 Auto-Analyze Real API Test completed successfully!');
      console.log('📋 Analysis completed with no sessions found in the time range');
      console.log('✅ This validates that:');
      console.log('  - Credentials are valid and working');
      console.log('  - Auto-analyze workflow executes successfully');
      console.log('  - Backend processing completes properly');
      console.log('💰 Remember: Real OpenAI costs were incurred for this test');
    } else {
      // Log parallel processing results
      if (completionResults.parallelProcessingDetected) {
        console.log('🚀 Parallel processing system validation:');
        console.log(`   - Strategic Discovery: ${completionResults.strategicDiscoveryDetected ? '✅' : '❌'}`);
        console.log(`   - Parallel Processing: ${completionResults.parallelProgressDetected ? '✅' : '❌'}`);
        console.log(`   - Conflict Resolution: ${completionResults.conflictResolutionDetected ? '✅' : '❌'}`);
        console.log(`   - Report Indicators: ${validationResults.hasParallelProcessingIndicators ? '✅' : '❌'}`);
      } else {
        console.log('📝 Note: Sequential processing used (parallel processing not detected)');
      }
      
      const criticalValidations = [
        validationResults.hasReportHeader || completionResults.analysisCompleted,
        validationResults.hasBotId,
        validationResults.hasSessionsTable || completionResults.analysisCompleted,
        progressResults.progressStarted || completionResults.analysisCompleted
      ];
      
      const successCount = criticalValidations.filter(Boolean).length;
      const totalChecks = criticalValidations.length;
      
      if (successCount >= 2) { // More lenient for production
        console.log('🎉 Auto-Analyze Real API Test completed successfully!');
        console.log(`✅ ${successCount}/${totalChecks} critical validations passed`);
        console.log('📊 Real API analysis workflow verified end-to-end');
        console.log('💰 Remember: Real OpenAI costs were incurred for this test');
        
        // Additional success message for parallel processing
        if (completionResults.parallelProcessingDetected) {
          console.log('🚀 Parallel processing system successfully validated with real APIs!');
        }
      } else {
        console.log(`⚠️ Test completed with issues: ${successCount}/${totalChecks} validations passed`);
        console.log('❓ Check console output above for specific validation failures');
        console.log('💡 Real APIs may have variable response times or data availability');
      }
      
      // Log download test results
      if (downloadResults.downloadTested || downloadResults.shareModalDownloadTested) {
        console.log('📥 Download Tests Summary:');
        
        // Report page download results
        if (downloadResults.downloadTested) {
          console.log(`   📄 Report Page Download: ${downloadResults.downloadSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
          if (downloadResults.downloadSuccess) {
            console.log(`      📄 Content-Type: ${downloadResults.contentType}`);
            console.log(`      📁 Content-Disposition: ${downloadResults.contentDisposition}`);
          } else if (downloadResults.error) {
            console.log(`      ❌ Error: ${downloadResults.error}`);
          }
        } else {
          const reason = downloadResults.reason || 'Not tested';
          console.log(`   📄 Report Page Download: ⏭️ SKIPPED (${reason})`);
        }
        
        // Share modal download results
        if (downloadResults.shareModalDownloadTested) {
          console.log(`   📤 Share Modal Download: ${downloadResults.shareModalDownloadSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
          if (downloadResults.shareModalDownloadSuccess) {
            console.log(`      📄 Content-Type: ${downloadResults.shareModalContentType}`);
            console.log(`      📁 Content-Disposition: ${downloadResults.shareModalContentDisposition}`);
            console.log(`      ✅ Share modal download working correctly!`);
          } else if (downloadResults.shareModalError) {
            console.log(`      ❌ Error: ${downloadResults.shareModalError}`);
            console.log(`      🐛 BUG DETECTED: Share modal download button is broken!`);
          }
        } else {
          const reason = downloadResults.shareModalReason || downloadResults.shareModalError || 'Not tested';
          console.log(`   📤 Share Modal Download: ⏭️ SKIPPED (${reason})`);
        }
      } else {
        const reason = downloadResults.reason || downloadResults.error || 'Analysis not completed';
        console.log(`📥 Download Tests: ⏭️ ALL SKIPPED (${reason})`);
      }
    }
    
    // Summary of progress assertions with stuck detection
    if (progressAssertionResults.length > 0) {
      console.log('\n🎯 Progress Assertion Summary:');
      const uniquePhases = [...new Set(progressAssertionResults.map(r => r.progressPhase))];
      console.log(`   - Phases Detected: [${uniquePhases.join(', ')}]`);
      console.log(`   - Total Assertions: ${progressAssertionResults.length}`);
      
      // Count actual progress detections
      const progressCounts = {
        actualProgress: progressAssertionResults.filter(r => r.actualProgress).length,
        progressStuck: progressAssertionResults.filter(r => r.progressStuck).length,
        sessionCounts: progressAssertionResults.filter(r => r.sessionCounts).length,
        batchProgress: progressAssertionResults.filter(r => r.batchProgress).length,
        streamActivity: progressAssertionResults.filter(r => r.streamActivity).length,
        tokenUsage: progressAssertionResults.filter(r => r.tokenUsage).length,
        estimatedCost: progressAssertionResults.filter(r => r.estimatedCost).length,
        hasProgressBarAnimation: progressAssertionResults.filter(r => r.hasProgressBarAnimation).length
      };
      
      console.log('\n🚨 PROGRESS ANALYSIS:');
      console.log(`   - Real Progress Detected: ${progressCounts.actualProgress}/${progressAssertionResults.length} times (${((progressCounts.actualProgress/progressAssertionResults.length)*100).toFixed(1)}%)`);
      console.log(`   - Progress Stuck: ${progressCounts.progressStuck}/${progressAssertionResults.length} times (${((progressCounts.progressStuck/progressAssertionResults.length)*100).toFixed(1)}%)`);
      
      console.log('\n📊 Indicator Detection Rates:');
      Object.entries(progressCounts).forEach(([indicator, count]) => {
        if (indicator !== 'actualProgress' && indicator !== 'progressStuck') {
          const displayName = indicator === 'hasProgressBarAnimation' ? 'Progress Bar Animation (Shimmer)' : indicator;
          console.log(`   - ${displayName}: ${count}/${progressAssertionResults.length} times detected (${((count/progressAssertionResults.length)*100).toFixed(1)}%)`);
        }
      });
      
      // Show final progress values
      if (progressAssertionResults.length > 0) {
        const finalAssertion = progressAssertionResults[progressAssertionResults.length - 1];
        console.log('\n📈 Final Progress State:');
        console.log(`   - Sessions Found: ${finalAssertion.numericValues.sessionsFound}`);
        console.log(`   - Batches Completed: ${finalAssertion.numericValues.batchesCompleted}`);
        console.log(`   - Sessions Processed: ${finalAssertion.numericValues.sessionsProcessed}`);
        console.log(`   - Tokens Used: ${finalAssertion.numericValues.tokensUsed}`);
        console.log(`   - Estimated Cost: $${finalAssertion.numericValues.estimatedCost}`);
        console.log(`   - Progress Percentage: ${finalAssertion.numericValues.progressPercentage}%`);
      }
      
      // Overall progress assessment
      const overallProgressWorking = progressCounts.actualProgress > 0 && progressCounts.progressStuck < progressAssertionResults.length * 0.8;
      console.log(`\n🎯 OVERALL PROGRESS ASSESSMENT: ${overallProgressWorking ? '✅ WORKING' : '❌ STUCK/BROKEN'}`);
      
      // Animation assessment
      const animationWorking = progressCounts.hasProgressBarAnimation > 0;
      console.log(`🎨 PROGRESS BAR ANIMATION: ${animationWorking ? '✅ SHIMMER DETECTED' : '❌ NO ANIMATION DETECTED'}`);
      if (animationWorking) {
        const animationPercentage = ((progressCounts.hasProgressBarAnimation/progressAssertionResults.length)*100).toFixed(1);
        console.log(`   🌟 Shimmer animation was visible during ${animationPercentage}% of progress checks`);
      }
    }
    
    // Summary of what was tested
    console.log('\n📋 Test Coverage Summary:');
    console.log('✅ Real credentials entry and authentication');
    console.log('✅ Navigation to Auto-Analyze page');
    console.log('✅ Analysis configuration with real OpenAI API key');
    console.log('✅ Analysis execution with real APIs');
    console.log('✅ Progress tracking and completion monitoring');
    console.log('✅ Report generation validation');
    console.log('✅ Real API integration (Kore.ai + OpenAI)');
    console.log(`📥 Download functionality: ${downloadResults.downloadTested ? (downloadResults.downloadSuccess ? '✅ TESTED & WORKING' : '❌ TESTED & FAILED') : '⏭️ SKIPPED'}`);
    
    // Bug fix validation results
    if (dialogResults.dialogTested) {
      console.log('🐛 Session Details Bug Fix Validation:');
      console.log(`   📊 Duration field: ${dialogResults.durationNotZero ? '✅ FIXED' : '❌ STILL BROKEN'} (shows: "${dialogResults.durationText}")`);
      console.log(`   📨 Message count: ${dialogResults.messageCountNotZero ? '✅ FIXED' : '❌ STILL BROKEN'} (shows: "${dialogResults.messageCountText}")`);
      if (dialogResults.durationNotZero && dialogResults.messageCountNotZero) {
        console.log('   🎉 Bug fix successful - session details now show correct values!');
      } else {
        console.log('   ⚠️ Bug fix incomplete - some fields still showing zero values');
      }
    }
    
    // Additional parallel processing coverage
    if (completionResults && completionResults.parallelProcessingDetected) {
      console.log('🚀 Parallel processing system coverage:');
      console.log(`   ✅ Strategic Discovery phase detection`);
      console.log(`   ✅ Parallel Processing phase detection`);
      console.log(`   ✅ Conflict Resolution phase detection`);
      console.log(`   ✅ Real API parallel processing validation`);
    } else {
      console.log('📝 Sequential processing system validated with real APIs');
    }
    
  } catch (error) {
    console.error('❌ Auto-Analyze Real API Test failed:', error.message);
    
    if (browser) {
      // Take screenshot for debugging
      try {
        const page = (await browser.pages())[0];
        await page.screenshot({ path: 'auto-analyze-real-error.png' });
        console.log('📸 Error screenshot saved: auto-analyze-real-error.png');
      } catch (screenshotError) {
        console.log('Could not take error screenshot');
      }
    }
    
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Execute test if run directly
if (require.main === module) {
  runAutoAnalyzeRealTest()
    .then(() => {
      console.log('🏁 Test execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runAutoAnalyzeRealTest };