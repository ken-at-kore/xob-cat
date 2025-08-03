# XOB CAT Backend Development Guide

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- IDE with TypeScript support (VS Code recommended)

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd backend

# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Edit .env with your credentials
# KORE_BOT_ID=your-bot-id
# KORE_CLIENT_ID=your-client-id
# KORE_CLIENT_SECRET=your-client-secret
```

### Development Commands
```bash
# Start development server with hot reload
npm run start

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code
npm run format
```

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── services/          # Core business logic
│   │   ├── koreApiService.ts      # Kore.ai API integration
│   │   ├── swtService.ts          # SWT generation logic
│   │   ├── openaiService.ts       # OpenAI integration
│   │   └── realSessionDataService.ts  # Session data retrieval
│   ├── __mocks__/         # Pure mock services (no network calls)
│   │   ├── koreApiService.mock.ts     # Mock Kore.ai API
│   │   ├── sessionDataService.mock.ts # Mock session data
│   │   └── openaiService.mock.ts      # Mock OpenAI service
│   ├── factories/         # Service factory pattern
│   │   └── serviceFactory.ts          # Environment-based service selection
│   ├── interfaces/        # Service interfaces
│   │   └── index.ts               # Service contracts for DI
│   ├── models/            # Data models and builders
│   │   └── swtModels.ts         # SWT data structures
│   ├── routes/            # API route handlers
│   │   ├── kore.ts              # Kore.ai endpoints
│   │   ├── sessions.ts          # Session endpoints
│   │   └── analysis.ts          # Analysis endpoints
│   ├── utils/             # Utility functions
│   │   └── configManager.ts     # Configuration management
│   └── index.ts           # Application entry point
├── __tests__/             # Test files
│   ├── services/          # Service tests
│   ├── routes/            # Route tests
│   └── utils/             # Utility tests
├── config/                # Configuration files
├── output/                # Generated output files
└── dist/                  # Compiled output
```

## 🧪 Testing Strategy

### Test Organization
- **Unit Tests**: Test individual functions and methods
- **Integration Tests**: Test API endpoints and data flow
- **Mock Tests**: Test error handling and edge cases

### Test Patterns
```typescript
// Example test structure
describe('ServiceName', () => {
  let service: ServiceName;
  
  beforeEach(() => {
    // Setup mocks and service instance
    service = new ServiceName();
  });

  describe('methodName', () => {
    it('should handle normal case', async () => {
      // Arrange
      const input = 'test data';
      
      // Act
      const result = await service.methodName(input);
      
      // Assert
      expect(result).toBeDefined();
    });

    it('should handle error case', async () => {
      // Arrange
      const invalidInput = null;
      
      // Act & Assert
      await expect(service.methodName(invalidInput))
        .rejects.toThrow('Invalid input');
    });
  });
});
```

### Mocking Guidelines
```typescript
// Mock external dependencies
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Mock service dependencies
jest.mock('../../services/koreApiService');
const mockKoreService = {
  getSessions: jest.fn(),
  getMessages: jest.fn()
};
```

### Running Tests
```bash
# All tests
npm test

# Specific test file
npm test -- --testPathPattern=swtService.test.ts

# Tests with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## 📝 Code Style Guidelines

### TypeScript Best Practices
- Use strict TypeScript configuration
- Define interfaces for all data structures
- Use type guards for runtime type checking
- Prefer `const` over `let` when possible
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### Naming Conventions
- **Files**: kebab-case (`kore-api-service.ts`)
- **Classes**: PascalCase (`KoreApiService`)
- **Functions**: camelCase (`getSessions`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- **Interfaces**: PascalCase with `I` prefix (`IKoreConfig`)

### Code Organization
```typescript
// File structure example
import { dependencies } from './dependencies';

// Interfaces
interface ServiceConfig {
  // ...
}

// Constants
const DEFAULT_TIMEOUT = 5000;

// Class definition
export class ServiceName {
  private config: ServiceConfig;
  
  constructor(config: ServiceConfig) {
    this.config = config;
  }
  
  // Public methods first
  public async publicMethod(): Promise<void> {
    // ...
  }
  
  // Private methods last
  private privateMethod(): void {
    // ...
  }
}
```

## 🔧 API Development

### Adding New Endpoints
1. **Create route handler** in `src/routes/`
2. **Add service methods** in `src/services/`
3. **Write tests** in `src/__tests__/routes/`
4. **Update documentation** in `API_DOCUMENTATION.md`

### Route Handler Pattern
```typescript
router.get('/endpoint', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { param1, param2 } = req.query;
    if (!param1) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: param1'
      });
    }
    
    // Call service
    const service = createService();
    const result = await service.method(param1, param2);
    
    // Return response
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

### Error Handling
```typescript
// Service-level error handling
try {
  const result = await externalApiCall();
  return result;
} catch (error) {
  if (error.response?.status === 429) {
    // Handle rate limiting
    await delay(60000);
    return this.method(params);
  }
  throw new Error(`API call failed: ${error.message}`);
}
```

## 🔍 Debugging

### Logging
```typescript
// Use structured logging
console.log('API request:', {
  url,
  params,
  timestamp: new Date().toISOString()
});

// Error logging
console.error('Error details:', {
  message: error.message,
  stack: error.stack,
  context: { sessionId, userId }
});
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm run start

# Debug specific module
DEBUG=kore-api npm run start
```

### Testing API Endpoints
```bash
# Test health endpoint
curl http://localhost:3001/health

# Test SWT endpoint
curl "http://localhost:3001/api/kore/swts?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=5"

# Test with jq for pretty output
curl "http://localhost:3001/api/kore/swts?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=5" | jq '.'
```

## 🚀 Performance Optimization

### Rate Limiting
- Implement proper rate limiting for external APIs
- Use exponential backoff for retries
- Cache responses when appropriate

### Memory Management
- Avoid memory leaks in long-running processes
- Use streaming for large datasets
- Implement proper cleanup in tests

### Database Considerations
- Use connection pooling if adding a database
- Implement proper indexing
- Monitor query performance

## 🔒 Security Best Practices

### Environment Variables
- Never commit secrets to version control
- Use `.env` files for local development
- Validate required environment variables on startup

### Input Validation
```typescript
// Validate input parameters
function validateDateRange(dateFrom: string, dateTo: string): void {
  if (!dateFrom || !dateTo) {
    throw new Error('Date range is required');
  }
  
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new Error('Invalid date format');
  }
  
  if (from > to) {
    throw new Error('Start date must be before end date');
  }
}
```

### API Security
- Validate all input parameters
- Sanitize user input
- Use HTTPS in production
- Implement proper CORS policies

## 📦 Deployment

### Environment Configuration
```bash
# Production environment variables
NODE_ENV=production
PORT=3001
KORE_BOT_ID=your-bot-id
KORE_CLIENT_ID=your-client-id
KORE_CLIENT_SECRET=your-client-secret
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Health Checks
```typescript
// Implement health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});
```

## 🤝 Contributing

### Pull Request Process
1. Create feature branch from `main`
2. Make changes with proper tests
3. Ensure all tests pass
4. Update documentation
5. Submit pull request

### Commit Message Format
```
type(scope): description

feat(swt): add containment type filtering
fix(api): handle rate limiting errors
docs(readme): update installation instructions
test(swt): add edge case tests
```

### Code Review Checklist
- [ ] Tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed

## 🐛 Common Issues

### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Test Failures
```bash
# Clear Jest cache
npm test -- --clearCache

# Run tests in verbose mode
npm test -- --verbose
```

### TypeScript Errors
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Fix auto-fixable issues
npx tsc --noEmit --fix
```

## 📚 Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices) 