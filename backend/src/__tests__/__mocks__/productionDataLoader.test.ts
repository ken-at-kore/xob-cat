import { ProductionDataLoader } from '../../__mocks__/productionDataLoader';

describe('ProductionDataLoader', () => {
  let loader: ProductionDataLoader;

  beforeEach(() => {
    loader = ProductionDataLoader.getInstance();
  });

  test('should be a singleton', () => {
    const loader2 = ProductionDataLoader.getInstance();
    expect(loader).toBe(loader2);
  });

  test('should check data availability', () => {
    const isAvailable = loader.isDataAvailable();
    // Should be true if data files exist in data/ directory
    expect(typeof isAvailable).toBe('boolean');
  });

  test('should get session stats', () => {
    const stats = loader.getSessionStats();
    expect(stats).toHaveProperty('selfService');
    expect(stats).toHaveProperty('agent');
    expect(stats).toHaveProperty('dropOff');
    expect(typeof stats.selfService).toBe('number');
    expect(typeof stats.agent).toBe('number');
    expect(typeof stats.dropOff).toBe('number');
  });

  test('should get sessions with transcripts', () => {
    const sessions = loader.getSessionsWithTranscripts({ limit: 5 });
    expect(Array.isArray(sessions)).toBe(true);
    
    if (sessions.length > 0) {
      const session = sessions[0]!;
      expect(session).toHaveProperty('session_id');
      expect(session).toHaveProperty('messages');
      expect(session).toHaveProperty('containment_type');
      expect(Array.isArray(session.messages)).toBe(true);
    }
  });

  test('should generate mock sessions from patterns', () => {
    const timeRange = {
      start: new Date('2025-01-01'),
      end: new Date('2025-01-02')
    };
    
    const mockSessions = loader.generateMockSessionsFromPatterns(3, timeRange);
    expect(Array.isArray(mockSessions)).toBe(true);
    expect(mockSessions.length).toBeLessThanOrEqual(3);
    
    if (mockSessions.length > 0) {
      const session = mockSessions[0]!;
      expect(session).toHaveProperty('session_id');
      expect(session).toHaveProperty('messages');
      expect(session.session_id).toMatch(/^mock_/);
      
      // Check that timestamps are in the specified range
      const sessionStart = new Date(session.start_time);
      expect(sessionStart.getTime()).toBeGreaterThanOrEqual(timeRange.start.getTime());
      expect(sessionStart.getTime()).toBeLessThanOrEqual(timeRange.end.getTime());
    }
  });

  test('should filter by containment type', () => {
    const selfServiceSessions = loader.getSessionsWithTranscripts({ 
      containment_type: 'selfService',
      limit: 10
    });
    
    expect(Array.isArray(selfServiceSessions)).toBe(true);
    
    if (selfServiceSessions.length > 0) {
      selfServiceSessions.forEach(session => {
        expect(session.containment_type).toBe('selfService');
      });
    }
  });
});