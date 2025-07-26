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

// Mock Recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
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
      
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie')).toBeInTheDocument();
      expect(screen.getByText('Session Outcomes')).toBeInTheDocument();
      expect(screen.getByText('Contained: 1 (33.3%)')).toBeInTheDocument();
      expect(screen.getByText('Transfer: 2 (66.7%)')).toBeInTheDocument();
    });

    it('handles empty sessions', () => {
      render(<SessionOutcomePieChart sessions={[]} />);
      
      expect(screen.getByText('Session Outcomes')).toBeInTheDocument();
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  describe('TransferReasonsPareto', () => {
    it('renders transfer reasons pareto chart', () => {
      render(<TransferReasonsPareto sessions={mockSessions} />);
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByText('Transfer Reasons (Pareto Analysis)')).toBeInTheDocument();
      expect(screen.getByText('Complex technical problem: 1')).toBeInTheDocument();
      expect(screen.getByText('Invalid member ID: 1')).toBeInTheDocument();
    });

    it('handles sessions with no transfers', () => {
      const containedSessions = mockSessions.filter(s => s.facts.sessionOutcome === 'Contained');
      render(<TransferReasonsPareto sessions={containedSessions} />);
      
      expect(screen.getByText('Transfer Reasons (Pareto Analysis)')).toBeInTheDocument();
      expect(screen.getByText('No transfer reasons found')).toBeInTheDocument();
    });
  });

  describe('DropOffLocationsBar', () => {
    it('renders drop-off locations bar chart', () => {
      render(<DropOffLocationsBar sessions={mockSessions} />);
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByText('Drop-off Locations')).toBeInTheDocument();
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
  });

  describe('GeneralIntentsBar', () => {
    it('renders general intents bar chart', () => {
      render(<GeneralIntentsBar sessions={mockSessions} />);
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByText('General Intents')).toBeInTheDocument();
    });

    it('shows correct intent counts', () => {
      render(<GeneralIntentsBar sessions={mockSessions} />);
      
      // Account Update appears twice, Technical Issue appears once
      expect(screen.getByText('Account Update: 2')).toBeInTheDocument();
      expect(screen.getByText('Technical Issue: 1')).toBeInTheDocument();
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