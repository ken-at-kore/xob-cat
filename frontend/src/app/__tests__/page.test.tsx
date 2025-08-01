import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '../page'

// Mock the API client
jest.mock('../../lib/api', () => {
  // Import the actual ApiError class
  const originalModule = jest.requireActual('../../lib/api')
  return {
    ...originalModule,
    apiClient: {
      testKoreConnection: jest.fn(),
    },
  }
})

describe('Home Page - Credential Input', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the welcome message and credential form', () => {
    render(<Home onNavigate={jest.fn()} />)
    expect(screen.getByText('Welcome to XOBCAT')).toBeInTheDocument()
    expect(screen.getByText(/XO Bot Conversation Analysis Tools - Empowering Kore.ai platform users/)).toBeInTheDocument()
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
    const mockTestKoreConnection = jest.fn().mockResolvedValue({
      bot_name: 'Test Bot'
    })
    const { apiClient } = require('../../lib/api')
    apiClient.testKoreConnection = mockTestKoreConnection
    render(<Home onNavigate={jest.fn()} />)
    await user.type(screen.getByLabelText(/Bot ID/i), 'test-bot-id')
    await user.type(screen.getByLabelText(/Client ID/i), 'test-client-id')
    await user.type(screen.getByLabelText(/Client Secret/i), 'test-client-secret')
    const connectButton = screen.getByRole('button', { name: /connect/i })
    await user.click(connectButton)
    await waitFor(() => {
      expect(mockTestKoreConnection).toHaveBeenCalled()
    })
  })

  it('handles connection failure', async () => {
    const user = userEvent.setup()
    const mockTestKoreConnection = jest.fn().mockRejectedValue(new Error('Connection failed'))
    const { apiClient } = require('../../lib/api')
    apiClient.testKoreConnection = mockTestKoreConnection
    render(<Home onNavigate={jest.fn()} />)
    await user.type(screen.getByLabelText(/Bot ID/i), 'test-bot-id')
    await user.type(screen.getByLabelText(/Client ID/i), 'test-client-id')
    await user.type(screen.getByLabelText(/Client Secret/i), 'test-client-secret')
    const connectButton = screen.getByRole('button', { name: /connect/i })
    await user.click(connectButton)
    await waitFor(() => {
      // The error message should be displayed
      expect(screen.getByText('Connection failed')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('shows loading state during connection', async () => {
    const user = userEvent.setup()
    let resolveTestKoreConnection: (value: any) => void
    const mockTestKoreConnection = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveTestKoreConnection = resolve
      })
    })
    const { apiClient } = require('../../lib/api')
    apiClient.testKoreConnection = mockTestKoreConnection
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
    resolveTestKoreConnection!({
      bot_name: 'Test Bot'
    })
  })

  describe('Visual Enhancements', () => {
    it('displays the Kore.ai emblem', () => {
      render(<Home onNavigate={jest.fn()} />)
      const emblem = screen.getByAltText('Kore.ai')
      expect(emblem).toBeInTheDocument()
      expect(emblem).toHaveAttribute('src', '/kore-emblem-grey.svg')
    })

    it('focuses the Bot ID field on page load', async () => {
      await act(async () => {
        render(<Home onNavigate={jest.fn()} />)
      })
      
      await waitFor(() => {
        const botIdInput = screen.getByLabelText(/Bot ID/i)
        expect(botIdInput).toHaveFocus()
      })
    })

    it('client secret field has proper attributes to prevent password manager', () => {
      render(<Home onNavigate={jest.fn()} />)
      const clientSecretInput = screen.getByLabelText(/Client Secret/i)
      expect(clientSecretInput).toHaveAttribute('type', 'text')
      expect(clientSecretInput).toHaveAttribute('autocomplete', 'off')
      expect(clientSecretInput).toHaveAttribute('data-lpignore', 'true')
      expect(clientSecretInput).toHaveAttribute('data-form-type', 'config')
      expect(clientSecretInput).toHaveAttribute('name', 'api-token')
    })

    it('maintains proper tab order with emblem added', async () => {
      const user = userEvent.setup()
      
      await act(async () => {
        render(<Home onNavigate={jest.fn()} />)
      })
      
      // Wait for initial focus to be set
      await waitFor(() => {
        const botIdInput = screen.getByLabelText(/Bot ID/i)
        expect(botIdInput).toHaveFocus()
      })
      
      // Tab to next field (Client ID)
      await user.tab()
      const clientIdInput = screen.getByLabelText(/Client ID/i)
      expect(clientIdInput).toHaveFocus()
      
      // Tab to next field (Client Secret)
      await user.tab()
      const clientSecretInput = screen.getByLabelText(/Client Secret/i)
      expect(clientSecretInput).toHaveFocus()
      
      // Tab to Connect button
      await user.tab()
      const connectButton = screen.getByRole('button', { name: /connect/i })
      expect(connectButton).toHaveFocus()
    })
  })
}) 