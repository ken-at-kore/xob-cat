import '@testing-library/jest-dom'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SessionsPage from '../../../../../../frontend/src/app/dashboard/sessions/page'
import { apiClient } from '../../../../lib/api'
const mockGetSessions = apiClient.getSessions as jest.Mock

// Mock the API client
jest.mock('../../../../lib/api', () => ({
  apiClient: {
    getSessions: jest.fn(),
  },
}))

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
})

describe('Sessions Page', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockGetSessions.mockReset()
    mockSessionStorage.getItem.mockReturnValue(JSON.stringify({
      botId: 'test-bot-id',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret'
    }))
  })

  it('renders loading state initially', () => {
    render(<SessionsPage />)
    // Use regex to match 'Loading sessions...' or similar
    expect(screen.getAllByText(/Loading/i).length).toBeGreaterThan(0)
  })

  it('loads and displays sessions successfully', async () => {
    mockGetSessions.mockResolvedValueOnce({
      success: true,
      data: [
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
      ],
      total_count: 1
    })
    await act(async () => {
      render(<SessionsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText((content) => !!content && content.includes('Sessions'))).toBeInTheDocument()
      expect(screen.getByText((content) => !!content && /Browse and analyze chatbot session data/i.test(content))).toBeInTheDocument()
      expect(screen.getByText('session_123')).toBeInTheDocument()
      expect(screen.getAllByText((content) => !!content && content.includes('Self Service')).length).toBeGreaterThan(0)
    })
  })

  it('displays error when sessions fail to load', async () => {
    mockGetSessions.mockRejectedValue(new Error('Failed to fetch sessions'))
    await act(async () => {
      render(<SessionsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText(/Error loading sessions/i)).toBeInTheDocument()
      expect(screen.getByText(/Failed to fetch sessions/i)).toBeInTheDocument()
    })
  })

  it('displays empty state when no sessions', async () => {
    mockGetSessions.mockResolvedValue({
      success: true,
      data: [],
      total_count: 0
    })
    await act(async () => {
      render(<SessionsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('Sessions')).toBeInTheDocument()
      expect(screen.getByText(/0 sessions found/i)).toBeInTheDocument()
    })
  })

  it('shows retry button when there is an error', async () => {
    mockGetSessions.mockRejectedValue(new Error('Failed to fetch sessions'))
    await act(async () => {
      render(<SessionsPage />)
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    })
  })

  it('retries loading sessions when retry button is clicked', async () => {
    mockGetSessions.mockRejectedValueOnce(new Error('Failed to fetch sessions'))
      .mockResolvedValueOnce({
        success: true,
        data: [],
        total_count: 0
      })
    await act(async () => {
      render(<SessionsPage />)
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    })
    const retryButton = screen.getByRole('button', { name: /Retry/i })
    await userEvent.click(retryButton)
    await waitFor(() => {
      expect(screen.getByText(/0 sessions found/i)).toBeInTheDocument()
    })
    expect(mockGetSessions).toHaveBeenCalledTimes(2)
  })

  it('does not fetch sessions on filter field change, but does on Filter button click', async () => {
    mockGetSessions.mockResolvedValue({ success: true, data: [], total_count: 0 });
    await act(async () => {
      render(<SessionsPage />);
    });
    await waitFor(() => {
      expect(screen.getByText('Sessions')).toBeInTheDocument();
    });
    // Simulate changing a filter field
    const startDateInput = screen.getByLabelText(/Start Date/i);
    await userEvent.type(startDateInput, '2025-07-22');
    // API should not be called again yet
    expect(mockGetSessions).toHaveBeenCalledTimes(1);
    // Click the Filter button
    await userEvent.click(screen.getByRole('button', { name: /filter/i }));
    // API should be called again
    expect(mockGetSessions).toHaveBeenCalledTimes(2);
  });
  it('does not show a refresh button outside the filter section', async () => {
    mockGetSessions.mockResolvedValue({ success: true, data: [], total_count: 0 });
    await act(async () => {
      render(<SessionsPage />);
    });
    await waitFor(() => {
      expect(screen.getByText('Sessions')).toBeInTheDocument();
    });
    // There should not be a refresh button outside the filter section
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
    // There should be a Filter button in the filter section
    expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument();
  });

  it('displays session table with correct columns', async () => {
    mockGetSessions.mockResolvedValueOnce({
      success: true,
      data: [
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
      ],
      total_count: 1
    })
    await act(async () => {
      render(<SessionsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText((content) => !!content && content.includes('Sessions'))).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /Session ID/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Start Time/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Duration/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Containment Type/i })).toBeInTheDocument();
    })
  })

  it('handles missing credentials gracefully', async () => {
    jest.spyOn(window.sessionStorage, 'getItem').mockReturnValueOnce(null)
    mockGetSessions.mockResolvedValueOnce({ success: true, data: [], total_count: 0 })
    await act(async () => {
      render(<SessionsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText((content) => !!content && /0\s+sessions found/i.test(content))).toBeInTheDocument()
    })
  })
}) 