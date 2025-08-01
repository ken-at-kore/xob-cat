import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';

// Mock Next.js router
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

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('Navigation Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    });
    
    // Mock valid credentials
    mockSessionStorage.getItem.mockReturnValue(
      JSON.stringify({
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      })
    );
  });

  it('should render new navigation layout when accessing /sessions', async () => {
    // Mock pathname for sidebar
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/sessions');

    // Import the new dashboard layout
    const DashboardLayout = (await import('../app/(dashboard)/layout')).default;

    render(
      <DashboardLayout>
        <div data-testid="sessions-content">Sessions Page Content</div>
      </DashboardLayout>
    );

    // Should have new TopNav with app name and bot ID
    expect(screen.getByText('XOBCAT')).toBeInTheDocument();
    expect(screen.getByText('test-bot-id')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();

    // Should have Sidebar with Pages section
    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view sessions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /analyze sessions/i })).toBeInTheDocument();

    // Should have main content area
    expect(screen.getByTestId('sessions-content')).toBeInTheDocument();
  });

  it('should NOT render old layout components when using new structure', async () => {
    const { usePathname } = require('next/navigation');
    usePathname.mockReturnValue('/sessions');

    const DashboardLayout = (await import('../app/(dashboard)/layout')).default;

    render(
      <DashboardLayout>
        <div>Sessions Content</div>
      </DashboardLayout>
    );

    // Should NOT have old layout elements
    expect(screen.queryByText(/Connected Bot ID:/)).not.toBeInTheDocument();
    expect(screen.queryByText('View Sessions')).toBeInTheDocument(); // Should be in sidebar
    expect(screen.queryByText('Analyze Sessions')).toBeInTheDocument(); // Should be in sidebar
    
    // Old card-based navigation should not exist
    const cards = screen.queryAllByRole('link');
    const cardElements = cards.filter(link => 
      link.querySelector('[class*="p-3"][class*="cursor-pointer"]')
    );
    expect(cardElements).toHaveLength(0);
  });
});