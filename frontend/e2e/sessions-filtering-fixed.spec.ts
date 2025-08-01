import { test, expect } from '@playwright/test';

test.describe('Sessions Filtering - Fixed Implementation', () => {
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

  test('should properly filter sessions by date range', async ({ page }) => {
    let requestCount = 0;
    const capturedRequests: string[] = [];
    
    // Mock API responses
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      requestCount++;
      const url = route.request().url();
      capturedRequests.push(url);
      
      if (requestCount === 1) {
        // Initial load - return multiple sessions from different dates
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                session_id: 'session_jan_1',
                user_id: 'user_1',
                start_time: '2025-01-15T10:00:00.000Z',
                end_time: '2025-01-15T10:05:00.000Z',
                containment_type: 'selfService',
                tags: [],
                metrics: { total_messages: 5, user_messages: 2, bot_messages: 3 },
                messages: [],
                duration_seconds: 300,
                message_count: 5,
                user_message_count: 2,
                bot_message_count: 3
              },
              {
                session_id: 'session_jul_22',
                user_id: 'user_2',
                start_time: '2025-07-22T14:30:00.000Z',
                end_time: '2025-07-22T14:35:00.000Z',
                containment_type: 'agent',
                tags: [],
                metrics: { total_messages: 8, user_messages: 4, bot_messages: 4 },
                messages: [],
                duration_seconds: 300,
                message_count: 8,
                user_message_count: 4,
                bot_message_count: 4
              }
            ],
            total_count: 2
          })
        });
      } else {
        // Filtered request - should only return July 22 session
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                session_id: 'session_jul_22',
                user_id: 'user_2',
                start_time: '2025-07-22T14:30:00.000Z',
                end_time: '2025-07-22T14:35:00.000Z',
                containment_type: 'agent',
                tags: [],
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

    // Wait for initial load
    await expect(page.getByText('2 sessions found')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('session_jan_1')).toBeVisible();
    await expect(page.getByText('session_jul_22')).toBeVisible();

    // Apply date filter for July 22, 2025
    await page.getByLabel('Start Date').fill('2025-07-22');
    await page.getByLabel('End Date').fill('2025-07-22');
    
    // Click Filter button
    await page.getByRole('button', { name: /filter/i }).click();
    
    // Wait for filtered results
    await expect(page.getByText('1 sessions found')).toBeVisible({ timeout: 10000 });
    
    // Verify correct filtering
    await expect(page.getByText('session_jul_22')).toBeVisible();
    await expect(page.getByText('session_jan_1')).not.toBeVisible();

    // Verify API was called with correct parameters
    expect(requestCount).toBe(2);
    const filteredRequest = capturedRequests[1];
    expect(filteredRequest).toContain('start_date=2025-07-22');
    expect(filteredRequest).toContain('end_date=2025-07-22');
  });

  test('should send time filters to API', async ({ page }) => {
    let capturedRequest = '';
    
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      capturedRequest = route.request().url();
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
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();

    // Fill in time filters
    await page.getByLabel('Start Time').fill('09:00');
    await page.getByLabel('End Time').fill('17:00');
    
    // Click Filter button
    await page.getByRole('button', { name: /filter/i }).click();
    
    await page.waitForTimeout(1000);

    // Verify time parameters are sent
    expect(capturedRequest).toContain('start_time=09%3A00'); // URL-encoded 09:00
    expect(capturedRequest).toContain('end_time=17%3A00'); // URL-encoded 17:00
  });

  test('should combine date and time filters correctly', async ({ page }) => {
    let capturedRequest = '';
    
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      capturedRequest = route.request().url();
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
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();

    // Fill in both date and time filters
    await page.getByLabel('Start Date').fill('2025-07-22');
    await page.getByLabel('End Date').fill('2025-07-23');
    await page.getByLabel('Start Time').fill('09:00');
    await page.getByLabel('End Time').fill('17:00');
    
    // Click Filter button
    await page.getByRole('button', { name: /filter/i }).click();
    
    await page.waitForTimeout(1000);

    // Verify all parameters are sent
    expect(capturedRequest).toContain('start_date=2025-07-22');
    expect(capturedRequest).toContain('end_date=2025-07-23');
    expect(capturedRequest).toContain('start_time=09%3A00');
    expect(capturedRequest).toContain('end_time=17%3A00');
  });
});