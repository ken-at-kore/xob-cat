/**
 * Simplified Auto-Analyze E2E Test
 * 
 * A streamlined test that validates the critical path without hanging.
 * Uses more specific selectors and shorter timeouts to prevent hanging.
 */

import { test, expect } from '@playwright/test';

test.describe('Auto-Analyze Simple Workflow', () => {
  test('validates mock report workflow', async ({ page }) => {
    // Set page timeout to prevent hanging
    page.setDefaultTimeout(10000);
    
    // Step 1: Navigate to app
    await page.goto('/');
    
    // Step 2: Enter credentials
    await page.getByRole('textbox', { name: 'Bot ID' }).fill('test-bot');
    await page.getByRole('textbox', { name: 'Client ID' }).fill('test-client');
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill('test-secret');
    
    // Step 3: Connect
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Step 4: Wait for navigation with shorter timeout
    await page.waitForURL('/sessions', { timeout: 5000 });
    
    // Step 5: Navigate to Auto-Analyze
    await page.getByRole('link', { name: 'Auto-Analyze' }).click();
    await expect(page).toHaveURL('/analyze');
    
    // Step 6: Click Mock Report button
    await page.getByRole('button', { name: 'See Mock Report' }).click();
    
    // Step 7: Verify report loads
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible({ timeout: 5000 });
    
    // Step 8: Basic verification - use first() to avoid conflicts
    await expect(page.locator('text=Analysis Overview').first()).toBeVisible();
    await expect(page.locator('text=Session Outcomes').first()).toBeVisible();
    
    // Step 9: Verify table exists
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    
    // Step 10: Click first row to test dialog
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    
    // Step 11: Verify dialog opens
    await expect(page.locator('text=AI-Extracted Facts').first()).toBeVisible();
    
    // Step 12: Close dialog
    await page.getByRole('button', { name: 'Close' }).click();
    
    // Test complete
  });
});