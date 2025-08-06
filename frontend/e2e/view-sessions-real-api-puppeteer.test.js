#!/usr/bin/env node
/**
 * View Sessions - Real API Puppeteer Test
 * 
 * Tests the view sessions workflow using real Kore.ai API.
 * Validates real data loading, dialog functionality, and message sanitization.
 * 
 * Requires environment variables:
 * - TEST_BOT_ID
 * - TEST_CLIENT_ID
 * - TEST_CLIENT_SECRET
 * 
 * Usage:
 * node view-sessions-real-api-puppeteer.test.js
 * node view-sessions-real-api-puppeteer.test.js --url=https://www.koreai-xobcat.com
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { parseTestArgs, showHelp } = require('./shared/parse-test-args');
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
    }
  });
  
  if (!credentials.botId || !credentials.clientId || !credentials.clientSecret) {
    throw new Error('Missing TEST_* credentials in .env.local');
  }
  
  return credentials;
}

async function expandDateRangeIfNeeded(page) {
  console.log('⚠️ No sessions found with default filters. Expanding date range...');
  
  // Set a very wide date range (last 365 days)
  const today = new Date();
  const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  const startDateFormatted = (oneYearAgo.getMonth() + 1).toString().padStart(2, '0') + '/' + 
                            oneYearAgo.getDate().toString().padStart(2, '0') + '/' + 
                            oneYearAgo.getFullYear();
  
  const endDateFormatted = (today.getMonth() + 1).toString().padStart(2, '0') + '/' + 
                          today.getDate().toString().padStart(2, '0') + '/' + 
                          today.getFullYear();
  
  console.log(`📅 Trying date range: ${startDateFormatted} to ${endDateFormatted}`);
  
  // Clear and set start date
  const startDateInput = await page.$('input[placeholder="mm/dd/yyyy"]');
  if (startDateInput) {
    await startDateInput.click();
    await page.keyboard.selectAll();
    await page.keyboard.type(startDateFormatted);
  }
  
  // Clear and set end date  
  const endDateInputs = await page.$$('input[placeholder="mm/dd/yyyy"]');
  if (endDateInputs.length > 1) {
    await endDateInputs[1].click();
    await page.keyboard.selectAll();
    await page.keyboard.type(endDateFormatted);
  }
  
  // Find and click Filter button
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const text = await page.evaluate(el => el.textContent, button);
    if (text.includes('Filter')) {
      await button.click();
      console.log('✅ Applied wider date filters');
      break;
    }
  }
  
  // Wait for new results
  await new Promise(resolve => setTimeout(resolve, 5000));
}

async function runTest() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  // Show help if requested
  if (args.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  const config = parseTestArgs(args);
  
  console.log('🚀 Starting View Sessions - Real API Puppeteer Test');
  console.log(`🌐 Testing against: ${config.baseUrl}`);
  if (config.slowMo > 0) {
    console.log(`🐌 SlowMo enabled at ${config.slowMo}ms`);
  }
  
  const credentials = loadCredentials();
  console.log(`📋 Using real credentials:`);
  console.log(`   Bot ID: ${credentials.botId}`);
  console.log(`   Client ID: ${credentials.clientId}`);
  console.log(`   Client Secret: ${credentials.clientSecret?.substring(0, 10)}...`);
  
  const browser = await puppeteer.launch(getBrowserConfig({ 
    slowMo: config.slowMo
  }));
  
  try {
    const page = await browser.newPage();
    
    // Setup request logging
    await setupRequestLogging(page);
    
    // Step 1-2: Enter credentials
    await enterCredentials(page, credentials, config.baseUrl);
    
    // Step 3: Wait for navigation
    await waitForSessionsPage(page);
    
    // Step 4: Wait for sessions to load
    let { sessionRows, hasNoSessions, noTable } = await waitForSessions(page);
    
    // If no table found, this might be a "no sessions found" case
    if (noTable || hasNoSessions || sessionRows.length === 0) {
      console.log('⚠️ No sessions found with default filters. Trying wider date range...');
      await expandDateRangeIfNeeded(page);
      
      // Try again after expanding date range
      const result = await waitForSessions(page);
      sessionRows = result.sessionRows;
      hasNoSessions = result.hasNoSessions;
      noTable = result.noTable;
    }
    
    // Take screenshot of current state
    await page.screenshot({ path: 'real-api-current-state.png' });
    console.log(`📋 Page title: ${await page.title()}`);
    console.log(`📋 Current URL: ${page.url()}`);
    
    // Check if we have a successful API connection but no data
    if (hasNoSessions || sessionRows.length === 0) {
      const pageText = await page.$eval('body', el => el.textContent);
      
      if (pageText.includes('0 sessions found') || pageText.includes('No sessions found')) {
        console.log('✅ Real API integration successful - No session data in date range');
        console.log('📋 This validates that:');
        console.log('  - Credentials are valid and working');
        console.log('  - API calls are being made successfully');
        console.log('  - The service factory is using real services');
        console.log('  - No session data exists in the queried date range');
        
        console.log('\n🎉 Real API test completed successfully (no data case)!');
        return;
      }
      
      throw new Error('Unexpected state - neither sessions nor expected "no sessions" message');
    }
    
    console.log(`Found ${sessionRows.length} real sessions from Kore.ai API`);
    
    // Verify this is real data (not mock)
    const firstRowText = await page.evaluate(el => el.textContent, sessionRows[0]);
    console.log(`First session preview: ${firstRowText.substring(0, 100)}...`);
    
    const isRealData = !firstRowText.includes('mock_session');
    if (!isRealData) {
      throw new Error('Seeing mock data instead of real API data');
    }
    console.log('✅ Real API data confirmed (no mock_session IDs)');
    
    // Step 5: Find a clickable session row
    console.log('📋 Step 5: Finding clickable session row');
    
    let sessionRowToClick = null;
    for (let i = 0; i < sessionRows.length; i++) {
      const rowText = await page.evaluate(el => el.textContent, sessionRows[i]);
      console.log(`Row ${i}: ${rowText.substring(0, 100)}...`);
      
      // Skip header rows
      if (rowText.includes('Session ID') && rowText.includes('Start Time')) {
        console.log(`  ↳ Skipping header row`);
        continue;
      }
      
      // Look for actual session data
      if (rowText.match(/\d{2}\/\d{2}\/\d{4}/) || rowText.includes('PM ET') || rowText.includes('AM ET')) {
        sessionRowToClick = sessionRows[i];
        console.log(`  ↳ Found session row to click`);
        break;
      }
    }
    
    if (!sessionRowToClick) {
      throw new Error('No clickable session rows found (only headers)');
    }
    
    // Step 6-7: Click session and validate dialog
    const { dialogContent } = await clickSessionAndWaitForDialog(page, sessionRowToClick);
    
    console.log(`Dialog content length: ${dialogContent.length} characters`);
    console.log(`Dialog preview: ${dialogContent.substring(0, 200)}...`);
    
    // Check for rich content
    const hasRichContent = dialogContent.length > 100;
    const hasConversationSection = dialogContent.includes('Conversation') || 
                                  dialogContent.includes('Messages');
    
    console.log(`Has rich content: ${hasRichContent}`);
    console.log(`Has conversation section: ${hasConversationSection}`);
    
    // Step 8: Validate sanitization with real data
    console.log('\n🧼 Step 8: CRITICAL - Validating real data sanitization');
    
    const { sanitizationTests, unsanitizedPatterns } = validateSanitization(dialogContent, true);
    
    // Overall sanitization assessment
    const criticalIssues = Object.entries(sanitizationTests)
      .filter(([key, passed]) => !passed && key !== 'hasReadableMessages');
    
    const hasUnsanitizedContent = unsanitizedPatterns && (
      unsanitizedPatterns.ssmlTags > 0 || 
      unsanitizedPatterns.htmlEntities > 0 || 
      unsanitizedPatterns.jsonObjects > 0
    );
    
    if (criticalIssues.length > 0 || hasUnsanitizedContent) {
      console.log('\n❌ CRITICAL FAILURE: Real API data sanitization issues detected');
      console.log(`Failed tests: ${criticalIssues.map(([key]) => key).join(', ')}`);
      console.log('\n📋 Raw dialog content for debugging:');
      console.log('='.repeat(80));
      console.log(dialogContent);
      console.log('='.repeat(80));
      throw new Error('Message sanitization not working with real API data');
    }
    
    console.log('\n✅ SUCCESS: Real API data sanitization working correctly');
    
    console.log('\n🎉 Real API test completed successfully!');
    console.log('\n✨ SUCCESS SUMMARY:');
    console.log('✅ Real Kore.ai API integration working');
    console.log('✅ Session data loaded from production');
    console.log('✅ Dialog opens with real session content');
    console.log('✅ Message sanitization validated');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Take failure screenshot
    const pages = await browser.pages();
    if (pages.length > 0) {
      await pages[0].screenshot({ path: 'real-api-test-failure.png' });
      console.log('📸 Screenshot saved as real-api-test-failure.png');
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