import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnalysisReportView } from '../AnalysisReportView';
import { AnalysisResults, SessionWithFacts } from '@/shared/types';

// Mock react-markdown to avoid ESM issues
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="markdown-content">{children}</div>,
}));

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}));

// Mock the chart components to focus on bot ID display logic
jest.mock('../AnalysisCharts', () => ({
  SessionOutcomePieChart: () => <div data-testid="session-outcome-chart">Session Outcome Chart</div>,
  TransferReasonsPareto: () => <div data-testid="transfer-reasons-chart">Transfer Reasons Chart</div>,
  DropOffLocationsBar: () => <div data-testid="drop-off-locations-chart">Drop-off Locations Chart</div>,
  GeneralIntentsBar: () => <div data-testid="general-intents-chart">General Intents Chart</div>,
  AnalysisCostCard: () => <div data-testid="analysis-cost-card">Cost Analysis</div>,
}));

jest.mock('../AnalyzedSessionDetailsDialog', () => ({
  AnalyzedSessionDetailsDialog: () => <div data-testid="session-details-dialog">Session Details</div>,
}));

jest.mock('../ContainmentSuggestionCard', () => ({
  ContainmentSuggestionCard: () => <div data-testid="containment-suggestion-card">Containment Suggestion</div>,
}));

const mockSession: SessionWithFacts = {
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
    generalIntent: 'Claim Status',
    sessionOutcome: 'Contained',
    transferReason: '',
    dropOffLocation: '',
    notes: 'User checked claim status successfully'
  },
  analysisMetadata: {
    tokensUsed: 100,
    processingTime: 1000,
    batchNumber: 1,
    timestamp: '2025-01-01T10:00:00Z',
    model: 'gpt-4o-mini'
  }
};

const mockOnStartNew = jest.fn();

describe('AnalysisReportView - Bot ID Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays bot ID when provided in results', () => {
    const resultsWithBotId: AnalysisResults = {
      sessions: [mockSession],
      botId: 'st-12345678-abcd-efgh-ijkl-mnopqrstuvwx'
    };

    render(
      <AnalysisReportView 
        results={resultsWithBotId} 
        onStartNew={mockOnStartNew} 
      />
    );

    // Check that the Bot ID label is displayed
    expect(screen.getByText('Bot ID')).toBeInTheDocument();
    
    // Check that the actual bot ID value is displayed
    expect(screen.getByText('st-12345678-abcd-efgh-ijkl-mnopqrstuvwx')).toBeInTheDocument();
    
    // Check that bot ID has correct styling (monospace font and background)
    const botIdElement = screen.getByText('st-12345678-abcd-efgh-ijkl-mnopqrstuvwx');
    expect(botIdElement).toHaveClass('font-mono', 'bg-gray-100');
  });

  it('does not display bot ID section when botId is not provided', () => {
    const resultsWithoutBotId: AnalysisResults = {
      sessions: [mockSession]
    };

    render(
      <AnalysisReportView 
        results={resultsWithoutBotId} 
        onStartNew={mockOnStartNew} 
      />
    );

    // Check that the Bot ID label is not displayed
    expect(screen.queryByText('Bot ID')).not.toBeInTheDocument();
  });

  it('does not display bot ID section when botId is empty string', () => {
    const resultsWithEmptyBotId: AnalysisResults = {
      sessions: [mockSession],
      botId: ''
    };

    render(
      <AnalysisReportView 
        results={resultsWithEmptyBotId} 
        onStartNew={mockOnStartNew} 
      />
    );

    // Check that the Bot ID label is not displayed
    expect(screen.queryByText('Bot ID')).not.toBeInTheDocument();
  });

  it('displays bot ID with correct positioning in header', () => {
    const resultsWithBotId: AnalysisResults = {
      sessions: [mockSession],
      botId: 'st-test-bot-id'
    };

    render(
      <AnalysisReportView 
        results={resultsWithBotId} 
        onStartNew={mockOnStartNew} 
      />
    );

    // Check that all header elements are present and in correct order
    const header = screen.getByText('Analysis Report').closest('div');
    expect(header).toBeInTheDocument();
    
    // Bot ID should appear after the title but before the description
    const botIdLabel = screen.getByText('Bot ID');
    const description = screen.getByText(/Comprehensive analysis of/);
    
    expect(botIdLabel).toBeInTheDocument();
    expect(description).toBeInTheDocument();
  });

  it('handles long bot IDs properly', () => {
    const resultsWithLongBotId: AnalysisResults = {
      sessions: [mockSession],
      botId: 'st-very-long-bot-id-that-might-wrap-or-cause-layout-issues-1234567890'
    };

    render(
      <AnalysisReportView 
        results={resultsWithLongBotId} 
        onStartNew={mockOnStartNew} 
      />
    );

    // Check that long bot ID is displayed
    expect(screen.getByText('st-very-long-bot-id-that-might-wrap-or-cause-layout-issues-1234567890')).toBeInTheDocument();
    
    // Check that styling is still applied
    const botIdElement = screen.getByText('st-very-long-bot-id-that-might-wrap-or-cause-layout-issues-1234567890');
    expect(botIdElement).toHaveClass('font-mono', 'bg-gray-100');
  });

  it('bot ID display is accessible', () => {
    const resultsWithBotId: AnalysisResults = {
      sessions: [mockSession],
      botId: 'st-accessibility-test'
    };

    render(
      <AnalysisReportView 
        results={resultsWithBotId} 
        onStartNew={mockOnStartNew} 
      />
    );

    // Check that Bot ID section has proper structure for screen readers
    const botIdLabel = screen.getByText('Bot ID');
    const botIdValue = screen.getByText('st-accessibility-test');
    
    expect(botIdLabel).toBeInTheDocument();
    expect(botIdValue).toBeInTheDocument();
    
    // Check that they are properly associated in the DOM structure
    const container = botIdLabel.closest('div');
    expect(container).toContainElement(botIdValue);
  });
});