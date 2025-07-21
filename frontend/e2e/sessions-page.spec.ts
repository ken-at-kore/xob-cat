import { test, expect } from '@playwright/test';
import { ROUTES } from '../src/routes';

test.describe('Sessions Page', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication by storing credentials in session storage
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('botCredentials', JSON.stringify({
        botId: '***REMOVED***',
        clientId: '***REMOVED***',
        clientSecret: '***REMOVED***'
      }));
    });
  });

  test('should display sessions page with loading state', async ({ page }) => {
    await page.goto(ROUTES.DASHBOARD_SESSIONS);

    // Check that we're on the sessions page
    await expect(page.getByText('Loading...')).toBeVisible();
    await expect(page.getByText('Setting up your dashboard')).toBeVisible();
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
              messages: [
                {
                  timestamp: '2025-07-21T10:00:00.000Z',
                  message_type: 'user',
                  message: 'I need to check the status of my claim'
                },
                {
                  timestamp: '2025-07-21T10:00:30.000Z',
                  message_type: 'bot',
                  message: 'I can help you check your claim status. Please provide your claim number.'
                }
              ],
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

    await page.goto(ROUTES.DASHBOARD_SESSIONS);

    // Wait for sessions to load
    await expect(page.getByText('Sessions')).toBeVisible();
    await expect(page.getByText('Browse and analyze chatbot session data')).toBeVisible();

    // Check that session data is displayed
    await expect(page.getByText('session_123...')).toBeVisible();
    await expect(page.getByText('Self Service')).toBeVisible();
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

    await page.goto(ROUTES.DASHBOARD_SESSIONS);

    // Wait for error to be displayed
    await expect(page.getByText(/Error:/)).toBeVisible();
    await expect(page.getByText(/Failed to fetch sessions/)).toBeVisible();
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

    await page.goto(ROUTES.DASHBOARD_SESSIONS);

    // Wait for sessions to load
    await expect(page.getByText('Sessions')).toBeVisible();
    await expect(page.getByText('0 sessions found')).toBeVisible();
  });

  test('should show refresh button and allow manual refresh', async ({ page }) => {
    // Mock the sessions API response
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

    await page.goto(ROUTES.DASHBOARD_SESSIONS);

    // Check that refresh button is present
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();

    // Click refresh and verify API is called again
    await page.getByRole('button', { name: 'Refresh' }).click();
    
    // Wait a moment for the refresh to complete
    await page.waitForTimeout(1000);
  });

  test('should display session details correctly', async ({ page }) => {
    // Mock the sessions API response with detailed session data
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              session_id: 'session_test_123',
              user_id: 'user_test_456',
              start_time: '2025-07-21T10:00:00.000Z',
              end_time: '2025-07-21T10:05:00.000Z',
              containment_type: 'agent',
              tags: ['Billing', 'Transfer'],
              metrics: {
                total_messages: 6,
                user_messages: 3,
                bot_messages: 3
              },
              messages: [
                {
                  timestamp: '2025-07-21T10:00:00.000Z',
                  message_type: 'user',
                  message: 'I have a question about my bill'
                },
                {
                  timestamp: '2025-07-21T10:00:30.000Z',
                  message_type: 'bot',
                  message: 'I can help you with billing questions. Please provide your member ID or policy number.'
                }
              ],
              duration_seconds: 300,
              message_count: 6,
              user_message_count: 3,
              bot_message_count: 3
            }
          ],
          total_count: 1
        })
      });
    });

    await page.goto(ROUTES.DASHBOARD_SESSIONS);

    // Wait for sessions to load
    await expect(page.getByText('Sessions')).toBeVisible();

    // Check that session details are displayed correctly
    await expect(page.getByText('session_test_123...')).toBeVisible();
    await expect(page.getByText('Agent')).toBeVisible();
    
    // Check that the session table is present
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Session ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Start Time' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Containment Type' })).toBeVisible();
  });
}); 