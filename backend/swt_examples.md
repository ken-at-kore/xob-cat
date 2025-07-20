# Sessions With Transcripts (SWT) Examples

This document shows example output from the SWT (Sessions With Transcripts) API endpoints, demonstrating how session metadata and conversation transcripts are combined into unified objects.

## API Endpoints

### 1. Generate SWTs for Date Range
```
GET /api/kore/swts?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=5
```

### 2. Generate SWT for Specific Session
```
GET /api/kore/swts/{sessionId}
```

## Example SWT Object (with messages)

```json
{
  "session_id": "686c54b371436049268de568",
  "user_id": "u-31f8863e-27f7-5f1a-afdd-1500a4f765ff",
  "start_time": "2025-07-07T23:13:55.377Z",
  "end_time": "2025-07-07T23:16:11.213Z",
  "containment_type": null,
  "tags": {
    "userTags": [],
    "sessionTags": [
      {
        "value": "2025-07-07 17:13:55",
        "name": "callStartTime"
      },
      {
        "value": "431702770115",
        "name": "niceContactId"
      },
      {
        "value": "u-31f8863e-27f7-5f1a-afdd-1500a4f765ff",
        "name": "koreUserId"
      },
      {
        "value": "a47fd317-a4c5-4454-9341-58077610811a",
        "name": "koreCallId"
      },
      {
        "value": "6232284101",
        "name": "callerNumber"
      },
      {
        "value": "smartassist",
        "name": "channelName"
      },
      {
        "value": "Regular",
        "name": "callerType"
      },
      {
        "value": "No",
        "name": "surveyOptedIn"
      },
      {
        "value": "No",
        "name": "surveyTransfer"
      },
      {
        "value": "Yes",
        "name": "agentTransfer"
      },
      {
        "value": "No",
        "name": "userHangUp"
      },
      {
        "value": "SUCCESS",
        "name": "niceApiStatus"
      },
      {
        "value": "Input capture timeout",
        "name": "agentTransferReason"
      },
      {
        "value": "NA",
        "name": "lastUserUtterance"
      },
      {
        "value": "NA",
        "name": "failedAPI"
      },
      {
        "value": "Start date of service",
        "name": "inputEntityFailedBeforeAgentTransfer"
      },
      {
        "value": "Member_Eligibility",
        "name": "lastIntentBeforeSessionCompletion"
      },
      {
        "value": "{\"Member_Eligibility\":1}",
        "name": "intentCounts"
      },
      {
        "value": "{\"Provider ID\":1,\"Member ID\":1,\"Start date of service\":1}",
        "name": "entityVisitCounts"
      },
      {
        "value": "2025-07-07 17:16:11",
        "name": "callEndTime"
      }
    ],
    "altText": []
  },
  "metrics": {},
  "messages": [
    {
      "timestamp": "2025-07-07T23:13:55.377Z",
      "message_type": "user",
      "message": "StartFlow"
    },
    {
      "timestamp": "2025-07-07T23:13:56.597Z",
      "message_type": "bot",
      "message": "This call may be monitored or recorded for quality assurance purposes."
    },
    {
      "timestamp": "2025-07-07T23:13:56.905Z",
      "message_type": "bot",
      "message": "Please state the reason for the contact today, such as claim status, billing, member eligibility, provider enrollment, web portal, prior authorization, Electronic Data Interchange, or other."
    },
    {
      "timestamp": "2025-07-07T23:14:19.440Z",
      "message_type": "user",
      "message": "Eligibility and benefits"
    },
    {
      "timestamp": "2025-07-07T23:14:20.413Z",
      "message_type": "bot",
      "message": "You are calling about Member Eligibility. Is that correct, please say yes or no?"
    },
    {
      "timestamp": "2025-07-07T23:14:29.641Z",
      "message_type": "user",
      "message": "Yes"
    },
    {
      "timestamp": "2025-07-07T23:14:30.529Z",
      "message_type": "bot",
      "message": "Please say or enter the 8 or 10 digit Health First Colorado Provider ID or the National Provider Identifier. \n                      If you are not an enrolled provider or do not know your ID, please say I do not have one."
    },
    {
      "timestamp": "2025-07-07T23:14:53.822Z",
      "message_type": "user",
      "message": "1043382302"
    },
    {
      "timestamp": "2025-07-07T23:14:54.457Z",
      "message_type": "bot",
      "message": "The ID you have entered is 1 0 4 3 3 8 2 3 0 2. Is that correct? Please say yes, or no?"
    },
    {
      "timestamp": "2025-07-07T23:15:06.553Z",
      "message_type": "user",
      "message": "Yes"
    },
    {
      "timestamp": "2025-07-07T23:15:08.889Z",
      "message_type": "bot",
      "message": "Please say or enter the member's ID."
    },
    {
      "timestamp": "2025-07-07T23:15:21.017Z",
      "message_type": "user",
      "message": "P474915"
    },
    {
      "timestamp": "2025-07-07T23:15:22.105Z",
      "message_type": "bot",
      "message": "Say or enter the 8-digit start date of service you are calling about by using 2 digits for the month, 2 digits for the day and 4 digits for the year. If the date of service is today, press the pound key."
    },
    {
      "timestamp": "2025-07-07T23:15:44.365Z",
      "message_type": "user",
      "message": "MAX_NO_INPUT"
    },
    {
      "timestamp": "2025-07-07T23:15:44.850Z",
      "message_type": "bot",
      "message": "Please hold while you are connected with the next available representative."
    },
    {
      "timestamp": "2025-07-07T23:15:45.662Z",
      "message_type": "bot",
      "message": "Health First Colorado is interested in feedback regarding your customer service experience today. Press 1 to participate in a short automated survey at the end of this call. Press 2 to decline."
    },
    {
      "timestamp": "2025-07-07T23:16:05.108Z",
      "message_type": "user",
      "message": "2"
    },
    {
      "timestamp": "2025-07-07T23:16:05.870Z",
      "message_type": "bot",
      "message": " "
    },
    {
      "timestamp": "2025-07-07T23:16:08.376Z",
      "message_type": "user",
      "message": "MAX_NO_INPUT"
    },
    {
      "timestamp": "2025-07-07T23:16:10.610Z",
      "message_type": "user",
      "message": "Call Termination Handler"
    }
  ],
  "duration_seconds": 135.836,
  "message_count": 20,
  "user_message_count": 10,
  "bot_message_count": 10
}
```

## Example SWT Object (without messages)

```json
{
  "session_id": "686c3802d9df71fa83a4e0c4",
  "user_id": "u-a8c0dd2d-975a-52eb-9c3f-6764ea70f14e",
  "start_time": "2025-07-07T21:11:30.361Z",
  "end_time": "2025-07-07T21:11:34.424Z",
  "containment_type": null,
  "tags": {
    "userTags": [],
    "sessionTags": [
      {
        "value": "2025-07-07 15:11:30",
        "name": "callStartTime"
      },
      {
        "value": "431702753534",
        "name": "niceContactId"
      }
    ],
    "altText": []
  },
  "metrics": {},
  "messages": [],
  "duration_seconds": 4.063,
  "message_count": 0,
  "user_message_count": 0,
  "bot_message_count": 0
}
```

## API Response Structure

### Date Range Query Response
```json
{
  "success": true,
  "data": {
    "swts": [...], // Array of SWT objects
    "summary": {
      "totalSessions": 10,
      "totalMessages": 212,
      "totalUserMessages": 85,
      "totalBotMessages": 127,
      "sessionsWithMessages": 10,
      "averageMessagesPerSession": 21.2,
      "averageDuration": 130.8266,
      "containmentTypeBreakdown": {
        "unknown": 10
      },
      "averageUserMessagesPerSession": 8.5,
      "averageBotMessagesPerSession": 12.7
    },
    "generation_stats": {
      "total_sessions": 10,
      "total_messages": 212,
      "sessions_with_messages": 10,
      "generation_time_ms": 8449
    }
  },
  "date_range": {
    "dateFrom": "2025-07-07T00:00:00Z",
    "dateTo": "2025-07-07T23:59:59Z"
  },
  "bot_name": "Optum Bot"
}
```

### Single Session Query Response
```json
{
  "success": true,
  "data": {
    "swt": {...}, // Single SWT object
    "summary": {
      "totalSessions": 1,
      "totalMessages": 20,
      "totalUserMessages": 10,
      "totalBotMessages": 10,
      "sessionsWithMessages": 1,
      "averageMessagesPerSession": 20,
      "averageDuration": 135.836,
      "containmentTypeBreakdown": {
        "unknown": 1
      },
      "averageUserMessagesPerSession": 10,
      "averageBotMessagesPerSession": 10
    }
  },
  "session_id": "686c54b371436049268de568",
  "bot_name": "Optum Bot"
}
```

## Field Descriptions

### Session Metadata
- `session_id`: Unique identifier for the session
- `user_id`: Unique identifier for the user
- `start_time`: Session start timestamp (ISO 8601)
- `end_time`: Session end timestamp (ISO 8601)
- `containment_type`: Session outcome type ('agent', 'selfService', 'dropOff', or null)
- `tags`: Session tags and metadata from Kore.ai
- `metrics`: Additional session metrics

### Conversation Data
- `messages`: Array of message objects with:
  - `timestamp`: Message timestamp (ISO 8601)
  - `message_type`: 'user' or 'bot'
  - `message`: Text content of the message

### Computed Properties
- `duration_seconds`: Session duration in seconds
- `message_count`: Total number of messages
- `user_message_count`: Number of user messages
- `bot_message_count`: Number of bot messages

## Usage Examples

### Frontend Integration
```javascript
// Fetch SWTs for a date range
const response = await fetch('/api/kore/swts?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=10');
const data = await response.json();

// Access SWT data
const swts = data.data.swts;
const summary = data.data.summary;

// Display session information
swts.forEach(swt => {
  console.log(`Session ${swt.session_id}: ${swt.message_count} messages`);
  console.log(`Duration: ${swt.duration_seconds}s`);
  console.log(`User messages: ${swt.user_message_count}, Bot messages: ${swt.bot_message_count}`);
});

// Display summary statistics
console.log(`Total sessions: ${summary.totalSessions}`);
console.log(`Total messages: ${summary.totalMessages}`);
console.log(`Average messages per session: ${summary.averageMessagesPerSession}`);
```

### Filtering and Analysis
```javascript
// Filter sessions with messages
const sessionsWithMessages = swts.filter(swt => swt.message_count > 0);

// Find long conversations
const longSessions = swts.filter(swt => swt.duration_seconds > 300); // > 5 minutes

// Analyze user engagement
const highEngagementSessions = swts.filter(swt => 
  swt.user_message_count > 5 && swt.bot_message_count > 5
);

// Get conversation transcripts
const transcripts = swts.map(swt => ({
  sessionId: swt.session_id,
  messages: swt.messages.map(msg => ({
    timestamp: msg.timestamp,
    speaker: msg.message_type,
    text: msg.message
  }))
}));
```

## Benefits of SWT Approach

1. **Unified Data Structure**: Combines session metadata and conversation transcripts in a single object
2. **Computed Metrics**: Pre-calculated message counts, durations, and statistics
3. **Efficient API**: Single endpoint call instead of separate session and message requests
4. **Rich Metadata**: Includes tags, metrics, and session context
5. **Flexible Filtering**: Easy to filter by message count, duration, containment type, etc.
6. **Frontend Ready**: Structured data format optimized for frontend consumption

## Error Handling

The API returns appropriate error responses:

```json
{
  "success": false,
  "error": "Session not found",
  "message": "Session with ID 123456 not found in Optum Bot"
}
```

Common error scenarios:
- Invalid session ID
- Missing Kore.ai credentials
- API rate limiting
- Network connectivity issues 