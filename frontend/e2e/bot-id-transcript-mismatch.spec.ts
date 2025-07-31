import { test, expect } from '@playwright/test';

test.describe('Bot ID vs Transcript Content Mismatch Bug', () => {
  test('should detect Optum-specific messages in actual session data when using ComPsych credentials', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Log in with ComPsych credentials
    await page.fill('input[placeholder="Enter your Bot ID"]', '');
    await page.fill('input[placeholder="Enter your Bot ID"]', '***REMOVED***');
    await page.fill('input[placeholder="Enter your Client ID"]', '');
    await page.fill('input[placeholder="Enter your Client ID"]', 'cs-8c35c68f-8dc4-5c87-b47f-953b76f070ad');
    await page.fill('input[placeholder="Enter your Client Secret"]', '');
    await page.fill('input[placeholder="Enter your Client Secret"]', 'MtJPUaBQkbqsrLZ2n8NQGWW9KjC2MdUvvSJqgJAJdvY=');
    await page.click('button:has-text("Connect")');

    await page.waitForURL('**/sessions');

    // Go to View Sessions page to see the actual data being fetched
    await page.click('a:has-text("View Sessions")');
    await page.waitForURL('**/sessions');
    
    // Wait for sessions to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Click on the first session to see its transcript
    const firstSessionRow = await page.locator('table tbody tr').first();
    await firstSessionRow.click();

    // Wait for the session details dialog to open
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Look for the transcript section
    const transcriptSection = await page.locator('[role="dialog"]').locator('text=Transcript').locator('..');
    
    // Get the full transcript text
    const transcriptText = await transcriptSection.textContent();
    console.log('Session transcript preview:', transcriptText?.substring(0, 800));

    // Check if the transcript contains the Optum-specific bot message
    const optumSpecificMessage = "Please state the reason for the contact today, such as claim status, billing, member eligibility, provider enrollment, web portal, prior authorization, Electronic Data Interchange, or other.";
    
    const containsOptumMessage = transcriptText?.includes(optumSpecificMessage) || 
                                 transcriptText?.includes("claim status, billing, member eligibility, provider enrollment") ||
                                 transcriptText?.includes("Electronic Data Interchange");
    
    console.log(`Contains Optum-specific message patterns: ${containsOptumMessage}`);
    
    if (containsOptumMessage) {
      console.log('🐛 BUG REPRODUCED: ComPsych credentials but Optum transcript content found!');
      console.log('This proves that mockDataService.ts is using hardcoded Optum config instead of respecting passed credentials.');
    } else {
      console.log('No Optum-specific message found in session data');
    }

    // Close the dialog
    await page.keyboard.press('Escape');
  });

  test('should check multiple sessions for transcript content consistency', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Log in with ComPsych credentials
    await page.fill('input[placeholder="Enter your Bot ID"]', '');
    await page.fill('input[placeholder="Enter your Bot ID"]', '***REMOVED***');
    await page.fill('input[placeholder="Enter your Client ID"]', '');
    await page.fill('input[placeholder="Enter your Client ID"]', 'cs-8c35c68f-8dc4-5c87-b47f-953b76f070ad');
    await page.fill('input[placeholder="Enter your Client Secret"]', '');
    await page.fill('input[placeholder="Enter your Client Secret"]', 'MtJPUaBQkbqsrLZ2n8NQGWW9KjC2MdUvvSJqgJAJdvY=');
    await page.click('button:has-text("Connect")');

    await page.waitForURL('**/sessions');
    await page.click('a:has-text("Auto-Analyze")');
    await page.waitForURL('**/analyze');
    await page.click('button:has-text("See Mock Reports")');
    await page.waitForSelector('h1:has-text("Analysis Report")');

    // Check first 3 sessions for transcript consistency
    const sessionRows = await page.locator('table tbody tr').all();
    const maxSessions = Math.min(3, sessionRows.length);
    
    let optumMessageCount = 0;
    let totalSessions = 0;

    for (let i = 0; i < maxSessions; i++) {
      totalSessions++;
      
      // Click on the session row
      await sessionRows[i].click();
      await page.waitForSelector('[role="dialog"]');

      // Get transcript content
      const transcriptSection = await page.locator('[role="dialog"]').locator('text=Transcript').locator('..').locator('..');
      const transcriptText = await transcriptSection.textContent();

      // Check for Optum-specific message
      const optumSpecificMessage = "Please state the reason for the contact today, such as claim status, billing, member eligibility, provider enrollment, web portal, prior authorization, Electronic Data Interchange, or other.";
      
      if (transcriptText?.includes(optumSpecificMessage)) {
        optumMessageCount++;
        console.log(`Session ${i + 1}: Contains Optum-specific message`);
      } else {
        console.log(`Session ${i + 1}: No Optum-specific message found`);
      }

      // Close dialog and move to next
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500); // Small delay for dialog to close
    }

    console.log(`Found Optum-specific messages in ${optumMessageCount}/${totalSessions} sessions`);
    
    // If any sessions contain Optum messages while using ComPsych credentials, that's the bug
    if (optumMessageCount > 0) {
      console.log(`BUG CONFIRMED: ${optumMessageCount} sessions contain Optum data while logged in as ComPsych`);
      expect(optumMessageCount).toBe(0); // This should fail, proving the bug
    }
  });
});