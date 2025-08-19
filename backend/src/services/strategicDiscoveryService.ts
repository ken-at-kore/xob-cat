import { 
  SessionWithTranscript, 
  SessionWithFacts, 
  DiscoveryConfig,
  DiscoveryResult,
  DiscoveryProgressCallback,
  ExistingClassifications,
  BatchTokenUsage
} from '../../../shared/types';
import { BatchAnalysisService } from './batchAnalysisService';
import { IOpenAIService } from '../interfaces';

export class StrategicDiscoveryService {
  private readonly DEFAULT_CONFIG: DiscoveryConfig = {
    targetPercentage: 15,
    minSessions: 50,
    maxSessions: 150,
    diversityStrategy: {
      sessionLengths: ['short', 'medium', 'long'],
      containmentTypes: ['agent', 'selfService', 'dropOff'],
      timeDistribution: 'spread'
    }
  };

  constructor(
    private batchAnalysisService: BatchAnalysisService,
    private openaiService: IOpenAIService
  ) {}

  async runDiscovery(
    allSessions: SessionWithTranscript[],
    config: Partial<DiscoveryConfig> = {},
    progressCallback?: DiscoveryProgressCallback,
    openaiApiKey?: string,
    modelId?: string,
    additionalContext?: string
  ): Promise<DiscoveryResult> {
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    console.log(`[StrategicDiscoveryService] Starting discovery phase with ${allSessions.length} total sessions`);
    console.log(`[StrategicDiscoveryService] Discovery config:`, fullConfig);

    // Calculate discovery size
    const discoverySize = this.calculateDiscoverySize(allSessions.length, fullConfig);
    
    progressCallback?.('Selecting diverse sessions for discovery...', 0, discoverySize, 0);

    // Select diverse sessions for discovery
    const discoverySessions = this.selectDiverseSessions(allSessions, discoverySize, fullConfig);
    
    console.log(`[StrategicDiscoveryService] Selected ${discoverySessions.length} sessions for discovery`);

    // Process discovery sessions sequentially to build classifications
    const discoveryResults = await this.processDiscoverySequentially(
      discoverySessions, 
      fullConfig,
      progressCallback,
      openaiApiKey,
      modelId,
      additionalContext
    );

    // Calculate remaining sessions
    const discoveryUserIds = new Set(discoverySessions.map(s => s.user_id));
    const remainingSessions = allSessions.filter(s => !discoveryUserIds.has(s.user_id));

    const result: DiscoveryResult = {
      baseClassifications: discoveryResults.classifications,
      processedSessions: discoveryResults.processedSessions,
      remainingSessions,
      discoveryStats: {
        totalProcessed: discoveryResults.processedSessions.length,
        uniqueIntents: discoveryResults.classifications.generalIntent.size,
        uniqueReasons: discoveryResults.classifications.transferReason.size,
        uniqueLocations: discoveryResults.classifications.dropOffLocation.size,
        discoveryRate: this.calculateDiscoveryRate(discoveryResults.classifications)
      },
      tokenUsage: discoveryResults.totalTokenUsage
    };

    console.log(`[StrategicDiscoveryService] Discovery phase complete:`, result.discoveryStats);
    
    return result;
  }

  calculateDiscoverySize(totalSessions: number, config: DiscoveryConfig): number {
    // Calculate target size based on percentage
    const targetSize = Math.ceil(totalSessions * (config.targetPercentage / 100));
    
    // Apply min/max bounds
    const discoverySize = Math.min(
      Math.max(targetSize, config.minSessions),
      config.maxSessions
    );

    // Ensure we don't exceed total sessions
    return Math.min(discoverySize, totalSessions);
  }

  selectDiverseSessions(
    sessions: SessionWithTranscript[], 
    targetCount: number,
    config: DiscoveryConfig
  ): SessionWithTranscript[] {
    console.log(`[StrategicDiscoveryService] Selecting ${targetCount} diverse sessions from ${sessions.length} total`);
    
    if (sessions.length <= targetCount) {
      return [...sessions];
    }

    // Group sessions by diversity criteria
    const sessionGroups = this.groupSessionsByDiversity(sessions);
    
    // Sample from each group proportionally
    const selectedSessions: SessionWithTranscript[] = [];
    const groupNames = Object.keys(sessionGroups);
    const sessionsPerGroup = Math.ceil(targetCount / groupNames.length);
    
    for (const groupName of groupNames) {
      const groupSessions = sessionGroups[groupName] || [];
      const sampleSize = Math.min(sessionsPerGroup, groupSessions.length);
      const sampledFromGroup = this.randomSample(groupSessions, sampleSize);
      
      selectedSessions.push(...sampledFromGroup);
      
      if (selectedSessions.length >= targetCount) {
        break;
      }
    }

    // If we still need more sessions, randomly sample from remaining
    if (selectedSessions.length < targetCount) {
      const selectedIds = new Set(selectedSessions.map(s => s.user_id));
      const remainingSessions = sessions.filter(s => !selectedIds.has(s.user_id));
      const additionalNeeded = targetCount - selectedSessions.length;
      const additionalSessions = this.randomSample(remainingSessions, additionalNeeded);
      selectedSessions.push(...additionalSessions);
    }

    // Final random shuffle and trim to exact target count
    const shuffledSessions = this.randomSample(selectedSessions, targetCount);
    
    console.log(`[StrategicDiscoveryService] Selected sessions by length distribution:`, {
      short: shuffledSessions.filter(s => this.getSessionLength(s) < 500).length,
      medium: shuffledSessions.filter(s => this.getSessionLength(s) >= 500 && this.getSessionLength(s) < 2000).length,
      long: shuffledSessions.filter(s => this.getSessionLength(s) >= 2000).length
    });

    return shuffledSessions;
  }

  private async processDiscoverySequentially(
    discoverySessions: SessionWithTranscript[],
    config: DiscoveryConfig,
    progressCallback?: DiscoveryProgressCallback,
    openaiApiKey?: string,
    modelId?: string,
    additionalContext?: string
  ): Promise<{
    classifications: ExistingClassifications;
    processedSessions: SessionWithFacts[];
    totalTokenUsage: BatchTokenUsage;
  }> {
    const BATCH_SIZE = 5;
    let classifications: ExistingClassifications = {
      generalIntent: new Set(),
      transferReason: new Set(),
      dropOffLocation: new Set()
    };
    
    const allProcessedSessions: SessionWithFacts[] = [];
    let totalTokenUsage: BatchTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      model: 'gpt-4o-mini' // Will be updated from actual results
    };
    
    const totalBatches = Math.ceil(discoverySessions.length / BATCH_SIZE);
    let previousDiscoveryCount = 0;

    for (let i = 0; i < discoverySessions.length; i += BATCH_SIZE) {
      const batch = discoverySessions.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      const currentProgress = allProcessedSessions.length;
      const currentDiscoveries = this.getTotalClassificationCount(classifications);
      
      progressCallback?.(
        `Processing discovery batch ${batchNumber}/${totalBatches} (${batch.length} sessions)`,
        currentProgress,
        discoverySessions.length,
        currentDiscoveries
      );

      try {
        // Use the existing batch analysis service
        const batchResult = await this.batchAnalysisService.processSessionsBatch(
          batch,
          classifications,
          openaiApiKey || process.env.OPENAI_API_KEY || '',
          modelId || 'gpt-4o-mini', // Default model for discovery
          additionalContext
        );

        allProcessedSessions.push(...batchResult.results);
        classifications = batchResult.updatedClassifications;
        
        // Accumulate token usage
        totalTokenUsage = this.accumulateTokenUsage(totalTokenUsage, batchResult.tokenUsage);

        // Check discovery rate
        const currentDiscoveryCount = this.getTotalClassificationCount(classifications);
        const newDiscoveries = currentDiscoveryCount - previousDiscoveryCount;
        
        console.log(`[StrategicDiscoveryService] Batch ${batchNumber} complete: ${newDiscoveries} new classifications discovered`);
        
        // Log classification growth
        console.log(`[StrategicDiscoveryService] Current classifications:`, {
          intents: classifications.generalIntent.size,
          reasons: classifications.transferReason.size,
          locations: classifications.dropOffLocation.size,
          total: currentDiscoveryCount
        });

        previousDiscoveryCount = currentDiscoveryCount;

      } catch (error) {
        console.error(`[StrategicDiscoveryService] Discovery batch ${batchNumber} failed:`, error);
        // Continue processing remaining batches - discovery is resilient to individual failures
      }
    }

    const finalDiscoveries = this.getTotalClassificationCount(classifications);
    progressCallback?.(
      `Discovery phase complete: ${finalDiscoveries} total classifications discovered`,
      discoverySessions.length,
      discoverySessions.length,
      finalDiscoveries
    );

    return {
      classifications,
      processedSessions: allProcessedSessions,
      totalTokenUsage
    };
  }

  private groupSessionsByDiversity(sessions: SessionWithTranscript[]): Record<string, SessionWithTranscript[]> {
    const groups: Record<string, SessionWithTranscript[]> = {
      'short': [],
      'medium': [],
      'long': [],
      'early': [],
      'middle': [],
      'late': []
    };

    // Sort sessions by start time for time-based grouping
    const sortedSessions = [...sessions].sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    const timeThird = Math.floor(sortedSessions.length / 3);

    sortedSessions.forEach((session, index) => {
      const length = this.getSessionLength(session);
      
      // Group by session length
      if (length < 500) {
        groups.short!.push(session);
      } else if (length < 2000) {
        groups.medium!.push(session);
      } else {
        groups.long!.push(session);
      }

      // Group by time distribution
      if (index < timeThird) {
        groups.early!.push(session);
      } else if (index < timeThird * 2) {
        groups.middle!.push(session);
      } else {
        groups.late!.push(session);
      }
    });

    // Filter out empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key]!.length === 0) {
        delete groups[key];
      }
    });

    console.log(`[StrategicDiscoveryService] Session diversity groups:`, 
      Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]))
    );

    return groups;
  }

  private getSessionLength(session: SessionWithTranscript): number {
    if (!session.messages || session.messages.length === 0) {
      return 0;
    }
    
    return session.messages.reduce((total, message) => {
      return total + (message.message?.length || 0);
    }, 0);
  }

  private randomSample<T>(array: T[], count: number): T[] {
    if (array.length <= count) {
      return [...array];
    }

    // Fisher-Yates shuffle algorithm
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    return shuffled.slice(0, count);
  }

  private getTotalClassificationCount(classifications: ExistingClassifications): number {
    return classifications.generalIntent.size + 
           classifications.transferReason.size + 
           classifications.dropOffLocation.size;
  }

  private calculateDiscoveryRate(classifications: ExistingClassifications): number {
    // Simple discovery rate calculation - could be enhanced with more sophisticated metrics
    const totalClassifications = this.getTotalClassificationCount(classifications);
    
    // Estimate good discovery rate based on typical session analysis patterns
    // Good discovery should find 10-20 unique classifications
    const targetDiscoveries = 15;
    
    return Math.min(totalClassifications / targetDiscoveries, 1.0);
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

  // Static method to get default discovery configuration
  static getDefaultConfig(): DiscoveryConfig {
    return {
      targetPercentage: parseInt(process.env.DISCOVERY_TARGET_PERCENTAGE || '15'),
      minSessions: parseInt(process.env.DISCOVERY_MIN_SESSIONS || '50'),
      maxSessions: parseInt(process.env.DISCOVERY_MAX_SESSIONS || '150'),
      diversityStrategy: {
        sessionLengths: ['short', 'medium', 'long'],
        containmentTypes: ['agent', 'selfService', 'dropOff'],
        timeDistribution: 'spread'
      }
    };
  }

  // Method to validate discovery results quality
  validateDiscoveryQuality(result: DiscoveryResult): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if discovery found sufficient classifications
    if (result.discoveryStats.uniqueIntents < 3) {
      issues.push('Too few general intents discovered');
      recommendations.push('Consider increasing discovery session count');
    }

    // Check discovery rate
    if (result.discoveryStats.discoveryRate < 0.3) {
      issues.push('Low discovery rate - may indicate insufficient session diversity');
      recommendations.push('Review session selection strategy or increase sample size');
    }

    // Check if we processed enough sessions
    if (result.discoveryStats.totalProcessed < 20) {
      issues.push('Very few sessions processed in discovery phase');
      recommendations.push('Increase minimum discovery session count');
    }

    const isValid = issues.length === 0;

    return {
      isValid,
      issues,
      recommendations
    };
  }
}