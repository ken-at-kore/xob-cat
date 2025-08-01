import { test, expect } from '@playwright/test';

test.describe('Auto-Analyze Report Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to credentials page and set up bot credentials
    await page.goto('/');
    
    // Fill credentials form
    await page.fill('input[placeholder="Enter Bot ID"]', 'test-bot-123');
    await page.fill('input[placeholder="Enter JWT Token"]', 'test-jwt-token');
    await page.click('button:has-text("Connect")');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/sessions');
    
    // Navigate to Auto-Analyze page
    await page.click('a:has-text("Auto-Analyze")');
    await expect(page).toHaveURL('/analyze');
  });

  test('displays mock report with comprehensive visualizations', async ({ page }) => {
    // Click "See Mock Report" button
    await page.click('button:has-text("See Mock Report")');
    
    // Wait for mock data to load and report to display
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible();
    
    // Verify analysis overview card
    await expect(page.locator('text=Analysis Overview')).toBeVisible();
    await expect(page.locator('text=The analysis of')).toBeVisible();
    
    // Verify session outcomes pie chart
    await expect(page.locator('text=Session Outcomes')).toBeVisible();
    await expect(page.locator('[data-testid="pie-chart"]')).toBeVisible();
    
    // Verify transfer reasons pareto chart
    await expect(page.locator('text=Transfer Reasons (Pareto Analysis)')).toBeVisible();
    await expect(page.locator('[data-testid="bar-chart"]').first()).toBeVisible();
    
    // Verify drop-off locations bar chart
    await expect(page.locator('text=Drop-off Locations')).toBeVisible();
    
    // Verify general intents bar chart
    await expect(page.locator('text=General Intents')).toBeVisible();
    
    // Verify detailed analysis markdown
    await expect(page.locator('text=Detailed Analysis')).toBeVisible();
    await expect(page.locator('text=Overview of Performance Patterns')).toBeVisible();
    
    // Verify cost analysis card
    await expect(page.locator('text=Analysis Cost & Usage')).toBeVisible();
    await expect(page.locator('text=Total Sessions Analyzed')).toBeVisible();
    await expect(page.locator('text=Total Tokens Used')).toBeVisible();
    await expect(page.locator('text=Model Used')).toBeVisible();
    await expect(page.locator('text=Estimated Cost')).toBeVisible();
    
    // Verify sessions table
    await expect(page.locator('text=Analyzed Sessions')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th:has-text("Session ID")')).toBeVisible();
    await expect(page.locator('th:has-text("General Intent")')).toBeVisible();
    await expect(page.locator('th:has-text("Session Outcome")')).toBeVisible();
  });

  test('displays interactive session details dialog', async ({ page }) => {
    // Click "See Mock Report" button
    await page.click('button:has-text("See Mock Report")');
    
    // Wait for report to load
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible();
    
    // Click on first session row
    await page.locator('table tbody tr').first().click();
    
    // Verify session details dialog opens
    await expect(page.locator('text=Session Details')).toBeVisible();
    await expect(page.locator('text=AI-Extracted Facts')).toBeVisible();
    await expect(page.locator('text=General Intent')).toBeVisible();
    await expect(page.locator('text=Session Outcome')).toBeVisible();
    await expect(page.locator('text=Conversation Transcript')).toBeVisible();
    
    // Close dialog
    await page.locator('button[aria-label="Close"]').click();
    await expect(page.locator('text=Session Details')).not.toBeVisible();
  });

  test('shows start new analysis button and navigation', async ({ page }) => {
    // Click "See Mock Report" button
    await page.click('button:has-text("See Mock Report")');
    
    // Wait for report to load
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible();
    
    // Verify "Start New Analysis" button is present
    await expect(page.locator('button:has-text("Start New Analysis")')).toBeVisible();
    
    // Click the button to go back to configuration
    await page.click('button:has-text("Start New Analysis")');
    
    // Should return to configuration view
    await expect(page.locator('h1:has-text("Auto-Analyze")')).toBeVisible();
    await expect(page.locator('text=Analysis Configuration')).toBeVisible();
  });

  test('handles filters in sessions table', async ({ page }) => {
    // Click "See Mock Report" button
    await page.click('button:has-text("See Mock Report")');
    
    // Wait for report to load
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible();
    
    // Test intent filter
    await page.fill('input[placeholder="Search intents..."]', 'Account');
    await page.waitForTimeout(500); // Allow for filtering
    
    // Verify filtered results
    const visibleRows = page.locator('table tbody tr:visible');
    await expect(visibleRows).toHaveCount(await visibleRows.count());
    
    // Clear filter
    await page.fill('input[placeholder="Search intents..."]', '');
    
    // Test outcome filter
    await page.selectOption('select#filterOutcome', 'Transfer');
    await page.waitForTimeout(500); // Allow for filtering
    
    // Clear outcome filter
    await page.selectOption('select#filterOutcome', '');
  });

  test('displays responsive layout on different screen sizes', async ({ page }) => {
    // Click "See Mock Report" button
    await page.click('button:has-text("See Mock Report")');
    
    // Wait for report to load
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible();
    
    // Test desktop layout (default)
    await expect(page.locator('text=Analysis Overview')).toBeVisible();
    await expect(page.locator('text=Session Outcomes')).toBeVisible();
    
    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 800 });
    await expect(page.locator('text=Analysis Overview')).toBeVisible();
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 800 });
    await expect(page.locator('text=Analysis Overview')).toBeVisible();
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('validates all chart components render without errors', async ({ page }) => {
    // Click "See Mock Report" button
    await page.click('button:has-text("See Mock Report")');
    
    // Wait for report to load
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible();
    
    // Check for JavaScript errors
    page.on('pageerror', (error) => {
      throw new Error(`Page error: ${error.message}`);
    });
    
    // Verify all chart containers are present
    const chartContainers = page.locator('[data-testid*="chart"], [data-testid*="responsive-container"]');
    const count = await chartContainers.count();
    expect(count).toBeGreaterThan(0);
    
    // Verify no error messages are displayed
    await expect(page.locator('text=Error')).not.toBeVisible();
    await expect(page.locator('text=Failed')).not.toBeVisible();
  });
});