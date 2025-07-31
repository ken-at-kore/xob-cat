import { test, expect } from '@playwright/test';

test.describe('Auto-Analyze Bot ID Bug Fix', () => {
  test('should use the correct bot ID from credentials in mock analysis report', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Log in with ComPsych credentials - first clear and then fill
    await page.fill('input[placeholder="Enter your Bot ID"]', '');
    await page.fill('input[placeholder="Enter your Bot ID"]', 'st-90549a67-7f19-5074-afcf-3120db51a26d');
    await page.fill('input[placeholder="Enter your Client ID"]', '');
    await page.fill('input[placeholder="Enter your Client ID"]', 'cs-8c35c68f-8dc4-5c87-b47f-953b76f070ad');
    await page.fill('input[placeholder="Enter your Client Secret"]', '');
    await page.fill('input[placeholder="Enter your Client Secret"]', 'MtJPUaBQkbqsrLZ2n8NQGWW9KjC2MdUvvSJqgJAJdvY=');
    await page.click('button:has-text("Connect")');

    // Wait for navigation to sessions page
    await page.waitForURL('**/sessions');

    // Navigate to Auto-Analyze page
    await page.click('a:has-text("Auto-Analyze")');
    await page.waitForURL('**/analyze');

    // Use Mock Reports instead of running actual analysis
    await page.click('button:has-text("See Mock Reports")');

    // Wait for the report to load
    await page.waitForSelector('h1:has-text("Analysis Report")');

    // Check that the report shows the correct bot ID
    const botIdElement = await page.locator('span.font-mono.text-gray-700.bg-gray-100');
    const displayedBotId = await botIdElement.first().textContent();

    // Should show ComPsych bot ID, not Optum
    expect(displayedBotId?.trim()).toBe('st-90549a67-7f19-5074-afcf-3120db51a26d');
    expect(displayedBotId?.trim()).not.toBe('st-17220bac-4b2e-5e1f-ab83-f8708ce87a8f');
  });

  test('should handle switching between different bot credentials correctly', async ({ page }) => {
    // First, log in with Optum credentials
    await page.goto('/');
    
    await page.fill('input[placeholder="Enter your Bot ID"]', '');
    await page.fill('input[placeholder="Enter your Bot ID"]', 'st-17220bac-4b2e-5e1f-ab83-f8708ce87a8f');
    await page.fill('input[placeholder="Enter your Client ID"]', '');
    await page.fill('input[placeholder="Enter your Client ID"]', 'cs-2e34c0be-d913-53c8-b55e-39ebd6def4c8');
    await page.fill('input[placeholder="Enter your Client Secret"]', '');
    await page.fill('input[placeholder="Enter your Client Secret"]', '6Sl5v0dgVPIRWjF/cazzU/7Tfchydrlce2CwLyJ2Jys=');
    await page.click('button:has-text("Connect")');
    
    await page.waitForURL('**/sessions');
    
    // Check TopNav shows Optum bot ID
    const optumTopNavBotId = await page.locator('nav span.font-mono.text-gray-700').first().textContent();
    expect(optumTopNavBotId?.trim()).toBe('st-17220bac-4b2e-5e1f-ab83-f8708ce87a8f');
    
    // Navigate to analysis and check bot ID there too
    await page.click('a:has-text("Auto-Analyze")');
    await page.waitForURL('**/analyze');
    await page.click('button:has-text("See Mock Reports")');
    await page.waitForSelector('h1:has-text("Analysis Report")');
    
    const optumReportBotId = await page.locator('span.font-mono.text-gray-700.bg-gray-100').first().textContent();
    expect(optumReportBotId?.trim()).toBe('st-17220bac-4b2e-5e1f-ab83-f8708ce87a8f');
    
    // Now disconnect and reconnect with ComPsych credentials
    await page.click('button:has-text("Disconnect")');
    await page.waitForURL('/');
    
    // Log in with ComPsych credentials
    await page.fill('input[placeholder="Enter your Bot ID"]', '');
    await page.fill('input[placeholder="Enter your Bot ID"]', 'st-90549a67-7f19-5074-afcf-3120db51a26d');
    await page.fill('input[placeholder="Enter your Client ID"]', '');
    await page.fill('input[placeholder="Enter your Client ID"]', 'cs-8c35c68f-8dc4-5c87-b47f-953b76f070ad');
    await page.fill('input[placeholder="Enter your Client Secret"]', '');
    await page.fill('input[placeholder="Enter your Client Secret"]', 'MtJPUaBQkbqsrLZ2n8NQGWW9KjC2MdUvvSJqgJAJdvY=');
    await page.click('button:has-text("Connect")');
    
    await page.waitForURL('**/sessions');
    
    // Check TopNav now shows ComPsych bot ID
    const compsychTopNavBotId = await page.locator('nav span.font-mono.text-gray-700').first().textContent();
    expect(compsychTopNavBotId?.trim()).toBe('st-90549a67-7f19-5074-afcf-3120db51a26d');
    
    // Navigate to analysis and verify ComPsych bot ID in report
    await page.click('a:has-text("Auto-Analyze")');
    await page.waitForURL('**/analyze');
    await page.click('button:has-text("See Mock Reports")');
    await page.waitForSelector('h1:has-text("Analysis Report")');
    
    const compsychReportBotId = await page.locator('span.font-mono.text-gray-700.bg-gray-100').first().textContent();
    expect(compsychReportBotId?.trim()).toBe('st-90549a67-7f19-5074-afcf-3120db51a26d');
    
    // Should NOT show the old Optum bot ID
    expect(compsychReportBotId?.trim()).not.toBe('st-17220bac-4b2e-5e1f-ab83-f8708ce87a8f');
  });
});