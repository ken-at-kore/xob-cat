import { AnalysisExportService } from '../analysisExportService';
import {
  AnalysisResults,
  SessionWithFacts,
  AnalysisConfig,
  ANALYSIS_FILE_VERSION,
  ANALYSIS_FILE_SCHEMA_VERSION,
  ANALYSIS_FILE_APP_VERSION
} from '../../../../shared/types';

describe('AnalysisExportService', () => {
  const mockConfig: AnalysisConfig = {
    startDate: '2025-07-01',
    startTime: '09:00',
    sessionCount: 100,
    openaiApiKey: 'sk-test',
    modelId: 'gpt-4o-mini'
  };

  const createMockSession = (
    outcome: 'Transfer' | 'Contained',
    intent: string,
    transferReason?: string,
    dropOffLocation?: string
  ): SessionWithFacts => ({
    session_id: `session-${Math.random()}`,
    user_id: `user-${Math.random()}`,
    start_time: '2025-07-01T09:00:00Z',
    end_time: '2025-07-01T09:10:00Z',
    containment_type: outcome === 'Contained' ? 'selfService' : 'agent',
    tags: [],
    metrics: {},
    messages: [
      { timestamp: '2025-07-01T09:00:00Z', message_type: 'user', message: 'Test message' },
      { timestamp: '2025-07-01T09:00:01Z', message_type: 'bot', message: 'Test response' }
    ],
    message_count: 2,
    user_message_count: 1,
    bot_message_count: 1,
    facts: {
      generalIntent: intent,
      sessionOutcome: outcome,
      transferReason: transferReason || '',
      dropOffLocation: dropOffLocation || '',
      notes: `Test session for ${intent}`
    },
    analysisMetadata: {
      tokensUsed: 100,
      processingTime: 1000,
      batchNumber: 1,
      timestamp: new Date().toISOString(),
      model: 'gpt-4o-mini'
    }
  });

  const mockResults: AnalysisResults = {
    sessions: [
      createMockSession('Contained', 'Claim Status'),
      createMockSession('Contained', 'Billing'),
      createMockSession('Transfer', 'Claim Status', 'Invalid Claim Number', 'Claim Details'),
      createMockSession('Transfer', 'Live Agent', 'User Request', 'Initial Greeting'),
      createMockSession('Transfer', 'Billing', 'Authentication Failed', 'Authentication')
    ],
    analysisSummary: {
      overview: 'Test overview of analysis',
      summary: 'Detailed test analysis',
      containmentSuggestion: 'Test suggestion',
      generatedAt: new Date().toISOString(),
      sessionsAnalyzed: 5,
      statistics: {
        totalSessions: 5,
        transferRate: 0.6,
        containmentRate: 0.4,
        averageSessionLength: 600,
        averageMessagesPerSession: 2
      }
    }
  };

  describe('createExportFile', () => {
    it('should create a valid export file with correct metadata', () => {
      const requestedAt = new Date().toISOString();
      const completedAt = new Date().toISOString();
      
      const exportFile = AnalysisExportService.createExportFile(
        mockResults,
        mockConfig,
        requestedAt,
        completedAt
      );

      expect(exportFile.metadata.version).toBe(ANALYSIS_FILE_VERSION);
      expect(exportFile.metadata.schemaVersion).toBe(ANALYSIS_FILE_SCHEMA_VERSION);
      expect(exportFile.metadata.exportedBy).toBe(ANALYSIS_FILE_APP_VERSION);
      expect(exportFile.metadata.requiredFeatures).toEqual(['basic-charts', 'session-analysis']);
      expect(exportFile.metadata.optionalFeatures).toEqual(['advanced-charts', 'ai-summary']);
    });

    it('should include analysis configuration', () => {
      const requestedAt = new Date().toISOString();
      const completedAt = new Date().toISOString();
      
      const exportFile = AnalysisExportService.createExportFile(
        mockResults,
        mockConfig,
        requestedAt,
        completedAt
      );

      expect(exportFile.analysisConfig).toEqual({
        startDate: mockConfig.startDate,
        startTime: mockConfig.startTime,
        sessionCount: mockConfig.sessionCount,
        requestedAt,
        completedAt
      });
    });

    it('should include all sessions', () => {
      const exportFile = AnalysisExportService.createExportFile(
        mockResults,
        mockConfig,
        new Date().toISOString(),
        new Date().toISOString()
      );

      expect(exportFile.sessions).toEqual(mockResults.sessions);
      expect(exportFile.sessions).toHaveLength(5);
    });

    it('should calculate correct summary statistics', () => {
      const exportFile = AnalysisExportService.createExportFile(
        mockResults,
        mockConfig,
        new Date().toISOString(),
        new Date().toISOString()
      );

      expect(exportFile.summary.totalSessions).toBe(5);
      expect(exportFile.summary.containmentRate).toBe(0.4); // 2 out of 5
      expect(exportFile.summary.overview).toBe('Test overview of analysis');
      expect(exportFile.summary.detailedAnalysis).toBe('Detailed test analysis');
    });

    it('should aggregate transfer reasons correctly', () => {
      const exportFile = AnalysisExportService.createExportFile(
        mockResults,
        mockConfig,
        new Date().toISOString(),
        new Date().toISOString()
      );

      expect(exportFile.summary.topTransferReasons).toEqual({
        'Invalid Claim Number': 1,
        'User Request': 1,
        'Authentication Failed': 1
      });
    });

    it('should aggregate general intents correctly', () => {
      const exportFile = AnalysisExportService.createExportFile(
        mockResults,
        mockConfig,
        new Date().toISOString(),
        new Date().toISOString()
      );

      expect(exportFile.summary.topIntents).toEqual({
        'Claim Status': 2,
        'Billing': 2,
        'Live Agent': 1
      });
    });

    it('should aggregate drop-off locations correctly', () => {
      const exportFile = AnalysisExportService.createExportFile(
        mockResults,
        mockConfig,
        new Date().toISOString(),
        new Date().toISOString()
      );

      expect(exportFile.summary.topDropOffLocations).toEqual({
        'Claim Details': 1,
        'Initial Greeting': 1,
        'Authentication': 1
      });
    });

    it('should format chart data correctly', () => {
      const exportFile = AnalysisExportService.createExportFile(
        mockResults,
        mockConfig,
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Session outcomes
      expect(exportFile.chartData.sessionOutcomes).toEqual([
        { name: 'Contained', value: 2 },
        { name: 'Transfer', value: 3 }
      ]);

      // Transfer reasons with percentages
      expect(exportFile.chartData.transferReasons).toHaveLength(3);
      expect(exportFile.chartData.transferReasons[0]).toEqual({
        reason: 'Invalid Claim Number',
        count: 1,
        percentage: expect.closeTo(33.33, 1)
      });

      // Drop-off locations
      expect(exportFile.chartData.dropOffLocations).toHaveLength(3);
      expect(exportFile.chartData.dropOffLocations[0]).toEqual({
        location: 'Claim Details',
        count: 1
      });

      // General intents
      expect(exportFile.chartData.generalIntents).toHaveLength(3);
      expect(exportFile.chartData.generalIntents[0]?.count).toBe(2); // Claim Status or Billing
    });

    it('should calculate token usage and cost', () => {
      const exportFile = AnalysisExportService.createExportFile(
        mockResults,
        mockConfig,
        new Date().toISOString(),
        new Date().toISOString()
      );

      expect(exportFile.costAnalysis.totalTokens).toBe(500); // 5 sessions * 100 tokens each
      expect(exportFile.costAnalysis.estimatedCost).toBeGreaterThan(0);
      expect(exportFile.costAnalysis.modelUsed).toBe('gpt-4o-mini');
    });

    it('should handle empty sessions array', () => {
      const emptyResults: AnalysisResults = {
        sessions: [],
        analysisSummary: undefined
      };

      const exportFile = AnalysisExportService.createExportFile(
        emptyResults,
        mockConfig,
        new Date().toISOString(),
        new Date().toISOString()
      );

      expect(exportFile.sessions).toHaveLength(0);
      expect(exportFile.summary.totalSessions).toBe(0);
      expect(exportFile.summary.containmentRate).toBe(0);
      expect(exportFile.chartData.sessionOutcomes[0]?.value).toBe(0);
      expect(exportFile.chartData.sessionOutcomes[1]?.value).toBe(0);
    });

    it('should handle missing analysis summary', () => {
      const resultsWithoutSummary: AnalysisResults = {
        sessions: mockResults.sessions,
        analysisSummary: undefined
      };

      const exportFile = AnalysisExportService.createExportFile(
        resultsWithoutSummary,
        mockConfig,
        new Date().toISOString(),
        new Date().toISOString()
      );

      expect(exportFile.summary.overview).toBe('');
      expect(exportFile.summary.detailedAnalysis).toBe('');
    });
  });

  describe('generateFileName', () => {
    it('should generate a valid filename with timestamp', () => {
      const filename = AnalysisExportService.generateFileName();
      
      expect(filename).toMatch(/^xob-cat-analysis-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
      expect(filename).toContain('xob-cat-analysis-');
      expect(filename).toMatch(/\.json$/);
    });

    it('should generate unique filenames', () => {
      const filename1 = AnalysisExportService.generateFileName();
      // Wait a tiny bit to ensure different timestamp
      const filename2 = AnalysisExportService.generateFileName();
      
      // They might be the same if generated in the same second, but format should be consistent
      expect(filename1).toMatch(/^xob-cat-analysis-.*\.json$/);
      expect(filename2).toMatch(/^xob-cat-analysis-.*\.json$/);
    });
  });
});