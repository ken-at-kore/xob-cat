import { 
  SessionWithTranscript, 
  SessionWithFacts, 
  SessionValidationResult
} from '../../../shared/types';
import { OpenAIBatchResult } from './openaiAnalysisService';

export class SessionValidationService {
  
  /**
   * Validates that all input sessions appear in the LLM response
   */
  validateBatchResponse(
    inputSessions: SessionWithTranscript[],
    llmResponse: OpenAIBatchResult
  ): SessionValidationResult {
    console.log(`[SessionValidationService] Validating batch response: ${inputSessions.length} input sessions, ${llmResponse.sessions.length} response sessions`);
    
    const inputUserIds = new Set(inputSessions.map(s => s.user_id));
    const responseUserIds = new Set(llmResponse.sessions.map(s => s.user_id));
    
    const missingSessions: SessionWithTranscript[] = [];
    const validationErrors: string[] = [];
    
    // Check for missing sessions
    for (const inputSession of inputSessions) {
      if (!responseUserIds.has(inputSession.user_id)) {
        missingSessions.push(inputSession);
      }
    }
    
    // Check for unexpected sessions in response
    const unexpectedSessions: string[] = [];
    for (const responseSession of llmResponse.sessions) {
      if (!inputUserIds.has(responseSession.user_id)) {
        unexpectedSessions.push(responseSession.user_id);
      }
    }
    
    if (unexpectedSessions.length > 0) {
      validationErrors.push(`Unexpected sessions in response: ${unexpectedSessions.join(', ')}`);
    }
    
    // Check for duplicate sessions in response
    const duplicates = this.findDuplicateUserIds(llmResponse.sessions.map(s => s.user_id));
    if (duplicates.length > 0) {
      validationErrors.push(`Duplicate sessions in response: ${duplicates.join(', ')}`);
    }
    
    // Check for malformed sessions
    const malformedSessions = this.validateSessionFormat(llmResponse.sessions);
    if (malformedSessions.length > 0) {
      validationErrors.push(`Malformed sessions: ${malformedSessions.join(', ')}`);
    }
    
    const result: SessionValidationResult = {
      allSessionsProcessed: missingSessions.length === 0 && validationErrors.length === 0,
      processedCount: llmResponse.sessions.length - unexpectedSessions.length,
      missingCount: missingSessions.length,
      missingSessions,
      validationErrors
    };
    
    if (!result.allSessionsProcessed) {
      console.warn(`[SessionValidationService] Validation issues found:`, {
        missing: result.missingCount,
        errors: result.validationErrors.length,
        details: result.validationErrors
      });
    } else {
      console.log(`[SessionValidationService] Validation successful: all ${inputSessions.length} sessions processed`);
    }
    
    return result;
  }
  
  /**
   * Identifies sessions that are missing from the processed results
   */
  identifyMissingSessions(
    inputSessions: SessionWithTranscript[],
    processedSessions: SessionWithFacts[]
  ): SessionWithTranscript[] {
    const processedUserIds = new Set(processedSessions.map(s => s.user_id));
    
    const missingSessions = inputSessions.filter(session => 
      !processedUserIds.has(session.user_id)
    );
    
    if (missingSessions.length > 0) {
      console.warn(`[SessionValidationService] Found ${missingSessions.length} missing sessions:`, 
        missingSessions.map(s => s.user_id)
      );
    }
    
    return missingSessions;
  }
  
  /**
   * Merges retry results with original results, handling duplicates
   */
  mergeRetryResults(
    originalResults: SessionWithFacts[],
    retryResults: SessionWithFacts[]
  ): SessionWithFacts[] {
    console.log(`[SessionValidationService] Merging ${originalResults.length} original + ${retryResults.length} retry results`);
    
    // Create a map for efficient lookup
    const mergedMap = new Map<string, SessionWithFacts>();
    
    // Add original results
    for (const session of originalResults) {
      mergedMap.set(session.user_id, session);
    }
    
    // Add retry results (will overwrite any existing entries with same user_id)
    for (const session of retryResults) {
      mergedMap.set(session.user_id, session);
    }
    
    const mergedResults = Array.from(mergedMap.values());
    
    console.log(`[SessionValidationService] Merge complete: ${mergedResults.length} total sessions`);
    
    return mergedResults;
  }
  
  /**
   * Validates that processed sessions match expected format
   */
  validateProcessedSessionsFormat(sessions: SessionWithFacts[]): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    for (const session of sessions) {
      // Check required fields
      if (!session.user_id) {
        issues.push(`Session missing user_id`);
        continue;
      }
      
      if (!session.facts) {
        issues.push(`Session ${session.user_id} missing facts`);
        continue;
      }
      
      // Check facts format
      const facts = session.facts;
      if (!facts.generalIntent) {
        issues.push(`Session ${session.user_id} missing generalIntent`);
      }
      
      if (!facts.sessionOutcome) {
        issues.push(`Session ${session.user_id} missing sessionOutcome`);
      } else if (facts.sessionOutcome !== 'Transfer' && facts.sessionOutcome !== 'Contained') {
        issues.push(`Session ${session.user_id} has invalid sessionOutcome: ${facts.sessionOutcome}`);
      }
      
      // Check transfer-specific fields
      if (facts.sessionOutcome === 'Transfer') {
        if (!facts.transferReason) {
          issues.push(`Transfer session ${session.user_id} missing transferReason`);
        }
        if (!facts.dropOffLocation) {
          issues.push(`Transfer session ${session.user_id} missing dropOffLocation`);
        }
      }
      
      if (!facts.notes) {
        issues.push(`Session ${session.user_id} missing notes`);
      }
      
      // Check analysisMetadata
      if (!session.analysisMetadata) {
        issues.push(`Session ${session.user_id} missing analysisMetadata`);
      }
    }
    
    const isValid = issues.length === 0;
    
    if (!isValid) {
      console.warn(`[SessionValidationService] Format validation found ${issues.length} issues:`, issues.slice(0, 5));
    }
    
    return { isValid, issues };
  }
  
  /**
   * Creates a detailed validation report for debugging
   */
  createValidationReport(
    inputSessions: SessionWithTranscript[],
    processedSessions: SessionWithFacts[],
    validationResult: SessionValidationResult
  ): {
    summary: {
      totalInput: number;
      totalProcessed: number;
      missingCount: number;
      errorCount: number;
      successRate: number;
    };
    details: {
      missingSessions: string[];
      validationErrors: string[];
      sessionCounts: {
        transfers: number;
        contained: number;
      };
    };
  } {
    const transfers = processedSessions.filter(s => s.facts.sessionOutcome === 'Transfer').length;
    const contained = processedSessions.filter(s => s.facts.sessionOutcome === 'Contained').length;
    
    const successRate = inputSessions.length > 0 
      ? ((inputSessions.length - validationResult.missingCount) / inputSessions.length) * 100
      : 100;
    
    const report = {
      summary: {
        totalInput: inputSessions.length,
        totalProcessed: processedSessions.length,
        missingCount: validationResult.missingCount,
        errorCount: validationResult.validationErrors.length,
        successRate: Math.round(successRate * 100) / 100
      },
      details: {
        missingSessions: validationResult.missingSessions.map(s => s.user_id),
        validationErrors: validationResult.validationErrors,
        sessionCounts: {
          transfers,
          contained
        }
      }
    };
    
    console.log(`[SessionValidationService] Validation Report:`, report.summary);
    
    return report;
  }
  
  /**
   * Checks if retry is recommended based on validation results
   */
  shouldRetry(validationResult: SessionValidationResult, maxRetryAttempts: number = 3): {
    shouldRetry: boolean;
    reason: string;
  } {
    if (validationResult.allSessionsProcessed) {
      return {
        shouldRetry: false,
        reason: 'All sessions processed successfully'
      };
    }
    
    if (validationResult.missingCount > 0 && maxRetryAttempts > 0) {
      return {
        shouldRetry: true,
        reason: `${validationResult.missingCount} sessions missing from response`
      };
    }
    
    if (validationResult.validationErrors.length > 0) {
      // Only retry for recoverable errors
      const recoverableErrors = validationResult.validationErrors.filter(error => 
        error.includes('missing') || error.includes('malformed')
      );
      
      if (recoverableErrors.length > 0 && maxRetryAttempts > 0) {
        return {
          shouldRetry: true,
          reason: `Recoverable validation errors found: ${recoverableErrors.length}`
        };
      }
    }
    
    return {
      shouldRetry: false,
      reason: 'No recoverable errors or retry limit reached'
    };
  }
  
  private findDuplicateUserIds(userIds: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    
    for (const userId of userIds) {
      if (seen.has(userId)) {
        duplicates.add(userId);
      } else {
        seen.add(userId);
      }
    }
    
    return Array.from(duplicates);
  }
  
  private validateSessionFormat(sessions: Array<{
    user_id: string;
    general_intent: string;
    session_outcome: 'Transfer' | 'Contained';
    transfer_reason: string;
    drop_off_location: string;
    notes: string;
  }>): string[] {
    const malformed: string[] = [];
    
    for (const session of sessions) {
      if (!session.user_id || typeof session.user_id !== 'string') {
        malformed.push(`Invalid user_id: ${session.user_id}`);
        continue;
      }
      
      if (!session.general_intent || typeof session.general_intent !== 'string') {
        malformed.push(`${session.user_id}: Invalid general_intent`);
      }
      
      if (session.session_outcome !== 'Transfer' && session.session_outcome !== 'Contained') {
        malformed.push(`${session.user_id}: Invalid session_outcome`);
      }
      
      if (typeof session.notes !== 'string') {
        malformed.push(`${session.user_id}: Invalid notes`);
      }
    }
    
    return malformed;
  }
  
  /**
   * Utility method to create fallback results for failed validations
   */
  createFallbackResults(
    missingSessions: SessionWithTranscript[],
    errorMessage: string,
    modelId: string = 'gpt-4o-mini'
  ): SessionWithFacts[] {
    return missingSessions.map(session => ({
      ...session,
      facts: {
        generalIntent: 'Unknown',
        sessionOutcome: 'Contained' as const,
        transferReason: '',
        dropOffLocation: '',
        notes: `Validation failed: ${errorMessage}`
      },
      analysisMetadata: {
        tokensUsed: 0,
        processingTime: 0,
        batchNumber: -1, // Indicate fallback
        timestamp: new Date().toISOString(),
        model: modelId
      }
    }));
  }
}