import { test, expect } from '@playwright/test';
import { ROUTES } from '../src/routes';

test('Sessions page route exists', async ({ page }) => {
  // Attempt to visit the sessions page
  const response = await page.goto(`http://localhost:3000${ROUTES.DASHBOARD_SESSIONS}`);
  // Assert that the response is not 404 (Not Found)
  expect(response && response.status()).not.toBe(404);

  // Optionally, check for some expected content if the page exists
  // await expect(page).toHaveText('Sessions');
}); 