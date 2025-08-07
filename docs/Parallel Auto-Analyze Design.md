# Parallel Auto-Analyze Design

## Overview

This document describes an enhanced parallel processing architecture for the Auto-Analyze feature that maintains near-perfect classification consistency while achieving ~60% performance improvement through intelligent parallelization.

## Problem Statement

**Current State**: Sequential processing ensures 100% classification consistency but is slow:
- 100 sessions take ~5 minutes
- Processing 5 sessions at a time = 20 sequential API calls
- Each batch must wait for previous batches to complete
- Cannot leverage modern multi-core architectures

**Core Challenge**: Some classifications only emerge when analyzing the full dataset, but we need previously discovered classifications to maintain consistency across the analysis.

## Solution: Synchronized Parallel Processing

### Architecture Overview

The solution uses a three-phase approach:
1. **Strategic Discovery Phase** (Sequential): Establish baseline classifications
2. **Synchronized Parallel Rounds** (Parallel): Process bulk sessions with periodic synchronization
3. **Automated Consolidation** (LLM-based): Resolve classification conflicts without human intervention

### Phase 1: Strategic Discovery

```typescript
interface DiscoveryConfig {
  targetSize: number;              // 10-15% of total sessions
  minSessions: 50;                 // Minimum discovery size
  maxSessions: 150;                // Maximum discovery size
  diversityStrategy: {
    sessionLengths: ['short', 'medium', 'long'];
    containmentTypes: ['agent', 'selfService', 'dropOff'];
    timeDistribution: 'spread';   // Sample across entire time window
  };
}
```

**Purpose**: Quickly establish 90-95% of common classifications through strategic sampling.

**Process**:
1. Sample diverse sessions (by length, type, time)
2. Process sequentially to build initial classification sets
3. Continue until classification discovery rate drops

### Phase 2: Synchronized Parallel Rounds

```typescript
interface ParallelConfig {
  streamCount: number;              // Configurable via PARALLEL_STREAM_COUNT env var (default: 8)
  sessionsPerStream: number;        // Configurable via SESSIONS_PER_STREAM env var (default: 4)
  maxSessionsPerLLMCall: number;    // Dynamic based on model context window
  syncFrequency: 'after_each_round';
}

// Environment variable configuration
const parallelConfig = {
  streamCount: parseInt(process.env.PARALLEL_STREAM_COUNT || '8'),
  sessionsPerStream: parseInt(process.env.SESSIONS_PER_STREAM || '4'),
  maxSessionsPerLLMCall: calculateMaxSessionsPerCall(modelId)
};
```

**Context Window Optimization**:
```typescript
function calculateMaxSessionsPerCall(modelId: string): number {
  const modelInfo = getGptModelById(modelId);
  const contextWindow = modelInfo.contextWindow; // tokens
  
  // Model context windows:
  // GPT-4o, 4o-mini: 128,000 tokens
  // GPT-4.1, 4.1-mini, 4.1-nano: 1,000,000 tokens
  
  // Reserve tokens for:
  // - System message: ~500 tokens
  // - Existing classifications: ~2,000 tokens  
  // - Function schema: ~1,000 tokens
  // - Response buffer: ~2,000 tokens
  const reservedTokens = 5500;
  const availableTokens = contextWindow - reservedTokens;
  
  // Average session: ~1,500 tokens
  // Add 20% safety margin
  const avgTokensPerSession = 1500;
  const maxSessions = Math.floor(availableTokens / (avgTokensPerSession * 1.2));
  
  // Practical limits
  return Math.min(maxSessions, 50); // Cap at 50 for response quality
}
```

**Dynamic Batch Processing**:

Each stream attempts to process all its sessions in a single LLM call, but the system must dynamically adjust based on actual token usage:

**Token Limit Handling**:
- The app calculates total tokens for all sessions in the stream
- If sessions fit within the model's context window → single LLM call
- If sessions exceed context window → automatically split into multiple LLM calls
- Extremely large sessions may require individual processing

**Model Context Windows**:
- **GPT-4o/4o-mini**: 128,000 tokens (~20 average sessions)
- **GPT-4.1 variants**: 1,000,000 tokens (~50 average sessions)

**Important**: `SESSIONS_PER_STREAM` is a target, not a guarantee. If a stream contains unusually long sessions, the system will automatically make multiple LLM calls to process them safely within context limits.

**Example Configurations**:
```bash
# Conservative (default) - prioritizes consistency
PARALLEL_STREAM_COUNT=8
SESSIONS_PER_STREAM=4
# Result: 8 streams × 4 sessions = 32 sessions per round

# Optimized for GPT-4o-mini
PARALLEL_STREAM_COUNT=4
SESSIONS_PER_STREAM=20
# Result: 4 streams × 20 sessions = 80 sessions per round

# Optimized for GPT-4.1
PARALLEL_STREAM_COUNT=3
SESSIONS_PER_STREAM=40
# Result: 3 streams × 40 sessions = 120 sessions per round
```

**Key Design Decisions**:
- Each stream processes all its sessions in a single LLM call (when possible)
- SESSIONS_PER_STREAM should be set to maximize LLM utilization
- Configurable parallelism via environment variables
- Each stream maintains local classification tracking
- All streams share baseline classifications at round start
- New classifications collected for synchronization

### Session Validation & Retry

**Critical Requirement**: The system MUST validate that all sessions sent to the LLM are included in the response.

```typescript
// After each LLM call:
1. Check that all input session user_ids appear in the response
2. If any sessions are missing or malformed:
   - Log warning with missing session count
   - Make a separate LLM call for just the missing sessions
   - Merge results and token usage
   - Update classifications from retry attempt

// This ensures 100% session coverage despite potential LLM errors
```

### Phase 3: LLM-Based Conflict Resolution

Instead of complex similarity algorithms, leverage the same LLM for conflict detection:

```typescript
const CONFLICT_RESOLUTION_SCHEMA = {
  name: "resolve_classification_conflicts",
  description: "Identify and resolve semantic duplicate classifications",
  parameters: {
    type: "object",
    properties: {
      generalIntents: {
        type: "array",
        items: {
          type: "object",
          properties: {
            canonical: { 
              type: "string", 
              description: "The chosen canonical classification" 
            },
            aliases: { 
              type: "array", 
              items: { type: "string" },
              description: "All other classifications that mean the same thing"
            }
          },
          required: ["canonical", "aliases"]
        }
      },
      transferReasons: {
        type: "array",
        items: { /* same structure */ }
      },
      dropOffLocations: {
        type: "array",
        items: { /* same structure */ }
      }
    }
  }
};
```

**Example Conflict Resolution Prompt**:
```
You are reviewing classifications from parallel analysis streams. Identify any semantic duplicates and choose the canonical version.

General Intents found:
- "Claim Status" (15 sessions) - Checking insurance claim status
- "Billing" (8 sessions) - Billing inquiries
- "Claim Inquiry" (3 sessions) - Asking about claims
- "Live Agent" (12 sessions) - Requesting human assistance
- "Transfer to Human" (2 sessions) - Wanting to speak to person

For each group of semantic duplicates:
1. Identify which classifications refer to the same concept
2. Choose the best canonical name (most specific, clearest)
3. List all aliases that should map to the canonical name
```

**Example LLM Response**:
```json
{
  "generalIntents": [
    {
      "canonical": "Claim Status",
      "aliases": ["Claim Inquiry"]
    },
    {
      "canonical": "Live Agent",
      "aliases": ["Transfer to Human"]
    }
  ]
}
```

## Implementation Details

### Core Components

**1. Parallel Processing Orchestrator**
- Manages discovery phase (sequential) and parallel rounds
- Loads configuration from environment variables
- Coordinates stream execution and synchronization points

**2. Stream Processor**
- Each stream processes its assigned sessions independently
- Dynamically splits sessions if they exceed context window
- Validates all sessions are included in LLM response
- Retries missing sessions automatically

**3. Token Management**
- Calculate tokens before each LLM call
- Split batches that exceed model context limits
- Track cumulative token usage across all streams

**4. Conflict Resolution Service**
- Collects new classifications from all streams after each round
- Uses LLM to identify semantic duplicates
- Returns canonical classifications with aliases
- Updates all affected sessions with resolved classifications

### Key Algorithms

**Dynamic Batching**:
```
1. Calculate total tokens for stream sessions
2. If tokens < context_limit - reserved_tokens:
   - Process all sessions in one call
3. Else:
   - Split sessions into smaller batches
   - Process each batch sequentially
   - Merge results
```

**Session Validation**:
```
1. After LLM response, extract all user_ids
2. Compare with input session user_ids
3. If any missing:
   - Log warning
   - Retry missing sessions
   - Merge results and token usage
```

**Synchronization Flow**:
```
1. All streams complete their round
2. Collect new classifications from each stream
3. Call LLM to resolve conflicts
4. Apply canonical classifications to all sessions
5. Update master classification set
6. Start next round
```

### Logging Requirements

Comprehensive logging is critical for monitoring parallel execution and debugging issues:

**Stream-Level Logging**:
- `[Stream ${id}] Starting processing of ${count} sessions`
- `[Stream ${id}] Token calculation: ${tokens} tokens (${batches} batches required)`
- `[Stream ${id}] LLM call ${n} completed: ${sessions} sessions processed`
- `[Stream ${id}] Missing sessions detected: ${missing} sessions, retrying...`
- `[Stream ${id}] Completed in ${time}ms, ${totalTokens} tokens used`

**Synchronization Logging**:
- `[Sync Round ${n}] Collecting classifications from ${streams} streams`
- `[Sync Round ${n}] New classifications found: ${count} intents, ${count} reasons, ${count} locations`
- `[Sync Round ${n}] Conflicts detected: ${conflicts}`
- `[Sync Round ${n}] Resolutions applied: ${canonical} → [${aliases}]`

**Performance Metrics**:
- Overall progress: sessions completed, rounds completed, ETA
- Token usage: per stream, per round, cumulative
- Timing: discovery phase, each round, sync points
- Error tracking: retry attempts, failed sessions

**Debug Mode**: Environment variable to enable verbose logging of:
- Full session lists per stream
- Complete LLM prompts and responses
- Detailed conflict resolution decisions
