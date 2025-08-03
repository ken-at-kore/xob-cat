/**
 * Test suite for optimized SessionSamplingService
 * Tests the business logic layer with lazy loading pattern
 */

import { SessionSamplingService } from '../../services/sessionSamplingService';
import { SWTService } from '../../services/swtService';
import { KoreApiService } from '../../services/koreApiService';
import { SessionWithTranscript } from '../../models/swtModels';

// Mock the services
jest.mock('../../services/swtService');
jest.mock('../../services/koreApiService');

describe('SessionSamplingService - Optimized Lazy Loading', () => {
  let sessionSamplingService: SessionSamplingService;
  let mockSWTService: jest.Mocked<SWTService>;
  let mockKoreApiService: jest.Mocked<KoreApiService>;

  beforeEach(() => {
    const mockConfig = {
      botId: 'test-bot-id',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      baseUrl: 'https://bots.kore.ai'
    };

    mockSWTService = new SWTService(mockConfig) as jest.Mocked<SWTService>;
    mockKoreApiService = new KoreApiService(mockConfig) as jest.Mocked<KoreApiService>;
    sessionSamplingService = new SessionSamplingService(mockSWTService, mockKoreApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('optimized sampling workflow', () => {
    it('should follow metadata-first sampling pattern for performance', async () => {
      // Setup: Mock large dataset of session metadata (no messages)
      const mockSessionMetadata: SessionWithTranscript[] = Array.from({ length: 1000 }, (_, i) => ({
        session_id: `session_${i}`,
        user_id: `user_${i}`,
        start_time: `2025-08-01T${String(15 + Math.floor(i/100)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
        end_time: `2025-08-01T${String(15 + Math.floor(i/100)).padStart(2, '0')}:${String((i % 60) + 10).padStart(2, '0')}:00Z`,
        containment_type: ['agent', 'selfService', 'dropOff'][i % 3] as any,
        tags: [],
        metrics: {},
        duration_seconds: 600,
        message_count: 5 + (i % 10),
        user_message_count: 3 + (i % 5),
        bot_message_count: 2 + (i % 5),
        messages: [] // Empty - metadata only
      }));

      // Mock sampled sessions with messages populated
      const mockSampledSessions: SessionWithTranscript[] = mockSessionMetadata
        .slice(0, 10) // First 10 sessions
        .map(session => ({
          ...session,
          messages: [
            {
              timestamp: session.start_time,
              message_type: 'user' as const,
              message: 'Hello'
            }
          ]
        }));

      // Create mock session metadata for KoreApiService
      const mockSessionMetadataForApi = mockSessionMetadata.map(session => ({
        sessionId: session.session_id,
        userId: session.user_id,
        start_time: session.start_time,
        end_time: session.end_time,
        containment_type: session.containment_type || 'agent' as 'agent' | 'selfService' | 'dropOff',
        tags: session.tags || [],
        metrics: {
          total_messages: session.message_count || 0,
          user_messages: session.user_message_count || 0,
          bot_messages: session.bot_message_count || 0
        },
        duration_seconds: session.duration_seconds || 0
      }));
      
      // Mock KoreApiService calls
      mockKoreApiService.getSessionsMetadata.mockResolvedValue(mockSessionMetadataForApi);
      
      // Mock SWTService calls
      mockSWTService.createSWTsFromMetadata.mockResolvedValue(mockSessionMetadata);
      mockSWTService.populateMessages.mockResolvedValue(mockSampledSessions);

      const config = {
        startDate: '2025-08-01',
        startTime: '15:00',
        sessionCount: 10,
        openaiApiKey: 'test-key',
        modelId: 'gpt-4o-mini'
      };

      const result = await sessionSamplingService.sampleSessions(config);

      // Verify the optimized workflow was followed
      
      // 1. Should create SWTs from metadata first (fast operation)
      expect(mockSWTService.createSWTsFromMetadata).toHaveBeenCalledTimes(1);
      
      // 2. Should populate messages only for sampled sessions (selective operation)
      expect(mockSWTService.populateMessages).toHaveBeenCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.stringMatching(/^session_\d+$/),
        ])
      );

      // Verify the sampling results
      expect(result.sessions).toHaveLength(10);
      expect(result.sessions[0]?.messages).toHaveLength(1);
      expect(result.totalFound).toBe(1000);
    });

    it('should handle time window expansion efficiently', async () => {
      // Mock insufficient sessions in first window
      const mockSessionsWindow1: SessionWithTranscript[] = Array.from({ length: 5 }, (_, i) => ({
        session_id: `session_${i}`,
        user_id: `user_${i}`,
        start_time: '2025-08-01T15:00:00Z',
        end_time: '2025-08-01T15:10:00Z',
        containment_type: 'agent',
        tags: [],
        metrics: {},
        duration_seconds: 600,
        message_count: 5,
        user_message_count: 3,
        bot_message_count: 2,
        messages: []
      }));

      // Mock more sessions in expanded window
      const mockSessionsWindow2: SessionWithTranscript[] = Array.from({ length: 25 }, (_, i) => ({
        session_id: `session_${i + 5}`,
        user_id: `user_${i + 5}`,
        start_time: '2025-08-01T16:00:00Z',
        end_time: '2025-08-01T16:10:00Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        duration_seconds: 600,
        message_count: 8,
        user_message_count: 4,
        bot_message_count: 4,
        messages: []
      }));

      // Create mock session metadata for KoreApiService (first window insufficient)
      const mockMetadataWindow1 = mockSessionsWindow1.map(session => ({
        sessionId: session.session_id,
        userId: session.user_id,
        start_time: session.start_time,
        end_time: session.end_time,
        containment_type: session.containment_type || 'agent' as 'agent' | 'selfService' | 'dropOff',
        tags: session.tags || [],
        metrics: {
          total_messages: session.message_count || 0,
          user_messages: session.user_message_count || 0,
          bot_messages: session.bot_message_count || 0
        },
        duration_seconds: session.duration_seconds || 0
      }));

      const mockMetadataWindow2 = [...mockSessionsWindow1, ...mockSessionsWindow2].map(session => ({
        sessionId: session.session_id,
        userId: session.user_id,
        start_time: session.start_time,
        end_time: session.end_time,
        containment_type: session.containment_type || 'agent' as 'agent' | 'selfService' | 'dropOff',
        tags: session.tags || [],
        metrics: {
          total_messages: session.message_count || 0,
          user_messages: session.user_message_count || 0,
          bot_messages: session.bot_message_count || 0
        },
        duration_seconds: session.duration_seconds || 0
      }));

      // Mock sequential calls for time windows
      mockKoreApiService.getSessionsMetadata
        .mockResolvedValueOnce(mockMetadataWindow1.slice(0, 5)) // First window - insufficient
        .mockResolvedValueOnce(mockMetadataWindow2); // Expanded window

      mockSWTService.createSWTsFromMetadata
        .mockResolvedValueOnce(mockSessionsWindow1) // First window - insufficient
        .mockResolvedValueOnce([...mockSessionsWindow1, ...mockSessionsWindow2]); // Expanded window

      mockSWTService.populateMessages.mockResolvedValue(
        [...mockSessionsWindow1, ...mockSessionsWindow2].slice(0, 20).map(session => ({
          ...session,
          messages: [{ 
            timestamp: session.start_time, 
            message_type: 'user' as const, 
            message: 'Hello' 
          }]
        }))
      );

      const config = {
        startDate: '2025-08-01',
        startTime: '15:00',
        sessionCount: 20,
        openaiApiKey: 'test-key',
        modelId: 'gpt-4o-mini'
      };

      const result = await sessionSamplingService.sampleSessions(config);

      // Verify time window expansion occurred
      expect(mockSWTService.createSWTsFromMetadata).toHaveBeenCalledTimes(2);
      expect(result.sessions).toHaveLength(20);
      expect(result.timeWindows).toHaveLength(2);
    });

    it('should validate message population is selective', async () => {
      const mockSessionMetadata: SessionWithTranscript[] = Array.from({ length: 100 }, (_, i) => ({
        session_id: `session_${i}`,
        user_id: `user_${i}`,
        start_time: '2025-08-01T15:00:00Z',
        end_time: '2025-08-01T15:10:00Z',
        containment_type: 'agent',
        tags: [],
        metrics: {},
        duration_seconds: 600,
        message_count: 5,
        user_message_count: 3,
        bot_message_count: 2,
        messages: []
      }));

      // Mock KoreApiService for third test
      const mockMetadataForThirdTest = mockSessionMetadata.map(session => ({
        sessionId: session.session_id,
        userId: session.user_id,
        start_time: session.start_time,
        end_time: session.end_time,
        containment_type: session.containment_type || 'agent' as 'agent' | 'selfService' | 'dropOff',
        tags: session.tags || [],
        metrics: {
          total_messages: session.message_count || 0,
          user_messages: session.user_message_count || 0,
          bot_messages: session.bot_message_count || 0
        },
        duration_seconds: session.duration_seconds || 0
      }));
      
      mockKoreApiService.getSessionsMetadata.mockResolvedValue(mockMetadataForThirdTest);
      mockSWTService.createSWTsFromMetadata.mockResolvedValue(mockSessionMetadata);
      mockSWTService.populateMessages.mockImplementation(async (swts, sessionIds) => {
        // Verify only requested sessions get messages
        expect(sessionIds).toHaveLength(5); // Requested session count
        
        return swts.slice(0, 5).map(session => ({
          ...session,
          messages: [{ 
            timestamp: session.start_time, 
            message_type: 'user' as const, 
            message: 'Hello' 
          }]
        }));
      });

      const config = {
        startDate: '2025-08-01',
        startTime: '15:00',
        sessionCount: 5,
        openaiApiKey: 'test-key',
        modelId: 'gpt-4o-mini'
      };

      const result = await sessionSamplingService.sampleSessions(config);

      // Verify selective message population
      expect(result.sessions).toHaveLength(5);
      expect(mockSWTService.populateMessages).toHaveBeenCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.stringMatching(/^session_\d+$/),
        ])
      );
    });

    it('should handle progress callbacks correctly', async () => {
      const mockSessionMetadata: SessionWithTranscript[] = Array.from({ length: 50 }, (_, i) => ({
        session_id: `session_${i}`,
        user_id: `user_${i}`,
        start_time: '2025-08-01T15:00:00Z',
        end_time: '2025-08-01T15:10:00Z',
        containment_type: 'agent',
        tags: [],
        metrics: {},
        duration_seconds: 600,
        message_count: 5,
        user_message_count: 3,
        bot_message_count: 2,
        messages: []
      }));

      mockSWTService.createSWTsFromMetadata.mockResolvedValue(mockSessionMetadata);
      mockSWTService.populateMessages.mockResolvedValue(
        mockSessionMetadata.slice(0, 10).map(session => ({
          ...session,
          messages: [{ 
            timestamp: session.start_time, 
            message_type: 'user' as const, 
            message: 'Hello' 
          }]
        }))
      );

      const progressCallback = jest.fn();
      const config = {
        startDate: '2025-08-01',
        startTime: '15:00',
        sessionCount: 10,
        openaiApiKey: 'test-key',
        modelId: 'gpt-4o-mini'
      };

      await sessionSamplingService.sampleSessions(config, progressCallback);

      // Verify progress callbacks were made
      expect(progressCallback).toHaveBeenCalledWith(
        expect.stringContaining('sessions'),
        expect.any(Number),
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('performance characteristics', () => {
    it('should handle large datasets without timeout', async () => {
      // Simulate large dataset that would previously cause timeout
      const largeDataset: SessionWithTranscript[] = Array.from({ length: 5000 }, (_, i) => ({
        session_id: `session_${i}`,
        user_id: `user_${i}`,
        start_time: '2025-08-01T15:00:00Z',
        end_time: '2025-08-01T15:10:00Z',
        containment_type: 'agent',
        tags: [],
        metrics: {},
        duration_seconds: 600,
        message_count: 5,
        user_message_count: 3,
        bot_message_count: 2,
        messages: [] // No messages in metadata
      }));

      // Mock fast metadata retrieval
      mockSWTService.createSWTsFromMetadata.mockResolvedValue(largeDataset);
      
      // Mock selective message population (only for sampled sessions)
      mockSWTService.populateMessages.mockImplementation(async (swts, sessionIds) => {
        expect(sessionIds).toHaveLength(50); // Only 50 sessions, not 5000
        return swts.slice(0, 50).map(session => ({
          ...session,
          messages: [{ 
            timestamp: session.start_time, 
            message_type: 'user' as const, 
            message: 'Hello' 
          }]
        }));
      });

      const config = {
        startDate: '2025-08-01',
        startTime: '15:00',
        sessionCount: 50,
        openaiApiKey: 'test-key',
        modelId: 'gpt-4o-mini'
      };

      const startTime = Date.now();
      const result = await sessionSamplingService.sampleSessions(config);
      const endTime = Date.now();

      // Verify reasonable performance (should be fast due to lazy loading)
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
      expect(result.sessions).toHaveLength(50);
      expect(result.totalFound).toBe(5000);
    });
  });
});