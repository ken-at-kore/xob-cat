export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    version?: string;
    schemaVersion?: string;
}
export declare class AnalysisFileValidator {
    static readonly MAX_FILE_SIZE: number;
    static validateFile(data: unknown): ValidationResult;
    private static isValidStructure;
    private static validateVersion;
    private static validateData;
    private static isValidSession;
    static validateFileSize(sizeInBytes: number): ValidationResult;
    static parseJsonFile(content: string): {
        data?: unknown;
        error?: string;
    };
}
//# sourceMappingURL=analysisFileValidator.d.ts.map