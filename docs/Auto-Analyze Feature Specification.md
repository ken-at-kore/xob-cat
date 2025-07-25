# Auto-Analyze Feature Specification

## Overview

The Auto-Analyze page is a comprehensive bot performance analysis feature that automatically samples sessions from a specified time period, applies AI analysis to extract insights, and generates actionable reports for bot improvement.

## Core Functionality

### Purpose
- Enable Expert Services teams to get automated bot performance insights
- Analyze session transcripts using OpenAI GPT-4o-mini to extract structured facts
- Generate visual reports and recommendations for bot improvement
- Replace the existing placeholder "Analyze Sessions" page

### Key Capabilities
- Random session sampling from specified time periods
- AI-powered session fact extraction (intent, outcome, transfer reasons, etc.)
- Consistent classification across batches using iterative learning
- Progress tracking with pleasant UX during analysis
- Results display in structured table format
- Future: Visual reports with Pareto charts and recommendations

## User Experience Flow

### Phase 1: Configuration Page
**Location**: `/analyze` (accessed via sidebar)

**Page Content**:
- Feature explanation: Brief description of Auto-Analyze capabilities
- Configuration form with the following fields:
  - **Start Date**: Date picker (default: 7 days before current date)
  - **Start Time**: Time input in ET timezone (default: 9:00 AM ET)
  - **Number of Sessions**: Number input (default: 100, max: 1000, min: 10)
  - **OpenAI API Key**: Secure text input for API key
- **Submit Button**: "Start Analysis" - triggers the analysis process

**Validation**:
- Sessions count: 10 ≤ count ≤ 1000
- OpenAI API Key: Required, non-empty
- Date/Time: Must be in the past

### Phase 2: Session Sampling
**Process**: Intelligent time window expansion algorithm

**Algorithm**:
1. **Initial Search**: Query sessions in 3-hour window starting from user-specified date/time
2. **Expansion Strategy** (if insufficient sessions found):
   - **Next 6 hours**: Extend window to 6 hours total
   - **Next 12 hours**: Extend window to 12 hours total  
   - **Next 6 days**: Extend window to 6 days total
3. **Minimum Threshold**: If < 10 sessions found after all expansions, abort with error
4. **Random Sampling**: If more sessions found than requested, randomly sample the target number

**UI During Sampling**:
- Progress indicator showing "Finding sessions..."
- Display current time window being searched
- Show session count as it accumulates

### Phase 3: AI Analysis Process
**Processing**: Convert SWT (Session With Transcript) → SWF (Session With Facts)

**Batch Processing Strategy**:
- Process sessions in batches of ~5 sessions
- Maintain classification consistency across batches
- Handle long transcripts individually
- Robust error handling with fallback results

**Facts Extracted** (MVP set):
1. **General Intent**: What the user is trying to accomplish (1-2 words)
2. **Session Outcome**: "Transfer" or "Contained"
3. **Transfer Reason**: Why session was transferred (if applicable)
4. **Drop-off Location**: Where in flow user dropped off (if transferred)
5. **Notes**: One-sentence summary of what happened

**UI During Analysis**:
- Progress bar showing batch completion
- Current batch number and total batches
- Token usage and cost estimation in real-time
- ETA calculation based on average batch processing time

### Phase 4: Results Display
**Format**: Data table showing session information + extracted facts

**Columns**:
- Session ID / User ID
- Timestamp
- General Intent
- Session Outcome
- Transfer Reason (if applicable)
- Drop-off Location (if applicable)
- Notes
- Actions (view transcript, etc.)

**Features**:
- Sortable columns
- Filterable by any fact type
- Export capabilities (CSV, JSON)
- Token usage summary and cost breakdown
- Classification consistency statistics

## Technical Architecture

### Data Models

#### Session With Facts (SWF)
```typescript
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
    confidence?: number;
  };
}
```

#### Analysis Configuration
```typescript
interface AnalysisConfig {
  startDate: string; // ISO date
  startTime: string; // HH:MM format in ET
  sessionCount: number; // 10-1000
  openaiApiKey: string;
}
```

#### Analysis Progress
```typescript
interface AnalysisProgress {
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
}
```

### API Endpoints

#### Start Analysis
```
POST /api/analysis/auto-analyze/start
Body: AnalysisConfig
Response: { analysisId: string }
```

#### Get Progress
```
GET /api/analysis/auto-analyze/progress/:analysisId
Response: AnalysisProgress
```

#### Get Results
```
GET /api/analysis/auto-analyze/results/:analysisId
Response: SessionWithFacts[]
```

### Session Sampling Algorithm

#### Time Window Strategy
```typescript
interface TimeWindow {
  start: Date;
  duration: number; // hours
  label: string;
}

const EXPANSION_STRATEGY: TimeWindow[] = [
  { start: userDateTime, duration: 3, label: "Initial 3-hour window" },
  { start: userDateTime, duration: 6, label: "Extended to 6 hours" },
  { start: userDateTime, duration: 12, label: "Extended to 12 hours" },
  { start: userDateTime, duration: 144, label: "Extended to 6 days" } // 6 * 24 = 144 hours
];
```

#### Implementation Logic
1. **Query Kore.ai API**: Use existing `koreApiService.ts` with time range filters
2. **Random Sampling**: Use Fisher-Yates shuffle for unbiased random selection
3. **Deduplication**: Ensure no duplicate sessions in sample
4. **Quality Filtering**: Filter out sessions with minimal content (< 2 messages)

### AI Analysis Engine

#### Batch Processing
- **Batch Size**: 5 sessions per batch (optimal for GPT-4o-mini context window)
- **Character Limits**: Max 50,000 characters per batch, process longer sessions individually
- **Consistency Tracking**: Maintain sets of existing classifications across batches

#### Classification Consistency Algorithm
```typescript
interface ExistingClassifications {
  generalIntent: Set<string>;
  transferReason: Set<string>;
  dropOffLocation: Set<string>;
}
```

**Process**:
1. Start with empty classification sets
2. After each batch, extract new classifications and add to sets
3. Pass existing classifications to next batch for consistency
4. LLM instruction: "Use existing classifications when possible"

#### OpenAI Integration
- **Model**: GPT-4o-mini (cost-effective, sufficient for classification)
- **Method**: Function calling with structured schema
- **Temperature**: 0 (deterministic results)
- **Error Handling**: Retry individual sessions on batch failures
- **Rate Limiting**: 2-second delays between batches

#### Function Schema
```typescript
const ANALYSIS_FUNCTION_SCHEMA = {
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
            general_intent: { type: "string", description: "1-2 words describing user intent" },
            session_outcome: { type: "string", enum: ["Transfer", "Contained"] },
            transfer_reason: { type: "string", description: "Why transferred (empty if Contained)" },
            drop_off_location: { type: "string", description: "Where user dropped off (empty if Contained)" },
            notes: { type: "string", description: "One sentence summary" }
          },
          required: ["user_id", "general_intent", "session_outcome", "transfer_reason", "drop_off_location", "notes"]
        }
      }
    },
    required: ["sessions"]
  }
};
```

### Error Handling Strategy

#### Session Sampling Errors
- **Insufficient Sessions**: Clear error message with suggestions (expand time range, try different date)
- **API Failures**: Retry logic with exponential backoff
- **Authentication Issues**: Clear instructions for Bot ID/credentials

#### Analysis Errors
- **OpenAI API Failures**: Retry individual sessions, provide fallback classifications
- **Token Limit Exceeded**: Process long sessions individually
- **Quota Exceeded**: Pause and display clear cost/quota information

#### Recovery Mechanisms
- **Partial Results**: Save progress after each batch, allow resumption
- **Graceful Degradation**: Provide "Unknown" classifications for failed sessions
- **User Communication**: Clear progress updates and error explanations

## Implementation Plan

### Phase 1: Core Infrastructure
1. **Navigation Update**: Replace existing `/analyze` page placeholder
2. **Data Models**: Define TypeScript interfaces in `shared/types`
3. **API Routes**: Create analysis endpoints in `backend/src/routes/analysis.ts`
4. **Session Sampling**: Implement time window expansion algorithm

### Phase 2: AI Analysis Engine
1. **Batch Processing**: Implement batch analysis service
2. **Classification Consistency**: Build classification tracking system
3. **OpenAI Integration**: Adapt existing `openaiService.ts` for batch processing
4. **Progress Tracking**: Real-time progress updates via polling/websockets

### Phase 3: User Interface
1. **Configuration Page**: Build form with validation
2. **Progress UI**: Implement pleasant progress indicators
3. **Results Table**: Display analyzed sessions with filtering/sorting
4. **Error Handling**: User-friendly error messages and recovery options

### Phase 4: Polish & Optimization
1. **Performance**: Optimize batch processing and API calls
2. **UX Refinement**: Smooth transitions and loading states
3. **Testing**: Comprehensive unit, integration, and E2E tests
4. **Documentation**: Update CLAUDE.md and API documentation

## Success Metrics

### Functional Requirements
- [ ] Successfully sample sessions across various time windows
- [ ] Achieve >95% classification success rate
- [ ] Process 100 sessions in <5 minutes
- [ ] Maintain classification consistency >90% across batches
- [ ] Handle errors gracefully with clear user communication

### Performance Requirements
- [ ] Cost per 100 sessions: <$2.00 USD
- [ ] Average processing time: <3 seconds per session
- [ ] UI responsiveness: <100ms for all user interactions
- [ ] Memory usage: <500MB for 1000 session analysis

### User Experience Requirements
- [ ] Intuitive configuration with smart defaults
- [ ] Clear progress indication throughout process
- [ ] Easily interpretable results with actionable insights
- [ ] Error recovery without losing progress
- [ ] Mobile-responsive design (desktop-first)

## Future Enhancements (Post-MVP)

### Advanced Analysis
- Custom fact extraction (user-defined fields)
- Multi-language support
- Sentiment analysis integration
- Conversation flow visualization

### Reporting & Visualization
- Pareto charts for pain points (using nivo charts)
- Transfer reason analysis dashboards
- Time-series trend analysis
- Automated improvement recommendations

### Data Management
- Session analysis caching
- Historical analysis comparison
- Bulk export capabilities
- Analysis template library

### Integration Features
- Slack/Teams notifications for completed analyses
- Scheduled analysis runs
- API for external tool integration
- Custom webhook support

## Dependencies

### Required
- OpenAI GPT-4o-mini API access
- Existing Kore.ai API integration
- Current session retrieval infrastructure

### Optional (Future)
- WebSocket support for real-time progress
- Nivo charts library for visualizations
- Background job processing system
- Notification services integration

## Risk Assessment

### High Risk
- **OpenAI API costs**: Could exceed budget with large analyses
- **Classification consistency**: May drift across large batches
- **Session sampling bias**: Random sampling may not be representative

### Medium Risk
- **API rate limits**: Both OpenAI and Kore.ai have rate constraints
- **Memory usage**: Large session datasets could impact performance
- **User experience**: Complex process needs careful UX design

### Low Risk
- **Technical implementation**: Builds on existing stable infrastructure
- **Data quality**: Using proven session retrieval methods
- **Error handling**: Comprehensive fallback strategies planned

## Conclusion

The Auto-Analyze feature represents a significant enhancement to XOB CAT's analytical capabilities, providing Expert Services teams with automated, AI-powered insights into bot performance. The feature is designed with robust error handling, consistent classification, and an intuitive user experience, while building upon the existing stable technical foundation.