import { AnalysisFileValidator } from '../../../../shared/services/analysisFileValidator';
import {
  AnalysisExportFile,
  ANALYSIS_FILE_VERSION,
  ANALYSIS_FILE_SCHEMA_VERSION,
  ANALYSIS_FILE_APP_VERSION
} from '../../../../shared/types';

describe('AnalysisFileValidator', () => {
  // Helper to create a valid file structure
  const createValidFile = (overrides?: Partial<AnalysisExportFile>): AnalysisExportFile => ({
    metadata: {
      version: ANALYSIS_FILE_VERSION,
      schemaVersion: ANALYSIS_FILE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: ANALYSIS_FILE_APP_VERSION,
      requiredFeatures: ['basic-charts', 'session-analysis'],
      optionalFeatures: ['advanced-charts', 'ai-summary']
    },
    analysisConfig: {
      startDate: '2025-07-01',
      startTime: '09:00',
      sessionCount: 100,
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    },
    sessions: [{
      session_id: 'test-123',
      user_id: 'user-456',
      start_time: '2025-07-01T09:00:00Z',
      end_time: '2025-07-01T09:10:00Z',
      containment_type: 'agent',
      tags: [],
      metrics: {},
      messages: [
        { timestamp: '2025-07-01T09:00:00Z', message_type: 'user', message: 'Hello' },
        { timestamp: '2025-07-01T09:00:01Z', message_type: 'bot', message: 'Hi there!' }
      ],
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1,
      facts: {
        generalIntent: 'Greeting',
        sessionOutcome: 'Contained',
        transferReason: '',
        dropOffLocation: '',
        notes: 'Simple greeting exchange'
      },
      analysisMetadata: {
        tokensUsed: 100,
        processingTime: 1000,
        batchNumber: 1,
        timestamp: new Date().toISOString()
      }
    }],
    summary: {
      overview: 'Test overview',
      detailedAnalysis: 'Test analysis',
      totalSessions: 100,
      containmentRate: 0.75,
      topTransferReasons: { 'Invalid ID': 10 },
      topIntents: { 'Claim Status': 25 },
      topDropOffLocations: { 'Authentication': 5 }
    },
    chartData: {
      sessionOutcomes: [
        { name: 'Contained', value: 75 },
        { name: 'Transfer', value: 25 }
      ],
      transferReasons: [
        { reason: 'Invalid ID', count: 10, percentage: 40 }
      ],
      dropOffLocations: [
        { location: 'Authentication', count: 5 }
      ],
      generalIntents: [
        { intent: 'Claim Status', count: 25 }
      ]
    },
    costAnalysis: {
      totalTokens: 10000,
      estimatedCost: 0.15,
      modelUsed: 'gpt-4o-mini'
    },
    ...overrides
  });

  describe('validateFile', () => {
    it('should validate a correct file structure', () => {
      const file = createValidFile();
      const result = AnalysisFileValidator.validateFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.version).toBe(ANALYSIS_FILE_VERSION);
      expect(result.schemaVersion).toBe(ANALYSIS_FILE_SCHEMA_VERSION);
    });

    it('should reject invalid basic structure', () => {
      const invalidFiles = [
        null,
        undefined,
        'string',
        123,
        [],
        {},
        { metadata: {} },
        { metadata: {}, sessions: [] }
      ];

      invalidFiles.forEach(file => {
        const result = AnalysisFileValidator.validateFile(file);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid file structure. This does not appear to be an XOB CAT analysis export file.');
      });
    });

    it('should reject files with missing required properties', () => {
      const requiredProps = ['metadata', 'analysisConfig', 'sessions', 'summary', 'chartData', 'costAnalysis'];
      
      requiredProps.forEach(prop => {
        const file: any = createValidFile();
        delete file[prop];
        
        const result = AnalysisFileValidator.validateFile(file);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid file structure. This does not appear to be an XOB CAT analysis export file.');
      });
    });
  });

  describe('version validation', () => {
    it('should accept supported versions', () => {
      const supportedVersions = ['1.0.0', '1.0.1', '1.0.2'];
      
      supportedVersions.forEach(version => {
        const file = createValidFile({
          metadata: {
            ...createValidFile().metadata,
            version
          }
        });
        
        const result = AnalysisFileValidator.validateFile(file);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject unsupported schema versions', () => {
      const file = createValidFile({
        metadata: {
          ...createValidFile().metadata,
          schemaVersion: '2.0'
        }
      });
      
      const result = AnalysisFileValidator.validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported schema version: 2.0. This file requires a newer version of XOB CAT.');
    });

    it('should reject unknown file versions', () => {
      const file = createValidFile({
        metadata: {
          ...createValidFile().metadata,
          version: '1.5.0'
        }
      });
      
      const result = AnalysisFileValidator.validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Unknown file version: 1.5.0');
    });

    it('should warn about deprecated versions when implemented', () => {
      // This test is ready for when deprecated versions are added
      const file = createValidFile({
        metadata: {
          ...createValidFile().metadata,
          version: '0.9.0' // Would be in deprecatedVersions if added
        }
      });
      
      const result = AnalysisFileValidator.validateFile(file);
      // Currently fails because 0.9.0 is unknown, but would warn if deprecated
      expect(result.isValid).toBe(false);
    });

    it('should reject files with missing required features', () => {
      const file = createValidFile({
        metadata: {
          ...createValidFile().metadata,
          requiredFeatures: ['basic-charts', 'session-analysis', 'unknown-feature']
        }
      });
      
      const result = AnalysisFileValidator.validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('This file requires features not available in this version: unknown-feature');
    });
  });

  describe('data validation', () => {
    it('should validate analysis config', () => {
      const invalidConfigs = [
        { startDate: null },
        { startTime: null },
        { sessionCount: 'not-a-number' },
        {}
      ];

      invalidConfigs.forEach(invalidConfig => {
        const file = createValidFile({
          analysisConfig: invalidConfig as any
        });
        
        const result = AnalysisFileValidator.validateFile(file);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Analysis configuration data is missing or invalid.');
      });
    });

    it('should warn about empty sessions', () => {
      const file = createValidFile({
        sessions: []
      });
      
      const result = AnalysisFileValidator.validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No sessions found in the analysis file.');
    });

    it('should validate session structure', () => {
      const invalidSession = {
        session_id: 'test',
        // Missing required fields
      };
      
      const file = createValidFile({
        sessions: [invalidSession as any]
      });
      
      const result = AnalysisFileValidator.validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Session data structure is invalid.');
    });

    it('should validate summary data', () => {
      const file = createValidFile({
        summary: {
          ...createValidFile().summary,
          overview: null as any,
          totalSessions: 'not-a-number' as any
        }
      });
      
      const result = AnalysisFileValidator.validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Analysis summary data is missing or invalid.');
    });

    it('should validate chart data', () => {
      const file = createValidFile({
        chartData: {
          ...createValidFile().chartData,
          sessionOutcomes: 'not-an-array' as any,
          transferReasons: null as any
        }
      });
      
      const result = AnalysisFileValidator.validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Chart data is missing or invalid.');
    });

    it('should warn about incomplete cost analysis', () => {
      const file = createValidFile({
        costAnalysis: {
          totalTokens: null as any,
          estimatedCost: 0.15,
          modelUsed: 'gpt-4o-mini'
        }
      });
      
      const result = AnalysisFileValidator.validateFile(file);
      expect(result.warnings).toContain('Cost analysis data is incomplete.');
    });
  });

  describe('file size validation', () => {
    it('should accept files under size limit', () => {
      const result = AnalysisFileValidator.validateFileSize(10 * 1024 * 1024); // 10MB
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about files approaching size limit', () => {
      const result = AnalysisFileValidator.validateFileSize(45 * 1024 * 1024); // 45MB
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain('File size is approaching the maximum limit. Consider analyzing fewer sessions.');
    });

    it('should reject files over size limit', () => {
      const result = AnalysisFileValidator.validateFileSize(60 * 1024 * 1024); // 60MB
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size exceeds maximum allowed size of 50MB.');
    });
  });

  describe('JSON parsing', () => {
    it('should parse valid JSON', () => {
      const validJson = JSON.stringify(createValidFile());
      const result = AnalysisFileValidator.parseJsonFile(validJson);
      
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should handle invalid JSON', () => {
      const invalidJson = '{ invalid json }';
      const result = AnalysisFileValidator.parseJsonFile(invalidJson);
      
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Invalid JSON file. Please ensure the file is a valid JSON format.');
    });
  });
});