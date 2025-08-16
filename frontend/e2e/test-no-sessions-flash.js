#!/usr/bin/env node
/**
 * Test to verify "No sessions found" doesn't flash during initial load
 */

const puppeteer = require('puppeteer');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

const REAL_CREDENTIALS = {
  botId: process.env.TEST_BOT_ID,
  clientId: process.env.TEST_CLIENT_ID,
  clientSecret: process.env.TEST_CLIENT_SECRET
};

async function runTest() {
  console.log('🧪 Testing for "No sessions found" flash issue...');
  
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 25,
    defaultViewport: { width: 1280, height: 720 }
  });
  
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  
  let noSessionsMessageSeen = false;
  let sessionsLoaded = false;
  
  // Monitor for "No sessions found" message
  page.on('domcontentloaded', async () => {
    try {
      const content = await page.content();
      if (content.includes('No sessions found') && !sessionsLoaded) {
        noSessionsMessageSeen = true;
        console.log('❌ BUG DETECTED: "No sessions found" appeared before sessions loaded!');
      }
    } catch (e) {
      // Page might have navigated
    }
  });
  
  // Navigate to credentials page
  await page.goto('http://localhost:3000');
  await page.waitForSelector('#botId', { visible: true });
  
  // Enter credentials
  await page.type('#botId', REAL_CREDENTIALS.botId);
  await page.type('#clientId', REAL_CREDENTIALS.clientId);
  await page.type('#clientSecret', REAL_CREDENTIALS.clientSecret);
  
  // Click connect
  await page.click('button');
  
  // Wait for navigation to sessions page
  await page.waitForFunction(() => window.location.pathname === '/sessions', { timeout: 10000 });
  
  // Monitor page content during loading
  console.log('📊 Monitoring page during session loading...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < 20000) { // Monitor for up to 20 seconds
    try {
      const content = await page.content();
      
      // Check if "No sessions found" appears
      if (content.includes('No sessions found') && !sessionsLoaded) {
        noSessionsMessageSeen = true;
        console.log('❌ "No sessions found" message detected at', ((Date.now() - startTime) / 1000).toFixed(1), 'seconds');
        await page.screenshot({ path: 'no-sessions-flash-bug.png' });
      }
      
      // Check if sessions have loaded
      const sessionRows = await page.$$('tr[data-testid="session-row"]');
      if (sessionRows.length > 0 && !sessionsLoaded) {
        sessionsLoaded = true;
        console.log('✅ Sessions loaded at', ((Date.now() - startTime) / 1000).toFixed(1), 'seconds');
        console.log('   Found', sessionRows.length, 'sessions');
      }
      
      // Also check for the actual table rows
      const tableRows = await page.$$('tbody tr');
      if (tableRows.length > 0 && !sessionsLoaded) {
        sessionsLoaded = true;
        console.log('✅ Sessions loaded at', ((Date.now() - startTime) / 1000).toFixed(1), 'seconds');
        console.log('   Found', tableRows.length, 'sessions in table');
      }
      
      if (sessionsLoaded) break;
      
    } catch (e) {
      // Continue monitoring
    }
    
    await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
  }
  
  await browser.close();
  
  // Report results
  console.log('\n📋 TEST RESULTS:');
  if (noSessionsMessageSeen) {
    console.log('❌ FAILED: "No sessions found" message appeared during loading');
    console.log('   This is the bug that was reported - the message flashes before sessions load');
    process.exit(1);
  } else if (!sessionsLoaded) {
    console.log('⚠️ WARNING: Sessions never loaded');
    process.exit(1);
  } else {
    console.log('✅ PASSED: No flash of "No sessions found" message during loading');
    console.log('   The fix is working correctly!');
    process.exit(0);
  }
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});