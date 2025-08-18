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

# Analysis Summary tests (Mock session data + Real OpenAI)
HYBRID_SUMMARY_TEST_MODE=main npm test -- --testPathPattern="analysisSummary.hybrid"
HYBRID_SUMMARY_MODEL="gpt-4.1" HYBRID_SUMMARY_DEBUG=true npm test -- --testPathPattern="analysisSummary.hybrid"

# Puppeteer standalone (recommended)
node frontend/e2e/run-puppeteer-test.js
```

### Build & Quality
```bash
npm run build|typecheck|lint|lint:fix
```

### Data Collection
```bash
npx tsx scripts/collect-production-data.ts [--start|-s] [--end|-e] [--output|-o] [--limit|-l] [--files|-f] [--containment|-c]
# Example: npx tsx scripts/collect-production-data.ts -s "2025-07-30T10:32:00" -e "2025-07-30T11:32:00" -c agent -l 20
```

## Project Structure

### Frontend (`frontend/src/`)
```
app/
├── page.tsx                 # Credentials page
├── (dashboard)/            # Dashboard layout group
│   ├── sessions/page.tsx   # View Sessions (default)
│   └── analyze/page.tsx    # Auto-Analyze

components/
├── TopNav.tsx              # "XOBCAT" | "Bot ID" + "Disconnect"
├── Sidebar.tsx             # Navigation
├── SessionTable.tsx        # Sessions list
├── SessionDetailsDialog.tsx # Session details
├── AnalyzedSessionDetailsDialog.tsx # AI-analyzed details
├── AnalysisCharts.tsx      # Recharts visualizations
└── ui/                     # shadcn/ui components
```

### Backend (`backend/src/`)
```
routes/
├── analysis.ts             # /api/analysis/* - OpenAI
└── kore.ts                 # /api/kore/* - Kore.ai

services/
├── koreApiService.ts       # Kore.ai integration
├── openaiService.ts        # GPT-4o-mini
├── swtService.ts           # Session analysis
└── parallelAutoAnalyzeService.ts # Multi-phase analysis (RECOMMENDED)

__mocks__/                  # Pure mock services
interfaces/                 # Service interfaces
factories/serviceFactory.ts # Environment-based selection
```

## Key Features

### Bot Connection (Optimized)
- **Performance**: 2.94s (from 3.1s)
- **Method**: Single 'agent' API call, 1-minute window, 1 session limit
- **Endpoint**: `/api/kore/test`

### Auto-Analyze
AI-powered session analysis with GPT-4o-mini, time window expansion, batch processing.

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

**Config:** `PARALLEL_STREAM_COUNT=4`, `PARALLEL_BATCH_SIZE=3`, `ENABLE_CONFLICT_RESOLUTION=true`

### Analysis Summary Generation
Macro-level analysis that generates comprehensive reports from per-session analysis results using `analysis-prompts.ts`.

**Integration Test:** `analysisSummaryService.hybrid.integration.test.ts`
- **Input**: Pre-analyzed sessions from `data/mock-analysis-results.json`
- **API**: Real OpenAI API for summary generation
- **Output**: Analysis overview, detailed summary, containment suggestions

**Environment Variables:**
- `HYBRID_SUMMARY_TEST_MODE`: `main`|`all` (controls test scope)
- `HYBRID_SUMMARY_MODEL`: `gpt-4.1-nano`|`gpt-4.1` (OpenAI model)
- `HYBRID_SUMMARY_DEBUG`: `true`|`false` (show prompts/responses)
- `HYBRID_SUMMARY_SESSION_LIMIT`: Number (limit sessions for cost control)

### Session Viewer (Enhanced)
- **Always-visible filters**: Interruptible loading
- **24-hour default**: Faster initial load
- **AbortController**: Request cancellation

### Data Access Architecture (Layered)
```typescript
// Layer 1: KoreApiService (API)
getSessionsMetadata(options)           // Fast metadata
getMessagesForSessions(sessionIds)     // Selective messages
getSessionsWithMessages(options)       // Combined

// Layer 2: SWTService (Transform)
createSWTsFromMetadata(sessions)       // Convert format
populateMessages(swts, sessionIds?)    // Add messages
generateSWTs(options)                  // Eager loading

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
- **Scripts Organization**:
  - `scripts/`: Production scripts
  - `scripts/debug/`: Debug utilities
  - `scripts/test-utils/`: Test files
  - Root: Deployment scripts

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

**Shared Workflow Pattern** (Recommended):
- Create in `frontend/e2e/shared/`
- Separate mock vs real API test files
- Benefits: DRY, consistent, maintainable

#### Mock Services
Activate with `mock-*` credentials:
- `mock-bot-id`, `mock-client-id`, `mock-client-secret`
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

## Documentation
- `docs/Product Requirements Document.md`
- `docs/architecture.md`
- `docs/Auto-Analyze Technical Design.md`
- `docs/Parallel Auto-Analyze Design.md`
- `docs/Parallel Auto-Analyze Debugging Breakthroughs.md`

Always follow shared types, monorepo structure, run tests before committing.