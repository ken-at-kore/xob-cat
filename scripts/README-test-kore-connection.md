# Kore.ai Connection Test Utility

This utility script replicates the exact functionality of the `/api/kore/test` API endpoint for standalone testing of Kore.ai API credentials.

## What it does

- Tests Kore.ai API connectivity using the same method as the backend API
- Fetches session metadata from the last hour (same as API endpoint)
- Returns pretty-printed JSON response with connection status
- Handles authentication errors exactly like the API endpoint

## Usage

### Option 1: Command Line Arguments
```bash
npm run test-kore-connection -- --bot-id <BOT_ID> --client-id <CLIENT_ID> --client-secret <CLIENT_SECRET>
```

### Option 2: Environment Variables
```bash
KORE_BOT_ID=<BOT_ID> KORE_CLIENT_ID=<CLIENT_ID> KORE_CLIENT_SECRET=<CLIENT_SECRET> npm run test-kore-connection
```

### Optional Parameters
```bash
npm run test-kore-connection -- --bot-id <BOT_ID> --client-id <CLIENT_ID> --client-secret <CLIENT_SECRET> --base-url <CUSTOM_URL>
```

## Sample Output

### Successful Connection
```json
{
  "success": true,
  "data": {
    "bot_name": "Bot st-12345...",
    "sessions_count": 5,
    "sample_session": {
      "sessionId": "abc123",
      "userId": "user123",
      "start_time": "2025-08-04T01:30:00.000Z",
      "end_time": "2025-08-04T01:35:00.000Z",
      "containment_type": "agent"
    },
    "date_range": {
      "dateFrom": "2025-08-04T01:56:00.000Z",
      "dateTo": "2025-08-04T02:56:00.000Z"
    }
  },
  "message": "Kore.ai API connection successful for Bot st-12345...",
  "timestamp": "2025-08-04T02:56:00.000Z"
}
```

### Failed Connection (Invalid Credentials)
```json
{
  "success": false,
  "error": "Invalid Kore.ai credentials",
  "message": "The provided Bot ID, Client ID, or Client Secret is invalid.",
  "timestamp": "2025-08-04T02:56:00.000Z"
}
```

## Implementation Details

The script uses the exact same logic as `/api/kore/test`:
1. Creates a `KoreApiService` instance with provided credentials
2. Calls `getSessionsMetadata()` with last hour date range
3. Returns bot name, session count, sample session, and date range on success
4. Handles 401 authentication errors with appropriate error messages
5. Pretty-prints the JSON response for easy reading

This makes it perfect for debugging credential issues without needing to run the full web application.