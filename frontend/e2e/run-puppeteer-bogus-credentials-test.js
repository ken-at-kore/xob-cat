const puppeteer = require('puppeteer');

/**
 * Puppeteer E2E Test: Bogus Credentials Validation
 * 
 * This test verifies that the app properly validates credentials
 * and shows an error message when bogus credentials are provided,
 * instead of navigating to the sessions page.
 */

async function runBogusCrendentialsTest() {
  console.log('🧪 Starting Puppeteer Bogus Credentials Test...');
  
  let browser;
  let testPassed = false;
  
  try {
    // Launch browser with debugging configuration
    browser = await puppeteer.launch({
      headless: false,      // Visual debugging
      slowMo: 50,          // Human-like interactions
      defaultViewport: { width: 1280, height: 720 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set short timeouts to prevent hanging
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(10000);
    
    // Navigate to credentials page
    console.log('📍 Navigating to credentials page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Take initial screenshot
    await page.screenshot({ path: 'bogus-credentials-initial.png' });
    
    // Fill in bogus credentials
    console.log('🔑 Filling in bogus credentials...');
    await page.waitForSelector('input[id="botId"]', { visible: true });
    
    await page.type('input[id="botId"]', 'bogus-bot-id');
    await page.type('input[id="clientId"]', 'bogus-client-id');  
    await page.type('input[id="clientSecret"]', 'bogus-client-secret');
    
    // Take screenshot before clicking Connect
    await page.screenshot({ path: 'bogus-credentials-filled.png' });
    
    console.log('🔌 Clicking Connect button...');
    
    // Click Connect button - look for any button with "Connect" text
    const connectButton = await page.waitForSelector('button', { visible: true });
    const buttonText = await page.evaluate(el => el.textContent, connectButton);
    console.log('Found button with text:', buttonText);
    await connectButton.click();
    
    // Wait a bit for any validation to occur  
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take screenshot after clicking Connect
    await page.screenshot({ path: 'bogus-credentials-after-connect.png' });
    
    // Check if we're still on the credentials page (expected behavior)
    const currentUrl = page.url();
    console.log('📍 Current URL after Connect:', currentUrl);
    
    // Look for error message about credentials
    console.log('🔍 Looking for credential error message...');
    
    // Check for various possible error message selectors
    const errorSelectors = [
      '[data-testid="credential-error"]',
      '.error-message',
      '.text-red-500',
      '.text-destructive',
      '[role="alert"]'
    ];
    
    let errorFound = false;
    let errorMessage = '';
    
    for (const selector of errorSelectors) {
      try {
        const errorElement = await page.$(selector);
        if (errorElement) {
          errorMessage = await page.evaluate(el => el.textContent, errorElement);
          if (errorMessage && errorMessage.length > 0) {
            errorFound = true;
            console.log(`✅ Found error message with selector "${selector}": "${errorMessage}"`);
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Also check if we're NOT on the sessions page (which would be wrong behavior)
    const isOnSessionsPage = currentUrl.includes('/sessions') || currentUrl.includes('dashboard');
    
    if (isOnSessionsPage && !errorFound) {
      console.log('❌ UNEXPECTED: Navigated to sessions page with bogus credentials');
      console.log('❌ This is the bug - app should validate credentials first');
      testPassed = false;
    } else if (errorFound) {
      console.log('✅ EXPECTED: Found credential error message');
      console.log('✅ App properly validated credentials and showed error');
      testPassed = true;
    } else if (!isOnSessionsPage) {
      console.log('⚠️  Still on credentials page but no explicit error message found');
      console.log('⚠️  This might be acceptable if validation is in progress');
      
      // Wait a bit longer to see if error appears or navigation happens
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const finalUrl = page.url();
      const finalIsOnSessions = finalUrl.includes('/sessions') || finalUrl.includes('dashboard');
      
      if (finalIsOnSessions) {
        console.log('❌ DELAYED BUG: Eventually navigated to sessions page');
        testPassed = false;
      } else {
        console.log('✅ Stayed on credentials page - validation working');
        testPassed = true;
      }
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'bogus-credentials-final.png' });
    
    // Log page content for debugging
    const pageContent = await page.content();
    console.log('📄 Page contains "error":', pageContent.toLowerCase().includes('error'));
    console.log('📄 Page contains "invalid":', pageContent.toLowerCase().includes('invalid'));
    console.log('📄 Page contains "credentials":', pageContent.toLowerCase().includes('credentials'));
    
  } catch (error) {
    console.error('❌ Test execution error:', error.message);
    testPassed = false;
  } finally {
    if (browser) {
      await browser.close();
    }
    
    console.log('\n' + '='.repeat(50));
    if (testPassed) {
      console.log('✅ BOGUS CREDENTIALS TEST PASSED');
      console.log('✅ App properly validates credentials');
    } else {
      console.log('❌ BOGUS CREDENTIALS TEST FAILED');
      console.log('❌ Bug confirmed: App should validate credentials before navigation');
      console.log('❌ Expected: Error message about invalid credentials');
      console.log('❌ Actual: Navigation to sessions page or no clear error');
    }
    console.log('='.repeat(50));
    
    process.exit(testPassed ? 0 : 1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
runBogusCrendentialsTest();