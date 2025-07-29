import { test, expect, Page } from '@playwright/test';

/**
 * E2E test to reproduce the model selection bug
 * This test reproduces the exact scenario: select GPT-4.1 mini, analyze 10 sessions,
 * then check if the cost section correctly shows GPT-4.1 mini instead of GPT-4o mini
 */

test.describe('Model Selection Bug Reproduction', () => {
  let page: Page;
  let capturedRequests: any[] = [];

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    capturedRequests = [];

    // Capture all API requests to inspect what's being sent
    page.on('request', request => {
      if (request.url().includes('/api/analysis/auto-analyze')) {
        capturedRequests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData()
        });
      }
    });

    // Mock the auto-analyze API endpoints with detailed logging
    await page.route('**/api/analysis/auto-analyze/start', async (route) => {
      const request = route.request();
      const postData = JSON.parse(request.postData() || '{}');
      
      console.log('🔍 API START REQUEST - Model ID received:', postData.modelId);
      console.log('🔍 Full request data:', postData);
      
      // Verify the request includes the correct modelId
      expect(postData.modelId).toBe('gpt-4.1-mini');
      
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { analysisId: 'test-model-selection-123' }
        })
      });
    });

    await page.route('**/api/analysis/auto-analyze/progress/test-model-selection-123', async (route) => {
      console.log('🔍 API PROGRESS REQUEST');
      
      // Simulate analysis completion quickly
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            analysisId: 'test-model-selection-123',
            phase: 'complete',
            currentStep: 'Analysis complete',
            sessionsFound: 10,
            sessionsProcessed: 10,
            totalSessions: 10,
            batchesCompleted: 2,
            totalBatches: 2,
            tokensUsed: 5000,
            estimatedCost: 0.002, // Cost for GPT-4.1 mini
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString()
          }
        })
      });
    });

    await page.route('**/api/analysis/auto-analyze/results/test-model-selection-123', async (route) => {
      console.log('🔍 API RESULTS REQUEST');
      
      // Create mock session results that should preserve the selected model
      const mockSessions = Array.from({ length: 10 }, (_, i) => ({
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
            message: 'I need help with my billing'
          },
          {
            timestamp: '2024-01-15T09:01:00Z',
            message_type: 'bot' as const,
            message: 'I can help you with billing questions.'
          }
        ],
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1,
        facts: {
          generalIntent: 'Billing',
          sessionOutcome: i % 2 === 0 ? 'Contained' as const : 'Transfer' as const,
          transferReason: i % 2 === 0 ? '' : 'Authentication Failed',
          dropOffLocation: i % 2 === 0 ? '' : 'Authentication',
          notes: `Test session ${i + 1} for model selection bug reproduction`
        },
        analysisMetadata: {
          tokensUsed: 500,
          processingTime: 2000,
          batchNumber: Math.ceil((i + 1) / 5),
          timestamp: new Date().toISOString(),
          // This is the critical field that should match the selected model
          // If the bug exists, this will show 'gpt-4o-mini' instead of 'gpt-4.1-mini'
          model: 'gpt-4.1-mini' // This should match what was selected
        }
      }));

      console.log('🔍 Mock sessions created with model:', mockSessions[0].analysisMetadata.model);

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            sessions: mockSessions,
            analysisSummary: {
              overview: 'Mock analysis for model selection bug reproduction',
              summary: 'Testing if the selected model persists through the workflow',
              containmentSuggestion: 'Model selection test suggestion',
              generatedAt: new Date().toISOString(),
              sessionsAnalyzed: 10,
              statistics: {
                totalSessions: 10,
                transferRate: 50,
                containmentRate: 50,
                averageSessionLength: 300,
                averageMessagesPerSession: 2
              }
            }
          }
        })
      });
    });

    // Navigate and login
    await page.goto('/');
    await page.fill('#botId', 'test-bot-for-model-selection');
    await page.fill('#clientId', 'test-client-id');
    await page.fill('#clientSecret', 'test-client-secret');
    await page.click('button:text("Connect")');
    
    // Navigate to Auto-Analyze page
    await page.click('text=Auto-Analyze');
    await expect(page).toHaveURL('/analyze');
  });

  test('should reproduce model selection bug - GPT-4.1 mini selected but shows GPT-4o mini in results', async () => {
    console.log('🧪 Starting model selection bug reproduction test');
    
    // Step 1: Select GPT-4.1 mini from dropdown (exact user scenario)
    console.log('📝 Step 1: Selecting GPT-4.1 mini from dropdown');
    
    // Wait for the page to load completely
    await expect(page.locator('text=GPT Model')).toBeVisible();
    
    // Click the select trigger to open dropdown
    await page.click('[data-slot="select-trigger"]');
    
    // Wait for dropdown to open and select GPT-4.1 mini
    await expect(page.locator('text=GPT-4.1 mini')).toBeVisible();
    await page.click('text=GPT-4.1 mini');
    
    // Verify the pricing display updates to GPT-4.1 mini pricing
    await expect(page.locator('text=GPT-4.1 mini Pricing')).toBeVisible();
    await expect(page.locator('text=$0.40/1M tokens')).toBeVisible(); // Input price
    await expect(page.locator('text=$1.60/1M tokens')).toBeVisible(); // Output price
    
    console.log('✅ GPT-4.1 mini selected and pricing displayed correctly');
    
    // Step 2: Configure analysis for 10 sessions (exact user scenario)
    console.log('📝 Step 2: Configuring analysis for 10 sessions');
    
    // Set session count to 10
    await page.fill('#sessionCount', '10');
    
    // Fill OpenAI API key
    await page.fill('#openaiApiKey', 'sk-test-key-for-model-selection-bug');
    
    console.log('✅ Analysis configured for 10 sessions');
    
    // Step 3: Start analysis
    console.log('📝 Step 3: Starting analysis');
    
    await page.click('button:text("Start Analysis")');
    
    // Verify the API request was made with correct modelId
    console.log('🔍 Checking captured API requests...');
    
    // Wait for the analysis to start
    await expect(page.locator('text=Starting session analysis...')).toBeVisible({ timeout: 10000 });
    
    // Step 4: Wait for analysis completion
    console.log('📝 Step 4: Waiting for analysis completion');
    
    await expect(page.locator('text=Analysis complete')).toBeVisible({ timeout: 15000 });
    
    // Navigate to results
    await expect(page.locator('text=View Results')).toBeVisible();
    await page.click('text=View Results');
    
    console.log('✅ Analysis completed, viewing results');
    
    // Step 5: Check the cost section for the bug
    console.log('📝 Step 5: Checking cost section for model display');
    
    // Wait for the analysis cost card to be visible
    await expect(page.locator('text=Analysis Cost & Usage')).toBeVisible();
    
    // This is where the bug should manifest - it should show "GPT-4.1 mini" but might show "GPT-4o mini"
    const modelUsedElements = page.locator('.text-2xl.font-bold.text-purple-600');
    await expect(modelUsedElements).toHaveCount(1);
    
    const displayedModel = await modelUsedElements.textContent();
    console.log('🔍 Model displayed in cost section:', displayedModel);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/model-selection-bug-reproduction.png' });
    
    // This assertion will fail if the bug exists
    expect(displayedModel).toBe('GPT-4.1 mini');
    
    // Additional verification: Check that cost calculation uses GPT-4.1 mini pricing
    const costElements = page.locator('.text-2xl.font-bold.text-orange-600');
    const displayedCost = await costElements.textContent();
    console.log('🔍 Cost displayed:', displayedCost);
    
    // GPT-4.1 mini should have higher costs than GPT-4o mini for the same token usage
    // With 5000 tokens total (approximate): GPT-4.1 mini = ~$0.002, GPT-4o mini = ~$0.0004
    expect(displayedCost).toMatch(/\$0\.00[2-9]/); // Should be around $0.002 for GPT-4.1 mini
    
    console.log('🎉 Model selection working correctly - no bug detected!');
  });

  test('should verify model information is passed correctly through API calls', async () => {
    console.log('🧪 Testing API request model information');
    
    // Select GPT-4.1 mini
    await page.click('[data-slot="select-trigger"]');
    await page.click('text=GPT-4.1 mini');
    
    // Configure and start analysis
    await page.fill('#sessionCount', '10');
    await page.fill('#openaiApiKey', 'sk-test-key');
    await page.click('button:text("Start Analysis")');
    
    // Wait a moment for the request to be captured
    await page.waitForTimeout(1000);
    
    // Verify the API request contains the correct model ID
    const startRequest = capturedRequests.find(req => req.url.includes('/start'));
    expect(startRequest).toBeTruthy();
    
    const requestData = JSON.parse(startRequest.postData);
    console.log('🔍 Captured request data:', requestData);
    
    expect(requestData.modelId).toBe('gpt-4.1-mini');
    console.log('✅ Model ID correctly passed in API request');
  });
});