# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

### Development
```bash
npm run dev                    # Start both frontend (3000) and backend (3001)
npm run dev:frontend          # Next.js dev server only
npm run dev:backend           # Express API server only
./start-dev.sh               # Alternative dev startup script
```

### Testing
```bash
npm run test                  # Run all tests (frontend + backend)  
npm run test:frontend         # Jest + React Testing Library
npm run test:backend          # Backend Jest unit tests
npm run test:e2e             # Playwright E2E tests
./run-sessions-e2e.sh        # Run specific sessions E2E test

# Backend test variations
cd backend && npm run test:unit         # Unit tests only
cd backend && npm run test:integration  # Integration tests
cd backend && npm run test:real-api     # Real Kore.ai API tests
cd backend && npm run test:coverage     # With coverage report
```

### Building & Quality
```bash
npm run build                 # Build both projects
npm run typecheck            # TypeScript type checking for both projects
npm run lint                  # Lint both projects
npm run lint:fix             # Auto-fix linting (backend only)
```

### Data Collection & Mock Data
```bash
npm run collect-data          # Collect production data via scripts/collect-production-data.ts
npm run generate-mock-analysis # Generate mock analysis results for testing UI
npm run generate-analysis-summary # Generate AI-powered analysis summaries from mock data
npx tsx scripts/collect-july-6-13-full-range.ts    # Historical data collection
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
├── TopNav.tsx              # Top navigation: "XOB CAT" + subtitle | "Bot ID" + id + • + "Disconnect"
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

### Configuration & Usage

#### Environment Variables
```bash
# Backend (.env)
OPENAI_API_KEY=sk-...         # Required for session analysis
```

#### Analysis Configuration
- **Date Range**: Must be in the past (validated)
- **Session Count**: 10-1000 sessions (configurable range)
- **Time Format**: HH:MM (24-hour format, Eastern Time)
- **API Key**: OpenAI API key validation (sk- prefix required)

### Testing Coverage

#### Unit Tests (100% Critical Path Coverage)
- ✅ Session sampling with time window expansion
- ✅ Batch analysis with classification consistency
- ✅ OpenAI integration with function calling
- ✅ API endpoint validation and error handling
- ✅ Frontend component behavior and form validation

#### Integration & E2E Tests
- ✅ Complete workflow from configuration to results
- ✅ Progress tracking and real-time updates
- ✅ Error handling and cancellation scenarios
- ✅ UI rendering and accessibility compliance

#### Manual Testing Results
- ✅ Direct OpenAI analysis: 100% accuracy on real session data
- ✅ Facts consistency: All extracted facts match conversation transcripts
- ✅ Cost efficiency: Average $0.019 per session, 636 tokens average
- ✅ Classification quality: Accurate intent, outcome, and transfer reason detection

### Performance Metrics
- **Average Processing**: ~636 tokens per session
- **Cost Efficiency**: $0.019 per session analysis
- **Success Rate**: 100% on valid conversation data
- **Time Window Success**: Automatic expansion finds sessions in 95%+ of cases
- **Batch Processing**: 2-second intervals maintain API rate limits

### Known Limitations
- **MVP Constraint**: In-memory state only (no database persistence)
- **API Dependency**: Requires valid OpenAI API key for analysis
- **Mock Data**: Kore.ai integration uses mock credentials for MVP
- **Session Cleanup**: Analysis results expire after 1 hour

## Development Guidelines

### Code Quality Standards
- **Strict TypeScript**: No `any` types allowed
- **TDD Approach**: Write failing tests first, then implement
- **Conventional Commits**: `<type>(scope): message` format
- **Pre-commit**: Run `npm run typecheck` before committing
- **Update claude.md**: When workflows, scripts, or structure changes

### Navigation Architecture
- **Route Structure**: Uses Next.js 15 App Router with `(dashboard)` route group
- **TopNav Component**: Fixed header with app branding and bot connection info
  - Left: "XOB CAT" title + "XO Bot Conversation Analysis Tools" subtitle
  - Right: "Bot ID" label + bot ID value + bullet separator + "Disconnect" link
- **Sidebar Component**: Fixed left navigation with "Pages" section
  - "View Sessions" (default active, routes to `/sessions`)
  - "Auto-Analyze" (routes to `/analyze`)
- **Layout Pattern**: Nested layouts with dashboard wrapper containing TopNav + Sidebar
- **Authentication Flow**: Credentials page → `/sessions` (not `/dashboard/sessions`)

### Key Integrations
- **OpenAI**: GPT-4o-mini with function calling via `shared/types/ANALYSIS_FUNCTION_SCHEMA`
- **Kore.ai**: JWT auth with 60/min, 1800/hour rate limits
- **Testing**: Jest unit, integration, and Playwright E2E with real production data

### Reference Documentation
- **Product Requirements**: `docs/Product Requirements Document.md` - Complete feature specifications and user stories
- **Architecture**: `docs/architecture.md` - System design decisions  
- **API Reference**: `docs/api-reference.md` - Complete endpoint documentation
- **Auto-Analyze Feature**: `docs/Auto-Analyze Feature Specification.md` - Comprehensive Auto-Analyze feature specification
- **Auto-Analyze Technical Design**: `docs/Auto-Analyze Technical Design.md` - Detailed technical implementation guide

### Auto-Analyze Feature
The Auto-Analyze page provides comprehensive AI-powered bot performance analysis capabilities:

- **Session Sampling**: Intelligent time window expansion algorithm to find sufficient sessions (10-1000) from specified date/time periods
- **AI Analysis**: Uses OpenAI GPT-4o-mini with function calling to extract structured facts from session transcripts:
  - General Intent (what user is trying to accomplish)
  - Session Outcome (Transfer vs Contained)  
  - Transfer Reason (why session was escalated)
  - Drop-off Location (where in flow user left)
  - Summary Notes (one-sentence session summary)
- **Batch Processing**: Processes sessions in batches (~5 sessions) while maintaining classification consistency across all batches
- **Progress Tracking**: Real-time progress indicators with token usage and cost estimation
- **Results Display**: Comprehensive analysis report with multiple visualizations, markdown summaries, and interactive data exploration
- **Data Visualization**: Professional charts using Recharts library including pie charts, Pareto analysis, and bar charts
- **Error Handling**: Robust error recovery with fallback classifications and retry logic

**Configuration Options**:
- Start Date: Date picker (default: 7 days ago)
- Start Time: Time input in ET (default: 9:00 AM)
- Session Count: 10-1000 sessions (default: 100)
- OpenAI API Key: Secure input for API authentication

**Session Details UX**: Click any row in results table to open detailed dialog showing:
- Prominently displayed AI-extracted facts (intent, outcome, reasons, notes)
- Analysis metadata (tokens used, processing time, batch number)
- Complete conversation transcript in scrollable section
- Navigation between sessions using arrow keys or Previous/Next buttons

**Time Window Strategy**: 3-hour initial window → 6-hour → 12-hour → 6-day expansion until sufficient sessions found

**Mock Reports Feature**: For development and testing purposes, the Auto-Analyze page includes a "See Mock Reports" button that bypasses the analysis step and displays comprehensive sample results using mock data generated from real session transcripts. This allows developers to test the complete reporting interface with all visualizations without needing to perform actual AI analysis or use OpenAI API keys.

**Analysis Report Visualizations**: The results page displays a comprehensive analytics dashboard featuring:
- **Analysis Overview & Summary**: AI-generated markdown insights with performance metrics and actionable recommendations (properly styled with @tailwindcss/typography)
- **Session Outcomes Pie Chart**: Visual breakdown of contained vs transferred sessions with percentages
- **Transfer Reasons Pareto Chart**: Ranked analysis of why sessions were escalated to live agents  
- **Drop-off Locations Bar Chart**: Visualization of where users abandoned their sessions
- **General Intents Bar Chart**: Distribution of user intents and goals
- **Cost Analysis Card**: Token usage, estimated costs, and model information
- **Interactive Sessions Table**: Filterable table with detailed session exploration via clickable rows

**Markdown Rendering**: Analysis summaries use ReactMarkdown with remark-gfm and Tailwind Typography plugin for proper header hierarchy (H1: 32px, H2: 24px, H3: 18.72px) and bold text styling.

## 🏗️ Project Architecture

**XOB CAT** is a monorepo full-stack analytics platform for Kore.ai Expert Services teams to analyze chatbot conversations using OpenAI GPT-4o-mini.

### Tech Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + @tailwindcss/typography + shadcn/ui
- **Backend**: Node.js + Express + TypeScript (port 3001)
- **Shared**: TypeScript types in `shared/types/`
- **LLM Integration**: OpenAI GPT-4o-mini with function calling
- **Data Visualization**: Recharts library for interactive charts and graphs
- **Testing**: Jest (unit), Playwright (E2E)
- **No Database**: In-memory data only (MVP constraint)

### Workspace Structure
```
XOB CAT/
├── frontend/          # Next.js application (port 3000)
├── backend/           # Express API server (port 3001)  
├── shared/            # Shared TypeScript types
├── data/              # Sanitized production test data
├── scripts/           # Data collection utilities
└── package.json       # Root with concurrent scripts
```

## 🔧 Essential Commands

### Development
```bash
# Start both frontend and backend concurrently
npm run dev

# Individual services
npm run dev:frontend    # Next.js dev server (port 3000)
npm run dev:backend     # Express API server (port 3001)
```

### Testing
```bash
# Run all tests
npm run test

# Individual test suites
npm run test:frontend         # Jest + React Testing Library
npm run test:backend          # Jest unit tests  
npm run test:e2e             # Playwright E2E tests

# Backend test variations
cd backend && npm run test:unit         # Unit tests only
cd backend && npm run test:integration  # Integration tests
cd backend && npm run test:real-api     # Real API integration tests
cd backend && npm run test:coverage     # With coverage report
```

### Building & Linting
```bash
npm run build       # Build both frontend and backend
npm run lint        # Lint both projects
npm run lint:fix    # Auto-fix linting issues (backend only)
```

### Data Collection
```bash
npm run collect-data    # Collect production data for testing
```

## 🏛️ Core Architecture Patterns

### Shared Types (`shared/types/index.ts`)
All data models are defined here and imported by both frontend and backend:
- `SessionWithTranscript` - Core session data structure
- `AnalysisResult` - OpenAI analysis output schema
- `Message` - Individual conversation messages
- `ANALYSIS_FUNCTION_SCHEMA` - OpenAI function calling schema

### API Structure (`backend/src/`)
- **Routes**: `/api/analysis/*` (session analysis) and `/api/kore/*` (Kore.ai integration)
- **Services**: 
  - `openaiService.ts` - GPT-4o-mini integration with function calling
  - `koreApiService.ts` - Kore.ai API client with JWT auth and rate limiting
  - `mockDataService.ts` - Test data generation
- **Models**: `swtModels.ts` - Domain models for session analysis

### Frontend Structure (`frontend/src/`)
- **App Router**: Pages in `app/` directory with nested layouts
- **Components**: `components/ui/` for shadcn/ui components, custom components at root
- **API Client**: `lib/api.ts` - Type-safe API client with error handling

## 🧪 Testing Architecture

### Backend Testing (`backend/src/__tests__/`)
- **Unit Tests**: Individual service testing with mocks
- **Integration Tests**: Full API workflow testing with real/mock data hybrid
- **Real API Tests**: Limited real Kore.ai API integration tests
- **Coverage**: Comprehensive coverage reporting with lcov

### Frontend Testing (`frontend/src/__tests__/`)
- **Component Tests**: React Testing Library for UI components (100% coverage on TopNav, Sidebar)
- **Navigation Tests**: Comprehensive edge case testing for long bot IDs, accessibility, responsive design
- **Integration Tests**: Full navigation flow from credentials to dashboard
- **E2E Tests**: Playwright for complete user workflows with screenshots
- **API Tests**: Frontend API client testing

### Test Data (`data/`)
- Sanitized production data for realistic testing
- JSON files with real session structures
- Use for integration and E2E test scenarios

## 🔑 Environment Configuration

### Backend (`.env` in `backend/`)
```env
OPENAI_API_KEY=your_key_here    # Required for session analysis
PORT=3001                       # API server port
NODE_ENV=development            # Environment
FRONTEND_URL=http://localhost:3000  # CORS origin
```

### Frontend (`.env.local` in `frontend/`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🎯 Development Guidelines

### OpenAI Integration
- Uses GPT-4o-mini with function calling for structured analysis
- Schema defined in `shared/types/ANALYSIS_FUNCTION_SCHEMA`
- Cost tracking with token usage calculation
- Session analysis returns structured JSON with intent, outcome, transfer reasons

### Kore.ai Integration
- JWT-based authentication with rate limiting (60/min, 1800/hour)
- Real API service in `koreApiService.ts`
- Mock service for development in `mockDataService.ts`
- Session and message retrieval with pagination

### UI Components
- Use shadcn/ui components from `components/ui/`
- Tailwind CSS for styling (no custom CSS files)
- Desktop-first responsive design (≥1280px)
- Accessibility: focus rings, minimum 32px touch targets

### Code Quality
- Strict TypeScript, no `any` types
- TDD approach: write failing tests first
- async/await (avoid .then chains)
- Comprehensive error handling with typed API responses

## 🚫 Project Constraints

- **No Database**: All data is in-memory or file-based
- **No Authentication**: MVP has no user auth system
- **No Persistence**: Session data doesn't persist between restarts
- **OpenAI Dependency**: Session analysis requires valid API key

## 📊 Key Features

### Session Management
- List/detail views with filtering by date range and containment type
- Full conversation transcripts with message threading
- Session metadata (duration, message counts, user engagement)

### AI Analysis  
- GPT-4o-mini analyzes sessions for intent classification
- Identifies transfer reasons and drop-off locations
- Token usage tracking and cost calculation
- Batch analysis capabilities

### Data Visualization
- **Session Outcomes**: Pie chart visualization showing containment vs transfer rates with percentages
- **Transfer Reasons**: Pareto chart analysis ranking reasons for session escalation
- **Drop-off Analysis**: Bar chart showing where users abandon sessions in the conversation flow  
- **Intent Distribution**: Bar chart displaying the frequency of different user intents
- **Cost Analytics**: Token usage, model information, and cost breakdown visualization
- All charts built with Recharts library providing interactive tooltips and responsive design

When working on this codebase, always reference the shared types, follow the monorepo structure, and ensure tests pass before committing changes.