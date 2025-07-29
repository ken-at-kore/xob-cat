import { Page } from '@playwright/test';

/**
 * Mock OpenAI API responses for E2E testing
 * This allows testing model selection without making real OpenAI API calls
 */
export class MockOpenAIService {
  constructor(private page: Page) {}

  /**
   * Intercept OpenAI API calls and return mock responses
   */
  async mockOpenAIAnalysis(modelId: string = 'gpt-4.1') {
    await this.page.route('https://api.openai.com/v1/chat/completions', async route => {
      const request = route.request();
      const postData = request.postData();
      
      if (!postData) {
        await route.continue();
        return;
      }

      const body = JSON.parse(postData);
      const requestedModel = body.model;

      // Generate mock response based on requested model
      const mockResponse = {
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        created: Date.now(),
        model: requestedModel,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_mock',
              type: 'function',
              function: {
                name: 'analyze_sessions_batch',
                arguments: JSON.stringify({
                  sessions: this.generateMockAnalysisResults(1) // Assuming 1 session for simplicity
                })
              }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: this.generateMockUsage(requestedModel)
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      });
    });
  }

  /**
   * Generate mock analysis results for testing
   */
  private generateMockAnalysisResults(sessionCount: number) {
    const results = [];
    for (let i = 0; i < sessionCount; i++) {
      results.push({
        user_id: `mock-user-${i + 1}`,
        general_intent: 'Claim Status',
        session_outcome: i % 2 === 0 ? 'Transfer' : 'Contained',
        transfer_reason: i % 2 === 0 ? 'Invalid Provider ID' : '',
        drop_off_location: i % 2 === 0 ? 'Authentication' : '',
        notes: `Mock analysis for session ${i + 1}`
      });
    }
    return results;
  }

  /**
   * Generate realistic token usage based on model
   */
  private generateMockUsage(model: string) {
    const baseTokens = this.getModelBaseTokens(model);
    const promptTokens = Math.round(baseTokens * 0.7);
    const completionTokens = Math.round(baseTokens * 0.3);

    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    };
  }

  /**
   * Get base token usage for different models
   */
  private getModelBaseTokens(modelId: string): number {
    const tokenMap: Record<string, number> = {
      'gpt-4o': 750,
      'gpt-4o-mini': 636,
      'gpt-4.1': 720,
      'gpt-4.1-mini': 580,
      'gpt-4.1-nano': 450
    };
    
    return tokenMap[modelId] || 636;
  }

  /**
   * Stop intercepting OpenAI API calls
   */
  async stopMocking() {
    await this.page.unroute('https://api.openai.com/v1/chat/completions');
  }
}