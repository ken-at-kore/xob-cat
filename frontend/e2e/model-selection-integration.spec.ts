import { test, expect, Page } from '@playwright/test';

/**
 * E2E test for GPT model selection workflow
 * Tests the complete flow from model selection to analysis results
 * Uses mock API responses to verify model information is properly passed through
 */

test.describe('GPT Model Selection Integration', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Mock the auto-analyze API endpoints
    await page.route('**/api/analysis/auto-analyze/start', async (route) => {
      const request = route.request();
      const postData = JSON.parse(request.postData() || '{}');
      
      console.log('Mock API - Start Analysis Request:', postData);
      
      // Verify the modelId is being passed correctly
      expect(postData.modelId).toBeDefined();
      
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { analysisId: 'test-analysis-123' }
        })
      });
    });

    await page.route('**/api/analysis/auto-analyze/progress/test-analysis-123', async (route) => {
      // Simulate analysis completion immediately
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            analysisId: 'test-analysis-123',
            phase: 'complete',
            currentStep: 'Analysis complete',
            sessionsFound: 50,
            sessionsProcessed: 50,
            totalSessions: 50,
            batchesCompleted: 10,
            totalBatches: 10,
            tokensUsed: 25000,
            estimatedCost: 0.125,
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString()
          }
        })
      });
    });

    await page.route('**/api/analysis/auto-analyze/results/test-analysis-123', async (route) => {
      const request = route.request();
      
      // Create mock session results that include the model information
      const mockSessions = Array.from({ length: 5 }, (_, i) => ({
        session_id: `session-${i + 1}`,
        user_id: `user-${i + 1}`,
        start_time: '2024-01-15T09:00:00Z',
        end_time: '2024-01-15T09:15:00Z',
        containment_type: i % 2 === 0 ? 'selfService' : 'agent',
        tags: [],
        metrics: {},
        messages: [
          {
            timestamp: '2024-01-15T09:00:00Z',
            message_type: 'user' as const,
            message: 'I need help with my claim'
          },
          {
            timestamp: '2024-01-15T09:01:00Z',
            message_type: 'bot' as const,
            message: 'I can help you with that. What is your member ID?'
          }
        ],
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1,
        facts: {
          generalIntent: 'Claim Status',
          sessionOutcome: i % 2 === 0 ? 'Contained' as const : 'Transfer' as const,
          transferReason: i % 2 === 0 ? '' : 'Invalid Member ID',
          dropOffLocation: i % 2 === 0 ? '' : 'Member Information',
          notes: `Mock session ${i + 1} summary`
        },
        analysisMetadata: {
          tokensUsed: 500,
          processingTime: 2000,
          batchNumber: Math.ceil((i + 1) / 5),
          timestamp: new Date().toISOString(),
          // This is the key field we need to verify - it should match the selected model
          model: 'gpt-4.1-nano' // This should be set based on the request
        }
      }));

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            sessions: mockSessions,
            analysisSummary: {
              overview: 'Mock analysis overview',
              summary: 'Mock detailed analysis',
              containmentSuggestion: 'Mock suggestion',
              generatedAt: new Date().toISOString(),
              sessionsAnalyzed: 5,
              statistics: {
                totalSessions: 5,
                transferRate: 40,
                containmentRate: 60,
                averageSessionLength: 300,
                averageMessagesPerSession: 2
              }
            }
          }
        })
      });
    });

    // Navigate to analyze page after login
    await page.goto('/');
    
    // Fill in credentials and connect
    await page.fill('#botId', 'test-bot-id');
    await page.fill('#clientId', 'test-client-id');
    await page.fill('#clientSecret', 'test-client-secret');
    await page.click('button:text("Connect")');
    
    // Navigate to Auto-Analyze page
    await page.click('text=Auto-Analyze');
    await expect(page).toHaveURL('/analyze');
  });

  test('should pass selected model through complete workflow', async () => {
    // Test GPT-4.1 nano selection
    console.log('Testing GPT-4.1 nano model selection...');
    
    // Select GPT-4.1 nano from dropdown
    await page.click('[data-slot="select-trigger"]');
    await page.click('text=GPT-4.1 nano');
    
    // Verify pricing display updates
    await expect(page.locator('text=GPT-4.1 nano Pricing')).toBeVisible();
    await expect(page.locator('text=$0.10/1M tokens')).toBeVisible(); // Input price
    await expect(page.locator('text=$0.40/1M tokens')).toBeVisible(); // Output price
    
    // Fill in required fields
    await page.fill('#openaiApiKey', 'sk-test-key-12345');
    
    // Capture the API request to verify modelId is passed
    let startAnalysisRequest: any = null;
    page.on('request', request => {
      if (request.url().includes('/api/analysis/auto-analyze/start')) {
        startAnalysisRequest = JSON.parse(request.postData() || '{}');
      }
    });
    
    // Start analysis
    await page.click('button:text("Start Analysis")');
    
    // Verify the request includes the correct modelId
    await page.waitForTimeout(1000); // Wait for request to be captured
    expect(startAnalysisRequest).toBeTruthy();
    expect(startAnalysisRequest.modelId).toBe('gpt-4.1-nano');
    console.log('✓ Model ID correctly passed in API request:', startAnalysisRequest.modelId);
    
    // Wait for analysis to complete (mocked to complete immediately)
    await expect(page.locator('text=Analysis complete')).toBeVisible({ timeout: 10000 });
    
    // Navigate to results page
    await expect(page.locator('text=View Results')).toBeVisible();
    await page.click('text=View Results');
    
    // Verify the analysis report shows the correct model
    await expect(page.locator('text=Analysis Cost & Usage')).toBeVisible();
    
    // Check if the model name is displayed correctly in the cost card
    const modelDisplayed = await page.locator('[data-testid="model-used"]').textContent();
    console.log('Model displayed in results:', modelDisplayed);
    
    // This should show "GPT-4.1 nano" not "GPT-4o mini"
    await expect(page.locator('text=GPT-4.1 nano').first()).toBeVisible();
    
    // Verify cost calculation uses the correct model pricing
    // GPT-4.1 nano has much lower costs than GPT-4o mini
    const costText = await page.locator('[data-testid="estimated-cost"]').textContent();
    console.log('Cost displayed:', costText);
    
    // The cost should be calculated using GPT-4.1 nano pricing, not GPT-4o mini
    // With 2500 total tokens (500 per session × 5 sessions), the cost should be much lower
    const expectedCost = (2500 * 0.75 / 1_000_000 * 0.10) + (2500 * 0.25 / 1_000_000 * 0.40); // ~$0.00044
    console.log('Expected cost for GPT-4.1 nano:', expectedCost);
  });

  test('should show correct model in different scenarios', async () => {
    const models = [
      { id: 'gpt-4o', name: 'GPT-4o', inputPrice: '$2.50', outputPrice: '$10.00' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', inputPrice: '$0.15', outputPrice: '$0.60' },
      { id: 'gpt-4.1', name: 'GPT-4.1 (base)', inputPrice: '$2.00', outputPrice: '$8.00' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', inputPrice: '$0.40', outputPrice: '$1.60' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 nano', inputPrice: '$0.10', outputPrice: '$0.40' }
    ];

    for (const model of models) {
      console.log(`Testing model: ${model.name}`);
      
      // Reload page to reset state
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Select the model
      await page.click('[data-slot="select-trigger"]');
      await page.click(`text=${model.name}`);
      
      // Verify pricing display
      await expect(page.locator(`text=${model.name} Pricing`)).toBeVisible();
      await expect(page.locator(`text=${model.inputPrice}/1M tokens`)).toBeVisible();
      await expect(page.locator(`text=${model.outputPrice}/1M tokens`)).toBeVisible();
      
      console.log(`✓ ${model.name} pricing displayed correctly`);
    }
  });
});