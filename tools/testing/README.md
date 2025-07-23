# Testing Tools

Utility scripts for testing various aspects of the system, particularly message retrieval and API functionality.

## Test Scripts

### Message Testing
- **`test-kore-messages.js`** - Tests Kore.ai message retrieval functionality
  - Validates message API responses
  - Checks message format and structure
  - Tests error handling

- **`test-message-retrieval.js`** - Validates message retrieval workflows
  - Tests end-to-end message collection
  - Validates session-to-message relationships
  - Checks data consistency

### Bug Verification  
- **`verify-message-fix.js`** - Verifies message-related bug fixes
  - Tests specific bug scenarios
  - Validates fix implementations
  - Ensures no regressions

## Usage

1. **Ensure backend is running:**
   ```bash
   cd backend && npm start
   ```

2. **Run test scripts:**
   ```bash
   cd tools/testing
   node test-message-retrieval.js
   ```

## Purpose

These tools are useful for:
- Debugging API integration issues
- Validating data collection workflows  
- Testing bug fixes before deployment
- Manual verification of system behavior

## Integration with Main Test Suite

These are standalone diagnostic tools. For automated testing, use:
- `npm test` in backend directory for unit tests
- `npm run test:e2e` in frontend for end-to-end tests