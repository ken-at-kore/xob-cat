# SWT Output Files

This folder contains sample output from the Sessions With Transcripts (SWT) API endpoints for evaluation and testing purposes.

## Files Overview

### SWT Data Files
- **`swts_sample.json`** - 10 SWTs from July 7, 2025 (full day)
- **`swts_5_sessions.json`** - 5 SWTs from July 7, 2025 (full day)
- **`swts_evening_sessions.json`** - 3 SWTs from July 7, 2025 (evening hours only)
- **`swts_with_containment_type.json`** - 10 SWTs with containment type data (latest)
- **`single_swt_detailed.json`** - Detailed SWT for a single session (if available)

### Statistics Files
- **`swt_summary_stats.json`** - Summary statistics for 20 SWTs from July 7, 2025
- **`swt_summary_with_containment_type.json`** - Summary with containment type breakdown (latest)
- **`containment_type_breakdown.json`** - Focused view of containment types and metrics
- **`sample_session_id.txt`** - Sample session ID for testing individual SWT retrieval

### Documentation Files
- **`CONTAINMENT_TYPE_EVALUATION.md`** - Comprehensive evaluation of containment type functionality

### Legacy Files (from previous functionality)
- **`sessions.json`** - Raw session data
- **`messages.json`** - Raw message data  
- **`transcript.json`** - Combined transcript data
- **`summary.txt`** - Summary of legacy data

## SWT Data Structure

Each SWT object contains:
- **Session metadata**: session_id, user_id, start_time, end_time, containment_type, tags
- **Messages array**: Individual conversation messages with timestamp, message_type (user/bot), and message text
- **Computed metrics**: message_count, user_message_count, bot_message_count, session_duration_minutes

## API Endpoints Used

- `GET /api/kore/swts?dateFrom=...&dateTo=...&limit=...` - Generate SWTs for date range
- `GET /api/kore/swts/{sessionId}` - Generate SWT for specific session
- `GET /api/kore/sessions?dateFrom=...&dateTo=...&limit=...` - Get session IDs

## Usage Examples

```bash
# Generate SWTs for a date range
curl -X GET "http://localhost:3001/api/kore/swts?dateFrom=2025-07-07T00:00:00Z&dateTo=2025-07-07T23:59:59Z&limit=10"

# Get SWT for specific session
curl -X GET "http://localhost:3001/api/kore/swts/686c54b371436049268de568"
```

## Data Source
All data is retrieved from the Kore.ai API for the bot configured in the application. 