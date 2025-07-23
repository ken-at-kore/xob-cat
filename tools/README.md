# Development Tools

This directory contains utility scripts and tools for development, testing, and data collection.

## Data Collection Tools (`data-collection/`)

### API Data Collection Scripts
- **`collect-api-kore-sessions-agent.js`** - Collects sessions with `containment_type=agent` from `/api/kore/sessions`
- **`collect-api-kore-sessions-selfservice.js`** - Collects sessions with `containment_type=selfService` from `/api/kore/sessions` 
- **`collect-api-kore-sessions-dropoff.js`** - Collects sessions with `containment_type=dropOff` from `/api/kore/sessions`
- **`collect-api-kore-messages.js`** - Collects conversation messages from `/api/kore/messages`

### Legacy Collection Scripts
- **`collect-conversation-history.js`** - Collects session data from `/api/analysis/sessions` (includes transcripts)
- **`collect-conversation-messages.js`** - Batched collection of conversation messages for large session sets
- **`collect-july-6-13-data.ts`** - TypeScript script for collecting data from specific date range

### Usage
```bash
# Start the backend server first
cd backend && npm start

# Then run any collection script
cd tools/data-collection
node collect-api-kore-sessions-selfservice.js
```

## Testing Tools (`testing/`)

### Message Testing Scripts
- **`test-kore-messages.js`** - Tests Kore.ai message retrieval functionality
- **`test-message-retrieval.js`** - Validates message retrieval workflows
- **`verify-message-fix.js`** - Verifies message-related bug fixes

### Usage
```bash
cd tools/testing
node test-message-retrieval.js
```

## Data Sanitization

When collecting production data, remember to sanitize it before committing:

1. Replace client-specific information (e.g., "Optum" → "Acme")
2. Randomize personal information (phone numbers, IDs, dates)
3. Keep data files under 1MB total for git storage

## File Organization

- **Raw data files**: Store in `/data/` directory
- **Simple collection scripts**: Keep in `/tools/data-collection/` (JavaScript, single-purpose)
- **Test utilities**: Keep in `/tools/testing/`
- **Advanced collection scripts**: Keep in `/scripts/` (TypeScript, multi-purpose, batch operations)
- **Build/deployment scripts**: Also in `/scripts/`

## Script Directories Comparison

### `/tools/data-collection/` (JavaScript)
- Simple, single-purpose collection scripts
- Direct API calls to individual endpoints  
- Good for quick data collection and debugging
- Examples: `collect-api-kore-sessions-agent.js`

### `/scripts/` (TypeScript)
- Advanced, multi-purpose collection scripts
- Comprehensive data processing and analysis
- Batch operations and data merging
- Examples: `collect-production-data.ts`, `merge-july-6-13-data.ts`