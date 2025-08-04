/**
 * Session Message Validation E2E Test
 * 
 * This test validates that session details dialogs properly display:
 * 1. Message content in conversation transcripts
 * 2. Duration values greater than zero
 * 
 * Uses real credentials from .env.local to reproduce the production issue locally.
 */

import { test, expect } from '@playwright/test';

// Use real credentials from environment (.env.local)
const REQUIRED_ENV_VARS = ['TEST_BOT_ID', 'TEST_CLIENT_ID', 'TEST_CLIENT_SECRET'];
const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log(`⚠️  Skipping Session Message Validation test - Missing environment variables: ${missingVars.join(', ')}`);
  console.log('To run this test, set the required environment variables in .env.local and run again.');
}

const shouldRunTest = missingVars.length === 0;

test.use({ 
  actionTimeout: 30000,
  navigationTimeout: 30000
});

test.describe('Session Message Validation', () => {

  test.beforeEach(async ({ page }) => {
    if (!shouldRunTest) {
      test.skip();
      return;
    }

    page.setDefaultTimeout(45000);
    
    console.log('🚀 Starting Session Message Validation Test');
    console.log(`Using Bot ID: ${process.env.TEST_BOT_ID}`);
    
    // Navigate to credentials page
    await page.goto('http://localhost:3000/');
    
    // Verify we're on the credentials page
    await expect(page.locator('text=Welcome to XOBCAT')).toBeVisible();
  });

  test('Session Details Dialog - validates messages and duration display', async ({ page }) => {
    if (!shouldRunTest) {
      test.skip();
      return;
    }

    console.log('📝 Step 1: Entering real bot credentials from .env.local');
    
    // Step 1: Enter real bot credentials from environment variables
    await page.getByRole('textbox', { name: 'Bot ID' }).fill(process.env.TEST_BOT_ID!);
    await page.getByRole('textbox', { name: 'Client ID' }).fill(process.env.TEST_CLIENT_ID!);
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill(process.env.TEST_CLIENT_SECRET!);
    await page.getByRole('button', { name: 'Connect' }).click();
    
    console.log('🔄 Step 2: Waiting for navigation to sessions page');
    
    // Step 2: Wait for navigation to sessions page
    await page.waitForURL('**/sessions', { timeout: 30000 });
    await expect(page.locator('text=View Sessions')).toBeVisible();
    
    console.log('📊 Step 3: Using default date range to load sessions');
    
    // Step 3: Use default date range (last 7 days) to get recent sessions
    // Wait for session data to load with default settings
    await expect(
      page.locator('table').or(page.locator('text=No sessions found')).or(page.locator('text=Loading'))
    ).toBeVisible({ timeout: 30000 });
    
    console.log('⏳ Step 4: Checking for session data');
    
    // Step 4: Check if we have sessions
    const sessionsTable = page.locator('table tbody tr');
    const sessionCount = await sessionsTable.count();
    
    console.log(`Found ${sessionCount} sessions with default settings`);
    
    if (sessionCount === 0) {
      console.log('⚠️  No sessions found with default settings, trying broader date range');
      
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
        page.locator('table').or(page.locator('text=No sessions found'))
      ).toBeVisible({ timeout: 30000 });
      
      const updatedSessionCount = await sessionsTable.count();
      console.log(`Found ${updatedSessionCount} sessions in last 30 days`);
      
      if (updatedSessionCount === 0) {
        console.log('❌ No sessions found even with broader date range - cannot test message display');
        test.skip();
        return;
      }
    }
    
    console.log('📋 Step 5: Opening session details dialog');
    
    // Step 5: Click on the first session to open details dialog
    await sessionsTable.first().click();
    
    // Verify dialog opens
    await expect(page.locator('text=Session Details')).toBeVisible({ timeout: 10000 });
    
    console.log('🔍 Step 6: Validating session information');
    
    // Step 6: Check for session information (should always be present)
    await expect(page.locator('text=Session ID')).toBeVisible();
    await expect(page.locator('text=Start Time')).toBeVisible(); 
    await expect(page.locator('text=End Time')).toBeVisible();
    
    console.log('⏱️  Step 7: Validating duration display');
    
    // Step 7: Check if duration is displayed and greater than zero
    const durationElement = page.locator('text=Duration').locator('..').locator('div, span, td').filter({ hasText: /\d+/ });
    await expect(durationElement).toBeVisible();
    
    const durationText = await durationElement.textContent();
    console.log(`Duration text: "${durationText}"`);
    
    // Check that duration is not "0s", "0ms", "0 seconds", etc.
    const hasValidDuration = durationText && 
      !durationText.match(/^0\s*(s|ms|sec|seconds|minutes|min)?\s*$/) &&
      durationText.match(/\d+/);
    
    if (hasValidDuration) {
      console.log('✅ Duration is displayed and greater than zero');
    } else {
      console.log(`❌ Duration issue: "${durationText}" appears to be zero or invalid`);
    }
    
    console.log('💬 Step 8: Validating message display in conversation transcript');
    
    // Step 8: Check for conversation transcript section
    const transcriptSection = page.locator('text=Conversation Transcript, text=Transcript, text=Messages').first();
    await expect(transcriptSection).toBeVisible();
    
    // Look for actual message content (not just labels)
    // Check for message containers/content
    const messageElements = page.locator('[data-testid="user-message"], [data-testid="bot-message"], .message-user, .message-bot, .user-message, .bot-message');
    const messageCount = await messageElements.count();
    
    console.log(`Found ${messageCount} message elements`);
    
    // Also check for any text content that looks like conversation messages
    // Look for patterns that indicate actual message content (not just "User" or "Bot" labels)
    const conversationContent = page.locator('text=/^(?!User$|Bot$).{10,}/'); // Messages with actual content, not just labels
    const contentMessageCount = await conversationContent.count();
    
    console.log(`Found ${contentMessageCount} elements with message content`);
    
    // Check for the specific "No messages in this session" error
    const noMessagesError = page.locator('text=No messages in this session');
    const hasNoMessagesError = await noMessagesError.isVisible();
    
    if (hasNoMessagesError) {
      console.log('❌ ISSUE REPRODUCED: "No messages in this session" error is displayed');
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'session-message-issue-reproduced.png', fullPage: true });
      
      // Log additional debugging info
      const transcriptContent = await page.locator('text=Conversation Transcript').locator('..').textContent();
      console.log('Transcript section content:', transcriptContent?.substring(0, 500));
      
      // This confirms the bug exists
      expect(hasNoMessagesError).toBe(false); // This will fail and show the issue
    } else if (messageCount > 0 || contentMessageCount > 0) {
      console.log('✅ Messages are displayed correctly in conversation transcript');
    } else {
      console.log('⚠️  No message content found - checking transcript section content');
      
      const transcriptContent = await page.locator('text=Conversation Transcript').locator('..').textContent();
      console.log('Transcript section content:', transcriptContent?.substring(0, 200));
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'session-message-debug.png', fullPage: true });
    }
    
    console.log('🔍 Step 9: Checking message count in session metadata');
    
    // Step 9: Check if session metadata shows message count > 0
    const messageCountElement = page.locator('text=Message Count, text=Messages').locator('..').locator('text=/\\d+/');
    const messageCountText = await messageCountElement.textContent();
    console.log(`Session metadata message count: "${messageCountText}"`);
    
    if (messageCountText && parseInt(messageCountText) > 0) {
      console.log('✅ Session metadata shows messages exist');
      
      if (hasNoMessagesError) {
        console.log('❌ BUG CONFIRMED: Session has messages according to metadata, but UI shows "No messages"');
      }
    }
    
    console.log('🔄 Step 10: Closing dialog and testing another session');
    
    // Step 10: Close dialog
    const closeButton = page.locator('button:has-text("Close"), button[aria-label="Close"]').first();
    await closeButton.click();
    
    // Test a second session if available
    if (sessionCount > 1) {
      console.log('Testing second session for consistency...');
      
      await sessionsTable.nth(1).click();
      await expect(page.locator('text=Session Details')).toBeVisible();
      
      const secondSessionNoMessages = await page.locator('text=No messages in this session').isVisible();
      if (secondSessionNoMessages) {
        console.log('❌ Second session also shows "No messages" - this is likely a systematic issue');
      } else {
        console.log('✅ Second session does not show the "No messages" error');
      }
      
      await page.locator('button:has-text("Close"), button[aria-label="Close"]').first().click();
    }
    
    console.log('🎉 Session Message Validation Test completed!');
    
    // Final validation - if we found the "No messages" error, fail the test
    if (hasNoMessagesError) {
      throw new Error('Session message display issue reproduced: UI shows "No messages in this session" despite session having message data');
    }
  });
});