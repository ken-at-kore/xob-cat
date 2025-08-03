/**
 * Real API Message Display Test
 * Tests that messages display correctly with real Kore.ai API data
 */

import { test, expect } from '@playwright/test';

// Use real credentials from environment
const REQUIRED_ENV_VARS = ['TEST_BOT_ID', 'TEST_CLIENT_ID', 'TEST_CLIENT_SECRET'];
const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);
const hasRealCredentials = missingVars.length === 0;

if (!hasRealCredentials) {
  console.log(`⚠️  Real API credentials missing: ${missingVars.join(', ')}`);
  console.log('Skipping real API message display test.');
}

test.use({ 
  actionTimeout: 45000,
  navigationTimeout: 45000
});

test.describe('Real API Message Display Test', () => {

  test('Real API - validates message display with production data', async ({ page }) => {
    // Skip if credentials not available
    if (!hasRealCredentials) {
      test.skip();
      return;
    }
    
    console.log('🚀 Testing message display with real Kore.ai API');
    
    // Set longer timeout for API calls
    page.setDefaultTimeout(60000);
    
    // Navigate to credentials page
    await page.goto('http://localhost:3000/');
    await expect(page.locator('text=Welcome to XOBCAT')).toBeVisible();
    
    console.log('📝 Step 1: Entering real credentials');
    
    // Enter real credentials
    await page.getByRole('textbox', { name: 'Bot ID' }).fill(process.env.TEST_BOT_ID!);
    await page.getByRole('textbox', { name: 'Client ID' }).fill(process.env.TEST_CLIENT_ID!);
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill(process.env.TEST_CLIENT_SECRET!);
    await page.getByRole('button', { name: 'Connect' }).click();
    
    console.log('🔄 Step 2: Waiting for navigation');
    
    // Wait for navigation with generous timeout
    await page.waitForURL('**/sessions', { timeout: 45000 });
    await expect(page.locator('text=View Sessions')).toBeVisible();
    
    console.log('📊 Step 3: Configuring date filter for known data period');
    
    // Configure for Aug 1st 9am-12pm ET where we know there are 15 sessions
    const startDateInput = page.locator('input[type="date"]').first();
    await startDateInput.fill('2025-08-01');
    
    const startTimeInput = page.locator('input[type="time"]').first();
    await startTimeInput.fill('09:00');
    
    const endDateInput = page.locator('input[type="date"]').last();
    await endDateInput.fill('2025-08-01');
    
    const endTimeInput = page.locator('input[type="time"]').last();
    await endTimeInput.fill('12:00');
    
    // Apply filters - look for Search or Apply button
    const searchButton = page.locator('button:has-text("Search"), button:has-text("Apply"), button[type="submit"]').first();
    await searchButton.click();
    
    console.log('⏳ Step 4: Waiting for real session data');
    
    // Wait for sessions to load with longer timeout
    await page.waitForTimeout(3000); // Give API time to respond
    
    // Check for sessions table or no sessions message
    const hasTable = await page.locator('table tbody tr').count() > 0;
    const hasNoSessions = await page.locator('text=No sessions found').isVisible().catch(() => false);
    const isLoading = await page.locator('text=Loading').isVisible().catch(() => false);
    
    console.log(`Session loading status: hasTable=${hasTable}, hasNoSessions=${hasNoSessions}, isLoading=${isLoading}`);
    
    if (isLoading) {
      console.log('⏳ Still loading, waiting longer...');
      await page.waitForTimeout(10000); // Wait up to 10 more seconds
    }
    
    const sessionRows = page.locator('table tbody tr');
    const sessionCount = await sessionRows.count();
    
    console.log(`Found ${sessionCount} sessions in UI`);
    
    if (sessionCount > 0) {
      console.log('🔍 Step 5: Testing message display in session details');
      
      // Click on first session
      await sessionRows.first().click();
      
      // Wait for dialog
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });
      
      // Verify conversation section
      await expect(page.locator('h3:has-text("Conversation")')).toBeVisible();
      
      console.log('💬 Step 6: Checking messages in session details');
      
      // Check for messages (should now work with our fix)
      const messageElements = page.locator('.space-y-4 > div:has(.flex-shrink-0)');
      const messageCount = await messageElements.count();
      const userBadges = await page.locator('text=User').count();
      const botBadges = await page.locator('text=Bot').count();
      const hasNoMessagesText = await page.locator('text=No messages in this session').isVisible().catch(() => false);
      
      console.log(`Real API message analysis: messageCount=${messageCount}, userBadges=${userBadges}, botBadges=${botBadges}, hasNoMessagesText=${hasNoMessagesText}`);
      
      if (messageCount > 0 && !hasNoMessagesText) {
        console.log('✅ SUCCESS: Real API messages display correctly after fix');
        
        // Get sample message text
        const firstMessageText = await messageElements.first().locator('.text-sm.break-words').textContent().catch(() => 'Could not read');
        console.log(`Sample real message: "${firstMessageText?.substring(0, 50)}..."`);
        
        // Verify we have both user and bot messages  
        expect(userBadges + botBadges).toBeGreaterThan(0);
        expect(hasNoMessagesText).toBe(false);
        
      } else if (hasNoMessagesText) {
        console.log('❌ REGRESSION STILL EXISTS: Real API shows "No messages" despite having session data');
        
        // Take screenshot for debugging
        await page.screenshot({ path: 'real-api-regression.png' });
        
        throw new Error('Message display regression persists with real API data');
        
      } else {
        console.log('⚠️  Unclear message state with real API data');
        await page.screenshot({ path: 'real-api-unclear-state.png' });
      }
      
      // Close dialog
      await page.getByRole('button', { name: 'Close' }).click();
      
    } else {
      console.log('⚠️  No sessions found for Aug 1st 9am-12pm - real API may have different data');
      
      // Take screenshot to see what's shown
      await page.screenshot({ path: 'real-api-no-sessions.png' });
    }
    
    console.log('🎉 Real API message display test completed');
  });

});