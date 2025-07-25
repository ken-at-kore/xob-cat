import { OpenAIAnalysisService } from './openaiAnalysisService';
import { 
  SessionWithTranscript, 
  SessionWithFacts, 
  ExistingClassifications, 
  BatchTokenUsage 
} from '../../../shared/types';

export interface BatchProcessingResult {
  results: SessionWithFacts[];
  updatedClassifications: ExistingClassifications;
  tokenUsage: BatchTokenUsage;
}

export interface BatchSplitResult {
  regularSessions: SessionWithTranscript[];
  oversizedSessions: SessionWithTranscript[];
}

export class BatchAnalysisService {
  private readonly BATCH_SIZE = 5;
  private readonly MAX_SESSION_LENGTH = 8000; // characters
  private readonly MAX_BATCH_CHARS = 50000; // total characters per batch
  private batchCounter = 0;

  constructor(private openaiService: OpenAIAnalysisService) {}

  async processSessionsBatch(
    sessions: SessionWithTranscript[],
    existingClassifications: ExistingClassifications,
    openaiApiKey: string
  ): Promise<BatchProcessingResult> {
    this.batchCounter++;
    const startTime = Date.now();

    try {
      // Split sessions into regular and oversized
      const { regularSessions, oversizedSessions } = this.splitOversizedSessions(
        sessions, 
        this.MAX_SESSION_LENGTH
      );

      let allResults: SessionWithFacts[] = [];
      let updatedClassifications = this.cloneClassifications(existingClassifications);
      let totalTokenUsage: BatchTokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        model: 'gpt-4o-mini-2024-07-18'
      };

      // Process regular sessions in batch
      if (regularSessions.length > 0) {
        const batchResult = await this.processBatch(
          regularSessions,
          updatedClassifications,
          openaiApiKey
        );

        allResults.push(...batchResult.sessions);
        updatedClassifications = this.updateClassifications(batchResult.sessions, updatedClassifications);
        totalTokenUsage = this.accumulateTokenUsage(totalTokenUsage, batchResult.tokenUsage);
      }

      // Process oversized sessions individually
      for (const oversizedSession of oversizedSessions) {
        try {
          const individualResult = await this.processBatch(
            [oversizedSession],
            updatedClassifications,
            openaiApiKey
          );

          allResults.push(...individualResult.sessions);
          updatedClassifications = this.updateClassifications(individualResult.sessions, updatedClassifications);
          totalTokenUsage = this.accumulateTokenUsage(totalTokenUsage, individualResult.tokenUsage);
        } catch (error) {
          console.error(`Failed to process oversized session ${oversizedSession.session_id}:`, error);
          // Add fallback result
          allResults.push(this.createFallbackResult(oversizedSession, `Failed individual processing: ${error}`));
        }
      }

      // Add metadata to all results
      const resultsWithMetadata = allResults.map(result => ({
        ...result,
        analysisMetadata: {
          ...result.analysisMetadata,
          processingTime: Date.now() - startTime,
          batchNumber: this.batchCounter,
          timestamp: new Date().toISOString()
        }
      }));

      return {
        results: resultsWithMetadata,
        updatedClassifications,
        tokenUsage: totalTokenUsage
      };

    } catch (error) {
      console.error('Batch processing failed:', error);
      // Return fallback results for all sessions
      const fallbackResults = sessions.map(session => 
        this.createFallbackResult(session, `Error processing session: ${error}`)
      );

      return {
        results: fallbackResults,
        updatedClassifications: existingClassifications,
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
          model: 'error'
        }
      };
    }
  }

  splitOversizedSessions(
    sessions: SessionWithTranscript[], 
    maxLength: number
  ): BatchSplitResult {
    const regularSessions: SessionWithTranscript[] = [];
    const oversizedSessions: SessionWithTranscript[] = [];

    for (const session of sessions) {
      const sessionLength = this.calculateSessionLength(session);
      if (sessionLength > maxLength) {
        oversizedSessions.push(session);
      } else {
        regularSessions.push(session);
      }
    }

    return { regularSessions, oversizedSessions };
  }

  calculateSessionLength(session: SessionWithTranscript): number {
    return session.messages
      .map(msg => msg.message?.length || 0)
      .reduce((total, length) => total + length, 0);
  }

  private async processBatch(
    sessions: SessionWithTranscript[],
    existingClassifications: ExistingClassifications,
    openaiApiKey: string
  ): Promise<{
    sessions: SessionWithFacts[];
    tokenUsage: BatchTokenUsage;
  }> {
    const analysisResult = await this.openaiService.analyzeBatch(
      sessions,
      existingClassifications,
      openaiApiKey
    );

    // Map OpenAI results back to SessionWithFacts
    const sessionResults: SessionWithFacts[] = [];
    const sessionsById = new Map(sessions.map(s => [s.user_id, s]));

    // Process successful results
    for (const result of analysisResult.sessions) {
      const originalSession = sessionsById.get(result.user_id);
      if (originalSession) {
        sessionResults.push({
          ...originalSession,
          facts: {
            generalIntent: result.general_intent,
            sessionOutcome: result.session_outcome,
            transferReason: result.transfer_reason || '',
            dropOffLocation: result.drop_off_location || '',
            notes: result.notes
          },
          analysisMetadata: {
            tokensUsed: analysisResult.totalTokens,
            processingTime: 0, // Will be set by caller
            batchNumber: this.batchCounter,
            timestamp: new Date().toISOString()
          }
        });
        sessionsById.delete(result.user_id);
      }
    }

    // Handle any missing sessions (partial failures)
    for (const [userId, session] of sessionsById) {
      console.warn(`Session ${userId} missing from analysis results, creating fallback`);
      sessionResults.push(
        this.createFallbackResult(session, 'Failed individual processing: Missing from batch response')
      );
    }

    return {
      sessions: sessionResults,
      tokenUsage: {
        promptTokens: analysisResult.promptTokens,
        completionTokens: analysisResult.completionTokens,
        totalTokens: analysisResult.totalTokens,
        cost: analysisResult.cost,
        model: analysisResult.model
      }
    };
  }

  private createFallbackResult(session: SessionWithTranscript, errorMessage: string): SessionWithFacts {
    return {
      ...session,
      facts: {
        generalIntent: 'Unknown',
        sessionOutcome: 'Contained',
        transferReason: '',
        dropOffLocation: '',
        notes: errorMessage
      },
      analysisMetadata: {
        tokensUsed: 0,
        processingTime: 0,
        batchNumber: this.batchCounter,
        timestamp: new Date().toISOString()
      }
    };
  }

  private updateClassifications(
    sessions: SessionWithFacts[],
    existingClassifications: ExistingClassifications
  ): ExistingClassifications {
    const updated = this.cloneClassifications(existingClassifications);

    for (const session of sessions) {
      const { facts } = session;

      // Update general intent
      if (facts.generalIntent && facts.generalIntent.trim()) {
        updated.generalIntent.add(facts.generalIntent);
      }

      // Update transfer reason (only if not empty)
      if (facts.transferReason && facts.transferReason.trim()) {
        updated.transferReason.add(facts.transferReason);
      }

      // Update drop-off location (only if not empty)
      if (facts.dropOffLocation && facts.dropOffLocation.trim()) {
        updated.dropOffLocation.add(facts.dropOffLocation);
      }
    }

    return updated;
  }

  private cloneClassifications(classifications: ExistingClassifications): ExistingClassifications {
    return {
      generalIntent: new Set(classifications.generalIntent),
      transferReason: new Set(classifications.transferReason),
      dropOffLocation: new Set(classifications.dropOffLocation)
    };
  }

  private accumulateTokenUsage(
    accumulated: BatchTokenUsage,
    newUsage: BatchTokenUsage
  ): BatchTokenUsage {
    return {
      promptTokens: accumulated.promptTokens + newUsage.promptTokens,
      completionTokens: accumulated.completionTokens + newUsage.completionTokens,
      totalTokens: accumulated.totalTokens + newUsage.totalTokens,
      cost: accumulated.cost + newUsage.cost,
      model: newUsage.model // Use the latest model
    };
  }
}