#!/usr/bin/env node
/**
 * View Sessions - Mock API Puppeteer Test
 * 
 * Tests the view sessions workflow using mock API data.
 * Validates session display, dialog functionality, and message sanitization.
 */

const puppeteer = require('puppeteer');
const {
  getBrowserConfig,
  TIMEOUTS,
  enterCredentials,
  waitForSessionsPage,
  waitForSessions,
  clickSessionAndWaitForDialog,
  validateSanitization,
  setupRequestLogging
} = require('./shared/view-sessions-workflow');
const { parseTestArgs, showHelp } = require('./shared/parse-test-args');

// Mock credentials to trigger mock services
const MOCK_CREDENTIALS = {
  botId: 'mock-bot-id',
  clientId: 'mock-client-id',
  clientSecret: 'mock-client-secret'
};

async function runTest() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  // Show help if requested
  if (args.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  const config = parseTestArgs(args);
  
  console.log('🚀 Starting View Sessions - Mock API Puppeteer Test');
  console.log(`🌐 Testing against: ${config.baseUrl}`);
  console.log('🎭 Using mock credentials to trigger mock services');
  if (config.slowMo > 0) {
    console.log(`🐌 SlowMo enabled at ${config.slowMo}ms`);
  }
  
  const browser = await puppeteer.launch(getBrowserConfig({ 
    slowMo: config.slowMo
  }));
  
  try {
    const page = await browser.newPage();
    
    // Set timeouts
    page.setDefaultTimeout(TIMEOUTS.default);
    page.setDefaultNavigationTimeout(TIMEOUTS.navigation);
    
    // Setup request logging
    await setupRequestLogging(page);
    
    // Step 1-2: Enter credentials
    await enterCredentials(page, MOCK_CREDENTIALS, config.baseUrl);
    
    // Step 3: Wait for navigation
    await waitForSessionsPage(page);
    
    // Step 4: Wait for sessions to load
    const { sessionRows, hasNoSessions } = await waitForSessions(page);
    
    if (hasNoSessions || sessionRows.length === 0) {
      throw new Error('No sessions found - mock services may not be working');
    }
    
    console.log(`Found ${sessionRows.length} mock sessions`);
    
    // Verify we have mock data
    const firstRowText = await page.evaluate(el => el.textContent, sessionRows[0]);
    console.log(`First session preview: ${firstRowText.substring(0, 100)}...`);
    
    const hasMockData = firstRowText.includes('mock_session');
    if (!hasMockData) {
      throw new Error('Session data does not appear to be from mock service');
    }
    console.log('✅ Mock session data confirmed');
    
    // Step 5: Find mock_session_1 (contains sanitization test data)
    console.log('📋 Step 5: Finding session with sanitization test data');
    
    let targetSessionRow = null;
    for (let i = 0; i < sessionRows.length; i++) {
      const rowText = await page.evaluate(el => el.textContent, sessionRows[i]);
      // Skip header rows
      if (rowText.includes('Session ID') && rowText.includes('Start Time')) {
        continue;
      }
      // Look for mock_session_1 which has our test data
      if (rowText.includes('mock_session_1')) {
        targetSessionRow = sessionRows[i];
        console.log(`✅ Found test session: mock_session_1 at row ${i + 1}`);
        break;
      }
    }
    
    if (!targetSessionRow) {
      // Fallback: use first data row if specific session not found
      for (let i = 0; i < sessionRows.length; i++) {
        const rowText = await page.evaluate(el => el.textContent, sessionRows[i]);
        if (!rowText.includes('Session ID') && rowText.includes('mock_session')) {
          targetSessionRow = sessionRows[i];
          console.log(`⚠️ Using first available session at row ${i + 1}`);
          break;
        }
      }
    }
    
    if (!targetSessionRow) {
      throw new Error('No clickable session rows found');
    }
    
    // Step 6-7: Click session and validate dialog
    const { dialogContent } = await clickSessionAndWaitForDialog(page, targetSessionRow);
    
    console.log(`Dialog content length: ${dialogContent.length} characters`);
    console.log(`Dialog preview: ${dialogContent.substring(0, 200)}...`);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'mock-api-dialog-content.png' });
    
    // Check for "No messages" error
    if (dialogContent.includes('No messages in this session')) {
      throw new Error('Session details show "No messages in this session" error');
    }
    
    // Check for rich content
    const hasRichContent = dialogContent.length > 50;
    const messageWords = ['claim', 'bill', 'help', 'status', 'coverage', 'user', 'bot', 'message'];
    const hasMessageWords = messageWords.some(word => 
      dialogContent.toLowerCase().includes(word.toLowerCase())
    );
    
    console.log(`Has rich content: ${hasRichContent}`);
    console.log(`Contains message words: ${hasMessageWords}`);
    
    if (!hasRichContent || !hasMessageWords) {
      console.log('❌ Dialog does not contain expected message content');
      console.log('Expected messages like:');
      console.log('- "I need to check the status of my claim"');
      console.log('- "I have a question about my bill"');
      throw new Error('No messages displayed in session details dialog');
    }
    
    // Step 8: Validate sanitization
    const { sanitizationTests } = validateSanitization(dialogContent, false);
    
    const sanitizationPassed = Object.values(sanitizationTests).every(test => test === true);
    
    if (!sanitizationPassed) {
      console.log('\n❌ CRITICAL FAILURE: Message sanitization not working');
      console.log('\nDialog content for debugging:');
      console.log('='.repeat(80));
      console.log(dialogContent);
      console.log('='.repeat(80));
      throw new Error('Message sanitization validation failed');
    }
    
    console.log('\n🎉 Mock API test completed successfully!');
    console.log('\n✨ SUCCESS SUMMARY:');
    console.log('✅ Mock services working correctly');
    console.log('✅ Session data loaded successfully');
    console.log('✅ Dialog opens with message content');
    console.log('✅ Message sanitization validated');
    console.log('✅ No timeout issues');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Take failure screenshot
    const pages = await browser.pages();
    if (pages.length > 0) {
      await pages[0].screenshot({ path: 'mock-api-test-failure.png' });
      console.log('📸 Screenshot saved as mock-api-test-failure.png');
    }
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
runTest().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});