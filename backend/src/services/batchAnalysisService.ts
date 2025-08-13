import { OpenAIAnalysisService } from './openaiAnalysisService';
import { IOpenAIService } from '../interfaces';
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

  constructor(private openaiService: IOpenAIService) {}

  async processSessionsBatch(
    sessions: SessionWithTranscript[],
    existingClassifications: ExistingClassifications,
    openaiApiKey: string,
    modelId: string = 'gpt-4o-mini'
  ): Promise<BatchProcessingResult> {
    this.batchCounter++;
    const startTime = Date.now();
    
    console.log(`\n📦 ===== BATCH ${this.batchCounter} PROCESSING START =====`);
    console.log(`⏱️  Batch Start: ${new Date().toISOString()}`);
    console.log(`📊 Sessions in Batch: ${sessions.length}`);
    console.log(`🧠 Model: ${modelId}`);
    console.log(`🔧 Existing Classifications:`);
    console.log(`   • Intents: ${existingClassifications.generalIntent.size}`);
    console.log(`   • Reasons: ${existingClassifications.transferReason.size}`);
    console.log(`   • Locations: ${existingClassifications.dropOffLocation.size}`);

    try {
      // Split sessions into regular and oversized
      const splitStartTime = Date.now();
      const { regularSessions, oversizedSessions } = this.splitOversizedSessions(
        sessions, 
        this.MAX_SESSION_LENGTH
      );
      const splitDuration = Date.now() - splitStartTime;
      
      console.log(`\n🔄 ===== SESSION SPLITTING =====`);
      console.log(`⏱️  Split Time: ${splitDuration}ms`);
      console.log(`📊 Regular Sessions: ${regularSessions.length}`);
      console.log(`📊 Oversized Sessions: ${oversizedSessions.length}`);
      if (oversizedSessions.length > 0) {
        const oversizedSizes = oversizedSessions.map(s => this.calculateSessionLength(s));
        console.log(`📊 Oversized Lengths: ${oversizedSizes.join(', ')} characters`);
      }

      let allResults: SessionWithFacts[] = [];
      let updatedClassifications = this.cloneClassifications(existingClassifications);
      let totalTokenUsage: BatchTokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        model: modelId
      };

      // Process regular sessions in batch
      if (regularSessions.length > 0) {
        console.log(`\n🚀 ===== PROCESSING REGULAR SESSIONS =====`);
        const regularBatchStartTime = Date.now();
        const batchResult = await this.processBatch(
          regularSessions,
          updatedClassifications,
          openaiApiKey,
          modelId
        );
        const regularBatchDuration = Date.now() - regularBatchStartTime;
        
        console.log(`⏱️  Regular Batch Time: ${regularBatchDuration}ms (${(regularBatchDuration/1000).toFixed(2)}s)`);
        console.log(`📊 Regular Sessions Processed: ${batchResult.sessions.length}`);
        console.log(`💰 Regular Tokens Used: ${batchResult.tokenUsage.totalTokens}`);

        allResults.push(...batchResult.sessions);
        updatedClassifications = this.updateClassifications(batchResult.sessions, updatedClassifications);
        totalTokenUsage = this.accumulateTokenUsage(totalTokenUsage, batchResult.tokenUsage);
      }

      // Process oversized sessions individually
      if (oversizedSessions.length > 0) {
        console.log(`\n🔄 ===== PROCESSING OVERSIZED SESSIONS =====`);
        const oversizedTotalStartTime = Date.now();
        
        for (let i = 0; i < oversizedSessions.length; i++) {
          const oversizedSession = oversizedSessions[i]!;
          const sessionStartTime = Date.now();
          console.log(`\n📦 Processing oversized session ${i + 1}/${oversizedSessions.length}: ${oversizedSession.session_id}`);
          
          try {
            const individualResult = await this.processBatch(
              [oversizedSession],
              updatedClassifications,
              openaiApiKey,
              modelId
            );
            const sessionDuration = Date.now() - sessionStartTime;
            
            console.log(`⏱️  Oversized Session Time: ${sessionDuration}ms`);
            console.log(`💰 Oversized Session Tokens: ${individualResult.tokenUsage.totalTokens}`);

            allResults.push(...individualResult.sessions);
            updatedClassifications = this.updateClassifications(individualResult.sessions, updatedClassifications);
            totalTokenUsage = this.accumulateTokenUsage(totalTokenUsage, individualResult.tokenUsage);
          } catch (error) {
            const sessionDuration = Date.now() - sessionStartTime;
            console.log(`❌ Oversized session ${oversizedSession.session_id} failed after ${sessionDuration}ms:`, error);
            // Add fallback result
            allResults.push(this.createFallbackResult(oversizedSession, `Failed individual processing: ${error}`, modelId));
          }
        }
        
        const oversizedTotalDuration = Date.now() - oversizedTotalStartTime;
        console.log(`\n✅ ===== OVERSIZED SESSIONS COMPLETE =====`);
        console.log(`⏱️  Total Oversized Time: ${oversizedTotalDuration}ms (${(oversizedTotalDuration/1000).toFixed(2)}s)`);
        console.log(`📊 Oversized Sessions Processed: ${oversizedSessions.length}`);
        console.log(`⚡ Avg Time Per Oversized: ${(oversizedTotalDuration / oversizedSessions.length).toFixed(2)}ms`);
      }

      // Add metadata to all results
      const metadataStartTime = Date.now();
      const batchProcessingTime = Date.now() - startTime;
      const resultsWithMetadata = allResults.map(result => ({
        ...result,
        analysisMetadata: {
          ...result.analysisMetadata,
          processingTime: batchProcessingTime,
          batchNumber: this.batchCounter,
          timestamp: new Date().toISOString()
        }
      }));
      const metadataDuration = Date.now() - metadataStartTime;
      
      console.log(`\n✅ ===== BATCH ${this.batchCounter} PROCESSING COMPLETE =====`);
      console.log(`⏱️  Total Batch Time: ${batchProcessingTime}ms (${(batchProcessingTime/1000).toFixed(2)}s)`);
      console.log(`📊 Sessions Processed: ${resultsWithMetadata.length}/${sessions.length}`);
      console.log(`💰 Total Tokens: ${totalTokenUsage.totalTokens} ($${totalTokenUsage.cost.toFixed(4)})`);
      console.log(`⚡ Performance: ${(resultsWithMetadata.length / (batchProcessingTime/1000)).toFixed(1)} sessions/sec`);
      console.log(`⚡ Avg Time Per Session: ${(batchProcessingTime / resultsWithMetadata.length).toFixed(2)}ms`);
      console.log(`⏱️  Metadata Processing: ${metadataDuration}ms`);

      return {
        results: resultsWithMetadata,
        updatedClassifications,
        tokenUsage: totalTokenUsage
      };

    } catch (error) {
      console.error('Batch processing failed:', error);
      // Return fallback results for all sessions
      const fallbackResults = sessions.map(session => 
        this.createFallbackResult(session, `Error processing session: ${error}`, modelId)
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
    openaiApiKey: string,
    modelId: string = 'gpt-4o-mini'
  ): Promise<{
    sessions: SessionWithFacts[];
    tokenUsage: BatchTokenUsage;
  }> {
    const openaiCallStartTime = Date.now();
    console.log(`\n🤖 ===== OPENAI SERVICE CALL =====`);
    console.log(`⏱️  OpenAI Call Start: ${new Date().toISOString()}`);
    console.log(`📊 Sessions to Analyze: ${sessions.length}`);
    
    const analysisResult = await this.openaiService.analyzeBatch(
      sessions,
      existingClassifications,
      openaiApiKey,
      modelId
    );
    
    const openaiCallDuration = Date.now() - openaiCallStartTime;
    console.log(`\n✅ ===== OPENAI SERVICE CALL COMPLETE =====`);
    console.log(`⏱️  OpenAI Call Time: ${openaiCallDuration}ms (${(openaiCallDuration/1000).toFixed(2)}s)`);
    console.log(`📊 Sessions Returned: ${analysisResult.sessions.length}`);
    console.log(`💰 Tokens Used: ${analysisResult.totalTokens} ($${analysisResult.cost.toFixed(4)})`);
    console.log(`⚡ Performance: ${(analysisResult.totalTokens / (openaiCallDuration/1000)).toFixed(1)} tokens/sec`);

    // Map OpenAI results back to SessionWithFacts
    const mappingStartTime = Date.now();
    const sessionResults: SessionWithFacts[] = [];
    const sessionsById = new Map(sessions.map(s => [s.user_id, s]));

    // Process successful results
    for (const result of analysisResult.sessions) {
      const originalSession = sessionsById.get(result.user_id);
      if (originalSession) {
        sessionResults.push({
          ...originalSession,
          facts: {
            generalIntent: result.general_intent || 'Unknown',
            sessionOutcome: result.session_outcome || 'Contained',
            transferReason: result.transfer_reason || '',
            dropOffLocation: result.drop_off_location || '',
            notes: result.notes || 'Analysis completed successfully'
          },
          analysisMetadata: {
            tokensUsed: analysisResult.totalTokens,
            processingTime: 0, // Will be set by caller
            batchNumber: this.batchCounter,
            timestamp: new Date().toISOString(),
            model: analysisResult.model
          }
        });
        sessionsById.delete(result.user_id);
      }
    }

    // Handle any missing sessions (partial failures)
    for (const [userId, session] of sessionsById) {
      console.log(`⚠️  Session ${userId} missing from analysis results, creating fallback`);
      sessionResults.push(
        this.createFallbackResult(session, 'Failed individual processing: Missing from batch response', modelId)
      );
    }
    
    const mappingDuration = Date.now() - mappingStartTime;
    console.log(`\n🔄 ===== SESSION MAPPING COMPLETE =====`);
    console.log(`⏱️  Mapping Time: ${mappingDuration}ms`);
    console.log(`📊 Final Session Results: ${sessionResults.length}`);
    console.log(`📊 Missing Sessions: ${sessionsById.size}`);

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

  private createFallbackResult(session: SessionWithTranscript, errorMessage: string, modelId: string = 'gpt-4o-mini'): SessionWithFacts {
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
        timestamp: new Date().toISOString(),
        model: modelId
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