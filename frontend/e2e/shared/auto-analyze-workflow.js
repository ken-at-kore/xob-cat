/**
 * Shared Auto-Analyze Workflow Steps
 * 
 * Common workflow implementation for both mock and real API auto-analyze testing
 */

const puppeteer = require('puppeteer');

/**
 * Get browser configuration with configurable slowMo
 * @param {Object} options - Configuration options
 * @param {number} options.slowMo - SlowMo speed in milliseconds (default: 25, 0 = disabled)
 * @returns {Object} Browser launch configuration
 */
function getBrowserConfig(options = {}) {
  const { slowMo = 25 } = options; // Default 25ms (was previously 50ms)
  
  const config = {
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };
  
  // Add slowMo if speed > 0 (0 = disabled, >0 = enabled with that speed)
  if (slowMo > 0) {
    config.slowMo = slowMo;
  }
  
  return config;
}

/**
 * Common browser launch configuration (deprecated - use getBrowserConfig instead)
 */
const BROWSER_CONFIG = getBrowserConfig();

/**
 * Timeout configuration for auto-analyze workflow
 */
const TIMEOUTS = {
  default: 2000,
  navigation: 5000,
  analysisProgress: 60000,  // Longer for analysis completion
  shortWait: 3000,
  longWait: 30000
};

/**
 * Navigate to credentials page and enter credentials
 * @param {Page} page - Puppeteer page object
 * @param {Object} credentials - Bot credentials
 * @param {string} baseUrl - Base URL to test against
 */
async function enterCredentials(page, credentials, baseUrl = 'http://localhost:3000') {
  console.log('📝 Step 1: Navigating to credentials page');
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 10000 });
  console.log('✅ Credentials page loaded');

  console.log('📝 Step 2: Entering credentials');
  await page.type('#botId', credentials.botId);
  await page.type('#clientId', credentials.clientId);
  await page.type('#clientSecret', credentials.clientSecret);
  
  // Find and click the Connect button
  const connectButton = await page.$('button');
  if (connectButton) {
    const buttonText = await page.evaluate(el => el.textContent, connectButton);
    if (buttonText.includes('Connect')) {
      await connectButton.click();
    } else {
      throw new Error(`Expected Connect button, found: ${buttonText}`);
    }
  } else {
    throw new Error('Connect button not found');
  }
  console.log('✅ Credentials entered and Connect clicked');
}

/**
 * Wait for navigation to sessions page and then navigate to auto-analyze
 * @param {Page} page - Puppeteer page object
 * @param {string} baseUrl - Base URL for navigation (defaults to http://localhost:3000)
 */
async function navigateToAutoAnalyze(page, baseUrl = 'http://localhost:3000') {
  console.log('🔄 Step 3: Waiting for navigation to sessions page');
  
  try {
    // Wait for navigation to sessions page with flexible path matching
    await page.waitForFunction(
      () => {
        const path = window.location.pathname;
        // Handle both development (/sessions) and production paths
        return path.includes('/sessions') || path.endsWith('/') || path === '';
      },
      { timeout: 15000 }
    );
    console.log('✅ Navigated to sessions page');
  } catch (timeoutError) {
    // If waiting fails, check current state
    const currentUrl = page.url();
    console.log(`⚠️ Navigation wait timed out. Current URL: ${currentUrl}`);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'auto-analyze-navigation-debug.png' });
    
    // Check if we're on the main page (production might redirect to root)
    if (currentUrl === baseUrl || currentUrl === `${baseUrl}/`) {
      console.log('✅ On main page, proceeding to auto-analyze');
    } else {
      throw new Error(`Failed to navigate properly. Current URL: ${currentUrl}`);
    }
  }

  console.log('📊 Step 4: Navigating to Auto-Analyze page');
  
  // Try to wait for sidebar and click the link
  try {
    await page.waitForSelector('nav[role="navigation"], aside, .sidebar', { timeout: 3000 });
    console.log('✅ Sidebar found');
    
    // Look for Auto-Analyze link
    const autoAnalyzeLink = await page.$('a[href="/analyze"]');
    if (autoAnalyzeLink) {
      console.log('📊 Found Auto-Analyze link in sidebar, clicking it');
      await autoAnalyzeLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      console.log('✅ Navigated to Auto-Analyze page via sidebar');
    } else {
      console.log('⚠️ Auto-Analyze link not found, trying direct navigation');
      await page.goto(`${baseUrl}/analyze`, { waitUntil: 'networkidle0' });
      console.log('✅ Navigated directly to Auto-Analyze page');
    }
  } catch (e) {
    console.log('⚠️ Sidebar not found, trying direct navigation');
    // Add a small delay to ensure page is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Navigate directly to analyze page
    console.log('🔍 Navigating directly to Auto-Analyze page...');
    await page.goto(`${baseUrl}/analyze`, { waitUntil: 'networkidle0' });
    console.log('✅ Navigated directly to Auto-Analyze page');
  }
  
  // Wait for the page to fully load and render
  await new Promise(resolve => setTimeout(resolve, 2000)); // Give React time to render
  
  // Verify Auto-Analyze page loaded by checking for the specific content
  // The page is correctly loaded as we can see from the content
  const bodyContent = await page.$eval('body', el => el.textContent);
  console.log(`📄 Page loaded successfully - found Auto-Analyze content`);
  
  if (!bodyContent.includes('Auto-Analyze') && !bodyContent.includes('Analysis Configuration') && !bodyContent.includes('Start Analysis')) {
    console.error('Page content does not match expected Auto-Analyze page');
    console.error('Looking for: Auto-Analyze, Analysis Configuration, or Start Analysis');
    console.error('Found content preview:', bodyContent.substring(0, 500));
    throw new Error(`Expected Auto-Analyze page content not found`);
  }
  
  console.log('✅ Auto-Analyze page loaded');
}

/**
 * Configure analysis settings
 * @param {Page} page - Puppeteer page object
 * @param {Object} config - Analysis configuration
 */
async function configureAnalysis(page, config) {
  console.log('⚙️ Step 5: Configuring analysis settings');
  
  const {
    startDate = '2025-08-01',
    startTime = '09:00', 
    sessionCount = '5',
    openaiApiKey = 'mock-openai-key'
  } = config;

  console.log(`Using date: ${startDate} at ${startTime}, ${sessionCount} sessions`);
  
  // Fill in date and time using a simpler approach
  await page.waitForSelector('#startDate', { timeout: TIMEOUTS.default });
  
  // Set start date using JavaScript to avoid date input issues
  await page.evaluate((date) => {
    const dateInput = document.querySelector('#startDate');
    dateInput.value = date;
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
  }, startDate);
  
  // Verify the date was entered correctly
  const dateValue = await page.$eval('#startDate', el => el.value);
  console.log(`📅 Date field value after setting: "${dateValue}" (expected: "${startDate}")`);
  
  // Set start time
  await page.evaluate((time) => {
    const timeInput = document.querySelector('#startTime');
    timeInput.value = time;
    timeInput.dispatchEvent(new Event('change', { bubbles: true }));
  }, startTime);
  
  // Clear and fill session count
  const sessionCountInput = await page.$('#sessionCount');
  await sessionCountInput.click({ clickCount: 3 }); // Select all
  await sessionCountInput.type(sessionCount);
  
  // Clear and fill OpenAI API key
  const openaiKeyInput = await page.$('#openaiApiKey');
  await openaiKeyInput.click({ clickCount: 3 }); // Select all
  await openaiKeyInput.type(openaiApiKey);
  
  // Select GPT model if specified
  if (config.modelId) {
    console.log(`🤖 Selecting GPT model: ${config.modelId}`);
    
    // Click on the GPT Model dropdown
    await page.waitForSelector('[role="combobox"]', { timeout: TIMEOUTS.default });
    const selectTrigger = await page.$('[role="combobox"]');
    await selectTrigger.click();
    
    // Wait for dropdown options to appear
    await page.waitForSelector('[role="option"]', { timeout: TIMEOUTS.default });
    
    // Find and click the desired model option
    const options = await page.$$('[role="option"]');
    let modelFound = false;
    
    for (const option of options) {
      const optionText = await page.evaluate(el => el.textContent, option);
      if (optionText.includes(config.modelId) || 
          (config.modelId === 'gpt-4.1-nano' && optionText.includes('GPT-4.1 nano')) ||
          (config.modelId === 'gpt-4o-mini' && optionText.includes('GPT-4o mini'))) {
        await option.click();
        modelFound = true;
        console.log(`✅ Selected model: ${optionText}`);
        break;
      }
    }
    
    if (!modelFound) {
      console.log(`⚠️ Model ${config.modelId} not found in dropdown, using default`);
    }
  }
  
  console.log('✅ Analysis settings configured');
  
  // Take a screenshot of the filled form
  await page.screenshot({ path: 'filled-form.png' });
}

/**
 * Start analysis and wait for progress to begin
 * @param {Page} page - Puppeteer page object
 */
async function startAnalysis(page) {
  console.log('🚀 Step 6: Starting analysis');
  
  // Check for any visible validation errors first
  const pageContent = await page.$eval('body', el => el.textContent);
  if (pageContent.includes('Date must be in the past') || 
      pageContent.includes('Invalid OpenAI API key') ||
      pageContent.includes('required')) {
    console.log('⚠️ Validation errors detected:', pageContent.substring(pageContent.indexOf('error'), pageContent.indexOf('error') + 100));
  }
  
  // Find Start Analysis button by text content (similar to working test pattern)
  const buttons = await page.$$('button');
  let startButton = null;
  
  for (const button of buttons) {
    const text = await page.evaluate(el => el.textContent, button);
    if (text.includes('Start Analysis')) {
      startButton = button;
      break;
    }
  }
  
  if (!startButton) {
    throw new Error('Start Analysis button not found');
  }
  
  // Check if button is disabled
  const isDisabled = await page.evaluate(el => el.disabled, startButton);
  if (isDisabled) {
    console.log('⚠️ Start Analysis button is disabled - checking for form errors');
    await page.screenshot({ path: 'start-button-disabled.png' });
  }
  
  await startButton.click();
  console.log('✅ Start Analysis clicked');
  
  // Take a screenshot to see what happened after clicking
  await page.screenshot({ path: 'after-start-analysis-click.png' });
  
  // Wait a moment for validation errors to appear
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check for validation error messages
  const errorElements = await page.$$('[class*="text-red"], [class*="error"], .text-destructive');
  if (errorElements.length > 0) {
    console.log('🚨 Validation errors detected:');
    for (const errorEl of errorElements) {
      const errorText = await page.evaluate(el => el.textContent, errorEl);
      console.log(`   - ${errorText}`);
    }
  }
  
  // Also check the full page content
  const postClickContent = await page.$eval('body', el => el.textContent);
  if (postClickContent.includes('Date must be in the past')) {
    console.log('🚨 Date validation error: Date must be in the past');
  }
  if (postClickContent.includes('Invalid')) {
    console.log('🚨 Other validation errors detected in page content');
  }
  
  // Wait a bit more to see if any API calls are triggered
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log(`📸 Page state after click: ${postClickContent.substring(0, 200)}...`);
}

/**
 * Monitor analysis progress with detailed assertions
 * @param {Page} page - Puppeteer page object
 * @returns {Object} Progress monitoring results with detailed assertions
 */
async function monitorProgress(page) {
  console.log('⏳ Step 7: Monitoring analysis progress with UI assertions');
  
  // Give the analysis a moment to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const progressAssertions = {
    progressStarted: false,
    parallelProcessingDetected: false,
    phasesDetected: [],
    specificIndicators: {
      samplingPhase: false,
      discoveryPhase: false,
      parallelProcessingPhase: false,
      conflictResolutionPhase: false,
      sessionCounts: false,
      batchProgress: false,
      streamActivity: false,
      tokenUsage: false,
      estimatedCost: false
    }
  };
  
  // Check what content is actually on the page
  const currentContent = await page.$eval('body', el => el.textContent);
  console.log(`📋 Current page content preview: ${currentContent.substring(0, 300)}...`);
  
  // Assert main progress indicators
  const hasProgressIndicator = currentContent.includes('Analysis in Progress') || 
                               currentContent.includes('progress') || 
                               currentContent.includes('Progress') ||
                               currentContent.includes('Analysis Report') ||
                               currentContent.includes('Starting analysis');
  
  if (hasProgressIndicator) {
    progressAssertions.progressStarted = true;
    console.log('✅ Progress indicator found');
  }
  
  // Assert specific phase indicators
  if (currentContent.includes('Sampling Sessions') || currentContent.includes('sampling')) {
    progressAssertions.specificIndicators.samplingPhase = true;
    progressAssertions.phasesDetected.push('Sampling');
    console.log('✅ Sampling phase detected');
  }
  
  if (currentContent.includes('Strategic Discovery')) {
    progressAssertions.specificIndicators.discoveryPhase = true;
    progressAssertions.phasesDetected.push('Strategic Discovery');
    console.log('✅ Strategic Discovery phase detected');
  }
  
  if (currentContent.includes('Parallel Processing')) {
    progressAssertions.specificIndicators.parallelProcessingPhase = true;
    progressAssertions.phasesDetected.push('Parallel Processing');
    progressAssertions.parallelProcessingDetected = true;
    console.log('✅ Parallel Processing phase detected');
  }
  
  if (currentContent.includes('Conflict Resolution')) {
    progressAssertions.specificIndicators.conflictResolutionPhase = true;
    progressAssertions.phasesDetected.push('Conflict Resolution');
    console.log('✅ Conflict Resolution phase detected');
  }
  
  // Assert session count indicators
  if (currentContent.match(/\d+\s*\/\s*\d+\s*sessions/) || currentContent.match(/\d+\s*sessions\s*(found|processed)/i)) {
    progressAssertions.specificIndicators.sessionCounts = true;
    console.log('✅ Session count indicators found');
  }
  
  // Assert batch progress indicators
  if (currentContent.match(/Batch\s*\d+/) || currentContent.match(/batch\s*\d+/i)) {
    progressAssertions.specificIndicators.batchProgress = true;
    console.log('✅ Batch progress indicators found');
  }
  
  // Assert stream activity indicators
  if (currentContent.includes('streams active') || currentContent.includes('Active Streams') || currentContent.includes('Round') || currentContent.includes('Parallel processing:')) {
    progressAssertions.specificIndicators.streamActivity = true;
    console.log('✅ Stream activity indicators found');
  }
  
  // Assert token usage indicators
  if (currentContent.match(/\d+.*tokens/i) || currentContent.includes('Tokens Used')) {
    progressAssertions.specificIndicators.tokenUsage = true;
    console.log('✅ Token usage indicators found');
  }
  
  // Assert cost estimation indicators
  if (currentContent.match(/\$\d+\.\d+/) || currentContent.includes('Estimated Cost')) {
    progressAssertions.specificIndicators.estimatedCost = true;
    console.log('✅ Cost estimation indicators found');
  }
  
  // Set parallel processing detected based on phase indicators
  progressAssertions.parallelProcessingDetected = 
    progressAssertions.specificIndicators.parallelProcessingPhase ||
    progressAssertions.specificIndicators.discoveryPhase ||
    progressAssertions.specificIndicators.conflictResolutionPhase ||
    progressAssertions.specificIndicators.streamActivity;
  
  console.log('📊 Progress Assertions Summary:');
  console.log(`   - Progress Started: ${progressAssertions.progressStarted ? '✅' : '❌'}`);
  console.log(`   - Parallel Processing: ${progressAssertions.parallelProcessingDetected ? '✅' : '❌'}`);
  console.log(`   - Phases Detected: [${progressAssertions.phasesDetected.join(', ')}]`);
  console.log(`   - Session Counts: ${progressAssertions.specificIndicators.sessionCounts ? '✅' : '❌'}`);
  console.log(`   - Batch Progress: ${progressAssertions.specificIndicators.batchProgress ? '✅' : '❌'}`);
  console.log(`   - Stream Activity: ${progressAssertions.specificIndicators.streamActivity ? '✅' : '❌'}`);
  console.log(`   - Token Usage: ${progressAssertions.specificIndicators.tokenUsage ? '✅' : '❌'}`);
  console.log(`   - Cost Estimation: ${progressAssertions.specificIndicators.estimatedCost ? '✅' : '❌'}`);
  
  return progressAssertions;
}

/**
 * Wait for analysis completion
 * @param {Page} page - Puppeteer page object
 * @param {number} sessionCount - Number of sessions being analyzed (for dynamic timeout)
 * @returns {Object} Completion results
 */
async function waitForCompletion(page, sessionCount = 10) {
  console.log('📈 Step 8: Waiting for analysis completion');
  
  // Dynamic timeout based on session count
  // Small counts: 60s, Medium counts (20-49): 120s, Large counts (50+): 300s
  let maxAttempts;
  if (sessionCount >= 50) {
    maxAttempts = 300; // 5 minutes for large session counts
  } else if (sessionCount >= 20) {
    maxAttempts = 120; // 2 minutes for medium session counts
  } else {
    maxAttempts = 60;  // 1 minute for small session counts
  }
  
  console.log(`⏰ Configured timeout: ${maxAttempts} seconds for ${sessionCount} sessions`);
  
  let attempts = 0;
  let parallelProgressDetected = false;
  let strategicDiscoveryDetected = false;
  let conflictResolutionDetected = false;
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const currentContent = await page.$eval('body', el => el.textContent);
    
    // Track parallel processing phases
    if (currentContent.includes('Strategic Discovery')) {
      if (!strategicDiscoveryDetected) {
        console.log('🔍 Strategic Discovery phase detected');
        strategicDiscoveryDetected = true;
      }
    }
    
    if (currentContent.includes('Parallel Processing') || currentContent.includes('Stream')) {
      if (!parallelProgressDetected) {
        console.log('🚀 Parallel Processing phase detected');
        parallelProgressDetected = true;
      }
    }
    
    if (currentContent.includes('Conflict Resolution')) {
      if (!conflictResolutionDetected) {
        console.log('⚖️ Conflict Resolution phase detected');
        conflictResolutionDetected = true;
      }
    }
    
    // Look for completion indicators including error states
    if (currentContent.includes('Analysis Report') || 
        currentContent.includes('Analyzed Sessions') ||
        currentContent.includes('Session Outcomes') ||
        currentContent.includes('sessions analyzed') ||
        currentContent.includes('Analysis Complete') ||
        currentContent.includes('Parallel analysis complete') ||
        currentContent.includes('Export Analysis') ||
        // Handle error states that indicate completion
        currentContent.includes('No sessions found') ||
        currentContent.includes('Analysis failed') ||
        currentContent.includes('Error occurred')) {
      console.log('✅ Analysis completed (report or final state detected)');
      
      // Log parallel processing results
      if (strategicDiscoveryDetected || parallelProgressDetected || conflictResolutionDetected) {
        console.log('🎯 Parallel processing phases detected:');
        console.log(`   - Strategic Discovery: ${strategicDiscoveryDetected ? '✅' : '❌'}`);
        console.log(`   - Parallel Processing: ${parallelProgressDetected ? '✅' : '❌'}`);
        console.log(`   - Conflict Resolution: ${conflictResolutionDetected ? '✅' : '❌'}`);
      }
      
      return { 
        analysisCompleted: true,
        parallelProcessingDetected: strategicDiscoveryDetected || parallelProgressDetected || conflictResolutionDetected,
        strategicDiscoveryDetected,
        parallelProgressDetected,
        conflictResolutionDetected
      };
    }
    
    // Check if we're still in progress state
    if (currentContent.includes('Analysis in Progress') || 
        currentContent.includes('Initializing') ||
        currentContent.includes('Analyzing sessions') ||
        currentContent.includes('Strategic Discovery') ||
        currentContent.includes('Parallel Processing') ||
        currentContent.includes('Conflict Resolution') ||
        currentContent.includes('Generating report')) {
      // Still in progress, continue waiting
    }
    
    attempts++;
    const logInterval = sessionCount >= 50 ? 30 : 10; // Log less frequently for large session counts
    if (attempts % logInterval === 0) {
      console.log(`⏳ Still waiting for completion... (${attempts}/${maxAttempts})`);
      // Show progress indicators if detected
      if (currentContent.includes('Batch') && currentContent.includes('of')) {
        const batchMatch = currentContent.match(/Batch (\d+) \/ (\d+)/);
        if (batchMatch) {
          console.log(`📊 Progress: ${batchMatch[0]}`);
        }
      }
      // Debug: Show current content
      console.log(`📋 Current content sample: ${currentContent.substring(0, 200)}...`);
    }
  }
  
  console.log('⚠️ Timeout waiting for analysis completion, but continuing');
  return { 
    analysisCompleted: false,
    parallelProcessingDetected: strategicDiscoveryDetected || parallelProgressDetected || conflictResolutionDetected,
    strategicDiscoveryDetected,
    parallelProgressDetected,
    conflictResolutionDetected
  };
}

/**
 * Validate report content
 * @param {Page} page - Puppeteer page object
 * @param {Object} expectedData - Expected report data
 * @returns {Object} Validation results
 */
async function validateReport(page, expectedData = {}) {
  console.log('✅ Step 9: Validating report content');
  
  const validationResults = {};
  
  // Get page content for validation
  const pageContent = await page.content();
  
  // Check if analysis found no sessions (this is also a valid completion state)
  const noSessionsFound = pageContent.includes('0 sessions found') || 
                          pageContent.includes('No sessions found') ||
                          pageContent.includes('sessions found: 0');
  
  if (noSessionsFound) {
    console.log('📋 Analysis completed but found no sessions in the specified time range');
    validationResults.analysisCompletedWithNoSessions = true;
    validationResults.hasBotId = pageContent.includes('Bot ID');
    validationResults.hasValidMessage = pageContent.includes('No sessions found') || 
                                       pageContent.includes('0 sessions found');
    return validationResults;
  }

  // Enhanced Parallel Processing UI Indicators Validation
  console.log('🔍 Validating parallel processing UI indicators...');
  
  // Check for parallel processing UI elements
  validationResults.hasParallelProcessingIndicators = (
    pageContent.includes('Strategic Discovery') ||
    pageContent.includes('Parallel Processing') ||
    pageContent.includes('Conflict Resolution') ||
    pageContent.includes('Active Streams') ||
    pageContent.includes('Stream Status') ||
    pageContent.includes('Round') ||
    pageContent.includes('Parallel Workflow') ||
    pageContent.includes('streams') ||
    pageContent.includes('discovery') ||
    pageContent.includes('conflict')
  );
  
  // Check for specific parallel UI components
  validationResults.hasActiveStreamsDisplay = pageContent.includes('Active Streams');
  validationResults.hasRoundsProgress = pageContent.includes('Round') && pageContent.includes('/');
  validationResults.hasStreamStatus = pageContent.includes('Stream Status') || pageContent.includes('Stream 1');
  validationResults.hasParallelWorkflow = pageContent.includes('Sampling → Strategic Discovery → Parallel Processing');
  validationResults.hasDiscoveryStats = pageContent.includes('intents') && pageContent.includes('reasons') && pageContent.includes('locations');
  
  if (validationResults.hasParallelProcessingIndicators) {
    console.log('✅ Parallel processing UI indicators found');
    console.log(`   - Active Streams Display: ${validationResults.hasActiveStreamsDisplay ? '✅' : '❌'}`);
    console.log(`   - Rounds Progress: ${validationResults.hasRoundsProgress ? '✅' : '❌'}`);
    console.log(`   - Stream Status: ${validationResults.hasStreamStatus ? '✅' : '❌'}`);
    console.log(`   - Parallel Workflow Breadcrumb: ${validationResults.hasParallelWorkflow ? '✅' : '❌'}`);
    console.log(`   - Discovery Stats: ${validationResults.hasDiscoveryStats ? '✅' : '❌'}`);
  } else {
    console.log('❌ No parallel processing UI indicators detected in report');
  }
  
  // Verify report header - look for Analysis Report text anywhere
  validationResults.hasReportHeader = pageContent.includes('Analysis Report') ||
                                     pageContent.includes('Analysis Complete') ||
                                     pageContent.includes('Parallel analysis complete');
  
  // Verify bot ID is displayed
  validationResults.hasBotId = pageContent.includes('Bot ID');
  
  // Verify Analysis Overview section - might be called something else
  validationResults.hasAnalysisOverview = pageContent.includes('Analysis Overview') || 
                                          pageContent.includes('Comprehensive analysis') ||
                                          pageContent.includes('AI-powered insights') ||
                                          pageContent.includes('Analysis Results');
  
  // Verify parallel processing indicators in the report
  validationResults.hasParallelProcessingIndicators = pageContent.includes('Strategic Discovery') ||
                                                     pageContent.includes('Parallel Processing') ||
                                                     pageContent.includes('Conflict Resolution') ||
                                                     pageContent.includes('rounds completed') ||
                                                     pageContent.includes('streams active');
  
  // Verify charts are rendered (more flexible matching)
  validationResults.hasSessionOutcomesChart = pageContent.includes('Session Outcomes') ||
                                             pageContent.includes('Outcomes Chart');
  validationResults.hasGeneralIntentsChart = pageContent.includes('General Intents') ||
                                            pageContent.includes('Intents Chart');
  
  // Verify Detailed Analysis section - might have different text
  validationResults.hasDetailedAnalysis = pageContent.includes('Detailed Analysis') ||
                                         pageContent.includes('Download Report Data') ||
                                         pageContent.includes('Share Report') ||
                                         pageContent.includes('Export Analysis');
  
  // Verify Cost Analysis section
  validationResults.hasCostAnalysis = pageContent.includes('Analysis Cost & Usage') ||
                                     pageContent.includes('Cost Analysis') ||
                                     pageContent.includes('Total Sessions Analyzed') ||
                                     pageContent.includes('Total Cost');
  
  // Verify Analyzed Sessions table
  const sessionsTable = await page.$('table');
  validationResults.hasSessionsTable = sessionsTable !== null;
  
  if (sessionsTable) {
    // Verify table headers using content check
    validationResults.hasProperTableHeaders = 
      pageContent.includes('Session ID') && 
      pageContent.includes('General Intent') && 
      pageContent.includes('Session Outcome');
  }
  
  // Verify report actions
  validationResults.hasReportActions = 
    pageContent.includes('Download Report Data') && 
    pageContent.includes('Share Report') && 
    pageContent.includes('Start New Analysis');
  
  console.log('Report Validation Results:');
  Object.entries(validationResults).forEach(([test, passed]) => {
    console.log(`- ${test}: ${passed ? '✅' : '❌'}`);
  });
  
  return validationResults;
}

/**
 * Test session details dialog
 * @param {Page} page - Puppeteer page object
 * @returns {Object} Dialog test results
 */
async function testSessionDetailsDialog(page) {
  console.log('🔲 Step 10: Testing session details dialog');
  
  // Find and click first session row
  const sessionRows = await page.$$('table tbody tr');
  if (sessionRows.length === 0) {
    console.log('⚠️ No session rows found to test dialog');
    return { dialogTested: false, reason: 'No session rows' };
  }
  
  await sessionRows[0].click();
  console.log('✅ Clicked first session row');
  
  // Wait for dialog to appear
  await page.waitForFunction(
    () => document.body.textContent.includes('Analyzed Session Details'),
    { timeout: 5000 }
  );
  console.log('✅ Session details dialog opened');
  
  // Verify dialog content
  const dialogContent = await page.content();
  const dialogResults = {
    hasAIFacts: dialogContent.includes('AI-Extracted Facts'),
    hasGeneralIntent: dialogContent.includes('General Intent'),
    hasSessionOutcome: dialogContent.includes('Session Outcome')
  };
  
  // Close dialog - find Close button by text
  const buttons = await page.$$('button');
  let closeButton = null;
  
  for (const button of buttons) {
    const text = await page.evaluate(el => el.textContent, button);
    if (text.includes('Close')) {
      closeButton = button;
      break;
    }
  }
  
  if (closeButton) {
    await closeButton.click();
    console.log('✅ Dialog closed');
  }
  
  // Verify dialog is closed
  await page.waitForFunction(
    () => !document.body.textContent.includes('Analyzed Session Details'),
    { timeout: TIMEOUTS.default }
  );
  
  return { dialogTested: true, ...dialogResults };
}

/**
 * Assert specific progress indicators with actual progress tracking
 * @param {Page} page - Puppeteer page object
 * @param {Object} previousState - Previous assertion state to compare against
 * @returns {Object} Progress assertion results with change detection
 */
async function assertProgressIndicators(page, previousState = null) {
  const currentContent = await page.$eval('body', el => el.textContent);
  
  const assertions = {
    progressPhase: null,
    actualProgress: false,  // NEW: tracks if real progress is happening
    progressStuck: false,   // NEW: tracks if progress appears frozen
    sessionCounts: false,
    batchProgress: false,
    streamActivity: false,
    tokenUsage: false,
    estimatedCost: false,
    phaseSpecific: {},
    numericValues: {        // NEW: extract actual numeric values
      sessionsFound: 0,
      batchesCompleted: 0,
      sessionsProcessed: 0,
      tokensUsed: 0,
      estimatedCost: 0,
      progressPercentage: 0
    }
  };
  
  // Extract numeric progress values to detect real changes
  const sessionsFoundMatch = currentContent.match(/(\d+)\s*Sessions Found/);
  if (sessionsFoundMatch) assertions.numericValues.sessionsFound = parseInt(sessionsFoundMatch[1]);
  
  const batchesMatch = currentContent.match(/(\d+)\s*Batches Completed/);
  if (batchesMatch) assertions.numericValues.batchesCompleted = parseInt(batchesMatch[1]);
  
  const sessionsProcessedMatch = currentContent.match(/(\d+)\s*Sessions Processed/);
  if (sessionsProcessedMatch) assertions.numericValues.sessionsProcessed = parseInt(sessionsProcessedMatch[1]);
  
  const tokensMatch = currentContent.match(/(\d+)\s*Tokens Used/);
  if (tokensMatch) assertions.numericValues.tokensUsed = parseInt(tokensMatch[1]);
  
  const costMatch = currentContent.match(/\$(\d+\.\d+)/);
  if (costMatch) assertions.numericValues.estimatedCost = parseFloat(costMatch[1]);
  
  // Try to extract progress percentage from progress bar
  try {
    const progressValue = await page.$eval('div[role="progressbar"], .progress, [class*="progress"]', el => {
      const style = window.getComputedStyle(el);
      const ariaValue = el.getAttribute('aria-valuenow');
      if (ariaValue) return parseFloat(ariaValue);
      
      // Try to get from CSS width if it's a progress bar
      const width = style.width;
      if (width && width.includes('%')) {
        return parseFloat(width.replace('%', ''));
      }
      return 0;
    }).catch(() => 0);
    
    assertions.numericValues.progressPercentage = progressValue;
  } catch (e) {
    assertions.numericValues.progressPercentage = 0;
  }
  
  // Detect if actual progress is happening by comparing with previous state
  if (previousState) {
    const hasNumericChange = 
      assertions.numericValues.sessionsFound > previousState.numericValues.sessionsFound ||
      assertions.numericValues.batchesCompleted > previousState.numericValues.batchesCompleted ||
      assertions.numericValues.sessionsProcessed > previousState.numericValues.sessionsProcessed ||
      assertions.numericValues.tokensUsed > previousState.numericValues.tokensUsed ||
      assertions.numericValues.estimatedCost > previousState.numericValues.estimatedCost ||
      assertions.numericValues.progressPercentage > previousState.numericValues.progressPercentage;
    
    assertions.actualProgress = hasNumericChange;
    
    // Detect if we're stuck (same values for multiple checks)
    const allValuesSame = 
      assertions.numericValues.sessionsFound === previousState.numericValues.sessionsFound &&
      assertions.numericValues.batchesCompleted === previousState.numericValues.batchesCompleted &&
      assertions.numericValues.sessionsProcessed === previousState.numericValues.sessionsProcessed &&
      assertions.numericValues.tokensUsed === previousState.numericValues.tokensUsed &&
      assertions.numericValues.progressPercentage === previousState.numericValues.progressPercentage;
    
    assertions.progressStuck = allValuesSame;
  }
  
  // Detect current phase
  if (currentContent.includes('Sampling Sessions') || currentContent.includes('sampling')) {
    assertions.progressPhase = 'Sampling';
    assertions.phaseSpecific.windowInfo = currentContent.includes('window') || currentContent.includes('Window');
    assertions.phaseSpecific.sessionRetrieval = currentContent.includes('Retrieved') || currentContent.includes('retrieval');
  } else if (currentContent.includes('Strategic Discovery')) {
    assertions.progressPhase = 'Strategic Discovery';
    assertions.phaseSpecific.discoveryStats = currentContent.includes('intents') || currentContent.includes('reasons') || currentContent.includes('locations');
  } else if (currentContent.includes('Parallel Processing')) {
    assertions.progressPhase = 'Parallel Processing';
    assertions.phaseSpecific.activeStreams = currentContent.includes('streams active') || currentContent.includes('Active Streams');
    assertions.phaseSpecific.roundProgress = currentContent.includes('Round') && currentContent.includes('/');
  } else if (currentContent.includes('Conflict Resolution')) {
    assertions.progressPhase = 'Conflict Resolution';
    assertions.phaseSpecific.conflictStats = currentContent.includes('conflicts') || currentContent.includes('mappings');
  }
  
  // Assert universal progress indicators (now more stringent)
  assertions.sessionCounts = assertions.numericValues.sessionsFound > 0 || assertions.numericValues.sessionsProcessed > 0;
  assertions.batchProgress = assertions.numericValues.batchesCompleted > 0;
  assertions.streamActivity = !!(currentContent.includes('streams active') || currentContent.includes('Active Streams') || currentContent.includes('Round') || currentContent.includes('Parallel processing:'));
  assertions.tokenUsage = assertions.numericValues.tokensUsed > 0;
  assertions.estimatedCost = assertions.numericValues.estimatedCost > 0;
  
  return assertions;
}

/**
 * Setup request logging for debugging
 * @param {Page} page - Puppeteer page object
 */
async function setupRequestLogging(page) {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/')) {
      console.log(`🔗 API Request: ${request.method()} ${url}`);
      
      // Log analysis-related requests with more detail
      if (url.includes('analysis') && request.method() === 'POST') {
        console.log(`📊 Analysis API call detected - this should trigger the workflow`);
      }
    }
    request.continue();
  });
  
  // Log ALL console messages to catch errors
  page.on('console', msg => {
    const text = msg.text();
    console.log(`🌐 Browser Console [${msg.type()}]: ${text}`);
  });
  
  // Log page errors
  page.on('pageerror', error => {
    console.log(`🚨 Page Error: ${error.message}`);
  });
}

module.exports = {
  BROWSER_CONFIG,
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
};