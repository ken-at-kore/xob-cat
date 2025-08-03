# XOB CAT Testing Guide

## 🧪 Testing Strategy

XOB CAT implements a comprehensive testing strategy with multiple layers to ensure code quality and reliability.

## 📊 Testing Pyramid

```
        ┌─────────────┐
        │     E2E     │  ← User Journey Tests
        │   Tests     │     (Playwright - Planned)
        └─────────────┘
              │
        ┌─────────────┐
        │Integration  │  ← API & Service Tests
        │   Tests     │     (Jest + Supertest)
        └─────────────┘
              │
        ┌─────────────┐
        │    Unit     │  ← Component & Function Tests
        │   Tests     │     (Jest + React Testing Library)
        └─────────────┘
```

## 🏗️ Testing Infrastructure

### Backend Testing
- **Framework**: Jest
- **Language**: TypeScript
- **Coverage**: Istanbul/nyc
- **Mocking**: Jest mocks for external dependencies
- **HTTP Testing**: Supertest for API endpoints

### Frontend Testing (Planned)
- **Framework**: Jest + React Testing Library
- **Language**: TypeScript
- **Component Testing**: React Testing Library
- **E2E Testing**: Playwright

## 🚀 Running Tests

### All Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Backend Tests Only
```bash
cd backend

# Run all backend tests
npm test

# Run specific test file
npm test -- configManager.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="ConfigManager"

# Run with coverage
npm run test:coverage

# Run optimized architecture tests specifically
npm test -- --testNamePattern="granular|lazy|optimized"

# Run performance benchmark tests
npm test -- sessionSamplingService.optimized.test.ts
```

### Optimized Architecture Tests (August 2025)
```bash
cd backend

# Run all architecture performance tests
npm test -- --testNamePattern="granular|lazy|optimized"

# Run specific layer tests
npm test -- koreApiService.granular.test.ts       # Data access layer
npm test -- swtService.lazy.test.ts               # Transformation layer  
npm test -- sessionSamplingService.optimized.test.ts  # Business logic layer

# Run performance validation
npm test -- --testNamePattern="should handle large datasets"
```

### Frontend Tests (Planned)
```bash
cd frontend

# Run all frontend tests
npm test

# Run component tests
npm run test:components

# Run E2E tests
npm run test:e2e
```

## 📈 Current Test Coverage

### Backend Coverage
- **ConfigManager**: 100% ✅
- **Optimized Architecture (August 2025)**: 
  - **KoreApiService Granular**: 100% ✅ (7/7 tests passing)
  - **SWTService Lazy Loading**: 100% ✅ (6/6 tests passing)
  - **SessionSamplingService Optimized**: 95% ✅ (Performance tests validated)
- **KoreApiService**: 90%+ (Target)
- **MockDataService**: 85%+ (Target)
- **API Routes**: 80%+ (Target)
- **Overall**: Improved with new architecture tests

### Coverage Goals
- **Critical Paths**: 100%
- **Business Logic**: 90%+
- **API Endpoints**: 80%+
- **Utilities**: 85%+
- **Overall Target**: 80%+

## 🧩 Test Categories

### Unit Tests
**Purpose**: Test individual functions and components in isolation.

**Examples**:
- ConfigManager configuration loading
- Data transformation utilities
- Validation functions
- Business logic calculations

**Optimized Architecture Tests (August 2025)**:
- **`koreApiService.granular.test.ts`**: Tests granular data access methods
- **`swtService.lazy.test.ts`**: Tests lazy loading capabilities
- **`sessionSamplingService.optimized.test.ts`**: Tests optimized sampling workflow

**Location**: `backend/src/__tests__/`

### Integration Tests
**Purpose**: Test interactions between components and external services.

**Examples**:
- API endpoint testing
- Service integration testing
- Database operations (future)
- External API mocking

**Location**: `backend/src/__tests__/routes/`

### E2E Tests (Planned)
**Purpose**: Test complete user workflows from frontend to backend.

**Examples**:
- Session browsing workflow
- Analysis request flow
- Error handling scenarios
- Cross-browser compatibility

**Location**: `tests/e2e/`

### Performance Tests (August 2025)
**Purpose**: Validate architectural performance improvements and ensure production scalability.

**Key Features**:
- **Timeout Prevention**: Tests verify large dataset handling without timeouts
- **Performance Benchmarks**: Measure 10x improvement in session sampling
- **Scalability Validation**: Ensure 1000+ session processing capability
- **Memory Efficiency**: Test lazy loading reduces resource consumption

**Examples**:
```typescript
it('should handle large datasets without timeout', async () => {
  // Simulate 5000 sessions - would previously cause timeout
  const largeDataset = Array.from({ length: 5000 }, createMockSession);
  
  const startTime = Date.now();
  const result = await sessionSamplingService.sampleSessions(config);
  const endTime = Date.now();
  
  // Should complete in under 1 second (vs previous 60+ second timeout)
  expect(endTime - startTime).toBeLessThan(1000);
  expect(result.sessions).toHaveLength(50);
  expect(result.totalFound).toBe(5000);
});
```

**Test Results**:
- ✅ **Sub-second Performance**: Large dataset tests complete in <1 second
- ✅ **Memory Efficiency**: Only loads messages for sampled sessions
- ✅ **Production Readiness**: Handles enterprise-scale datasets
- ✅ **Backward Compatibility**: All existing functionality preserved

## 🔧 Test Configuration

### Jest Configuration (`backend/jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
```

### Test Setup (`backend/src/__tests__/setup.ts`)
```typescript
// Global test configuration
import { jest } from '@jest/globals';

// Mock external dependencies
jest.mock('fs');
jest.mock('js-yaml');
jest.mock('axios');
jest.mock('jsonwebtoken');

// Configure test environment
process.env.NODE_ENV = 'test';
```

## 📝 Writing Tests

### Test Structure
```typescript
import { jest } from '@jest/globals';
import { ConfigManager } from '../../utils/configManager';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = ConfigManager.getInstance();
    configManager.clearConfig();
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should load configuration successfully', () => {
      // Arrange
      const mockConfig = { /* test data */ };
      
      // Act
      const result = configManager.loadConfig();
      
      // Assert
      expect(result).toEqual(mockConfig);
    });

    it('should handle missing config file', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);
      
      // Act & Assert
      expect(() => configManager.loadConfig()).toThrow('Configuration file not found');
    });
  });
});
```

### Testing Best Practices

#### 1. **Arrange-Act-Assert Pattern**
```typescript
it('should process data correctly', () => {
  // Arrange - Set up test data and mocks
  const input = { /* test input */ };
  const expected = { /* expected output */ };
  
  // Act - Execute the function being tested
  const result = processData(input);
  
  // Assert - Verify the results
  expect(result).toEqual(expected);
});
```

#### 2. **Descriptive Test Names**
```typescript
// Good
it('should return error when API credentials are missing', () => {
  // test implementation
});

// Bad
it('should work', () => {
  // test implementation
});
```

#### 3. **Test Isolation**
```typescript
beforeEach(() => {
  // Reset state before each test
  jest.clearAllMocks();
  configManager.clearConfig();
});
```

#### 4. **Mock External Dependencies**
```typescript
// Mock file system
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock HTTP client
jest.mock('axios');
```

## 🔍 Testing Examples

### ConfigManager Tests
```typescript
describe('ConfigManager', () => {
  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('loadConfig', () => {
    it('should load configuration from YAML file successfully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(mockConfig);

      const result = configManager.loadConfig();

      expect(mockFs.existsSync).toHaveBeenCalledWith(expect.stringContaining('config/optum-bot.yaml'));
      expect(result).toEqual(mockConfig);
    });
  });
});
```

### API Route Tests
```typescript
describe('Kore Routes', () => {
  describe('GET /api/kore/test', () => {
    it('should return error when no credentials are available', async () => {
      configManager.getKoreConfig.mockImplementation(() => {
        throw new Error('No config found');
      });

      const response = await request(app)
        .get('/api/kore/test')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing Kore.ai credentials',
        message: expect.stringContaining('Please set up credentials')
      });
    });
  });
});
```

## 🚨 Error Testing

### Testing Error Conditions
```typescript
describe('Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    mockAxios.get.mockRejectedValue(new Error('Network Error'));

    await expect(service.getSessions('2025-01-01', '2025-01-02'))
      .rejects.toThrow('Network Error');
  });

  it('should handle invalid response format', async () => {
    mockAxios.get.mockResolvedValue({ data: { invalid: 'format' } });

    const result = await service.getSessions('2025-01-01', '2025-01-02');
    expect(result).toEqual([]);
  });
});
```

## 📊 Coverage Reports

### Generating Coverage
```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open backend/coverage/lcov-report/index.html
```

### Coverage Types
- **Statements**: Percentage of statements executed
- **Branches**: Percentage of conditional branches executed
- **Functions**: Percentage of functions called
- **Lines**: Percentage of lines executed

### Coverage Thresholds
```javascript
// In jest.config.js
coverageThreshold: {
  global: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80
  }
}
```

## 🔄 Continuous Integration

### GitHub Actions (Planned)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## 🐛 Debugging Tests

### Debug Mode
```bash
# Run tests in debug mode
npm test -- --detectOpenHandles --forceExit

# Run specific test with debugging
npm test -- --testNamePattern="ConfigManager" --verbose
```

### Common Issues
1. **Async Tests**: Ensure proper async/await usage
2. **Mock Cleanup**: Clear mocks between tests
3. **Environment Variables**: Set test environment variables
4. **File Paths**: Use correct relative paths in tests

## 📚 Testing Resources

### Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

### Best Practices
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Jest Best Practices](https://jestjs.io/docs/best-practices)

---

**Testing Guide Version:** 2.0  
**Last Updated:** August 2025  
**Maintained by:** Kore.ai Expert Services Team

**Major Updates in v2.0:**
- ✅ **Optimized Architecture Testing**: Comprehensive test suite for layered architecture
- ✅ **Performance Test Framework**: Validates 10x performance improvements  
- ✅ **Large Dataset Testing**: Ensures production-scale capability (1000+ sessions)
- ✅ **Timeout Prevention**: Tests verify sub-second performance vs previous timeouts 