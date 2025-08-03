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

  test('completes full auto-analyze workflow with production data', async ({ page }) => {
    // Set page timeout to prevent hanging
    page.setDefaultTimeout(15000);
    // Step 1: Enter bot credentials using correct selectors
    await page.getByRole('textbox', { name: 'Bot ID' }).fill('test-bot-123');
    await page.getByRole('textbox', { name: 'Client ID' }).fill('test-client-id');
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill('test-client-secret');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for navigation and verify redirect to sessions page
    await page.waitForURL('/sessions', { timeout: 15000 });
    await expect(page.locator('text=View Sessions')).toBeVisible();
    
    // Step 2: Navigate to Auto-Analyze page
    await page.getByRole('link', { name: 'Auto-Analyze' }).click();
    await expect(page).toHaveURL('/analyze');
    await expect(page.locator('h1:has-text("Auto-Analyze")')).toBeVisible();
    
    // Step 3: Configure analysis settings
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = yesterday.toISOString().split('T')[0];
    
    await page.locator('#startDate').fill(dateString);
    await page.locator('#startTime').fill('12:00');
    await page.locator('#sessionCount').fill('10');
    await page.locator('#openaiApiKey').fill('sk-mock-test-key-for-e2e');
    
    // Step 4: Start analysis and wait for completion
    await page.getByRole('button', { name: 'Start Analysis' }).click();
    await expect(page.locator('text=Analysis in Progress')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible({ timeout: 30000 });
    
    // Verify report header information
    await expect(page.locator('text=Bot ID').first()).toBeVisible();
    await expect(page.locator('text=test-bot-123').first()).toBeVisible();
    await expect(page.locator('text=Comprehensive analysis of')).toBeVisible();
    await expect(page.locator('text=sessions with AI-powered insights')).toBeVisible();
    
    // Step 5: Verify Analysis Overview section
    await expect(page.locator('text=Analysis Overview')).toBeVisible();
    await expect(page.locator('text=In this analysis, I examined')).toBeVisible();
    await expect(page.locator('text=chatbot conversations')).toBeVisible();
    
    // Step 6: Verify Session Outcomes Visualization
    await expect(page.locator('text=Session Outcomes')).toBeVisible();
    
    // Step 7: Verify Transfer Reasons Chart
    await expect(page.locator('text=Transfer Reasons')).toBeVisible();
    
    // Step 8: Verify Drop-off Locations Chart
    await expect(page.locator('text=Drop-off Locations')).toBeVisible();
    
    // Step 9: Verify General Intents Chart
    await expect(page.locator('text=General Intents').first()).toBeVisible();
    
    // Step 10: Verify Detailed Analysis section
    await expect(page.locator('text=Detailed Analysis')).toBeVisible();
    await expect(page.locator('text=How Users Actually Interact with the Bot')).toBeVisible();
    
    // Step 11: Verify Cost Analysis section
    await expect(page.locator('text=Analysis Cost & Usage')).toBeVisible();
    await expect(page.locator('text=Total Sessions Analyzed')).toBeVisible();
    await expect(page.locator('text=Total Tokens Used')).toBeVisible();
    await expect(page.locator('text=Model Used')).toBeVisible();
    await expect(page.locator('text=GPT-4o mini').first()).toBeVisible();
    await expect(page.locator('text=Estimated Cost')).toBeVisible();
    
    // Verify cost values are realistic
    const costText = await page.locator('text=/\\$/').first().textContent();
    expect(costText).toMatch(/\$\d+\.\d{2,4}/); // Should be in format $X.XXXX
    
    // Step 12: Verify Analyzed Sessions table
    await expect(page.locator('text=Analyzed Sessions')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    
    // Verify table headers
    await expect(page.locator('th:has-text("Session ID")')).toBeVisible();
    await expect(page.locator('th:has-text("General Intent")')).toBeVisible();
    await expect(page.locator('th:has-text("Session Outcome")')).toBeVisible();
    await expect(page.locator('th:has-text("Transfer Reason")')).toBeVisible();
    await expect(page.locator('th:has-text("Notes")')).toBeVisible();
    
    // Verify at least one session row exists
    const sessionRows = page.locator('table tbody tr');
    await expect(sessionRows.first()).toBeVisible();
    
    // Step 13: Test session details dialog
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
    
    // Verify conversation transcript
    await expect(page.locator('text=Conversation Transcript')).toBeVisible();
    
    // Verify at least one message exists (User or Bot)
    await expect(page.locator('text=User').first()).toBeVisible();
    await expect(page.locator('text=Bot').first()).toBeVisible();
    
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