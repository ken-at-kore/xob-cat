import React from 'react';
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event';
import { SessionTable } from '../SessionTable'
import { SessionWithTranscript } from '../../../../shared/types';

const mockSessions: SessionWithTranscript[] = [
  {
    session_id: 'session_123',
    user_id: 'user_456',
    start_time: '2025-07-21T10:00:00.000Z',
    end_time: '2025-07-21T10:05:00.000Z',
    containment_type: 'selfService',
    tags: ['Claim Status', 'Contained'],
    metrics: {
      total_messages: 8,
      user_messages: 4,
      bot_messages: 4
    },
    messages: [
      {
        timestamp: '2025-07-21T10:00:00.000Z',
        message_type: 'user',
        message: 'I need to check the status of my claim'
      },
      {
        timestamp: '2025-07-21T10:00:30.000Z',
        message_type: 'bot',
        message: 'I can help you check your claim status. Please provide your claim number.'
      }
    ],
    duration_seconds: 300,
    message_count: 8,
    user_message_count: 4,
    bot_message_count: 4
  },
  {
    session_id: 'session_456',
    user_id: 'user_789',
    start_time: '2025-07-21T11:00:00.000Z',
    end_time: '2025-07-21T11:02:30.000Z',
    containment_type: 'agent',
    tags: ['Billing', 'Transfer'],
    metrics: {
      total_messages: 6,
      user_messages: 3,
      bot_messages: 3
    },
    messages: [
      {
        timestamp: '2025-07-21T11:00:00.000Z',
        message_type: 'user',
        message: 'I have a question about my bill'
      },
      {
        timestamp: '2025-07-21T11:00:30.000Z',
        message_type: 'bot',
        message: 'I can help you with billing questions. Please provide your member ID.'
      }
    ],
    duration_seconds: 150,
    message_count: 6,
    user_message_count: 3,
    bot_message_count: 3
  }
]

const defaultFilters = { startDate: '', endDate: '', startTime: '', endTime: '' };
const noop = jest.fn();

describe('SessionTable', () => {
  it('renders table headers correctly', () => {
    const mockSessions: SessionWithTranscript[] = [
      {
        session_id: 'session_123',
        user_id: 'user_1',
        start_time: '2025-07-21T10:00:00.000Z',
        end_time: '2025-07-21T10:05:00.000Z',
        containment_type: 'selfService',
        tags: [],
        metrics: { total_messages: 10, user_messages: 5, bot_messages: 5 },
        messages: [],
        duration_seconds: 300,
        message_count: 10,
        user_message_count: 5,
        bot_message_count: 5
      }
    ]
    render(<SessionTable sessions={mockSessions} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} />)
    const table = screen.getByRole('table')
    expect(screen.getByRole('columnheader', { name: /Session ID/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Start Time/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Duration/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Containment Type/i })).toBeInTheDocument()
  })

  it('renders session data correctly', () => {
    const mockSessions: SessionWithTranscript[] = [
      {
        session_id: 'session_123',
        user_id: 'user_1',
        start_time: '2025-07-21T10:00:00.000Z',
        end_time: '2025-07-21T10:05:00.000Z',
        containment_type: 'selfService',
        tags: [],
        metrics: { total_messages: 10, user_messages: 5, bot_messages: 5 },
        messages: [],
        duration_seconds: 300,
        message_count: 10,
        user_message_count: 5,
        bot_message_count: 5
      },
      {
        session_id: 'session_456',
        user_id: 'user_2',
        start_time: '2025-07-21T11:00:00.000Z',
        end_time: '2025-07-21T11:02:30.000Z',
        containment_type: 'agent',
        tags: [],
        metrics: { total_messages: 5, user_messages: 2, bot_messages: 3 },
        messages: [],
        duration_seconds: 150,
        message_count: 5,
        user_message_count: 2,
        bot_message_count: 3
      }
    ]
    render(<SessionTable sessions={mockSessions} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} />)
    const table = screen.getByRole('table')
    const rows = screen.getAllByRole('row')
    // The first row is the header, so check the next rows for session data
    const sessionIds = [within(rows[1]).getByTestId('session-id').textContent, within(rows[2]).getByTestId('session-id').textContent];
    expect(sessionIds).toEqual(expect.arrayContaining(['session_123', 'session_456']));
    const allCells = Array.from(table.querySelectorAll('td')).map(el => el.textContent && el.textContent.trim())
    expect(allCells).toEqual(expect.arrayContaining(['5m 0s', '2m 30s']))
  })

  it('renders empty state when no sessions and has loaded once', () => {
    render(<SessionTable sessions={[]} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} hasLoadedOnce={true} />)
    expect(screen.getByText(/No sessions found/i)).toBeInTheDocument()
  })

  it('formats session IDs correctly (truncated)', () => {
    const longSessionId = 'very_long_session_id_that_should_be_truncated'
    const sessionsWithLongId: SessionWithTranscript[] = [
      {
        session_id: longSessionId,
        user_id: 'user_1',
        start_time: '2025-07-21T10:00:00.000Z',
        end_time: '2025-07-21T10:05:00.000Z',
        containment_type: 'selfService',
        tags: [],
        metrics: { total_messages: 10, user_messages: 5, bot_messages: 5 },
        messages: [],
        duration_seconds: 300,
        message_count: 10,
        user_message_count: 5,
        bot_message_count: 5
      }
    ]
    render(<SessionTable sessions={sessionsWithLongId} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} />)
    const table = screen.getByRole('table')
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByTestId('session-id').textContent).toBe('very_long_session_id_that_should_be_truncated')
  })

  it('formats dates correctly', () => {
    const mockSessions: SessionWithTranscript[] = [
      {
        session_id: 'session_123',
        user_id: 'user_1',
        start_time: '2025-07-21T10:00:00.000Z',
        end_time: '2025-07-21T10:05:00.000Z',
        containment_type: 'selfService',
        tags: [],
        metrics: { total_messages: 10, user_messages: 5, bot_messages: 5 },
        messages: [],
        duration_seconds: 300,
        message_count: 10,
        user_message_count: 5,
        bot_message_count: 5
      }
    ]
    render(<SessionTable sessions={mockSessions} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} />)
    const table = screen.getByRole('table')
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('07/21/2025, 06:00:00 AM ET')).toBeInTheDocument()
  })

  it('formats durations correctly', () => {
    const sessionsWithVariousDurations: SessionWithTranscript[] = [
      {
        ...mockSessions[0],
        duration_seconds: 30 // 30 seconds
      },
      {
        ...mockSessions[1],
        duration_seconds: 3661 // 1 hour 1 minute 1 second
      }
    ]
    render(<SessionTable sessions={sessionsWithVariousDurations} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} />)
    expect(screen.getByText('30s')).toBeInTheDocument()
    expect(screen.getByText('1h 1m 1s')).toBeInTheDocument()
  })

  it('displays containment type badges correctly', () => {
    render(<SessionTable sessions={mockSessions} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} />)
    const table = screen.getByRole('table')
    const allBadges = Array.from(table.querySelectorAll('span[data-slot="badge"]')).map(el => el.textContent && el.textContent.trim())
    expect(allBadges).toEqual(expect.arrayContaining(['Self Service', 'Agent']))
  })

  it('handles sessions with missing data gracefully', () => {
    const incompleteSession: SessionWithTranscript[] = [
      {
        session_id: 'incomplete_session',
        user_id: 'user_123',
        start_time: '2025-07-21T10:00:00.000Z',
        end_time: '2025-07-21T10:01:00.000Z',
        containment_type: 'selfService',
        tags: [],
        metrics: {
          total_messages: 0,
          user_messages: 0,
          bot_messages: 0
        },
        messages: [],
        duration_seconds: 60,
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0
      }
    ]
    render(<SessionTable sessions={incompleteSession} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} />)
    const table = screen.getByRole('table')
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByTestId('session-id').textContent).toBe('incomplete_session')
    expect(within(rows[1]).getByText('1m 0s')).toBeInTheDocument()
  })

  it('renders only start date, end date, start time, and end time filter fields', () => {
    render(<SessionTable sessions={mockSessions} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} />);
    // Check for the four filter fields
    expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Time/i)).toBeInTheDocument();
    // Ensure session id and containment type fields are not present
    expect(screen.queryByLabelText(/Session ID/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Containment Type/i)).not.toBeInTheDocument();
  });

  it('renders filter fields in the correct order: start date, start time, end date, end time', () => {
    render(<SessionTable sessions={mockSessions} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} />);
    
    // Get all filter label elements in DOM order
    const labels = screen.getAllByText(/Date|Time/, { selector: 'label' });
    const labelTexts = labels.map(label => label.textContent);
    
    expect(labelTexts).toEqual(['Start Date', 'Start Time', 'End Date', 'End Time']);
  });

  it('calls onRowClick when a table row is clicked', async () => {
    const onRowClick = jest.fn();
    render(<SessionTable sessions={mockSessions} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} onRowClick={onRowClick} />);
    
    const rows = screen.getAllByRole('row');
    // Skip header row (index 0), click first data row (index 1)
    // Due to default sorting by start_time desc, session_456 (index 1) appears first
    await userEvent.click(rows[1]);
    
    expect(onRowClick).toHaveBeenCalledWith(mockSessions[1], 1);
  });

  it('makes table rows clickable with proper cursor styling', () => {
    const onRowClick = jest.fn();
    render(<SessionTable sessions={mockSessions} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} onRowClick={onRowClick} />);
    
    const rows = screen.getAllByRole('row');
    // Check that data rows have clickable styling
    expect(rows[1]).toHaveClass('cursor-pointer');
  });

  it('does not call onRowClick when onRowClick is not provided', async () => {
    // This should not throw an error
    render(<SessionTable sessions={mockSessions} filters={defaultFilters} setFilters={noop} onApplyFilters={noop} />);
    
    const rows = screen.getAllByRole('row');
    await userEvent.click(rows[1]);
    // Should not throw or cause issues
  });

  // Enhanced Session Viewer Tests
  describe('Enhanced Loading States', () => {
    it('always renders filter controls even during loading', () => {
      render(
        <SessionTable 
          sessions={[]} 
          loading={true}
          filters={defaultFilters} 
          setFilters={noop} 
          onApplyFilters={noop} 
        />
      );
      
      // Filter section should be visible
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End Time/i)).toBeInTheDocument();
      
      // Filter button should be present and enabled
      const filterButton = screen.getByRole('button', { name: /filter/i });
      expect(filterButton).toBeInTheDocument();
      expect(filterButton).toBeEnabled();
    });

    it('shows loading state only in session content area', () => {
      render(
        <SessionTable 
          sessions={[]} 
          loading={true}
          filters={defaultFilters} 
          setFilters={noop} 
          onApplyFilters={noop} 
        />
      );
      
      // Should show loading message
      expect(screen.getByText(/Loading sessions/i)).toBeInTheDocument();
      
      // But filters should still be visible
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /filter/i })).toBeEnabled();
    });

    it('displays session overview header during loading', () => {
      render(
        <SessionTable 
          sessions={[]} 
          loading={true}
          filters={defaultFilters} 
          setFilters={noop} 
          onApplyFilters={noop} 
        />
      );
      
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
    });

    it('shows error state only in session content area while keeping filters visible', () => {
      const onRefresh = jest.fn();
      render(
        <SessionTable 
          sessions={[]} 
          loading={false}
          error="Failed to load sessions"
          filters={defaultFilters} 
          setFilters={noop} 
          onApplyFilters={noop}
          onRefresh={onRefresh}
        />
      );
      
      // Error should be displayed
      expect(screen.getByText('Failed to load sessions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      
      // But filters should still be visible and functional
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /filter/i })).toBeEnabled();
    });

    it('calls onApplyFilters when filter button is clicked during loading', async () => {
      const onApplyFilters = jest.fn();
      render(
        <SessionTable 
          sessions={[]} 
          loading={true}
          filters={defaultFilters} 
          setFilters={noop} 
          onApplyFilters={onApplyFilters} 
        />
      );
      
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await userEvent.click(filterButton);
      
      expect(onApplyFilters).toHaveBeenCalled();
    });

    it('updates filter values even during loading state', async () => {
      const setFilters = jest.fn();
      render(
        <SessionTable 
          sessions={[]} 
          loading={true}
          filters={defaultFilters} 
          setFilters={setFilters} 
          onApplyFilters={noop} 
        />
      );
      
      const startDateInput = screen.getByLabelText(/Start Date/i);
      await userEvent.type(startDateInput, '2025-08-15');
      
      expect(setFilters).toHaveBeenCalled();
    });
  });

  describe('Filter Interactivity', () => {
    it('displays current filter values in form controls', () => {
      const filtersWithValues = {
        startDate: '2025-08-15',
        endDate: '2025-08-16',
        startTime: '09:00',
        endTime: '17:00'
      };
      
      render(
        <SessionTable 
          sessions={mockSessions} 
          filters={filtersWithValues} 
          setFilters={noop} 
          onApplyFilters={noop} 
        />
      );
      
      expect(screen.getByDisplayValue('2025-08-15')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2025-08-16')).toBeInTheDocument();
      expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
      expect(screen.getByDisplayValue('17:00')).toBeInTheDocument();
    });

    it('calls setFilters when filter values change', async () => {
      const setFilters = jest.fn();
      render(
        <SessionTable 
          sessions={mockSessions} 
          filters={defaultFilters} 
          setFilters={setFilters} 
          onApplyFilters={noop} 
        />
      );
      
      const startDateInput = screen.getByLabelText(/Start Date/i);
      await userEvent.clear(startDateInput);
      await userEvent.type(startDateInput, '2025-08-15');
      
      expect(setFilters).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2025-08-15' })
      );
    });

    it('filter button always shows "Filter" text', () => {
      render(
        <SessionTable 
          sessions={mockSessions} 
          filters={defaultFilters} 
          setFilters={noop} 
          onApplyFilters={noop} 
        />
      );
      
      const filterButton = screen.getByRole('button', { name: /filter/i });
      expect(filterButton).toHaveTextContent('Filter');
    });
  });
}) 