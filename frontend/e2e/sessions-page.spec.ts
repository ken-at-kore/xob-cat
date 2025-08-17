import { test, expect } from '@playwright/test';
import { ROUTES } from '../src/routes';

test.describe('Sessions Page', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication by storing credentials in session storage
    await page.goto('http://localhost:3000/');
    await page.evaluate(() => {
      sessionStorage.setItem('botCredentials', JSON.stringify({
        botId: 'st-mock-bot-id-12345',
        clientId: 'cs-mock-client-id-12345',
        clientSecret: 'mock-client-secret-12345'
      }));
    });
  });

  test('should display sessions page with loading state', async ({ page }) => {
    // Delay the API response to simulate loading
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      await new Promise(res => setTimeout(res, 2000));
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
    // Check that loading state is visible
    await expect(page.getByText('Overview')).toBeVisible();
    // Use first() to avoid strict mode violation
    await expect(page.getByText('Loading sessions...').first()).toBeVisible();
  });

  test('should load and display sessions data', async ({ page }) => {
    // Mock the sessions API response
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              session_id: 'session_123',
              user_id: 'user_456',
              start_time: '2025-07-21T10:00:00.000Z',
              end_time: '2025-07-21T10:05:00.000Z',
              containment_type: 'selfService',
              tags: ['Claim Status', 'Contained'],
              metrics: {
                total_messages: 8,
                user_messages: 4,
                bot_messages: 4
              },
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
    });

    await page.goto('http://localhost:3000/dashboard/sessions');

    // Wait for sessions to load
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await expect(page.getByText('Browse and analyze chatbot session data')).toBeVisible();

    // Check that session data is displayed
    await expect(page.getByText('session_123')).toBeVisible();
    await expect(page.getByText('Self Service')).toBeVisible();
    await expect(page.getByText('5m 0s')).toBeVisible();
  });

  test('should display error when sessions fail to load', async ({ page }) => {
    // Mock the sessions API to fail
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Failed to fetch sessions',
          message: 'Internal server error'
        })
      });
    });

    await page.goto('http://localhost:3000/dashboard/sessions');

    // Wait for error to be displayed (SessionTable error state)
    await expect(page.getByText('Overview')).toBeVisible();
    await expect(page.getByText('Error loading sessions')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('should display empty state when no sessions', async ({ page }) => {
    // Mock the sessions API to return empty data
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
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

    // Wait for sessions to load
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await expect(page.getByText('0 sessions found')).toBeVisible();
  });

  test('should display session details correctly', async ({ page }) => {
    // Mock the sessions API response
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              session_id: 'session_123',
              user_id: 'user_456',
              start_time: '2025-07-21T10:00:00.000Z',
              end_time: '2025-07-21T10:05:00.000Z',
              containment_type: 'selfService',
              tags: ['Claim Status', 'Contained'],
              metrics: {
                total_messages: 8,
                user_messages: 4,
                bot_messages: 4
              },
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
    });
    await page.goto('http://localhost:3000/dashboard/sessions');
    // Wait for table to appear
    await expect(page.getByRole('table')).toBeVisible();
    // Use getByText for headers to match current markup
    await expect(page.getByText('Session ID')).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Time/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Duration/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Containment Type/i })).toBeVisible();
    // Check that session data is displayed
    await expect(page.getByText('session_123')).toBeVisible();
    await expect(page.getByText('Self Service')).toBeVisible();
    await expect(page.getByText('5m 0s')).toBeVisible();
  });

  test('should only show 50 sessions from the last hour', async ({ page }) => {
    // Generate 100 sessions, 60 from the last hour, 40 from earlier
    const now = new Date();
    const sessions: any[] = [];
    for (let i = 0; i < 60; i++) {
      sessions.push({
        session_id: `recent_session_${i}`,
        user_id: `user_${i}`,
        start_time: new Date(now.getTime() - (i * 60 * 1000)).toISOString(), // i minutes ago
        end_time: new Date(now.getTime() - (i * 60 * 1000) + 300000).toISOString(),
        containment_type: 'selfService',
        tags: [],
        metrics: { total_messages: 5, user_messages: 2, bot_messages: 3 },
        messages: [],
        duration_seconds: 300,
        message_count: 5,
        user_message_count: 2,
        bot_message_count: 3
      });
    }
    for (let i = 0; i < 40; i++) {
      sessions.push({
        session_id: `old_session_${i}`,
        user_id: `user_old_${i}`,
        start_time: new Date(now.getTime() - (2 * 60 * 60 * 1000) - (i * 60 * 1000)).toISOString(), // 2+ hours ago
        end_time: new Date(now.getTime() - (2 * 60 * 60 * 1000) - (i * 60 * 1000) + 300000).toISOString(),
        containment_type: 'agent',
        tags: [],
        metrics: { total_messages: 5, user_messages: 2, bot_messages: 3 },
        messages: [],
        duration_seconds: 300,
        message_count: 5,
        user_message_count: 2,
        bot_message_count: 3
      });
    }
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: sessions,
          total_count: sessions.length
        })
      });
    });
    await page.goto('http://localhost:3000/dashboard/sessions');
    // Wait for sessions to load
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    // Only 50 rows should be shown in the table (excluding header)
    const rows = await page.locator('table tbody tr');
    await expect(rows).toHaveCount(50);
    // All shown sessions should be from the last hour
    for (let i = 0; i < 50; i++) {
      const sessionId = await rows.nth(i).locator('[data-testid="session-id"]').textContent();
      expect(sessionId).toContain('recent_session_');
      // Check that duration is '5m 0s'
      const durationCell = await rows.nth(i).locator('td').nth(2).textContent();
      expect(durationCell).toBe('5m 0s');
    }
  });

  test('filters sessions only when Filter button is clicked', async ({ page }) => {
    // Mock the sessions API to return two sessions on initial load, and only the filtered session after filter is applied
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      const url = new URL(route.request().url());
      const startDate = url.searchParams.get('start_date');
      if (startDate === '2025-07-22') {
        // Only return session_2 if filtering by this date
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                session_id: 'session_2',
                user_id: 'user_2',
                start_time: '2025-07-22T10:00:00.000Z',
                end_time: '2025-07-22T10:05:00.000Z',
                containment_type: 'agent',
                tags: [],
                metrics: { total_messages: 5, user_messages: 2, bot_messages: 3 },
                messages: [],
                duration_seconds: 300,
                message_count: 5,
                user_message_count: 2,
                bot_message_count: 3
              }
            ],
            total_count: 1
          })
        });
      } else {
        // Return both sessions for initial load
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                session_id: 'session_1',
                user_id: 'user_1',
                start_time: '2025-07-21T10:00:00.000Z',
                end_time: '2025-07-21T10:05:00.000Z',
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
                session_id: 'session_2',
                user_id: 'user_2',
                start_time: '2025-07-22T10:00:00.000Z',
                end_time: '2025-07-22T10:05:00.000Z',
                containment_type: 'agent',
                tags: [],
                metrics: { total_messages: 5, user_messages: 2, bot_messages: 3 },
                messages: [],
                duration_seconds: 300,
                message_count: 5,
                user_message_count: 2,
                bot_message_count: 3
              }
            ],
            total_count: 2
          })
        });
      }
    });

    await page.goto('http://localhost:3000/dashboard/sessions');

    // Wait for sessions to load (allow up to 20 seconds)
    await expect(page.getByText('session_1')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('session_2')).toBeVisible({ timeout: 20000 });

    // Set filter to only match session_2
    await page.getByLabel('Start Date').fill('2025-07-22');
    // Click the Filter button
    await page.getByRole('button', { name: /filter/i }).click();

    // Wait for the table to update (allow up to 20 seconds)
    await expect(page.getByText('session_2')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('session_1')).not.toBeVisible({ timeout: 20000 });
  });
}); 