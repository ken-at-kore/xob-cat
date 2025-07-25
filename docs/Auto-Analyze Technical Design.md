# Auto-Analyze Technical Design Document

## Architecture Overview

The Auto-Analyze feature implements a comprehensive AI-powered session analysis system that processes bot conversation data in intelligent batches while maintaining classification consistency. The system follows a multi-phase pipeline: Configuration → Session Sampling → AI Analysis → Results Display.

## System Components

### Frontend Components (`frontend/src/app/(dashboard)/analyze/`)

#### 1. Configuration Page (`page.tsx`)
**Purpose**: Capture user analysis requirements and validate inputs

**Key Features**:
- Form with date/time pickers, session count input, and OpenAI API key field
- Default values: start date (7 days ago), start time (9:00 AM ET), session count (100)
- Client-side validation: session count (10-1000), required API key, past date validation
- Timezone handling for ET conversion
- Submit triggers analysis initiation

**State Management**:
```typescript
interface AnalysisConfigState {
  startDate: string;
  startTime: string;
  sessionCount: number;
  openaiApiKey: string;
  isSubmitting: boolean;
  errors: Record<string, string>;
}
```

#### 2. Progress Component (`ProgressView.tsx`)
**Purpose**: Display real-time analysis progress with pleasant UX

**Features**:
- Phase-based progress tracking (Sampling → Analysis → Complete)
- Progress bars for session sampling and batch processing
- Token usage and cost estimation updates
- ETA calculation based on processing speed
- Error state handling with retry options

**Progress States**:
```typescript
type AnalysisPhase = 'sampling' | 'analyzing' | 'complete' | 'error';

interface ProgressState {
  phase: AnalysisPhase;
  currentStep: string;
  sessionsFound: number;
  sessionsProcessed: number;
  totalSessions: number;
  batchesCompleted: number;
  totalBatches: number;
  tokensUsed: number;
  estimatedCost: number;
  eta?: number;
  error?: string;
}
```

#### 3. Results Component (`ResultsView.tsx`)
**Purpose**: Display analyzed sessions in structured table format

**Features**:
- Data table with sortable columns for all fact types
- Filtering capabilities (by intent, outcome, transfer reason, etc.)
- Export functionality (CSV, JSON)
- Session detail modal integration
- Token usage summary and cost breakdown
- Classification consistency statistics

### Backend Services (`backend/src/services/`)

#### 1. Auto-Analyze Service (`autoAnalyzeService.ts`)
**Purpose**: Core orchestration service managing the entire analysis pipeline

**Key Methods**:
```typescript
class AutoAnalyzeService {
  async startAnalysis(config: AnalysisConfig): Promise<string>; // Returns analysisId
  async getProgress(analysisId: string): Promise<AnalysisProgress>;
  async getResults(analysisId: string): Promise<SessionWithFacts[]>;
  private async sampleSessions(config: AnalysisConfig): Promise<SessionWithTranscript[]>;
  private async analyzeSessionsBatch(sessions: SessionWithTranscript[]): Promise<SessionWithFacts[]>;
}
```

**Analysis Pipeline**:
1. **Session Sampling**: Use intelligent time window expansion
2. **Batch Preparation**: Group sessions into optimal batches (~5 sessions)
3. **AI Analysis**: Process batches with consistency tracking
4. **Result Aggregation**: Combine batch results with metadata
5. **Progress Updates**: Real-time status updates via in-memory storage

#### 2. Session Sampling Service (`sessionSamplingService.ts`)
**Purpose**: Implement intelligent session discovery and random sampling

**Time Window Expansion Algorithm**:
```typescript
interface TimeWindow {
  start: Date;
  end: Date;
  duration: number; // hours
  label: string;
}

const EXPANSION_STRATEGY = [
  { duration: 3, label: "Initial 3-hour window" },
  { duration: 6, label: "Extended to 6 hours" },
  { duration: 12, label: "Extended to 12 hours" },
  { duration: 144, label: "Extended to 6 days" }
];
```

**Sampling Logic**:
1. Query Kore.ai API with current time window
2. Apply quality filters (min 2 messages, valid transcript)
3. If insufficient sessions, expand to next time window
4. Continue until target count reached or max window exceeded
5. Randomly sample target number using Fisher-Yates shuffle
6. Return deduplicated session list

#### 3. Batch Analysis Service (`batchAnalysisService.ts`)
**Purpose**: Handle AI-powered fact extraction with consistency tracking

**Classification Consistency System**:
```typescript
interface ExistingClassifications {
  generalIntent: Set<string>;
  transferReason: Set<string>;
  dropOffLocation: Set<string>;
}

interface BatchProcessor {
  processSessionsBatch(
    sessions: SessionWithTranscript[], 
    existingClassifications: ExistingClassifications,
    openaiApiKey: string
  ): Promise<{
    results: SessionWithFacts[];
    updatedClassifications: ExistingClassifications;
    tokenUsage: TokenUsage;
  }>;
}
```

**Batch Processing Flow**:
1. **Prepare Batch**: Group 5 sessions, handle oversized transcripts individually
2. **Build Prompt**: Include existing classifications for consistency
3. **OpenAI Call**: Use function calling with structured schema
4. **Validate Response**: Ensure all sessions processed, handle partial failures
5. **Update Classifications**: Extract new classifications, add to existing sets
6. **Return Results**: Include metadata and token usage

#### 4. OpenAI Integration Service (`openaiAnalysisService.ts`)
**Purpose**: Handle OpenAI API calls with robust error handling

**Function Schema Implementation**:
```typescript
const SESSION_ANALYSIS_FUNCTION_SCHEMA = {
  name: "analyze_sessions_batch",
  description: "Analyze a batch of session transcripts and classify each session",
  parameters: {
    type: "object",
    properties: {
      sessions: {
        type: "array",
        description: "Array of analyzed sessions",
        items: {
          type: "object",
          properties: {
            user_id: { type: "string" },
            general_intent: { 
              type: "string", 
              description: "1-2 words describing user intent. Examples: Claim Status, Billing, Eligibility, Live Agent, Provider Enrollment, Portal Access, Authorization. Use 'Unknown' if unclear."
            },
            session_outcome: { 
              type: "string", 
              enum: ["Transfer", "Contained"],
              description: "Whether session was transferred to live agent or contained by bot"
            },
            transfer_reason: { 
              type: "string", 
              description: "Why session was transferred (empty if Contained). Examples: Invalid Provider ID, Invalid Member ID, Invalid Claim Number, No Provider ID, Inactive Provider ID, Authentication Failed, Technical Issue, Policy Not Found, Can't Capture Policy Number."
            },
            drop_off_location: { 
              type: "string", 
              description: "Where in session flow user dropped off (empty if Contained). Examples: Policy Number Prompt, Authentication, Claim Details, Member Information, Provider ID, Date of Service, Caller Name."
            },
            notes: { 
              type: "string", 
              description: "One sentence summary of what happened in the session"
            }
          },
          required: ["user_id", "general_intent", "session_outcome", "transfer_reason", "drop_off_location", "notes"]
        }
      }
    },
    required: ["sessions"]
  }
};
```

**Prompt Generation**:
```typescript
function createAnalysisPrompt(
  sessions: SessionWithTranscript[], 
  existingClassifications: ExistingClassifications
): string {
  const intentGuidance = existingClassifications.generalIntent.size > 0 
    ? `\nExisting General Intent classifications: ${Array.from(existingClassifications.generalIntent).sort().join(', ')}`
    : '';
  
  const transferGuidance = existingClassifications.transferReason.size > 0
    ? `\nExisting Transfer Reason classifications: ${Array.from(existingClassifications.transferReason).sort().join(', ')}`
    : '';
  
  const dropOffGuidance = existingClassifications.dropOffLocation.size > 0
    ? `\nExisting Drop-Off Location classifications: ${Array.from(existingClassifications.dropOffLocation).sort().join(', ')}`
    : '';

  return `Analyze the following session transcripts and classify each session according to the specified criteria.

${intentGuidance}${transferGuidance}${dropOffGuidance}

For each session, provide the following classifications:

1. **General Intent**: What the user is trying to accomplish (usually 1-2 words). Common examples: "Claim Status", "Billing", "Eligibility", "Live Agent", "Provider Enrollment", "Portal Access", "Authorization". If unknown, use "Unknown".

2. **Session Outcome**: Either "Transfer" (if session was transferred to live agent) or "Contained" (if session was handled by bot). Classify sessions as "Transfer" if there's a transfer message toward the end of the session (e.g. "Please hold while I connect you with a customer service representative"). Classify sessions as "Contained" if the session was not transferred. Consider that some "Contained" sessions will end with the Bot saying it's ending the conversation ("I am closing our current conversation...").

3. **Transfer Reason**: Why the session was transferred (only if Session Outcome is "Transfer"). Look for specific error messages or invalid responses that caused the transfer. Common reasons: "Invalid Provider ID" (when provider ID is rejected), "Invalid Member ID" (when member ID is rejected), "Invalid Claim Number" (when claim number is rejected), "No Provider ID" (when user says they don't have one), "Inactive Provider ID" (when provider ID is inactive), "Authentication Failed", "Technical Issue", "Policy Not Found", "Can't Capture Policy Number". If not transferred, leave blank.

4. **Drop-Off Location**: Where in the session flow (at which prompt) the user dropped off (started getting routed to an agent). Will only have a value if session_outcome is "Transfer"). Example locations: "Policy Number Prompt", "Authentication", "Claim Details", "Member Information", "Provider ID", "Date of Service", "User Name". If not transferred, leave blank.

5. **Notes**: One sentence summary of what happened in the session.

IMPORTANT: 
- Use existing classifications when possible to maintain consistency
- If Session Outcome is "Contained", leave Transfer Reason and Drop-Off Location blank
- Be concise but descriptive in your classifications

${sessions.map((session, i) => `
--- Session ${i + 1} ---
User ID: ${session.userId}
Transcript:
${session.messages.map(msg => `${msg.from}: ${msg.text}`).join('\n')}
`).join('\n')}`;
}
```

### API Routes (`backend/src/routes/analysis.ts`)

#### Analysis Endpoints
```typescript
// Start new analysis
POST /api/analysis/auto-analyze/start
Body: {
  startDate: string;
  startTime: string;
  sessionCount: number;
  openaiApiKey: string;
}
Response: { analysisId: string }

// Get analysis progress
GET /api/analysis/auto-analyze/progress/:analysisId
Response: AnalysisProgress

// Get analysis results
GET /api/analysis/auto-analyze/results/:analysisId
Response: SessionWithFacts[]

// Cancel analysis (optional)
DELETE /api/analysis/auto-analyze/:analysisId
Response: { cancelled: boolean }
```

### Data Models (`shared/types/index.ts`)

#### Core Analysis Types
```typescript
interface AnalysisConfig {
  startDate: string; // ISO date string
  startTime: string; // HH:MM format in ET
  sessionCount: number; // 10-1000
  openaiApiKey: string;
}

interface SessionWithFacts extends SessionWithTranscript {
  facts: {
    generalIntent: string;
    sessionOutcome: 'Transfer' | 'Contained';
    transferReason: string; // Empty if Contained
    dropOffLocation: string; // Empty if Contained
    notes: string;
  };
  analysisMetadata: {
    tokensUsed: number;
    processingTime: number;
    batchNumber: number;
    timestamp: string;
  };
}

interface AnalysisProgress {
  analysisId: string;
  phase: 'sampling' | 'analyzing' | 'complete' | 'error';
  currentStep: string;
  sessionsFound: number;
  sessionsProcessed: number;
  totalSessions: number;
  batchesCompleted: number;
  totalBatches: number;
  tokensUsed: number;
  estimatedCost: number;
  eta?: number; // seconds
  error?: string;
  startTime: string;
  endTime?: string;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
}

interface ClassificationStats {
  totalSessions: number;
  uniqueIntents: number;
  transferRate: number;
  containmentRate: number;
  topTransferReasons: Array<{ reason: string; count: number; percentage: number }>;
  topIntents: Array<{ intent: string; count: number; percentage: number }>;
  consistency: {
    intentConsistency: number; // 0-1 score
    reasonConsistency: number; // 0-1 score
    locationConsistency: number; // 0-1 score
  };
}
```

## Implementation Strategy

### Phase 1: Core Infrastructure (Week 1-2)
1. **Update Navigation**: Replace `/analyze` placeholder with Auto-Analyze
2. **Data Models**: Define TypeScript interfaces in `shared/types`
3. **Backend Routes**: Create analysis API endpoints
4. **Session Sampling**: Implement time window expansion algorithm
5. **Basic UI**: Configuration form with validation

### Phase 2: AI Analysis Engine (Week 2-3)
1. **Batch Processing**: Implement batch analysis service
2. **Classification Consistency**: Build classification tracking system
3. **OpenAI Integration**: Adapt existing service for batch processing
4. **Error Handling**: Robust error recovery and fallbacks
5. **Progress Tracking**: Real-time progress updates

### Phase 3: User Experience (Week 3-4)
1. **Progress UI**: Pleasant progress indicators and loading states
2. **Results Display**: Comprehensive results table with filtering/sorting
3. **Export Functionality**: CSV/JSON export capabilities
4. **Error Handling**: User-friendly error messages and recovery
5. **Mobile Responsiveness**: Ensure desktop-first responsive design

### Phase 4: Polish & Testing (Week 4-5)
1. **Performance Optimization**: Batch processing and API call optimization
2. **Comprehensive Testing**: Unit, integration, and E2E tests
3. **Documentation**: Update CLAUDE.md and API documentation
4. **User Acceptance Testing**: Validate with Expert Services team
5. **Production Deployment**: Staging and production rollout

## Error Handling Strategy

### Session Sampling Errors
- **Insufficient Sessions**: Clear error with time range expansion suggestions
- **API Failures**: Exponential backoff retry with user notification
- **Authentication Issues**: Clear Bot ID/credential validation messages

### AI Analysis Errors
- **OpenAI API Failures**: Retry individual sessions, provide fallback classifications
- **Token Limits**: Process oversized sessions individually
- **Rate Limits**: Implement intelligent backoff with progress preservation
- **Partial Failures**: Continue processing remaining sessions, mark failed ones

### System Errors
- **Memory Issues**: Implement streaming for large result sets
- **Network Failures**: Preserve progress, allow resumption
- **Data Corruption**: Validate all inputs and outputs, provide diagnostics

## Performance Considerations

### Scalability Targets
- **Session Processing**: 100 sessions in < 5 minutes
- **Memory Usage**: < 500MB for 1000 session analysis
- **Cost Efficiency**: < $2.00 per 100 sessions analyzed
- **UI Responsiveness**: < 100ms for all user interactions

### Optimization Strategies
- **Batch Size Optimization**: Dynamic batch sizing based on transcript length
- **Concurrent Processing**: Process independent batches in parallel where possible
- **Memory Management**: Stream results to avoid memory accumulation
- **Caching**: Cache existing classifications to reduce prompt sizes
- **Progress Batching**: Update UI progress in reasonable intervals to avoid excessive re-renders

## Security Considerations

### API Key Handling
- **Client-Side Storage**: Store OpenAI API key in memory only, never persist
- **Server-Side Security**: Never log or persist API keys in server
- **Transmission Security**: Use HTTPS for all API key transmissions
- **Validation**: Validate API key format before processing

### Data Privacy
- **Session Data**: Handle session transcripts as sensitive data
- **PII Protection**: Ensure no personally identifiable information is logged
- **Compliance**: Follow existing Kore.ai data handling policies
- **Audit Trail**: Log analysis requests without sensitive content

## Testing Strategy

### Unit Tests
- **Service Layer**: Test session sampling, batch processing, classification consistency
- **Utility Functions**: Test time window expansion, random sampling, cost calculation
- **Data Validation**: Test input validation, error handling, edge cases

### Integration Tests
- **API Endpoints**: Test full analysis pipeline with mock data
- **OpenAI Integration**: Test function calling with mock responses
- **Error Scenarios**: Test various failure modes and recovery

### End-to-End Tests
- **Complete Workflow**: Test full user journey from configuration to results
- **Progress Tracking**: Verify real-time progress updates
- **Error Handling**: Test user experience during various error conditions
- **Export Functionality**: Test CSV/JSON export with various data sets

### Performance Tests
- **Load Testing**: Test with maximum session counts (1000 sessions)
- **Memory Testing**: Monitor memory usage during large analyses
- **Cost Validation**: Verify token usage and cost calculations
- **Concurrency Testing**: Test multiple simultaneous analyses

## Monitoring & Observability

### Metrics to Track
- **Analysis Success Rate**: Percentage of analyses that complete successfully
- **Processing Speed**: Average sessions processed per minute
- **Token Usage**: Total tokens and costs across all analyses
- **Error Rates**: Classification of error types and frequencies
- **User Engagement**: Analysis completion rates, session count distributions

### Logging Strategy
- **Analysis Lifecycle**: Log start, progress milestones, and completion
- **Error Details**: Comprehensive error logging without sensitive data
- **Performance Metrics**: Processing times, batch sizes, token usage
- **User Actions**: Configuration choices, export activities (without API keys)

## Future Enhancements

### Short-term (Next 3 months)
- **Visual Reports**: Implement Pareto charts using nivo charts library
- **Export Enhancements**: Add PDF report generation, scheduled exports
- **Analysis Templates**: Save and reuse common analysis configurations
- **Historical Comparison**: Compare analyses across different time periods

### Medium-term (3-6 months)
- **Custom Facts**: Allow users to define custom classification fields
- **Advanced Analytics**: Sentiment analysis, conversation flow visualization
- **Automation**: Scheduled analyses, webhook notifications
- **Multi-language**: Support for non-English session analysis

### Long-term (6+ months)
- **Machine Learning**: Train custom models for client-specific classifications
- **Real-time Analysis**: Stream processing for live session analysis
- **Advanced Visualizations**: Interactive dashboards, trend analysis
- **Enterprise Features**: Multi-tenant support, role-based access control

## Conclusion

The Auto-Analyze feature represents a significant enhancement to XOB CAT's analytical capabilities, providing Expert Services teams with powerful, automated insights into bot performance. The technical design emphasizes robustness, consistency, and user experience while building upon the existing stable infrastructure. The phased implementation approach ensures incremental value delivery while maintaining system stability and quality.