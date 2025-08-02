# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

### Development
```bash
npm run start                  # Start both frontend (3000) and backend (3001) via scripts/dev-start.sh
npm run start:frontend        # Start Next.js dev server only via scripts/dev-start-frontend.sh  
npm run start:backend         # Start Express API server only via scripts/dev-start-backend.sh
npm run stop                  # Stop all dev servers (kills processes on ports 3000 and 3001)
npm run stop:frontend         # Stop frontend server only (kill process on port 3000)
npm run stop:backend          # Stop backend server only (kill process on port 3001)
```

### Server Status & Health Checks
```bash
npm run status                # Check both frontend and backend server status
npm run status:frontend       # Check frontend server health (curl http://localhost:3000)
npm run status:backend        # Check backend server health (curl http://localhost:3001/health)
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

The credentials page (`app/page.tsx`) has been enhanced to improve visual appeal, accessibility, and user experience:

### Visual Branding
- **Kore.ai Emblem**: Official Kore.ai emblem displayed above the welcome card for professional brand identity
- **Asset Location**: `/frontend/public/assets/Kore.ai_Emblem_Black.svg`
- **Implementation**: Uses Next.js `Image` component with 80x80px dimensions for optimal performance

### Accessibility Improvements
- **Focus Management**: Bot ID field automatically receives focus when the page loads for improved keyboard navigation
- **Implementation**: Uses `useRef` and `useEffect` hooks for programmatic focus control
- **Tab Order**: Maintains logical tab sequence through all form elements

### Form Security
- **Client Secret Field**: Enhanced to prevent browser password manager prompts while maintaining security
- **Attributes**: Uses `autocomplete="new-password"`, `data-lpignore="true"`, and `data-form-type="other"`
- **Rationale**: Client secrets are API credentials, not user passwords, and shouldn't be saved by browsers

### Technical Implementation
- **Component Updates**: Input component (`components/ui/input.tsx`) updated to use `React.forwardRef` for proper ref handling
- **Testing**: Comprehensive test coverage for emblem display, focus management, and form attributes
- **Performance**: Uses Next.js Image component for optimized asset loading
- **Specifications**: Full specification documented in `/docs/Credentials Page Enhancement Specification.md`

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
The SessionSamplingService has been refactored to use SWTService instead of directly calling KoreApiService, providing significant improvements:

**Previous Architecture (Issues):**
- SessionSamplingService → KoreApiService → Kore.ai API
- Duplicated session retrieval logic between view sessions and auto-analysis
- Potential for inconsistent behavior between features

**New Architecture (Reliable):**
- SessionSamplingService → SWTService → KoreApiService → Kore.ai API
- Shared session retrieval logic ensures consistency between all features
- Improved error handling and reliability through proven SWTService code path

**Benefits:**
- **Code Reuse**: Both view sessions and auto-analysis use the same proven SWTService
- **Consistency**: Eliminates discrepancies between session retrieval implementations  
- **Reliability**: SWTService has comprehensive error handling and rate limiting
- **Maintainability**: Single source of truth for session data retrieval logic
- **Test Coverage**: Leverages existing SWTService test coverage and reliability

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

### Testing Coverage

#### Unit Tests (100% Critical Path Coverage)
- ✅ Session sampling with time window expansion
- ✅ Batch analysis with classification consistency
- ✅ OpenAI integration with function calling
- ✅ API endpoint validation and error handling
- ✅ Frontend component behavior and form validation
- ✅ Bot ID tracking through analysis workflow and display in reports

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

### Required Development Commands
**IMPORTANT**: Always use the standardized npm scripts defined in package.json:
- **Server Management**: Use `npm run start`, `npm run stop`, `npm run status` commands only
- **Individual Servers**: Use `npm run start:frontend` and `npm run start:backend` (not direct cd commands)
- **Individual Server Stopping**: Use `npm run stop:frontend` and `npm run stop:backend` to stop specific servers
- **Health Checks**: Use `npm run status:backend` and `npm run status:frontend` for server monitoring
- **Script Location**: All development scripts are in `scripts/` directory with proper error handling and logging

### Navigation Architecture
- **Route Structure**: Uses Next.js 15 App Router with `(dashboard)` route group
- **TopNav Component**: Fixed header with app branding and bot connection info
  - Left: "XOBCAT" title + "XO Bot Conversation Analysis Tools" subtitle
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
- Session Count: 5-1000 sessions (default: 100)
- OpenAI API Key: Secure input for API authentication

**Session Details UX**: Click any row in results table to open detailed dialog showing:
- Prominently displayed AI-extracted facts (intent, outcome, reasons, notes)
- Analysis metadata (tokens used, processing time, batch number)
- Complete conversation transcript in scrollable section
- Navigation between sessions using arrow keys or Previous/Next buttons

**Time Window Strategy**: 3-hour initial window → 6-hour → 12-hour → 6-day expansion until sufficient sessions found

**Mock Reports Feature**: For development and testing purposes, the Auto-Analyze page includes a "See Mock Reports" button that bypasses the analysis step and displays comprehensive sample results using mock data generated from real session transcripts. This allows developers to test the complete reporting interface with all visualizations without needing to perform actual AI analysis or use OpenAI API keys.

**Analysis Report Visualizations**: The results page displays a comprehensive analytics dashboard featuring:
- **Bot ID Display**: Shows the actual bot ID that was analyzed (not just the connected bot) in the report header with monospace styling for easy identification - helps users spot bugs where a different bot was analyzed than expected
- **Analysis Overview & Summary**: AI-generated markdown insights with performance metrics and actionable recommendations (properly styled with @tailwindcss/typography)
- **Session Outcomes Pie Chart**: Interactive Nivo pie chart showing contained vs transferred sessions with percentages and hover effects
- **Transfer Reasons Pareto Chart**: Horizontal Nivo bar chart with Pareto analysis ranking transfer reasons by frequency with cumulative impact tooltips
- **Drop-off Locations Bar Chart**: Nivo horizontal bar chart showing top 8 locations where users abandon sessions
- **General Intents Bar Chart**: Nivo horizontal bar chart displaying top 8 user intent categories and distribution
- **Cost Analysis Card**: Token usage, estimated costs, and model information with detailed breakdown
- **Interactive Sessions Table**: Filterable table with detailed session exploration via clickable rows

**Markdown Rendering**: Analysis summaries use ReactMarkdown with remark-gfm and Tailwind Typography plugin for proper header hierarchy (H1: 32px, H2: 24px, H3: 18.72px) and bold text styling.

### Report Viewer Feature

The Report Viewer feature enables sharing of analysis reports without requiring access to the full XOBCAT application. Power users can export analysis results as versioned JSON files and stakeholders can view them through a standalone report viewer interface.

**Export Functionality**:
- **Download Report Data**: Button available on analysis results page (only visible when `analysisId` is available)
- **Versioned JSON Format**: Exports use semantic versioning (v1.0.0) with schema compatibility tracking
- **Complete Data Export**: Includes all sessions, analysis summaries, chart data, cost analysis, and metadata
- **Secure Export**: API keys and sensitive data are excluded from export files
- **Auto-Generated Filenames**: Format: `xob-cat-analysis-YYYY-MM-DDTHH-MM-SS.json`

**Report Viewer Interface** (`/report-viewer`):
- **Standalone Layout**: Minimal header without sidebar or main navigation
- **File Upload**: Drag-and-drop interface with "Choose File" button
- **File Validation**: Client-side validation with comprehensive error handling
- **Version Compatibility**: Automatic version checking with clear error messages for unsupported files
- **Navigation Integration**: "Go to XOBCAT" link to main application

**Report Display** (`/report-viewer/view`):
- **Complete Report Rendering**: Reuses `AnalysisReportView` component with custom navigation behavior
- **Report Metadata**: Shows export timestamp, analysis period, and session count
- **Interactive Features**: All charts, filters, and session exploration remain fully functional
- **Custom Navigation**: "Start New Analysis" redirects to main app home page (credentials)
- **Session Management**: Data stored in sessionStorage, cleared on navigation

**Version Management**:
- **Semantic Versioning**: Major.Minor.Patch format (currently v1.0.0)
- **Backward Compatibility**: Minor version updates remain compatible
- **Feature Flags**: Required and optional features tracked in metadata
- **Error Handling**: Clear messages for version mismatches, missing features, or corrupted files
- **Future-Proofing**: Schema designed for extensibility with new chart types and analysis features

**File Structure** (v1.0.0):
```json
{
  "metadata": {
    "version": "1.0.0",
    "schemaVersion": "1.0",
    "exportedAt": "ISO-8601-timestamp",
    "exportedBy": "XOB-CAT-1.0.0",
    "requiredFeatures": ["basic-charts", "session-analysis"],
    "optionalFeatures": ["advanced-charts", "ai-summary"]
  },
  "analysisConfig": { /* Analysis configuration */ },
  "sessions": [ /* Complete session data with facts */ ],
  "summary": { /* AI-generated summaries and statistics */ },
  "chartData": { /* Pre-calculated chart data */ },
  "costAnalysis": { /* Token usage and cost information */ }
}
```

**API Endpoints**:
- `GET /api/analysis/auto-analyze/export/{analysisId}`: Download analysis report as JSON file
- File validation and version checking handled client-side for security and performance

**Security & Validation**:
- **Client-Side Validation**: File structure and version validation in browser
- **Size Limits**: Maximum 50MB file size with warnings at 80% threshold
- **Content Sanitization**: All rendered content properly escaped
- **No Server Upload**: Files processed entirely in browser for security

### Share Report Feature

The Share Report feature enables users to share analysis results with stakeholders who don't have direct access to the XOBCAT application. This feature provides a streamlined two-step workflow for easy report distribution and viewing.

**Access & Integration**:
- **Share Report Button**: Available on analysis report pages when `analysisId` is present
- **Button Location**: Appears alongside other action buttons (Download Report Data, Start New Analysis) in the report header
- **Visual Design**: Secondary button with Share icon from Lucide React library

**Two-Step Sharing Workflow**:

**Step 1 - Download Report Data**:
- Users first download the analysis report as a versioned JSON file using the existing export API
- The download includes all session data, AI analysis results, chart data, and metadata
- Files use auto-generated names: `xob-cat-analysis-YYYY-MM-DDTHH-MM-SS.json`
- Visual download progress indicator with loading animation
- Success confirmation with green checkmark and status message
- The "Next" button remains disabled until download completes successfully
- Error handling for failed downloads with user-friendly error messages

**Step 2 - Share Report Viewer Link**:
- After successful download, users can share the report viewer URL
- Default URL: `https://www.koreai-xobcat.com/report-viewer` (configurable via `NEXT_PUBLIC_REPORT_VIEWER_URL`)
- Copy to clipboard functionality with visual success feedback (changes to green checkmark for 2 seconds)
- "Open Report Viewer" button opens the viewer in a new tab for immediate testing
- Users can navigate back to Step 1 if needed using the "Back" button

**Technical Implementation**:
- **ShareReportModal Component**: Complete two-step modal built with shadcn/ui Dialog components
- **State Management**: Uses React hooks (useState, useEffect) for step progression, download status, and clipboard operations
- **Environment Configuration**: Report viewer URL configurable via `NEXT_PUBLIC_REPORT_VIEWER_URL` environment variable
- **API Integration**: Reuses existing download logic from AnalysisReportView component and `/api/analysis/auto-analyze/export/{analysisId}` endpoint
- **Error Handling**: Graceful handling of download failures, missing analysis IDs, clipboard API errors, and network issues
- **State Reset**: Modal automatically resets to Step 1 when reopened with clean state for all UI elements

**User Experience Features**:
- **Progressive UI**: Step counter shows "Step 1 of 2" and "Step 2 of 2"
- **Context-Aware Buttons**: Button states change based on completion status (disabled/enabled, loading states)
- **Visual Feedback**: Loading spinners, success checkmarks, and status messages provide clear user feedback
- **Accessibility**: Full ARIA support, keyboard navigation, focus management, and screen reader compatibility
- **Responsive Design**: Modal adapts to different screen sizes with proper spacing and layout

**Usage Flow**:
1. User completes an analysis and views the report page
2. Clicks "Share Report" button in the report header actions area
3. Modal opens to Step 1 with download instructions and button
4. User clicks "Download Report Data" and waits for completion
5. Upon successful download, "Next" button becomes enabled
6. User clicks "Next" to proceed to Step 2
7. User copies the report viewer URL or opens it in a new tab
8. User shares the URL with stakeholders who can then upload the downloaded file

**Testing Coverage**:
- **Comprehensive Test Suite**: Full test coverage for modal visibility, two-step workflow, and state management
- **Download Functionality**: Tests for successful downloads, error handling, and progress tracking
- **Clipboard Operations**: Tests for copy functionality, success feedback, and error handling
- **Navigation Flow**: Tests for step progression, back navigation, and modal state reset
- **Accessibility Testing**: ARIA labels, focus management, and keyboard navigation
- **Edge Cases**: Missing analysis IDs, network failures, and malformed credentials
- **Visual Testing**: Playwright-based visual testing confirms complete workflow functionality

### Recent Analysis Report Improvements (July 2025)

The analysis overview and detailed analysis cards have been significantly enhanced with the following improvements:

#### Enhanced Formatting & UX
- **Rich Markdown Formatting**: Analysis overview now uses **bold text** for key metrics, *italics* for emphasis, and bullet points for lists to reduce cognitive load
- **Improved Readability**: Detailed analysis card padding increased (`px-8 py-6`) for better text readability with lengthy content
- **Consistent Terminology**: All references updated to use "XO bot" or "bot" terminology consistently throughout the application
- **Reduced Recommendations**: Recommendation text optimized to be ~50% more concise while maintaining clarity and actionability

#### Technical Architecture Improvements  
- **Centralized Prompt Engineering**: Created `/shared/prompts/analysis-prompts.ts` containing all analysis prompt templates for easy review and modification
- **Shared LLM Service**: Extracted common LLM inference logic into `/shared/services/llmInferenceService.ts` for consistency between main app and utility scripts
- **Type Safety**: Improved TypeScript types using `Record<string, number>` instead of index signatures for better type safety
- **Code Quality**: Centralized prose styling constants in frontend components to reduce duplication and improve maintainability

#### Testing & Quality Assurance
- **Comprehensive Test Coverage**: Added full test suites for both the shared LLM service and backend analysis service integration
- **Visual Testing Verified**: All formatting improvements confirmed through browser-based testing with mock reports
- **Backwards Compatibility**: All changes maintain existing API interfaces and functionality while adding enhancements

## 🏗️ Project Architecture

**XOBCAT** is a monorepo full-stack analytics platform for Kore.ai Expert Services teams to analyze chatbot conversations using OpenAI GPT-4o-mini.

### Tech Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + @tailwindcss/typography + shadcn/ui
- **Backend**: Node.js + Express + TypeScript (port 3001)
- **Shared**: TypeScript types in `shared/types/`
- **LLM Integration**: OpenAI GPT-4o-mini with function calling
- **Data Visualization**: Nivo library for professional, accessible, and interactive charts
- **Testing**: Jest (unit), Playwright (E2E)
- **No Database**: In-memory data only (MVP constraint)

### Workspace Structure
```
XOBCAT/
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
npm run start           # Uses scripts/dev-start.sh with health checks

# Individual services  
npm run start:frontend  # Next.js dev server (port 3000) via scripts/dev-start-frontend.sh
npm run start:backend   # Express API server (port 3001) via scripts/dev-start-backend.sh

# Server management
npm run stop            # Kill all dev servers on ports 3000 and 3001
npm run stop:frontend   # Kill frontend server only (port 3000)
npm run stop:backend    # Kill backend server only (port 3001)
npm run status          # Check health of both servers
npm run status:frontend # Check frontend server (curl localhost:3000)
npm run status:backend  # Check backend server (curl localhost:3001/health)
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
- `AnalysisResults` - Analysis workflow results including sessions and optional botId for debugging
- `AnalysisProgress` - Real-time analysis progress tracking with botId for verification
- `AnalysisExportFile` - Export file format including botId in metadata
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
NEXT_PUBLIC_ENABLE_DEV_FEATURES=true    # Enable development features (mock reports, testing tools)
```

### Development Features Configuration

The application supports conditional development features that can be enabled/disabled based on environment configuration:

**Environment Variable**: `NEXT_PUBLIC_ENABLE_DEV_FEATURES`
- **Values**: `true` | `false` | `undefined`
- **Default**: `false` (production mode)
- **Purpose**: Controls visibility of development and testing features

**Features Controlled**:
- **Mock Report Button**: Development & Testing section in Auto-Analyze page
- **Testing Tools**: Future development utilities and debugging features

**Usage**:
- **Development**: Set `NEXT_PUBLIC_ENABLE_DEV_FEATURES=true` in `.env.local`
- **Production**: Omit variable or set to `false` to hide development features
- **CI/Testing**: Set to `true` for automated testing environments

## Visual Actions: `snapshot` and `visually test`

These are shorthand commands for using Playwright MCP to interact with and analyze a web page:

- `snapshot [page]` → Use Playwright MCP to open the specified page and take a screenshot. Consider describing what you see.

- `visually test [page or feature]` → Use Playwright MCP to open the page, take a screenshot, and analyze the UI for bugs, layout issues, or UX problems. Consider describing your findings and take further action if appropriate.

These verbs may appear in instructions or conversation. When used, treat them as cues to perform these specific actions.

## Playwright MCP Usage Guidelines

You have access to Playwright MCP and should use it to visually inspect the UI when helpful. (Though be mindful of your token usage.) This includes:

- Responding to prompts that mention `snapshot` or `visually test`
- Situations where a visual understanding of a page or layout would clarify a bug, behavior, or refinement opportunity
- Cases where viewing the rendered app will help you write, evaluate, or improve front-end code

Use your judgment to decide when launching a Playwright MCP browser to capture a screenshot or inspect a page will enhance your response.

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
- **Session Outcomes**: Interactive Nivo pie chart showing containment vs transfer rates with percentages, hover effects, and color-coded legend
- **Transfer Reasons**: Nivo horizontal bar chart with Pareto analysis ranking reasons for session escalation, including cumulative impact percentages
- **Drop-off Analysis**: Nivo horizontal bar chart showing top 8 locations where users abandon sessions in the conversation flow  
- **Intent Distribution**: Nivo horizontal bar chart displaying the frequency and distribution of different user intents
- **Cost Analytics**: Comprehensive card showing token usage, model information, and detailed cost breakdown
- All charts built with Nivo library providing professional styling, accessibility features, interactive tooltips, and responsive design

When working on this codebase, always reference the shared types, follow the monorepo structure, and ensure tests pass before committing changes.