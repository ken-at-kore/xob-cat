# XOB CAT Backend API Documentation

## Overview

The XOB CAT Backend provides RESTful APIs for retrieving and analyzing Kore.ai bot session data. All endpoints return JSON responses and use standard HTTP status codes.

## Base URL

```
http://localhost:3001
```

## Authentication

Most endpoints require Kore.ai credentials configured via environment variables:
- `KORE_BOT_ID`
- `KORE_CLIENT_ID` 
- `KORE_CLIENT_SECRET`

The service automatically generates JWT tokens for API authentication.

## Rate Limiting

The service implements automatic rate limiting for Kore.ai API compliance:
- 60 requests per minute
- 1800 requests per hour
- Automatic retry with exponential backoff

## Endpoints

### Health Check

#### `GET /health`

Returns service health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-07-20T13:00:00Z",
  "version": "1.0.0"
}
```

**Status Codes:**
- `200` - Service is healthy

---

### Kore.ai API Test

#### `GET /api/kore/test`

Tests connectivity to Kore.ai API.

**Response:**
```json
{
  "success": true,
  "message": "Kore.ai API connection successful",
  "timestamp": "2025-07-20T13:00:00Z"
}
```

**Status Codes:**
- `200` - Connection successful
- `500` - Connection failed

---

### Session Retrieval

#### `GET /api/kore/sessions`

Retrieve session metadata for a date range.

**Query Parameters:**
- `dateFrom` (required): Start date in ISO 8601 format
- `dateTo` (required): End date in ISO 8601 format  
- `limit` (optional): Maximum number of sessions per containment type (default: 1000)
- `skip` (optional): Number of sessions to skip (default: 0)

**Example Request:**
```bash
curl "http://localhost:3001/api/kore/sessions?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=20"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "session_id": "686c3802d9df71fa83a4e0c4",
        "user_id": "user-123",
        "start_time": "2025-07-07T10:00:00Z",
        "end_time": "2025-07-07T10:05:00Z",
        "containment_type": "dropOff",
        "tags": {
          "userTags": [],
          "sessionTags": []
        },
        "metrics": {
          "total_messages": 5,
          "user_messages": 3,
          "bot_messages": 2
        },
        "duration_seconds": 300,
        "message_count": 5,
        "user_message_count": 3,
        "bot_message_count": 2
      }
    ],
    "totalSessions": 40,
    "summary": {
      "containmentTypeBreakdown": {
        "dropOff": 20,
        "selfService": 20
      }
    }
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `500` - Server error

---

### Message Retrieval

#### `GET /api/kore/messages`

Retrieve conversation messages for a date range.

**Query Parameters:**
- `dateFrom` (required): Start date in ISO 8601 format
- `dateTo` (required): End date in ISO 8601 format
- `sessionIds` (optional): Comma-separated list of session IDs to filter by
- `limit` (optional): Maximum number of messages per request (default: 10000)

**Example Request:**
```bash
curl "http://localhost:3001/api/kore/messages?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=100"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "sessionId": "686c3802d9df71fa83a4e0c4",
        "timestamp": "2025-07-07T10:01:00Z",
        "message_type": "user",
        "message": "Hello, I need help with my bill"
      },
      {
        "sessionId": "686c3802d9df71fa83a4e0c4",
        "timestamp": "2025-07-07T10:01:05Z",
        "message_type": "bot",
        "message": "I can help you with billing. Please provide your member ID."
      }
    ],
    "totalMessages": 496,
    "moreAvailable": false
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `500` - Server error

---

### SWT (Sessions With Transcripts)

#### `GET /api/kore/swts`

Generate SWT objects combining session metadata and conversation transcripts.

**Query Parameters:**
- `dateFrom` (required): Start date in ISO 8601 format
- `dateTo` (required): End date in ISO 8601 format
- `limit` (optional): Maximum number of sessions per containment type (default: 1000)

**Example Request:**
```bash
curl "http://localhost:3001/api/kore/swts?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=20"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "swts": [
      {
        "session_id": "686c3802d9df71fa83a4e0c4",
        "user_id": "user-123",
        "start_time": "2025-07-07T10:00:00Z",
        "end_time": "2025-07-07T10:05:00Z",
        "containment_type": "dropOff",
        "tags": {
          "userTags": [],
          "sessionTags": []
        },
        "metrics": {
          "total_messages": 5,
          "user_messages": 3,
          "bot_messages": 2
        },
        "messages": [
          {
            "timestamp": "2025-07-07T10:01:00Z",
            "message_type": "user",
            "message": "Hello, I need help with my bill"
          },
          {
            "timestamp": "2025-07-07T10:01:05Z",
            "message_type": "bot",
            "message": "I can help you with billing. Please provide your member ID."
          }
        ],
        "duration_seconds": 300,
        "message_count": 5,
        "user_message_count": 3,
        "bot_message_count": 2
      }
    ],
    "totalSessions": 40,
    "totalMessages": 496,
    "sessionsWithMessages": 40,
    "generationTime": 8216,
    "summary": {
      "totalSessions": 40,
      "totalMessages": 496,
      "totalUserMessages": 248,
      "totalBotMessages": 248,
      "sessionsWithMessages": 40,
      "averageMessagesPerSession": 12.4,
      "averageDuration": 180.5,
      "containmentTypeBreakdown": {
        "dropOff": 20,
        "selfService": 20
      },
      "averageUserMessagesPerSession": 6.2,
      "averageBotMessagesPerSession": 6.2
    }
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `500` - Server error

---

### Individual Session SWT

#### `GET /api/kore/swts/:sessionId`

Generate SWT for a specific session ID.

**Path Parameters:**
- `sessionId` (required): The session ID to retrieve

**Example Request:**
```bash
curl "http://localhost:3001/api/kore/swts/686c3802d9df71fa83a4e0c4"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "686c3802d9df71fa83a4e0c4",
    "user_id": "user-123",
    "start_time": "2025-07-07T10:00:00Z",
    "end_time": "2025-07-07T10:05:00Z",
    "containment_type": "dropOff",
    "tags": {
      "userTags": [],
      "sessionTags": []
    },
    "metrics": {
      "total_messages": 5,
      "user_messages": 3,
      "bot_messages": 2
    },
    "messages": [
      {
        "timestamp": "2025-07-07T10:01:00Z",
        "message_type": "user",
        "message": "Hello, I need help with my bill"
      },
      {
        "timestamp": "2025-07-07T10:01:05Z",
        "message_type": "bot",
        "message": "I can help you with billing. Please provide your member ID."
      }
    ],
    "duration_seconds": 300,
    "message_count": 5,
    "user_message_count": 3,
    "bot_message_count": 2
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Session not found
- `500` - Server error

---

## Data Models

### SessionWithTranscript

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

### Message

```typescript
interface Message {
  timestamp: string;
  message_type: 'user' | 'bot';
  message: string;
}
```

### Containment Types

- **`selfService`**: User completed their task without agent assistance
- **`agent`**: Session was transferred to a human agent  
- **`dropOff`**: User abandoned the session

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-07-20T13:00:00Z"
}
```

## Pagination

For endpoints that support pagination:

- Use `limit` to control the number of results
- Use `skip` to offset results
- Check `moreAvailable` flag in responses to determine if more data is available

## Date Formats

All date parameters should be in ISO 8601 format:
- `YYYY-MM-DDTHH:mm:ss.sssZ`
- Example: `2025-07-07T00:00:00Z`

## Examples

### Get SWTs for a specific date range
```bash
curl "http://localhost:3001/api/kore/swts?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=10"
```

### Get containment type breakdown
```bash
curl "http://localhost:3001/api/kore/swts?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=20" | jq '.data.summary.containmentTypeBreakdown'
```

### Get messages for specific sessions
```bash
curl "http://localhost:3001/api/kore/messages?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&sessionIds=686c3802d9df71fa83a4e0c4,686c3ca082a13a54710a7a1e"
``` 