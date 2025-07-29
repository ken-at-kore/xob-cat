import { OpenAIAnalysisService } from '../openaiAnalysisService';
import { getGptModelById } from '../../../../shared/types';

/**
 * Unit tests for model selection functionality
 * Ensures that the selected model ID is properly preserved through the analysis process
 */

describe('Model Selection', () => {
  let openaiService: OpenAIAnalysisService;

  beforeEach(() => {
    openaiService = new OpenAIAnalysisService();
  });

  test('should use correct API model string for GPT-4.1 nano', () => {
    const model = getGptModelById('gpt-4.1-nano');
    expect(model).toBeTruthy();
    expect(model?.apiModelString).toBe('gpt-4.1-nano');
    expect(model?.name).toBe('GPT-4.1 nano');
  });

  test('should calculate cost correctly for GPT-4.1 nano', () => {
    const cost = openaiService.calculateCost(1000, 500, 'gpt-4.1-nano');
    
    // GPT-4.1 nano: $0.10/1M input, $0.40/1M output
    // 1000 input tokens = 1000/1M * $0.10 = $0.0001
    // 500 output tokens = 500/1M * $0.40 = $0.0002
    // Total = $0.0003
    expect(cost).toBeCloseTo(0.0003, 6);
  });

  test('should calculate cost correctly for GPT-4o', () => {
    const cost = openaiService.calculateCost(1000, 500, 'gpt-4o');
    
    // GPT-4o: $2.50/1M input, $10.00/1M output
    // 1000 input tokens = 1000/1M * $2.50 = $0.0025
    // 500 output tokens = 500/1M * $10.00 = $0.005
    // Total = $0.0075
    expect(cost).toBeCloseTo(0.0075, 6);
  });

  test('should return 0 cost for unknown model', () => {
    const cost = openaiService.calculateCost(1000, 500, 'unknown-model');
    expect(cost).toBe(0);
  });

  test('all GPT models should have valid configuration', () => {
    const modelIds = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'];
    
    modelIds.forEach(modelId => {
      const model = getGptModelById(modelId);
      expect(model).toBeTruthy();
      expect(model?.id).toBe(modelId);
      expect(model?.apiModelString).toBeTruthy();
      expect(model?.name).toBeTruthy();
      expect(model?.inputPricePerMillion).toBeGreaterThan(0);
      expect(model?.outputPricePerMillion).toBeGreaterThan(0);
    });
  });
});