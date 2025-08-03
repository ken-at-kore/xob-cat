/**
 * Simple Session Test - Basic session viewer functionality
 */

import { test, expect } from '@playwright/test';

test.use({ 
  actionTimeout: 30000,
  navigationTimeout: 30000
});

test.describe('Simple Session Test', () => {

  test('Basic session viewer flow with mock credentials', async ({ page }) => {
    console.log('🚀 Starting basic session viewer test');
    
    // Navigate to credentials page
    await page.goto('http://localhost:3000/');
    
    // Verify we're on the credentials page
    await expect(page.locator('text=Welcome to XOBCAT')).toBeVisible();
    
    console.log('✅ Credentials page loaded');
    
    // Enter mock credentials
    await page.getByRole('textbox', { name: 'Bot ID' }).fill('st-mock-bot-id-12345');
    await page.getByRole('textbox', { name: 'Client ID' }).fill('cs-mock-client-id-67890');
    await page.getByRole('textbox', { name: 'API Token Configuration Field' }).fill('mock-client-secret-abcdef');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    console.log('✅ Credentials entered and Connect clicked');
    
    // Wait for navigation to sessions page
    try {
      await page.waitForURL('**/sessions', { timeout: 30000 });
      console.log('✅ Navigated to sessions page');
    } catch (error) {
      console.log('❌ Failed to navigate to sessions page:', error);
      // Take screenshot for debugging
      await page.screenshot({ path: 'debug-navigation-failure.png' });
      throw error;
    }
    
    // Check if we can see the sessions interface
    await expect(page.locator('text=View Sessions')).toBeVisible();
    console.log('✅ Sessions page interface visible');
    
    // Look for session data or loading indicators - wait longer for API calls
    console.log('⏳ Waiting for session data to load...');
    
    // First check if it's initially loading
    const initialLoading = await page.locator('text=Loading sessions').isVisible({ timeout: 2000 }).catch(() => false);
    if (initialLoading) {
      console.log('📊 Initial loading state detected, waiting for completion...');
      // Wait for loading to finish
      await page.locator('text=Loading sessions').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
        console.log('⚠️  Loading did not finish within 30 seconds');
      });
    }
    
    // Now check for final state with longer timeout
    const hasTable = await page.locator('table').isVisible({ timeout: 15000 }).catch(() => false);
    const hasLoading = await page.locator('text=Loading').isVisible({ timeout: 2000 }).catch(() => false);
    const hasNoSessions = await page.locator('text=No sessions').isVisible({ timeout: 2000 }).catch(() => false);
    
    console.log(`Session data status: hasTable=${hasTable}, hasLoading=${hasLoading}, hasNoSessions=${hasNoSessions}`);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'debug-sessions-page.png' });
    console.log('📸 Screenshot saved as debug-sessions-page.png');
    
    // Check for error messages
    const hasError = await page.locator('text=Error, text=Failed').isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`Has error messages: ${hasError}`);
    
    if (hasTable) {
      console.log('✅ Session table found');
      
      // Check if there are session rows
      const sessionRows = page.locator('table tbody tr');
      const sessionCount = await sessionRows.count();
      
      console.log(`Found ${sessionCount} session rows`);
      
      if (sessionCount > 0) {
        console.log('✅ Sessions found - clicking first session');
        
        // Click on first session to test modal
        await sessionRows.first().click();
        
        // Wait for dialog to open
        const dialogVisible = await page.locator('[role="dialog"]').isVisible({ timeout: 5000 }).catch(() => false);
        
        if (dialogVisible) {
          console.log('✅ Session details dialog opened');
          
          // Look for conversation section - be more specific about the locator
          const conversationHeading = page.locator('h3:has-text("Conversation")');
          const conversationVisible = await conversationHeading.isVisible({ timeout: 3000 }).catch(() => false);
          
          console.log(`Conversation section search: conversationVisible=${conversationVisible}`);
          
          if (conversationVisible) {
            console.log('✅ Conversation section found');
            
            // Check for messages - look for the message badges specifically
            const messageCount = await page.locator('.space-y-4 > div:has(.flex-shrink-0)').count();
            const userBadges = await page.locator('text=User').count();
            const botBadges = await page.locator('text=Bot').count();
            const hasNoMessagesText = await page.locator('text=No messages in this session').isVisible({ timeout: 2000 }).catch(() => false);
            
            console.log(`Message analysis: messageCount=${messageCount}, userBadges=${userBadges}, botBadges=${botBadges}, hasNoMessagesText=${hasNoMessagesText}`);
            
            if (messageCount > 0 || userBadges > 0 || botBadges > 0) {
              console.log('✅ SUCCESS: Messages are displayed in session details dialog');
              
              // Get some sample message text to verify content
              const firstMessageText = await page.locator('.space-y-4 > div .text-sm.break-words').first().textContent().catch(() => 'Could not read message text');
              console.log(`First message preview: "${firstMessageText?.substring(0, 50)}..."`);
              
            } else if (hasNoMessagesText) {
              console.log('❌ REGRESSION DETECTED: Session details shows "No messages in this session"');
              console.log('This indicates the message display regression bug we are looking for');
              
              // Take screenshot of the regression
              await page.screenshot({ path: 'regression-no-messages.png' });
              console.log('📸 Regression screenshot saved as regression-no-messages.png');
              
            } else {
              console.log('⚠️  Unclear message state - could be loading or other UI state');
              
              // Take screenshot for debugging
              await page.screenshot({ path: 'debug-message-state.png' });
              console.log('📸 Debug screenshot saved as debug-message-state.png');
            }
            
            // Close dialog
            await page.getByRole('button', { name: 'Close' }).click();
            console.log('✅ Dialog closed');
            
          } else {
            console.log('❌ Conversation section not found in session details dialog');
            
            // Take screenshot to see what's in the dialog
            await page.screenshot({ path: 'debug-dialog-content.png' });
            console.log('📸 Dialog content screenshot saved as debug-dialog-content.png');
          }
          
        } else {
          console.log('❌ Session details dialog did not open after clicking session row');
          
          // Take screenshot to see current state
          await page.screenshot({ path: 'debug-dialog-not-opened.png' });
          console.log('📸 No dialog screenshot saved as debug-dialog-not-opened.png');
        }
        
      } else {
        console.log('⚠️  No session rows found in table');
      }
      
    } else if (hasLoading) {
      console.log('⚠️  Still loading - may need to wait longer');
    } else if (hasNoSessions) {
      console.log('⚠️  No sessions message displayed');
    } else {
      console.log('❌ Unclear session data state');
    }
    
    console.log('🎉 Basic session viewer test completed');
  });

});