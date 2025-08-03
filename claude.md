# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

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

# Backend test variations
cd backend && npm run test:unit         # Unit tests only
cd backend && npm run test:integration  # Integration tests
cd backend && npm run test:real-api     # Real Kore.ai API tests
cd backend && npm run test:coverage     # With coverage report
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
├── openaiService.ts        # GPT-4o-mini function calling integration
├── koreApiService.ts       # Kore.ai JWT auth + rate limiting
├── mockDataService.ts      # Test data generation
└── swtService.ts           # Session analysis business logic

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

### Architectural Improvements (August 2025)

#### SessionSamplingService Refactor
Refactored to use SWTService for improved reliability:

**New Architecture:** SessionSamplingService → SWTService → KoreApiService → Kore.ai API

**Benefits:**
- **Code Reuse**: Shared logic between view sessions and auto-analysis
- **Consistency**: Eliminates implementation discrepancies
- **Reliability**: Comprehensive error handling and rate limiting
- **Maintainability**: Single source of truth for session retrieval

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

#### Test Coverage
- ✅ Unit tests: Session sampling, batch analysis, OpenAI integration
- ✅ E2E tests: Complete workflow with real-time progress tracking
- ✅ Manual testing: 100% accuracy on real session data

#### Performance Metrics
- **Processing**: ~636 tokens per session, $0.019 cost
- **Success Rate**: 100% on valid conversation data
- **Time Window**: 95%+ session discovery rate with expansion

### Async Architecture (August 2025)

Solved 40-50 second synchronous processing timeout issues in AWS Lambda with async BackgroundJobQueue service.

**Architecture Flow:**
1. **Start Analysis**: Returns job ID immediately (< 1 second)
2. **Background Processing**: Three phases - sampling, analysis, summary generation
3. **Progress Polling**: Real-time updates via `/progress/:id` endpoint
4. **Results**: Fetch completed results via `/results/:id`

**Key Features:**
- Immediate API response with job tracking
- Real-time progress with ETA and cost tracking
- Error resilience and credential handling
- In-memory job storage with cleanup

**Testing:** 7/7 timeout tests pass, verified with production credentials

### Known Limitations
- **MVP Constraint**: In-memory state only (no database persistence)
- **API Dependency**: Requires valid OpenAI API key for analysis
- **Mock Data**: Kore.ai integration uses mock credentials for MVP
- **Session Cleanup**: Analysis results expire after 1 hour
- **Job Queue**: In-memory job storage (not suitable for multi-instance deployments)

## Development Guidelines

### Code Quality Standards
- **Strict TypeScript**: No `any` types allowed (ongoing cleanup in progress)
- **TDD Approach**: Write failing tests first, then implement
- **Conventional Commits**: `<type>(scope): message` format
- **Pre-commit**: Run `npm run typecheck` before committing
- **Update claude.md**: When workflows, scripts, or structure changes

### Recent Quality Improvements (August 2025)

- **Type Safety**: Replaced `any` types with proper TypeScript interfaces
- **Logging**: Added structured logging with environment-aware log levels  
- **Technical Debt**: Documented 33 issues with priority classification and action plan

### Required Development Commands
**IMPORTANT**: Always use standardized npm scripts:
- **Server Management**: `npm run start/stop/status` commands only
- **Individual Servers**: Use `npm run start:frontend/backend` (not cd commands)
- **Script Location**: All scripts in `scripts/` directory

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
AI-powered bot performance analysis with comprehensive reporting:

**Core Features:**
- **Session Sampling**: Time window expansion (3hr → 6hr → 12hr → 6day) to find 5-1000 sessions
- **AI Analysis**: GPT-4o-mini extracts intent, outcome, transfer reasons, drop-off locations
- **Batch Processing**: Processes in batches with classification consistency
- **Progress Tracking**: Real-time updates with token usage and cost estimation
- **Visualizations**: Interactive Nivo charts (pie, Pareto, bar) with hover effects
- **Session Details**: Click rows for detailed dialogs with AI facts and transcripts
- **Mock Reports**: Development feature for testing without OpenAI API

**Configuration:** Date/time picker, session count (5-1000), OpenAI API key input

### Report Viewer Feature

Enables sharing analysis reports without requiring XOBCAT access:

**Export Functionality:**
- Download versioned JSON files with all session data, charts, and metadata
- Secure export excludes API keys and sensitive data
- Auto-generated filenames: `xob-cat-analysis-YYYY-MM-DDTHH-MM-SS.json`

**Report Viewer Interface** (`/report-viewer`):
- Standalone layout with drag-and-drop file upload
- Client-side validation with version compatibility checking
- Complete report rendering with interactive features

**API:** `GET /api/analysis/auto-analyze/export/{analysisId}` for JSON download

### Share Report Feature

Two-step workflow for sharing analysis results with stakeholders:

**Step 1:** Download report data as versioned JSON with progress tracking
**Step 2:** Share report viewer URL with copy-to-clipboard functionality

**Implementation:** ShareReportModal component with React hooks for state management, comprehensive error handling, and accessibility support

### Recent Analysis Report Improvements (July 2025)

Enhanced analysis reports with improved formatting and architecture:

- **UX Improvements**: Rich markdown formatting, improved readability, consistent terminology
- **Architecture**: Centralized prompt engineering and shared LLM service
- **Quality**: Comprehensive test coverage and visual testing verification

## 🏗️ Project Architecture

Monorepo full-stack analytics platform for Kore.ai Expert Services teams.

### Tech Stack
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend**: Node.js + Express + TypeScript (port 3001)
- **LLM**: OpenAI GPT-4o-mini with function calling
- **Charts**: Nivo library for interactive visualizations
- **Testing**: Jest (unit), Playwright (E2E)
- **Data**: In-memory only (MVP constraint)

### Structure
```
XOBCAT/
├── frontend/    # Next.js app (port 3000)
├── backend/     # Express API (port 3001)  
├── shared/      # TypeScript types
├── data/        # Test data
└── scripts/     # Utilities
```


## 🏛️ Core Architecture

### Shared Types (`shared/types/index.ts`)
- `SessionWithTranscript`, `AnalysisResults`, `AnalysisProgress`
- `AnalysisExportFile`, `Message`, `ANALYSIS_FUNCTION_SCHEMA`

### API Structure (`backend/src/`)
- **Routes**: `/api/analysis/*`, `/api/kore/*`
- **Services**: OpenAI, Kore.ai, mock data, session analysis
- **Models**: Domain models for session analysis

### Frontend (`frontend/src/`)
- **App Router**: Nested layouts with dashboard route group
- **Components**: shadcn/ui + custom components
- **API Client**: Type-safe client with error handling

## 🧪 Testing

### Backend (`backend/src/__tests__/`)
- Unit, integration, and real API tests
- Comprehensive coverage with lcov reporting

### Frontend (`frontend/src/__tests__/`)
- Component tests with React Testing Library
- E2E tests with Playwright
- 100% coverage on navigation components

### Test Data (`data/`)
- Sanitized production data for realistic testing

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
```

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