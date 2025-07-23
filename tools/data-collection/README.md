# Data Collection Tools

Scripts for collecting raw API data from the backend for testing and development purposes.

## Current Collection Scripts

### Individual API Endpoint Collection
These scripts collect data from specific backend API endpoints, representing the 4 core API calls:

1. **`collect-api-kore-sessions-agent.js`**
   - Endpoint: `GET /api/kore/sessions` 
   - Filter: `containment_type=agent`
   - Output: Raw Kore.ai session data for agent escalations

2. **`collect-api-kore-sessions-selfservice.js`**
   - Endpoint: `GET /api/kore/sessions`
   - Filter: `containment_type=selfService` 
   - Output: Raw Kore.ai session data for self-service containments

3. **`collect-api-kore-sessions-dropoff.js`**
   - Endpoint: `GET /api/kore/sessions`
   - Filter: `containment_type=dropOff`
   - Output: Raw Kore.ai session data for user drop-offs

4. **`collect-api-kore-messages.js`**
   - Endpoint: `GET /api/kore/messages`
   - Output: Raw conversation message data for all sessions in time range

### Legacy Scripts (for reference)
- **`collect-conversation-history.js`** - Collects from `/api/analysis/sessions` (combines sessions + messages)
- **`collect-conversation-messages.js`** - Batched message collection with session ID filtering
- **`collect-july-6-13-data.ts`** - TypeScript version for specific date ranges

## Usage

1. **Start the backend server:**
   ```bash
   cd backend && npm start
   ```

2. **Run collection scripts:**
   ```bash
   cd tools/data-collection
   node collect-api-kore-sessions-selfservice.js
   node collect-api-kore-messages.js
   # etc.
   ```

3. **Data is saved to `/data/` directory** with timestamped filenames

## Configuration

Scripts are configured for:
- **Default time range**: July 7, 2025, 12-1 PM ET (5-6 PM UTC)
- **Default limit**: 1000 sessions
- **Backend URL**: `localhost:3001`

To modify time ranges or limits, edit the query parameters in each script.

## Data Sanitization

After collection, sanitize the data before committing:
- Replace "Optum" with "Acme"
- Randomize phone numbers, IDs, and dates
- Keep total data size under 1MB for git storage