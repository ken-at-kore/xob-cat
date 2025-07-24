# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🏗️ Project Architecture

**XOB CAT** is a monorepo full-stack analytics platform for Kore.ai Expert Services teams to analyze chatbot conversations using OpenAI GPT-4o-mini.

### Tech Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript (port 3001)
- **Shared**: TypeScript types in `shared/types/`
- **LLM Integration**: OpenAI GPT-4o-mini with function calling
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
- **Component Tests**: React Testing Library for UI components
- **API Tests**: Frontend API client testing
- **E2E Tests**: Playwright for full user workflows

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

### Data Visualization (Planned)
- Pareto charts for intent/drop-off frequency using nivo charts
- Transfer reason analysis dashboards
- Session metrics visualization

When working on this codebase, always reference the shared types, follow the monorepo structure, and ensure tests pass before committing changes.