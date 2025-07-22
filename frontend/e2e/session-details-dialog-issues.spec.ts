import { test, expect } from '@playwright/test';

test.describe('Session Details Dialog Issues', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to sessions page
    await page.goto('/dashboard/sessions');
    
    // Wait for sessions table to load
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000); // Give time for data to load
  });

  test('reproduces duration N/A issue and missing messages issue', async ({ page }) => {
    console.log('Starting session details dialog test...');

    // Find a session row in the table and note its duration
    const firstSessionRow = page.locator('tbody tr').first();
    await expect(firstSessionRow).toBeVisible();
    
    // Get the duration from the table to compare later
    const tableDurationCell = firstSessionRow.locator('td').nth(3); // Duration is typically 4th column
    await expect(tableDurationCell).toBeVisible();
    const tableDurationText = await tableDurationCell.textContent();
    console.log('Table duration:', tableDurationText);
    
    // Get the session ID for logging
    const sessionIdCell = firstSessionRow.locator('td').first();
    const sessionId = await sessionIdCell.textContent();
    console.log('Session ID:', sessionId);
    
    // Click the first session to open details dialog
    await firstSessionRow.click();
    
    // Wait for dialog to appear
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.getByText('Session Details')).toBeVisible();
    
    // Check if duration shows N/A (the bug)
    const durationRow = page.locator('text=Duration').locator('..').locator('..');
    await expect(durationRow).toBeVisible();
    
    const durationValue = durationRow.locator('div').nth(1);
    const durationText = await durationValue.textContent();
    console.log('Dialog duration:', durationText);
    
    // Check if messages section shows "No messages"
    await expect(page.getByText('Conversation')).toBeVisible();
    const conversationSection = page.locator('text=Conversation').locator('..');
    const noMessagesText = conversationSection.locator('text=No messages in this session.');
    
    const hasNoMessages = await noMessagesText.count() > 0;
    console.log('Shows "No messages":', hasNoMessages);
    
    // Log the actual session data by inspecting network requests
    page.on('response', response => {
      if (response.url().includes('/api/analysis/sessions')) {
        console.log('Sessions API response status:', response.status());
      }
    });
    
    // Reproduce the issues
    if (durationText?.includes('N/A')) {
      console.log('❌ BUG REPRODUCED: Duration shows N/A in dialog but shows', tableDurationText, 'in table');
    }
    
    if (hasNoMessages) {
      console.log('❌ BUG REPRODUCED: No messages displayed in session details');
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'session-details-issues.png', fullPage: true });
    
    // These assertions will fail if bugs exist, helping us identify the issues
    expect(durationText).not.toContain('N/A');
    expect(hasNoMessages).toBe(false);
  });

  test('debug session data structure', async ({ page }) => {
    console.log('Debugging session data structure...');

    // Intercept the API call to see what data is actually being returned
    let apiResponse: any = null;
    
    page.on('response', async response => {
      if (response.url().includes('/api/analysis/sessions')) {
        try {
          const jsonResponse = await response.json();
          apiResponse = jsonResponse;
          console.log('Full API Response:', JSON.stringify(jsonResponse, null, 2));
          
          if (jsonResponse.data && jsonResponse.data.length > 0) {
            const firstSession = jsonResponse.data[0];
            console.log('First session structure:', {
              session_id: firstSession.session_id,
              duration_seconds: firstSession.duration_seconds,
              duration_type: typeof firstSession.duration_seconds,
              messages_length: firstSession.messages?.length,
              messages_type: typeof firstSession.messages,
              first_message: firstSession.messages?.[0]
            });
          }
        } catch (e) {
          console.log('Failed to parse API response:', e);
        }
      }
    });

    // Trigger the API call
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Open a session details dialog to trigger any additional calls
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(1000);
    }
    
    expect(apiResponse).not.toBeNull();
  });
});