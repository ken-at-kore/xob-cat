import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '../page'

// Mock the API client
jest.mock('../../lib/api', () => ({
  apiClient: {
    healthCheck: jest.fn(),
  },
}))

describe('Home Page - Credential Input', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the welcome message and credential form', () => {
    render(<Home onNavigate={jest.fn()} />)
    expect(screen.getByText('Welcome to XOB CAT')).toBeInTheDocument()
    expect(screen.getByText(/XO Bot Conversation Analysis Tools/)).toBeInTheDocument()
  })

  it('displays credential input fields', () => {
    render(<Home onNavigate={jest.fn()} />)
    expect(screen.getByLabelText(/Bot ID/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Client ID/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Client Secret/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup()
    render(<Home onNavigate={jest.fn()} />)
    await user.clear(screen.getByLabelText(/Bot ID/i))
    await user.clear(screen.getByLabelText(/Client ID/i))
    await user.clear(screen.getByLabelText(/Client Secret/i))
    const connectButton = screen.getByRole('button', { name: /connect/i })
    await user.click(connectButton)
    await waitFor(() => {
      expect(screen.getByText((content) => !!content && content.includes('Bot ID is required'))).toBeInTheDocument()
      expect(screen.getByText((content) => !!content && content.includes('Client ID is required'))).toBeInTheDocument()
      expect(screen.getByText((content) => !!content && content.includes('Client Secret is required'))).toBeInTheDocument()
    })
  })

  it('handles successful connection', async () => {
    const user = userEvent.setup()
    const mockHealthCheck = jest.fn().mockResolvedValue({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'XOB CAT Backend API'
    })
    const { apiClient } = require('../../lib/api')
    apiClient.healthCheck = mockHealthCheck
    render(<Home onNavigate={jest.fn()} />)
    await user.type(screen.getByLabelText(/Bot ID/i), 'test-bot-id')
    await user.type(screen.getByLabelText(/Client ID/i), 'test-client-id')
    await user.type(screen.getByLabelText(/Client Secret/i), 'test-client-secret')
    const connectButton = screen.getByRole('button', { name: /connect/i })
    await user.click(connectButton)
    await waitFor(() => {
      expect(mockHealthCheck).toHaveBeenCalled()
    })
  })

  it('handles connection failure', async () => {
    const user = userEvent.setup()
    const mockHealthCheck = jest.fn().mockRejectedValue(new Error('Connection failed'))
    const { apiClient } = require('../../lib/api')
    apiClient.healthCheck = mockHealthCheck
    render(<Home onNavigate={jest.fn()} />)
    await user.type(screen.getByLabelText(/Bot ID/i), 'test-bot-id')
    await user.type(screen.getByLabelText(/Client ID/i), 'test-client-id')
    await user.type(screen.getByLabelText(/Client Secret/i), 'test-client-secret')
    const connectButton = screen.getByRole('button', { name: /connect/i })
    await user.click(connectButton)
    await waitFor(() => {
      expect(screen.getByText(/Connection failed/i)).toBeInTheDocument()
    })
  })

  it('shows loading state during connection', async () => {
    const user = userEvent.setup()
    let resolveHealthCheck: (value: any) => void
    const mockHealthCheck = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveHealthCheck = resolve
      })
    })
    const { apiClient } = require('../../lib/api')
    apiClient.healthCheck = mockHealthCheck
    const onNavigate = jest.fn()
    render(<Home onNavigate={onNavigate} />)
    await user.type(screen.getByLabelText(/Bot ID/i), 'test-bot-id')
    await user.type(screen.getByLabelText(/Client ID/i), 'test-client-id')
    await user.type(screen.getByLabelText(/Client Secret/i), 'test-client-secret')
    const connectButton = screen.getByRole('button', { name: /connect/i })
    await user.click(connectButton)
    await waitFor(() => {
      expect(connectButton).toBeDisabled()
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    })
    resolveHealthCheck!({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'XOB CAT Backend API'
    })
  })
}) 