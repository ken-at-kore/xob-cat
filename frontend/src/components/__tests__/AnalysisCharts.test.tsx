import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { 
  SessionOutcomePieChart, 
  TransferReasonsPareto, 
  DropOffLocationsBar, 
  GeneralIntentsBar,
  AnalysisCostCard 
} from '../AnalysisCharts';
import { SessionWithFacts } from '@/shared/types';

// Mock Nivo pie chart to avoid rendering issues in tests
jest.mock('@nivo/pie', () => ({
  ResponsivePie: ({ data, tooltip }: any) => (
    <div data-testid="nivo-pie-chart">
      {data && data.map((item: any, index: number) => (
        <div key={index} data-testid={`pie-slice-${index}`}>
          <span data-testid={`pie-label-${index}`}>{item.label}</span>
          <span data-testid={`pie-value-${index}`}>{item.value}</span>
          <span data-testid={`pie-percentage-${index}`}>{item.percentage}</span>
        </div>
      ))}
    </div>
  ),
}));

// Mock Nivo charts to avoid rendering issues in tests
jest.mock('@nivo/bar', () => ({
  ResponsiveBar: ({ data, tooltip, colors, axisBottom, gridXValues }: any) => (
    <div data-testid="nivo-bar-chart">
      <div data-testid="nivo-bar-config">
        {colors && <span data-testid="bar-color">{colors[0]}</span>}
        {axisBottom?.tickValues && <span data-testid="tick-values">{axisBottom.tickValues.join(',')}</span>}
        {gridXValues && <span data-testid="grid-values">{gridXValues.join(',')}</span>}
      </div>
      {data && data.map((item: any, index: number) => (
        <div key={index} data-testid={`bar-item-${index}`}>
          <span data-testid={`bar-label-${index}`}>{item.reason || item.location || item.intent}</span>
          <span data-testid={`bar-value-${index}`}>{item.count}</span>
          {item.cumulative && <span data-testid={`bar-cumulative-${index}`}>{item.cumulative}</span>}
          {tooltip && typeof tooltip === 'function' && (
            <div data-testid={`tooltip-${index}`}>
              {(() => {
                const tooltipContent = tooltip({ id: 'test', value: item.count, data: item });
                return tooltipContent;
              })()}
            </div>
          )}
        </div>
      ))}
    </div>
  ),
}));

// Mock session data for testing
const mockSessions: SessionWithFacts[] = [
  {
    session_id: '1',
    user_id: 'user1',
    start_time: '2025-01-01T10:00:00Z',
    end_time: '2025-01-01T10:10:00Z',
    containment_type: 'selfService',
    tags: [],
    metrics: {},
    messages: [],
    duration_seconds: 600,
    message_count: 5,
    user_message_count: 3,
    bot_message_count: 2,
    facts: {
      generalIntent: 'Account Update',
      sessionOutcome: 'Contained',
      transferReason: '',
      dropOffLocation: '',
      notes: 'User updated account successfully'
    },
    analysisMetadata: {
      tokensUsed: 500,
      processingTime: 2000,
      batchNumber: 1,
      timestamp: '2025-01-01T10:00:00Z',
      model: 'gpt-4o-mini'
    }
  },
  {
    session_id: '2',
    user_id: 'user2',
    start_time: '2025-01-01T11:00:00Z',
    end_time: '2025-01-01T11:15:00Z',
    containment_type: 'agent',
    tags: [],
    metrics: {},
    messages: [],
    duration_seconds: 900,
    message_count: 8,
    user_message_count: 4,
    bot_message_count: 4,
    facts: {
      generalIntent: 'Technical Issue',
      sessionOutcome: 'Transfer',
      transferReason: 'Complex technical problem',
      dropOffLocation: 'Authentication',
      notes: 'User needed live agent for technical issue'
    },
    analysisMetadata: {
      tokensUsed: 750,
      processingTime: 3000,
      batchNumber: 1,
      timestamp: '2025-01-01T11:00:00Z',
      model: 'gpt-4o-mini'
    }
  },
  {
    session_id: '3',
    user_id: 'user3',
    start_time: '2025-01-01T12:00:00Z',
    end_time: '2025-01-01T12:08:00Z',
    containment_type: 'agent',
    tags: [],
    metrics: {},
    messages: [],
    duration_seconds: 480,
    message_count: 6,
    user_message_count: 3,
    bot_message_count: 3,
    facts: {
      generalIntent: 'Account Update',
      sessionOutcome: 'Transfer',
      transferReason: 'Invalid member ID',
      dropOffLocation: 'ID Verification',
      notes: 'Member ID could not be verified'
    },
    analysisMetadata: {
      tokensUsed: 600,
      processingTime: 2500,
      batchNumber: 2,
      timestamp: '2025-01-01T12:00:00Z',
      model: 'gpt-4o-mini'
    }
  }
];

describe('AnalysisCharts', () => {
  describe('SessionOutcomePieChart', () => {
    it('renders pie chart with correct data', () => {
      render(<SessionOutcomePieChart sessions={mockSessions} />);
      
      expect(screen.getByTestId('nivo-pie-chart')).toBeInTheDocument();
      expect(screen.getByText('Session Outcomes')).toBeInTheDocument();
      expect(screen.getByText('Contained: 1 (33.3%)')).toBeInTheDocument();
      expect(screen.getByText('Transfer: 2 (66.7%)')).toBeInTheDocument();
    });

    it('handles empty sessions', () => {
      render(<SessionOutcomePieChart sessions={[]} />);
      
      expect(screen.getByText('Session Outcomes')).toBeInTheDocument();
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('renders color legend correctly', () => {
      render(<SessionOutcomePieChart sessions={mockSessions} />);
      
      // Check that color indicators are rendered
      const colorIndicators = screen.getAllByRole('generic').filter(el => 
        el.style.backgroundColor !== ''
      );
      expect(colorIndicators.length).toBeGreaterThan(0);
    });

    it('handles single outcome type', () => {
      const containedOnlySessions = mockSessions.filter(s => s.facts.sessionOutcome === 'Contained');
      render(<SessionOutcomePieChart sessions={containedOnlySessions} />);
      
      expect(screen.getByText('Contained: 1 (100.0%)')).toBeInTheDocument();
      expect(screen.queryByText(/Transfer/)).not.toBeInTheDocument();
    });

    it('calculates percentages correctly for various distributions', () => {
      const testSessions = [
        ...Array(3).fill(null).map((_, i) => ({
          ...mockSessions[0],
          session_id: `contained-${i}`,
          facts: { ...mockSessions[0].facts, sessionOutcome: 'Contained' as const }
        })),
        ...Array(7).fill(null).map((_, i) => ({
          ...mockSessions[1],
          session_id: `transfer-${i}`,
          facts: { ...mockSessions[1].facts, sessionOutcome: 'Transfer' as const }
        }))
      ];
      
      render(<SessionOutcomePieChart sessions={testSessions} />);
      
      expect(screen.getByText('Contained: 3 (30.0%)')).toBeInTheDocument();
      expect(screen.getByText('Transfer: 7 (70.0%)')).toBeInTheDocument();
    });
  });

  describe('TransferReasonsPareto', () => {
    it('renders transfer reasons pareto chart', () => {
      render(<TransferReasonsPareto sessions={mockSessions} />);
      
      expect(screen.getByTestId('nivo-bar-chart')).toBeInTheDocument();
      expect(screen.getByText('Transfer Reasons')).toBeInTheDocument();
    });

    it('renders as horizontal bar chart without redundant text', () => {
      render(<TransferReasonsPareto sessions={mockSessions} />);
      
      // Should show data in bar items but not as redundant text
      expect(screen.getByTestId('nivo-bar-chart')).toBeInTheDocument();
      // Both reasons should be present in the chart data
      expect(screen.getByTestId('bar-label-0')).toHaveTextContent('Invalid member ID');
      expect(screen.getByTestId('bar-value-0')).toHaveTextContent('1');
      expect(screen.getByTestId('bar-label-1')).toHaveTextContent('Complex technical problem');
      expect(screen.getByTestId('bar-value-1')).toHaveTextContent('1');
    });

    it('handles sessions with no transfers', () => {
      const containedSessions = mockSessions.filter(s => s.facts.sessionOutcome === 'Contained');
      render(<TransferReasonsPareto sessions={containedSessions} />);
      
      expect(screen.getByText('Transfer Reasons')).toBeInTheDocument();
      expect(screen.getByText('No transfer reasons found')).toBeInTheDocument();
    });

    it('calculates cumulative percentages correctly', () => {
      render(<TransferReasonsPareto sessions={mockSessions} />);
      
      // Check cumulative percentages are calculated (bars are reversed in display)
      // First bar shown is "Invalid member ID" with cumulative 100% (since it's shown at top)
      // Second bar shown is "Complex technical problem" with cumulative 50%
      expect(screen.getByTestId('bar-cumulative-0')).toHaveTextContent('100.0');
      expect(screen.getByTestId('bar-cumulative-1')).toHaveTextContent('50.0');
    });

    it('truncates long transfer reasons', () => {
      const longReasonSessions = [{
        ...mockSessions[1],
        facts: {
          ...mockSessions[1].facts,
          transferReason: 'This is a very long transfer reason that should be truncated in the display'
        }
      }];
      
      render(<TransferReasonsPareto sessions={longReasonSessions} />);
      
      // Check that long text is truncated
      expect(screen.getByTestId('bar-label-0')).toHaveTextContent('This is a very long trans...');
    });

    it('configures grid lines correctly', () => {
      render(<TransferReasonsPareto sessions={mockSessions} />);
      
      // Check grid configuration
      expect(screen.getByTestId('grid-values')).toHaveTextContent('0,1,2,3,4');
      expect(screen.getByTestId('tick-values')).toHaveTextContent('0,1,2,3,4');
    });

    it('renders tooltip with correct content', () => {
      render(<TransferReasonsPareto sessions={mockSessions} />);
      
      // Check tooltip rendering
      expect(screen.getByTestId('tooltip-0')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-1')).toBeInTheDocument();
    });
  });

  describe('DropOffLocationsBar', () => {
    it('renders drop-off locations bar chart', () => {
      render(<DropOffLocationsBar sessions={mockSessions} />);
      
      expect(screen.getByTestId('nivo-bar-chart')).toBeInTheDocument();
      expect(screen.getByText('Drop-off Locations')).toBeInTheDocument();
    });

    it('renders as horizontal bar chart', () => {
      render(<DropOffLocationsBar sessions={mockSessions} />);
      
      expect(screen.getByTestId('nivo-bar-chart')).toBeInTheDocument();
    });

    it('handles sessions with no drop-offs', () => {
      const sessionsWithoutDropOffs = mockSessions.map(s => ({
        ...s,
        facts: { ...s.facts, dropOffLocation: '' }
      }));
      render(<DropOffLocationsBar sessions={sessionsWithoutDropOffs} />);
      
      expect(screen.getByText('Drop-off Locations')).toBeInTheDocument();
      expect(screen.getByText('No drop-off locations found')).toBeInTheDocument();
    });

    it('sorts and limits to top 8 locations', () => {
      const manyLocationSessions = Array.from({ length: 10 }, (_, i) => ({
        ...mockSessions[0],
        session_id: `session-${i}`,
        facts: {
          ...mockSessions[0].facts,
          dropOffLocation: `Location ${i}`,
          sessionOutcome: 'Transfer' as const
        }
      }));
      
      render(<DropOffLocationsBar sessions={manyLocationSessions} />);
      
      // Should only show 8 items (top 8)
      const barItems = screen.getAllByTestId(/^bar-item-/);
      expect(barItems).toHaveLength(8);
    });

    it('configures grid lines correctly', () => {
      render(<DropOffLocationsBar sessions={mockSessions} />);
      
      // Check grid configuration for smaller data sets
      expect(screen.getByTestId('grid-values')).toHaveTextContent('0,1,2');
      expect(screen.getByTestId('tick-values')).toHaveTextContent('0,1,2');
      expect(screen.getByTestId('bar-color')).toHaveTextContent('#F59E0B'); // warning color
    });
  });

  describe('GeneralIntentsBar', () => {
    it('renders general intents bar chart', () => {
      render(<GeneralIntentsBar sessions={mockSessions} />);
      
      expect(screen.getByTestId('nivo-bar-chart')).toBeInTheDocument();
      expect(screen.getByText('General Intents')).toBeInTheDocument();
    });

    it('renders as horizontal bar chart without redundant text', () => {
      render(<GeneralIntentsBar sessions={mockSessions} />);
      
      // Should show data in bar items
      expect(screen.getByTestId('nivo-bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-label-0')).toHaveTextContent('Technical Issue');
      expect(screen.getByTestId('bar-value-0')).toHaveTextContent('1');
      expect(screen.getByTestId('bar-label-1')).toHaveTextContent('Account Update');
      expect(screen.getByTestId('bar-value-1')).toHaveTextContent('2');
    });

    it('handles empty sessions gracefully', () => {
      render(<GeneralIntentsBar sessions={[]} />);
      
      // Should still render the chart structure
      expect(screen.getByTestId('nivo-bar-chart')).toBeInTheDocument();
      expect(screen.getByText('General Intents')).toBeInTheDocument();
    });

    it('configures grid lines with appropriate values', () => {
      render(<GeneralIntentsBar sessions={mockSessions} />);
      
      // Check grid configuration
      expect(screen.getByTestId('grid-values')).toHaveTextContent('0,1,2,3,4,5,6,7');
      expect(screen.getByTestId('tick-values')).toHaveTextContent('0,1,2,3,4,5,6,7');
      expect(screen.getByTestId('bar-color')).toHaveTextContent('#6366F1'); // info color
    });

    it('limits to top 8 intents when many exist', () => {
      const manyIntentSessions = Array.from({ length: 12 }, (_, i) => ({
        ...mockSessions[0],
        session_id: `session-${i}`,
        facts: {
          ...mockSessions[0].facts,
          generalIntent: `Intent ${i}`
        }
      }));
      
      render(<GeneralIntentsBar sessions={manyIntentSessions} />);
      
      // Should only show 8 items
      const barItems = screen.getAllByTestId(/^bar-item-/);
      expect(barItems).toHaveLength(8);
    });
  });

  describe('AnalysisCostCard', () => {
    it('renders cost information correctly', () => {
      const totalTokens = mockSessions.reduce((sum, s) => sum + s.analysisMetadata.tokensUsed, 0);
      const estimatedCost = (totalTokens / 1000) * 0.00015; // GPT-4o-mini pricing
      
      render(<AnalysisCostCard sessions={mockSessions} />);
      
      expect(screen.getByText('Analysis Cost & Usage')).toBeInTheDocument();
      expect(screen.getByText('Total Sessions Analyzed')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Total Tokens Used')).toBeInTheDocument();
      expect(screen.getByText('1,850')).toBeInTheDocument();
      expect(screen.getByText('Model Used')).toBeInTheDocument();
      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
      expect(screen.getByText('Estimated Cost')).toBeInTheDocument();
      expect(screen.getByText(`$${estimatedCost.toFixed(4)}`)).toBeInTheDocument();
    });

    it('handles empty sessions', () => {
      render(<AnalysisCostCard sessions={[]} />);
      
      expect(screen.getByText('Analysis Cost & Usage')).toBeInTheDocument();
      expect(screen.getByText('Total Sessions Analyzed')).toBeInTheDocument();
      expect(screen.getByText('Total Tokens Used')).toBeInTheDocument();
      expect(screen.getAllByText(/^\$0\.0000$/)).toHaveLength(2); // Both estimated cost and cost per session
    });
  });
});