# Test Data Files

This directory contains sanitized production data collected from the backend APIs for use in unit tests and development.

## Data Collection Summary

**Collection Period**: July 7, 2025, 12:00-1:00 PM Eastern Time (17:00-18:00 UTC)  
**Total Data Size**: ~695KB (git-friendly)  
**Collection Date**: July 23, 2025

## Data Files

### 1. API Kore Sessions - Agent (`api-kore-sessions-agent-*.json`)
- **Source**: `GET /api/kore/sessions` with `containment_type=agent` filter
- **Content**: Sessions that required agent escalation
- **Count**: 0 sessions (no agent escalations in this time period)
- **Size**: 354B

### 2. API Kore Sessions - Self Service (`api-kore-sessions-selfservice-*.json`)
- **Source**: `GET /api/kore/sessions` with `containment_type=selfService` filter  
- **Content**: Sessions resolved through self-service
- **Count**: 96 sessions
- **Size**: 225KB

### 3. API Kore Sessions - Drop-off (`api-kore-sessions-dropoff-*.json`)
- **Source**: `GET /api/kore/sessions` with `containment_type=dropOff` filter
- **Content**: Sessions where users dropped off
- **Count**: 14 sessions  
- **Size**: 11KB

### 4. API Kore Messages (`api-kore-messages-*.json`)
- **Source**: `GET /api/kore/messages` for the same time period
- **Content**: All conversation messages from 120 sessions
- **Count**: 2,003 messages
- **Size**: 458KB
- **Average**: 17 messages per session

## Data Structure

### Session Data Format
```json
{
  "success": true,
  "data": [
    {
      "session_id": "686bfd1580e5cfcc18780f4c",
      "user_id": "u-68621c3f-d37c-5323-b4d5-88a88c4d2484", 
      "start_time": "2025-07-07T17:00:05.886Z",
      "end_time": "2025-07-07T17:12:30.767Z",
      "containment_type": "selfService",
      "tags": { /* session metadata */ },
      "metrics": { /* performance metrics */ }
    }
  ],
  "message": "Found X sessions",
  "timestamp": "2025-07-23T17:04:55.187Z",
  "meta": {
    "total_count": 96,
    "containment_type_filter": "selfService",
    "bot_name": "Acme Bot"
  }
}
```

### Message Data Format
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "686bfcedd31fb9bbd330ae1d",
      "timestamp": "2025-07-07T17:00:02.379Z", 
      "message_type": "user",
      "message": "Yes"
    }
  ],
  "message": "Found 2003 messages",
  "meta": {
    "total_count": 2003,
    "bot_name": "Acme Bot"
  }
}
```

## Data Sanitization

All data has been sanitized to remove sensitive information:

### ✅ Sanitized Elements
- **Client references**: "Optum" → "Acme", "Health First Colorado" → "Health First Insurance"
- **Phone numbers**: `6512341557` → `4688666908` (format preserved)
- **Provider IDs**: `6728630` → `6773953` (length preserved)
- **Contact IDs**: `niceContactId`, `koreContactId` randomized
- **Dates in messages**: Randomized while preserving format

### ❌ NOT Sanitized (Intentionally Preserved)
- **Session IDs**: System-generated, no personal data
- **User IDs**: System-generated, no personal data  
- **Timestamps**: Needed for realistic testing scenarios
- **Message structure**: Preserved for accurate testing

## Usage in Tests

### Unit Tests
```javascript
// Load test data
const sessionsData = require('../data/api-kore-sessions-selfservice-*.json');
const messagesData = require('../data/api-kore-messages-*.json');

// Mock API responses
jest.mock('../services/koreApiService', () => ({
  getSessions: jest.fn().mockResolvedValue(sessionsData.data),
  getMessages: jest.fn().mockResolvedValue(messagesData.data)
}));
```

### Integration Tests
```javascript
// Test with realistic data patterns
describe('Session Analysis', () => {
  it('should handle real session data patterns', async () => {
    const realSessions = require('../data/api-kore-sessions-selfservice-*.json');
    // Test against actual data structures
  });
});
```

## Data Refresh

To collect new data:

1. **Individual endpoints**:
   ```bash
   cd tools/data-collection
   node collect-api-kore-sessions-selfservice.js
   ```

2. **Comprehensive collection**:
   ```bash
   npx tsx scripts/collect-production-data.ts
   ```

3. **Sanitize new data** (replace sensitive information before committing)

## File Naming Convention

Format: `api-{endpoint}-{filter}-{timestamp}.json`
- `api-kore-sessions-agent-2025-07-23T17-04-55.json`
- `api-kore-messages-2025-07-23T17-05-31.json`