# OpenAI API Logging

This document explains how to enable temporary OpenAI API logging for testing and debugging purposes.

## Environment Variables

### `OPENAI_LOGGING=true`
Enables basic OpenAI API request/response logging including:
- 🤖 **Request Details**: Model, session count, API key prefix, prompt length, existing classifications
- ✅ **Response Details**: Duration, model used, token usage, finish reason
- 📊 **Parsed Results**: Analysis results summary (intents, transfer/contained counts)
- 💰 **Cost Calculation**: Token usage and cost breakdown
- ❌ **Error Logging**: Enhanced error details with context

### `OPENAI_LOGGING_VERBOSE=true` (optional)
When combined with `OPENAI_LOGGING=true`, adds:
- 📝 **Prompt Preview**: First 500 characters of the analysis prompt
- 📋 **Full Function Arguments**: Complete JSON response from OpenAI

## Usage

### Enable Basic Logging
```bash
# Terminal 1: Set environment variable and start backend
cd backend
OPENAI_LOGGING=true npm run dev

# Terminal 2: Start frontend  
cd frontend
npm run dev
```

### Enable Verbose Logging
```bash
# Terminal 1: Enable verbose logging
cd backend
OPENAI_LOGGING=true OPENAI_LOGGING_VERBOSE=true npm run dev
```

### Using Docker/Scripts
If using the development scripts, you can set the environment variables:
```bash
export OPENAI_LOGGING=true
export OPENAI_LOGGING_VERBOSE=true
npm run start
```

## Example Log Output

### Basic Logging
```
🤖 OpenAI API Request: {
  timestamp: '2025-07-29T18:45:23.123Z',
  model: 'gpt-4o-mini',
  modelId: 'gpt-4o-mini',
  sessionCount: 5,
  apiKey: 'sk-proj-...',
  promptLength: 2847,
  existingClassifications: { intents: 3, transferReasons: 2, dropOffLocations: 1 }
}

✅ OpenAI API Response: {
  timestamp: '2025-07-29T18:45:25.789Z',
  duration: '2666ms',
  model: 'gpt-4o-mini-2024-07-18', 
  usage: { prompt_tokens: 645, completion_tokens: 123, total_tokens: 768 },
  finishReason: 'tool_calls',
  hasToolCalls: true
}

📊 Parsed Analysis Results: {
  sessionsAnalyzed: 5,
  intentsFound: ['Billing', 'Claim Status', 'Eligibility'],
  transferCount: 2,
  containedCount: 3
}

💰 Cost Calculation: {
  promptTokens: 645,
  completionTokens: 123, 
  totalTokens: 768,
  cost: '$0.000192',
  modelUsedForCost: 'gpt-4o-mini'
}
```

### Error Logging
```
❌ OpenAI API Error: {
  timestamp: '2025-07-29T18:45:30.456Z',
  model: 'gpt-4o-mini',
  sessionCount: 5,
  error: 'Request failed with status code 429',
  stack: 'AxiosError: Request failed with status code 429...'
}
```

## Security Notes

- API keys are automatically truncated to first 8 characters in logs
- Session content is never logged (only metadata)
- Full prompts only shown in verbose mode
- This logging is intended for temporary testing/debugging only

## Disabling Logging

Simply restart the backend without the environment variables:
```bash
cd backend
npm run dev
```

Or set the variable to false:
```bash
OPENAI_LOGGING=false npm run dev
```

## Log Files

When using the development scripts, logs are written to:
- `backend.log` - Backend server logs including OpenAI API logs
- `frontend.log` - Frontend development server logs

You can monitor the logs in real-time:
```bash
tail -f backend.log | grep -E "🤖|✅|📊|💰|❌"
```