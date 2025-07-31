import { test, expect } from '@playwright/test';

test.describe('Auto-Analyze E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock successful authentication
    await page.route('**/api/kore/validate-credentials', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { valid: true, botId: 'test-bot-123' }
        })
      });
    });

    // Start from credentials page and authenticate
    await page.goto('http://localhost:3000');
    await page.fill('input[placeholder*="Bot ID"]', 'test-bot-123');
    await page.fill('input[placeholder*="JWT Token"]', 'mock-jwt-token');
    await page.click('button:has-text("Connect")');
    
    // Wait for redirect to sessions page
    await page.waitForURL('**/sessions');
  });

  test('should navigate to Auto-Analyze page from sidebar', async ({ page }) => {
    // Click on Auto-Analyze in sidebar
    await page.click('text=Auto-Analyze');
    
    // Should navigate to analyze page
    await page.waitForURL('**/analyze');
    
    // Should show configuration form
    await expect(page.locator('h1')).toContainText('Auto-Analyze');
    await expect(page.locator('text=comprehensive bot performance analysis')).toBeVisible();
  });

  test('should display configuration form with default values', async ({ page }) => {
    await page.goto('http://localhost:3000/analyze');

    // Check form elements are present
    await expect(page.locator('label:has-text("Start Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Start Time")')).toBeVisible();
    await expect(page.locator('label:has-text("Number of Sessions")')).toBeVisible();
    await expect(page.locator('label:has-text("OpenAI API Key")')).toBeVisible();

    // Check default values
    const sessionCountInput = page.locator('input[type="number"]');
    await expect(sessionCountInput).toHaveValue('100');

    const timeInput = page.locator('input[type="time"]');
    await expect(timeInput).toHaveValue('09:00');

    // Date should be 7 days ago
    const dateInput = page.locator('input[type="date"]');
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - 7);
    const expectedDateString = expectedDate.toISOString().split('T')[0];
    await expect(dateInput).toHaveValue(expectedDateString);
  });

  test('should validate form inputs', async ({ page }) => {
    await page.goto('http://localhost:3000/analyze');

    // Test session count validation
    const sessionCountInput = page.locator('input[type="number"]');
    await sessionCountInput.fill('3');
    await page.click('button:has-text("Start Analysis")');
    await expect(page.locator('text=must be between 5 and 1000')).toBeVisible();

    await sessionCountInput.fill('1500');
    await page.click('button:has-text("Start Analysis")');
    await expect(page.locator('text=must be between 5 and 1000')).toBeVisible();

    // Test OpenAI API key validation
    const apiKeyInput = page.locator('input[type="password"]');
    await sessionCountInput.fill('100'); // Fix session count
    await apiKeyInput.fill('invalid-key');
    await page.click('button:has-text("Start Analysis")');
    await expect(page.locator('text=Invalid OpenAI API key format')).toBeVisible();

    // Test date validation (future date)
    const dateInput = page.locator('input[type="date"]');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    await dateInput.fill(futureDate.toISOString().split('T')[0]);
    await page.click('button:has-text("Start Analysis")');
    await expect(page.locator('text=Date must be in the past')).toBeVisible();
  });

  test('should start analysis with valid configuration', async ({ page }) => {
    // Mock successful analysis start
    await page.route('**/api/analysis/auto-analyze/start', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { analysisId: 'analysis-123' }
        })
      });
    });

    // Mock progress endpoint
    await page.route('**/api/analysis/auto-analyze/progress/analysis-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            analysisId: 'analysis-123',
            phase: 'sampling',
            currentStep: 'Searching for sessions in 3-hour window',
            sessionsFound: 0,
            sessionsProcessed: 0,
            totalSessions: 100,
            batchesCompleted: 0,
            totalBatches: 0,
            tokensUsed: 0,
            estimatedCost: 0,
            startTime: new Date().toISOString()
          }
        })
      });
    });

    await page.goto('http://localhost:3000/analyze');

    // Fill form with valid data
    const dateInput = page.locator('input[type="date"]');
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    await dateInput.fill(pastDate.toISOString().split('T')[0]);

    await page.locator('input[type="time"]').fill('09:00');
    await page.locator('input[type="number"]').fill('50');
    await page.locator('input[type="password"]').fill('sk-1234567890abcdef1234567890abcdef12345678');

    // Submit form
    await page.click('button:has-text("Start Analysis")');

    // Should show progress view
    await expect(page.locator('text=Analysis in Progress')).toBeVisible();
    await expect(page.locator('text=Searching for sessions')).toBeVisible();
  });

  test('should display progress updates during analysis', async ({ page }) => {
    let progressStep = 0;
    const progressSteps = [
      {
        phase: 'sampling',
        currentStep: 'Searching for sessions in 3-hour window',
        sessionsFound: 25,
        sessionsProcessed: 0,
        totalSessions: 50,
        batchesCompleted: 0,
        totalBatches: 0,
        tokensUsed: 0,
        estimatedCost: 0
      },
      {
        phase: 'analyzing',
        currentStep: 'Processing batch 1 of 10',
        sessionsFound: 50,
        sessionsProcessed: 5,
        totalSessions: 50,
        batchesCompleted: 1,
        totalBatches: 10,
        tokensUsed: 1500,
        estimatedCost: 0.045
      },
      {
        phase: 'complete',
        currentStep: 'Analysis complete',
        sessionsFound: 50,
        sessionsProcessed: 50,
        totalSessions: 50,
        batchesCompleted: 10,
        totalBatches: 10,
        tokensUsed: 15000,
        estimatedCost: 0.45
      }
    ];

    await page.route('**/api/analysis/auto-analyze/start', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { analysisId: 'analysis-123' }
        })
      });
    });

    await page.route('**/api/analysis/auto-analyze/progress/analysis-123', async route => {
      const currentProgress = progressSteps[progressStep % progressSteps.length];
      progressStep++;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            analysisId: 'analysis-123',
            ...currentProgress,
            startTime: new Date().toISOString()
          }
        })
      });
    });

    await page.goto('http://localhost:3000/analyze');

    // Start analysis
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    await page.locator('input[type="date"]').fill(pastDate.toISOString().split('T')[0]);
    await page.locator('input[type="password"]').fill('sk-1234567890abcdef1234567890abcdef12345678');
    await page.click('button:has-text("Start Analysis")');

    // Should show sampling progress
    await expect(page.locator('text=Searching for sessions')).toBeVisible();
    
    // Wait for progress update (analyzing phase)
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Processing batch')).toBeVisible();
    await expect(page.locator('text=1500 tokens')).toBeVisible();
    await expect(page.locator('text=$0.045')).toBeVisible();
  });

  test('should display results table when analysis completes', async ({ page }) => {
    const mockResults = [
      {
        session_id: 'session-1',
        user_id: 'user-1',
        start_time: '2024-01-15T09:00:00Z',
        end_time: '2024-01-15T09:30:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { timestamp: '2024-01-15T09:00:00Z', message_type: 'user', message: 'I need help with my claim status' },
          { timestamp: '2024-01-15T09:01:00Z', message_type: 'bot', message: 'I can help you with that' }
        ],
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1,
        facts: {
          generalIntent: 'Claim Status',
          sessionOutcome: 'Contained',
          transferReason: '',
          dropOffLocation: '',
          notes: 'User inquired about claim status and received assistance.'
        },
        analysisMetadata: {
          tokensUsed: 150,
          processingTime: 2500,
          batchNumber: 1,
          timestamp: '2024-01-15T14:05:00Z'
        }
      }
    ];

    await page.route('**/api/analysis/auto-analyze/start', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { analysisId: 'analysis-123' }
        })
      });
    });

    await page.route('**/api/analysis/auto-analyze/progress/analysis-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            analysisId: 'analysis-123',
            phase: 'complete',
            currentStep: 'Analysis complete',
            sessionsFound: 1,
            sessionsProcessed: 1,
            totalSessions: 1,
            batchesCompleted: 1,
            totalBatches: 1,
            tokensUsed: 150,
            estimatedCost: 0.0045,
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString()
          }
        })
      });
    });

    await page.route('**/api/analysis/auto-analyze/results/analysis-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockResults
        })
      });
    });

    await page.goto('http://localhost:3000/analyze');

    // Start analysis
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    await page.locator('input[type="date"]').fill(pastDate.toISOString().split('T')[0]);
    await page.locator('input[type="password"]').fill('sk-1234567890abcdef1234567890abcdef12345678');
    await page.click('button:has-text("Start Analysis")');

    // Wait for results table
    await expect(page.locator('text=Analysis Results')).toBeVisible();
    
    // Check table headers
    await expect(page.locator('th:has-text("Session ID")')).toBeVisible();
    await expect(page.locator('th:has-text("General Intent")')).toBeVisible();
    await expect(page.locator('th:has-text("Session Outcome")')).toBeVisible();
    await expect(page.locator('th:has-text("Transfer Reason")')).toBeVisible();
    await expect(page.locator('th:has-text("Drop-off Location")')).toBeVisible();
    await expect(page.locator('th:has-text("Notes")')).toBeVisible();
    await expect(page.locator('th:has-text("Transcript")')).toBeVisible();

    // Check data
    await expect(page.locator('td:has-text("session-1")')).toBeVisible();
    await expect(page.locator('td:has-text("Claim Status")')).toBeVisible();
    await expect(page.locator('td:has-text("Contained")')).toBeVisible();
    
    // Check transcript column has small font
    const transcriptCell = page.locator('td').filter({ hasText: 'I need help with my claim status' });
    await expect(transcriptCell).toHaveCSS('font-size', /^(10px|12px|0\.(625|75)rem)$/);
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/analysis/auto-analyze/start', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Service temporarily unavailable'
        })
      });
    });

    await page.goto('http://localhost:3000/analyze');

    // Fill form and submit
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    await page.locator('input[type="date"]').fill(pastDate.toISOString().split('T')[0]);
    await page.locator('input[type="password"]').fill('sk-1234567890abcdef1234567890abcdef12345678');
    await page.click('button:has-text("Start Analysis")');

    // Should show error message
    await expect(page.locator('text=Service temporarily unavailable')).toBeVisible();
    
    // Form should be enabled again
    await expect(page.locator('button:has-text("Start Analysis")')).toBeEnabled();
  });

  test('should have proper responsive design', async ({ page }) => {
    await page.goto('http://localhost:3000/analyze');

    // Test desktop view (default)
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('form')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('form')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('form')).toBeVisible();
    
    // Form should stack vertically on mobile
    const formBounds = await page.locator('form').boundingBox();
    expect(formBounds?.height).toBeGreaterThan(formBounds?.width || 0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('http://localhost:3000/analyze');

    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="date"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="time"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="number"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="password"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('button:has-text("Start Analysis")')).toBeFocused();

    // Should be able to submit with Enter
    await page.locator('input[type="password"]').fill('sk-1234567890abcdef1234567890abcdef12345678');
    await page.keyboard.press('Enter');
    
    // Should trigger validation (missing past date validation will show)
  });
});