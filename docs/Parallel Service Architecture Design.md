# Parallel Auto-Analyze Service Architecture Design

## Overview

This document outlines the detailed service architecture for the new parallel auto-analyze system. The architecture consists of 8 main services working together to provide synchronized parallel processing with classification consistency.

## Service Hierarchy

```
ParallelAutoAnalyzeService (Orchestrator)
├── StrategicDiscoveryService (Phase 1)
├── ParallelProcessingOrchestratorService (Phase 2)
│   ├── StreamProcessingService (Multiple instances)
│   ├── TokenManagementService
│   └── SessionValidationService
├── ConflictResolutionService (Phase 3)
├── SessionSamplingService (Existing, enhanced)
└── OpenAIAnalysisService (Existing, enhanced)
```

## Service Specifications

### 1. ParallelAutoAnalyzeService (Main Orchestrator)

**Purpose**: Core orchestration service managing the entire parallel analysis pipeline

**Key Responsibilities**:
- Manage analysis lifecycle across all three phases
- Coordinate between discovery, parallel processing, and conflict resolution
- Track progress across all streams and phases
- Handle error recovery and cleanup

**Interface**:
```typescript
interface IParallelAutoAnalyzeService {
  startAnalysis(config: AnalysisConfig): Promise<AutoAnalysisStartResponse>;
  getProgress(analysisId: string): Promise<AnalysisProgress>;
  getResults(analysisId: string): Promise<AnalysisResults>;
  cancelAnalysis(analysisId: string): Promise<boolean>;
  storeResults(analysisId: string, results: AnalysisResults): Promise<void>;
}
```

**Configuration**:
- Uses environment variables for parallel processing settings
- Singleton pattern with bot-specific instances
- Background job queue integration for async processing

### 2. StrategicDiscoveryService

**Purpose**: Execute Phase 1 - Strategic Discovery to establish baseline classifications

**Key Responsibilities**:
- Sample 10-15% of sessions using diversity strategy
- Process discovery sessions sequentially to build classification baseline
- Monitor classification discovery rate
- Provide baseline classifications for parallel processing

**Interface**:
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

interface DiscoveryResult {
  baseClassifications: ExistingClassifications;
  processedSessions: SessionWithFacts[];
  remainingSessions: SessionWithTranscript[];
  discoveryStats: {
    totalProcessed: number;
    uniqueIntents: number;
    uniqueReasons: number;
    uniqueLocations: number;
    discoveryRate: number;
  };
  tokenUsage: BatchTokenUsage;
}
```

**Configuration**:
```typescript
interface DiscoveryConfig {
  targetPercentage: number;      // 10-15% of total sessions
  minSessions: number;           // 50 minimum
  maxSessions: number;           // 150 maximum
  diversityStrategy: {
    sessionLengths: ['short', 'medium', 'long'];
    containmentTypes: ['agent', 'selfService', 'dropOff'];
    timeDistribution: 'spread';
  };
}
```

### 3. ParallelProcessingOrchestratorService

**Purpose**: Execute Phase 2 - Manage synchronized parallel processing across multiple streams

**Key Responsibilities**:
- Distribute remaining sessions across parallel streams
- Coordinate synchronized processing rounds
- Collect and synchronize classifications between rounds
- Manage stream lifecycle and error handling

**Interface**:
```typescript
interface IParallelProcessingOrchestratorService {
  processInParallel(
    sessions: SessionWithTranscript[],
    baseClassifications: ExistingClassifications,
    config: ParallelConfig,
    progressCallback?: ParallelProgressCallback
  ): Promise<ParallelProcessingResult>;
  
  distributeSessionsAcrossStreams(
    sessions: SessionWithTranscript[], 
    streamCount: number
  ): SessionStream[];
  
  synchronizeClassifications(streams: StreamResult[]): ExistingClassifications;
}

interface ParallelProcessingResult {
  processedSessions: SessionWithFacts[];
  finalClassifications: ExistingClassifications;
  streamResults: StreamResult[];
  totalTokenUsage: BatchTokenUsage;
  processingStats: {
    totalRounds: number;
    averageStreamUtilization: number;
    syncPoints: number;
  };
}
```

### 4. StreamProcessingService

**Purpose**: Process sessions within a single parallel stream with dynamic batching

**Key Responsibilities**:
- Process assigned sessions using dynamic batching based on context windows
- Validate all sessions appear in LLM responses
- Retry missing sessions automatically
- Track local classifications and token usage

**Interface**:
```typescript
interface IStreamProcessingService {
  processStream(
    streamConfig: StreamConfig,
    progressCallback?: StreamProgressCallback
  ): Promise<StreamResult>;
  
  validateSessionResponse(
    inputSessions: SessionWithTranscript[],
    llmResponse: OpenAIBatchResult
  ): SessionValidationResult;
  
  retryMissingSessions(
    missingSessions: SessionWithTranscript[],
    config: StreamConfig
  ): Promise<SessionWithFacts[]>;
}

interface StreamConfig {
  streamId: number;
  sessions: SessionWithTranscript[];
  baseClassifications: ExistingClassifications;
  modelId: string;
  apiKey: string;
  maxSessionsPerCall: number;
}

interface StreamResult {
  streamId: number;
  processedSessions: SessionWithFacts[];
  newClassifications: ExistingClassifications;
  tokenUsage: BatchTokenUsage;
  validationResults: SessionValidationResult[];
  retryAttempts: number;
  processingTime: number;
}
```

### 5. TokenManagementService

**Purpose**: Manage dynamic batching based on model context windows and token calculations

**Key Responsibilities**:
- Calculate optimal batch sizes based on model context windows
- Estimate token usage before API calls
- Split sessions into appropriate batches when context limits exceeded
- Track cumulative token usage across all streams

**Interface**:
```typescript
interface ITokenManagementService {
  calculateMaxSessionsPerCall(modelId: string): number;
  estimateTokenUsage(sessions: SessionWithTranscript[], modelId: string): number;
  splitSessionsIntoBatches(
    sessions: SessionWithTranscript[], 
    maxSessionsPerCall: number
  ): SessionWithTranscript[][];
  calculateCostEstimate(tokenUsage: BatchTokenUsage): number;
}

interface TokenEstimation {
  estimatedTokens: number;
  recommendedBatchSize: number;
  requiresSplitting: boolean;
  costEstimate: number;
}
```

### 6. SessionValidationService

**Purpose**: Validate LLM responses contain all input sessions and handle retries

**Key Responsibilities**:
- Validate all input session user_ids appear in LLM responses
- Identify missing or malformed sessions
- Coordinate retry attempts for missing sessions
- Merge retry results with original responses

**Interface**:
```typescript
interface ISessionValidationService {
  validateBatchResponse(
    inputSessions: SessionWithTranscript[],
    llmResponse: OpenAIBatchResult
  ): SessionValidationResult;
  
  identifyMissingSessions(
    inputSessions: SessionWithTranscript[],
    processedSessions: SessionWithFacts[]
  ): SessionWithTranscript[];
  
  mergeRetryResults(
    originalResults: SessionWithFacts[],
    retryResults: SessionWithFacts[]
  ): SessionWithFacts[];
}

interface SessionValidationResult {
  allSessionsProcessed: boolean;
  processedCount: number;
  missingCount: number;
  missingSessions: SessionWithTranscript[];
  validationErrors: string[];
}
```

### 7. ConflictResolutionService

**Purpose**: Execute Phase 3 - Resolve semantic duplicate classifications using LLM analysis

**Key Responsibilities**:
- Collect all unique classifications from parallel streams
- Use LLM to identify semantic duplicates
- Choose canonical classifications and map aliases
- Update all affected sessions with resolved classifications

**Interface**:
```typescript
interface IConflictResolutionService {
  resolveConflicts(
    sessions: SessionWithFacts[],
    apiKey: string,
    modelId: string
  ): Promise<ConflictResolutionResult>;
  
  identifyPotentialConflicts(
    classifications: ExistingClassifications
  ): ClassificationConflicts;
  
  applyResolutions(
    sessions: SessionWithFacts[],
    resolutions: ConflictResolutions
  ): SessionWithFacts[];
}

interface ConflictResolutionResult {
  resolvedSessions: SessionWithFacts[];
  resolutionStats: {
    conflictsFound: number;
    conflictsResolved: number;
    canonicalMappings: number;
  };
  resolutions: ConflictResolutions;
  tokenUsage: BatchTokenUsage;
}

interface ConflictResolutions {
  generalIntents: Array<{
    canonical: string;
    aliases: string[];
  }>;
  transferReasons: Array<{
    canonical: string;
    aliases: string[];
  }>;
  dropOffLocations: Array<{
    canonical: string;
    aliases: string[];
  }>;
}
```

## Data Flow Architecture

### Phase 1: Strategic Discovery
```
SessionSamplingService → StrategicDiscoveryService → OpenAIAnalysisService
│                                                               │
└─── Sessions (metadata only) ──→ Discovery Sessions ──→ Baseline Classifications
```

### Phase 2: Parallel Processing
```
ParallelProcessingOrchestratorService
├── Stream 1: TokenManagementService → StreamProcessingService → SessionValidationService
├── Stream 2: TokenManagementService → StreamProcessingService → SessionValidationService
├── Stream N: TokenManagementService → StreamProcessingService → SessionValidationService
└── Synchronization Point → Updated Classifications → Next Round
```

### Phase 3: Conflict Resolution
```
ConflictResolutionService → OpenAIAnalysisService → Final Results
│                                                        │
└── All Stream Results ──→ LLM Conflict Analysis ──→ Canonical Classifications
```

## Environment Configuration

### Parallel Processing Settings
```typescript
interface ParallelConfig {
  streamCount: number;              // PARALLEL_STREAM_COUNT (default: 8)
  sessionsPerStream: number;        // SESSIONS_PER_STREAM (default: 4)
  maxSessionsPerLLMCall: number;    // Dynamic based on model context
  syncFrequency: 'after_each_round';
  retryAttempts: number;           // Default: 3
  debugLogging: boolean;           // PARALLEL_PROCESSING_DEBUG
}
```

### Discovery Phase Settings
```typescript
interface DiscoveryConfig {
  targetPercentage: number;        // DISCOVERY_TARGET_PERCENTAGE (default: 15)
  minSessions: number;            // DISCOVERY_MIN_SESSIONS (default: 50)
  maxSessions: number;            // DISCOVERY_MAX_SESSIONS (default: 150)
  diversityStrategy: DiversityStrategy;
}
```

## Error Handling Strategy

### Stream-Level Errors
- Individual stream failures don't stop other streams
- Failed streams retry with exponential backoff
- Partial results preserved and merged with successful streams

### Session-Level Errors
- Missing sessions automatically retried
- Maximum 3 retry attempts per session
- Fallback classifications for failed sessions

### System-Level Errors
- Progress preservation during failures
- Graceful degradation to sequential processing if parallel fails
- Comprehensive error logging and debugging support

## Performance Targets

### Throughput Improvements
- 60% faster processing compared to sequential approach
- 100 sessions processed in ~3 minutes (vs 5 minutes sequential)
- 8 concurrent streams with optimal resource utilization

### Resource Utilization
- Dynamic batch sizing maximizes LLM context window usage
- GPT-4o-mini: ~20 sessions per call, GPT-4.1: ~50 sessions per call
- Memory efficient stream processing with cleanup

### Consistency Maintenance
- 95%+ classification consistency across parallel streams
- Automatic conflict resolution maintains data integrity
- Baseline discovery ensures common classifications established

## Implementation Priority

### Phase 1: Core Services (Week 1)
1. TokenManagementService - Foundation for dynamic batching
2. SessionValidationService - Critical for data integrity
3. StrategicDiscoveryService - Establishes processing baseline

### Phase 2: Parallel Processing (Week 2)
1. StreamProcessingService - Core parallel processing logic
2. ParallelProcessingOrchestratorService - Stream coordination
3. Enhanced OpenAIAnalysisService - Batch processing improvements

### Phase 3: Integration & Orchestration (Week 3)
1. ConflictResolutionService - Final phase processing
2. ParallelAutoAnalyzeService - Main orchestrator
3. Background job queue integration - Async processing

### Phase 4: Testing & Optimization (Week 4)
1. Comprehensive unit test suite
2. Integration testing with parallel workflows
3. Performance testing and optimization
4. Error handling and recovery testing

This architecture provides a robust, scalable, and maintainable foundation for the parallel auto-analyze system while maintaining the flexibility to optimize and enhance individual components.