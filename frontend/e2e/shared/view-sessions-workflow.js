/**
 * Shared View Sessions Workflow Steps
 * 
 * Common workflow implementation for both mock and real API testing
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
 * Timeout configuration
 */
const TIMEOUTS = {
  default: 2000,
  navigation: 5000,
  sessionLoad: 30000,
  shortWait: 3000
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
  
  // Find and click the Connect button (specifically target the form submit button)
  const connectButton = await page.$('button:not([type="button"])');
  if (connectButton) {
    const buttonText = await page.evaluate(el => el.textContent, connectButton);
    if (buttonText.includes('Connect')) {
      await connectButton.click();
    } else {
      throw new Error(`Expected Connect button, found: ${buttonText}`);
    }
  } else {
    // Fallback: look for any button with "Connect" text
    const buttons = await page.$$('button');
    let foundConnectButton = false;
    for (const button of buttons) {
      const buttonText = await page.evaluate(el => el.textContent, button);
      if (buttonText.includes('Connect')) {
        await button.click();
        foundConnectButton = true;
        break;
      }
    }
    if (!foundConnectButton) {
      throw new Error('Connect button not found');
    }
  }
  console.log('✅ Credentials entered and Connect clicked');
}

/**
 * Wait for navigation to sessions page
 * @param {Page} page - Puppeteer page object
 */
async function waitForSessionsPage(page) {
  console.log('🔄 Step 3: Waiting for navigation to sessions page');
  
  try {
    // Wait for either successful navigation OR error message
    await page.waitForFunction(
      () => window.location.pathname.includes('/sessions') || 
            document.querySelector('[data-testid="credential-error"]') !== null,
      { timeout: 15000 }
    );
    
    const currentUrl = page.url();
    if (currentUrl.includes('/sessions')) {
      console.log('✅ Navigated to sessions page');
    } else {
      // Check for error message
      const errorElement = await page.$('[data-testid="credential-error"]');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        console.log(`❌ Credentials rejected: ${errorText}`);
        throw new Error(`Credentials rejected: ${errorText}`);
      }
    }
  } catch (timeoutError) {
    // Fallback: Try traditional navigation wait
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
      console.log('✅ Navigated to sessions page via traditional navigation');
    } catch (navError) {
      await page.screenshot({ path: 'navigation-failure.png' });
      const currentUrl = page.url();
      const pageText = await page.$eval('body', el => el.textContent.substring(0, 500));
      console.log(`❌ Navigation failed. Current URL: ${currentUrl}`);
      console.log(`❌ Page content: ${pageText}...`);
      throw new Error('Failed to navigate to sessions page');
    }
  }
}

/**
 * Wait for sessions to load and find session rows
 * @param {Page} page - Puppeteer page object
 * @returns {Object} Session rows and metadata
 */
async function waitForSessions(page) {
  console.log('📊 Step 4: Waiting for sessions to load');
  
  // First, wait for the loading state to complete
  console.log('🔄 Waiting for loading state to finish...');
  
  // Wait for either the table to appear OR a "no sessions" message
  let tableFound = false;
  let hasNoSessions = false;
  
  // Try multiple approaches to wait for content
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`📊 Attempt ${attempt}: Looking for sessions table or content`);
    
    try {
      // Wait for loading to finish first
      await page.waitForFunction(
        () => {
          const loadingText = document.body.textContent;
          return !loadingText.includes('Searching for sessions') && !loadingText.includes('Loading sessions');
        },
        { timeout: 15000 }
      );
      console.log('✅ Loading completed');
      
      // Now check for table or no-sessions message
      const pageText = await page.$eval('body', el => el.textContent);
      
      // Check for any sessions found text (like "50 sessions found")
      const sessionsFoundMatch = pageText.match(/(\d+) sessions found/);
      if (sessionsFoundMatch && parseInt(sessionsFoundMatch[1]) > 0) {
        // Sessions found, wait for table
        try {
          await page.waitForSelector('table tbody tr', { timeout: 10000 });
          tableFound = true;
          console.log(`✅ Sessions table with ${sessionsFoundMatch[1]} sessions found`);
          break;
        } catch (tableError) {
          console.log('⚠️ Sessions found message but table not ready, retrying...');
          // Continue to next attempt
        }
      } else if (pageText.includes('0 sessions found') || pageText.includes('No sessions found')) {
        hasNoSessions = true;
        console.log('✅ No sessions message found');
        break;
      } else {
        console.log(`⚠️ Attempt ${attempt}: Still waiting for content to stabilize`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(`⚠️ Attempt ${attempt} failed: ${error.message}`);
      if (attempt === 3) {
        console.log('⚠️ Final attempt - checking page state');
        const content = await page.content();
        console.log('Page content preview:', content.substring(0, 200));
        await page.screenshot({ path: 'sessions-table-timeout.png' });
      }
    }
  }
  
  if (hasNoSessions) {
    return { sessionRows: [], hasNoSessions: true, noTable: false };
  }
  
  if (!tableFound) {
    return { sessionRows: [], hasNoSessions: false, noTable: true };
  }
  
  // Get session rows
  const sessionRows = await page.$$('table tbody tr');
  const sessionCount = sessionRows.length;
  console.log(`Found ${sessionCount} session rows in table`);
  
  return { sessionRows, foundSelector: 'table tbody tr', hasNoSessions: false, noTable: false };
}

/**
 * Click on a session row and wait for dialog
 * @param {Page} page - Puppeteer page object
 * @param {ElementHandle} sessionRow - Session row to click
 */
async function clickSessionAndWaitForDialog(page, sessionRow) {
  await sessionRow.click();
  console.log('✅ Clicked on session row');
  
  // Wait for dialog to appear
  console.log('🔄 Waiting for session details dialog');
  await page.waitForSelector('[role="dialog"], .dialog', { timeout: 5000 });
  console.log('✅ Session details dialog opened');
  
  const dialog = await page.$('[role="dialog"], .dialog');
  const dialogContent = await page.evaluate(el => el.textContent, dialog);
  
  return { dialog, dialogContent };
}

/**
 * Validate sanitization of messages
 * @param {string} dialogContent - Dialog text content
 * @param {boolean} isRealApi - Whether testing real API
 * @returns {Object} Sanitization test results
 */
function validateSanitization(dialogContent, isRealApi = false) {
  console.log('🧼 Validating message sanitization');
  
  const sanitizationTests = {
    // Check for SSML tags that should be removed
    ssmlTagsRemoved: !dialogContent.includes('<speak>') && 
                     !dialogContent.includes('</speak>') && 
                     !dialogContent.includes('<voice'),
    
    // Check for HTML entities that should be decoded
    htmlEntitiesDecoded: !dialogContent.includes('&quot;') && 
                         !dialogContent.includes('&apos;') && 
                         !dialogContent.includes('&amp;') && 
                         !dialogContent.includes('&lt;') && 
                         !dialogContent.includes('&gt;'),
    
    // Check for raw JSON commands that should be processed
    noRawJsonCommands: !dialogContent.includes('{"type":"command"') && 
                       !dialogContent.includes('"verb":"gather"') && 
                       !dialogContent.includes('"actionHook"'),
    
    // Check for system messages that should be filtered
    systemMessagesFiltered: !dialogContent.includes('Welcome Task') && 
                           !dialogContent.includes('System Message'),
    
    // Check for proper message formatting
    hasReadableMessages: /[a-zA-Z]{3,}/.test(dialogContent),
    
    // Check for Kore.ai internal patterns that should be cleaned
    koreInternalsFiltered: !dialogContent.includes('siprecServerURL') && 
                          !dialogContent.includes('recordingID') && 
                          !dialogContent.includes('azureOptions')
  };
  
  console.log('Sanitization Test Results:');
  Object.entries(sanitizationTests).forEach(([test, passed]) => {
    console.log(`- ${test}: ${passed ? '✅' : '❌'}`);
  });
  
  // Additional pattern analysis for real API
  if (isRealApi) {
    const unsanitizedPatterns = {
      ssmlTags: (dialogContent.match(/<[^>]+>/g) || []).length,
      htmlEntities: (dialogContent.match(/&[a-zA-Z]+;/g) || []).length,
      jsonObjects: (dialogContent.match(/\{"[^"]+"/g) || []).length,
      koreInternals: (dialogContent.match(/(recordingID|siprecServerURL|azureOptions)/g) || []).length
    };
    
    console.log('\n🔬 Detailed Analysis:');
    console.log(`- Found ${unsanitizedPatterns.ssmlTags} potential SSML tags`);
    console.log(`- Found ${unsanitizedPatterns.htmlEntities} HTML entities`);
    console.log(`- Found ${unsanitizedPatterns.jsonObjects} JSON object patterns`);
    console.log(`- Found ${unsanitizedPatterns.koreInternals} Kore internal references`);
    
    return { sanitizationTests, unsanitizedPatterns };
  }
  
  return { sanitizationTests };
}

/**
 * Setup basic request logging
 * @param {Page} page - Puppeteer page object
 */
async function setupRequestLogging(page) {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().includes('/api/')) {
      console.log(`🔗 API Request: ${request.method()} ${request.url()}`);
    }
    request.continue();
  });
  
  // Log console messages from the page
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🧪 Mock') || text.includes('Real') || text.includes('service') || 
        text.includes('🔍') || text.includes('🚨') || text.includes('filter')) {
      console.log(`🌐 Browser: ${text}`);
    }
  });
}

module.exports = {
  BROWSER_CONFIG,
  getBrowserConfig,
  TIMEOUTS,
  enterCredentials,
  waitForSessionsPage,
  waitForSessions,
  clickSessionAndWaitForDialog,
  validateSanitization,
  setupRequestLogging
};