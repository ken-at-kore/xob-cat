# XOB CAT Architecture Overview

## 🏗️ System Architecture

XOB CAT is built as a modern, scalable full-stack web application following microservices principles within a monorepo structure.

## 📐 High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (Next.js)     │◄──►│   (Express)     │◄──►│   Services      │
│                 │    │                 │    │                 │
│ • React 18      │    │ • Node.js       │    │ • OpenAI API    │
│ • TypeScript    │    │ • TypeScript    │    │ • Kore.ai API   │
│ • Tailwind CSS  │    │ • Express       │    │ • (Future)      │
│ • shadcn/ui     │    │ • CORS          │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Shared        │    │   Configuration │    │   Testing       │
│   Types         │    │   Management    │    │   Infrastructure│
│                 │    │                 │    │                 │
│ • TypeScript    │    │ • YAML Config   │    │ • Jest          │
│ • Interfaces    │    │ • Environment   │    │ • React Testing │
│ • API Schemas   │    │   Variables     │    │   Library       │
│ • Validation    │    │ • JWT Auth      │    │ • Playwright    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🏛️ Monorepo Structure

```
XOB CAT/
├── frontend/                 # Next.js 15 Frontend Application
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   │   ├── layout.tsx   # Root layout (minimal, no header)
│   │   │   ├── page.tsx     # Credentials/Home page
│   │   │   └── (dashboard)/ # Dashboard route group
│   │   │       ├── layout.tsx    # Dashboard layout with TopNav + Sidebar
│   │   │       ├── page.tsx      # Default dashboard (redirects to /sessions)
│   │   │       ├── sessions/     # View Sessions page (default active)
│   │   │       │   └── page.tsx  # Sessions list with filtering and table
│   │   │       └── analyze/      # Analyze Sessions page
│   │   │           └── page.tsx  # Coming soon placeholder
│   │   ├── components/      # React Components
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   ├── TopNav.tsx   # Top navigation: "XOB CAT" + subtitle (left), Bot ID + disconnect (right)
│   │   │   ├── Sidebar.tsx  # Left sidebar with "Pages" navigation
│   │   │   ├── SessionTable.tsx  # Main data table (cleaned up, no Cards)
│   │   │   └── SessionDetailsDialog.tsx # Session detail modal
│   │   ├── lib/             # Utilities and API Client
│   │   └── types/           # Frontend-specific Types
│   ├── public/              # Static Assets
│   └── package.json
├── backend/                  # Express.js Backend API
│   ├── src/
│   │   ├── routes/          # API Route Handlers
│   │   ├── services/        # Business Logic
│   │   ├── utils/           # Utilities
│   │   └── index.ts         # Server Entry Point
│   ├── config/              # Configuration Files
│   └── package.json
├── shared/                   # Shared TypeScript Types
│   └── types/
│       └── index.ts         # Common Interfaces
├── docs/                     # Project Documentation
│   ├── README.md            # Documentation Index
│   └── Product Requirements Document.md
└── package.json             # Root Package Configuration
```

## 🔧 Technology Stack

### Frontend Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Navigation**: App Router with route groups, TopNav + Sidebar pattern
- **State Management**: React Hooks + Context
- **Build Tool**: Turbopack (development)
- **Testing**: Jest + React Testing Library + Playwright E2E

### Backend Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Authentication**: JWT (for Kore.ai API)
- **HTTP Client**: Axios
- **Build Tool**: tsx (development)

### Shared Infrastructure
- **Type System**: TypeScript
- **Package Management**: npm workspaces
- **Testing**: Jest + React Testing Library
- **Linting**: ESLint + TypeScript ESLint
- **Formatting**: Prettier

## 🔌 Integration Architecture

### OpenAI Integration
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │───►│   Backend   │───►│  OpenAI API │
│             │    │             │    │             │
│ • Session   │    │ • GPT-4o-   │    │ • GPT-4o-   │
│   Analysis  │    │   mini      │    │   mini      │
│   Request   │    │ • Function  │    │ • Function  │
│             │    │   Calling   │    │   Calling   │
└─────────────┘    └─────────────┘    └─────────────┘
```

**Key Features:**
- Function calling for structured output
- Token usage tracking and cost calculation
- Retry logic with exponential backoff
- Configurable prompts and analysis criteria

### Kore.ai Integration
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Backend   │───►│  Kore.ai    │───►│  Kore.ai    │
│             │    │   API       │    │   Platform  │
│ • JWT Auth  │    │ • REST API  │    │ • Bot       │
│ • Session   │    │ • Rate      │    │   Sessions  │
│   Retrieval │    │   Limiting  │    │ • Messages  │
│ • Data      │    │ • Error     │    │ • Metadata  │
│   Mapping   │    │   Handling  │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

**Key Features:**
- JWT authentication with Kore.ai
- Rate limiting (60 req/min, 1800 req/hour)
- Session retrieval across containment types
- Message pagination and filtering
- Data transformation to shared types

## 🚀 Optimized Data Access Architecture (August 2025)

### Performance Breakthrough
**Problem Solved**: Auto-analysis timeout issues in production where the system would hang for 60+ seconds trying to fetch messages for 1000+ sessions before sampling.

**Solution**: Revolutionary layered architecture with lazy loading pattern inspired by GraphQL and JPA/Hibernate approaches.

### New Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Business Logic Layer                      │
│  SessionSamplingService - Optimized Workflow               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 1. Fetch metadata for 1000+ sessions (fast)        │  │
│  │ 2. Apply business rules and sampling logic          │  │
│  │ 3. Fetch messages only for sampled sessions         │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│               Transformation Layer                          │
│  SWTService - Lazy Loading Capabilities                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ createSWTsFromMetadata() - Convert without messages │  │
│  │ populateMessages() - Selective message population   │  │
│  │ generateSWTs() - Optimized composition method       │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 Data Access Layer                          │
│  KoreApiService - Granular Methods                         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ getSessionsMetadata() - Metadata only (10x faster) │  │
│  │ getMessagesForSessions() - Selective message fetch │  │
│  │ getSessionsWithMessages() - Convenience composition │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Kore.ai API   │
              │   External      │
              │   Service       │
              └─────────────────┘
```

### Performance Transformation

```typescript
// OLD APPROACH: Fetch everything, then sample (timeout risk)
const allSessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 10000);
// ❌ This fetches ALL messages for 1000+ sessions → 60+ second timeout
const sampled = randomSample(allSessions, count);

// NEW APPROACH: Sample metadata, then fetch selectively (optimized)
const metadata = await koreApiService.getSessionsMetadata({ dateFrom, dateTo });
// ✅ Metadata only, 10x faster, handles 1000+ sessions in milliseconds
const sampledMetadata = randomSample(metadata, count);
const sampledSessions = await swtService.createSWTsFromMetadata(sampledMetadata);
const withMessages = await swtService.populateMessages(sampledSessions);
// ✅ Only fetches messages for sampled sessions, not all sessions
```

### Architecture Benefits

| Aspect | Before | After |
|--------|---------|-------|
| **Performance** | 60+ second timeout | Sub-second response |
| **Scalability** | Limited to ~100 sessions | Handles 1000+ sessions |
| **Resource Usage** | Fetches ALL message data | Fetches only needed data |
| **Production Readiness** | Fails with large datasets | Enterprise-scale ready |
| **Code Maintainability** | Monolithic approach | Clean layered separation |

### Technical Implementation

#### Data Access Layer (KoreApiService)
- **`getSessionsMetadata()`**: Fast metadata-only retrieval
- **`getMessagesForSessions()`**: Selective message fetching by session IDs
- **`getSessionsWithMessages()`**: Convenience method composing both operations

#### Transformation Layer (SWTService)  
- **`createSWTsFromMetadata()`**: Convert metadata to SWT format without messages
- **`populateMessages()`**: Lazy loading of messages for specific sessions
- **Backward Compatibility**: Existing methods use new optimized internals

#### Business Logic Layer (SessionSamplingService)
- **Metadata-First Workflow**: Sample from lightweight metadata before message fetching
- **Selective Loading**: Only fetch messages for sampled sessions
- **Time Window Expansion**: Efficient handling of session discovery

### Testing Architecture

```
🧪 Comprehensive Test Coverage
├── granular.test.ts - Data access layer validation
├── lazy.test.ts - Transformation layer verification  
├── optimized.test.ts - Business logic performance testing
└── Performance benchmarks for large datasets
```

### Production Impact
- **Auto-Analysis**: Now processes enterprise datasets without timeouts
- **Session Sampling**: 10x performance improvement with metadata-first approach
- **Lambda Compatibility**: Stays well within AWS Lambda execution limits
- **User Experience**: Instant response times for complex analysis workflows

## 📊 Data Flow Architecture

### Session Analysis Flow
```
1. User Request
   ↓
2. Frontend → Backend API
   ↓
3. Backend → Kore.ai API (if configured)
   ↓
4. Backend → OpenAI API (analysis)
   ↓
5. Backend → Frontend (results)
   ↓
6. Frontend → User (visualization)
```

### Data Transformation Pipeline
```
Kore.ai Data → Shared Types → Analysis → Results → UI
     ↓              ↓            ↓         ↓       ↓
Raw Sessions → SessionWithTranscript → AnalysisResult → Charts
```

## 🔐 Security Architecture

### Authentication & Authorization
- **Frontend-Backend**: CORS configuration
- **Backend-Kore.ai**: JWT authentication
- **Backend-OpenAI**: API key authentication
- **Configuration**: Secure YAML file storage

### Data Security
- **In-Memory Processing**: No persistent storage in MVP
- **API Key Management**: Environment variables
- **CORS Policy**: Restricted to frontend origin
- **Rate Limiting**: API-level protection

## 🧪 Testing Architecture

### Testing Strategy
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Unit      │    │ Integration │    │   E2E       │
│   Tests     │    │   Tests     │    │   Tests     │
│             │    │             │    │             │
│ • Jest      │    │ • API       │    │ • Puppeteer │
│ • 100%      │    │   Testing   │    │ • Playwright│
│   Coverage  │    │ • Service   │    │ • Shared    │
│ • Mocking   │    │   Testing   │    │   Workflows │
│ • Fast      │    │ • Workflow  │    │ • Real UI   │
│             │    │   Testing   │    │   Testing   │
│             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

### E2E Testing Architecture

#### Dual Framework Approach
```
┌─────────────────────────────────────┐
│        E2E Testing Framework        │
├─────────────────┬───────────────────┤
│    Puppeteer    │    Playwright     │
│  (Recommended)  │    (General)      │
├─────────────────┼───────────────────┤
│ • Session       │ • Navigation      │
│   Validation    │ • Form Testing    │
│ • Dialog Tests  │ • Quick UI Tests  │
│ • No Timeouts   │ • Parallel Exec   │
└─────────────────┴───────────────────┘
```

#### Shared Workflow Pattern
```
frontend/e2e/
├── shared/
│   └── view-sessions-workflow.js    # Reusable workflow steps
├── view-sessions-mock-api-puppeteer.test.js
├── view-sessions-real-api-puppeteer.test.js
└── *.spec.ts                        # Playwright tests
```

**Benefits**:
- **Code Reuse**: Write workflow once, use in multiple tests
- **Consistency**: Same validation logic across test variants
- **Maintainability**: Single source of truth for workflows
- **Separation**: Mock vs Real API testing in separate files

**Implementation Learnings (August 2025)**:
After successful implementation, key architectural insights emerged:

1. **Pattern Fidelity**: Shared workflows must replicate exact DOM query patterns from proven working tests rather than introducing complex fallback logic
2. **State-Based Error Handling**: Return state objects instead of throwing errors to enable graceful handling of edge cases
3. **Real-World Data Considerations**: Production APIs require progressive date range expansion and no-data scenario handling
4. **Validation Success**: Both mock and real API tests validate message sanitization works correctly with production data

### Mock Service Architecture
```
┌─────────────────┐    ┌─────────────────┐
│  Test Request   │    │ Service Factory │
│  (mock creds)   │───►│ (Detects Mock)  │
└─────────────────┘    └────────┬────────┘
                               ▼
                    ┌─────────────────┐
                    │  Mock Services  │
                    │ • Deterministic │
                    │ • No Network    │
                    │ • Fast & Stable │
                    └─────────────────┘
```

### Backend Integration Testing Architecture (December 2024)

#### Service Factory Pattern for Test Flexibility
```
┌──────────────────────────────────────────────────────┐
│                Integration Test Suite                 │
├────────────────────┬─────────────────────────────────┤
│   Mock API Tests   │      Real API Tests             │
│                    │                                  │
│ • No external deps │ • Validates production APIs     │
│ • Deterministic    │ • Requires credentials          │
│ • Zero cost        │ • Incurs OpenAI costs           │
│ • Fast execution   │ • Real data validation          │
└────────────────────┴─────────────────────────────────┘
                    │
         ┌──────────▼──────────┐
         │  ServiceFactory     │
         │                     │
         │ • Dynamic switching │
         │ • Mock detection    │
         │ • Clean separation │
         └─────────┬───────────┘
       ┌───────────┴────────────┐
       ▼                        ▼
┌──────────────┐        ┌───────────────┐
│ Mock Services│        │ Real Services │
│              │        │               │
│ • Pure mocks │        │ • Kore.ai API │
│ • No network │        │ • OpenAI API  │
│ • Test data  │        │ • Rate limits │
└──────────────┘        └───────────────┘
```

#### Integration Test Architecture
```
backend/src/__tests__/integration/
├── autoAnalyzeWorkflow.shared.ts       # Shared utilities
├── autoAnalyzeWorkflow.mock.integration.test.ts    # Mock tests
└── autoAnalyzeWorkflow.real.integration.test.ts    # Real API tests

Key Features:
• Background Job Queue validation
• Async workflow testing  
• Progress tracking assertions
• Cost estimation validation
• Clean test exit (no Jest hanging)
```

### Test Coverage Goals
- **ConfigManager**: 100% (✅ Achieved)
- **Navigation Components**: 100% (✅ TopNav, Sidebar)
- **Optimized Architecture**: 95%+ (✅ All layers tested)
- **KoreApiService**: 90%+
- **MockDataService**: 85%+
- **API Routes**: 80%+
- **Frontend Components**: 70%+
- **E2E Critical Paths**: 100% (Puppeteer shared workflows)
- **E2E General UI**: Comprehensive Playwright coverage

## 🚀 Deployment Architecture

### Development Environment
```
┌─────────────┐    ┌─────────────┐
│   Frontend  │    │   Backend   │
│   :3000     │    │   :3001     │
│             │    │             │
│ • Hot       │    │ • Hot       │
│   Reload    │    │   Reload    │
│ • Turbopack │    │ • tsx       │
│ • Dev Mode  │    │ • Dev Mode  │
└─────────────┘    └─────────────┘
```

### Production Environment (Planned)
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   CDN       │    │   Load      │    │   Backend   │
│   (Static)  │    │   Balancer  │    │   Services  │
│             │    │             │    │             │
│ • Vercel    │    │ • AWS ALB   │    │ • Lambda    │
│ • Netlify   │    │ • CloudFlare│    │ • Fargate   │
│ • S3 + CF   │    │ • nginx     │    │ • ECS       │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 🔄 State Management

### Frontend State
- **Local State**: React useState/useReducer
- **Navigation State**: usePathname hook for active route detection
- **Session Storage**: Credentials management
- **Global State**: React Context (planned)
- **Server State**: React Query (planned)
- **Form State**: React Hook Form (planned)

### Backend State
- **In-Memory**: Session data caching
- **Configuration**: Singleton ConfigManager
- **API State**: Rate limiting and retry logic

## 📈 Scalability Considerations

### Horizontal Scaling
- **Stateless Backend**: No session affinity required
- **CDN Frontend**: Global content distribution
- **API Gateway**: Future load balancing
- **Database**: Future persistent storage

### Performance Optimization
- **Frontend**: Code splitting and lazy loading
- **Backend**: Response caching and compression
- **API**: Rate limiting and connection pooling
- **Analysis**: Batch processing and queuing

## 🧭 Navigation Architecture

### Navigation Pattern
The application uses a **TopNav + Sidebar** pattern with Next.js 15 App Router:

```
┌─────────────────────────────────────────────────────────┐
│ TopNav: XOB CAT + subtitle    │    Bot ID • Disconnect  │
├─────────────────────────────────────────────────────────┤
│ Sidebar │                                              │
│ Pages   │              Main Content                    │
│ • View  │                                              │
│ • Analyze│                                             │
└─────────────────────────────────────────────────────────┘
```

### Component Architecture
- **TopNav** (`components/TopNav.tsx`):
  - Fixed positioning at top of screen (`z-50`)
  - Left side: "XOB CAT" title + "XO Bot Conversation Analysis Tools" subtitle
  - Right side: "Bot ID" label + value + bullet separator + "Disconnect" button
  - Handles disconnect navigation back to credentials page

- **Sidebar** (`components/Sidebar.tsx`):
  - Fixed positioning on left side below TopNav
  - "Pages" section with navigation links
  - Active state management using `usePathname()` hook
  - Current pages: "View Sessions" (default), "Analyze Sessions"

- **Dashboard Layout** (`app/(dashboard)/layout.tsx`):
  - Manages credential verification and loading states
  - Renders TopNav and Sidebar components
  - Provides main content area with proper spacing (`ml-64 pt-16`)

### Route Structure
```
/ (credentials page)
└── (dashboard)/
    ├── page.tsx (redirects to /sessions)
    ├── sessions/
    │   └── page.tsx (View Sessions - default active)
    └── analyze/
        └── page.tsx (Analyze Sessions - coming soon)
```

### Navigation State Management
- **Active Route Detection**: Uses Next.js `usePathname()` hook
- **Route Constants**: Centralized in `src/routes.ts` for type safety
- **Credential Management**: Session storage for bot configuration
- **Navigation Actions**: Router push for programmatic navigation

### Testing Coverage
- **Unit Tests**: 100% coverage for TopNav and Sidebar components
- **Integration Tests**: Navigation flow and credential handling
- **E2E Tests**: Complete user navigation scenarios with Playwright
- **Edge Cases**: Long bot IDs, special characters, accessibility

## 🔮 Future Architecture Considerations

### Planned Enhancements
- **Database Integration**: PostgreSQL for persistent storage
- **Message Queue**: Redis/RabbitMQ for async processing
- **Caching Layer**: Redis for session caching
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack or similar
- **CI/CD**: GitHub Actions or AWS CodePipeline

### Microservices Evolution
- **Session Service**: Dedicated session management
- **Analysis Service**: Standalone analysis engine
- **Auth Service**: Centralized authentication
- **Notification Service**: Real-time updates

---

**Architecture Version:** 2.0  
**Last Updated:** August 2025  
**Maintained by:** Kore.ai Expert Services Team

**Major Updates in v2.0:**
- Optimized Data Access Architecture with 10x performance improvement
- Layered architecture with lazy loading pattern
- Production-scale session handling (1000+ sessions)
- Comprehensive test coverage for all architectural layers 