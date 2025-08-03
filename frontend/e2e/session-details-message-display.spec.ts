/**
 * Session Details Message Display E2E Test
 * 
 * This test validates that individual messages are properly displayed in both:
 * 1. Session Viewer - SessionDetailsDialog 
 * 2. Auto-Analysis Report - AnalyzedSessionDetailsDialog
 * 
 * Tests both mock data (for reliable CI) and real API credentials (for production validation).
 */

import { test, expect } from '@playwright/test';

// Use real credentials for production testing (optional)
const REQUIRED_ENV_VARS = ['TEST_BOT_ID', 'TEST_CLIENT_ID', 'TEST_CLIENT_SECRET', 'TEST_OPENAI_API_KEY'];
const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);
const hasRealCredentials = missingVars.length === 0;

if (!hasRealCredentials) {
  console.log(`ℹ️  Real API credentials not available. Running with mock data only.`);
  console.log(`   Missing: ${missingVars.join(', ')}`);
}

test.use({ 
  actionTimeout: 30000,
  navigationTimeout: 30000
});

test.describe('Session Details Message Display', () => {

  test.beforeEach(async ({ page }) => {
    // Set longer timeout for potential API calls
    page.setDefaultTimeout(45000);
    
    console.log('🚀 Starting Session Details Message Display Test');
    
    // Navigate to credentials page
    await page.goto('http://localhost:3000/');
    
    // Verify we're on the credentials page
    await expect(page.locator('text=Welcome to XOBCAT')).toBeVisible();
  });

  test('Session Viewer - validates message display in session details modal (Mock Data)', async ({ page }) => {
    console.log('📝 Testing Session Viewer with Mock Data');
    
    // Step 1: Use mock credentials (these trigger mock service responses)
    const mockBotId = 'st-mock-bot-id-12345';
    const mockClientId = 'cs-mock-client-id-67890'; 
    const mockClientSecret = 'mock-client-secret-abcdef';
    
    await page.getByRole('textbox', { name: 'Bot ID' }).fill(mockBotId);
    await page.getByRole('textbox', { name: 'Client ID' }).fill(mockClientId);
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill(mockClientSecret);
    await page.getByRole('button', { name: 'Connect' }).click();
    
    console.log('🔄 Step 2: Waiting for navigation to sessions page');
    
    // Step 2: Wait for navigation to sessions page
    await page.waitForURL('**/sessions', { timeout: 30000 });
    await expect(page.locator('text=View Sessions')).toBeVisible();
    
    console.log('📊 Step 3: Waiting for mock session data to load');
    
    // Step 3: Wait for mock session data to load (should be fast with mocks)
    await expect(page.locator('table tbody tr')).toBeVisible({ timeout: 15000 });
    
    const sessionRows = page.locator('table tbody tr');
    const sessionCount = await sessionRows.count();
    
    console.log(`Found ${sessionCount} mock sessions`);
    expect(sessionCount).toBeGreaterThan(0);
    
    console.log('🔍 Step 4: Opening first session details dialog');
    
    // Step 4: Click on first session to open details dialog
    await sessionRows.first().click();
    
    // Step 5: Verify dialog opens
    await expect(page.locator('text=Session Details').first()).toBeVisible();
    await expect(page.locator('text=Session Information')).toBeVisible();
    await expect(page.locator('text=Conversation')).toBeVisible();
    
    console.log('💬 Step 6: Validating message display');
    
    // Step 6: Critical test - verify messages are displayed
    const conversationSection = page.locator('h3:has-text("Conversation")').locator('..').locator('div').last();
    
    // Check if we have messages or "no messages" message
    const hasMessages = await conversationSection.locator('div:has-text("User"), div:has-text("Bot")').count() > 0;
    const hasNoMessagesText = await conversationSection.locator('text=No messages in this session').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasMessages) {
      console.log('✅ SUCCESS: Messages are displayed in session details');
      
      // Validate message structure
      const messageElements = conversationSection.locator('div[class*="flex gap-3"]');
      const messageCount = await messageElements.count();
      
      console.log(`Found ${messageCount} messages in session details`);
      expect(messageCount).toBeGreaterThan(0);
      
      // Check first message structure
      const firstMessage = messageElements.first();
      await expect(firstMessage.locator('text=User, text=Bot').first()).toBeVisible();
      
      // Verify message content is visible (not empty)
      const messageContent = await firstMessage.locator('div.text-sm').last().textContent();
      expect(messageContent?.trim().length).toBeGreaterThan(0);
      
      console.log(`First message content preview: "${messageContent?.substring(0, 50)}..."`);
      
    } else if (hasNoMessagesText) {
      console.log('⚠️  WARNING: No messages displayed - shows "No messages in this session"');
      console.log('This indicates a regression in message loading or display logic');
      
      // This is the bug we're looking for - fail the test
      throw new Error('REGRESSION DETECTED: Session details dialog shows "No messages in this session" for mock data that should have messages');
      
    } else {
      console.log('❌ ERROR: Cannot determine message display state');
      throw new Error('Unable to detect message display state in session details dialog');
    }
    
    console.log('🔒 Step 7: Closing dialog');
    
    // Step 7: Close dialog
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('text=Session Details').first()).not.toBeVisible();
    
    console.log('✅ Mock data session details test completed');
  });

  test('Auto-Analysis - validates message display in analyzed session details modal (Mock Data)', async ({ page }) => {
    console.log('📝 Testing Auto-Analysis with Mock Data');
    
    // Step 1: Use mock credentials
    await page.getByRole('textbox', { name: 'Bot ID' }).fill('st-mock-bot-id-12345');
    await page.getByRole('textbox', { name: 'Client ID' }).fill('cs-mock-client-id-67890');
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill('mock-client-secret-abcdef');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Step 2: Navigate to Auto-Analyze
    await page.waitForURL('**/sessions', { timeout: 30000 });
    await page.getByRole('link', { name: 'Auto-Analyze' }).click();
    await expect(page).toHaveURL(/.*\/analyze$/);
    
    console.log('⚙️ Step 3: Configuring mock analysis');
    
    // Step 3: Configure analysis with mock data
    await page.locator('#startDate').fill('2025-07-01');
    await page.locator('#startTime').fill('10:00');
    await page.locator('#sessionCount').fill('3'); // Small count for testing
    await page.locator('#openaiApiKey').fill('sk-mock-openai-key-testing');
    
    // Step 4: Start analysis (should use mock services)
    console.log('🚀 Step 4: Starting mock analysis');
    await page.getByRole('button', { name: 'Start Analysis' }).click();
    
    // Step 5: Wait for mock analysis to complete (should be fast)
    console.log('⏳ Step 5: Waiting for mock analysis completion');
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible({ timeout: 30000 });
    
    console.log('📊 Step 6: Validating analysis report table');
    
    // Step 6: Verify analysis results table
    await expect(page.locator('text=Analyzed Sessions')).toBeVisible();
    await expect(page.locator('table tbody tr')).toBeVisible();
    
    const analysisRows = page.locator('table tbody tr');
    const analysisCount = await analysisRows.count();
    
    console.log(`Found ${analysisCount} analyzed sessions`);
    expect(analysisCount).toBeGreaterThan(0);
    
    console.log('🔍 Step 7: Opening analyzed session details dialog');
    
    // Step 7: Click on first analyzed session
    await analysisRows.first().click();
    
    // Step 8: Verify analyzed session dialog opens
    await expect(page.locator('text=Analyzed Session Details').first()).toBeVisible();
    await expect(page.locator('text=AI-Extracted Facts').first()).toBeVisible();
    await expect(page.locator('text=Conversation Transcript')).toBeVisible();
    
    console.log('💬 Step 9: Validating message display in analyzed session');
    
    // Step 9: Critical test - verify messages in analyzed session dialog
    const transcriptSection = page.locator('h3:has-text("Conversation Transcript")').locator('..').locator('div').last();
    
    const hasMessages = await transcriptSection.locator('div:has-text("User"), div:has-text("Bot")').count() > 0;
    const hasNoMessagesText = await transcriptSection.locator('text=No messages in this session').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasMessages) {
      console.log('✅ SUCCESS: Messages displayed in analyzed session details');
      
      // Validate message structure in analysis report
      const messageElements = transcriptSection.locator('div[class*="flex gap-3"]');
      const messageCount = await messageElements.count();
      
      console.log(`Found ${messageCount} messages in analyzed session details`);
      expect(messageCount).toBeGreaterThan(0);
      
      // Verify AI facts are also displayed (confirms analysis had access to messages)
      await expect(page.locator('text=General Intent')).toBeVisible();
      await expect(page.locator('text=Session Outcome')).toBeVisible();
      
    } else if (hasNoMessagesText) {
      console.log('❌ REGRESSION: No messages in analyzed session despite AI analysis working');
      throw new Error('REGRESSION DETECTED: Analyzed session details show "No messages" but AI analysis succeeded (indicates access to messages)');
      
    } else {
      throw new Error('Unable to determine message display state in analyzed session details dialog');
    }
    
    // Step 10: Close dialog
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('text=Analyzed Session Details').first()).not.toBeVisible();
    
    console.log('✅ Mock analysis session details test completed');
  });

  // Only run real API tests if credentials are available
  test.skip(!hasRealCredentials, 'Session Viewer - validates message display with real Kore.ai credentials', async ({ page }) => {
    console.log('📝 Testing Session Viewer with Real Kore.ai API');
    
    // Step 1: Use real credentials from environment
    await page.getByRole('textbox', { name: 'Bot ID' }).fill(process.env.TEST_BOT_ID!);
    await page.getByRole('textbox', { name: 'Client ID' }).fill(process.env.TEST_CLIENT_ID!);
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill(process.env.TEST_CLIENT_SECRET!);
    await page.getByRole('button', { name: 'Connect' }).click();
    
    console.log('🔄 Step 2: Waiting for navigation with real API');
    
    // Step 2: Wait for navigation (may take longer with real API)
    await page.waitForURL('**/sessions', { timeout: 45000 });
    await expect(page.locator('text=View Sessions')).toBeVisible();
    
    console.log('📊 Step 3: Configuring date filter for known data period');
    
    // Step 3: Use date range where we know there's real data
    const startDateInput = page.locator('input[type="date"]').first();
    await startDateInput.fill('2025-08-01');
    
    const startTimeInput = page.locator('input[type="time"]').first();
    await startTimeInput.fill('09:00');
    
    const endDateInput = page.locator('input[type="date"]').last();
    await endDateInput.fill('2025-08-01');
    
    const endTimeInput = page.locator('input[type="time"]').last();
    await endTimeInput.fill('12:00');
    
    // Apply filters
    const applyButton = page.locator('button:has-text("Apply"), button:has-text("Search"), button:has-text("Filter")').first();
    await applyButton.click();
    
    console.log('⏳ Step 4: Waiting for real session data');
    
    // Step 4: Wait for real session data to load
    await expect(
      page.locator('table').or(page.locator('text=No sessions found'))
    ).toBeVisible({ timeout: 45000 });
    
    const sessionRows = page.locator('table tbody tr');
    const sessionCount = await sessionRows.count();
    
    console.log(`Found ${sessionCount} real sessions for Aug 1st 9am-12pm ET`);
    
    if (sessionCount > 0) {
      console.log('🔍 Step 5: Opening real session details');
      
      // Step 5: Click on first real session
      await sessionRows.first().click();
      
      // Step 6: Verify dialog opens with real data
      await expect(page.locator('text=Session Details').first()).toBeVisible();
      
      console.log('💬 Step 7: Validating real message display');
      
      // Step 7: Critical test - verify real messages are displayed
      const conversationSection = page.locator('h3:has-text("Conversation")').locator('..').locator('div').last();
      
      // Wait a bit for messages to load
      await page.waitForTimeout(2000);
      
      const hasMessages = await conversationSection.locator('div:has-text("User"), div:has-text("Bot")').count() > 0;
      const hasNoMessagesText = await conversationSection.locator('text=No messages in this session').isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasMessages) {
        console.log('✅ SUCCESS: Real messages displayed correctly');
        
        const messageElements = conversationSection.locator('div[class*="flex gap-3"]');
        const messageCount = await messageElements.count();
        
        console.log(`Real session has ${messageCount} messages displayed`);
        expect(messageCount).toBeGreaterThan(0);
        
      } else if (hasNoMessagesText) {
        console.log('❌ REGRESSION: Real session shows no messages');
        throw new Error('REGRESSION: Real session data exists but messages not displayed in session details dialog');
        
      } else {
        throw new Error('Unable to determine message display state for real session data');
      }
      
      // Close dialog
      await page.getByRole('button', { name: 'Close' }).click();
      
    } else {
      console.log('⚠️  No real sessions found for specified time period');
      console.log('Skipping message display validation (no sessions to test)');
    }
    
    console.log('✅ Real API session details test completed');
  });

});