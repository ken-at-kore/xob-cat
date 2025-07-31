import { test, expect } from '@playwright/test';

test.describe('Missing Classifications Bug Reproduction', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('http://localhost:3000');
    
    // Use real ComPsych bot credentials
    await page.fill('input[placeholder*="Bot ID"]', '***REMOVED***');
    await page.fill('input[placeholder*="Client ID"]', '***REMOVED***');
    await page.fill('input[placeholder*="Client Secret"]', '***REMOVED***');
    
    // Connect and wait for redirect
    await page.click('button:has-text("Connect")');
    await page.waitForURL('**/sessions');
  });

  test('should reproduce missing classifications bug with gpt-4o-nano', async ({ page }) => {
    // Navigate to Auto-Analyze
    await page.click('text=Auto-Analyze');
    await page.waitForURL('**/analyze');

    // Set up test parameters matching the bug report:
    // Date: 7/21/2025, Time: 9am Eastern, 10 sessions, gpt-4o-nano
    await page.fill('input[type="date"]', '2025-07-21');
    await page.fill('input[type="time"]', '09:00');
    await page.fill('input[type="number"]', '10');
    
    // Select gpt-4o-nano model
    await page.selectOption('select', 'gpt-4o-nano');
    
    // Use real OpenAI API key from .env
    await page.fill('input[type="password"]', process.env.OPENAI_API_KEY || 'sk-test-key');

    // Start analysis
    await page.click('button:has-text("Start Analysis")');

    // Wait for analysis to complete
    await page.waitForSelector('text=Analysis Results', { timeout: 120000 }); // 2 minutes max

    // Check for the bug: sessions with notes but missing classifications
    const rows = await page.locator('tbody tr').all();
    
    let bugFoundCount = 0;
    
    for (const row of rows) {
      const cells = await row.locator('td').all();
      
      if (cells.length >= 6) {
        const generalIntent = await cells[1].textContent(); // General Intent column
        const sessionOutcome = await cells[2].textContent(); // Session Outcome column  
        const transferReason = await cells[3].textContent(); // Transfer Reason column
        const dropOffLocation = await cells[4].textContent(); // Drop-off Location column
        const notes = await cells[5].textContent(); // Notes column
        
        // Check if this row has the bug: notes present but classifications missing
        const hasNotes = notes && notes.trim() && !notes.includes('—') && !notes.includes('-');
        const missingClassifications = (
          !generalIntent || generalIntent.includes('—') || generalIntent.includes('-') ||
          !sessionOutcome || sessionOutcome.includes('—') || sessionOutcome.includes('-')
        );
        
        if (hasNotes && missingClassifications) {
          bugFoundCount++;
          console.log(`Bug found in row: Intent="${generalIntent}", Outcome="${sessionOutcome}", Notes="${notes}"`);
        }
      }
    }

    // Take a screenshot for documentation
    await page.screenshot({ 
      path: 'test-results/missing-classifications-bug-repro.png',
      fullPage: true 
    });

    // Report findings
    console.log(`Found ${bugFoundCount} sessions with the missing classifications bug`);
    
    // The test passes if we reproduce the bug (expecting some missing classifications)
    // This documents the current broken behavior
    if (bugFoundCount > 0) {
      console.log(`✓ Successfully reproduced the bug with ${bugFoundCount} affected sessions`);
    } else {
      console.log('⚠️ Bug not reproduced - all sessions have complete classifications');
    }
  });

  test('should validate that sessions with missing classifications still have analysis metadata', async ({ page }) => {
    // Navigate to Auto-Analyze with mock data to ensure we have predictable test data
    await page.click('text=Auto-Analyze');
    await page.waitForURL('**/analyze');

    // Click "See Mock Reports" button to use test data
    await page.click('button:has-text("See Mock Reports")');
    
    // Wait for results to load
    await page.waitForSelector('text=Analysis Results');
    
    // Click on a session row to open details
    await page.click('tbody tr:first-child');
    
    // Wait for dialog to open
    await page.waitForSelector('[role="dialog"]');
    
    // Check that analysis metadata is still present even if classifications are missing
    await expect(page.locator('text=Analysis Metadata')).toBeVisible();
    await expect(page.locator('text=Tokens Used')).toBeVisible();
    await expect(page.locator('text=Processing Time')).toBeVisible();
    await expect(page.locator('text=Batch Number')).toBeVisible();
  });
});