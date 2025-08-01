import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock API client
jest.mock('../lib/api', () => ({
  apiClient: {
    healthCheck: jest.fn(),
    getSessions: jest.fn(),
  },
  ApiError: class MockApiError extends Error {
    constructor(message: string, public status: number) {
      super(message);
      this.name = 'ApiError';
    }
  }
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('Navigation End-to-End Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    });
    
    // Clear sessionStorage
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  it('should redirect from credentials to /sessions (not /dashboard/sessions)', async () => {
    // Mock successful API response
    const { apiClient } = require('../lib/api');
    apiClient.healthCheck.mockResolvedValue({ status: 'ok' });

    // Mock window.location.href setter
    const mockLocationAssign = jest.fn();
    delete (window as any).location;
    (window as any).location = { href: '', assign: mockLocationAssign };

    // Import and render home page with onNavigate prop to test navigation
    const Home = (await import('../app/page')).default;
    const mockOnNavigate = jest.fn();
    
    render(<Home onNavigate={mockOnNavigate} />);

    // Fill in credentials
    const botIdInput = screen.getByLabelText(/bot id/i);
    const clientIdInput = screen.getByLabelText(/client id/i);
    const clientSecretInput = screen.getByLabelText(/client secret/i);

    fireEvent.change(botIdInput, { target: { value: 'test-bot-id' } });
    fireEvent.change(clientIdInput, { target: { value: 'test-client-id' } });
    fireEvent.change(clientSecretInput, { target: { value: 'test-client-secret' } });

    // Click connect button
    const connectButton = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(connectButton);

    // Should store credentials and redirect to /sessions (NOT /dashboard/sessions)
    await waitFor(() => {
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'botCredentials',
        JSON.stringify({
          botId: 'test-bot-id',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        })
      );
    });

    // Check that it navigates to the correct path (NEW route structure)
    expect(mockOnNavigate).toHaveBeenCalledWith('/sessions');
    expect(mockOnNavigate).not.toHaveBeenCalledWith('/dashboard/sessions'); // OLD route
  });

  it('should render new navigation structure when accessing dashboard route', async () => {
    // Mock valid credentials and sessions API
    mockSessionStorage.getItem.mockReturnValue(
      JSON.stringify({
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      })
    );

    const { apiClient } = require('../lib/api');
    apiClient.getSessions.mockResolvedValue([]);

    // Mock pathname for sidebar
    mockUsePathname.mockReturnValue('/sessions');

    // Import and render sessions page with dashboard layout
    const DashboardLayout = (await import('../app/(dashboard)/layout')).default;
    const SessionsPage = (await import('../app/(dashboard)/sessions/page')).default;

    render(
      <DashboardLayout>
        <SessionsPage />
      </DashboardLayout>
    );

    // Should have new TopNav components
    expect(screen.getByText('XOBCAT')).toBeInTheDocument();
    expect(screen.getByText('test-bot-id')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();

    // Should have new Sidebar components
    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view sessions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /analyze sessions/i })).toBeInTheDocument();

    // Should have sessions content
    await waitFor(() => {
      expect(screen.getByText('Sessions')).toBeInTheDocument();
      expect(screen.getByText(/Browse and analyze chatbot session data/i)).toBeInTheDocument();
    });
  });

  it('should handle disconnect functionality properly', async () => {
    // Mock valid credentials
    mockSessionStorage.getItem.mockReturnValue(
      JSON.stringify({
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      })
    );

    mockUsePathname.mockReturnValue('/sessions');

    const DashboardLayout = (await import('../app/(dashboard)/layout')).default;

    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>
    );

    // Click disconnect button
    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectButton);

    // Should navigate back to home page
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('should navigate between dashboard pages correctly', async () => {
    // Mock valid credentials
    mockSessionStorage.getItem.mockReturnValue(
      JSON.stringify({
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      })
    );

    mockUsePathname.mockReturnValue('/sessions');

    const DashboardLayout = (await import('../app/(dashboard)/layout')).default;

    render(
      <DashboardLayout>
        <div>Sessions Content</div>
      </DashboardLayout>
    );

    // Should have links with correct hrefs
    const viewSessionsLink = screen.getByRole('link', { name: /view sessions/i });
    const analyzeSessionsLink = screen.getByRole('link', { name: /analyze sessions/i });

    expect(viewSessionsLink).toHaveAttribute('href', '/sessions');
    expect(analyzeSessionsLink).toHaveAttribute('href', '/analyze');

    // View Sessions should be highlighted as active
    expect(viewSessionsLink.closest('a')).toHaveClass('bg-blue-50', 'text-blue-700');
  });
});