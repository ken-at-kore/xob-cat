import { AnalysisSummaryService } from '../../services/analysisSummaryService';
import { SessionWithFacts } from '../../../../shared/types';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * ANALYSIS SUMMARY INTEGRATION TEST - HYBRID MODE
 * 
 * Tests the macro analysis/analysis summary generation using hybrid services:
 * - Mock session data (pre-analyzed sessions from mock-analysis-results.json)
 * - Real OpenAI API (validates actual summary generation quality)
 * 
 * This test validates the macro-level analysis that uses analysis-prompts.ts
 * to generate comprehensive analysis summaries from per-session analysis results.
 * 
 * Required Environment Variables (.env.local):
 * - TEST_OPENAI_API_KEY: Valid OpenAI API key (incurs costs)
 * 
 * Configuration Environment Variables:
 * - HYBRID_SUMMARY_TEST_MODE: Controls which tests to run
 *   - 'main' (default): Run only the main summary generation test
 *   - 'all': Run all test cases including edge cases
 * - HYBRID_SUMMARY_MODEL: OpenAI model to use (default: 'gpt-4.1-nano')
 *   - Example: "gpt-4.1", "gpt-4o-mini"
 * - HYBRID_SUMMARY_DEBUG: Enable detailed logging of OpenAI requests/responses
 *   - 'true': Show full prompts and responses
 *   - 'false' (default): Standard logging only
 * - HYBRID_SUMMARY_SESSION_LIMIT: Maximum sessions to analyze (default: all sessions in file)
 *   - Example: "10", "50" - set to control costs and response time
 * 
 * Usage Examples:
 * npm test -- --testPathPattern="analysisSummary.hybrid"
 * HYBRID_SUMMARY_TEST_MODE=main npm test -- --testPathPattern="analysisSummary.hybrid"
 * HYBRID_SUMMARY_MODEL="gpt-4.1" npm test -- --testPathPattern="analysisSummary.hybrid"
 * HYBRID_SUMMARY_DEBUG=true npm test -- --testPathPattern="analysisSummary.hybrid"
 * HYBRID_SUMMARY_SESSION_LIMIT="10" HYBRID_SUMMARY_MODEL="gpt-4.1" npm test -- --testPathPattern="analysisSummary.hybrid"
 * 
 * ⚠️  WARNING: This test makes real OpenAI API calls and incurs costs!
 * The analysis summary generation typically uses significant tokens due to the comprehensive
 * prompt that includes all session data and examples.
 */
describe('Analysis Summary Generation - Hybrid (Mock Data + Real OpenAI)', () => {
  let analysisSummaryService: AnalysisSummaryService;
  let openaiApiKey: string;
  let mockSessionsWithFacts: SessionWithFacts[];

  // Configuration from environment variables
  const testMode = process.env.HYBRID_SUMMARY_TEST_MODE || 'main';
  const modelName = process.env.HYBRID_SUMMARY_MODEL || 'gpt-4.1-nano';
  const debugLogging = process.env.HYBRID_SUMMARY_DEBUG === 'true';
  const sessionLimit = process.env.HYBRID_SUMMARY_SESSION_LIMIT ? parseInt(process.env.HYBRID_SUMMARY_SESSION_LIMIT) : undefined;

  // Helper function to check if test should run
  const shouldRunTest = (requiredModes: string[]) => {
    return requiredModes.includes(testMode);
  };

  // Function to load pre-analyzed session data
  async function loadPreAnalyzedSessions(): Promise<SessionWithFacts[]> {
    const dataFilePath = path.join(process.cwd(), '..', 'data', 'mock-analysis-results.json');
    
    console.log(`📁 [Hybrid Summary Test] Loading pre-analyzed sessions from: ${dataFilePath}`);
    
    if (!await fs.access(dataFilePath).then(() => true).catch(() => false)) {
      throw new Error(`Mock analysis results file not found: ${dataFilePath}`);
    }

    const rawData = await fs.readFile(dataFilePath, 'utf8');
    const sessions: SessionWithFacts[] = JSON.parse(rawData);
    
    // Validate data structure
    if (!Array.isArray(sessions) || sessions.length === 0) {
      throw new Error('Invalid mock analysis results - expected non-empty array of sessions');
    }

    // Validate that sessions have the required analysis data
    const validSessions = sessions.filter(session => 
      session.facts && 
      session.facts.generalIntent && 
      session.facts.sessionOutcome &&
      session.messages && 
      session.messages.length > 0
    );

    if (validSessions.length === 0) {
      throw new Error('No valid pre-analyzed sessions found in mock data');
    }

    console.log(`📊 [Hybrid Summary Test] Loaded ${sessions.length} total sessions, ${validSessions.length} valid for analysis`);
    
    // Apply session limit if specified
    const finalSessions = sessionLimit ? validSessions.slice(0, sessionLimit) : validSessions;
    
    console.log(`✅ [Hybrid Summary Test] Using ${finalSessions.length} sessions for summary generation`);
    return finalSessions;
  }

  beforeAll(async () => {
    // Validate OpenAI API key is available
    openaiApiKey = process.env.TEST_OPENAI_API_KEY || '';
    if (!openaiApiKey) {
      console.error('❌ [Hybrid Summary Test] Missing OpenAI API key');
      console.log('💡 [Hybrid Summary Test] Add TEST_OPENAI_API_KEY to .env.local');
      throw new Error('TEST_OPENAI_API_KEY is required for hybrid summary test');
    }

    console.log('🔬 [Hybrid Summary Test] Using hybrid approach (mock session data + real OpenAI)');
    console.log('🔬 [Hybrid Summary Test] Test mode:', testMode);
    console.log('🔬 [Hybrid Summary Test] Model:', modelName);
    console.log('🔬 [Hybrid Summary Test] Debug logging:', debugLogging ? 'enabled' : 'disabled');
    if (sessionLimit) {
      console.log('🔬 [Hybrid Summary Test] Session limit:', sessionLimit);
    }
    console.log('💰 [Hybrid Summary Test] WARNING: This test will incur OpenAI costs!');

    // Load pre-analyzed session data
    mockSessionsWithFacts = await loadPreAnalyzedSessions();

    // Create analysis summary service with real OpenAI
    analysisSummaryService = new AnalysisSummaryService(openaiApiKey);

    // Enable debug logging if requested
    if (debugLogging) {
      console.log('🔍 [Hybrid Summary Test] Debug logging enabled - will show detailed API interactions');
    }
  });

  describe('Macro Analysis Summary Generation', () => {
    it('should generate comprehensive analysis summary from pre-analyzed sessions', async () => {
      if (!shouldRunTest(['main', 'all'])) {
        console.log(`⏭️  [Hybrid Summary Test] Skipping main test (mode: ${testMode})`);
        return;
      }

      console.log(`💰 [Hybrid Summary Test] Generating analysis summary for ${mockSessionsWithFacts.length} pre-analyzed sessions`);
      console.log(`💰 [Hybrid Summary Test] Using model: ${modelName}`);

      const startTime = Date.now();

      // Generate analysis summary using real OpenAI
      const result = await analysisSummaryService.generateAnalysisSummary(mockSessionsWithFacts, modelName);

      const duration = Date.now() - startTime;
      console.log(`💰 [Hybrid Summary Test] Summary generation completed in ${duration}ms`);

      // Validate the analysis summary structure
      expect(result).toBeDefined();
      expect(result.overview).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.containmentSuggestion).toBeDefined();
      expect(result.generatedAt).toBeDefined();
      expect(result.sessionsAnalyzed).toBe(mockSessionsWithFacts.length);
      expect(result.statistics).toBeDefined();

      // Validate statistics match the input data
      expect(result.statistics.totalSessions).toBe(mockSessionsWithFacts.length);
      expect(result.statistics.transferRate).toBeGreaterThanOrEqual(0);
      expect(result.statistics.transferRate).toBeLessThanOrEqual(100);
      expect(result.statistics.containmentRate).toBeGreaterThanOrEqual(0);
      expect(result.statistics.containmentRate).toBeLessThanOrEqual(100);
      expect(result.statistics.averageSessionLength).toBeGreaterThan(0);
      expect(result.statistics.averageMessagesPerSession).toBeGreaterThan(0);

      // Validate content quality (basic checks)
      expect(result.overview.length).toBeGreaterThan(100); // Should be substantial
      expect(result.summary.length).toBeGreaterThan(200); // Should be detailed
      expect(result.containmentSuggestion.length).toBeGreaterThan(20); // Should be meaningful
      expect(result.containmentSuggestion.length).toBeLessThan(200); // Should be concise

      // Validate that the analysis references actual data patterns
      expect(result.overview.toLowerCase()).toMatch(/(session|bot|transfer|contain)/);
      expect(result.summary.toLowerCase()).toMatch(/(session|bot|transfer|contain|user)/);
      expect(result.containmentSuggestion.toLowerCase()).toMatch(/(bot|transfer|contain|improve)/);

      console.log('📊 [Hybrid Summary Test] Analysis Summary Results:');
      console.log(`   Sessions Analyzed: ${result.sessionsAnalyzed}`);
      console.log(`   Transfer Rate: ${result.statistics.transferRate.toFixed(1)}%`);
      console.log(`   Containment Rate: ${result.statistics.containmentRate.toFixed(1)}%`);
      console.log(`   Avg Session Length: ${result.statistics.averageSessionLength.toFixed(1)} minutes`);
      console.log(`   Avg Messages/Session: ${result.statistics.averageMessagesPerSession.toFixed(1)}`);

      if (debugLogging) {
        console.log('\n🔍 [Hybrid Summary Test] Generated Analysis Overview:');
        console.log('─'.repeat(80));
        console.log(result.overview);
        console.log('─'.repeat(80));
        
        console.log('\n🔍 [Hybrid Summary Test] Generated Analysis Summary:');
        console.log('─'.repeat(80));
        console.log(result.summary);
        console.log('─'.repeat(80));
        
        console.log('\n🔍 [Hybrid Summary Test] Generated Containment Suggestion:');
        console.log('─'.repeat(80));
        console.log(result.containmentSuggestion);
        console.log('─'.repeat(80));
      }

    }, 120000); // 2 minute timeout for complex analysis summary generation

    it('should handle different session outcome distributions correctly', async () => {
      if (!shouldRunTest(['all'])) {
        console.log(`⏭️  [Hybrid Summary Test] Skipping outcome distribution test (mode: ${testMode})`);
        return;
      }

      // Filter to get sessions with different outcomes for testing
      const containedSessions = mockSessionsWithFacts.filter(s => s.facts.sessionOutcome === 'Contained');
      const transferredSessions = mockSessionsWithFacts.filter(s => s.facts.sessionOutcome === 'Transfer');

      console.log(`💰 [Hybrid Summary Test] Testing with ${containedSessions.length} contained + ${transferredSessions.length} transferred sessions`);

      // Create a balanced subset if we have both types
      let testSessions: SessionWithFacts[];
      if (containedSessions.length > 0 && transferredSessions.length > 0) {
        const maxEach = Math.min(5, Math.min(containedSessions.length, transferredSessions.length));
        testSessions = [
          ...containedSessions.slice(0, maxEach),
          ...transferredSessions.slice(0, maxEach)
        ];
      } else {
        // Use all available sessions if we don't have both types
        testSessions = mockSessionsWithFacts.slice(0, 10);
      }

      const result = await analysisSummaryService.generateAnalysisSummary(testSessions, modelName);

      expect(result.sessionsAnalyzed).toBe(testSessions.length);
      
      // Calculate expected transfer rate
      const transferCount = testSessions.filter(s => s.facts.sessionOutcome === 'Transfer').length;
      const expectedTransferRate = (transferCount / testSessions.length) * 100;
      
      expect(Math.abs(result.statistics.transferRate - expectedTransferRate)).toBeLessThan(1); // Allow for rounding
      
      console.log(`💰 [Hybrid Summary Test] Distribution test - Transfer rate: ${result.statistics.transferRate.toFixed(1)}% (expected: ${expectedTransferRate.toFixed(1)}%)`);

    }, 90000); // 1.5 minute timeout

    it('should generate consistent analysis structure regardless of input size', async () => {
      if (!shouldRunTest(['all'])) {
        console.log(`⏭️  [Hybrid Summary Test] Skipping consistency test (mode: ${testMode})`);
        return;
      }

      // Test with a smaller subset
      const smallSubset = mockSessionsWithFacts.slice(0, Math.min(5, mockSessionsWithFacts.length));
      
      console.log(`💰 [Hybrid Summary Test] Testing consistency with ${smallSubset.length} sessions`);

      const result = await analysisSummaryService.generateAnalysisSummary(smallSubset, modelName);

      // Should have the same structure regardless of input size
      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('containmentSuggestion');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('sessionsAnalyzed');
      expect(result).toHaveProperty('statistics');

      // Statistics should be reasonable for the smaller dataset
      expect(result.sessionsAnalyzed).toBe(smallSubset.length);
      expect(result.statistics.totalSessions).toBe(smallSubset.length);
      expect(result.statistics.transferRate).toBeGreaterThanOrEqual(0);
      expect(result.statistics.transferRate).toBeLessThanOrEqual(100);

      // Content should still be substantial even with fewer sessions
      expect(result.overview.length).toBeGreaterThan(50);
      expect(result.summary.length).toBeGreaterThan(100);
      expect(result.containmentSuggestion.length).toBeGreaterThan(10);

      console.log(`💰 [Hybrid Summary Test] Small dataset test - Generated analysis for ${result.sessionsAnalyzed} sessions`);

    }, 60000); // 1 minute timeout for smaller dataset
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty session array gracefully', async () => {
      if (!shouldRunTest(['all'])) {
        console.log(`⏭️  [Hybrid Summary Test] Skipping empty array test (mode: ${testMode})`);
        return;
      }

      console.log('💰 [Hybrid Summary Test] Testing error handling with empty session array');

      await expect(analysisSummaryService.generateAnalysisSummary([], modelName))
        .rejects.toThrow();

    }, 30000);

    it('should handle sessions with minimal facts gracefully', async () => {
      if (!shouldRunTest(['all'])) {
        console.log(`⏭️  [Hybrid Summary Test] Skipping minimal facts test (mode: ${testMode})`);
        return;
      }

      // Create a session with minimal facts data
      const minimalSession: SessionWithFacts = {
        session_id: 'test-minimal-001',
        user_id: 'test-user-001',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [
          { message: 'Hello', message_type: 'bot', timestamp: new Date().toISOString() },
          { message: 'Hi', message_type: 'user', timestamp: new Date().toISOString() }
        ],
        message_count: 2,
        user_message_count: 1,
        bot_message_count: 1,
        facts: {
          generalIntent: 'General Inquiry',
          sessionOutcome: 'Contained',
          transferReason: '',
          dropOffLocation: '',
          notes: 'Simple test session'
        },
        analysisMetadata: {
          tokensUsed: 100,
          processingTime: 1000,
          batchNumber: 1,
          timestamp: new Date().toISOString()
        }
      };

      console.log('💰 [Hybrid Summary Test] Testing with minimal session facts');

      const result = await analysisSummaryService.generateAnalysisSummary([minimalSession], modelName);

      // Should still produce valid analysis even with minimal data
      expect(result.sessionsAnalyzed).toBe(1);
      expect(result.overview).toBeTruthy();
      expect(result.summary).toBeTruthy();
      expect(result.containmentSuggestion).toBeTruthy();

      console.log('💰 [Hybrid Summary Test] Minimal facts test completed successfully');

    }, 60000);
  });
});