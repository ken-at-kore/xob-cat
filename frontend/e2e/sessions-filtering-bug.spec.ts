import { test, expect } from '@playwright/test';

test.describe('Sessions Filtering Bug Reproduction', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication
    await page.goto('http://localhost:3000/');
    await page.evaluate(() => {
      sessionStorage.setItem('botCredentials', JSON.stringify({
        botId: 'st-mock-bot-id-12345',
        clientId: 'cs-mock-client-id-12345',
        clientSecret: 'mock-client-secret-12345'
      }));
    });
  });

  test('should reproduce date filtering bug - sessions not filtered by selected dates', async ({ page }) => {
    let requestCount = 0;
    const capturedRequests: string[] = [];
    
    // Intercept and log all API requests to understand parameter passing
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      requestCount++;
      const url = route.request().url();
      capturedRequests.push(url);
      console.log(`Request ${requestCount}: ${url}`);
      
      if (requestCount === 1) {
        // First request (initial page load) - return sessions from multiple dates
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                session_id: 'old_session_123',
                user_id: 'user_1',
                start_time: '2025-01-01T10:00:00.000Z', // January 1st
                end_time: '2025-01-01T10:05:00.000Z',
                containment_type: 'selfService',
                tags: ['Old Session'],
                metrics: { total_messages: 5, user_messages: 2, bot_messages: 3 },
                messages: [],
                duration_seconds: 300,
                message_count: 5,
                user_message_count: 2,
                bot_message_count: 3
              },
              {
                session_id: 'target_session_456',
                user_id: 'user_2',
                start_time: '2025-07-22T10:00:00.000Z', // July 22nd - target date
                end_time: '2025-07-22T10:05:00.000Z',
                containment_type: 'agent',
                tags: ['Target Session'],
                metrics: { total_messages: 8, user_messages: 4, bot_messages: 4 },
                messages: [],
                duration_seconds: 300,
                message_count: 8,
                user_message_count: 4,
                bot_message_count: 4
              },
              {
                session_id: 'future_session_789',
                user_id: 'user_3',
                start_time: '2025-12-31T10:00:00.000Z', // December 31st
                end_time: '2025-12-31T10:05:00.000Z',
                containment_type: 'dropOff',
                tags: ['Future Session'],
                metrics: { total_messages: 3, user_messages: 2, bot_messages: 1 },
                messages: [],
                duration_seconds: 180,
                message_count: 3,
                user_message_count: 2,
                bot_message_count: 1
              }
            ],
            total_count: 3
          })
        });
      } else {
        // Second request (after filtering) - should only return sessions for July 22nd
        // But due to the bug, the backend may not filter correctly
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              // This should be the only session returned when filtering by 2025-07-22
              {
                session_id: 'target_session_456',
                user_id: 'user_2',
                start_time: '2025-07-22T10:00:00.000Z',
                end_time: '2025-07-22T10:05:00.000Z',
                containment_type: 'agent',
                tags: ['Target Session'],
                metrics: { total_messages: 8, user_messages: 4, bot_messages: 4 },
                messages: [],
                duration_seconds: 300,
                message_count: 8,
                user_message_count: 4,
                bot_message_count: 4
              }
            ],
            total_count: 1
          })
        });
      }
    });

    await page.goto('http://localhost:3000/dashboard/sessions');

    // Wait for initial sessions to load
    await expect(page.getByText('3 sessions found')).toBeVisible({ timeout: 10000 });
    
    // Verify all 3 sessions are initially displayed
    await expect(page.getByText('old_session_123')).toBeVisible();
    await expect(page.getByText('target_session_456')).toBeVisible();
    await expect(page.getByText('future_session_789')).toBeVisible();

    // Now apply date filter for July 22, 2025
    await page.getByLabel('Start Date').fill('2025-07-22');
    await page.getByLabel('End Date').fill('2025-07-22');
    
    // Click the Filter button
    await page.getByRole('button', { name: /filter/i }).click();
    
    // Wait for the API call to complete
    await page.waitForTimeout(2000);

    // Log captured requests for debugging
    console.log('Captured API requests:');
    capturedRequests.forEach((req, index) => {
      console.log(`  ${index + 1}: ${req}`);
    });

    // This should pass if filtering works correctly
    // But will fail due to the parameter mapping bug
    await expect(page.getByText('1 sessions found')).toBeVisible({ timeout: 10000 });
    
    // Only the target session should be visible
    await expect(page.getByText('target_session_456')).toBeVisible();
    
    // These sessions should not be visible after filtering
    await expect(page.getByText('old_session_123')).not.toBeVisible();
    await expect(page.getByText('future_session_789')).not.toBeVisible();

    // Verify the API was called with correct parameters
    expect(requestCount).toBe(2);
    
    // Check that the second request includes the date filters
    const secondRequest = capturedRequests[1];
    expect(secondRequest).toContain('start_date=2025-07-22');
    expect(secondRequest).toContain('end_date=2025-07-22');
  });

  test('should reproduce time filtering bug - time filters should be sent to API', async ({ page }) => {
    let capturedRequest: string = '';
    
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      capturedRequest = route.request().url();
      console.log(`Request URL: ${capturedRequest}`);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          total_count: 0
        })
      });
    });

    await page.goto('http://localhost:3000/dashboard/sessions');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();

    // Fill in time filters (these should be sent to the API but currently are commented out)
    await page.getByLabel('Start Time').fill('09:00');
    await page.getByLabel('End Time').fill('17:00');
    
    // Click the Filter button
    await page.getByRole('button', { name: /filter/i }).click();
    
    await page.waitForTimeout(1000);

    console.log('Final request URL:', capturedRequest);
    
    // This should include time parameters - they should now be working
    expect(capturedRequest).toContain('start_time=09%3A00'); // URL-encoded 09:00
    expect(capturedRequest).toContain('end_time=17%3A00'); // URL-encoded 17:00
  });

  test('should demonstrate mock data override issue', async ({ page }) => {
    let requestUrl: string = '';
    
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      requestUrl = route.request().url();
      console.log(`Mock data test request: ${requestUrl}`);
      
      // Let the request go through to the actual backend to see mock behavior
      route.continue();
    });

    await page.goto('http://localhost:3000/dashboard/sessions');
    
    // Wait for initial load
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();

    // Apply a specific date filter that triggers the mock data special case
    await page.getByLabel('Start Date').fill('2025-07-22');
    await page.getByRole('button', { name: /filter/i }).click();
    
    await page.waitForTimeout(2000);

    // Check if we get the hard-coded session_2 instead of properly filtered results
    const pageContent = await page.textContent('body');
    console.log('Page contains session_2:', pageContent?.includes('session_2'));
    
    // Log the final request to see parameters
    console.log('Request with date filter:', requestUrl);
  });
});