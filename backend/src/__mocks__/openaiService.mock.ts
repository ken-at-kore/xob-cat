import { AnalysisResult, Message, SessionWithTranscript, ExistingClassifications } from '../../../shared/types';
import { IOpenAIService } from '../interfaces';

export class MockOpenAIService implements IOpenAIService {
  private mockAnalysisResults: Record<string, AnalysisResult> = {
    'claim_status': {
      session_id: 'mock_session',
      user_id: 'mock_user',
      general_intent: 'Claim Status',
      call_outcome: 'Contained',
      notes: 'User successfully retrieved claim status information. Bot provided clear status update and timeline.',
      analyzed_at: new Date().toISOString()
    },
    'billing_transfer': {
      session_id: 'mock_session',
      user_id: 'mock_user',
      general_intent: 'Billing',
      call_outcome: 'Transfer',
      transfer_reason: 'Invalid Member ID',
      notes: 'User provided invalid member ID. Bot unable to locate account and transferred to human agent.',
      analyzed_at: new Date().toISOString()
    },
    'eligibility_contained': {
      session_id: 'mock_session',
      user_id: 'mock_user',
      general_intent: 'Eligibility',
      call_outcome: 'Contained',
      notes: 'User inquired about procedure coverage. Bot provided comprehensive coverage information for MRI and physical therapy.',
      analyzed_at: new Date().toISOString()
    },
    'appointment_dropoff': {
      session_id: 'mock_session',
      user_id: 'mock_user',
      general_intent: 'Appointment Scheduling',
      call_outcome: 'Contained',
      drop_off_location: 'Date Selection',
      notes: 'User started appointment scheduling but abandoned during date selection step.',
      analyzed_at: new Date().toISOString()
    },
    'general_inquiry': {
      session_id: 'mock_session',
      user_id: 'mock_user',
      general_intent: 'General Inquiry',
      call_outcome: 'Contained',
      notes: 'General inquiry about services. Bot provided helpful information and user was satisfied.',
      analyzed_at: new Date().toISOString()
    }
  };

  private getAnalysisKey(messages: Message[]): string {
    // Determine analysis type based on message content
    const conversationText = messages.map(m => m.message.toLowerCase()).join(' ');
    
    if (conversationText.includes('claim') && conversationText.includes('status')) {
      return 'claim_status';
    }
    if (conversationText.includes('bill') && conversationText.includes('member id')) {
      return 'billing_transfer';
    }
    if (conversationText.includes('coverage') || conversationText.includes('mri') || conversationText.includes('physical therapy')) {
      return 'eligibility_contained';
    }
    if (conversationText.includes('appointment') && conversationText.includes('date')) {
      return 'appointment_dropoff';
    }
    
    return 'general_inquiry';
  }

  async analyzeSession(messages: Message[], apiKey?: string): Promise<{
    analysis: AnalysisResult;
    cost: number;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    console.log(`🧪 MockOpenAIService: Analyzing session with ${messages.length} messages`);
    
    // Check for failure mode first
    if (this.shouldFailAnalysis) {
      throw new Error(this.failureMessage);
    }
    
    // Simulate API key validation
    if (apiKey && !apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get appropriate mock analysis based on conversation content
    const analysisKey = this.getAnalysisKey(messages);
    const analysis = this.mockAnalysisResults[analysisKey]!;

    // Calculate mock token usage based on message content
    const messageText = messages.map(m => m.message).join(' ');
    const promptTokens = Math.max(100, Math.floor(messageText.length / 4)); // ~4 chars per token
    const completionTokens = 50; // Fixed completion tokens for mock
    const totalTokens = promptTokens + completionTokens;

    // Calculate mock cost (GPT-4o-mini pricing)
    const cost = (promptTokens * 0.000015 + completionTokens * 0.000060) / 1_000_000;

    console.log(`🧪 MockOpenAIService: Analysis complete - Intent: ${analysis.general_intent}, Outcome: ${analysis.call_outcome}`);

    return {
      analysis,
      cost,
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens
      }
    };
  }

  // Helper methods for testing

  // Add custom analysis result for specific message patterns
  addMockAnalysis(key: string, result: AnalysisResult): void {
    this.mockAnalysisResults[key] = result;
  }

  // Override analysis result for testing specific scenarios
  setMockAnalysisForMessages(messages: Message[], result: AnalysisResult): void {
    const key = this.getAnalysisKey(messages);
    this.mockAnalysisResults[key] = result;
  }

  // Simulate API failures for testing error handling
  shouldFailAnalysis = false;
  failureMessage = 'Mock OpenAI service failure';

  setFailureMode(shouldFail: boolean, message = 'Mock OpenAI service failure'): void {
    this.shouldFailAnalysis = shouldFail;
    this.failureMessage = message;
  }

  private async simulateFailure(): Promise<void> {
    if (this.shouldFailAnalysis) {
      throw new Error(this.failureMessage);
    }
  }

  // Get all available mock analysis results
  getAllMockAnalyses(): Record<string, AnalysisResult> {
    return { ...this.mockAnalysisResults };
  }

  async analyzeBatch(
    sessions: SessionWithTranscript[],
    existingClassifications: ExistingClassifications,
    openaiApiKey: string,
    modelId: string = 'gpt-4o-mini'
  ): Promise<{
    sessions: any[];
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    model: string;
  }> {
    console.log(`🧪 MockOpenAIService: Analyzing batch of ${sessions.length} sessions`);
    
    // Check for failure mode first
    if (this.shouldFailAnalysis) {
      throw new Error(this.failureMessage);
    }
    
    // Simulate API key validation
    if (!openaiApiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 200));

    const results: any[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const session of sessions) {
      // Get appropriate mock analysis based on conversation content
      const analysisKey = this.getAnalysisKey(session.messages);
      const analysisTemplate = this.mockAnalysisResults[analysisKey]!;

      // Calculate mock token usage based on message content
      const messageText = session.messages.map(m => m.message).join(' ');
      const promptTokens = Math.max(100, Math.floor(messageText.length / 4)); // ~4 chars per token
      const completionTokens = 50; // Fixed completion tokens for mock

      totalPromptTokens += promptTokens;
      totalCompletionTokens += completionTokens;

      // Create result matching the expected format
      results.push({
        user_id: session.user_id,
        general_intent: analysisTemplate.general_intent,
        session_outcome: analysisTemplate.call_outcome === 'Transfer' ? 'Transfer' : 'Contained',
        transfer_reason: analysisTemplate.transfer_reason || '',
        drop_off_location: analysisTemplate.drop_off_location || '',
        notes: analysisTemplate.notes
      });
    }

    const totalTokens = totalPromptTokens + totalCompletionTokens;
    // Calculate mock cost (GPT-4o-mini pricing)
    const cost = (totalPromptTokens * 0.000015 + totalCompletionTokens * 0.000060) / 1_000_000;

    console.log(`🧪 MockOpenAIService: Batch analysis complete - ${results.length} sessions analyzed`);

    return {
      sessions: results,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens,
      cost,
      model: modelId
    };
  }

  calculateCost(promptTokens: number, completionTokens: number, modelId: string): number {
    // Mock cost calculation based on model ID
    // For simplicity, use GPT-4o-mini pricing as default for most models
    let inputPricePerMillion = 0.15;  // GPT-4o-mini default
    let outputPricePerMillion = 0.60; // GPT-4o-mini default
    
    // Adjust pricing based on model ID for more realistic mock behavior
    if (modelId.includes('gpt-4o') && !modelId.includes('mini')) {
      inputPricePerMillion = 2.50;
      outputPricePerMillion = 10.00;
    } else if (modelId.includes('gpt-4.1-mini')) {
      inputPricePerMillion = 0.40;
      outputPricePerMillion = 1.60;
    } else if (modelId.includes('gpt-4.1-nano')) {
      inputPricePerMillion = 0.10;
      outputPricePerMillion = 0.40;
    } else if (modelId.includes('gpt-4.1')) {
      inputPricePerMillion = 2.00;
      outputPricePerMillion = 8.00;
    }
    
    const inputCost = (promptTokens / 1_000_000) * inputPricePerMillion;
    const outputCost = (completionTokens / 1_000_000) * outputPricePerMillion;
    
    console.log(`🧪 MockOpenAIService: calculateCost(${promptTokens}, ${completionTokens}, ${modelId}) = $${(inputCost + outputCost).toFixed(6)}`);
    
    return inputCost + outputCost;
  }
}