# XOB CAT (XO Bot Conversation Analysis Tools)

A full-stack web analytics platform for Kore.ai Expert Services teams to investigate and analyze production chatbot and IVA sessions built using the Kore.ai XO Platform.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key (for session analysis)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd XOB CAT
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   # Backend
   cp backend/env.example backend/.env
   # Edit backend/.env and add your OpenAI API key
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

This will start:
- **Frontend**: http://localhost:3000 (Next.js)
- **Backend**: http://localhost:3001 (Express API)

## 🏗️ Architecture

### Monorepo Structure
```
XOB CAT/
├── frontend/          # Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui
├── backend/           # Node.js + Express + TypeScript
├── shared/            # Shared TypeScript types
│   └── types/
└── package.json       # Root package.json with concurrent scripts
```

### Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- React hooks for state management

**Backend:**
- Node.js + Express
- TypeScript
- OpenAI GPT-4o-mini integration
- CORS enabled for frontend communication

**Shared:**
- TypeScript interfaces for data models
- API response types
- OpenAI function calling schemas

## 📊 Features

### MVP Features

1. **Session Management**
   - View list of bot sessions with filtering
   - Session detail view with full message transcripts
   - Navigation between sessions
   - Search and filter by date range

2. **Analysis Tools**
   - LLM integration with GPT-4o-mini
   - Structured output via function calling
   - Intent classification and outcome analysis
   - Drop-off location identification
   - Token usage monitoring

3. **Data Visualization** (Planned)
   - Pareto charts for intents and drop-offs
   - Transfer reason analysis
   - Session metrics dashboard

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only

# Building
npm run build            # Build both frontend and backend
npm run build:frontend   # Build frontend only
npm run build:backend    # Build backend only

# Testing
npm run test             # Run tests for both
npm run test:frontend    # Test frontend only
npm run test:backend     # Test backend only

# Linting
npm run lint             # Lint both frontend and backend
npm run lint:frontend    # Lint frontend only
npm run lint:backend     # Lint backend only
```

### API Endpoints

**Sessions:**
- `GET /api/sessions` - Get sessions with optional filtering
- `GET /api/sessions/:sessionId` - Get specific session details

**Analysis:**
- `POST /api/analysis/session` - Analyze a single session
- `POST /api/analysis/batch` - Analyze multiple sessions

**Health:**
- `GET /health` - Health check endpoint

### Environment Variables

**Backend (.env):**
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=your_openai_api_key_here
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 📁 Project Structure

### Frontend (`frontend/`)
```
src/
├── app/                 # Next.js App Router pages
│   ├── page.tsx        # Home page
│   ├── sessions/       # Sessions pages
│   └── layout.tsx      # Root layout
├── components/         # React components
│   └── ui/            # shadcn/ui components
├── lib/               # Utilities and API client
└── types/             # TypeScript type definitions
```

### Backend (`backend/`)
```
src/
├── index.ts           # Express server entry point
├── routes/            # API route handlers
│   ├── sessions.ts    # Session endpoints
│   └── analysis.ts    # Analysis endpoints
└── services/          # Business logic
    ├── mockDataService.ts  # Mock data generation
    └── openaiService.ts    # OpenAI integration
```

### Shared (`shared/`)
```
types/
└── index.ts           # Shared TypeScript interfaces
```

## 🔌 Integration Points

### OpenAI Integration
- Uses GPT-4o-mini for session analysis
- Function calling for structured output
- Token usage tracking and cost calculation
- Configurable prompts and analysis criteria

### Kore.ai Integration (Future)
- Session history retrieval
- Conversation transcript fetching
- Bot metadata access
- JWT authentication

## 🧪 Testing

The project includes comprehensive testing setup:

- **Frontend**: Jest + React Testing Library
- **Backend**: Jest for unit tests
- **E2E**: Playwright (planned)

## 📈 Deployment

### Development
- Frontend: `npm run dev:frontend` (http://localhost:3000)
- Backend: `npm run dev:backend` (http://localhost:3001)

### Production
- Frontend: Build and deploy to Vercel/Netlify
- Backend: Deploy to AWS Lambda/Fargate or similar

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For questions or issues:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information

---

**Built by Kore.ai Expert Services Team** 