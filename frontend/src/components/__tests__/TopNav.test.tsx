import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import TopNav from '../TopNav';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('TopNav', () => {
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
  });

  it('renders app name and subtitle on the left side', () => {
    render(<TopNav botId="test-bot-123" />);
    
    const appName = screen.getByText('XOB CAT');
    expect(appName).toBeInTheDocument();
    
    const subtitle = screen.getByText('XO Bot Conversation Analysis Tools');
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveClass('text-gray-500', 'text-sm');
  });

  it('renders Bot ID label and value on the right side', () => {
    const botId = 'test-bot-123';
    render(<TopNav botId={botId} />);
    
    const botIdLabel = screen.getByText('Bot ID');
    expect(botIdLabel).toBeInTheDocument();
    expect(botIdLabel).toHaveClass('text-sm', 'text-gray-500');
    
    const botIdElement = screen.getByText(botId);
    expect(botIdElement).toBeInTheDocument();
  });

  it('renders disconnect link on the right side', () => {
    render(<TopNav botId="test-bot-123" />);
    
    const disconnectLink = screen.getByRole('button', { name: /disconnect/i });
    expect(disconnectLink).toBeInTheDocument();
  });

  it('renders bullet separator between bot ID and disconnect link', () => {
    render(<TopNav botId="test-bot-123" />);
    
    const bulletSeparator = screen.getByText('•');
    expect(bulletSeparator).toBeInTheDocument();
    expect(bulletSeparator).toHaveClass('text-gray-400');
  });

  it('navigates to credentials page when disconnect is clicked', () => {
    render(<TopNav botId="test-bot-123" />);
    
    const disconnectLink = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectLink);
    
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('has proper layout structure with app name on left and bot info on right', () => {
    render(<TopNav botId="test-bot-123" />);
    
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    
    // Check that the nav has proper positioning classes
    expect(nav).toHaveClass('fixed', 'top-0', 'left-0', 'right-0');
    
    // Check for the inner div with flex layout
    const innerDiv = nav.querySelector('div');
    expect(innerDiv).toHaveClass('flex', 'justify-between', 'items-center');
  });

  it('displays bot ID with proper formatting', () => {
    const botId = 'very-long-bot-id-name-12345';
    render(<TopNav botId={botId} />);
    
    const botIdElement = screen.getByText(botId);
    expect(botIdElement).toBeInTheDocument();
    expect(botIdElement).toHaveClass('text-sm', 'font-mono', 'text-gray-700');
  });

  it('has fixed positioning at top of screen', () => {
    render(<TopNav botId="test-bot-123" />);
    
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('fixed', 'top-0', 'left-0', 'right-0');
  });

  it('has proper z-index for layering', () => {
    render(<TopNav botId="test-bot-123" />);
    
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('z-50');
  });
});