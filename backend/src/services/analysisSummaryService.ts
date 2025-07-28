import { SessionWithFacts, AnalysisSummary } from '../../../shared/types';
import { LLMInferenceService } from '../../../shared/services/llmInferenceService';

export class AnalysisSummaryService {
  private llmService: LLMInferenceService;

  constructor(apiKey: string) {
    this.llmService = new LLMInferenceService(apiKey);
  }

  async generateAnalysisSummary(sessions: SessionWithFacts[]): Promise<AnalysisSummary> {
    try {
      const llmResponse = await this.llmService.generateAnalysisSummary(sessions);
      return this.llmService.createAnalysisSummary(llmResponse, sessions);
    } catch (error) {
      console.error('Error generating analysis summary:', error);
      throw error;
    }
  }

}