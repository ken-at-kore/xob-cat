import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionTable } from '../SessionTable';

const defaultFilters = { startDate: '', endDate: '', startTime: '', endTime: '' };
const noop = jest.fn();

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
    messages: [],
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
    messages: [],
    duration_seconds: 150,
    message_count: 6,
    user_message_count: 3,
    bot_message_count: 3
  }
];

describe('SessionTable', () => {
  it('renders table headers correctly', () => {
    render(
      <SessionTable
        sessions={mockSessions}
        filters={defaultFilters}
        setFilters={noop}
        onApplyFilters={noop}
      />
    );
    expect(screen.getByRole('columnheader', { name: /Session ID/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Start Time/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Duration/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Containment Type/i })).toBeInTheDocument();
  });

  it('renders session data correctly', () => {
    render(
      <SessionTable
        sessions={mockSessions}
        filters={defaultFilters}
        setFilters={noop}
        onApplyFilters={noop}
      />
    );
    const table = screen.getByRole('table');
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByTestId('session-id').textContent).toContain('session_');
    expect(within(rows[2]).getByTestId('session-id').textContent).toContain('session_');
    const allCells = Array.from(table.querySelectorAll('td')).map(el => el.textContent && el.textContent.trim());
    expect(allCells).toEqual(expect.arrayContaining(['5m 0s', '2m 30s']));
  });

  it('renders empty state when no sessions', () => {
    render(
      <SessionTable
        sessions={[]}
        filters={defaultFilters}
        setFilters={noop}
        onApplyFilters={noop}
      />
    );
    expect(screen.getByText(/No sessions found/i)).toBeInTheDocument();
  });

  it('formats durations correctly', () => {
    const sessionsWithVariousDurations = [
      { ...mockSessions[0], duration_seconds: 30 },
      { ...mockSessions[1], duration_seconds: 3661 }
    ];
    render(
      <SessionTable
        sessions={sessionsWithVariousDurations}
        filters={defaultFilters}
        setFilters={noop}
        onApplyFilters={noop}
      />
    );
    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.getByText('1h 1m 1s')).toBeInTheDocument();
  });

  it('displays containment type badges correctly', () => {
    render(
      <SessionTable
        sessions={mockSessions}
        filters={defaultFilters}
        setFilters={noop}
        onApplyFilters={noop}
      />
    );
    const table = screen.getByRole('table');
    const allBadges = Array.from(table.querySelectorAll('span[data-slot="badge"]')).map(el => el.textContent && el.textContent.trim());
    expect(allBadges).toEqual(expect.arrayContaining(['Self Service', 'Agent']));
  });

  it('renders only start date, end date, start time, and end time filter fields', () => {
    render(
      <SessionTable
        sessions={mockSessions}
        filters={defaultFilters}
        setFilters={noop}
        onApplyFilters={noop}
      />
    );
    expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Time/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Session ID/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Containment Type/i)).not.toBeInTheDocument();
  });

  it('renders a Filter button and only applies filters when clicked', async () => {
    const onApplyFilters = jest.fn();
    const setFilters = jest.fn();
    render(
      <SessionTable
        sessions={mockSessions}
        filters={defaultFilters}
        setFilters={setFilters}
        onApplyFilters={onApplyFilters}
      />
    );
    expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument();
    const startDateInput = screen.getByLabelText(/Start Date/i);
    await userEvent.type(startDateInput, '2025-07-22');
    expect(onApplyFilters).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /filter/i }));
    expect(onApplyFilters).toHaveBeenCalled();
  });
}); 