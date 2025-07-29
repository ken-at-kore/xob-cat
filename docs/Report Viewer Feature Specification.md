# Report Viewer Feature Specification

## Overview
The Report Viewer feature enables power users to export analysis reports as JSON files and share them with stakeholders who can view the reports without accessing the full XOB CAT application.

## User Flows

### Flow 1: Power User Export
1. Power user completes an Auto-Analysis
2. Clicks "Download Report Data" button on results page
3. Browser downloads `xob-cat-analysis-{timestamp}.json` file
4. Power user shares file with stakeholders

### Flow 2: Stakeholder View
1. Stakeholder navigates to `/report-viewer`
2. Sees minimal UI with file upload interface
3. Uploads the JSON analysis file
4. System validates file version and structure
5. Redirected to `/report-viewer/view` to see full report
6. Can click "Start New Analysis" to go to main app

## Technical Requirements

### File Format Specification

#### Version 1.0 Schema
```typescript
interface AnalysisExportFile {
  metadata: {
    version: "1.0.0";              // File format version
    schemaVersion: "1.0";          // Schema compatibility version
    exportedAt: string;            // ISO 8601 timestamp
    exportedBy: string;            // App version (e.g., "XOB-CAT-1.0.0")
    requiredFeatures: string[];    // ["basic-charts", "session-analysis"]
    optionalFeatures: string[];    // ["advanced-charts", "ai-summary"]
  };
  
  analysisConfig: {
    startDate: string;
    startTime: string;
    sessionCount: number;
    requestedAt: string;
    completedAt: string;
  };
  
  sessions: AnalysisResult[];      // Full session analysis data
  
  summary: {
    overview: string;              // AI-generated overview
    detailedAnalysis: string;      // AI-generated detailed analysis
    totalSessions: number;
    containmentRate: number;
    topTransferReasons: Record<string, number>;
    topIntents: Record<string, number>;
    topDropOffLocations: Record<string, number>;
  };
  
  chartData: {
    sessionOutcomes: Array<{name: string; value: number}>;
    transferReasons: Array<{reason: string; count: number; percentage: number}>;
    dropOffLocations: Array<{location: string; count: number}>;
    generalIntents: Array<{intent: string; count: number}>;
  };
  
  costAnalysis: {
    totalTokens: number;
    estimatedCost: number;
    modelUsed: string;
  };
}
```

### Version Compatibility Rules
1. **Major Version Changes (X.0.0)**: Breaking changes, files not compatible
2. **Minor Version Changes (1.X.0)**: New optional features, backward compatible
3. **Patch Version Changes (1.0.X)**: Bug fixes, fully compatible

### Supported Versions Matrix
```typescript
const COMPATIBILITY_MATRIX = {
  "1.0": {
    supportedVersions: ["1.0.0", "1.0.1", "1.0.2"],
    deprecatedVersions: [],
    unsupportedVersions: [],
    requiredFeatures: ["basic-charts", "session-analysis"],
    optionalFeatures: ["advanced-charts", "ai-summary"]
  }
};
```

## UI/UX Requirements

### Report Viewer Upload Page (`/report-viewer`)
- Minimal layout (no sidebar, no navigation)
- Simple header with XOB CAT branding
- Centered upload interface:
  - Drag-and-drop area
  - "Choose File" button
  - File validation feedback
  - Clear error messages
- Link to main application

### Report Viewer Display Page (`/report-viewer/view`)
- Reuses `AnalysisReportView` component
- Custom behavior for "Start New Analysis" → redirects to `/`
- No sidebar or main navigation
- Simple header with "XOB CAT Report Viewer" title
- "Upload New Report" button to return to upload page

## Error Handling

### File Validation Errors
1. **Invalid JSON**: "The selected file is not a valid JSON file."
2. **Wrong Structure**: "This file does not appear to be an XOB CAT analysis export."
3. **Unsupported Version**: "This file requires XOB CAT version X.X or higher."
4. **Missing Required Data**: "The analysis file is missing required data: [field names]."
5. **Corrupted Data**: "The analysis data appears to be corrupted or incomplete."

### Feature Degradation Warnings
1. **Optional Features**: "Some advanced features may not be available in this viewer."
2. **Deprecated Version**: "This file uses an older format. Some features may be limited."

## Security Considerations
1. Client-side file validation only (no server upload)
2. Strict JSON parsing with size limits (max 50MB)
3. Sanitize all rendered content
4. No execution of arbitrary code from files

## Testing Requirements

### Unit Tests
1. Version validation logic
2. File structure validation
3. Feature compatibility checking
4. Export file generation
5. Error message generation

### Integration Tests
1. Complete export flow from analysis page
2. Complete import flow in report viewer
3. Version mismatch handling
4. Large file handling

### E2E Tests
1. Full workflow: analyze → export → share → import → view
2. Error scenarios: invalid files, version mismatches
3. Navigation between viewer and main app

### Visual Tests
1. Upload interface in various states
2. Report display with different data sets
3. Error states and messages
4. Responsive design validation

## Implementation Priority
1. Core file format and versioning system
2. Export functionality on analysis page
3. Basic report viewer with upload
4. Version validation and error handling
5. Feature degradation support
6. Enhanced UI/UX polish

## Success Metrics
1. Zero data loss during export/import
2. Clear error messages for all failure cases
3. <3 second load time for reports up to 1000 sessions
4. 100% compatibility within same major version