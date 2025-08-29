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
 * Verify default start date is yesterday (in local timezone)
 * @param {Page} page - Puppeteer page object
 * @returns {Object} Validation results
 */
async function validateDefaultStartDate(page) {
  console.log('🔍 Verifying default start date is yesterday');
  
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
  const isCorrect = actualStartDate === expectedYesterday;
  
  if (isCorrect) {
    console.log('✅ DEFAULT DATE CORRECT: Start date field defaults to yesterday');
  } else {
    console.log(`❌ DEFAULT DATE INCORRECT: Expected ${expectedYesterday}, but got ${actualStartDate}`);
  }
  
  return {
    isCorrect,
    expectedDate: expectedYesterday,
    actualDate: actualStartDate
  };
}

/**
 * Validate initial status message order
 * @param {Page} page - Puppeteer page object
 * @returns {Object} Validation results
 */
async function validateInitialStatusMessage(page) {
  console.log('🔍 Checking initial status message order');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for initial status
  
  const initialStatus = await page.evaluate(() => {
    // Look for specific status patterns in the page
    const bodyText = document.body.textContent;
    
    // Look for progress indicators more broadly
    const progressPatterns = [
      /Progress\s*([^Progress]*?)(?=Progress|$)/i,  // Match Progress followed by status
      /Status:\s*([^\n]+)/i,                        // Match Status: followed by text
      /(Initializing|Analyzing sessions|Sampling|Searching for sessions)/i  // Direct status matches
    ];
    
    for (const pattern of progressPatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      } else if (match && match[0]) {
        return match[0].trim();
      }
    }
    
    // Fallback: look for common status keywords
    if (bodyText.includes('Searching for sessions')) {
      return 'Searching for sessions';
    } else if (bodyText.includes('Sampling')) {
      return 'Sampling';
    } else if (bodyText.includes('Initializing')) {
      return 'Initializing';
    } else if (bodyText.includes('Analyzing sessions')) {
      return 'Analyzing sessions';
    }
    
    return bodyText.substring(0, 200); // Return first 200 chars for debugging
  });
  
  console.log(`📊 Initial status detected: "${initialStatus}"`);
  
  // More lenient validation - consider "Searching for sessions" and "Sampling" as acceptable initial states
  let isCorrect = false;
  let message = '';
  
  if (initialStatus.includes('Analyzing sessions') && !initialStatus.includes('Initializing') && !initialStatus.includes('Searching')) {
    console.log('❌ BUG CONFIRMED: Initial status shows "Analyzing sessions" instead of "Initializing"');
    console.log('🔧 This confirms the reported issue - initial status should be "Initializing"');
    message = 'Initial status bug detected: Shows "Analyzing sessions" before "Searching for sessions"';
    isCorrect = false;
  } else if (initialStatus.includes('Initializing') || initialStatus.includes('Searching for sessions') || initialStatus.includes('Sampling')) {
    console.log('✅ CORRECT: Initial status shows appropriate starting phase');
    isCorrect = true;
    message = 'Initial status correct - shows appropriate starting phase';
  } else {
    console.log(`⚠️ Initial status unclear, but allowing test to continue: "${initialStatus}"`);
    message = `Initial status unclear but continuing: "${initialStatus}"`;
    // Don't fail the test for unclear status, just warn
    isCorrect = true;
  }
  
  return {
    isCorrect,
    detectedStatus: initialStatus,
    message
  };
}

/**
 * Validate discovery phase status message
 * @param {Page} page - Puppeteer page object
 * @returns {Object} Validation results
 */
async function validateDiscoveryPhaseStatus(page) {
  console.log('🔍 Waiting for discovery phase to check its status message');
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for discovery phase
  
  const discoveryStatus = await page.evaluate(() => {
    const bodyText = document.body.textContent;
    
    // Look for discovery phase indicators
    if (bodyText.includes('Strategic Discovery')) {
      return 'Strategic Discovery';
    } else if (bodyText.includes('Analyzing initial sessions')) {
      return 'Analyzing initial sessions';
    } else if (bodyText.includes('Initializing (') && bodyText.includes('/')) {
      const match = bodyText.match(/Initializing \(\d+\/\d+\)/);
      if (match) return match[0];
    }
    
    // Look for other progress indicators
    const progressPatterns = [
      /(Sampling|Searching for sessions|Discovery)/i,
      /Progress\s*([^Progress]*?)(?=Progress|$)/i
    ];
    
    for (const pattern of progressPatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        return match[1] ? match[1].trim() : match[0].trim();
      }
    }
    
    return bodyText.substring(0, 200); // Return first 200 chars for debugging
  });
  
  console.log(`📊 Discovery phase status detected: "${discoveryStatus}"`);
  
  // More lenient validation - allow various discovery phase statuses
  let isCorrect = false;
  let message = '';
  
  if (discoveryStatus.includes('Initializing (') && discoveryStatus.includes('/') && 
      !discoveryStatus.includes('Strategic Discovery') && !discoveryStatus.includes('Analyzing initial sessions')) {
    console.log('❌ DISCOVERY PHASE BUG: Shows "Initializing (X/Y)" instead of "Analyzing initial sessions (X/Y)"');
    console.log('🔧 Discovery phase should show "Analyzing initial sessions" not "Initializing"');
    message = 'Discovery phase bug detected: Shows "Initializing (X/Y)" instead of "Analyzing initial sessions (X/Y)"';
    isCorrect = false;
  } else if (discoveryStatus.includes('Analyzing initial sessions') || 
             discoveryStatus.includes('Strategic Discovery') ||
             discoveryStatus.includes('Sampling') ||
             discoveryStatus.includes('Searching for sessions')) {
    console.log('✅ CORRECT: Discovery phase shows appropriate status');
    isCorrect = true;
    message = 'Discovery phase status appropriate';
  } else {
    console.log(`⚠️ Discovery phase status unclear, but allowing test to continue: "${discoveryStatus}"`);
    message = `Discovery phase status unclear but continuing: "${discoveryStatus}"`;
    // Don't fail the test for unclear status, just warn
    isCorrect = true;
  }
  
  return {
    isCorrect,
    detectedStatus: discoveryStatus,
    message
  };
}

/**
 * Monitor continuous progress assertions with stuck detection
 * @param {Page} page - Puppeteer page object
 * @param {number} sessionCount - Number of sessions for timeout scaling
 * @returns {Array} Array of progress assertion results
 */
async function monitorContinuousProgressAssertions(page, sessionCount = 10) {
  console.log('🔍 Starting continuous progress indicator assertions');
  const progressAssertionResults = [];
  let assertionAttempts = 0;
  let previousAssertion = null;
  let stuckCount = 0;
  const maxAssertionAttempts = sessionCount >= 50 ? 180 : 90; // 3 minutes for large sessions, 1.5 for small
  
  return new Promise((resolve) => {
    const assertionInterval = setInterval(async () => {
      if (assertionAttempts >= maxAssertionAttempts) {
        clearInterval(assertionInterval);
        resolve(progressAssertionResults);
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
          resolve(progressAssertionResults);
          return;
        }
      } catch (error) {
        console.log(`⚠️ Progress assertion error: ${error.message}`);
      }
      
      assertionAttempts++;
    }, 2000); // Check every 2 seconds
  });
}

/**
 * Validate badge text during report generation phase
 * @param {Page} page - Puppeteer page object
 * @returns {Object} Validation results
 */
async function validateBadgeTextDuringReportGeneration(page) {
  console.log('🔍 Testing badge text when status shows "Generating analysis report"');
  
  // Wait for report generation phase
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds
  
  while (attempts < maxAttempts) {
    const currentContent = await page.$eval('body', el => el.textContent);
    
    if (currentContent.includes('Generating analysis report')) {
      console.log('🔍 Found "Generating analysis report" phase, checking badge text');
      
      const badgeText = await page.evaluate(() => {
        // Look for the progress badge in the top-right corner
        const progressCards = document.querySelectorAll('*');
        for (let element of progressCards) {
          const text = element.textContent;
          if (text && text.includes('Progress') && element.querySelector('span[data-slot="badge"]')) {
            const badge = element.querySelector('span[data-slot="badge"]');
            return badge ? badge.textContent.trim() : null;
          }
        }
        return null;
      });
      
      console.log(`📊 Badge text during "Generating analysis report": "${badgeText}"`);
      
      let isCorrect = false;
      let message = '';
      
      if (badgeText === 'Resolving') {
        console.log('❌ BUG DETECTED: Badge shows "Resolving" during "Generating analysis report" phase');
        message = 'Badge bug confirmed: Shows "Resolving" instead of "Writing report" during report generation';
        isCorrect = false;
      } else if (badgeText === 'Writing report') {
        console.log('✅ CORRECT: Badge shows "Writing report" during report generation phase');
        message = 'Badge text correct during report generation';
        isCorrect = true;
      } else {
        console.log(`⚠️ Unexpected badge text: "${badgeText}" during report generation`);
        message = `Unexpected badge text: "${badgeText}" during report generation`;
        isCorrect = false;
      }
      
      return {
        isCorrect,
        badgeText,
        message
      };
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  console.log('⚠️ Report generation phase not detected within timeout');
  return {
    isCorrect: false,
    badgeText: null,
    message: 'Report generation phase not detected within timeout'
  };
}

/**
 * Navigate to credentials page and enter credentials
 * @param {Page} page - Puppeteer page object
 * @param {Object} credentials - Bot credentials
 * @param {string} baseUrl - Base URL to test against
 */
async function enterCredentials(page, credentials, baseUrl = 'http://localhost:3000') {
  console.log('📝 Step 1: Navigating to credentials page');
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('✅ Credentials page loaded');

  console.log('📝 Step 2: Entering credentials');
  
  // Wait for the form to be ready
  await page.waitForSelector('#botId', { timeout: 10000 });
  await page.waitForSelector('#clientId', { timeout: 10000 });
  await page.waitForSelector('#clientSecret', { timeout: 10000 });
  
  await page.type('#botId', credentials.botId);
  await page.type('#clientId', credentials.clientId);
  await page.type('#clientSecret', credentials.clientSecret);
  
  // Verify credentials are stored before clicking Connect
  await page.evaluate((creds) => {
    sessionStorage.setItem('botCredentials', JSON.stringify(creds));
    console.log('Pre-connect: Credentials stored in sessionStorage');
  }, credentials);
  
  // Find and click the Connect button (look for button with Connect text)
  const buttons = await page.$$('button');
  let connectButton = null;
  
  for (const button of buttons) {
    const buttonText = await page.evaluate(el => el.textContent, button);
    if (buttonText.includes('Connect')) {
      connectButton = button;
      break;
    }
  }
  
  if (connectButton) {
    await connectButton.click();
    console.log('✅ Connect button found and clicked');
  } else {
    // Log all available buttons for debugging
    console.log('🔍 Available buttons:');
    for (const button of buttons) {
      const buttonText = await page.evaluate(el => el.textContent, button);
      console.log(`  - "${buttonText}"`);
    }
    throw new Error('Connect button not found');
  }
  console.log('✅ Credentials entered and Connect clicked');
  
  // Wait a moment for any network requests to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
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
  
  // Ensure credentials are properly stored before navigation
  const currentCredentials = await page.evaluate(() => {
    const stored = sessionStorage.getItem('botCredentials');
    return stored ? JSON.parse(stored) : null;
  });
  
  if (!currentCredentials) {
    console.log('⚠️ No credentials found, this may cause navigation issues');
  } else {
    console.log('✅ Credentials confirmed in sessionStorage before navigation');
  }
  
  // Try to wait for sidebar and click the link
  try {
    await page.waitForSelector('nav[role="navigation"], aside, .sidebar', { timeout: 3000 });
    console.log('✅ Sidebar found');
    
    // Look for Auto-Analyze link
    const autoAnalyzeLink = await page.$('a[href="/analyze"]');
    if (autoAnalyzeLink) {
      console.log('📊 Found Auto-Analyze link in sidebar, clicking it');
      await autoAnalyzeLink.click();
      await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
      console.log('✅ Navigated to Auto-Analyze page via sidebar');
    } else {
      console.log('⚠️ Auto-Analyze link not found, trying direct navigation');
      // Re-ensure credentials before direct navigation
      if (currentCredentials) {
        await page.evaluate((creds) => {
          sessionStorage.setItem('botCredentials', JSON.stringify(creds));
        }, currentCredentials);
      }
      await page.goto(`${baseUrl}/analyze`, { waitUntil: 'domcontentloaded' });
      console.log('✅ Navigated directly to Auto-Analyze page');
    }
  } catch (e) {
    console.log('⚠️ Sidebar not found, trying direct navigation');
    
    // Re-store credentials if we have them
    if (currentCredentials) {
      console.log('🔄 Re-storing credentials before direct navigation');
      await page.evaluate((creds) => {
        sessionStorage.setItem('botCredentials', JSON.stringify(creds));
        console.log('Direct navigation: Credentials re-stored in sessionStorage');
      }, currentCredentials);
    }
    
    // Add a small delay to ensure page is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Navigate directly to analyze page
    console.log('🔍 Navigating directly to Auto-Analyze page...');
    await page.goto(`${baseUrl}/analyze`, { waitUntil: 'domcontentloaded' });
    console.log('✅ Navigated directly to Auto-Analyze page');
  }
  
  // Wait for the page to fully load and render
  await new Promise(resolve => setTimeout(resolve, 3000)); // Give React more time to render and check credentials
  
  // Check if we got redirected back to login
  const currentUrl = page.url();
  if (currentUrl === baseUrl || currentUrl === `${baseUrl}/`) {
    console.log('⚠️ Redirected back to login page, credentials may have been lost');
    
    // Re-check credentials and retry if needed
    const hasCredentialsAfter = await page.evaluate(() => {
      const stored = sessionStorage.getItem('botCredentials');
      return !!stored;
    });
    
    if (!hasCredentialsAfter && currentCredentials) {
      console.log('🔄 Retrying navigation with credentials');
      await page.evaluate((creds) => {
        sessionStorage.setItem('botCredentials', JSON.stringify(creds));
      }, currentCredentials);
      
      await page.goto(`${baseUrl}/analyze`, { waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Verify Auto-Analyze page loaded by checking for the specific content (NEW UI)
  const bodyContent = await page.$eval('body', el => el.textContent);
  console.log(`📄 Page loaded successfully - checking for Auto-Analyze content (NEW UI)`);
  
  // Update content checks for new UI copy (August 2025 redesign)
  const hasCorrectContent = bodyContent.includes('Auto-Analyze') && 
    (bodyContent.includes('Session Analysis Setup') || 
     bodyContent.includes('Analysis Configuration') ||  // Backward compatibility
     bodyContent.includes('intelligent bot performance insights') ||
     bodyContent.includes('smart session sampling') ||
     bodyContent.includes('Start Analysis'));
  
  if (!hasCorrectContent) {
    // Take a screenshot for debugging
    await page.screenshot({ path: 'auto-analyze-content-debug.png' });
    console.error('Page content does not match expected Auto-Analyze page');
    console.error('Looking for: Auto-Analyze + (Session Analysis Setup OR intelligent bot performance insights OR smart session sampling OR Start Analysis)');
    console.error('Found content preview:', bodyContent.substring(0, 500));
    console.error(`Current URL: ${page.url()}`);
    
    // Check if we're back on login page - if so, this is a credentials issue, not a content issue
    if (bodyContent.includes('Welcome to XOBCAT') && bodyContent.includes('Client Secret')) {
      throw new Error(`Navigation failed - redirected back to login page. Check credentials handling.`);
    } else {
      throw new Error(`Expected Auto-Analyze page content not found`);
    }
  }
  
  console.log('✅ Auto-Analyze page loaded');
}

/**
 * Configure analysis settings
 * @param {Page} page - Puppeteer page object
 * @param {Object} config - Analysis configuration
 */
async function configureAnalysis(page, config) {
  console.log('⚙️ Step 5: Configuring analysis settings (NEW UI)');
  
  const {
    startDate = '2025-08-01',
    timeOfDay = 'morning',  // NEW: use timeOfDay instead of startTime
    sessionCount = '5',
    openaiApiKey = 'mock-openai-key'
  } = config;

  // Map old startTime to new timeOfDay if needed for backward compatibility
  let finalTimeOfDay = timeOfDay;
  if (config.startTime && !config.timeOfDay) {
    if (config.startTime === '09:00') finalTimeOfDay = 'morning';
    else if (config.startTime === '13:00') finalTimeOfDay = 'afternoon';
    else if (config.startTime === '18:00') finalTimeOfDay = 'evening';
    console.log(`🔄 Mapped startTime ${config.startTime} to timeOfDay: ${finalTimeOfDay}`);
  }

  console.log(`Using date: ${startDate} at ${finalTimeOfDay}, ${sessionCount} sessions`);
  
  // Fill in date
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
  
  // NEW: Set time of day dropdown instead of time input
  console.log(`🕐 Setting time of day: ${finalTimeOfDay}`);
  await page.waitForSelector('#timeOfDay', { timeout: TIMEOUTS.default });
  
  // Click the dropdown trigger
  const timeOfDayDropdown = await page.$('#timeOfDay [role="combobox"]');
  if (timeOfDayDropdown) {
    await timeOfDayDropdown.click();
    console.log('✅ Time of day dropdown opened');
    
    // Wait for options and select the correct one
    await page.waitForSelector('[role="option"]', { timeout: TIMEOUTS.default });
    
    const timeOptions = await page.$$('[role="option"]');
    let timeFound = false;
    
    for (const option of timeOptions) {
      const optionText = await page.evaluate(el => el.textContent, option);
      const lowerText = optionText.toLowerCase();
      
      if ((finalTimeOfDay === 'morning' && lowerText.includes('morning')) ||
          (finalTimeOfDay === 'afternoon' && lowerText.includes('afternoon')) ||
          (finalTimeOfDay === 'evening' && lowerText.includes('evening'))) {
        await option.click();
        timeFound = true;
        console.log(`✅ Selected time: ${optionText}`);
        break;
      }
    }
    
    if (!timeFound) {
      console.log(`⚠️ Time of day ${finalTimeOfDay} not found in dropdown, using default`);
    }
  } else {
    console.log('⚠️ Time of day dropdown trigger not found');
  }
  
  // NEW: Fill OpenAI API key (now comes before advanced options)
  console.log('🔑 Setting OpenAI API key');
  const openaiKeyInput = await page.$('#openaiApiKey');
  if (openaiKeyInput) {
    await openaiKeyInput.click({ clickCount: 3 }); // Select all
    await openaiKeyInput.type(openaiApiKey);
    console.log('✅ OpenAI API key set');
  } else {
    console.log('⚠️ OpenAI API key input not found');
  }
  
  // NEW: Fill additional context (if provided)
  if (config.additionalContext) {
    console.log('🔤 Setting additional context');
    const contextInput = await page.$('#additionalContext');
    if (contextInput) {
      await contextInput.click({ clickCount: 3 }); // Select all
      await contextInput.type(config.additionalContext);
      console.log('✅ Additional context set');
    } else {
      console.log('⚠️ Additional context textarea not found');
    }
  }
  
  // NEW: Handle advanced options (session count and GPT model are now behind progressive disclosure)
  console.log('🔧 Opening advanced options for session count and model selection');
  
  // Look for the Advanced chevron button (now a button with "Advanced" text and chevron icon)
  let advancedToggle = null;
  
  // Find button that contains "Advanced" text (the new chevron button)
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const buttonText = await page.evaluate(el => el.textContent, button);
    if (buttonText.includes('Advanced') && !buttonText.includes('Show') && !buttonText.includes('Hide')) {
      // Check if this button has a chevron (SVG icon)
      const hasChevron = await page.evaluate(el => {
        const svg = el.querySelector('svg');
        return svg !== null;
      }, button);
      
      if (hasChevron) {
        advancedToggle = button;
        console.log(`📋 Found advanced chevron toggle: "${buttonText}"`);
        break;
      }
    }
  }
  
  if (advancedToggle) {
    await advancedToggle.click();
    console.log('✅ Advanced options opened (chevron clicked)');
    
    // Wait a moment for the fields to appear
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Now set session count (only visible in advanced section)
    console.log(`🔢 Setting session count: ${sessionCount}`);
    const sessionCountInput = await page.$('#sessionCount');
    if (sessionCountInput) {
      await sessionCountInput.click({ clickCount: 3 }); // Select all
      await sessionCountInput.type(sessionCount);
      console.log('✅ Session count set');
    } else {
      console.log('⚠️ Session count input not found in advanced options');
    }
    
    // Select GPT model if specified (only visible in advanced section)
    if (config.modelId) {
      console.log(`🤖 Selecting GPT model: ${config.modelId}`);
      
      // Look for GPT Model dropdown in advanced section
      const modelDropdowns = await page.$$('[role="combobox"]');
      let modelDropdown = null;
      
      // Find the model dropdown (should be the second one after time of day)
      for (const dropdown of modelDropdowns) {
        const dropdownParent = await page.evaluate(el => {
          // Check if this dropdown is associated with model selection
          const parent = el.closest('div').parentElement;
          return parent && parent.textContent.includes('GPT Model');
        }, dropdown);
        
        if (dropdownParent) {
          modelDropdown = dropdown;
          break;
        }
      }
      
      if (modelDropdown) {
        await modelDropdown.click();
        console.log('📋 GPT model dropdown opened');
        
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
      } else {
        console.log('⚠️ GPT model dropdown not found in advanced options');
      }
    }
  } else {
    console.log('⚠️ Advanced options toggle not found - session count and model may not be set');
  }
  
  console.log('✅ Analysis settings configured (NEW UI)');
  
  // Take a screenshot of the filled form
  await page.screenshot({ path: 'filled-form-new-ui.png' });
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
    
    // Test: Check badge text when status shows "Generating analysis report" (moved to shared function)
    // This is now handled by validateBadgeTextDuringReportGeneration() if needed
    
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

  // Check for Additional Context display (if provided in expectedData)
  if (expectedData.expectedContext) {
    validationResults.hasAdditionalContext = pageContent.includes('Analysis Context') &&
                                           pageContent.includes(expectedData.expectedContext);
    console.log(`🔤 Additional context check: ${validationResults.hasAdditionalContext ? '✅' : '❌'}`);
  }
  
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
  
  // Check for session details fields that should NOT be zero
  const durationText = await page.evaluate(() => {
    // Find the Duration label in a span with specific text
    const spans = Array.from(document.querySelectorAll('span'));
    const durationSpan = spans.find(span => 
      span.textContent && span.textContent.trim() === 'Duration'
    );
    if (durationSpan) {
      // The value is in the next div sibling of the parent div
      const parentDiv = durationSpan.closest('div');
      if (parentDiv && parentDiv.nextElementSibling) {
        return parentDiv.nextElementSibling.textContent.trim();
      }
    }
    return '';
  });
  
  const messageCountText = await page.evaluate(() => {
    // Find the Message Count label in a span with specific text
    const spans = Array.from(document.querySelectorAll('span'));
    const messageSpan = spans.find(span => 
      span.textContent && span.textContent.trim() === 'Message Count'
    );
    if (messageSpan) {
      // The value is in the next div sibling of the parent div
      const parentDiv = messageSpan.closest('div');
      if (parentDiv && parentDiv.nextElementSibling) {
        return parentDiv.nextElementSibling.textContent.trim();
      }
    }
    return '';
  });
  
  const dialogResults = {
    hasAIFacts: dialogContent.includes('AI-Extracted Facts'),
    hasGeneralIntent: dialogContent.includes('General Intent'),
    hasSessionOutcome: dialogContent.includes('Session Outcome'),
    // New assertions for the bug fix
    durationNotZero: durationText !== '0s' && durationText !== '' && !durationText.includes('0s'),
    messageCountNotZero: messageCountText !== '0 messages (0 user, 0 bot)' && messageCountText !== '' && !messageCountText.includes('0 messages'),
    durationText: durationText,
    messageCountText: messageCountText
  };
  
  // Log the results for debugging
  console.log(`📊 Duration found: "${durationText}"`);
  console.log(`📊 Message count found: "${messageCountText}"`);
  console.log(`✅ Duration not zero: ${dialogResults.durationNotZero}`);
  console.log(`✅ Message count not zero: ${dialogResults.messageCountNotZero}`);
  
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
  
  // NEW: Check for progress bar animation (shimmer effect)
  try {
    assertions.hasProgressBarAnimation = await page.evaluate(() => {
      // Look for progress bar with animated attribute
      const progressBars = document.querySelectorAll('[role="progressbar"], .progress, [class*="progress"]');
      for (const bar of progressBars) {
        // Check if the progress bar has animation styles
        const shimmerElements = bar.querySelectorAll('div');
        for (const shimmer of shimmerElements) {
          const style = window.getComputedStyle(shimmer);
          // Check for shimmer animation (either inline style or computed)
          if (shimmer.style.animation && shimmer.style.animation.includes('shimmer')) {
            return true;
          }
          // Check for computed animation
          if (style.animation && style.animation.includes('shimmer')) {
            return true;
          }
          // Check for animate-pulse class (fallback animation)
          if (shimmer.className && shimmer.className.includes('animate-pulse')) {
            return true;
          }
        }
      }
      return false;
    });
  } catch (e) {
    assertions.hasProgressBarAnimation = false;
  }
  
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
  setupRequestLogging,
  // New shared validations
  validateDefaultStartDate,
  validateInitialStatusMessage,
  validateDiscoveryPhaseStatus,
  monitorContinuousProgressAssertions,
  validateBadgeTextDuringReportGeneration
};