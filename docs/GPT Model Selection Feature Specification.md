# GPT Model Selection Feature Specification

## Overview
Add GPT model selection capability to the Auto-Analysis feature, allowing users to choose from different OpenAI models with varying cost and performance characteristics.

## Requirements

### Model Options
| Model Variant    | API Model String | Input Price ($/1M tokens) | Output Price ($/1M tokens) |
|------------------|------------------|---------------------------|----------------------------|
| GPT 4o           | gpt-4o           | 2.50                      | 10.00                      |
| GPT 4o mini      | gpt-4o-mini      | 0.15                      | 0.60                       |
| GPT 4.1 (base)   | gpt-4.1          | 2.00                      | 8.00                       |
| GPT 4.1 mini     | gpt-4.1-mini     | 0.40                      | 1.60                       |
| GPT 4.1 nano     | gpt-4.1-nano     | 0.10                      | 0.40                       |

### Default Selection
- **Default Model**: GPT 4.1 (base) - `gpt-4.1`
- Balances cost and performance for typical enterprise use cases

### UI/UX Requirements

#### Model Selection Interface
- **Location**: Auto-Analysis configuration page, after OpenAI API Key field
- **Display**: Radio button group with model names
- **Progressive Disclosure**: 
  - Show model names by default
  - "Show Pricing Details" expandable section for cost information
  - Pricing table shows input/output token costs

#### Cost Display Updates
- **Progress Page**: Update real-time cost estimation based on selected model
- **Results Page**: Display actual costs using selected model pricing
- **Cost Analysis Card**: Show model information and pricing breakdown

### Technical Implementation

#### Frontend Changes
1. **Model Selection Component**:
   - Radio button group for model selection
   - Progressive disclosure for pricing information
   - Integration with existing form validation

2. **Cost Calculation Updates**:
   - Update `calculateEstimatedCost()` function to use selected model pricing
   - Modify progress tracking to show model-specific costs
   - Update results page cost analysis card

#### Backend Changes
1. **OpenAI Service Updates**:
   - Accept model parameter in analysis requests
   - Pass selected model to OpenAI API calls
   - Update cost tracking with model-specific pricing

2. **Type Definitions**:
   - Add `GptModel` interface with pricing information
   - Update analysis request/response types to include model selection
   - Add model validation

#### Testing Requirements
1. **Unit Tests**:
   - Model selection validation
   - Cost calculation accuracy for all models
   - OpenAI service model parameter passing

2. **E2E Tests**:
   - Complete workflow with different model selections
   - Verify selected model appears in results
   - Cost calculation verification

3. **Mock Services**:
   - Mock OpenAI API responses for testing
   - Simulate different models and token usage

### User Flow
1. User opens Auto-Analysis page
2. User configures date, time, session count, API key (existing)
3. **NEW**: User selects GPT model (defaults to GPT 4.1 base)
4. **NEW**: User can optionally view pricing details via progressive disclosure
5. User starts analysis with selected model
6. Progress page shows model-specific cost estimates
7. Results page displays actual costs and model information

### Success Criteria
- ✅ Model selection persists through analysis workflow
- ✅ Cost calculations are accurate for selected model
- ✅ Progressive disclosure hides/shows pricing information
- ✅ E2E test confirms model selection functionality
- ✅ No regression in existing Auto-Analysis features
- ✅ Visual design maintains consistency with existing UI

### Implementation Notes
- Maintain backward compatibility with existing analysis requests
- Ensure model selection is validated before analysis starts
- Handle OpenAI API errors gracefully for unsupported models
- Consider future model additions with extensible design