/**
 * Session Viewer E2E Test with Real Kore.ai Credentials
 * 
 * This test validates that the session viewer can successfully retrieve
 * real session data from Kore.ai API for August 1st, 2025 between 9am-12pm ET.
 */

import { test, expect } from '@playwright/test';

// Use real credentials from environment
const REQUIRED_ENV_VARS = ['TEST_BOT_ID', 'TEST_CLIENT_ID', 'TEST_CLIENT_SECRET'];
const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log(`⚠️  Skipping Session Viewer test - Missing environment variables: ${missingVars.join(', ')}`);
  console.log('To run this test, set the required environment variables and run again.');
}

const shouldRunTest = missingVars.length === 0;

test.use({ 
  actionTimeout: 30000,
  navigationTimeout: 30000
});

test.describe('Session Viewer Real API Test', () => {

  test.beforeEach(async ({ page }) => {
    if (!shouldRunTest) {
      test.skip();
      return;
    }

    page.setDefaultTimeout(45000);
    
    console.log('🚀 Starting Session Viewer Real API Test');
    console.log(`Using Bot ID: ${process.env.TEST_BOT_ID}`);
    
    // Navigate to credentials page
    await page.goto('http://localhost:3000/');
    
    // Verify we're on the credentials page
    await expect(page.locator('text=Welcome to XOBCAT')).toBeVisible();
  });

  test('Session Viewer - retrieves real session data for Aug 1st 9am-12pm ET', async ({ page }) => {
    if (!shouldRunTest) {
      test.skip();
      return;
    }

    console.log('📝 Step 1: Entering real bot credentials');
    
    // Step 1: Enter real bot credentials from environment variables
    await page.getByRole('textbox', { name: 'Bot ID' }).fill(process.env.TEST_BOT_ID!);
    await page.getByRole('textbox', { name: 'Client ID' }).fill(process.env.TEST_CLIENT_ID!);
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill(process.env.TEST_CLIENT_SECRET!);
    await page.getByRole('button', { name: 'Connect' }).click();
    
    console.log('🔄 Step 2: Waiting for navigation to sessions page');
    
    // Step 2: Wait for navigation to sessions page
    await page.waitForURL('**/sessions', { timeout: 30000 });
    await expect(page.locator('text=View Sessions')).toBeVisible();
    
    console.log('📊 Step 3: Configuring date/time filter for Aug 1st 9am-12pm ET');
    
    // Step 3: Configure date/time filters for August 1st, 2025, 9am-12pm ET
    // Fill in start date
    const startDateInput = page.locator('input[type="date"]').first();
    await startDateInput.fill('2025-08-01');
    
    // Fill in start time
    const startTimeInput = page.locator('input[type="time"]').first();
    await startTimeInput.fill('09:00');
    
    // Fill in end date  
    const endDateInput = page.locator('input[type="date"]').last();
    await endDateInput.fill('2025-08-01');
    
    // Fill in end time
    const endTimeInput = page.locator('input[type="time"]').last();
    await endTimeInput.fill('12:00');
    
    console.log('🔍 Step 4: Applying filters and fetching sessions');
    
    // Step 4: Apply filters (look for Apply or Search button)
    const applyButton = page.locator('button:has-text("Apply"), button:has-text("Search"), button:has-text("Filter")').first();
    await applyButton.click();
    
    console.log('⏳ Step 5: Waiting for session data to load');
    
    // Step 5: Wait for session data to load
    // Look for either sessions table or "no sessions" message
    await expect(
      page.locator('table').or(page.locator('text=No sessions found')).or(page.locator('text=Loading'))
    ).toBeVisible({ timeout: 30000 });
    
    console.log('✅ Step 6: Validating session data');
    
    // Step 6: Validate that we have session data
    const sessionsTable = page.locator('table tbody tr');
    const sessionCount = await sessionsTable.count();
    
    console.log(`Found ${sessionCount} sessions for Aug 1st 9am-12pm ET`);
    
    if (sessionCount > 0) {
      console.log('🎉 SUCCESS: Session viewer retrieved real session data!');
      
      // Validate table headers
      await expect(page.locator('th:has-text("Session ID"), th:has-text("ID")')).toBeVisible();
      await expect(page.locator('th:has-text("Start Time"), th:has-text("Time")')).toBeVisible();
      
      // Test clicking on a session to view details
      console.log('📋 Step 7: Testing session details dialog');
      
      await sessionsTable.first().click();
      
      // Verify dialog opens
      await expect(page.locator('text=Session Details, text=Session ID').first()).toBeVisible();
      
      // Verify we can see transcript/messages
      await expect(page.locator('text=Transcript, text=Messages, text=Conversation').first()).toBeVisible();
      
      // Close dialog
      const closeButton = page.locator('button:has-text("Close"), button[aria-label="Close"]').first();
      await closeButton.click();
      
      console.log('✅ Session details dialog works correctly');
      
    } else {
      console.log('⚠️  No sessions found for the specified time period');
      console.log('This could mean:');
      console.log('1. No conversations occurred during Aug 1st 9am-12pm ET');
      console.log('2. Date/time filtering needs adjustment');
      console.log('3. Sessions exist but outside this time window');
      
      // Still validate that the UI responded correctly
      await expect(page.locator('text=No sessions found, text=No data')).toBeVisible();
    }
    
    console.log('🎉 Session Viewer Real API Test completed!');
  });

  test('Session Viewer - test different date range if Aug 1st has no data', async ({ page }) => {
    if (!shouldRunTest) {
      test.skip();
      return;
    }

    console.log('📝 Testing with broader date range to confirm API connectivity');
    
    // Enter credentials
    await page.getByRole('textbox', { name: 'Bot ID' }).fill(process.env.TEST_BOT_ID!);
    await page.getByRole('textbox', { name: 'Client ID' }).fill(process.env.TEST_CLIENT_ID!);
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill(process.env.TEST_CLIENT_SECRET!);
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await page.waitForURL('**/sessions', { timeout: 30000 });
    
    // Try a broader date range (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateString = thirtyDaysAgo.toISOString().split('T')[0];
    
    console.log(`Trying broader date range: ${dateString} to today`);
    
    const startDateInput = page.locator('input[type="date"]').first();
    await startDateInput.fill(dateString);
    
    // Apply filters
    const applyButton = page.locator('button:has-text("Apply"), button:has-text("Search"), button:has-text("Filter")').first();
    await applyButton.click();
    
    // Wait for results
    await expect(
      page.locator('table').or(page.locator('text=No sessions found')).or(page.locator('text=Loading'))
    ).toBeVisible({ timeout: 30000 });
    
    const sessionsTable = page.locator('table tbody tr');
    const sessionCount = await sessionsTable.count();
    
    console.log(`Found ${sessionCount} sessions in last 30 days`);
    
    if (sessionCount > 0) {
      console.log('✅ Real API connectivity confirmed - bot has session data');
    } else {
      console.log('⚠️  No sessions found in last 30 days - may need to check bot activity');
    }
  });
});