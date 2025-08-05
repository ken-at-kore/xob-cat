# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Production Environment

- **Production URL**: https://www.koreai-xobcat.com
- **Deployment**: Frontend and backend deployed to production infrastructure
- **Testing**: E2E tests can be run against production using `--url` parameter

## Quick Commands

### Development
```bash
npm run start                  # Start both frontend (3000) and backend (3001)
npm run start:frontend        # Next.js dev server only
npm run start:backend         # Express API server only  
npm run stop                  # Stop all dev servers
npm run stop:frontend         # Stop frontend server only
npm run stop:backend          # Stop backend server only
```

### Server Status & Health Checks
```bash
npm run status                # Check both server status
npm run status:frontend       # Check frontend health
npm run status:backend        # Check backend health
```

### Testing
```bash
npm run test                  # Run all tests
npm run test:frontend         # Jest + React Testing Library
npm run test:backend          # Backend Jest unit tests
npm run test:e2e             # Playwright E2E tests
npm run test:puppeteer       # Puppeteer E2E tests (Jest-based, currently has issues)

# Backend test variations
cd backend && npm run test:unit         # Unit tests only
cd backend && npm run test:integration  # Integration tests
cd backend && npm run test:real-api     # Real Kore.ai API tests
cd backend && npm run test:coverage     # With coverage report

# Backend integration tests (NEW Dec 2024)
cd backend && npm test -- --testPathPattern="autoAnalyzeWorkflow.mock"  # Mock API (fast, no cost)
cd backend && npm test -- --testPathPattern="autoAnalyzeWorkflow.real"  # Real API (needs credentials)

# Puppeteer E2E (recommended for reliable E2E testing)
node frontend/e2e/run-puppeteer-test.js  # Standalone Puppeteer test (no hanging issues)
```

### Building & Quality
```bash
npm run build                 # Build both projects
npm run typecheck            # TypeScript type checking
npm run lint                  # Lint both projects
npm run lint:fix             # Auto-fix linting (backend only)
```

### Data Collection
```bash
npm run collect-data          # Collect production data
npm run generate-mock-analysis # Generate mock analysis results
npm run generate-analysis-summary # Generate AI summaries
```

## File Map

### Frontend (`frontend/src/`)
```
app/
├── layout.tsx               # Minimal root Next.js layout
├── page.tsx                 # Credentials/Home page
├── (dashboard)/             # Dashboard route group
│   ├── layout.tsx          # Dashboard layout with TopNav + Sidebar
│   ├── page.tsx            # Default dashboard page (redirects to /sessions)
│   ├── sessions/           # View Sessions page (default active)
│   │   └── page.tsx        # Sessions list with filtering and table
│   └── analyze/            # Auto-Analyze page  
│       └── page.tsx        # AI-powered session analysis with batch consistency

components/
├── TopNav.tsx              # Top navigation: "XOBCAT" + subtitle | "Bot ID" + id + • + "Disconnect"
├── Sidebar.tsx             # Left sidebar navigation with "Pages" section
├── SessionTable.tsx        # Main sessions data table (cleaned up, no Card wrappers)
├── SessionDetailsDialog.tsx # Session detail modal for View Sessions
├── AnalyzedSessionDetailsDialog.tsx # Session detail modal for Auto-Analyze with AI facts
├── AnalysisCharts.tsx      # Recharts visualizations (Pie, Pareto, Bar charts)
├── AnalysisReportView.tsx  # Comprehensive Auto-Analyze report with charts and markdown
├── ErrorBoundary.tsx       # Error handling wrapper
└── ui/                     # shadcn/ui components (Button, Table, etc.)

lib/
├── api.ts                  # Type-safe API client with error handling
└── utils.ts                # Utility functions (cn, etc.)
```

### Backend (`backend/src/`)
```
routes/
├── analysis.ts             # POST /api/analysis/* - OpenAI session analysis
└── kore.ts                 # GET /api/kore/* - Kore.ai API integration

services/
├── openaiService.ts          # GPT-4o-mini function calling integration
├── koreApiService.ts         # Kore.ai JWT auth + rate limiting
├── realSessionDataService.ts # Session data retrieval with SWT integration
└── swtService.ts             # Session analysis business logic

__mocks__/                  # Pure mock services (no real API calls)
├── koreApiService.mock.ts  # Pure mock Kore.ai API service
├── openaiService.mock.ts   # Pure mock OpenAI service
└── sessionDataService.mock.ts # Pure mock session data service

interfaces/
└── index.ts                # Service interfaces for dependency injection

factories/
└── serviceFactory.ts       # Environment-based service selection

models/
└── swtModels.ts           # Domain models for session analysis

middleware/
├── errorHandler.ts         # Global error handling
└── credentials.ts          # Auth middleware
```

### Shared & Configuration
```
shared/types/index.ts       # TypeScript interfaces shared by frontend/backend
scripts/                   # Data collection utilities (TypeScript)
data/                      # Sanitized production test data (JSON)
docs/                      # Product requirements and architecture docs
```

## Credentials Page Enhancements

Enhanced credentials page with improved visual appeal, accessibility, and user experience:

- **Kore.ai Emblem**: Official emblem with Next.js Image optimization
- **Focus Management**: Auto-focus on Bot ID field for accessibility
- **Form Security**: Prevents browser password manager for API credentials
- **Testing**: Comprehensive coverage for all enhancements

## Auto-Analyze Feature

### Overview
The Auto-Analyze feature provides AI-powered batch analysis of customer service sessions using OpenAI GPT-4o-mini. It implements intelligent session sampling with time window expansion, maintains classification consistency across analysis batches, and generates comprehensive analysis summaries with actionable insights.

### Key Components

#### Backend Services (`backend/src/services/`)
```
autoAnalyzeService.ts         # Main orchestration service (singleton pattern)
├── sessionSamplingService.ts # Time window expansion algorithm (3hr → 6hr → 12hr → 6day)
├── batchAnalysisService.ts   # Batch processing with classification consistency
├── openaiAnalysisService.ts  # GPT-4o-mini integration with function calling
├── analysisSummaryService.ts # Analysis summary generation with markdown output
└── koreApiService.ts         # Session data retrieval with rate limiting
```

#### Frontend Components (`frontend/src/app/analyze/`)
```
page.tsx                      # Complete Auto-Analyze workflow
├── Configuration Form        # Date/time, session count, OpenAI API key
├── Progress Tracking         # Real-time updates with ETA and cost tracking
└── Results Table            # Analysis results with transcript column
```

#### API Endpoints (`backend/src/routes/autoAnalyze.ts`)
```
POST /api/analysis/auto-analyze/start           # Start analysis
GET  /api/analysis/auto-analyze/progress/:id    # Real-time progress
GET  /api/analysis/auto-analyze/results/:id     # Fetch results
DELETE /api/analysis/auto-analyze/:id           # Cancel analysis
```

### Algorithm Details

#### Session Sampling Strategy
1. **Initial Window**: 3-hour window from specified start time
2. **Expansion Logic**: If insufficient sessions found, expand to:
   - 6 hours → 12 hours → 6 days
3. **Quality Filtering**: Remove sessions with <2 messages or no user interaction
4. **Deduplication**: Ensure unique sessions across time windows
5. **Random Sampling**: Select requested count from available sessions

#### Batch Analysis Process
1. **Batch Size**: 5 sessions per batch (configurable)
2. **Classification Consistency**: Track intents and outcomes across batches
3. **Rate Limiting**: 2-second intervals between batches
4. **Token Tracking**: Real-time cost calculation and usage monitoring
5. **Error Handling**: Continue processing despite individual session failures
6. **Summary Generation**: Generate analysis overview and detailed summary using aggregated session data

#### OpenAI Integration
- **Model**: GPT-4o-mini with function calling
- **Schema**: Structured analysis output (intent, outcome, transfer reasons, notes)
- **Cost Optimization**: ~$0.019 average cost per session analysis
- **Quality**: 100% facts consistency verified with real conversation data

### Performance Optimization (August 2025)

**Layered Architecture:** SessionSamplingService → SWTService → KoreApiService → Kore.ai API

**Key Improvement:** Metadata-first approach eliminates timeouts:
- Fetch session metadata only (fast), sample, then fetch messages for selected sessions
- **Result**: 10x performance improvement, handles 1000+ sessions

### Configuration & Usage

#### Environment Variables
```bash
# Backend (.env)
OPENAI_API_KEY=sk-...         # Required for session analysis
```

#### Analysis Configuration
- **Date Range**: Must be in the past (validated)
- **Session Count**: 5-1000 sessions (configurable range)
- **Time Format**: HH:MM (24-hour format, Eastern Time)
- **API Key**: OpenAI API key validation (sk- prefix required)

### Testing & Performance
- **Coverage**: Unit, E2E, and real API tests with 100% accuracy
- **Metrics**: ~$0.019 per session, 95%+ session discovery rate

### Async Architecture (August 2025)

**Solution**: BackgroundJobQueue service for Lambda timeout issues
- Immediate job ID response, background processing, real-time progress polling
- Three phases: sampling, analysis, summary generation

**Note**: See "Data Access Architecture" section below for detailed layered architecture implementation.

### Known Limitations
- **MVP Constraint**: In-memory state only (no database persistence)
- **API Dependency**: Requires valid OpenAI API key for analysis
- **Mock Data**: Kore.ai integration uses mock credentials for MVP
- **Session Cleanup**: Analysis results expire after 1 hour
- **Job Queue**: In-memory job storage (not suitable for multi-instance deployments)

## 🧪 Mock Service Architecture (August 2025)

### Overview
Centralized mock services architecture providing pure mocks without any real API attempts for reliable testing.

### Service Types
1. **Pure Mock Services** (`__mocks__/`): Never attempt real API calls
2. **Real Services** (`services/`): Production implementations with real API calls  
3. **Service Factory** (`factories/`): Environment-based service selection

### Architecture Components

#### Service Interfaces (`backend/src/interfaces/`)
- `IKoreApiService`: Kore.ai API operations interface
- `IOpenAIService`: OpenAI analysis operations interface  
- `ISessionDataService`: Session data retrieval interface
- `ServiceType`: REAL | MOCK | HYBRID configuration enum

#### Service Factory (`backend/src/factories/serviceFactory.ts`)
Environment-based service selection:
- **Test Environment**: Pure mock services only
- **Development**: Configurable (real or mock based on credentials)
- **Production**: Real services with credential validation

#### Pure Mock Services (`backend/src/__mocks__/`)
- **koreApiService.mock.ts**: Mock Kore.ai API with deterministic data
- **openaiService.mock.ts**: Mock OpenAI service with predefined analysis results
- **sessionDataService.mock.ts**: Mock session data generation without network calls

### Testing Strategy

#### Unit Tests
- Use pure mock services via service factory
- No real API calls in test environment
- Deterministic test data for consistent results

#### Integration Tests  
- Test service factory environment selection
- Verify service interface compliance
- Test error handling and fallback behavior

#### E2E Tests
- Use mock services for consistent browser testing
- Test complete workflows without external dependencies

### Environment Configuration

#### Test Environment (`NODE_ENV=test`)
```bash
# Automatically uses pure mock services
# No API keys required
# No network calls attempted
```

#### Development Environment  
```bash
# Service selection based on credential availability
# Falls back to mocks when credentials missing
# Supports both real and mock workflows
```

**Benefits:** Reliable tests, instant execution, deterministic behavior, service isolation

## Development Guidelines

### Code Quality Standards
- **Strict TypeScript**: No `any` types allowed (ongoing cleanup in progress)
- **TDD Approach**: Write failing tests first, then implement
- **Conventional Commits**: `<type>(scope): message` format
- **Pre-commit**: Run `npm run typecheck` before committing
- **Update claude.md**: When workflows, scripts, or structure changes

### Recent Quality Improvements (August 2025)
- **Type Safety**: Replaced `any` types, added structured logging, documented technical debt

### Required Development Commands
**IMPORTANT**: Always use standardized npm scripts:
- **Server Management**: `npm run start/stop/status` commands only
- **Individual Servers**: Use `npm run start:frontend/backend` (not cd commands)
- **Script Location**: All scripts in `scripts/` directory

### E2E Testing Guidelines

#### When to Use Puppeteer vs Playwright
- **Puppeteer**: Critical session validation, message display testing, complex UI interactions
- **Playwright**: Basic navigation, form testing, quick UI checks
- **Rule**: If test involves session dialogs or message validation, prefer Puppeteer

#### Puppeteer Test Organization
- **Shared Workflow Pattern** (Recommended for new tests):
  - Create shared workflow modules in `frontend/e2e/shared/`
  - Separate test files for different configurations (mock vs real API)
  - Example: `view-sessions-mock-api-puppeteer.test.js` and `view-sessions-real-api-puppeteer.test.js`
- **Standalone Pattern** (Legacy, still valid):
  - Single file contains all workflow logic
  - Example: `run-puppeteer-test.js`
- **Choose Shared Pattern When**:
  - Testing same workflow with different data sources
  - Need consistency across multiple test variations
  - Want to reduce code duplication

#### Creating New E2E Tests
1. **Start with Mock APIs**: Use `mock-*` credentials for fast, reliable tests
2. **Add Real API Tests**: Only after mock tests pass, create real API variants
3. **Naming Convention**: 
   - Mock tests: `*-mock.spec.ts` or `*-simple.spec.ts`
   - Real API tests: `*-real-api.spec.ts`
   - Puppeteer tests: `*.test.js` (Node.js) or `run-*.js` (standalone)

#### Debugging E2E Test Issues
1. **Screenshots**: Always capture screenshots on failure
2. **Console Logs**: Check browser console for JavaScript errors
3. **Network Tab**: Verify API calls are completing successfully
4. **Mock Services**: Confirm mock services activate with proper credentials

### Navigation Architecture
- **Route Structure**: Next.js 15 App Router with `(dashboard)` route group
- **TopNav**: "XOBCAT" + subtitle | "Bot ID" + value + "Disconnect"  
- **Sidebar**: "View Sessions" (default) and "Auto-Analyze" pages
- **Auth Flow**: Credentials page → `/sessions`

### Key Integrations
- **OpenAI**: GPT-4o-mini with function calling
- **Kore.ai**: JWT auth with 60/min, 1800/hour rate limits
- **Testing**: Jest unit, integration, Playwright E2E

### Reference Documentation
- **Product Requirements**: `docs/Product Requirements Document.md`
- **Architecture**: `docs/architecture.md`
- **API Reference**: `docs/api-reference.md`
- **Auto-Analyze Spec**: `docs/Auto-Analyze Feature Specification.md`
- **Technical Design**: `docs/Auto-Analyze Technical Design.md`

### Auto-Analyze Feature
AI-powered bot performance analysis using GPT-4o-mini with time window expansion, batch processing, and interactive visualizations. Supports 5-1000 sessions with real-time progress tracking and cost estimation.

### Report Sharing
- **Export**: Download versioned JSON files with all session data
- **Viewer**: Standalone `/report-viewer` interface with drag-and-drop upload
- **Share**: Two-step workflow for stakeholder distribution

## 🏗️ Project Architecture

**Stack**: Next.js 15 + Express + TypeScript + OpenAI GPT-4o-mini + Nivo charts  
**Structure**: Monorepo with frontend (3000), backend (3001), shared types, test data


## 🏛️ Core Architecture

### Shared Types (`shared/types/index.ts`)
- `SessionWithTranscript`, `AnalysisResults`, `AnalysisProgress`
- `AnalysisExportFile`, `Message`, `ANALYSIS_FUNCTION_SCHEMA`

### **Data Access Architecture** (Layered Pattern)

Our data access follows a **Repository Pattern with Lazy Loading** to optimize performance and maintain separation of concerns:

#### **Layer 1: Data Access (KoreApiService)**
Granular API methods for performance optimization:
```typescript
// Fetch session metadata only (fast)
getSessionsMetadata(options): Promise<SessionMetadata[]>

// Fetch messages for specific sessions (selective)  
getMessagesForSessions(sessionIds, dateRange): Promise<KoreMessage[]>

// Convenience method (composition of above)
getSessionsWithMessages(options): Promise<KoreSessionComplete[]>
```

#### **Layer 2: Data Transformation (SWTService)**
Transforms API data with lazy loading support:
```typescript
// Convert metadata to app format
createSWTsFromMetadata(sessions): Promise<SessionWithTranscript[]>

// Populate messages selectively  
populateMessages(swts, sessionIds?): Promise<SessionWithTranscript[]>

// Convenience method (eager loading)
generateSWTs(options): Promise<SessionWithTranscript[]>
```

#### **Layer 3: Business Logic (SessionSamplingService)**
Optimized sampling workflow:
1. **Fetch Metadata**: Get session data without messages (fast)
2. **Sample Sessions**: Apply time window expansion and random sampling  
3. **Populate Messages**: Fetch messages only for sampled sessions (selective)

**Benefits:**
- **Performance**: 10x faster session sampling (metadata-first approach)
- **Scalability**: Handles 1000+ sessions without timeout
- **Composability**: Mix and match data fetching strategies
- **Testability**: Clear layer boundaries for mocking

### API Structure (`backend/src/`)
- **Routes**: `/api/analysis/*`, `/api/kore/*`
- **Services**: Layered data access with lazy loading
- **Models**: Domain models for session analysis

### Frontend (`frontend/src/`)
- **App Router**: Nested layouts with dashboard route group
- **Components**: shadcn/ui + custom components
- **API Client**: Type-safe client with error handling

## 🧪 Testing

**Backend**: Unit, integration, and real API tests with lcov coverage  
**Frontend**: Component tests (React Testing Library) + E2E (Playwright/Puppeteer)  
**Data**: Sanitized production data for realistic mock services

## 🎭 E2E Testing Strategy

### Testing Frameworks
- **Playwright**: Primary E2E testing framework (25+ test files)
- **Puppeteer**: Reliable alternative for critical tests (avoids hanging issues)

### Puppeteer E2E Implementation ⭐

**Recommended for Critical Tests** - Puppeteer provides more reliable execution for session validation:

#### Setup & Configuration
```bash
# Standalone execution (no Jest conflicts)
node frontend/e2e/run-puppeteer-test.js

# Key advantages over Playwright:
# - No hanging/timeout issues (completes in seconds vs 30+ seconds)
# - Better WebSocket handling in Node.js environment
# - More reliable for session dialog testing
```

#### Puppeteer Test Architecture

**Shared Workflow Pattern** (Recommended Approach):
```javascript
// frontend/e2e/shared/view-sessions-workflow.js
module.exports = {
  BROWSER_CONFIG,      // Common browser configuration
  TIMEOUTS,           // Consistent timeout values
  enterCredentials,   // Step 1-2: Navigate and enter credentials
  waitForSessionsPage,// Step 3: Handle navigation
  waitForSessions,    // Step 4: Load session data
  clickSessionAndWaitForDialog, // Step 5-6: Open dialog
  validateSanitization,// Step 7: Validate message sanitization
  setupRequestLogging // Request/console logging
};
```

**Benefits of Shared Workflow**:
- **DRY Principle**: Write workflow logic once, use in multiple tests
- **Consistency**: Same validation logic across mock and real API tests
- **Maintainability**: Update workflow in one place
- **Separation**: Clear boundary between test configuration and implementation

**Legacy Configuration** (Still used in some tests):
```javascript
browser = await puppeteer.launch({
  headless: false,      // Visual debugging
  slowMo: 50,          // Human-like interactions
  defaultViewport: { width: 1280, height: 720 }
});

// Short timeouts prevent hanging
page.setDefaultTimeout(2000);
page.setDefaultNavigationTimeout(5000);
```

#### Puppeteer Best Practices
1. **Mock Credentials**: Use `mock-bot-id`, `mock-client-id`, `mock-client-secret` to trigger mock services
2. **Short Timeouts**: 2-5 second timeouts prevent infinite hangs
3. **Human-like Interactions**: Include hover, wait states, and realistic timing
4. **Rich Content Validation**: Verify dialog contains >50 characters and message-related words
5. **Screenshot Debugging**: Capture screenshots at key validation points

### E2E Test Inventory

#### 🎭 **Puppeteer Tests (Recommended)**
| Test File | API Type | Purpose | Status |
|-----------|----------|---------|---------|
| `view-sessions-mock-api-puppeteer.test.js` | Mock | View sessions workflow with mock API | ✅ Reliable, shared workflow |
| `view-sessions-real-api-puppeteer.test.js` | Real | View sessions workflow with real API | Uses ENV vars, supports `--url` param |
| `auto-analyze-mock-api-puppeteer.test.js` | Mock | Auto-analyze workflow with mock APIs | ✅ End-to-end workflow validation |
| `auto-analyze-real-api-puppeteer.test.js` | Real | Auto-analyze workflow with real APIs | Uses ENV vars, incurs OpenAI costs |
| `run-puppeteer-bogus-credentials-test.js` | Invalid | Error handling validation | Tests auth failures |

**Features:**
- Shared workflow pattern for code reuse
- Complete auto-analyze testing (credentials → analysis → report)
- Mock and real API variants with production testing support


**Usage:**
```bash
# Mock tests (fast, no costs)
node frontend/e2e/view-sessions-mock-api-puppeteer.test.js
node frontend/e2e/auto-analyze-mock-api-puppeteer.test.js

# Real API tests (requires credentials)
node frontend/e2e/view-sessions-real-api-puppeteer.test.js
node frontend/e2e/auto-analyze-real-api-puppeteer.test.js
```

#### 🎪 **Playwright Tests**
| Test File | API Type | Purpose | Notes |
|-----------|----------|---------|--------|
| `session-message-validation-mock.spec.ts` | Mock | Message display validation | ⚠️ Can hang |
| `session-viewer-real-api.spec.ts` | Real | Production API integration | Uses ENV vars |
| `session-viewer-real-api-improved.spec.ts` | Real | Enhanced real API testing | Uses ENV vars |
| `auto-analyze-real-api-debug.spec.ts` | Real | Auto-analyze with real APIs | Debug version |
| `auto-analyze-complete-workflow.spec.ts` | Mock | Full auto-analyze workflow | Production data patterns |
| `auto-analyze-mock-report-simple.spec.ts` | Mock | Simple mock report testing | Fast execution |
| `sessions-page.spec.ts` | Mock | Session listing functionality | Basic UI tests |
| `auth-flow.spec.ts` | Mock | Credentials flow testing | Login workflow |

#### 📊 **Test Classification**

**Mock API Tests (Fast, Reliable)**:
- Use `mock-*` credentials to trigger mock services
- 10 predefined sessions with rich conversation data
- Ideal for UI/UX validation and regression testing
- Complete in seconds

**Real API Tests (Integration)**:
- Require `TEST_BOT_ID`, `TEST_CLIENT_ID`, `TEST_CLIENT_SECRET` environment variables
- Test actual Kore.ai API integration
- May be slower due to network calls and rate limiting
- Used for production validation

### Mock Services Integration

Mock services automatically activate when credentials contain "mock":
```javascript
// Triggers mock services
botId: 'mock-bot-id'
clientId: 'mock-client-id' 
clientSecret: 'mock-client-secret'

// Mock data includes rich conversations:
// - Claim status inquiries
// - Billing questions  
// - Coverage verification
// - Technical support transfers
```

### Troubleshooting E2E Tests

#### Playwright Hanging Issues
- **Problem**: Tests timeout after 30+ seconds
- **Solution**: Use Puppeteer for critical session validation
- **Root Cause**: Complex selector timeouts and WebSocket handling

#### Session Dialog Not Opening
- **Check**: Click handlers properly bound after React hydration
- **Solution**: Add network idle waits and hover before click
- **Debug**: Take screenshots to verify UI state

#### Mock Services Not Working
- **Check**: Credentials contain "mock" string
- **Verify**: Backend logs show "🎭 Detected mock credentials"
- **Debug**: Check credentials middleware configuration

### Comprehensive E2E Testing (`frontend/e2e/auto-analyze-complete-workflow.spec.ts`)
- **Complete Workflow Testing**: Tests entire auto-analyze process from credentials to report
- **Production Data Patterns**: Uses sanitized production data for realistic testing scenarios
- **Report Validation**: Verifies all report sections, charts, and session details
- **Error Handling**: Tests edge cases and validation scenarios
- **Data Integrity**: Validates session data contains expected production patterns

## 🔑 Environment Configuration

### Backend (`.env`)
```env
OPENAI_API_KEY=your_key_here
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENABLE_DEV_FEATURES=true    # Controls mock reports and testing tools

# Real API Testing Credentials (Optional)
# Required only for running real API E2E tests
TEST_BOT_ID=your-actual-bot-id-here
TEST_CLIENT_ID=your-actual-client-id-here  
TEST_CLIENT_SECRET=your-actual-client-secret-here
```

## 🔐 Credentials Configuration

### For Real API Testing

Real API E2E tests require actual Kore.ai credentials to be configured in `.env.local`:

#### Required Environment Variables
```bash
# Add to .env.local (git ignored)
TEST_BOT_ID=st-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEST_CLIENT_ID=cs-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEST_CLIENT_SECRET=your-client-secret-here
TEST_OPENAI_API_KEY=sk-your-real-openai-key-here  # For auto-analyze tests
```

#### Testing Commands
```bash
# View Sessions Tests
# Mock API test (no credentials needed)
node frontend/e2e/view-sessions-mock-api-puppeteer.test.js

# Real API test (requires credentials in .env.local)
node frontend/e2e/view-sessions-real-api-puppeteer.test.js

# Test against production (requires credentials)
node frontend/e2e/view-sessions-real-api-puppeteer.test.js --url=https://www.koreai-xobcat.com

# Auto-Analyze Tests (NEW)
# Mock API test (no credentials needed, no OpenAI costs)
node frontend/e2e/auto-analyze-mock-api-puppeteer.test.js

# Real API test (requires credentials + TEST_OPENAI_API_KEY, incurs OpenAI costs)
node frontend/e2e/auto-analyze-real-api-puppeteer.test.js

# Test against production (requires credentials + OpenAI key)
node frontend/e2e/auto-analyze-real-api-puppeteer.test.js --url=https://www.koreai-xobcat.com
```

**Note**: Use test bot credentials only, never production credentials

## Visual Actions & Playwright

**Commands:**
- `snapshot [page]` → Take screenshot and describe what you see
- `visually test [page]` → Analyze UI for bugs, layout issues, UX problems

**Usage:** Visual inspection for debugging, behavior clarification, and front-end improvements

## 🎯 Development Guidelines

### Integrations
- **OpenAI**: GPT-4o-mini with function calling, cost tracking
- **Kore.ai**: JWT auth with rate limiting (60/min, 1800/hour)

### UI & Code Quality
- **Components**: shadcn/ui + Tailwind CSS, desktop-first design
- **TypeScript**: Strict typing, no `any` types
- **Testing**: TDD approach with comprehensive error handling

## 🚫 Constraints & 📊 Features

### Constraints
- **No Database**: In-memory/file-based data only
- **No Auth**: MVP without user authentication
- **OpenAI Dependency**: Session analysis requires valid API key

### Key Features
- **Session Management**: List/detail views with filtering and transcripts
- **AI Analysis**: Intent classification, transfer reasons, drop-off locations
- **Visualizations**: Interactive Nivo charts (pie, Pareto, bar) with hover effects
- **Cost Analytics**: Token usage tracking and cost breakdown

Always reference shared types, follow monorepo structure, and ensure tests pass before committing.