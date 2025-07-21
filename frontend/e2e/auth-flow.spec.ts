import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session storage
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.clear();
    });
  });

  test('should display login page with pre-filled credentials', async ({ page }) => {
    await page.goto('/');

    // Check that the welcome message is displayed
    await expect(page.getByText('Welcome to XOB CAT')).toBeVisible();
    // Use exact match to avoid multiple matches
    await expect(page.getByText('XO Bot Conversation Analysis Tools', { exact: true })).toBeVisible();

    // Check that credential fields are present and pre-filled
    const botIdInput = page.getByLabel('Bot ID');
    const clientIdInput = page.getByLabel('Client ID');
    const clientSecretInput = page.getByLabel('Client Secret');

    await expect(botIdInput).toBeVisible();
    await expect(clientIdInput).toBeVisible();
    await expect(clientSecretInput).toBeVisible();

    // Check that fields have default values
    await expect(botIdInput).toHaveValue('***REMOVED***');
    await expect(clientIdInput).toHaveValue('***REMOVED***');
    await expect(clientSecretInput).toHaveValue('***REMOVED***');

    // Check that connect button is present
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/');

    // Clear the pre-filled values
    await page.getByLabel('Bot ID').clear();
    await page.getByLabel('Client ID').clear();
    await page.getByLabel('Client Secret').clear();

    // Click connect without filling fields
    await page.getByRole('button', { name: 'Connect' }).click();

    // Check for validation errors
    await expect(page.getByText('Bot ID is required')).toBeVisible();
    await expect(page.getByText('Client ID is required')).toBeVisible();
    await expect(page.getByText('Client Secret is required')).toBeVisible();
  });

  test('should successfully connect and redirect to sessions page', async ({ page }) => {
    await page.goto('/');

    // Mock the health check API response
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

    // Click connect
    await page.getByRole('button', { name: 'Connect' }).click();

    // Wait for redirect to dashboard sessions page
    await expect(page).toHaveURL('/dashboard/sessions');

    // Check that we're on the sessions page
    await expect(page.getByText('Loading...')).toBeVisible();
    await expect(page.getByText('Setting up your dashboard')).toBeVisible();
  });

  test('should show error message on connection failure', async ({ page }) => {
    await page.goto('/');

    // Mock the health check API to fail
    await page.route('http://localhost:3001/health', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Connection failed'
        })
      });
    });

    // Click connect
    await page.getByRole('button', { name: 'Connect' }).click();

    // Check for error message (match partial text to be robust)
    await expect(page.getByText(/Connection failed|Backend service unavailable|Error/i)).toBeVisible();
  });

  test('should show loading state during connection', async ({ page }) => {
    await page.goto('/');

    // Mock the health check API to delay
    await page.route('http://localhost:3001/health', async route => {
      // Add a delay to simulate network latency
      await new Promise(resolve => setTimeout(resolve, 1000));
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

    // Click connect
    const connectButton = page.getByRole('button', { name: 'Connect' });
    await connectButton.click();

    // Check that button shows loading state
    await expect(connectButton).toBeDisabled();
    await expect(page.getByText('Connecting...')).toBeVisible();
  });
}); 