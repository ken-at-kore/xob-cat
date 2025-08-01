import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
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

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('Navigation Edge Cases', () => {
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
    mockUsePathname.mockReturnValue('/sessions');
  });

  describe('TopNav Edge Cases', () => {
    it('handles extremely long bot IDs gracefully', async () => {
      const TopNav = (await import('../components/TopNav')).default;
      const veryLongBotId = 'this-is-an-extremely-long-bot-id-name-that-might-overflow-the-navigation-bar-and-cause-layout-issues-12345678901234567890';
      
      render(<TopNav botId={veryLongBotId} />);
      
      const botIdElement = screen.getByText(veryLongBotId);
      expect(botIdElement).toBeInTheDocument();
      expect(botIdElement).toHaveClass('font-mono'); // Should maintain monospace for readability
    });

    it('handles empty bot ID', async () => {
      const TopNav = (await import('../components/TopNav')).default;
      
      render(<TopNav botId="" />);
      
      const botIdLabel = screen.getByText('Bot ID');
      expect(botIdLabel).toBeInTheDocument();
      
      // Should still render the empty bot ID element
      const botIdElement = screen.getByText('Bot ID').nextSibling;
      expect(botIdElement).toBeInTheDocument();
    });

    it('handles special characters in bot ID', async () => {
      const TopNav = (await import('../components/TopNav')).default;
      const specialBotId = 'bot-id-with-!@#$%^&*()_+{}|:<>?[]\\;",./`~';
      
      render(<TopNav botId={specialBotId} />);
      
      const botIdElement = screen.getByText(specialBotId);
      expect(botIdElement).toBeInTheDocument();
    });
  });

  describe('Sidebar Edge Cases', () => {
    it('handles unknown pathname gracefully', async () => {
      mockUsePathname.mockReturnValue('/unknown-path');
      const Sidebar = (await import('../components/Sidebar')).default;
      
      render(<Sidebar />);
      
      const viewSessionsLink = screen.getByRole('link', { name: /view sessions/i });
      const analyzeSessionsLink = screen.getByRole('link', { name: /analyze sessions/i });
      
      // Neither should be active for unknown path
      expect(viewSessionsLink).not.toHaveClass('bg-blue-50', 'text-blue-700');
      expect(analyzeSessionsLink).not.toHaveClass('bg-blue-50', 'text-blue-700');
    });

    it('handles null pathname', async () => {
      mockUsePathname.mockReturnValue(null as any);
      const Sidebar = (await import('../components/Sidebar')).default;
      
      render(<Sidebar />);
      
      // Should still render without crashing
      expect(screen.getByText('Pages')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /view sessions/i })).toBeInTheDocument();
    });
  });

  describe('Dashboard Layout Edge Cases', () => {
    it('handles missing credentials gracefully', async () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      const DashboardLayout = (await import('../app/(dashboard)/layout')).default;
      
      render(
        <DashboardLayout>
          <div>Test Content</div>
        </DashboardLayout>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(screen.getByText('Setting up your dashboard')).toBeInTheDocument();
      });
    });

    it('handles corrupted credentials JSON', async () => {
      mockSessionStorage.getItem.mockReturnValue('{"invalid":json}');
      const DashboardLayout = (await import('../app/(dashboard)/layout')).default;
      
      render(
        <DashboardLayout>
          <div>Test Content</div>
        </DashboardLayout>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });

    it('handles partial credentials object', async () => {
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify({
        botId: 'test-bot-id',
        // Missing clientId and clientSecret
      }));
      const DashboardLayout = (await import('../app/(dashboard)/layout')).default;
      
      render(
        <DashboardLayout>
          <div>Test Content</div>
        </DashboardLayout>
      );
      
      // Should still render with available botId
      await waitFor(() => {
        expect(screen.getByText('XOBCAT')).toBeInTheDocument();
        expect(screen.getByText('test-bot-id')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify({
        botId: 'test-bot-id',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }));

      const DashboardLayout = (await import('../app/(dashboard)/layout')).default;
      
      render(
        <DashboardLayout>
          <div>Test Content</div>
        </DashboardLayout>
      );
      
      await waitFor(() => {
        // Top navigation should be accessible
        const topNav = screen.getAllByRole('navigation')[0];
        expect(topNav).toBeInTheDocument();
        
        // Sidebar should have proper aria-label
        const sidebar = screen.getByRole('navigation', { name: /sidebar navigation/i });
        expect(sidebar).toBeInTheDocument();
        
        // Disconnect button should be accessible
        const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
        expect(disconnectButton).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design Considerations', () => {
    it('maintains layout structure on different screen sizes', async () => {
      const TopNav = (await import('../components/TopNav')).default;
      
      render(<TopNav botId="test-bot-id" />);
      
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('fixed', 'top-0', 'left-0', 'right-0'); // Full width
      
      const flexContainer = nav.querySelector('div');
      expect(flexContainer).toHaveClass('flex', 'justify-between', 'items-center'); // Responsive flex layout
    });
  });
});