/**
 * Auto-Analyze Real Workflow E2E Test
 * 
 * Tests the complete auto-analyze workflow without using mock reports.
 * Goes through the actual analysis configuration, execution, and results.
 * Uses the backend's mock OpenAI service so no real API key is needed.
 */

import { test, expect } from '@playwright/test';

test.describe('Auto-Analyze Real Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Set page timeout to prevent hanging
    page.setDefaultTimeout(20000);
    
    // Navigate to credentials page
    await page.goto('/');
    
    // Verify we're on the credentials page
    await expect(page.locator('text=Welcome to XOBCAT')).toBeVisible();
  });

  test('completes full auto-analyze workflow with actual analysis', async ({ page }) => {
    // Step 1: Enter bot credentials
    await page.getByRole('textbox', { name: 'Bot ID' }).fill('test-bot-123');
    await page.getByRole('textbox', { name: 'Client ID' }).fill('test-client-id');
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill('test-client-secret');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Step 2: Wait for navigation to sessions page
    await page.waitForURL('/sessions', { timeout: 15000 });
    await expect(page.locator('text=View Sessions')).toBeVisible();
    
    // Step 3: Navigate to Auto-Analyze page
    await page.getByRole('link', { name: 'Auto-Analyze' }).click();
    await expect(page).toHaveURL('/analyze');
    await expect(page.locator('h1:has-text("Auto-Analyze")')).toBeVisible();
    
    // Step 4: Configure analysis settings
    // Set date (yesterday to ensure data exists)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = yesterday.toISOString().split('T')[0];
    
    await page.locator('#startDate').fill(dateString);
    
    // Set time
    await page.locator('#startTime').fill('12:00');
    
    // Set session count
    await page.locator('#sessionCount').fill('10');
    
    // Set OpenAI API key (mock key, backend will use mock service)
    await page.locator('#openaiApiKey').fill('sk-mock-test-key-for-testing');
    
    // Step 5: Start analysis
    await page.getByRole('button', { name: 'Start Analysis' }).click();
    
    // Step 6: Verify progress tracking appears
    await expect(page.locator('text=Analysis in Progress')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Progress').last()).toBeVisible();
    
    // Step 7: Wait for analysis to complete and report to load
    // The mock service should complete quickly
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible({ timeout: 30000 });
    
    // Step 8: Verify report header
    await expect(page.locator('text=Bot ID').first()).toBeVisible();
    await expect(page.locator('text=test-bot-123').first()).toBeVisible();
    await expect(page.locator('text=Comprehensive analysis of')).toBeVisible();
    
    // Step 9: Verify Analysis Overview section
    await expect(page.locator('text=Analysis Overview')).toBeVisible();
    await expect(page.locator('text=In this analysis, I examined')).toBeVisible();
    
    // Step 10: Verify charts are rendered
    await expect(page.locator('text=Session Outcomes')).toBeVisible();
    await expect(page.locator('text=Transfer Reasons')).toBeVisible();
    await expect(page.locator('text=Drop-off Locations')).toBeVisible();
    await expect(page.locator('text=General Intents').first()).toBeVisible();
    
    // Step 11: Verify Detailed Analysis section
    await expect(page.locator('text=Detailed Analysis')).toBeVisible();
    
    // Step 12: Verify Cost Analysis section
    await expect(page.locator('text=Analysis Cost & Usage')).toBeVisible();
    await expect(page.locator('text=Total Sessions Analyzed')).toBeVisible();
    await expect(page.locator('text=Total Tokens Used')).toBeVisible();
    
    // Step 13: Verify Analyzed Sessions table
    await expect(page.locator('text=Analyzed Sessions')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    
    // Verify table headers
    await expect(page.locator('th:has-text("Session ID")')).toBeVisible();
    await expect(page.locator('th:has-text("General Intent")')).toBeVisible();
    await expect(page.locator('th:has-text("Session Outcome")')).toBeVisible();
    
    // Step 14: Test session details dialog
    const sessionRows = page.locator('table tbody tr');
    await expect(sessionRows.first()).toBeVisible();
    await sessionRows.first().click();
    
    // Verify dialog opens with AI facts
    await expect(page.locator('text=Analyzed Session Details').first()).toBeVisible();
    await expect(page.locator('text=AI-Extracted Facts').first()).toBeVisible();
    await expect(page.locator('text=General Intent').first()).toBeVisible();
    await expect(page.locator('text=Session Outcome').first()).toBeVisible();
    
    // Close dialog
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('text=Analyzed Session Details').first()).not.toBeVisible();
    
    // Step 15: Test report actions
    await expect(page.locator('text=Download Report Data')).toBeVisible();
    await expect(page.locator('text=Share Report')).toBeVisible();
    await expect(page.locator('text=Start New Analysis')).toBeVisible();
  });

  test('handles analysis configuration validation', async ({ page }) => {
    // Enter credentials and navigate to auto-analyze
    await page.getByRole('textbox', { name: 'Bot ID' }).fill('test-bot-456');
    await page.getByRole('textbox', { name: 'Client ID' }).fill('test-client-456');
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill('test-secret-456');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await page.waitForURL('/sessions', { timeout: 15000 });
    await page.getByRole('link', { name: 'Auto-Analyze' }).click();
    
    // Test validation: Future date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureDate = tomorrow.toISOString().split('T')[0];
    
    await page.locator('#startDate').fill(futureDate);
    await page.locator('#startTime').fill('12:00');
    await page.locator('#sessionCount').fill('10');
    await page.locator('#openaiApiKey').fill('invalid-key');
    
    await page.getByRole('button', { name: 'Start Analysis' }).click();
    
    // Should show validation errors
    await expect(page.locator('text=Date must be in the past')).toBeVisible();
    await expect(page.locator('text=OpenAI API key must start with')).toBeVisible();
    
    // Test validation: Invalid session count
    await page.locator('#sessionCount').fill('5000');
    await page.getByRole('button', { name: 'Start Analysis' }).click();
    await expect(page.locator('text=Session count must be between')).toBeVisible();
  });

  test('handles analysis cancellation', async ({ page }) => {
    // Enter credentials and navigate to auto-analyze
    await page.getByRole('textbox', { name: 'Bot ID' }).fill('test-bot-789');
    await page.getByRole('textbox', { name: 'Client ID' }).fill('test-client-789');
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill('test-secret-789');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await page.waitForURL('/sessions', { timeout: 15000 });
    await page.getByRole('link', { name: 'Auto-Analyze' }).click();
    
    // Configure valid analysis
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = yesterday.toISOString().split('T')[0];
    
    await page.locator('#startDate').fill(dateString);
    await page.locator('#startTime').fill('14:00');
    await page.locator('#sessionCount').fill('20');
    await page.locator('#openaiApiKey').fill('sk-mock-cancel-test');
    
    // Start analysis
    await page.getByRole('button', { name: 'Start Analysis' }).click();
    
    // Wait for progress to appear
    await expect(page.locator('text=Analysis in Progress')).toBeVisible({ timeout: 5000 });
    
    // Cancel analysis
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      
      // Should return to configuration
      await expect(page.locator('text=Analysis Configuration')).toBeVisible();
      await expect(page.locator('text=Analysis cancelled')).toBeVisible();
    }
  });
});