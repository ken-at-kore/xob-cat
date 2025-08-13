import { getSimplifiedStatusText, calculateProgressPercentage, getPhaseLabel } from '../progressUtils';
import { AnalysisProgress, ParallelAnalysisProgress } from '../../../../../../shared/types';

describe('Progress Utils', () => {
  describe('getSimplifiedStatusText', () => {
    const testCases = [
      {
        input: 'Initializing parallel analysis',
        expected: 'Initializing analysis',
      },
      {
        input: 'Searching in Initial 3-hour window',
        expected: 'Searching for sessions',
      },
      {
        input: 'Processing discovery batch 1/3 (5 sessions)',
        expected: 'Analyzing initial sessions (1/3)',
      },
      {
        input: 'Parallel processing: Round 1/3',
        expected: 'Analyzing sessions: Round 1/3',
      },
      {
        input: 'Conflict resolution after round 1',
        expected: 'Consolidating classifications: Round 1',
      },
      {
        input: 'Conflict resolution complete (round 2)',
        expected: 'Classifications consolidated: Round 2',
      },
      {
        input: 'Generating summary with AI',
        expected: 'Generating analysis summary',
      },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should map "${input}" to "${expected}"`, () => {
        expect(getSimplifiedStatusText(input)).toBe(expected);
      });
    });

    it('should handle null/undefined input', () => {
      expect(getSimplifiedStatusText('')).toBe('Preparing analysis');
      expect(getSimplifiedStatusText(null as any)).toBe('Preparing analysis');
      expect(getSimplifiedStatusText(undefined as any)).toBe('Preparing analysis');
    });

    it('should return cleaned version for unrecognized text', () => {
      expect(getSimplifiedStatusText('Some random status')).toBe('Some random status');
    });
  });

  describe('calculateProgressPercentage', () => {
    it('should return 100% for complete phase', () => {
      const progress: AnalysisProgress = {
        analysisId: 'test-123',
        phase: 'complete',
        currentStep: 'Analysis complete',
        sessionsFound: 100,
        sessionsProcessed: 100,
        totalSessions: 100,
        batchesCompleted: 20,
        totalBatches: 20,
        tokensUsed: 5000,
        estimatedCost: 0.05,
        startTime: new Date().toISOString(),
      };

      expect(calculateProgressPercentage(progress)).toBe(100);
    });

    it('should calculate correct progress for sampling phase', () => {
      const progress: AnalysisProgress = {
        analysisId: 'test-123',
        phase: 'sampling',
        currentStep: 'Searching for sessions',
        sessionsFound: 50,
        sessionsProcessed: 0,
        totalSessions: 100,
        batchesCompleted: 0,
        totalBatches: 0,
        tokensUsed: 0,
        estimatedCost: 0,
        startTime: new Date().toISOString(),
        samplingProgress: {
          currentWindowIndex: 1,
          totalWindows: 4,
          currentWindowLabel: '6-hour window',
          targetSessionCount: 100,
        },
      };

      const result = calculateProgressPercentage(progress);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(20); // Should be within sampling phase weight
    });

    it('should calculate correct progress for parallel processing with inter-round conflict resolution', () => {
      const progress: ParallelAnalysisProgress = {
        analysisId: 'test-123',
        phase: 'parallel_processing',
        currentStep: 'Conflict resolution after round 2',
        sessionsFound: 100,
        sessionsProcessed: 66,
        totalSessions: 100,
        batchesCompleted: 0,
        totalBatches: 0,
        tokensUsed: 2000,
        estimatedCost: 0.02,
        startTime: new Date().toISOString(),
        roundsCompleted: 2,
        totalRounds: 3,
        streamsActive: 0,
      };

      const result = calculateProgressPercentage(progress);
      expect(result).toBeGreaterThan(55); // Should include bonus for conflict resolution
      expect(result).toBeLessThan(85); // Should still be within parallel processing range
    });

    it('should calculate progress for all phases correctly', () => {
      const phases = [
        { phase: 'sampling', expectedMin: 0, expectedMax: 20 },
        { phase: 'discovery', expectedMin: 20, expectedMax: 35 },
        { phase: 'parallel_processing', expectedMin: 35, expectedMax: 85 },
        { phase: 'conflict_resolution', expectedMin: 85, expectedMax: 95 },
        { phase: 'generating_summary', expectedMin: 95, expectedMax: 100 },
      ];

      phases.forEach(({ phase, expectedMin, expectedMax }) => {
        const progress: AnalysisProgress = {
          analysisId: 'test-123',
          phase: phase as any,
          currentStep: `In ${phase} phase`,
          sessionsFound: 100,
          sessionsProcessed: 50,
          totalSessions: 100,
          batchesCompleted: 10,
          totalBatches: 20,
          tokensUsed: 5000,
          estimatedCost: 0.05,
          startTime: new Date().toISOString(),
        };

        const result = calculateProgressPercentage(progress);
        expect(result).toBeGreaterThanOrEqual(expectedMin);
        expect(result).toBeLessThanOrEqual(expectedMax);
      });
    });
  });

  describe('getPhaseLabel', () => {
    const testCases = [
      { phase: 'sampling', expected: 'Sampling' },
      { phase: 'discovery', expected: 'Discovery' },
      { phase: 'parallel_processing', expected: 'Processing' },
      { phase: 'conflict_resolution', expected: 'Resolving' },
      { phase: 'generating_summary', expected: 'Summarizing' },
      { phase: 'analyzing', expected: 'Analyzing' },
      { phase: 'complete', expected: 'Complete' },
      { phase: 'error', expected: 'Error' },
      { phase: 'unknown', expected: 'Processing' },
    ];

    testCases.forEach(({ phase, expected }) => {
      it(`should return "${expected}" for phase "${phase}"`, () => {
        expect(getPhaseLabel(phase)).toBe(expected);
      });
    });
  });
});