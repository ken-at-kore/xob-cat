import '@testing-library/jest-dom'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SessionsPage from '../page'
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
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
    // Optionally check for the subtitle if present
    // expect(screen.getByText(/Setting up your dashboard/i)).toBeInTheDocument()
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
      expect(screen.getByText((content) => !!content && content.includes('session_...'))).toBeInTheDocument()
      expect(screen.getAllByText((content) => !!content && content.includes('Self Service')).length).toBeGreaterThan(0)
    })
  })

  it('displays error when sessions fail to load', async () => {
    mockGetSessions.mockRejectedValue(new Error('Failed to fetch sessions'))
    await act(async () => {
      render(<SessionsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText(/Error:/i)).toBeInTheDocument()
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

  it('shows refresh button and allows manual refresh', async () => {
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
    })
    const refreshButton = screen.getByRole('button', { name: /Refresh/i })
    expect(refreshButton).toBeInTheDocument()
    await userEvent.click(refreshButton)
    expect(mockGetSessions).toHaveBeenCalledTimes(2)
  })

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
      expect(screen.getAllByText((content) => !!content && content.includes('Session ID')).some(el => el.tagName === 'TH')).toBe(true)
      expect(screen.getAllByText((content) => !!content && content.includes('Start Time')).some(el => el.tagName === 'TH')).toBe(true)
      expect(screen.getAllByText((content) => !!content && content.includes('Duration')).some(el => el.tagName === 'TH')).toBe(true)
      expect(screen.getAllByText((content) => !!content && content.includes('Containment Type')).some(el => el.tagName === 'TH')).toBe(true)
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