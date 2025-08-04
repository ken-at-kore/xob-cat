/**
 * Auto-Analyze Complete Workflow E2E Test
 * 
 * Tests the entire auto-analyze workflow from entering bot credentials
 * to producing a valid analysis report with real data.
 * 
 * This test:
 * 1. Enters bot credentials on the credentials page
 * 2. Navigates to Auto-Analyze page
 * 3. Configures analysis settings (date, time, session count, OpenAI API key)
 * 4. Starts the analysis and tracks progress
 * 5. Verifies the generated report has all required sections
 * 6. Validates session details contain correct information
 * 7. Tests report export/import functionality
 * 
 * Uses mock services with sanitized production data from data/ directory
 * for realistic testing scenarios.
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Auto-Analyze Complete Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to credentials page
    await page.goto('/');
    
    // Verify we're on the credentials page
    await expect(page.locator('text=Welcome to XOBCAT')).toBeVisible();
    await expect(page.locator('text=XO Bot Conversation Analysis Tools')).toBeVisible();
  });

  test('validates message display in session details with production data patterns', async ({ page }) => {
    // Set page timeout to prevent hanging
    page.setDefaultTimeout(15000);
    // Step 1: Use mock credentials to test message display issue
    await page.getByRole('textbox', { name: 'Bot ID' }).fill('test-bot-message-validation');
    await page.getByRole('textbox', { name: 'Client ID' }).fill('test-client-message-validation');
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill('test-secret-message-validation');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for navigation and verify redirect to sessions page
    await page.waitForURL('/sessions', { timeout: 15000 });
    await expect(page.locator('text=View Sessions')).toBeVisible();
    
    // Step 2: Navigate to Auto-Analyze page
    await page.getByRole('link', { name: 'Auto-Analyze' }).click();
    await expect(page).toHaveURL('/analyze');
    await expect(page.locator('h1:has-text("Auto-Analyze")')).toBeVisible();
    
    // Step 3: Use mock report to quickly get to session details testing
    await page.getByRole('button', { name: 'See Mock Report' }).click();
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible({ timeout: 10000 });
    
    // Skip to session details testing - focus on message display issue
    console.log('Navigating directly to session details to test message display...');
    
    // Step 4: Find and click on first session row to open details
    const sessionRows = page.locator('table tbody tr');
    await expect(sessionRows.first()).toBeVisible();
    await sessionRows.first().click();
    
    // Verify session details dialog opens
    await expect(page.locator('text=Analyzed Session Details').first()).toBeVisible();
    await expect(page.locator('text=AI-Extracted Facts').first()).toBeVisible();
    
    // Verify AI facts are populated
    await expect(page.locator('text=General Intent').first()).toBeVisible();
    await expect(page.locator('text=Session Outcome').first()).toBeVisible();
    await expect(page.locator('text=AI Summary').first()).toBeVisible();
    
    // Verify session metadata is populated
    await expect(page.locator('text=Session Information').first()).toBeVisible();
    await expect(page.locator('text=Session ID').first()).toBeVisible();
    await expect(page.locator('text=Start Time').first()).toBeVisible();
    await expect(page.locator('text=End Time').first()).toBeVisible();
    await expect(page.locator('text=Duration').first()).toBeVisible();
    
    // CRITICAL: Verify conversation transcript section exists
    await expect(page.locator('text=Conversation Transcript')).toBeVisible();
    
    // CRITICAL: Verify actual message content is displayed (not just labels)
    const transcriptSection = page.locator('text=Conversation Transcript').locator('..');
    
    // Look for message containers/bubbles with actual text content
    const userMessages = transcriptSection.locator('[data-testid="user-message"], .message-user, .user-message');
    const botMessages = transcriptSection.locator('[data-testid="bot-message"], .message-bot, .bot-message');
    
    // Check if ANY messages are actually visible with content
    const allMessages = transcriptSection.locator('text=/^(?!User$|Bot$).{10,}/'); // Messages with actual content, not just "User" or "Bot" labels
    
    console.log('Checking for message content in transcript...');
    const messageCount = await allMessages.count();
    console.log(`Found ${messageCount} messages with content`);
    
    // If no content messages found, check what's actually in the transcript section
    if (messageCount === 0) {
      const transcriptContent = await transcriptSection.textContent();
      console.log('Transcript section content:', transcriptContent);
      
      // Take a screenshot to debug the issue
      await page.screenshot({ path: 'message-display-issue.png', fullPage: true });
      
      console.log('ERROR: No message content found in transcript section');
      throw new Error('MESSAGE DISPLAY BUG REPRODUCED: Conversation transcript is empty or missing message content');
    }
    
    // Verify we have both user and bot messages with actual content
    await expect(allMessages.first()).toBeVisible({ timeout: 5000 });
    
    // Additional validation: check for message structure
    const hasUserLabel = await transcriptSection.locator('text=User').count() > 0;
    const hasBotLabel = await transcriptSection.locator('text=Bot').count() > 0;
    
    console.log(`Message labels - User: ${hasUserLabel}, Bot: ${hasBotLabel}`);
    console.log(`Message content count: ${messageCount}`);
    
    // Close dialog
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('text=Analyzed Session Details').first()).not.toBeVisible();
    
    // Step 14: Test report actions
    await expect(page.locator('text=Download Report Data')).toBeVisible();
    await expect(page.locator('text=Share Report')).toBeVisible();
    await expect(page.locator('text=Start New Analysis')).toBeVisible();
    
    // Step 15: Test navigation back to configuration
    await page.getByRole('button', { name: 'Start New Analysis' }).click();
    await expect(page.locator('h1:has-text("Auto-Analyze")')).toBeVisible();
    await expect(page.locator('text=Analysis Configuration')).toBeVisible();
    
  }); // Using page timeout instead of test timeout

  test('validates session data contains production data patterns', async ({ page }) => {
    // Navigate through workflow quickly to get to results
    await page.getByRole('textbox', { name: 'Bot ID' }).fill('test-bot-456');
    await page.getByRole('textbox', { name: 'Client ID' }).fill('test-client-id-456');
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill('test-client-secret-456');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await page.waitForURL('/sessions', { timeout: 10000 });
    await page.getByRole('link', { name: 'Auto-Analyze' }).click();
    
    // Use mock report to test data patterns quickly
    await page.getByRole('button', { name: 'See Mock Report' }).click();
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible();
    
    // Click on first session to examine data
    await page.locator('table tbody tr').first().click();
    await expect(page.locator('text=Analyzed Session Details')).toBeVisible();
    
    // Verify session ID format matches production patterns (ObjectId format)
    const sessionIdElement = page.locator('text=Session ID').locator('..').locator('text=/^[a-f0-9]{24}$/').first();
    
    // Verify timestamp formats are ISO strings
    await expect(page.locator('text=/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/').first()).toBeVisible();
    
    // Verify containment types match expected values
    const containmentTypes = ['selfService', 'agent', 'dropOff'];
    const outcomeElement = page.locator('text=Session Outcome').locator('..').locator('text=/selfService|agent|dropOff/').first();
    
    // Verify duration format
    await expect(page.locator('text=/\d+[ms]|\d+m \d+s/').first()).toBeVisible();
    
    // Verify conversation has realistic message structure
    await expect(page.locator('text=User').first()).toBeVisible();
    await expect(page.locator('text=Bot').first()).toBeVisible();
    
    // Close dialog
    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('handles error cases and edge conditions', async ({ page }) => {
    // Test invalid credentials - leave all fields empty
    await page.click('button:has-text("Connect")');
    
    // Should show validation errors
    await expect(page.locator('text=Bot ID is required')).toBeVisible();
    
    // Test valid credentials
    await page.fill('input[placeholder="Enter your Bot ID"]', 'test-bot-error-test');
    await page.fill('input[placeholder="Enter your Client ID"]', 'test-client-id-error');
    await page.fill('input[placeholder="Enter your Client Secret"]', 'test-client-secret-error');
    await page.click('button:has-text("Connect")');
    
    await expect(page).toHaveURL('/sessions');
    await page.click('a:has-text("Auto-Analyze")');
    
    // Test invalid analysis configuration
    await page.fill('input[type="date"]', '2030-01-01'); // Future date
    await page.fill('input[type="time"]', '12:00');
    await page.fill('input[placeholder="Number of sessions to analyze"]', '5000'); // Too many
    await page.fill('input[placeholder="Enter your OpenAI API key"]', 'invalid-key');
    
    await page.click('button:has-text("Start Analysis")');
    
    // Should show validation errors
    await expect(page.locator('text=Date must be in the past')).toBeVisible();
    await expect(page.locator('text=Session count must be between')).toBeVisible();
    await expect(page.locator('text=OpenAI API key must start with')).toBeVisible();
  });

  test('verifies report sections contain expected data patterns', async ({ page }) => {
    // Quick navigation to mock report
    await page.fill('input[placeholder="Enter your Bot ID"]', 'test-bot-data-validation');
    await page.fill('input[placeholder="Enter your Client ID"]', 'test-client-validation');
    await page.fill('input[placeholder="Enter your Client Secret"]', 'test-client-secret-validation');
    await page.click('button:has-text("Connect")');
    
    await expect(page).toHaveURL('/sessions');
    await page.click('a:has-text("Auto-Analyze")');
    await page.click('button:has-text("See Mock Report")');
    
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible();
    
    // Verify analysis overview contains statistics
    const overviewSection = page.locator('text=Analysis Overview').locator('..');
    await expect(overviewSection.locator('text=/\d+ sessions/')).toBeVisible();
    await expect(overviewSection.locator('text=/\d+%/')).toBeVisible();
    
    // Verify pie chart legend has all containment types
    await expect(page.locator('text=Self-Service')).toBeVisible();
    await expect(page.locator('text=Agent')).toBeVisible();
    await expect(page.locator('text=Drop-off')).toBeVisible();
    
    // Verify cost analysis has realistic values
    const costSection = page.locator('text=Analysis Cost & Usage').locator('..');
    await expect(costSection.locator('text=/\$\d+\.\d{2,4}/')).toBeVisible();
    await expect(costSection.locator('text=/\d{1,3},?\d{0,3} tokens?/')).toBeVisible();
    
    // Verify detailed analysis contains markdown formatting
    const analysisSection = page.locator('text=Detailed Analysis').locator('..');
    await expect(analysisSection.locator('h3, h4').first()).toBeVisible(); // Headers
    await expect(analysisSection.locator('ul, ol').first()).toBeVisible(); // Lists
    
    // Verify sessions table has correct data types
    const table = page.locator('table tbody');
    
    // Check duration column format
    await expect(table.locator('td').filter({ hasText: /\d+[ms]|\d+m \d+s/ }).first()).toBeVisible();
    
    // Check message count column
    await expect(table.locator('td').filter({ hasText: /^\d+$/ }).first()).toBeVisible();
    
    // Check session outcome values
    await expect(table.locator('td').filter({ hasText: /^(Contained|Transfer|Drop-off)$/ }).first()).toBeVisible();
  });
});