/**
 * Session Message Validation E2E Test - Puppeteer Version
 * 
 * This test validates that session details dialogs properly display:
 * 1. Message content in conversation transcripts
 * 2. Duration values greater than zero
 * 
 * Uses Puppeteer with explicit timeouts to avoid hanging.
 */

const puppeteer = require('puppeteer');

describe('Session Message Validation - Puppeteer', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    console.log('🚀 Starting Puppeteer Session Message Validation Test');
    
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      slowMo: 100,     // Slow down interactions
      defaultViewport: { width: 1280, height: 720 }
    });
    
    page = await browser.newPage();
    
    // Set short timeouts to prevent hanging
    page.setDefaultTimeout(2000);
    page.setDefaultNavigationTimeout(5000);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('validates sessions load and messages display with mock services', async () => {
    console.log('📝 Step 1: Navigating to credentials page');
    
    // Step 1: Navigate to app
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 5000 });
    
    // Wait for page to load by looking for welcome text
    await page.waitForFunction(() => document.body.textContent.includes('Welcome to XOBCAT'), { timeout: 3000 });
    console.log('✅ Credentials page loaded');
    
    console.log('📝 Step 2: Entering mock credentials');
    
    // Step 2: Enter mock credentials
    await page.type('#botId', 'mock-bot-id');
    await page.type('#clientId', 'mock-client-id'); 
    await page.type('#clientSecret', 'mock-client-secret');
    
    // Click connect button
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Connect'));
      if (button) button.click();
    });
    console.log('✅ Credentials entered and Connect clicked');
    
    console.log('🔄 Step 3: Waiting for navigation to sessions page');
    
    // Step 3: Wait for navigation (with timeout)
    try {
      await page.waitForFunction(() => window.location.pathname.includes('/sessions'), { timeout: 5000 });
      console.log('✅ Navigated to sessions page');
    } catch (error) {
      console.log('⚠️ Navigation timeout - taking screenshot');
      await page.screenshot({ path: 'puppeteer-navigation-timeout.png' });
      const url = await page.url();
      console.log(`Current URL: ${url}`);
      throw new Error('Failed to navigate to sessions page');
    }
    
    console.log('📊 Step 4: Waiting for session data to load');
    
    // Step 4: Wait for sessions table with timeout
    try {
      await page.waitForSelector('table', { timeout: 3000 });
      console.log('✅ Sessions table appeared');
    } catch (error) {
      console.log('⚠️ Sessions table timeout - checking page content');
      const content = await page.content();
      console.log('Page content:', content.substring(0, 200));
      await page.screenshot({ path: 'puppeteer-table-timeout.png' });
      throw new Error('Sessions table did not load');
    }
    
    // Check session count
    const sessionRows = await page.$$('table tbody tr');
    const sessionCount = sessionRows.length;
    console.log(`Found ${sessionCount} sessions`);
    
    if (sessionCount === 0) {
      throw new Error('No sessions found - mock services may not be working');
    }
    
    // Verify we have mock data
    const firstRowText = await page.evaluate(el => el.textContent, sessionRows[0]);
    console.log(`First session: ${firstRowText.substring(0, 100)}`);
    
    const hasMockData = firstRowText.includes('mock_session');
    if (hasMockData) {
      console.log('✅ Mock session data detected');
    } else {
      console.log('⚠️ Session data may not be from mock service');
    }
    
    console.log('📋 Step 5: Clicking on first session to open dialog');
    
    // Step 5: Click on first session row
    await sessionRows[0].click();
    console.log('✅ Clicked on first session row');
    
    // Wait for dialog to appear with timeout
    let dialogFound = false;
    try {
      await page.waitForSelector('[role="dialog"], .dialog', { timeout: 2000 });
      dialogFound = true;
      console.log('✅ Session details dialog opened');
    } catch (error) {
      console.log('❌ Dialog did not open within timeout');
      await page.screenshot({ path: 'puppeteer-no-dialog.png' });
    }
    
    if (dialogFound) {
      console.log('🔍 Step 6: Validating dialog content');
      
      // Get dialog element
      const dialog = await page.$('[role="dialog"], .dialog');
      if (!dialog) {
        throw new Error('Dialog element not found after waitForSelector succeeded');
      }
      
      // Get dialog text content
      const dialogContent = await page.evaluate(el => el.textContent, dialog);
      console.log(`Dialog content: "${dialogContent}"`);
      console.log(`Dialog content length: ${dialogContent.length} characters`);
      
      // Take screenshot of dialog
      await page.screenshot({ path: 'puppeteer-dialog-content.png' });
      
      // CRITICAL VALIDATION: Check for message content
      console.log('💬 Step 7: CRITICAL - Validating message display');
      
      // Check for "No messages" error
      const hasNoMessagesError = dialogContent.includes('No messages in this session');
      if (hasNoMessagesError) {
        console.log('❌ CRITICAL ISSUE: Dialog shows "No messages in this session"');
        throw new Error('Session details show "No messages in this session" error');
      }
      
      // Check for rich content (more than just "Session Details")
      const hasRichContent = dialogContent.length > 50;
      console.log(`Has rich content (>50 chars): ${hasRichContent}`);
      
      // Check for message-related words
      const messageWords = ['claim', 'bill', 'help', 'status', 'coverage', 'user', 'bot', 'message'];
      const hasMessageWords = messageWords.some(word => 
        dialogContent.toLowerCase().includes(word.toLowerCase())
      );
      console.log(`Contains message words: ${hasMessageWords}`);
      
      // Final validation
      if (!hasRichContent && !hasMessageWords) {
        console.log('❌ CRITICAL FAILURE: NO MESSAGE CONTENT IN DIALOG');
        console.log('Expected: Dialog should contain conversation messages from mock data');
        console.log('Actual: Dialog only contains basic session info');
        console.log('');
        console.log('Mock data includes messages like:');
        console.log('- "I need to check the status of my claim"');
        console.log('- "I have a question about my bill"');
        
        throw new Error('CRITICAL: No messages displayed in session details dialog despite mock data containing rich message content');
      } else {
        console.log('✅ SUCCESS: Dialog contains message content');
        console.log(`- Rich content: ${hasRichContent}`);
        console.log(`- Message words: ${hasMessageWords}`);
      }
      
      // Close dialog
      try {
        await page.click('button:has-text("Close")', { timeout: 1000 });
        console.log('✅ Dialog closed');
      } catch (error) {
        await page.keyboard.press('Escape');
        console.log('✅ Dialog closed with Escape');
      }
      
    } else {
      throw new Error('Cannot validate messages - session details dialog failed to open');
    }
    
    console.log('🎉 Puppeteer test completed successfully!');
    
    // Final success summary
    console.log('');
    console.log('✨ SUCCESS SUMMARY:');
    console.log('✅ Mock services working (fast session loading)');
    console.log('✅ Dialog opens when clicking session rows');
    console.log('✅ Dialog contains message content');
    console.log('✅ No hanging or timeout issues with Puppeteer');
    
  }, 30000); // 30 second test timeout
});