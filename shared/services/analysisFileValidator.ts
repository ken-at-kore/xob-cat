import {
  AnalysisExportFile,
  VERSION_COMPATIBILITY_MATRIX,
  ANALYSIS_FILE_SCHEMA_VERSION,
  SessionWithFacts
} from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  version?: string;
  schemaVersion?: string;
}

export class AnalysisFileValidator {
  static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  static validateFile(data: unknown): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Basic structure validation
    if (!this.isValidStructure(data)) {
      result.isValid = false;
      result.errors.push('Invalid file structure. This does not appear to be an XOB CAT analysis export file.');
      return result;
    }

    const file = data as AnalysisExportFile;
    result.version = file.metadata?.version;
    result.schemaVersion = file.metadata?.schemaVersion;

    // Version validation
    const versionValidation = this.validateVersion(file);
    if (!versionValidation.isValid) {
      result.isValid = false;
      result.errors.push(...versionValidation.errors);
    }
    result.warnings.push(...versionValidation.warnings);

    // Data validation
    const dataValidation = this.validateData(file);
    if (!dataValidation.isValid) {
      result.isValid = false;
      result.errors.push(...dataValidation.errors);
    }
    result.warnings.push(...dataValidation.warnings);

    return result;
  }

  private static isValidStructure(data: unknown): data is AnalysisExportFile {
    if (!data || typeof data !== 'object') return false;
    
    const file = data as any;
    
    // Check required top-level properties
    const requiredProps = ['metadata', 'analysisConfig', 'sessions', 'summary', 'chartData', 'costAnalysis'];
    for (const prop of requiredProps) {
      if (!(prop in file)) return false;
    }

    // Check metadata structure
    if (!file.metadata || 
        typeof file.metadata.version !== 'string' ||
        typeof file.metadata.schemaVersion !== 'string' ||
        typeof file.metadata.exportedAt !== 'string' ||
        typeof file.metadata.exportedBy !== 'string' ||
        !Array.isArray(file.metadata.requiredFeatures) ||
        !Array.isArray(file.metadata.optionalFeatures)) {
      return false;
    }

    // Check sessions array
    if (!Array.isArray(file.sessions)) return false;

    return true;
  }

  private static validateVersion(file: AnalysisExportFile): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const schemaVersion = file.metadata.schemaVersion;
    const fileVersion = file.metadata.version;

    // Check if schema version is supported
    const compatibility = VERSION_COMPATIBILITY_MATRIX[schemaVersion];
    if (!compatibility) {
      result.isValid = false;
      result.errors.push(`Unsupported schema version: ${schemaVersion}. This file requires a newer version of XOB CAT.`);
      return result;
    }

    // Check if specific version is supported
    if (compatibility.unsupportedVersions.includes(fileVersion)) {
      result.isValid = false;
      result.errors.push(`This file version (${fileVersion}) is no longer supported. Please re-export the analysis.`);
    } else if (compatibility.deprecatedVersions.includes(fileVersion)) {
      result.warnings.push(`This file version (${fileVersion}) is deprecated. Some features may be limited.`);
    } else if (!compatibility.supportedVersions.includes(fileVersion)) {
      result.isValid = false;
      result.errors.push(`Unknown file version: ${fileVersion}. This file may have been created with a different version of XOB CAT.`);
    }

    // Check required features
    const missingFeatures = file.metadata.requiredFeatures.filter(
      feature => !compatibility.requiredFeatures.includes(feature)
    );
    if (missingFeatures.length > 0) {
      result.isValid = false;
      result.errors.push(`This file requires features not available in this version: ${missingFeatures.join(', ')}`);
    }

    // Check optional features
    const unavailableFeatures = file.metadata.optionalFeatures.filter(
      feature => compatibility.optionalFeatures && !compatibility.optionalFeatures.includes(feature)
    );
    if (unavailableFeatures.length > 0) {
      result.warnings.push(`Some optional features may not be available: ${unavailableFeatures.join(', ')}`);
    }

    return result;
  }

  private static validateData(file: AnalysisExportFile): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Validate analysis config
    if (!file.analysisConfig ||
        !file.analysisConfig.startDate ||
        !file.analysisConfig.startTime ||
        typeof file.analysisConfig.sessionCount !== 'number') {
      result.isValid = false;
      result.errors.push('Analysis configuration data is missing or invalid.');
    }

    // Validate sessions
    if (file.sessions.length === 0) {
      result.warnings.push('No sessions found in the analysis file.');
    } else {
      // Check first session for structure
      const firstSession = file.sessions[0];
      if (!this.isValidSession(firstSession)) {
        result.isValid = false;
        result.errors.push('Session data structure is invalid.');
      }
    }

    // Validate summary
    if (!file.summary ||
        typeof file.summary.overview !== 'string' ||
        typeof file.summary.totalSessions !== 'number') {
      result.isValid = false;
      result.errors.push('Analysis summary data is missing or invalid.');
    }

    // Validate chart data
    if (!file.chartData ||
        !Array.isArray(file.chartData.sessionOutcomes) ||
        !Array.isArray(file.chartData.transferReasons)) {
      result.isValid = false;
      result.errors.push('Chart data is missing or invalid.');
    }

    // Validate cost analysis
    if (!file.costAnalysis ||
        typeof file.costAnalysis.totalTokens !== 'number' ||
        typeof file.costAnalysis.estimatedCost !== 'number') {
      result.warnings.push('Cost analysis data is incomplete.');
    }

    return result;
  }

  private static isValidSession(session: any): session is SessionWithFacts {
    return session &&
           typeof session.session_id === 'string' &&
           typeof session.user_id === 'string' &&
           Array.isArray(session.messages) &&
           session.facts &&
           typeof session.facts.generalIntent === 'string' &&
           ['Transfer', 'Contained'].includes(session.facts.sessionOutcome);
  }

  static validateFileSize(sizeInBytes: number): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (sizeInBytes > this.MAX_FILE_SIZE) {
      result.isValid = false;
      result.errors.push(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB.`);
    } else if (sizeInBytes > this.MAX_FILE_SIZE * 0.8) {
      result.warnings.push('File size is approaching the maximum limit. Consider analyzing fewer sessions.');
    }

    return result;
  }

  static parseJsonFile(content: string): { data?: unknown; error?: string } {
    try {
      const data = JSON.parse(content);
      return { data };
    } catch (e) {
      return { error: 'Invalid JSON file. Please ensure the file is a valid JSON format.' };
    }
  }
}