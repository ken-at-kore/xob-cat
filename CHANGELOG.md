# Changelog

All notable changes to this project will be documented in this file.

## [2025-07-23] - Data Collection & Testing Infrastructure

### Added
- **Comprehensive test data collection system**
  - 4 separate API endpoint collectors for realistic test data
  - Individual scripts for each containment type (agent, selfService, dropOff)
  - Message collection for conversation transcripts
  - Data sanitization to remove sensitive information

- **Organized tooling structure**
  - `/tools/data-collection/` - Simple JavaScript collection scripts
  - `/tools/testing/` - Testing and verification utilities
  - Comprehensive README documentation for all tools

- **Real production data for testing**
  - 110 sanitized sessions from July 7, 2025 (1-hour sample)
  - 2,003 conversation messages across 4 containment types
  - ~695KB total data size (git-friendly)

### Enhanced
- **Unit test infrastructure**
  - Fixed TypeScript compilation errors in existing tests
  - Updated test expectations for StandardApiResponse format
  - Achieved 84/95 tests passing (89% success rate)

- **Backend API integration**
  - Real API integration tests for Kore.ai endpoints
  - Comprehensive session history retrieval workflows
  - Batched message collection for large datasets

### Fixed
- **SessionDetailsDialog issues**
  - Resolved "No messages in this session" bugs
  - Fixed duration display showing "N/A"
  - Improved conversation history retrieval

- **Test suite stability**
  - Fixed Jest mock configuration issues
  - Resolved axios mock hoisting problems
  - Updated response format expectations

### Changed
- **Data sanitization policy**
  - Client references: "Optum" → "Acme"
  - Personal data randomized (phone numbers, IDs, dates)
  - System identifiers preserved for data relationship integrity

- **Project organization**
  - Consolidated utility scripts into `/tools/` directory
  - Separated simple JavaScript tools from advanced TypeScript scripts
  - Improved documentation across all directories

### Technical Details

#### Data Collection Scripts
- `collect-api-kore-sessions-agent.js` - Agent escalation sessions
- `collect-api-kore-sessions-selfservice.js` - Self-service containments  
- `collect-api-kore-sessions-dropoff.js` - User drop-off sessions
- `collect-api-kore-messages.js` - Conversation message transcripts

#### Test Infrastructure Improvements
- Backend unit tests: 84/95 passing
- Real API integration tests for all major workflows
- Comprehensive error handling and mock configurations
- Production-like data for realistic testing scenarios

#### Data Sanitization Process
- Automated sanitization script created and applied
- Personal information randomized while preserving data patterns  
- Client-specific references anonymized
- System relationships maintained for testing accuracy

### Migration Notes
- Old collection scripts moved to `/tools/data-collection/`
- Test utilities organized in `/tools/testing/`
- Advanced TypeScript scripts remain in `/scripts/`
- All data files sanitized and ready for version control