import { SessionWithFacts, AnalysisSummary } from '../../../shared/types';

/**
 * Mock Analysis Summary Service
 * 
 * Provides mock analysis summaries without making real OpenAI API calls.
 * Used for testing parallel auto-analyze functionality.
 */
export class MockAnalysisSummaryService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateAnalysisSummary(sessions: SessionWithFacts[], modelId: string = 'gpt-4o-mini', additionalContext?: string): Promise<AnalysisSummary> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate mock summary based on session data using correct property paths
    const intents = new Set(sessions.map(s => s.facts.generalIntent));
    const outcomes = new Set(sessions.map(s => s.facts.sessionOutcome));
    const transferReasons = new Set(
      sessions
        .filter(s => s.facts.transferReason && s.facts.transferReason.trim() !== '')
        .map(s => s.facts.transferReason)
    );

    const containedSessions = sessions.filter(s => s.facts.sessionOutcome === 'Contained');
    const transferredSessions = sessions.filter(s => s.facts.sessionOutcome === 'Transfer');

    // Calculate statistics
    const totalMessages = sessions.reduce((sum, s) => sum + s.message_count, 0);
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

    return {
      overview: `Analyzed ${sessions.length} mock sessions with ${intents.size} distinct intent types. ${transferredSessions.length} sessions required live agent transfer (${Math.round((transferredSessions.length / sessions.length) * 100)}% transfer rate).`,
      summary: `Mock analysis summary: This analysis covered ${sessions.length} sessions with a ${Math.round((containedSessions.length / sessions.length) * 100)}% containment rate. The most common user intent was ${this.getMostCommon(sessions.map(s => s.facts.generalIntent))}, and ${transferredSessions.length} sessions required live agent assistance.`,
      containmentSuggestion: transferReasons.size > 0 
        ? `Primary transfer reason: ${this.getMostCommon(Array.from(transferReasons))}. Consider improving bot responses for this scenario.`
        : 'Most sessions were contained successfully. Continue monitoring for emerging patterns.',
      generatedAt: new Date().toISOString(),
      sessionsAnalyzed: sessions.length,
      statistics: {
        totalSessions: sessions.length,
        transferRate: transferredSessions.length / sessions.length,
        containmentRate: containedSessions.length / sessions.length,
        averageSessionLength: totalDuration / sessions.length,
        averageMessagesPerSession: totalMessages / sessions.length
      }
    };
  }

  private getMostCommon(items: string[]): string {
    const counts = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
  }
}

// Factory function for creating mock analysis summary service
export function createMockAnalysisSummaryService(apiKey: string): MockAnalysisSummaryService {
  return new MockAnalysisSummaryService(apiKey);
}