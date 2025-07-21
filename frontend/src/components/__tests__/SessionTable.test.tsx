import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { SessionTable } from '../SessionTable'

const mockSessions = [
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

describe('SessionTable', () => {
  it('renders table headers correctly', () => {
    const mockSessions = [
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
    render(<SessionTable sessions={mockSessions} />)
    const table = screen.getByRole('table')
    expect(screen.getByRole('columnheader', { name: /Session ID/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Start Time/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Duration/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Containment Type/i })).toBeInTheDocument()
  })

  it('renders session data correctly', () => {
    const mockSessions = [
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
    render(<SessionTable sessions={mockSessions} />)
    const table = screen.getByRole('table')
    const rows = screen.getAllByRole('row')
    // The first row is the header, so check the next rows for session data
    expect(within(rows[1]).getByTestId('session-id').textContent).toBe('session_...')
    expect(within(rows[2]).getByTestId('session-id').textContent).toBe('session_...')
    const allCells = Array.from(table.querySelectorAll('td')).map(el => el.textContent && el.textContent.trim())
    expect(allCells).toEqual(expect.arrayContaining(['5m 0s', '2m 30s']))
  })

  it('renders empty state when no sessions', () => {
    render(<SessionTable sessions={[]} />)
    expect(screen.getByText(/No sessions found/i)).toBeInTheDocument()
  })

  it('formats session IDs correctly (truncated)', () => {
    const longSessionId = 'very_long_session_id_that_should_be_truncated'
    const sessionsWithLongId = [
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
    render(<SessionTable sessions={sessionsWithLongId} />)
    const table = screen.getByRole('table')
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByTestId('session-id').textContent).toBe('very_lon...')
  })

  it('formats dates correctly', () => {
    const mockSessions = [
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
    render(<SessionTable sessions={mockSessions} />)
    const table = screen.getByRole('table')
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('07/21/2025, 06:00:00 AM ET')).toBeInTheDocument()
  })

  it('formats durations correctly', () => {
    const sessionsWithVariousDurations = [
      {
        ...mockSessions[0],
        duration_seconds: 30 // 30 seconds
      },
      {
        ...mockSessions[1],
        duration_seconds: 3661 // 1 hour 1 minute 1 second
      }
    ]
    render(<SessionTable sessions={sessionsWithVariousDurations} />)
    expect(screen.getByText('30s')).toBeInTheDocument()
    expect(screen.getByText('1h 1m 1s')).toBeInTheDocument()
  })

  it('displays containment type badges correctly', () => {
    render(<SessionTable sessions={mockSessions} />)
    const table = screen.getByRole('table')
    const allBadges = Array.from(table.querySelectorAll('span[data-slot="badge"]')).map(el => el.textContent && el.textContent.trim())
    expect(allBadges).toEqual(expect.arrayContaining(['Self Service', 'Agent']))
  })

  it('handles sessions with missing data gracefully', () => {
    const incompleteSession = [
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
    render(<SessionTable sessions={incompleteSession} />)
    const table = screen.getByRole('table')
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByTestId('session-id').textContent).toBe('incomple...')
    expect(within(rows[1]).getByText('1m 0s')).toBeInTheDocument()
  })

  it('renders only start date, end date, start time, and end time filter fields', () => {
    render(<SessionTable sessions={mockSessions} />);
    // Check for the four filter fields
    expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Time/i)).toBeInTheDocument();
    // Ensure session id and containment type fields are not present
    expect(screen.queryByLabelText(/Session ID/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Containment Type/i)).not.toBeInTheDocument();
  });
}) 