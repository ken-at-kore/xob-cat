# XOB CAT API Reference

## 🔗 Base URL

**Development:** `http://localhost:3001/api`  
**Production:** `https://your-domain.com/api`

## 🔐 Authentication

Most endpoints require no authentication for the MVP. Future versions may include API key authentication.

## 📊 Response Format

All API responses follow this standard format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

## 📋 Endpoints

### Health Check

#### `GET /health`

Check if the API is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T12:00:00Z",
  "version": "1.0.0"
}
```

---

### Sessions

#### `GET /sessions`

Retrieve a list of bot sessions with optional filtering.

**Query Parameters:**
- `start_date` (string, optional): ISO 8601 date string
- `end_date` (string, optional): ISO 8601 date string
- `containment_type` (string, optional): "agent" | "selfService" | "dropOff"
- `limit` (number, optional): Number of sessions to return (default: 50)
- `skip` (number, optional): Number of sessions to skip (default: 0)

**Example Request:**
```bash
curl "http://localhost:3001/api/sessions?start_date=2025-01-01T00:00:00Z&end_date=2025-01-02T00:00:00Z&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "session_id": "session-123",
      "user_id": "user-456",
      "start_time": "2025-01-01T10:00:00Z",
      "end_time": "2025-01-01T10:05:00Z",
      "containment_type": "agent",
      "tags": ["billing", "escalated"],
      "metrics": {
        "total_messages": 15,
        "user_messages": 8,
        "bot_messages": 7,
        "duration_seconds": 300
      },
      "messages": [
        {
          "timestamp": "2025-01-01T10:00:00Z",
          "message_type": "user",
          "message": "I need help with my bill"
        }
      ],
      "duration_seconds": 300,
      "message_count": 15,
      "user_message_count": 8,
      "bot_message_count": 7
    }
  ],
  "total_count": 100,
  "has_more": true
}
```

#### `GET /sessions/:sessionId`

Retrieve details for a specific session.

**Path Parameters:**
- `sessionId` (string, required): The session ID

**Example Request:**
```bash
curl "http://localhost:3001/api/sessions/session-123"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "session-123",
    "user_id": "user-456",
    "start_time": "2025-01-01T10:00:00Z",
    "end_time": "2025-01-01T10:05:00Z",
    "containment_type": "agent",
    "tags": ["billing", "escalated"],
    "metrics": {
      "total_messages": 15,
      "user_messages": 8,
      "bot_messages": 7,
      "duration_seconds": 300
    },
    "messages": [
      {
        "timestamp": "2025-01-01T10:00:00Z",
        "message_type": "user",
        "message": "I need help with my bill"
      },
      {
        "timestamp": "2025-01-01T10:00:05Z",
        "message_type": "bot",
        "message": "I'd be happy to help you with your bill. Can you provide your account number?"
      }
    ],
    "duration_seconds": 300,
    "message_count": 15,
    "user_message_count": 8,
    "bot_message_count": 7
  }
}
```

---

### Analysis

#### `POST /analysis/session`

Analyze a single session using configurable GPT models (GPT-4o-mini default).

**Request Body:**
```json
{
  "session_id": "session-123"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3001/api/analysis/session" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "session-123"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "session-123",
    "user_id": "user-456",
    "general_intent": "Billing",
    "call_outcome": "Transfer",
    "transfer_reason": "Invalid Account Number",
    "drop_off_location": "Account Verification",
    "notes": "User requested bill help but provided invalid account number, leading to agent transfer.",
    "token_usage": {
      "prompt_tokens": 1250,
      "completion_tokens": 150,
      "total_tokens": 1400,
      "cost": 0.0028
    },
    "analyzed_at": "2025-01-20T12:00:00Z"
  }
}
```

#### `POST /analysis/batch`

Analyze multiple sessions in batch.

**Request Body:**
```json
{
  "session_ids": ["session-123", "session-124", "session-125"],
  "options": {
    "include_token_usage": true,
    "analysis_type": "comprehensive"
  }
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3001/api/analysis/batch" \
  -H "Content-Type: application/json" \
  -d '{"session_ids": ["session-123", "session-124"]}'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "session_id": "session-123",
      "user_id": "user-456",
      "general_intent": "Billing",
      "call_outcome": "Transfer",
      "transfer_reason": "Invalid Account Number",
      "drop_off_location": "Account Verification",
      "notes": "User requested bill help but provided invalid account number.",
      "analyzed_at": "2025-01-20T12:00:00Z"
    },
    {
      "session_id": "session-124",
      "user_id": "user-457",
      "general_intent": "Eligibility",
      "call_outcome": "Contained",
      "notes": "User successfully checked eligibility status.",
      "analyzed_at": "2025-01-20T12:01:00Z"
    }
  ],
  "token_usage": {
    "prompt_tokens": 2500,
    "completion_tokens": 300,
    "total_tokens": 2800,
    "cost": 0.0056,
    "timestamp": "2025-01-20T12:02:00Z"
  }
}
```

---

### Kore.ai Integration

#### `GET /kore/test`

Test Kore.ai API connectivity and retrieve session count.

**Example Request:**
```bash
curl "http://localhost:3001/api/kore/test"
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully connected to Optum Bot",
  "data": {
    "bot_name": "Optum Bot",
    "sessions_count": 100,
    "sample_session": {
      "session_id": "kore-session-123",
      "user_id": "user-456",
      "start_time": "2025-01-01T10:00:00Z",
      "end_time": "2025-01-01T10:05:00Z",
      "containment_type": "agent"
    },
    "date_range": {
      "start": "2025-01-01T00:00:00Z",
      "end": "2025-01-02T00:00:00Z"
    }
  }
}
```

#### `GET /kore/sessions`

Retrieve sessions from Kore.ai API.

**Query Parameters:**
- `start_date` (string, optional): ISO 8601 date string
- `end_date` (string, optional): ISO 8601 date string
- `containment_type` (string, optional): "agent" | "selfService" | "dropOff"
- `limit` (number, optional): Number of sessions to return (default: 50)
- `skip` (number, optional): Number of sessions to skip (default: 0)

**Example Request:**
```bash
curl "http://localhost:3001/api/kore/sessions?start_date=2025-01-01T00:00:00Z&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "session_id": "kore-session-123",
      "user_id": "user-456",
      "start_time": "2025-01-01T10:00:00Z",
      "end_time": "2025-01-01T10:05:00Z",
      "containment_type": "agent",
      "tags": {
        "userTags": ["premium"],
        "sessionTags": ["billing"]
      },
      "messages": []
    }
  ],
  "total_count": 100,
  "has_more": true,
  "date_range": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-02T00:00:00Z"
  },
  "bot_name": "Optum Bot"
}
```

#### `GET /kore/sessions/:sessionId`

Retrieve a specific session from Kore.ai API.

**Path Parameters:**
- `sessionId` (string, required): The Kore.ai session ID

**Example Request:**
```bash
curl "http://localhost:3001/api/kore/sessions/kore-session-123"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "kore-session-123",
    "user_id": "user-456",
    "start_time": "2025-01-01T10:00:00Z",
    "end_time": "2025-01-01T10:05:00Z",
    "containment_type": "agent",
    "tags": {
      "userTags": ["premium"],
      "sessionTags": ["billing"]
    },
    "messages": [
      {
        "timestamp": "2025-01-01T10:00:00Z",
        "message_type": "user",
        "message": "I need help with my bill"
      }
    ]
  }
}
```

---

## ❌ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid date format. Expected ISO 8601 format."
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Session with ID 'session-123' not found."
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred. Please try again later."
}
```

### Kore.ai API Errors
```json
{
  "success": false,
  "error": "Missing Kore.ai credentials",
  "message": "Please set up Kore.ai credentials in the configuration file."
}
```

---

## 📊 Rate Limiting

- **General API**: No rate limiting in MVP
- **Kore.ai Integration**: 60 requests/minute, 1800 requests/hour
- **OpenAI Integration**: Based on OpenAI API limits

---

## 🔧 Data Types

### SessionWithTranscript
```typescript
interface SessionWithTranscript {
  session_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  containment_type: 'agent' | 'selfService' | 'dropOff';
  tags: string[];
  metrics: Record<string, any>;
  messages: Message[];
  duration_seconds?: number;
  message_count: number;
  user_message_count: number;
  bot_message_count: number;
}
```

### Message
```typescript
interface Message {
  timestamp: string;
  message_type: 'user' | 'bot';
  message: string;
}
```

### AnalysisResult
```typescript
interface AnalysisResult {
  session_id: string;
  user_id: string;
  general_intent: string;
  call_outcome: 'Transfer' | 'Contained';
  transfer_reason?: string;
  drop_off_location?: string;
  notes: string;
  token_usage?: TokenUsage;
  analyzed_at: string;
}
```

### TokenUsage
```typescript
interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  timestamp: string;
}
```

---

## 🧪 Testing the API

### Using curl
```bash
# Health check
curl http://localhost:3001/health

# Get sessions
curl "http://localhost:3001/api/sessions?limit=5"

# Analyze session
curl -X POST "http://localhost:3001/api/analysis/session" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "session-123"}'
```

### Using Postman
1. Import the API collection (planned)
2. Set the base URL to `http://localhost:3001/api`
3. Use the provided examples for testing

---

**API Version:** 1.0  
**Last Updated:** July 2025  
**Maintained by:** Kore.ai Expert Services Team 