import { test, expect } from '@playwright/test';
import { ROUTES } from '../src/routes';

test.describe('Complete User Journey', () => {
  test('should complete full user journey from login to viewing sessions', async ({ page }) => {
    // Step 1: Start at the home page
    await page.goto('/');
    
    // Verify we're on the login page
    await expect(page.getByText('Welcome to XOB CAT')).toBeVisible();
    await expect(page.getByText(/XO Bot Conversation Analysis Tools/)).toBeVisible();

    // Step 2: Mock the health check API for successful connection
    await page.route('http://localhost:3001/health', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          service: 'XOB CAT Backend API'
        })
      });
    });

    // Step 3: Mock the sessions API to return realistic data
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              session_id: 'session_journey_001',
              user_id: 'user_journey_001',
              start_time: '2025-07-21T09:00:00.000Z',
              end_time: '2025-07-21T09:03:30.000Z',
              containment_type: 'selfService',
              tags: ['Claim Status', 'Contained'],
              metrics: {
                total_messages: 8,
                user_messages: 4,
                bot_messages: 4
              },
              messages: [
                {
                  timestamp: '2025-07-21T09:00:00.000Z',
                  message_type: 'user',
                  message: 'I need to check the status of my claim'
                },
                {
                  timestamp: '2025-07-21T09:00:30.000Z',
                  message_type: 'bot',
                  message: 'I can help you check your claim status. Please provide your claim number.'
                },
                {
                  timestamp: '2025-07-21T09:01:00.000Z',
                  message_type: 'user',
                  message: 'My claim number is 123456789'
                },
                {
                  timestamp: '2025-07-21T09:01:30.000Z',
                  message_type: 'bot',
                  message: 'Thank you. Let me look up your claim. I found claim 123456789. The status is currently "Under Review" and was submitted on 2024-01-15.'
                }
              ],
              duration_seconds: 210,
              message_count: 8,
              user_message_count: 4,
              bot_message_count: 4
            },
            {
              session_id: 'session_journey_002',
              user_id: 'user_journey_002',
              start_time: '2025-07-21T10:00:00.000Z',
              end_time: '2025-07-21T10:02:15.000Z',
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
                },
                {
                  timestamp: '2025-07-21T10:01:00.000Z',
                  message_type: 'user',
                  message: 'My member ID is MEM123456'
                },
                {
                  timestamp: '2025-07-21T10:01:30.000Z',
                  message_type: 'bot',
                  message: 'I\'m sorry, but I couldn\'t find a member with ID MEM123456. Let me transfer you to a customer service representative.'
                }
              ],
              duration_seconds: 135,
              message_count: 6,
              user_message_count: 3,
              bot_message_count: 3
            }
          ],
          total_count: 2
        })
      });
    });

    // Step 4: Click the Connect button
    const connectButton = page.getByRole('button', { name: 'Connect' });
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // Step 5: Verify we're redirected to the sessions page
    await expect(page).toHaveURL(ROUTES.DASHBOARD_SESSIONS);

    // Step 6: Wait for the sessions page to load and display data
    await expect(page.getByText('Sessions')).toBeVisible();
    await expect(page.getByText('Browse and analyze chatbot session data')).toBeVisible();

    // Step 7: Verify that session data is displayed correctly
    await expect(page.getByText('session_journey_001...')).toBeVisible();
    await expect(page.getByText('session_journey_002...')).toBeVisible();
    await expect(page.getByText('Self Service')).toBeVisible();
    await expect(page.getByText('Agent')).toBeVisible();

    // Step 8: Verify the session table structure
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Session ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Start Time' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Containment Type' })).toBeVisible();

    // Step 9: Verify session count
    await expect(page.getByText('2 sessions found')).toBeVisible();

    // Step 10: Test the refresh functionality
    const refreshButton = page.getByRole('button', { name: 'Refresh' });
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // Step 11: Verify the page still shows the data after refresh
    await expect(page.getByText('Sessions')).toBeVisible();
    await expect(page.getByText('2 sessions found')).toBeVisible();
  });

  test('should handle authentication failure gracefully', async ({ page }) => {
    // Step 1: Start at the home page
    await page.goto('/');

    // Step 2: Mock the health check API to fail
    await page.route('http://localhost:3001/health', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Backend service unavailable'
        })
      });
    });

    // Step 3: Click connect and verify error handling
    await page.getByRole('button', { name: 'Connect' }).click();

    // Step 4: Verify error message is displayed
    await expect(page.getByText(/Backend service unavailable/)).toBeVisible();

    // Step 5: Verify we're still on the home page
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Welcome to XOB CAT')).toBeVisible();
  });

  test('should handle sessions API failure gracefully', async ({ page }) => {
    // Step 1: Set up authentication
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('botCredentials', JSON.stringify({
        botId: '***REMOVED***',
        clientId: '***REMOVED***',
        clientSecret: '***REMOVED***'
      }));
    });

    // Step 2: Mock the sessions API to fail
    await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Failed to fetch sessions',
          message: 'Database connection error'
        })
      });
    });

    // Step 3: Navigate to sessions page
    await page.goto(ROUTES.DASHBOARD_SESSIONS);

    // Step 4: Verify error handling
    await expect(page.getByText(/Error:/)).toBeVisible();
    await expect(page.getByText(/Failed to fetch sessions/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    // Step 5: Test retry functionality
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

    await page.getByRole('button', { name: 'Retry' }).click();

    // Step 6: Verify retry worked
    await expect(page.getByText('Sessions')).toBeVisible();
    await expect(page.getByText('0 sessions found')).toBeVisible();
  });
}); 