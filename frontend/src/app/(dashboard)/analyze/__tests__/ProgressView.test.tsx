import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProgressView } from '../page';
import { AnalysisProgress } from '../../../../../../shared/types';

// Mock the api module
jest.mock('../../../../lib/api', () => ({
  autoAnalyze: {
    getProgress: jest.fn(),
    getResults: jest.fn(),
  },
}));

// Mock the getGptModelById function
jest.mock('../../../../../../shared/types', () => ({
  ...jest.requireActual('../../../../../../shared/types'),
  getGptModelById: jest.fn((id: string) => ({
    id,
    name: `GPT Model ${id}`,
    apiModelString: id,
    inputPricePerMillion: 1,
    outputPricePerMillion: 2,
    contextWindow: 128000,
  })),
}));

// Mock the progressUtils functions
jest.mock('../progressUtils', () => ({
  getSimplifiedStatusText: jest.fn((text: string) => {
    const mappings: Record<string, string> = {
      'Initializing parallel analysis': 'Initializing analysis',
      'Searching in Initial 3-hour window': 'Searching for sessions',
      'Processing discovery batch 1/3 (5 sessions)': 'Analyzing initial sessions (1/3)',
      'Parallel processing: Round 1/3': 'Analyzing sessions: Round 1/3',
      'Conflict resolution after round 1': 'Consolidating classifications: Round 1',
      'Generating summary with AI': 'Generating analysis summary',
    };
    return mappings[text] || text;
  }),
  calculateProgressPercentage: jest.fn((progress: AnalysisProgress) => {
    if (progress.phase === 'complete') return 100;
    if (progress.phase === 'sampling') return 10;
    if (progress.phase === 'discovery') return 35;
    if (progress.phase === 'parallel_processing') return 52;
    if (progress.phase === 'conflict_resolution') return 90;
    if (progress.phase === 'generating_summary') return 97;
    return 0;
  }),
  getPhaseLabel: jest.fn((phase: string) => {
    const labels: Record<string, string> = {
      'sampling': 'Sampling',
      'discovery': 'Discovery',
      'parallel_processing': 'Processing',
      'conflict_resolution': 'Resolving',
      'generating_summary': 'Summarizing',
      'complete': 'Complete',
      'error': 'Error'
    };
    return labels[phase] || 'Processing';
  }),
}));

describe('ProgressView Component', () => {
  const mockOnComplete = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('UI Simplification', () => {
    it('should only display Progress heading, status badge, main details, and progress bar', () => {
      const { autoAnalyze } = require('../../../../lib/api');
      const mockProgress: AnalysisProgress = {
        analysisId: 'test-123',
        phase: 'sampling',
        currentStep: 'Searching in Initial 3-hour window',
        sessionsFound: 50,
        sessionsProcessed: 0,
        totalSessions: 100,
        batchesCompleted: 0,
        totalBatches: 0,
        tokensUsed: 0,
        estimatedCost: 0,
        startTime: new Date().toISOString(),
      };

      autoAnalyze.getProgress.mockResolvedValueOnce({ success: true, data: mockProgress });

      render(<ProgressView analysisId="test-123" onComplete={mockOnComplete} />);

      // Should have Progress heading
      expect(screen.getByText('Progress')).toBeInTheDocument();
      
      // Should have status badge
      expect(screen.getByText('Sampling')).toBeInTheDocument();
      
      // Should NOT have these removed elements
      expect(screen.queryByText('Sessions Found')).not.toBeInTheDocument();
      expect(screen.queryByText('Batches Completed')).not.toBeInTheDocument();
      expect(screen.queryByText('Tokens Used')).not.toBeInTheDocument();
      expect(screen.queryByText('Estimated Cost')).not.toBeInTheDocument();
      expect(screen.queryByText('GPT Model')).not.toBeInTheDocument();
    });

    it('should display updated intro text', () => {
      const { autoAnalyze } = require('../../../../lib/api');
      autoAnalyze.getProgress.mockResolvedValueOnce({
        analysisId: 'test-123',
        phase: 'sampling',
        currentStep: 'Initializing',
        sessionsFound: 0,
        sessionsProcessed: 0,
        totalSessions: 0,
        batchesCompleted: 0,
        totalBatches: 0,
        tokensUsed: 0,
        estimatedCost: 0,
        startTime: new Date().toISOString(),
      });

      render(<ProgressView analysisId="test-123" onComplete={mockOnComplete} />);

      expect(screen.getByText('Your session analysis is running. This may take a minute or so.')).toBeInTheDocument();
    });
  });

  describe('Status Text Mappings', () => {
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
        input: 'Generating summary with AI',
        expected: 'Generating analysis summary',
      },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should map "${input}" to "${expected}"`, () => {
        const { autoAnalyze } = require('../../../../lib/api');
        autoAnalyze.getProgress.mockResolvedValueOnce({
          analysisId: 'test-123',
          phase: 'sampling',
          currentStep: input,
          sessionsFound: 0,
          sessionsProcessed: 0,
          totalSessions: 0,
          batchesCompleted: 0,
          totalBatches: 0,
          tokensUsed: 0,
          estimatedCost: 0,
          startTime: new Date().toISOString(),
        });

        render(<ProgressView analysisId="test-123" onComplete={mockOnComplete} />);

        expect(screen.getByText(expected)).toBeInTheDocument();
      });
    });
  });

  describe('Progress Bar Calculation', () => {
    it('should show correct progress during sampling phase', () => {
      const { autoAnalyze } = require('../../../../lib/api');
      autoAnalyze.getProgress.mockResolvedValueOnce({
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
      });

      const { container } = render(<ProgressView analysisId="test-123" onComplete={mockOnComplete} />);
      
      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '10'); // 20% of sampling phase (weight 0.2) = 4%
    });

    it('should show correct progress during parallel processing rounds', () => {
      const { autoAnalyze } = require('../../../../lib/api');
      autoAnalyze.getProgress.mockResolvedValueOnce({
        analysisId: 'test-123',
        phase: 'parallel_processing',
        currentStep: 'Analyzing sessions: Round 2/3',
        sessionsFound: 100,
        sessionsProcessed: 33,
        totalSessions: 100,
        batchesCompleted: 0,
        totalBatches: 0,
        tokensUsed: 1000,
        estimatedCost: 0.01,
        startTime: new Date().toISOString(),
        roundsCompleted: 1,
        totalRounds: 3,
        streamsActive: 8,
      } as any);

      const { container } = render(<ProgressView analysisId="test-123" onComplete={mockOnComplete} />);
      
      const progressBar = container.querySelector('[role="progressbar"]');
      // Sampling (20%) + Discovery (15%) + 33.3% of Parallel (50%) = 35% + 16.65% = 51.65%
      expect(progressBar).toHaveAttribute('aria-valuenow', '52');
    });

    it('should show progress during inter-round conflict resolution', () => {
      const { autoAnalyze } = require('../../../../lib/api');
      autoAnalyze.getProgress.mockResolvedValueOnce({
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
      } as any);

      const { container } = render(<ProgressView analysisId="test-123" onComplete={mockOnComplete} />);
      
      const progressBar = container.querySelector('[role="progressbar"]');
      // Sampling (20%) + Discovery (15%) + 66.6% of Parallel (50%) = 35% + 33.3% = 68.3%
      expect(progressBar).toHaveAttribute('aria-valuenow', '68');
    });

    it('should show 100% progress when complete', () => {
      const { autoAnalyze } = require('../../../../lib/api');
      autoAnalyze.getProgress.mockResolvedValueOnce({
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
      });

      const { container } = render(<ProgressView analysisId="test-123" onComplete={mockOnComplete} />);
      
      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('Progress Bar for All Phases', () => {
    const phaseTests = [
      { phase: 'sampling', progress: 20 },
      { phase: 'discovery', progress: 35 },
      { phase: 'parallel_processing', progress: 85 },
      { phase: 'conflict_resolution', progress: 90 },
      { phase: 'generating_summary', progress: 97 },
      { phase: 'complete', progress: 100 },
    ];

    phaseTests.forEach(({ phase, progress }) => {
      it(`should calculate correct progress for ${phase} phase`, () => {
        const { autoAnalyze } = require('../../../../lib/api');
        const mockProgress: any = {
          analysisId: 'test-123',
          phase,
          currentStep: `In ${phase} phase`,
          sessionsFound: 100,
          sessionsProcessed: phase === 'complete' ? 100 : 50,
          totalSessions: 100,
          batchesCompleted: 10,
          totalBatches: 20,
          tokensUsed: 5000,
          estimatedCost: 0.05,
          startTime: new Date().toISOString(),
        };

        // Add phase-specific data
        if (phase === 'discovery') {
          mockProgress.discoveryStats = {
            discoveredIntents: 10,
            discoveredReasons: 5,
            discoveredLocations: 3,
            discoveryRate: 1.0,
          };
        } else if (phase === 'parallel_processing') {
          mockProgress.roundsCompleted = 2;
          mockProgress.totalRounds = 2;
          mockProgress.streamsActive = 8;
        } else if (phase === 'conflict_resolution') {
          mockProgress.conflictStats = {
            conflictsFound: 5,
            conflictsResolved: 5,
            canonicalMappings: 3,
          };
        }

        autoAnalyze.getProgress.mockResolvedValueOnce({ success: true, data: mockProgress });

        const { container } = render(<ProgressView analysisId="test-123" onComplete={mockOnComplete} />);
        
        const progressBar = container.querySelector('[role="progressbar"]');
        expect(parseInt(progressBar?.getAttribute('aria-valuenow') || '0')).toBeGreaterThanOrEqual(progress - 5);
        expect(parseInt(progressBar?.getAttribute('aria-valuenow') || '0')).toBeLessThanOrEqual(progress + 5);
      });
    });
  });
});