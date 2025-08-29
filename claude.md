# claude.md

Project guidance for Claude Code working with XOBCAT repository.

## 🔐 SECURITY - CRITICAL

**NEVER hardcode credentials.** Use environment variables:
```javascript
// ❌ const botId = 'st-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
// ✅ const botId = process.env.TEST_BOT_ID;
```

**Pre-commit check:**
```bash
git grep -E "(st-[a-f0-9\-]{36}|cs-[a-f0-9\-]{36}|sk-[A-Za-z0-9]{20,})" -- ':(exclude).env.local'
```

## Production
- **URL**: https://www.koreai-xobcat.com
- **E2E Tests**: Use `--url` parameter for production testing

## Quick Commands

### Development
```bash
npm run start                 # Frontend (3000) + Backend (3001)
npm run start:frontend        # Next.js only
npm run start:backend         # Express only  
npm run stop                  # Stop all
npm run status                # Check health
```

### Testing
```bash
npm run test                  # All tests
npm run test:e2e              # Playwright E2E
npm run test:puppeteer        # Puppeteer E2E

# Backend specific
cd backend && npm run test:unit|integration|real-api|coverage

# Integration tests
npm test -- --testPathPattern="autoAnalyzeWorkflow.mock"  # Mock (fast)
npm test -- --testPathPattern="autoAnalyzeWorkflow.real"  # Real API
npm test -- --testPathPattern="botConnection.real"        # Connection test (~2.9s)

# Test modes
REAL_API_TEST_MODE=basic|all|workflow|errors|validation npm test -- --testPathPattern="autoAnalyzeWorkflow.real"

# Hybrid tests (Production data + OpenAI)
HYBRID_TEST_MODE=main HYBRID_MODEL="gpt-4.1" npm test -- --testPathPattern="perSessionAnalysis.hybrid"

# Puppeteer standalone (recommended)
node frontend/e2e/run-puppeteer-test.js

# Auto-analyze testing (uses shared workflow architecture)
node frontend/e2e/auto-analyze-real-api-puppeteer.test.js --sessions=10  # Real APIs, validates end-to-end workflow
node frontend/e2e/auto-analyze-mock-api-puppeteer.test.js              # Mock APIs, fast validation
```

### Build & Quality
```bash
npm run build|typecheck|lint|lint:fix
```

## Key Features

### Auto-Analyze
AI-powered session analysis with GPT-4o-mini, time window expansion, parallel processing.

**⚠️ Use Parallel Implementation** (`ParallelAutoAnalyzeService`) - NOT sequential.

#### Parallel System (5 Phases)
1. **Session Sampling**: Time window expansion (3hr→6hr→12hr→6day)
2. **Strategic Discovery**: Pattern establishment
3. **Parallel Processing**: Multi-stream concurrent analysis
4. **Conflict Resolution**: LLM-based consistency
5. **Summary Generation**: Comprehensive report

**API Endpoints:**
```
POST /api/analysis/auto-analyze/parallel/start
GET  /api/analysis/auto-analyze/progress/:id
GET  /api/analysis/auto-analyze/results/:id
DELETE /api/analysis/auto-analyze/:id
```

#### Additional Context Feature
- **UI**: Text area with 1500 character limit
- **Purpose**: User-provided context for analysis (e.g., bot purpose, company info, custom instructions)
- **Implementation**: Flows through all analysis phases (discovery, parallel processing, summary)
- **Example**: "The bot is an Acme Labs IVA. It helps callers track lab results. Write all responses in Spanish."

### Bot Connection (Optimized)
- **Performance**: 2.94s (from 3.1s)
- **Method**: Single 'agent' API call, 1-minute window, 1 session limit
- **Endpoint**: `/api/kore/test`

### Data Access Architecture (Layered)
```typescript
// Layer 1: KoreApiService (API)
getSessionsMetadata(options)           // Fast metadata
getMessagesForSessions(sessionIds)     // Selective messages

// Layer 2: SWTService (Transform)  
createSWTsFromMetadata(sessions)       // Convert format
populateMessages(swts, sessionIds?)    // Add messages

// Layer 3: SessionSamplingService (Business)
// Metadata → Sample → Populate (10x faster)
```

### Mock Service Architecture
- **Pure Mocks** (`__mocks__/`): No API calls
- **Service Factory**: Environment-based selection
- **Test Environment**: Auto-uses mocks
- **Benefits**: Reliable, instant, deterministic

## Development Guidelines

### Required Practices
- **TypeScript**: No `any` types
- **Security**: Environment variables only
- **Commands**: Use npm scripts (not cd)

### E2E Testing

#### Puppeteer (Recommended for critical tests)
```bash
# Mock API tests
node frontend/e2e/view-sessions-mock-api-puppeteer.test.js
node frontend/e2e/auto-analyze-mock-api-puppeteer.test.js

# Real API tests (needs .env.local credentials)
node frontend/e2e/view-sessions-real-api-puppeteer.test.js
node frontend/e2e/auto-analyze-real-api-puppeteer.test.js
```

#### Mock Services
Activate with exact credentials:
- `st-mock-bot-id-12345`, `cs-mock-client-id-12345`, `mock-client-secret-12345`
- 10 predefined sessions with rich conversations

### Frontend Debugging
**Component changes not appearing?** Restart frontend: `npm run stop:frontend && npm run start:frontend`

## Environment Configuration

### Backend (`.env`)
```env
OPENAI_API_KEY=sk-...
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENABLE_DEV_FEATURES=true
NEXT_PUBLIC_PROGRESS_DEBUG=true

# Real API Testing (optional)
TEST_BOT_ID=st-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEST_CLIENT_ID=cs-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEST_CLIENT_SECRET=your-client-secret
TEST_OPENAI_API_KEY=sk-your-openai-key
```

## Stack & Integrations
- **Frontend**: Next.js 15, shadcn/ui, Tailwind
- **Backend**: Express, TypeScript
- **AI**: OpenAI GPT-4o-mini with function calling
- **APIs**: Kore.ai (JWT, 60/min rate limit)
- **Charts**: Nivo (pie, Pareto, bar)
- **Testing**: Jest, Playwright, Puppeteer

## Constraints
- **No Database**: In-memory only
- **No Auth**: MVP without authentication
- **OpenAI Required**: For session analysis

## Testing
- **Progress Bar Animation Test**: `/test-progress` - Test blue animated progress bars with validation
- **E2E Tests**: Puppeteer tests validate progress bar animation in real auto-analyze workflows

Always follow shared types, monorepo structure, run tests before committing.