import {
  AnalysisExportFile,
  AnalysisResults,
  SessionWithFacts,
  ANALYSIS_FILE_VERSION,
  ANALYSIS_FILE_SCHEMA_VERSION,
  ANALYSIS_FILE_APP_VERSION,
  AnalysisConfig
} from '../../../shared/types';

export class AnalysisExportService {
  static createExportFile(
    results: AnalysisResults,
    config: AnalysisConfig,
    requestedAt: string,
    completedAt: string
  ): AnalysisExportFile {
    const sessions = results.sessions;
    const summary = results.analysisSummary;

    // Calculate statistics
    const totalSessions = sessions.length;
    const containedSessions = sessions.filter(s => s.facts.sessionOutcome === 'Contained').length;
    const containmentRate = totalSessions > 0 ? containedSessions / totalSessions : 0;

    // Aggregate data for charts
    const transferReasons = this.aggregateTransferReasons(sessions);
    const dropOffLocations = this.aggregateDropOffLocations(sessions);
    const generalIntents = this.aggregateGeneralIntents(sessions);
    const topTransferReasons = this.getTopItems(transferReasons, 10);
    const topIntents = this.getTopItems(generalIntents, 10);
    const topDropOffLocations = this.getTopItems(dropOffLocations, 10);

    // Calculate total tokens and cost
    const tokenStats = this.calculateTokenStats(sessions, config.modelId);

    return {
      metadata: {
        version: ANALYSIS_FILE_VERSION,
        schemaVersion: ANALYSIS_FILE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        exportedBy: ANALYSIS_FILE_APP_VERSION,
        requiredFeatures: ['basic-charts', 'session-analysis'],
        optionalFeatures: ['advanced-charts', 'ai-summary']
      },
      analysisConfig: {
        startDate: config.startDate,
        startTime: config.startTime,
        sessionCount: config.sessionCount,
        requestedAt,
        completedAt,
        botId: results.botId
      },
      sessions,
      summary: {
        overview: summary?.overview || '',
        detailedAnalysis: summary?.summary || '',
        ...(summary?.containmentSuggestion && { containmentSuggestion: summary.containmentSuggestion }),
        totalSessions,
        containmentRate,
        topTransferReasons,
        topIntents,
        topDropOffLocations
      },
      chartData: {
        sessionOutcomes: [
          { name: 'Contained', value: containedSessions },
          { name: 'Transfer', value: totalSessions - containedSessions }
        ],
        transferReasons: this.formatTransferReasonsForChart(transferReasons, totalSessions - containedSessions),
        dropOffLocations: this.formatDropOffLocationsForChart(dropOffLocations),
        generalIntents: this.formatGeneralIntentsForChart(generalIntents)
      },
      costAnalysis: {
        totalTokens: tokenStats.totalTokens,
        estimatedCost: tokenStats.estimatedCost,
        modelUsed: config.modelId || 'gpt-4o-mini'
      }
    };
  }

  private static aggregateTransferReasons(sessions: SessionWithFacts[]): Record<string, number> {
    const reasons: Record<string, number> = {};
    
    sessions
      .filter(s => s.facts.sessionOutcome === 'Transfer' && s.facts.transferReason)
      .forEach(s => {
        const reason = s.facts.transferReason;
        reasons[reason] = (reasons[reason] || 0) + 1;
      });
    
    return reasons;
  }

  private static aggregateDropOffLocations(sessions: SessionWithFacts[]): Record<string, number> {
    const locations: Record<string, number> = {};
    
    sessions
      .filter(s => s.facts.sessionOutcome === 'Transfer' && s.facts.dropOffLocation)
      .forEach(s => {
        const location = s.facts.dropOffLocation;
        locations[location] = (locations[location] || 0) + 1;
      });
    
    return locations;
  }

  private static aggregateGeneralIntents(sessions: SessionWithFacts[]): Record<string, number> {
    const intents: Record<string, number> = {};
    
    sessions.forEach(s => {
      const intent = s.facts.generalIntent || 'Unknown';
      intents[intent] = (intents[intent] || 0) + 1;
    });
    
    return intents;
  }

  private static getTopItems(items: Record<string, number>, limit: number): Record<string, number> {
    const sorted = Object.entries(items)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);
    
    return Object.fromEntries(sorted);
  }

  private static formatTransferReasonsForChart(
    reasons: Record<string, number>,
    totalTransfers: number
  ): Array<{ reason: string; count: number; percentage: number }> {
    return Object.entries(reasons)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: totalTransfers > 0 ? (count / totalTransfers) * 100 : 0
      }));
  }

  private static formatDropOffLocationsForChart(
    locations: Record<string, number>
  ): Array<{ location: string; count: number }> {
    return Object.entries(locations)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([location, count]) => ({ location, count }));
  }

  private static formatGeneralIntentsForChart(
    intents: Record<string, number>
  ): Array<{ intent: string; count: number }> {
    return Object.entries(intents)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([intent, count]) => ({ intent, count }));
  }

  private static calculateTokenStats(
    sessions: SessionWithFacts[],
    modelId: string
  ): { totalTokens: number; estimatedCost: number } {
    let totalTokens = 0;
    let estimatedCost = 0;

    sessions.forEach(session => {
      if (session.analysisMetadata?.tokensUsed) {
        totalTokens += session.analysisMetadata.tokensUsed;
      }
    });

    // Estimate cost based on model
    // Using simplified pricing for MVP
    const costPerToken = modelId === 'gpt-4o' ? 0.000005 : 0.0000003; // Rough estimates
    estimatedCost = totalTokens * costPerToken;

    return { totalTokens, estimatedCost };
  }

  static generateFileName(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `xob-cat-analysis-${timestamp}.json`;
  }
}