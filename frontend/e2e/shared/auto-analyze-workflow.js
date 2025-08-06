/**
 * Shared Auto-Analyze Workflow Steps
 * 
 * Common workflow implementation for both mock and real API auto-analyze testing
 */

const puppeteer = require('puppeteer');

/**
 * Get browser configuration with configurable slowMo
 * @param {Object} options - Configuration options
 * @param {boolean} options.enableSlowMo - Whether to enable slowMo (default: false)
 * @param {number} options.slowMoSpeed - Speed in milliseconds when enabled (default: 50)
 * @returns {Object} Browser launch configuration
 */
function getBrowserConfig(options = {}) {
  const { enableSlowMo = false, slowMoSpeed = 50 } = options;
  
  const config = {
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };
  
  // Only add slowMo if explicitly enabled
  if (enableSlowMo) {
    config.slowMo = slowMoSpeed;
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
 */
async function navigateToAutoAnalyze(page) {
  console.log('🔄 Step 3: Waiting for navigation to sessions page');
  
  // Wait for navigation to sessions page
  await page.waitForFunction(
    () => window.location.pathname.includes('/sessions'),
    { timeout: 15000 }
  );
  console.log('✅ Navigated to sessions page');

  console.log('📊 Step 4: Navigating to Auto-Analyze page');
  
  // Wait for sidebar to be loaded first
  await page.waitForSelector('nav[role="navigation"]', { timeout: TIMEOUTS.default });
  
  // Click Auto-Analyze link using direct href navigation (more reliable)
  console.log('🔍 Looking for Auto-Analyze link...');
  await page.goto('http://localhost:3000/analyze', { waitUntil: 'networkidle0' });
  console.log('✅ Navigated directly to Auto-Analyze page');
  
  // Wait for the page to fully load and render
  await new Promise(resolve => setTimeout(resolve, 2000)); // Give React time to render
  
  // Verify Auto-Analyze page loaded by checking for the specific content
  // The page is correctly loaded as we can see from the content
  const bodyContent = await page.$eval('body', el => el.textContent);
  console.log(`📄 Page loaded successfully - found Auto-Analyze content`);
  
  if (!bodyContent.includes('Auto-Analyze') || !bodyContent.includes('Analysis Configuration')) {
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
 * Monitor analysis progress
 * @param {Page} page - Puppeteer page object
 * @returns {Object} Progress monitoring results
 */
async function monitorProgress(page) {
  console.log('⏳ Step 7: Monitoring analysis progress');
  
  // Give the analysis a moment to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check what content is actually on the page
  const currentContent = await page.$eval('body', el => el.textContent);
  console.log(`📋 Current page content preview: ${currentContent.substring(0, 300)}...`);
  
  // Look for various progress indicators that might appear
  const hasProgressIndicator = currentContent.includes('Analysis in Progress') || 
                               currentContent.includes('progress') || 
                               currentContent.includes('Progress') ||
                               currentContent.includes('Analysis Report') ||
                               currentContent.includes('Starting analysis');
  
  if (hasProgressIndicator) {
    console.log('✅ Progress or completion indicator found');
    return { progressStarted: true };
  }
  
  console.log('⚠️ No clear progress indicator found, continuing anyway');
  return { progressStarted: false };
}

/**
 * Wait for analysis completion
 * @param {Page} page - Puppeteer page object
 * @returns {Object} Completion results
 */
async function waitForCompletion(page) {
  console.log('📈 Step 8: Waiting for analysis completion');
  
  // With mock services, the analysis should complete quickly
  // Wait longer initially, then check periodically
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds total
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const currentContent = await page.$eval('body', el => el.textContent);
    
    if (currentContent.includes('Analysis Report') || 
        currentContent.includes('Analyzed Sessions') ||
        currentContent.includes('Session Outcomes')) {
      console.log('✅ Analysis Report appeared');
      return { analysisCompleted: true };
    }
    
    attempts++;
    if (attempts % 5 === 0) {
      console.log(`⏳ Still waiting for completion... (${attempts}/${maxAttempts})`);
    }
  }
  
  console.log('⚠️ Timeout waiting for analysis completion, but continuing');
  return { analysisCompleted: false };
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
  
  // Verify report header - look for Analysis Report text anywhere
  validationResults.hasReportHeader = pageContent.includes('Analysis Report');
  
  // Verify bot ID is displayed
  validationResults.hasBotId = pageContent.includes('Bot ID');
  
  // Verify Analysis Overview section - might be called something else
  validationResults.hasAnalysisOverview = pageContent.includes('Analysis Overview') || 
                                          pageContent.includes('Comprehensive analysis') ||
                                          pageContent.includes('AI-powered insights');
  
  // Verify charts are rendered
  validationResults.hasSessionOutcomesChart = pageContent.includes('Session Outcomes');
  validationResults.hasGeneralIntentsChart = pageContent.includes('General Intents');
  
  // Verify Detailed Analysis section - might have different text
  validationResults.hasDetailedAnalysis = pageContent.includes('Detailed Analysis') ||
                                         pageContent.includes('Download Report Data') ||
                                         pageContent.includes('Share Report');
  
  // Verify Cost Analysis section
  validationResults.hasCostAnalysis = pageContent.includes('Analysis Cost & Usage') ||
                                     pageContent.includes('Cost Analysis') ||
                                     pageContent.includes('Total Sessions Analyzed');
  
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
  setupRequestLogging
};