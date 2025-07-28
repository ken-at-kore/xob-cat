# XOB CAT Frontend

The frontend application for XOB CAT (XO Bot Conversation Analysis Tools) - a Next.js 15 web application for analyzing chatbot sessions.

## Overview

Built with modern React patterns and TypeScript, this frontend provides an intuitive interface for Kore.ai Expert Services teams to analyze bot sessions, view conversation transcripts, and generate AI-powered insights.

## Tech Stack

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **React Testing Library** for component testing
- **Playwright** for E2E testing

## Getting Started

### Prerequisites
- Node.js 18+
- Running backend API (see `../backend/README.md`)

### Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run start

# Open http://localhost:3000
```

### Available Scripts

```bash
npm run start        # Start Next.js development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Jest unit tests
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run Playwright E2E tests
npm run test:all     # Run all tests (unit + E2E)
```

## Project Structure

```
src/
├── app/                    # Next.js 15 App Router
│   ├── layout.tsx         # Minimal root layout (no header)
│   ├── page.tsx           # Credentials/Home page
│   └── (dashboard)/       # Dashboard route group
│       ├── layout.tsx     # Dashboard layout with TopNav + Sidebar
│       ├── page.tsx       # Default dashboard (redirects to /sessions)
│       ├── sessions/      # View Sessions page (default active)
│       │   └── page.tsx   # Sessions list with filtering and table
│       └── analyze/       # Analyze Sessions page
│           └── page.tsx   # Coming soon placeholder
├── components/            # React components
│   ├── TopNav.tsx         # Top navigation bar (app name + bot info)
│   ├── Sidebar.tsx        # Left sidebar with "Pages" navigation
│   ├── SessionTable.tsx   # Main data table (cleaned up, no Cards)
│   ├── SessionDetailsDialog.tsx  # Session detail modal
│   ├── ErrorBoundary.tsx  # Error handling
│   └── ui/                # shadcn/ui components
├── lib/                   # Utilities
│   ├── api.ts            # Type-safe API client
│   └── utils.ts          # Helper functions
└── routes.ts             # Route constants registry
```

## Key Features

### Session Management
- **SessionTable**: Filterable data table with session metadata
- **SessionDetailsDialog**: Modal for viewing full conversation transcripts
- **Filtering**: Date range, containment type, and text search

### API Integration
- **Type-safe client**: Full TypeScript integration with backend APIs
- **Error handling**: Comprehensive error states and user feedback
- **Loading states**: Skeleton loaders and loading indicators

### Testing
- **Unit tests**: Component testing with React Testing Library
- **E2E tests**: Full user journey testing with Playwright
- **Route testing**: Ensures all routes are properly configured

## Route Registry System

This project uses a central route registry (`src/routes.ts`) for type-safe navigation:

```typescript
export const ROUTES = {
  HOME: '/',
  DASHBOARD_SESSIONS: '/dashboard/sessions',
  // etc...
} as const;
```

**Benefits**:
- Single source of truth for all routes
- Type safety for navigation
- Easy refactoring when routes change
- Early detection of missing pages

### Adding New Routes
1. Add route constant to `src/routes.ts`
2. Create the page file in `src/app/`
3. Update navigation components to use the constant
4. Add route test to `__tests__/routesExist.test.ts`

## Environment Variables

Create `.env.local` for local development:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## API Communication

The frontend communicates with the Express backend via a type-safe API client:

```typescript
import { apiClient } from '@/lib/api';

// Get sessions with filtering
const sessions = await apiClient.getSessions({
  start_date: '2024-01-01',
  limit: 50
});

// Analyze a session
const analysis = await apiClient.analyzeSession(sessionId, messages);
```

## Component Architecture

### UI Components
- Uses **shadcn/ui** for consistent design system
- Custom components built on top of Radix UI primitives
- Fully accessible with keyboard navigation and screen reader support

### State Management
- React hooks for local component state
- No global state management (Redux/Zustand) - API client handles data fetching
- Server state managed through API client with proper error boundaries

### Error Handling
- **ErrorBoundary**: Global error catching for React components
- **API errors**: Typed error responses with user-friendly messages
- **Loading states**: Proper loading indicators throughout the app

## Development Guidelines

### Code Quality
- **TypeScript strict mode**: No `any` types allowed
- **ESLint**: Configured for Next.js and React best practices
- **Prettier**: Consistent code formatting
- **Import organization**: Absolute imports with `@/` prefix

### Testing Strategy
- **Unit tests**: Test component logic and rendering
- **Integration tests**: Test component interactions
- **E2E tests**: Test complete user workflows
- **Route tests**: Ensure all routes resolve correctly

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Consistent component library
- **No custom CSS**: Use Tailwind utilities exclusively
- **Responsive design**: Desktop-first with mobile considerations

## Deployment

### Build Process
```bash
npm run build    # Creates optimized production build
npm run start    # Serves production build locally
```

### Environment Setup
- Set `NEXT_PUBLIC_API_URL` to production API endpoint
- Ensure backend API is accessible from frontend domain
- Configure CORS on backend for production frontend URL

## Troubleshooting

### Common Issues

**API Connection Failed**:
- Verify backend is running on correct port
- Check `NEXT_PUBLIC_API_URL` environment variable
- Ensure CORS is configured on backend

**Build Errors**:
- Run `npm run lint` to check for TypeScript errors
- Verify all imports are correct
- Check that all referenced routes exist

**Test Failures**:
- Ensure test data is properly mocked
- Check that components render without required props
- Verify E2E tests have backend running

### Development Tips
- Use React DevTools for component debugging
- Check Network tab for API request/response details
- Use TypeScript error overlay for quick issue identification

## Contributing

1. Follow the TDD approach - write tests first
2. Use TypeScript strictly - no `any` types
3. Update route registry when adding new pages
4. Follow conventional commit format
5. Update documentation for significant changes

See the main [README.md](../README.md) for general contributing guidelines.