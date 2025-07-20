# XOB CAT Backend

A Node.js/TypeScript backend service for the XOB CAT (XO Bot Conversation Analysis Tools) application. This service provides APIs for retrieving and analyzing Kore.ai bot session data and conversation transcripts.

## 🚀 Features

- **Session Retrieval**: Fetch session metadata from Kore.ai API
- **Message Retrieval**: Retrieve conversation transcripts with pagination
- **SWT Generation**: Create Sessions With Transcripts (SWT) objects combining session and message data
- **Containment Type Analysis**: Track session outcomes (selfService, agent, dropOff)
- **Rate Limiting**: Built-in rate limiting for Kore.ai API compliance
- **JWT Authentication**: Secure authentication with Kore.ai platform
- **Comprehensive Testing**: Full test coverage with Jest

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Kore.ai bot credentials (botId, clientId, clientSecret)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your Kore.ai credentials:
   ```env
   KORE_BOT_ID=your-bot-id
   KORE_CLIENT_ID=your-client-id
   KORE_CLIENT_SECRET=your-client-secret
   OPENAI_API_KEY=your-openai-key
   ```

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- --testPathPattern=swtService.test.ts
```

## 📚 API Documentation

### Health Check
```
GET /health
```
Returns service health status.

### Session Retrieval
```
GET /api/kore/sessions?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=20
```
Retrieve session metadata for a date range.

### Message Retrieval
```
GET /api/kore/messages?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=100
```
Retrieve conversation messages for a date range.

### SWT (Sessions With Transcripts)
```
GET /api/kore/swts?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=20
```
Generate SWT objects combining session metadata and conversation transcripts.

### Individual Session SWT
```
GET /api/kore/swts/:sessionId
```
Generate SWT for a specific session ID.

## 🏗️ Architecture

### Core Services

#### `KoreApiService`
- Handles communication with Kore.ai REST API
- Implements JWT token generation and authentication
- Manages rate limiting (60 requests/minute, 1800/hour)
- Supports session and message retrieval with pagination

#### `SWTService`
- Generates Sessions With Transcripts (SWT) objects
- Combines session metadata with conversation data
- Provides filtering and summary statistics
- Handles containment type analysis

#### `SWTBuilder`
- Utility class for creating SWT objects
- Message text extraction from Kore.ai components
- Session metrics calculation
- Data validation and transformation

### Data Models

#### `SessionWithTranscript`
```typescript
interface SessionWithTranscript {
  session_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  containment_type: 'agent' | 'selfService' | 'dropOff' | null;
  tags: any;
  metrics: Record<string, any>;
  messages: Message[];
  duration_seconds: number | null;
  message_count: number;
  user_message_count: number;
  bot_message_count: number;
}
```

#### `Message`
```typescript
interface Message {
  timestamp: string;
  message_type: 'user' | 'bot';
  message: string;
}
```

## 🧪 Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Test individual service methods and utilities
- **Integration Tests**: Test API endpoints and data flow
- **Mock Tests**: Test error handling and edge cases

### Test Structure
```
src/__tests__/
├── services/
│   ├── koreApiService.test.ts
│   ├── swtService.test.ts
│   ├── containmentType.test.ts
│   └── ...
├── routes/
│   └── kore.test.ts
└── utils/
    └── configManager.test.ts
```

### Running Tests
```bash
# All tests
npm test

# Specific test suite
npm test -- --testPathPattern=containmentType

# With coverage report
npm test -- --coverage
```

## 📊 Containment Type Analysis

The system tracks three types of session outcomes:

- **`selfService`**: User completed their task without agent assistance
- **`agent`**: Session was transferred to a human agent
- **`dropOff`**: User abandoned the session

### Example Usage
```bash
# Get SWTs with containment type breakdown
curl "http://localhost:3001/api/kore/swts?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=20" | jq '.data.summary.containmentTypeBreakdown'
```

## 🔧 Configuration

### Environment Variables
- `KORE_BOT_ID`: Your Kore.ai bot ID
- `KORE_CLIENT_ID`: Your Kore.ai client ID  
- `KORE_CLIENT_SECRET`: Your Kore.ai client secret
- `OPENAI_API_KEY`: OpenAI API key for analysis features
- `PORT`: Server port (default: 3001)

### Rate Limiting
The service implements automatic rate limiting:
- 60 requests per minute
- 1800 requests per hour
- Automatic retry with exponential backoff

## 📁 Project Structure

```
backend/
├── src/
│   ├── services/          # Core business logic
│   │   ├── koreApiService.ts
│   │   ├── swtService.ts
│   │   └── ...
│   ├── models/            # Data models and builders
│   │   └── swtModels.ts
│   ├── routes/            # API route handlers
│   │   ├── kore.ts
│   │   └── ...
│   ├── utils/             # Utility functions
│   │   └── configManager.ts
│   └── index.ts           # Application entry point
├── __tests__/             # Test files
├── output/                # Generated output files
├── config/                # Configuration files
└── dist/                  # Compiled output
```

## 🚀 Deployment

### Docker (Recommended)
```bash
# Build image
docker build -t xob-cat-backend .

# Run container
docker run -p 3001:3001 --env-file .env xob-cat-backend
```

### Manual Deployment
```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🔍 Monitoring

### Health Endpoints
- `GET /health` - Service health status
- `GET /api/kore/test` - Kore.ai API connectivity test

### Logging
The service logs:
- API requests and responses
- Rate limiting events
- Error conditions
- Performance metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation for new features
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information

## 🔗 Related Projects

- **Frontend**: Next.js application for data visualization
- **Shared Types**: Common TypeScript interfaces
- **Analysis Service**: OpenAI integration for session analysis 