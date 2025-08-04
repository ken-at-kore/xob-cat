/**
 * Session Viewer E2E Test with Real Kore.ai API - Improved Version
 * 
 * This test validates that the session viewer can successfully retrieve
 * real session data and open session details modals without hanging.
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
  actionTimeout: 15000,
  navigationTimeout: 20000
});

test.describe('Session Viewer Real API Test - Improved', () => {

  test.beforeEach(async ({ page }) => {
    if (!shouldRunTest) {
      test.skip();
      return;
    }

    page.setDefaultTimeout(30000);
    
    console.log('🚀 Starting Session Viewer Real API Test (Improved)');
    console.log(`Using Bot ID: ${process.env.TEST_BOT_ID}`);
    
    // Navigate to credentials page
    await page.goto('http://localhost:3000/');
    
    // Verify we're on the credentials page
    await expect(page.locator('text=Welcome to XOBCAT')).toBeVisible();
  });

  test('validates sessions load and session details work with real API', async ({ page }) => {
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
    await page.waitForURL('**/sessions', { timeout: 20000 });
    await expect(page.locator('text=View Sessions')).toBeVisible();
    
    console.log('📊 Step 3: Using default date range and waiting for session data');
    
    // Step 3: Wait for session data with timeout protection
    let sessionCount = 0;
    try {
      // Wait for either sessions to load or an error/no data state
      await Promise.race([
        page.locator('table tbody tr').first().waitFor({ timeout: 30000 }),
        page.locator('text=No sessions found').waitFor({ timeout: 30000 }),
        page.locator('text=Error').waitFor({ timeout: 30000 })
      ]);
      
      // Check how many sessions we got
      const sessionsTable = page.locator('table tbody tr');
      sessionCount = await sessionsTable.count();
      console.log(`Found ${sessionCount} sessions with default date range`);
      
    } catch (error) {
      console.log('⚠️  Timeout or error loading sessions - checking page state...');
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'real-api-session-loading-timeout.png', fullPage: true });
      
      // Check what's actually displayed
      const isLoading = await page.locator('text=Loading').isVisible();
      const hasError = await page.locator('text=Error').isVisible();
      const noSessions = await page.locator('text=No sessions found').isVisible();
      
      if (isLoading) {
        console.log('❌ Still loading after timeout - API call likely hanging');
        throw new Error('Sessions API call is hanging - check backend performance');
      } else if (hasError) {
        console.log('❌ Error state detected');
        const pageContent = await page.textContent('body');
        console.log('Error page content:', pageContent?.substring(0, 500));
        throw new Error('API error occurred while loading sessions');
      } else if (noSessions) {
        console.log('📭 No sessions found with default date range');
        sessionCount = 0;
      } else {
        console.log('❓ Unknown state - taking screenshot and continuing...');
        await page.screenshot({ path: 'real-api-unknown-state.png', fullPage: true });
      }
    }
    
    // If no sessions with default range, try a broader date range
    if (sessionCount === 0) {
      console.log('🔍 Step 4: Trying broader date range (last 30 days)');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateString = thirtyDaysAgo.toISOString().split('T')[0];
      
      console.log(`Trying date range: ${dateString} to today`);
      
      // Fill in broader start date
      const startDateInput = page.locator('input[type="date"]').first();
      await startDateInput.fill(dateString);
      
      // Apply filters
      const applyButton = page.locator('button:has-text("Apply"), button:has-text("Search"), button:has-text("Filter")').first();
      await applyButton.click();
      
      // Wait for results with timeout protection
      try {
        await Promise.race([
          page.locator('table tbody tr').first().waitFor({ timeout: 30000 }),
          page.locator('text=No sessions found').waitFor({ timeout: 30000 }),
          page.locator('text=Error').waitFor({ timeout: 30000 })
        ]);
        
        const updatedSessionsTable = page.locator('table tbody tr');
        sessionCount = await updatedSessionsTable.count();
        console.log(`Found ${sessionCount} sessions in last 30 days`);
        
      } catch (broadError) {
        console.log('❌ Timeout even with broader date range');
        await page.screenshot({ path: 'real-api-broad-range-timeout.png', fullPage: true });
        throw new Error('API calls are consistently timing out - check backend/network connectivity');
      }
    }
    
    if (sessionCount === 0) {
      console.log('📭 No sessions found even with broader date range');
      console.log('This could indicate:');
      console.log('- No bot activity in the time period');
      console.log('- Credential or API connectivity issues');
      console.log('- Date range needs further adjustment');
      
      // Validate the "no sessions" state is properly displayed
      await expect(page.locator('text=No sessions found, text=0 sessions')).toBeVisible();
      console.log('✅ "No sessions" state properly displayed');
      
      // Skip the dialog testing part since we have no data
      console.log('⏭️  Skipping session dialog tests due to no session data');
      return;
    }
    
    console.log('📋 Step 5: Testing session details dialog');
    
    // Step 5: Click on the first session to test dialog functionality
    const sessionsTable = page.locator('table tbody tr');
    
    // Get session info before clicking for validation
    const firstRowText = await sessionsTable.first().textContent();
    console.log(`First session row text: ${firstRowText?.substring(0, 100)}`);
    
    await sessionsTable.first().click();
    
    // Wait for dialog to open with timeout protection
    let dialogOpened = false;
    try {
      await expect(page.locator('text=Session Details, [role="dialog"], [aria-label*="Session"]').first()).toBeVisible({ timeout: 10000 });
      dialogOpened = true;
      console.log('✅ Session details dialog opened successfully');
    } catch (dialogError) {
      console.log('❌ Session details dialog did not open');
      await page.screenshot({ path: 'real-api-dialog-not-opened.png', fullPage: true });
      
      // Check for any error messages or loading states
      const hasDialogError = await page.locator('text=Error').isVisible();
      const isDialogLoading = await page.locator('text=Loading').isVisible();
      
      if (hasDialogError) {
        console.log('❌ Error loading session details');
        throw new Error('Session details dialog shows error state');
      } else if (isDialogLoading) {
        console.log('⏳ Dialog still loading - API call may be slow');
        // Wait a bit longer for loading to complete
        try {
          await page.waitForTimeout(5000);
          await expect(page.locator('text=Session Details, [role="dialog"]').first()).toBeVisible({ timeout: 5000 });
          dialogOpened = true;
          console.log('✅ Dialog opened after extended wait');
        } catch {
          throw new Error('Session details dialog is hanging on load');
        }
      } else {
        throw new Error('Session row click did not trigger dialog opening');
      }
    }
    
    if (dialogOpened) {
      console.log('🔍 Step 6: Validating session details content');
      
      const dialog = page.locator('[role="dialog"], text=Session Details').first();
      
      // Check for basic session information
      await expect(dialog.locator('text=Session ID, text=Start Time, text=End Time').first()).toBeVisible();
      console.log('✅ Basic session information displayed');
      
      // Check for duration
      const durationElement = dialog.locator('text=Duration').locator('..').locator('text=/\\d+/');
      const hasDuration = await durationElement.count() > 0;
      if (hasDuration) {
        const durationText = await durationElement.first().textContent();
        console.log(`✅ Duration displayed: ${durationText}`);
      } else {
        console.log('⚠️  Duration not found or zero');
      }
      
      console.log('💬 Step 7: Validating message display');
      
      // Check for conversation transcript
      const hasTranscriptSection = await dialog.locator('text=Conversation, text=Transcript, text=Messages').count() > 0;
      if (hasTranscriptSection) {
        console.log('✅ Conversation transcript section found');
        
        // Check for the "No messages" error that we're testing for
        const noMessagesError = await dialog.locator('text=No messages in this session').isVisible();
        if (noMessagesError) {
          console.log('❌ ISSUE CONFIRMED: "No messages in this session" error displayed');
          await page.screenshot({ path: 'real-api-no-messages-error.png', fullPage: true });
          
          // Get session metadata to see if it shows message count > 0
          const sessionMetadata = await dialog.textContent();
          console.log('Session metadata:', sessionMetadata?.substring(0, 500));
          
          throw new Error('Session details show "No messages in this session" despite having session data');
        } else {
          // Look for actual message content
          const messageElements = await dialog.locator('text=/[A-Za-z]{10,}/', { hasNotText: /^(User|Bot|Session|Start|End|Duration)$/ }).count();
          if (messageElements > 0) {
            console.log(`✅ Found ${messageElements} message content elements`);
          } else {
            console.log('⚠️  No obvious message content found');
            await page.screenshot({ path: 'real-api-no-message-content.png', fullPage: true });
          }
        }
      } else {
        console.log('⚠️  No conversation transcript section found');
      }
      
      console.log('🔄 Step 8: Closing dialog');
      
      // Close the dialog
      const closeButton = dialog.locator('button:has-text("Close"), button[aria-label="Close"], button:has-text("×")').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        console.log('✅ Dialog closed successfully');
      } else {
        await page.keyboard.press('Escape');
        console.log('✅ Dialog closed with Escape key');
      }
    }
    
    console.log('🎉 Real API Session Viewer Test completed!');
  });
});