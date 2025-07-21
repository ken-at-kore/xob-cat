# Testing Guide for XOB CAT Frontend

This document provides a comprehensive guide to testing the XOB CAT frontend application, including unit tests, integration tests, and end-to-end (E2E) tests.

## Test Structure

```
frontend/
├── e2e/                          # End-to-end tests (Playwright)
│   ├── auth-flow.spec.ts         # Authentication flow tests
│   ├── sessions-page.spec.ts     # Sessions page functionality tests
│   └── complete-user-journey.spec.ts # Complete user journey tests
├── src/
│   ├── app/
│   │   ├── __tests__/
│   │   │   └── page.test.tsx     # Home page unit tests
│   │   └── (dashboard)/
│   │       └── sessions/
│   │           └── __tests__/
│   │               └── page.test.tsx # Sessions page unit tests
│   ├── components/
│   │   └── __tests__/
│   │       └── SessionTable.test.tsx # SessionTable component tests
│   └── lib/
│       └── __tests__/
│           └── api.test.ts       # API client tests
├── jest.config.js                # Jest configuration
├── jest.setup.js                 # Jest setup and mocks
└── playwright.config.ts          # Playwright configuration
```

## Test Types

### 1. Unit Tests (Jest + React Testing Library)

Unit tests focus on testing individual components and functions in isolation.

**Coverage:**
- Component rendering and behavior
- API client functions
- Utility functions
- State management
- User interactions

**Key Features:**
- Mocked dependencies
- Isolated component testing
- Fast execution
- Detailed assertions

### 2. End-to-End Tests (Playwright)

E2E tests simulate real user interactions across the entire application.

**Coverage:**
- Complete user journeys
- Cross-browser compatibility
- Real API interactions (mocked)
- UI/UX validation
- Error handling scenarios

**Key Features:**
- Real browser automation
- Network request mocking
- Visual regression testing
- Cross-browser testing

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- SessionTable.test.tsx
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (visible browser)
npm run test:e2e:headed

# Run specific E2E test file
npx playwright test auth-flow.spec.ts
```

### All Tests

```bash
# Run both unit and E2E tests
npm run test:all
```

## Test Scenarios

### Authentication Flow

**Unit Tests:**
- Form validation
- API call handling
- Error state management
- Loading states

**E2E Tests:**
- Complete login flow
- Error handling
- Redirect behavior
- Session storage

### Sessions Page

**Unit Tests:**
- Data loading
- Error handling
- Empty states
- Component rendering

**E2E Tests:**
- Session data display
- Refresh functionality
- Error recovery
- Table interactions

### API Client

**Unit Tests:**
- HTTP request formatting
- Response handling
- Error scenarios
- Parameter validation

## Mocking Strategy

### API Mocking

**Unit Tests:**
```typescript
// Mock API client
jest.mock('../../lib/api', () => ({
  apiClient: {
    getSessions: jest.fn(),
    healthCheck: jest.fn(),
  },
}))
```

**E2E Tests:**
```typescript
// Mock network requests
await page.route('http://localhost:3001/api/analysis/sessions**', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockData)
  });
});
```

### Browser APIs

```typescript
// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
})
```

## Test Data

### Mock Sessions

```typescript
const mockSessions = [
  {
    session_id: 'session_123',
    user_id: 'user_456',
    start_time: '2025-07-21T10:00:00.000Z',
    end_time: '2025-07-21T10:05:00.000Z',
    containment_type: 'selfService',
    tags: ['Claim Status', 'Contained'],
    metrics: {
      total_messages: 8,
      user_messages: 4,
      bot_messages: 4
    },
    messages: [
      {
        timestamp: '2025-07-21T10:00:00.000Z',
        message_type: 'user',
        message: 'I need to check the status of my claim'
      }
    ],
    duration_seconds: 300,
    message_count: 8,
    user_message_count: 4,
    bot_message_count: 4
  }
]
```

## Best Practices

### Unit Tests

1. **Test Behavior, Not Implementation**
   - Focus on what the component does, not how it does it
   - Test user interactions and outcomes

2. **Use Descriptive Test Names**
   ```typescript
   it('should display error message when API call fails', async () => {
     // test implementation
   })
   ```

3. **Arrange-Act-Assert Pattern**
   ```typescript
   it('should load sessions successfully', async () => {
     // Arrange
     const mockData = { /* ... */ }
     apiClient.getSessions.mockResolvedValue(mockData)
     
     // Act
     render(<SessionsPage />)
     
     // Assert
     await waitFor(() => {
       expect(screen.getByText('Sessions')).toBeInTheDocument()
     })
   })
   ```

4. **Mock External Dependencies**
   - Always mock API calls, browser APIs, and external services
   - Use consistent mock data across tests

### E2E Tests

1. **Test Complete User Journeys**
   - Start from the beginning of a user flow
   - Test the entire path to completion

2. **Use Realistic Data**
   - Mock API responses with realistic data
   - Test edge cases and error scenarios

3. **Test Cross-Browser Compatibility**
   - Run tests in multiple browsers
   - Ensure consistent behavior

4. **Handle Asynchronous Operations**
   - Use proper waiting strategies
   - Avoid hard-coded timeouts

## Debugging Tests

### Unit Tests

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test with debugging
npm test -- --testNamePattern="should display error message"
```

### E2E Tests

```bash
# Run tests in headed mode for visual debugging
npm run test:e2e:headed

# Run tests with UI for step-by-step debugging
npm run test:e2e:ui

# Generate test report
npx playwright show-report
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:all
```

## Coverage Goals

- **Unit Tests**: >90% line coverage
- **E2E Tests**: Cover all critical user paths
- **Integration Tests**: Test component interactions

## Common Issues and Solutions

### 1. Async Test Failures

**Problem:** Tests failing due to timing issues
**Solution:** Use `waitFor` and proper async/await patterns

```typescript
await waitFor(() => {
  expect(screen.getByText('Sessions')).toBeInTheDocument()
})
```

### 2. Mock Not Working

**Problem:** Mocks not being applied correctly
**Solution:** Ensure mocks are set up before component rendering

```typescript
beforeEach(() => {
  jest.clearAllMocks()
  apiClient.getSessions.mockResolvedValue(mockData)
})
```

### 3. E2E Test Flakiness

**Problem:** Tests failing intermittently
**Solution:** Use proper waiting strategies and avoid race conditions

```typescript
// Wait for element to be visible
await expect(page.getByText('Sessions')).toBeVisible()

// Wait for network request to complete
await page.waitForResponse(response => 
  response.url().includes('/api/analysis/sessions')
)
```

## Contributing

When adding new features:

1. Write unit tests for new components
2. Add E2E tests for new user flows
3. Update this documentation
4. Ensure all tests pass before merging

## Resources

- [React Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) 