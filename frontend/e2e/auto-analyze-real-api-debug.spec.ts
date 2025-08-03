/**
 * Real API Debug Test - Auto-Analyze E2E with Real Credentials
 * 
 * This test uses real Kore.ai credentials to test the complete auto-analyze workflow
 * with production APIs to debug why auto-analyze finds 0 sessions while session viewer finds 150+.
 * 
 * Usage:
 * 1. Set environment variables in .env.local:
 *    TEST_BOT_ID="***REMOVED***"
 *    TEST_CLIENT_ID="***REMOVED***"
 *    TEST_CLIENT_SECRET="***REMOVED***"
 *    TEST_OPENAI_API_KEY="sk-your-real-openai-key"
 * 
 * 2. Run the test:
 *    npm run test:e2e -- --grep "Real API Debug"
 *    or
 *    npx playwright test auto-analyze-real-api-debug.spec.ts
 * 
 * Note: This test uses real Kore.ai and OpenAI APIs. Costs will be incurred.
 */

import { test, expect } from '@playwright/test';

// Use REAL credentials for production API testing
const REQUIRED_ENV_VARS = ['TEST_BOT_ID', 'TEST_CLIENT_ID', 'TEST_CLIENT_SECRET', 'TEST_OPENAI_API_KEY'];
const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log(`⚠️  Skipping Real API Debug test - Missing environment variables: ${missingVars.join(', ')}`);
  console.log('To run this test, set the required environment variables and run again.');
}

// Only define the test if all required environment variables are present
const shouldRunTest = missingVars.length === 0;

// Configure for single browser debugging (must be at top level)
test.use({ 
  // Increase timeouts for real API calls
  actionTimeout: 30000,
  navigationTimeout: 30000
});

test.describe('Real API Debug Test', () => {

  test.beforeEach(async ({ page }) => {
    if (!shouldRunTest) {
      test.skip();
      return;
    }

    // Set longer default timeout for real API interactions
    page.setDefaultTimeout(45000);
    
    console.log('🚀 Starting Real API Debug Test');
    console.log(`Using Real Bot ID: ${process.env.TEST_BOT_ID}`);
    console.log(`Using Model: gpt-4o-mini (cost optimized)`);
    
    // Navigate to credentials page
    await page.goto('http://localhost:3000/');
    
    // Verify we're on the credentials page
    await expect(page.locator('text=Welcome to XOBCAT')).toBeVisible();
  });

  test('Real API Debug - completes full auto-analyze workflow with real APIs', async ({ page }) => {
    if (!shouldRunTest) {
      test.skip();
      return;
    }

    console.log('📝 Step 1: Entering real bot credentials');
    
    // Step 1: Enter real bot credentials
    await page.getByRole('textbox', { name: 'Bot ID' }).fill(process.env.TEST_BOT_ID!);
    await page.getByRole('textbox', { name: 'Client ID' }).fill(process.env.TEST_CLIENT_ID!);
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill(process.env.TEST_CLIENT_SECRET!);
    await page.getByRole('button', { name: 'Connect' }).click();
    
    console.log('🔄 Step 2: Waiting for navigation to sessions page');
    
    // Step 2: Wait for navigation to sessions page (longer timeout for real API)
    await page.waitForURL('**/sessions', { timeout: 30000 });
    await expect(page.locator('text=View Sessions')).toBeVisible();
    
    console.log('📊 Step 3: Navigating to Auto-Analyze page');
    
    // Step 3: Navigate to Auto-Analyze page
    await page.getByRole('link', { name: 'Auto-Analyze' }).click();
    await expect(page).toHaveURL(/.*\/analyze$/);
    await expect(page.locator('h1:has-text("Auto-Analyze")')).toBeVisible();
    
    console.log('⚙️ Step 4: Configuring analysis settings');
    
    // Step 4: Configure analysis settings for August 1st (when we have confirmed real session data)
    const testDate = '2025-08-01';
    const testTime = '09:00'; // 9 AM ET - when we know the real data exists (150 sessions found by session viewer)
    
    console.log(`Using date: ${testDate} at ${testTime} (date with confirmed real session data from session viewer test)`);
    
    await page.locator('#startDate').fill(testDate);
    await page.locator('#startTime').fill(testTime);
    await page.locator('#sessionCount').fill('5'); // Small count for debugging/cost control
    
    // Use real OpenAI API key (gpt-4o-mini should be the default model for cost optimization)
    await page.locator('#openaiApiKey').fill(process.env.TEST_OPENAI_API_KEY!);
    
    // Skip model selection - gpt-4o-mini is the default
    
    console.log('🚀 Step 5: Starting analysis with real APIs');
    
    // Step 5: Start analysis  
    await page.getByRole('button', { name: 'Start Analysis' }).click();
    
    console.log('⏳ Step 6: Monitoring progress');
    
    // Step 6: Verify progress tracking appears
    await expect(page.locator('text=Analysis in Progress')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Progress').last()).toBeVisible();
    
    console.log('📈 Step 7: Waiting for analysis completion (this may take 1-2 minutes with real APIs)');
    
    // Step 7: Wait for analysis to complete (longer timeout for real API processing)
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible({ timeout: 120000 }); // 2 minutes
    
    console.log('✅ Step 8: Validating report content');
    
    // Step 8: Verify report header with real bot ID
    await expect(page.locator('text=Bot ID').first()).toBeVisible();
    await expect(page.locator(`text=${process.env.TEST_BOT_ID}`).first()).toBeVisible();
    await expect(page.locator('text=Comprehensive analysis of')).toBeVisible();
    
    // Step 9: Verify Analysis Overview section
    await expect(page.locator('text=Analysis Overview')).toBeVisible();
    
    // Step 10: Verify charts are rendered (may take time with real data)
    await expect(page.locator('text=Session Outcomes')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=General Intents').first()).toBeVisible();
    
    // Step 11: Verify Detailed Analysis section
    await expect(page.locator('text=Detailed Analysis')).toBeVisible();
    
    // Step 12: Verify Cost Analysis section shows real usage
    await expect(page.locator('text=Analysis Cost & Usage')).toBeVisible();
    await expect(page.locator('text=Total Sessions Analyzed')).toBeVisible();
    await expect(page.locator('text=Total Tokens Used')).toBeVisible();
    
    // Step 13: Verify Analyzed Sessions table with real data
    await expect(page.locator('text=Analyzed Sessions')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    
    // Verify table headers
    await expect(page.locator('th:has-text("Session ID")')).toBeVisible();
    await expect(page.locator('th:has-text("General Intent")')).toBeVisible();
    await expect(page.locator('th:has-text("Session Outcome")')).toBeVisible();
    
    // Step 14: Test session details dialog with real data
    const sessionRows = page.locator('table tbody tr');
    await expect(sessionRows.first()).toBeVisible();
    await sessionRows.first().click();
    
    // Verify dialog opens with real AI analysis
    await expect(page.locator('text=Analyzed Session Details').first()).toBeVisible();
    await expect(page.locator('text=AI-Extracted Facts').first()).toBeVisible();
    await expect(page.locator('text=General Intent').first()).toBeVisible();
    await expect(page.locator('text=Session Outcome').first()).toBeVisible();
    
    // Close dialog
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('text=Analyzed Session Details').first()).not.toBeVisible();
    
    // Step 15: Verify report actions are available
    await expect(page.locator('text=Download Report Data')).toBeVisible();
    await expect(page.locator('text=Share Report')).toBeVisible();
    await expect(page.locator('text=Start New Analysis')).toBeVisible();
    
    console.log('🎉 Real API Debug Test completed successfully!');
    console.log('💰 Remember to check OpenAI usage for actual costs incurred');
  });

  test('Real API Debug - configuration validation with real credentials', async ({ page }) => {
    if (!shouldRunTest) {
      test.skip();
      return;
    }

    console.log('🧪 Testing configuration validation with real credentials');

    // Enter real credentials and navigate to auto-analyze
    await page.getByRole('textbox', { name: 'Bot ID' }).fill(process.env.TEST_BOT_ID!);
    await page.getByRole('textbox', { name: 'Client ID' }).fill(process.env.TEST_CLIENT_ID!);
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill(process.env.TEST_CLIENT_SECRET!);
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await page.waitForURL('**/sessions', { timeout: 30000 });
    await page.getByRole('link', { name: 'Auto-Analyze' }).click();
    
    // Test validation: Future date should be rejected
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureDate = tomorrow.toISOString().split('T')[0];
    
    await page.locator('#startDate').fill(futureDate);
    await page.locator('#startTime').fill('12:00');
    await page.locator('#sessionCount').fill('5');
    await page.locator('#openaiApiKey').fill('invalid-key');
    
    await page.getByRole('button', { name: 'Start Analysis' }).click();
    
    // Should show validation errors
    await expect(page.locator('text=Date must be in the past')).toBeVisible();
    await expect(page.locator('text=Invalid OpenAI API key format')).toBeVisible();
    
    console.log('✅ Configuration validation working correctly');
  });
});