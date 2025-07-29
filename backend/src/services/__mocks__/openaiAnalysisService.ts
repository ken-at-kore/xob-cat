import { 
  SessionWithTranscript, 
  ExistingClassifications, 
  getGptModelById,
  calculateModelCost
} from '../../../../shared/types';

export interface OpenAIBatchResult {
  sessions: Array<{
    user_id: string;
    general_intent: string;
    session_outcome: 'Transfer' | 'Contained';
    transfer_reason: string;
    drop_off_location: string;
    notes: string;
  }>;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
}

/**
 * Mock OpenAI Analysis Service for testing
 * Simulates different model behavior and pricing without making real API calls
 */
export class MockOpenAIAnalysisService {
  private mockDelay: number = 1000; // 1 second delay to simulate API calls

  async analyzeBatch(
    sessions: SessionWithTranscript[],
    existingClassifications: ExistingClassifications,
    apiKey: string,
    modelId: string = 'gpt-4o-mini'
  ): Promise<OpenAIBatchResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, this.mockDelay));

    // Get model info for pricing
    const modelInfo = getGptModelById(modelId);
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    // Generate mock analysis results
    const mockResults = sessions.map(session => {
      const isTransfer = Math.random() > 0.6; // 40% transfer rate
      const intents = ['Claim Status', 'Billing', 'Eligibility', 'Live Agent', 'Provider Enrollment'];
      const transferReasons = ['Invalid Provider ID', 'Invalid Member ID', 'Authentication Failed', 'Technical Issue'];
      const dropOffLocations = ['Policy Number Prompt', 'Authentication', 'Claim Details', 'Member Information'];

      return {
        user_id: session.user_id,
        general_intent: intents[Math.floor(Math.random() * intents.length)],
        session_outcome: (isTransfer ? 'Transfer' : 'Contained') as 'Transfer' | 'Contained',
        transfer_reason: isTransfer ? transferReasons[Math.floor(Math.random() * transferReasons.length)] : '',
        drop_off_location: isTransfer ? dropOffLocations[Math.floor(Math.random() * dropOffLocations.length)] : '',
        notes: `Mock analysis result for ${session.user_id} using ${modelId}`
      };
    });

    // Generate realistic token usage based on model and session count
    const baseTokensPerSession = this.getModelBaseTokens(modelId);
    const promptTokens = Math.round(sessions.length * baseTokensPerSession * 0.7);
    const completionTokens = Math.round(sessions.length * baseTokensPerSession * 0.3);
    const totalTokens = promptTokens + completionTokens;

    // Calculate cost using model-specific pricing
    const cost = calculateModelCost(promptTokens, completionTokens, modelInfo);

    return {
      sessions: mockResults,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
      model: modelId
    };
  }

  /**
   * Returns realistic token usage based on model complexity
   */
  private getModelBaseTokens(modelId: string): number {
    const tokenMap: Record<string, number> = {
      'gpt-4o': 750,        // More detailed analysis
      'gpt-4o-mini': 636,   // Standard baseline
      'gpt-4.1': 720,       // Slightly more detailed than mini
      'gpt-4.1-mini': 580,  // Less detailed analysis
      'gpt-4.1-nano': 450   // Minimal analysis
    };
    
    return tokenMap[modelId] || 636; // Default to gpt-4o-mini baseline
  }

  /**
   * Set mock delay for testing (in milliseconds)
   */
  setMockDelay(delay: number): void {
    this.mockDelay = delay;
  }
}

// Create singleton instance for testing
export const mockOpenAIAnalysisService = new MockOpenAIAnalysisService();

// Export the mock as default for Jest __mocks__
export default MockOpenAIAnalysisService;