import { ConflictResolutionService } from '../../services/conflictResolutionService';
import { ParallelProcessingOrchestratorService } from '../../services/parallelProcessingOrchestratorService';
import { ParallelAutoAnalyzeService } from '../../services/parallelAutoAnalyzeService';
import { SessionWithTranscript, SessionWithFacts, ExistingClassifications, ParallelConfig } from '../../../../shared/types';
import { StreamProcessingService } from '../../services/streamProcessingService';
import { TokenManagementService } from '../../services/tokenManagementService';
import { SessionValidationService } from '../../services/sessionValidationService';
import { SessionSamplingService } from '../../services/sessionSamplingService';
import { BatchAnalysisService } from '../../services/batchAnalysisService';
import { ServiceFactory } from '../../factories/serviceFactory';

describe('Conflict Resolution Between Rounds Integration Test', () => {
  let conflictResolutionService: ConflictResolutionService;
  let parallelProcessingOrchestrator: ParallelProcessingOrchestratorService;
  let mockApiKey: string;

  beforeEach(() => {
    mockApiKey = 'sk-test1234567890123456789012345678901234567890';
    
    // Set up services
    const openaiService = ServiceFactory.createOpenAIService();
    conflictResolutionService = new ConflictResolutionService(openaiService);
    
    const tokenManagementService = new TokenManagementService();
    const sessionValidationService = new SessionValidationService();
    const streamProcessingService = new StreamProcessingService(
      tokenManagementService,
      sessionValidationService,
      openaiService
    );
    
    parallelProcessingOrchestrator = new ParallelProcessingOrchestratorService(
      streamProcessingService,
      tokenManagementService
    );
  });

  describe('Current Architecture - Conflict Resolution Only at End', () => {
    it('should verify conflict resolution does NOT happen between rounds currently', async () => {
      const testSessions: SessionWithTranscript[] = createTestSessionsWithDuplicateClassifications();
      const baseClassifications: ExistingClassifications = {
        generalIntent: new Set(['Billing Question']),
        transferReason: new Set(),
        dropOffLocation: new Set()
      };

      const config: ParallelConfig = {
        streamCount: 2,
        sessionsPerStream: 2,
        maxSessionsPerLLMCall: 2,
        syncFrequency: 'after_each_round',
        retryAttempts: 1,
        debugLogging: true
      };

      let conflictResolutionCallCount = 0;
      let roundCompletionCallbacks: string[] = [];
      
      // Spy on conflict resolution to track when it's called
      const originalResolveConflicts = conflictResolutionService.resolveConflicts.bind(conflictResolutionService);
      const mockedResolveConflicts = jest.fn().mockImplementation(async (sessions: SessionWithFacts[], apiKey: string, modelId?: string) => {
        conflictResolutionCallCount++;
        console.log(`🔍 CONFLICT RESOLUTION CALLED - Count: ${conflictResolutionCallCount}`);
        return originalResolveConflicts(sessions, apiKey, modelId);
      });
      conflictResolutionService.resolveConflicts = mockedResolveConflicts;

      // Track progress to see round completions
      const progressCallback = jest.fn().mockImplementation((phase: string, streamsActive: number, totalProgress: number, streamProgress: any[]) => {
        const message = `Phase: ${phase}, Streams: ${streamsActive}`;
        roundCompletionCallbacks.push(message);
        console.log(`📊 PROGRESS CALLBACK: ${message}`);
      });

      try {
        // This should process in multiple rounds but NOT call conflict resolution between rounds
        const result = await parallelProcessingOrchestrator.processInParallel(
          testSessions,
          baseClassifications,
          config,
          mockApiKey,
          'gpt-4o-mini',
          progressCallback
        );

        // Assertions for current architecture
        expect(conflictResolutionCallCount).toBe(0); // Should NOT be called during parallel processing
        expect(roundCompletionCallbacks.length).toBeGreaterThan(0); // Should have multiple rounds
        expect(result.processedSessions.length).toBeGreaterThan(0);
        
        console.log(`✅ CURRENT ARCHITECTURE VERIFIED: Conflict resolution NOT called during parallel processing (${conflictResolutionCallCount} times)`);
        console.log(`📊 Total round callbacks: ${roundCompletionCallbacks.length}`);
        
      } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
      }
    });
  });

  describe('Testing Conflict Resolution Between Rounds (IMPLEMENTED)', () => {
    it('should verify ParallelAutoAnalyzeService has proper dependency injection', async () => {
      // Test the real service creation path that production uses
      const koreApiService = ServiceFactory.createKoreApiService({
        botId: 'test-bot',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        baseUrl: 'https://bots.kore.ai'
      });
      const openaiService = ServiceFactory.createOpenAIService();
      
      const swtService = new (require('../../services/swtService').SWTService)(koreApiService);
      const sessionSamplingService = new SessionSamplingService(swtService, koreApiService);
      const batchAnalysisService = new BatchAnalysisService(openaiService);

      // Create the service exactly like production does
      const parallelAutoAnalyzeService = new ParallelAutoAnalyzeService(
        koreApiService,
        sessionSamplingService,
        batchAnalysisService,
        openaiService,
        'test-bot'
      );

      // Access the private orchestrator to verify it has the conflict resolution service
      const orchestrator = parallelAutoAnalyzeService['parallelProcessingOrchestratorService'];
      const conflictService = orchestrator['conflictResolutionService'];
      
      expect(conflictService).toBeDefined();
      expect(conflictService).toBeInstanceOf(ConflictResolutionService);
      
      console.log('✅ ParallelAutoAnalyzeService dependency injection verified');
    });

    it('should detect duplicate classifications that would benefit from inter-round resolution', async () => {
      // Create sessions that would generate similar but not identical classifications
      const sessionWithSimilarClassifications: SessionWithTranscript[] = createTestSessionsWithDuplicateClassifications();

      // These sessions would likely generate similar but slightly different classifications:
      // - "Billing Question", "Billing Inquiry", "Billing Issue", "Invoice Question"
      // Conflict resolution between rounds should consolidate these

      const mockClassificationsAfterRound1: ExistingClassifications = {
        generalIntent: new Set(['Billing Question', 'Billing Inquiry']),
        transferReason: new Set(),
        dropOffLocation: new Set()
      };

      const mockClassificationsAfterRound2: ExistingClassifications = {
        generalIntent: new Set(['Billing Question', 'Billing Inquiry', 'Billing Issue', 'Invoice Question']),
        transferReason: new Set(),
        dropOffLocation: new Set()
      };

      // Test if conflict resolution would find conflicts
      const conflicts = conflictResolutionService.identifyPotentialConflicts(mockClassificationsAfterRound2);
      
      expect(conflicts.intentConflicts.length).toBeGreaterThan(0);
      console.log(`🔍 POTENTIAL CONFLICTS DETECTED: ${conflicts.intentConflicts.length} groups`);
      console.log(`📋 Conflict Groups:`, conflicts.intentConflicts);
    });

    it('should run conflict resolution between rounds with multiple rounds', async () => {
      // Create enough sessions to force multiple rounds (8 sessions = 2 rounds with 2 streams × 2 sessions)
      const testSessions: SessionWithTranscript[] = [
        ...createTestSessionsWithDuplicateClassifications(),
        ...createTestSessionsWithDuplicateClassifications().map(s => ({
          ...s,
          session_id: s.session_id + '-round2',
          user_id: s.user_id + '-round2'
        }))
      ];

      const baseClassifications: ExistingClassifications = {
        generalIntent: new Set(['Billing Question']),
        transferReason: new Set(),
        dropOffLocation: new Set()
      };

      const config: ParallelConfig = {
        streamCount: 2,
        sessionsPerStream: 2,
        maxSessionsPerLLMCall: 2,
        syncFrequency: 'after_each_round',
        retryAttempts: 1,
        debugLogging: true
      };

      let conflictResolutionCallCount = 0;
      
      // Update the orchestrator with conflict resolution service
      const openaiService = ServiceFactory.createOpenAIService();
      const conflictService = new ConflictResolutionService(openaiService);
      const orchestratorWithConflictResolution = new ParallelProcessingOrchestratorService(
        parallelProcessingOrchestrator['streamProcessingService'],
        parallelProcessingOrchestrator['tokenManagementService'],
        conflictService
      );
      
      // Spy on conflict resolution to track when it's called
      const originalResolveConflicts = conflictService.resolveConflicts.bind(conflictService);
      conflictService.resolveConflicts = jest.fn().mockImplementation(async (sessions: SessionWithFacts[], apiKey: string, modelId?: string) => {
        conflictResolutionCallCount++;
        console.log(`🔍 INTER-ROUND CONFLICT RESOLUTION CALLED - Count: ${conflictResolutionCallCount}, Sessions: ${sessions.length}`);
        return originalResolveConflicts(sessions, apiKey, modelId);
      });

      try {
        // This should process in 2 rounds and call conflict resolution between rounds
        const result = await orchestratorWithConflictResolution.processInParallel(
          testSessions,
          baseClassifications,
          config,
          mockApiKey,
          'gpt-4o-mini'
        );

        // Assertions for new architecture
        expect(conflictResolutionCallCount).toBeGreaterThan(0); // Should be called between rounds
        expect(result.processedSessions.length).toBe(8); // All sessions processed
        expect(result.processingStats.totalRounds).toBeGreaterThan(1); // Multiple rounds
        
        console.log(`✅ INTER-ROUND CONFLICT RESOLUTION VERIFIED: Called ${conflictResolutionCallCount} times between rounds`);
        
      } catch (error) {
        console.error('❌ Inter-round conflict resolution test failed:', error);
        throw error;
      }
    });
  });
});

function createTestSessionsWithDuplicateClassifications(): SessionWithTranscript[] {
  return [
    {
      session_id: 'dup-test-1',
      user_id: 'dup-user-1',
      start_time: '2025-01-01T09:00:00Z',
      end_time: '2025-01-01T09:05:00Z',
      containment_type: 'agent',
      tags: [],
      metrics: {},
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1,
      messages: [
        { message: 'I need help with my claim status', message_type: 'user', timestamp: '2025-01-01T09:00:00Z' },
        { message: 'I can help check your claim status', message_type: 'bot', timestamp: '2025-01-01T09:00:10Z' }
      ]
    },
    {
      session_id: 'dup-test-2', 
      user_id: 'dup-user-2',
      start_time: '2025-01-01T09:10:00Z',
      end_time: '2025-01-01T09:15:00Z',
      containment_type: 'agent',
      tags: [],
      metrics: {},
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1,
      messages: [
        { message: 'Claim inquiry here', message_type: 'user', timestamp: '2025-01-01T09:10:00Z' },
        { message: 'I can assist with claim inquiries', message_type: 'bot', timestamp: '2025-01-01T09:10:10Z' }
      ]
    },
    {
      session_id: 'dup-test-3',
      user_id: 'dup-user-3', 
      start_time: '2025-01-01T09:20:00Z',
      end_time: '2025-01-01T09:25:00Z',
      containment_type: 'agent',
      tags: [],
      metrics: {},
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1,
      messages: [
        { message: 'Question about my claim', message_type: 'user', timestamp: '2025-01-01T09:20:00Z' },
        { message: 'Let me help with your claim question', message_type: 'bot', timestamp: '2025-01-01T09:20:10Z' }
      ]
    },
    {
      session_id: 'dup-test-4',
      user_id: 'dup-user-4',
      start_time: '2025-01-01T09:30:00Z', 
      end_time: '2025-01-01T09:35:00Z',
      containment_type: 'agent',
      tags: [],
      metrics: {},
      message_count: 2,
      user_message_count: 1,
      bot_message_count: 1,
      messages: [
        { message: 'I want to check claim info', message_type: 'user', timestamp: '2025-01-01T09:30:00Z' },
        { message: 'I can provide claim information', message_type: 'bot', timestamp: '2025-01-01T09:30:10Z' }
      ]
    }
  ];
}