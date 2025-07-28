# XOB CAT (XO Bot Conversation Analysis Tools)

## Overview / Purpose

XOB CAT is a full-stack web analytics platform designed for Kore.ai Expert Services teams to investigate and analyze production chatbot and IVA sessions built using the Kore.ai XO Platform. The platform provides structured conversation analysis, AI-powered insights, and actionable intelligence for bot optimization.

**Product Vision**: To become the definitive analytics platform for Kore.ai Expert Services teams, enabling data-driven bot optimization and improved client satisfaction through comprehensive conversation analysis and AI-enhanced insight generation.

**Key Capabilities**:
- Session management with filtering and detailed transcript views
- AI-powered conversation analysis using OpenAI GPT-4o-mini
- Intent classification, outcome analysis, and drop-off identification
- Token usage tracking and cost monitoring
- Real-time integration with Kore.ai XO Platform APIs

📋 **[Complete Product Requirements Document](./docs/Product%20Requirements%20Document.md)** - Detailed feature specifications and user stories

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- OpenAI API key (required for session analysis)

### Setup Steps

1. **Clone and navigate to the repository**
   ```bash
   git clone <repository-url>
   cd "XOB CAT"
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure environment variables**
   ```bash
   # Backend configuration
   cp backend/env.example backend/.env
   # Edit backend/.env and add your OpenAI API key:
   # OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Start development servers**
   ```bash
   npm run start
   ```

This starts both services concurrently:
- **Frontend**: http://localhost:3000 (Next.js)
- **Backend**: http://localhost:3001 (Express API)

### Environment Configuration

**Backend (.env)**:
```env
OPENAI_API_KEY=your_openai_api_key_here  # Required for AI analysis
PORT=3001                                # API server port
NODE_ENV=development                     # Environment
FRONTEND_URL=http://localhost:3000       # CORS origin
```

**Frontend (.env.local)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Core Concepts

### Architecture Overview
XOB CAT is a TypeScript monorepo with three main components:

- **Frontend**: Next.js 15 with App Router, Tailwind CSS, and shadcn/ui components
- **Backend**: Express.js API server with OpenAI integration and Kore.ai connectivity  
- **Shared**: Common TypeScript types and schemas shared between frontend and backend

### Data Flow
1. **Session Data**: Retrieved from Kore.ai APIs or loaded from sanitized test data
2. **AI Analysis**: Sessions processed through OpenAI GPT-4o-mini using function calling
3. **Structured Output**: Analysis results formatted as JSON with intent, outcome, and transfer reasons
4. **Frontend Display**: Results presented in filterable tables and detailed session views

### Key Data Types
- **SessionWithTranscript**: Core session data with messages and metadata
- **AnalysisResult**: AI analysis output with intent classification and outcomes
- **Message**: Individual conversation messages with timestamps and types
- **ANALYSIS_FUNCTION_SCHEMA**: OpenAI function calling schema for structured analysis

## Usage (with working examples)

### Development Workflow

```bash
# Start both frontend and backend
npm run start

# Stop servers
npm run stop               # Stop both servers
npm run stop:frontend      # Stop frontend only
npm run stop:backend       # Stop backend only

# Run tests
npm run test                    # All tests
npm run test:backend           # Backend unit tests
npm run test:e2e              # Playwright E2E tests

# Build for production
npm run build

# Lint code
npm run lint
```

### Data Collection

```bash
# Collect production data for testing
npm run collect-data

# Historical data collection
npx tsx scripts/collect-july-6-13-full-range.ts
```

### API Usage Examples

**Get sessions with filtering**:
```bash
curl "http://localhost:3001/api/analysis/sessions?start_date=2024-07-01&limit=10"
```

**Analyze a session**:
```bash
curl -X POST http://localhost:3001/api/analysis/session \
  -H "Content-Type: application/json" \
  -d '{"session_id": "abc123", "messages": [...]}'
```

**Health check**:
```bash
curl http://localhost:3001/health
```

## API Overview or Key Components

### API Routes

**Analysis Routes** (`/api/analysis/*`):
- `GET /api/analysis/sessions` - Retrieve sessions with optional filtering
- `GET /api/analysis/sessions/:id` - Get specific session details
- `POST /api/analysis/session` - Analyze single session with OpenAI
- `POST /api/analysis/batch` - Batch analyze multiple sessions

**Kore.ai Integration** (`/api/kore/*`):
- Session history retrieval with JWT authentication
- Rate-limited API calls (60/min, 1800/hour)
- Message and transcript fetching

**Health Check**:
- `GET /health` - Service health and status information

### Key Backend Services

- **openaiService.ts**: GPT-4o-mini integration with function calling and cost tracking
- **koreApiService.ts**: Kore.ai API client with JWT auth and rate limiting
- **mockDataService.ts**: Test data generation for development
- **swtService.ts**: Session analysis business logic

### Frontend Components

- **SessionTable**: Main data table with filtering and pagination
- **SessionDetailsDialog**: Modal for detailed session transcript view
- **ErrorBoundary**: Global error handling wrapper
- **ui/**: shadcn/ui component library (Button, Card, Dialog, etc.)

## Integration or Deployment Notes

### Development Integration
- **Monorepo Structure**: Uses npm workspaces for dependency management
- **Concurrent Development**: Frontend and backend run simultaneously via `concurrently`
- **Shared Types**: TypeScript interfaces ensure type safety across services
- **Hot Reload**: Next.js and tsx provide instant development feedback

### Testing Integration
- **Unit Tests**: Jest for both frontend (React Testing Library) and backend
- **Integration Tests**: Real API workflow testing with hybrid mock/live data
- **E2E Tests**: Playwright for full user journey testing
- **Test Data**: Sanitized production data in `data/` folder for realistic testing

### Deployment Considerations
- **Environment Variables**: Ensure OpenAI API key is configured in production
- **CORS Configuration**: Update `FRONTEND_URL` for production domain
- **Build Process**: Both frontend and backend require separate build steps
- **Dependencies**: Node.js 18+ required for both services

**Production Deployment Options**:
- Frontend: Vercel, Netlify, or static hosting
- Backend: AWS Lambda, Fargate, or containerized deployment

## Troubleshooting & Contributing

### Common Issues

**Development Server Won't Start**:
- Check Node.js version (18+ required)
- Verify all dependencies installed: `npm run install:all`
- Ensure ports 3000 and 3001 are available

**OpenAI Analysis Failing**:
- Verify `OPENAI_API_KEY` is set in `backend/.env`
- Check API key has sufficient credits and permissions
- Review backend logs for specific error messages

**Tests Failing**:
- Run `npm run test:coverage` to identify uncovered code
- Check test data in `data/` folder is properly formatted
- Verify mock services are properly configured

### Development Guidelines

**Code Quality**:
- Use strict TypeScript (no `any` types)
- Follow TDD approach: write failing tests first
- Use Conventional Commits format: `<type>(scope): message`
- Run typecheck before committing
- Update `claude.md` when workflows or structure changes

**Testing Requirements**:
- Unit tests for new services and components
- Integration tests for API workflows
- E2E tests for critical user journeys
- Maintain test coverage above 80%

### Contributing Process

1. **Fork the repository** and create a feature branch
2. **Follow TDD**: Write failing tests, then implement functionality
3. **Ensure code quality**: Run `npm run lint` and fix any issues
4. **Add documentation**: Update relevant docs for new features
5. **Submit pull request** with clear description of changes

**Documentation to Update**:
- `claude.md` for new commands or architectural changes
- `docs/api-reference.md` for new API endpoints
- `README.md` for significant feature additions

### Additional Resources

- **[📖 Complete Documentation](./docs/README.md)** - All project documentation
- **[🏗️ Architecture Overview](./docs/architecture.md)** - System design and technical decisions
- **[🔧 API Reference](./docs/api-reference.md)** - Complete endpoint documentation
- **[🧪 Testing Guide](./docs/testing.md)** - Testing strategies and setup
- **[🛠️ Development Tools](tools/README.md)** - Data collection and testing utilities

---

**Built by Kore.ai Expert Services Team**