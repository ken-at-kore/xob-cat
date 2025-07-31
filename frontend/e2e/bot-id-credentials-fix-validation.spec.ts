import { test, expect } from '@playwright/test';

test.describe('Bot ID Credentials Fix Validation', () => {
  test('should use correct credentials when switching between bots in mock reports', async ({ page }) => {
    // First, test with Optum credentials
    await page.goto('/');

    // Log in with Optum credentials
    await page.fill('input[placeholder="Enter your Bot ID"]', '');
    await page.fill('input[placeholder="Enter your Bot ID"]', '***REMOVED***');
    await page.fill('input[placeholder="Enter your Client ID"]', '');
    await page.fill('input[placeholder="Enter your Client ID"]', '***REMOVED***');
    await page.fill('input[placeholder="Enter your Client Secret"]', '');
    await page.fill('input[placeholder="Enter your Client Secret"]', '***REMOVED***');
    await page.click('button:has-text("Connect")');

    await page.waitForURL('**/sessions');

    // Navigate to Auto-Analyze and generate mock report
    await page.click('a:has-text("Auto-Analyze")');
    await page.waitForURL('**/analyze');
    await page.click('button:has-text("See Mock Reports")');
    await page.waitForSelector('h1:has-text("Analysis Report")');

    // Verify Optum bot ID is displayed
    const optumBotIdElement = await page.locator('span.font-mono.text-gray-700.bg-gray-100');
    const optumDisplayedBotId = await optumBotIdElement.first().textContent();
    expect(optumDisplayedBotId?.trim()).toBe('***REMOVED***');

    // Now disconnect and test with ComPsych credentials
    await page.click('button:has-text("Disconnect")');
    await page.waitForURL('/');

    // Log in with ComPsych credentials
    await page.fill('input[placeholder="Enter your Bot ID"]', '');
    await page.fill('input[placeholder="Enter your Bot ID"]', '***REMOVED***');
    await page.fill('input[placeholder="Enter your Client ID"]', '');
    await page.fill('input[placeholder="Enter your Client ID"]', 'cs-8c35c68f-8dc4-5c87-b47f-953b76f070ad');
    await page.fill('input[placeholder="Enter your Client Secret"]', '');
    await page.fill('input[placeholder="Enter your Client Secret"]', 'MtJPUaBQkbqsrLZ2n8NQGWW9KjC2MdUvvSJqgJAJdvY=');
    await page.click('button:has-text("Connect")');

    await page.waitForURL('**/sessions');

    // Navigate to Auto-Analyze and generate mock report
    await page.click('a:has-text("Auto-Analyze")');
    await page.waitForURL('**/analyze');
    await page.click('button:has-text("See Mock Reports")');
    await page.waitForSelector('h1:has-text("Analysis Report")');

    // Verify ComPsych bot ID is displayed (not Optum)
    const compsychBotIdElement = await page.locator('span.font-mono.text-gray-700.bg-gray-100');
    const compsychDisplayedBotId = await compsychBotIdElement.first().textContent();
    expect(compsychDisplayedBotId?.trim()).toBe('***REMOVED***');
    
    // Ensure it's NOT showing the Optum bot ID
    expect(compsychDisplayedBotId?.trim()).not.toBe('***REMOVED***');

    console.log('✅ Fix validated: Bot ID in reports correctly matches the logged-in credentials');
  });

  test('should maintain bot-specific analysis results across sessions', async ({ page }) => {
    // This test verifies that the fix prevents the singleton bug where 
    // different bot credentials would share the same service instance

    // First session: Login with Optum
    await page.goto('/');
    await page.fill('input[placeholder="Enter your Bot ID"]', '***REMOVED***');
    await page.fill('input[placeholder="Enter your Client ID"]', '***REMOVED***');
    await page.fill('input[placeholder="Enter your Client Secret"]', '***REMOVED***');
    await page.click('button:has-text("Connect")');
    await page.waitForURL('**/sessions');

    // Check TopNav shows Optum bot ID
    const optumTopNavBotId = await page.locator('nav span.font-mono.text-gray-700').first().textContent();
    expect(optumTopNavBotId?.trim()).toBe('***REMOVED***');

    // Open analysis page and verify it maintains Optum context
    await page.click('a:has-text("Auto-Analyze")');
    await page.waitForURL('**/analyze');
    await page.click('button:has-text("See Mock Reports")');
    await page.waitForSelector('h1:has-text("Analysis Report")');

    const optumReportBotId = await page.locator('span.font-mono.text-gray-700.bg-gray-100').first().textContent();
    expect(optumReportBotId?.trim()).toBe('***REMOVED***');

    // Now open a new tab and login with ComPsych credentials
    const newPage = await page.context().newPage();
    await newPage.goto('/');
    await newPage.fill('input[placeholder="Enter your Bot ID"]', '***REMOVED***');
    await newPage.fill('input[placeholder="Enter your Client ID"]', 'cs-8c35c68f-8dc4-5c87-b47f-953b76f070ad');
    await newPage.fill('input[placeholder="Enter your Client Secret"]', 'MtJPUaBQkbqsrLZ2n8NQGWW9KjC2MdUvvSJqgJAJdvY=');
    await newPage.click('button:has-text("Connect")');
    await newPage.waitForURL('**/sessions');

    // Verify ComPsych shows correct bot ID
    const compsychTopNavBotId = await newPage.locator('nav span.font-mono.text-gray-700').first().textContent();
    expect(compsychTopNavBotId?.trim()).toBe('***REMOVED***');

    // Generate analysis report and verify it uses ComPsych bot ID
    await newPage.click('a:has-text("Auto-Analyze")');
    await newPage.waitForURL('**/analyze');
    await newPage.click('button:has-text("See Mock Reports")');
    await newPage.waitForSelector('h1:has-text("Analysis Report")');

    const compsychReportBotId = await newPage.locator('span.font-mono.text-gray-700.bg-gray-100').first().textContent();
    expect(compsychReportBotId?.trim()).toBe('***REMOVED***');

    // Go back to the original tab and verify it STILL shows Optum (not affected by the new session)
    await page.bringToFront();
    
    // Refresh the analysis to make sure it's still using the right credentials
    await page.click('a:has-text("Auto-Analyze")');
    await page.waitForURL('**/analyze');
    await page.click('button:has-text("See Mock Reports")');
    await page.waitForSelector('h1:has-text("Analysis Report")');

    const finalOptumReportBotId = await page.locator('span.font-mono.text-gray-700.bg-gray-100').first().textContent();
    expect(finalOptumReportBotId?.trim()).toBe('***REMOVED***');

    await newPage.close();
    
    console.log('✅ Fix validated: Bot-specific service instances maintained across concurrent sessions');
  });
});