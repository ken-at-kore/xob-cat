import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardLayout from './layout';

jest.mock('../../lib/utils', () => ({
  ...jest.requireActual('../../lib/utils'),
  redirectTo: jest.fn(),
}));
import { redirectTo } from '../../lib/utils';

// Mock navigation components
jest.mock('../../components/TopNav', () => {
  return function MockTopNav({ botId }: { botId: string }) {
    return <div data-testid="top-nav">TopNav - Bot: {botId}</div>;
  };
});

jest.mock('../../components/Sidebar', () => {
  return function MockSidebar() {
    return <div data-testid="sidebar">Sidebar</div>;
  };
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

describe('DashboardLayout', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(
      JSON.stringify({
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      })
    );
  });

  describe('Navigation Components', () => {
    it('renders TopNav component with bot ID', () => {
      render(<DashboardLayout> <div>Test Content</div> </DashboardLayout>);
      
      const topNav = screen.getByTestId('top-nav');
      expect(topNav).toBeInTheDocument();
      expect(topNav).toHaveTextContent('TopNav - Bot: test-bot-id');
    });

    it('renders Sidebar component', () => {
      render(<DashboardLayout> <div>Test Content</div> </DashboardLayout>);
      
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveTextContent('Sidebar');
    });

    it('renders main content area for children', () => {
      render(<DashboardLayout> <div data-testid="child-content">Test Content</div> </DashboardLayout>);
      
      const childContent = screen.getByTestId('child-content');
      expect(childContent).toBeInTheDocument();
      expect(childContent).toHaveTextContent('Test Content');
    });
  });

  describe('Layout Structure', () => {
    it('has proper layout with TopNav, Sidebar, and main content', () => {
      render(<DashboardLayout> <div>Test Content</div> </DashboardLayout>);
      
      const topNav = screen.getByTestId('top-nav');
      const sidebar = screen.getByTestId('sidebar');
      const mainContent = screen.getByText('Test Content');
      
      expect(topNav).toBeInTheDocument();
      expect(sidebar).toBeInTheDocument();
      expect(mainContent).toBeInTheDocument();
    });

    it('positions main content with proper margins for TopNav and Sidebar', () => {
      render(<DashboardLayout> <div data-testid="child-content">Test Content</div> </DashboardLayout>);
      
      const mainElement = screen.getByTestId('child-content').parentElement?.parentElement;
      expect(mainElement).toHaveClass('ml-64', 'pt-16'); // Left margin for sidebar, top padding for nav
    });
  });

  describe('Credentials Handling', () => {
    it('shows loading state if credentials are missing', () => {
      mockSessionStorage.getItem.mockReturnValueOnce(null);
      render(<DashboardLayout> <div>Test Content</div> </DashboardLayout>);
      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
      expect(screen.getByText(/Setting up your dashboard/i)).toBeInTheDocument();
    });

    it('redirects to home page if credentials are invalid', () => {
      mockSessionStorage.getItem.mockReturnValueOnce('invalid-json');
      render(<DashboardLayout> <div>Test Content</div> </DashboardLayout>);
      expect(redirectTo).toHaveBeenCalledWith('/');
    });
  });
}); 