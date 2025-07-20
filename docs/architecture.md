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
│   │   ├── components/      # React Components
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
- **State Management**: React Hooks + Context
- **Build Tool**: Turbopack (development)

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
│ • Jest      │    │ • API       │    │ • Playwright│
│ • 100%      │    │   Testing   │    │ • User      │
│   Coverage  │    │ • Service   │    │   Flows     │
│ • Mocking   │    │   Testing   │    │ • Cross-    │
│             │    │   Browser   │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Test Coverage Goals
- **ConfigManager**: 100% (✅ Achieved)
- **KoreApiService**: 90%+
- **MockDataService**: 85%+
- **API Routes**: 80%+
- **Frontend Components**: 70%+

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

**Architecture Version:** 1.0  
**Last Updated:** July 2025  
**Maintained by:** Kore.ai Expert Services Team 