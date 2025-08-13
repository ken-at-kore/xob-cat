# Parallel Auto-Analyze Design & Architecture

## Overview

This document describes the parallel processing architecture for the Auto-Analyze feature that maintains near-perfect classification consistency while achieving ~60% performance improvement through intelligent parallelization with inter-round conflict resolution.

## Problem Statement

**Current State**: Sequential processing ensures 100% classification consistency but is slow:
- 100 sessions take ~5 minutes
- Processing 5 sessions at a time = 20 sequential API calls
- Each batch must wait for previous batches to complete
- Cannot leverage modern multi-core architectures

**Core Challenge**: Some classifications only emerge when analyzing the full dataset, but we need previously discovered classifications to maintain consistency across the analysis.

## Solution: Synchronized Parallel Processing with Inter-Round Conflict Resolution

### Architecture Overview

The solution uses a multi-phase approach with continuous conflict resolution:
1. **Strategic Discovery Phase** (Sequential): Establish baseline classifications
2. **Synchronized Parallel Rounds** (Parallel): Process bulk sessions with inter-round conflict resolution
3. **Final Consolidation** (LLM-based): Final conflict resolution and cleanup

### Key Innovation: Inter-Round Conflict Resolution

**New in v2.0**: The system now performs conflict resolution after each processing round, not just at the end. This ensures:
- Classifications converge more quickly across streams
- Better consistency throughout the analysis
- Early detection and resolution of semantic duplicates
- Reduced final conflict resolution workload

## Service Architecture

### Service Hierarchy

```
ParallelAutoAnalyzeService (Orchestrator)
├── StrategicDiscoveryService (Phase 1)
├── ParallelProcessingOrchestratorService (Phase 2)
│   ├── StreamProcessingService (Multiple instances)
│   ├── TokenManagementService
│   ├── SessionValidationService
│   └── ConflictResolutionService (Inter-round resolution)
├── ConflictResolutionService (Final resolution)
├── SessionSamplingService (Existing, enhanced)
└── OpenAIAnalysisService (Existing, enhanced)
```

## Phase 1: Strategic Discovery

### Purpose
Quickly establish 90-95% of common classifications through strategic sampling.

### Configuration
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

### Process
1. Sample diverse sessions (by length, type, time)
2. Process sequentially to build initial classification sets
3. Continue until classification discovery rate drops below threshold

### Service Interface
```typescript
interface IStrategicDiscoveryService {
  runDiscovery(
    sessions: SessionWithTranscript[], 
    config: DiscoveryConfig,
    progressCallback?: DiscoveryProgressCallback
  ): Promise<DiscoveryResult>;
  
  calculateDiscoverySize(totalSessions: number): number;
  selectDiverseSessions(sessions: SessionWithTranscript[], count: number): SessionWithTranscript[];
}
```

## Phase 2: Synchronized Parallel Rounds with Inter-Round Conflict Resolution

### Configuration
```typescript
interface ParallelConfig {
  streamCount: number;              // PARALLEL_STREAM_COUNT env var (default: 8)
  sessionsPerStream: number;        // SESSIONS_PER_STREAM env var (default: 4)
  maxSessionsPerLLMCall: number;    // Dynamic based on model context window
  syncFrequency: 'after_each_round';
  enableInterRoundConflictResolution: boolean; // ENABLE_INTER_ROUND_CONFLICT_RESOLUTION (default: true)
  conflictResolutionThreshold: number;        // Min new classifications to trigger (default: 5)
}
```

### Inter-Round Conflict Resolution Process

**After each parallel processing round:**

1. **Classification Synchronization**
   ```typescript
   // Collect new classifications from all streams
   const roundResults = await Promise.all(streamPromises);
   const syncResult = this.synchronizeClassifications(roundResults, currentClassifications);
   ```

2. **Conflict Detection**
   ```typescript
   // Check if conflict resolution should run
   if (syncResult.newClassificationsCount > conflictResolutionThreshold) {
     // Trigger inter-round conflict resolution
   }
   ```

3. **LLM-Based Resolution**
   ```typescript
   // Use ConflictResolutionService to identify and resolve duplicates
   const resolvedClassifications = await this.conflictResolutionService.resolveClassifications(
     currentClassifications,
     apiKey,
     modelId
   );
   ```

4. **Classification Update**
   ```typescript
   // Apply resolved classifications for next round
   currentClassifications = resolvedClassifications;
   ```

### Context Window Optimization

```typescript
function calculateMaxSessionsPerCall(modelId: string): number {
  const modelInfo = getGptModelById(modelId);
  const contextWindow = modelInfo.contextWindow;
  
  // Model context windows:
  // GPT-4o, 4o-mini: 128,000 tokens
  // GPT-4.1, 4.1-mini, 4.1-nano: 1,000,000 tokens
  
  // Reserve tokens for system message, classifications, schema, response
  const reservedTokens = 5500;
  const availableTokens = contextWindow - reservedTokens;
  
  // Average session: ~1,500 tokens with 20% safety margin
  const avgTokensPerSession = 1500;
  const maxSessions = Math.floor(availableTokens / (avgTokensPerSession * 1.2));
  
  return Math.min(maxSessions, 50); // Cap at 50 for response quality
}
```

### Parallel Processing Orchestrator Interface

```typescript
interface IParallelProcessingOrchestratorService {
  processInParallel(
    sessions: SessionWithTranscript[],
    baseClassifications: ExistingClassifications,
    config: ParallelConfig,
    progressCallback?: ParallelProgressCallback
  ): Promise<ParallelProcessingResult>;
  
  // NEW: Inter-round conflict resolution
  runInterRoundConflictResolution(
    processedSessions: SessionWithFacts[],
    currentClassifications: ExistingClassifications,
    apiKey: string,
    modelId: string
  ): Promise<ExistingClassifications>;
  
  distributeSessionsAcrossStreams(
    sessions: SessionWithTranscript[], 
    streamCount: number
  ): SessionStream[];
  
  synchronizeClassifications(
    streams: StreamResult[],
    currentClassifications: ExistingClassifications
  ): ClassificationSyncResult;
}
```

### Example Configurations

```bash
# Conservative (default) - prioritizes consistency
PARALLEL_STREAM_COUNT=8
SESSIONS_PER_STREAM=4
ENABLE_INTER_ROUND_CONFLICT_RESOLUTION=true
# Result: 8 streams × 4 sessions = 32 sessions per round with conflict resolution

# Optimized for GPT-4o-mini
PARALLEL_STREAM_COUNT=4
SESSIONS_PER_STREAM=20
# Result: 4 streams × 20 sessions = 80 sessions per round

# Optimized for GPT-4.1
PARALLEL_STREAM_COUNT=3
SESSIONS_PER_STREAM=40
# Result: 3 streams × 40 sessions = 120 sessions per round
```

## Phase 3: Final Conflict Resolution

### LLM-Based Conflict Resolution Schema

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
      transferReasons: { /* same structure */ },
      dropOffLocations: { /* same structure */ }
    }
  }
};
```

### Conflict Resolution Service Interface

```typescript
interface IConflictResolutionService {
  // Main resolution method
  resolveConflicts(
    sessions: SessionWithFacts[],
    apiKey: string,
    modelId: string
  ): Promise<ConflictResolutionResult>;
  
  // NEW: Classification-only resolution for inter-round
  resolveClassifications(
    classifications: ExistingClassifications,
    apiKey: string,
    modelId: string
  ): Promise<ExistingClassifications>;
  
  identifyPotentialConflicts(
    classifications: ExistingClassifications
  ): ClassificationConflicts;
  
  applyResolutions(
    sessions: SessionWithFacts[],
    resolutions: ConflictResolutions
  ): SessionWithFacts[];
}
```

## Core Components

### 1. ParallelAutoAnalyzeService (Main Orchestrator)

**Key Responsibilities**:
- Manage analysis lifecycle across all phases
- Coordinate between discovery, parallel processing, and conflict resolution
- Handle dependency injection for all services
- Track progress across all streams and phases

**Critical Dependency Injection Order**:
```typescript
constructor() {
  // ConflictResolutionService MUST be initialized before ParallelProcessingOrchestratorService
  this.conflictResolutionService = new ConflictResolutionService(this.openaiAnalysisService);
  
  this.parallelProcessingOrchestratorService = new ParallelProcessingOrchestratorService(
    this.streamProcessingService,
    this.tokenManagementService,
    this.conflictResolutionService // Required for inter-round resolution
  );
}
```

### 2. StreamProcessingService

**Purpose**: Process sessions within a single parallel stream with dynamic batching

**Key Features**:
- Dynamic batching based on context windows
- Automatic validation and retry for missing sessions
- Local classification tracking

### 3. TokenManagementService

**Purpose**: Manage dynamic batching based on model context windows

**Dynamic Batching Algorithm**:
```
1. Calculate total tokens for stream sessions
2. If tokens < context_limit - reserved_tokens:
   - Process all sessions in one call
3. Else:
   - Split sessions into smaller batches
   - Process each batch sequentially
   - Merge results
```

### 4. SessionValidationService

**Purpose**: Validate LLM responses contain all input sessions

**Validation Process**:
```
1. After LLM response, extract all user_ids
2. Compare with input session user_ids
3. If any missing:
   - Log warning
   - Retry missing sessions
   - Merge results and token usage
```

## Data Flow Architecture

### Complete Processing Flow

```
Phase 0: Sampling
├── SessionSamplingService → Time window expansion → Target sessions

Phase 1: Strategic Discovery
├── StrategicDiscoveryService → OpenAIAnalysisService → Baseline Classifications

Phase 2: Parallel Processing with Inter-Round Resolution
├── Round 1:
│   ├── Stream 1-8: Process sessions in parallel
│   ├── Synchronization: Collect new classifications
│   └── Conflict Resolution: Resolve duplicates → Updated classifications
├── Round 2:
│   ├── Stream 1-8: Process with updated classifications
│   ├── Synchronization: Collect new classifications
│   └── Conflict Resolution: Resolve duplicates → Updated classifications
└── Round N: Continue until all sessions processed

Phase 3: Final Conflict Resolution
└── ConflictResolutionService → Final cleanup → Analysis complete
```

## Logging & Monitoring

### Inter-Round Conflict Resolution Logging

```
⚖️ ============ INTER-ROUND CONFLICT RESOLUTION ============
⚖️ Round 1 Conflict Resolution:
  - New classifications collected: 25 intents, 18 reasons, 12 locations
  - Conflicts identified: 7 intent duplicates, 4 reason duplicates
  - Resolutions applied:
    * "Claim Status" → ["Claim Inquiry", "Claims Check"]
    * "Live Agent" → ["Transfer to Human", "Speak to Representative"]
  - Processing time: 1.2s
⚖️ ========================================================
```

### Stream-Level Logging

```
[Stream ${id}] Starting processing of ${count} sessions
[Stream ${id}] Token calculation: ${tokens} tokens (${batches} batches required)
[Stream ${id}] LLM call ${n} completed: ${sessions} sessions processed
[Stream ${id}] Completed in ${time}ms, ${totalTokens} tokens used
```

### Progress UI Updates

```typescript
// Frontend progress display during inter-round conflict resolution
if (progress.currentStep?.includes('Conflict resolution') && 
    progress.currentStep?.includes('round')) {
  return (
    <div className="text-amber-600">
      ⚖️ Running inter-round conflict resolution...
    </div>
  );
}
```

## Performance Metrics

### With Inter-Round Conflict Resolution

**100-Session Test Results**:
- Total processing time: ~3 minutes
- Rounds completed: 3
- Inter-round resolutions: 2 (after Round 1 and Round 2)
- Conflicts resolved: 16 total (7 in Round 1, 9 in Round 2)
- Classification convergence: 95% by Round 2
- Final cleanup: Minimal (classifications already converged)

### Resource Utilization

- 8 concurrent streams with optimal utilization
- GPT-4o-mini: ~20 sessions per call
- GPT-4.1: ~50 sessions per call
- Memory efficient with stream cleanup after each round

## Testing Strategy

### Integration Tests

```typescript
// Test inter-round conflict resolution
describe('Inter-Round Conflict Resolution', () => {
  it('should run conflict resolution after each round', async () => {
    // Verify conflict resolution is called between rounds
    // Check that classifications are updated after resolution
    // Ensure all streams receive updated classifications
  });
  
  it('should handle dependency injection correctly', async () => {
    // Verify ConflictResolutionService is available to orchestrator
    // Test that inter-round resolution doesn't fail due to missing service
  });
});
```

### E2E Tests

```javascript
// Puppeteer test validation
const validateInterRoundConflictResolution = async (page) => {
  // Check for inter-round conflict resolution UI indicators
  const hasInterRoundResolution = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Conflict resolution after round') ||
           text.includes('inter-round conflict resolution');
  });
  
  return hasInterRoundResolution;
};
```

## Environment Variables

```bash
# Parallel Processing Configuration
PARALLEL_STREAM_COUNT=8                          # Number of parallel streams
SESSIONS_PER_STREAM=4                           # Sessions per stream (target)
ENABLE_INTER_ROUND_CONFLICT_RESOLUTION=true     # Enable inter-round resolution
CONFLICT_RESOLUTION_THRESHOLD=5                 # Min new classifications to trigger

# Discovery Configuration  
DISCOVERY_TARGET_PERCENTAGE=15                  # Percentage of sessions for discovery
DISCOVERY_MIN_SESSIONS=50                       # Minimum discovery sessions
DISCOVERY_MAX_SESSIONS=150                      # Maximum discovery sessions

# Debug Configuration
PARALLEL_PROCESSING_DEBUG=false                 # Enable verbose logging
INTER_ROUND_CONFLICT_RESOLUTION_DEBUG=false     # Debug conflict resolution
```

## Migration Notes

### From v1.0 to v2.0 (Inter-Round Conflict Resolution)

1. **Service Initialization Order**: ConflictResolutionService must be initialized before ParallelProcessingOrchestratorService
2. **New Configuration**: Add ENABLE_INTER_ROUND_CONFLICT_RESOLUTION environment variable
3. **UI Updates**: Frontend now shows inter-round conflict resolution progress
4. **Testing**: New integration tests for inter-round behavior

## Future Enhancements

1. **Adaptive Conflict Resolution**: Only run when conflict rate exceeds threshold
2. **Smart Round Sizing**: Dynamically adjust rounds based on classification stability
3. **Cached Resolutions**: Remember previous conflict resolutions across analyses
4. **Multi-Model Consensus**: Use multiple models for conflict resolution validation

---

*Last Updated: December 2024 - Added inter-round conflict resolution architecture*