import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import Sidebar from '../Sidebar';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Pages section header', () => {
    mockUsePathname.mockReturnValue('/sessions');
    render(<Sidebar />);
    
    const pagesHeader = screen.getByText('Pages');
    expect(pagesHeader).toBeInTheDocument();
    expect(pagesHeader).toHaveClass('text-xs', 'font-semibold', 'text-gray-500', 'uppercase', 'tracking-wide');
  });

  it('renders View Sessions link', () => {
    mockUsePathname.mockReturnValue('/sessions');
    render(<Sidebar />);
    
    const viewSessionsLink = screen.getByRole('link', { name: /view sessions/i });
    expect(viewSessionsLink).toBeInTheDocument();
    expect(viewSessionsLink).toHaveAttribute('href', '/sessions');
  });

  it('renders Analyze Sessions link', () => {
    mockUsePathname.mockReturnValue('/sessions');
    render(<Sidebar />);
    
    const analyzeSessionsLink = screen.getByRole('link', { name: /analyze sessions/i });
    expect(analyzeSessionsLink).toBeInTheDocument();
    expect(analyzeSessionsLink).toHaveAttribute('href', '/analyze');
  });

  it('highlights View Sessions as active when on /sessions path', () => {
    mockUsePathname.mockReturnValue('/sessions');
    render(<Sidebar />);
    
    const viewSessionsLink = screen.getByRole('link', { name: /view sessions/i });
    expect(viewSessionsLink).toHaveClass('bg-blue-50', 'text-blue-700', 'border-r-2', 'border-blue-700');
  });

  it('highlights Analyze Sessions as active when on /analyze path', () => {
    mockUsePathname.mockReturnValue('/analyze');
    render(<Sidebar />);
    
    const analyzeSessionsLink = screen.getByRole('link', { name: /analyze sessions/i });
    expect(analyzeSessionsLink).toHaveClass('bg-blue-50', 'text-blue-700', 'border-r-2', 'border-blue-700');
  });

  it('shows View Sessions as inactive when on /analyze path', () => {
    mockUsePathname.mockReturnValue('/analyze');
    render(<Sidebar />);
    
    const viewSessionsLink = screen.getByRole('link', { name: /view sessions/i });
    expect(viewSessionsLink).toHaveClass('text-gray-700', 'hover:bg-gray-50');
    expect(viewSessionsLink).not.toHaveClass('bg-blue-50', 'text-blue-700');
  });

  it('shows Analyze Sessions as inactive when on /sessions path', () => {
    mockUsePathname.mockReturnValue('/sessions');
    render(<Sidebar />);
    
    const analyzeSessionsLink = screen.getByRole('link', { name: /analyze sessions/i });
    expect(analyzeSessionsLink).toHaveClass('text-gray-700', 'hover:bg-gray-50');
    expect(analyzeSessionsLink).not.toHaveClass('bg-blue-50', 'text-blue-700');
  });

  it('has proper layout structure and positioning', () => {
    mockUsePathname.mockReturnValue('/sessions');
    render(<Sidebar />);
    
    const sidebar = screen.getByRole('navigation', { name: /sidebar navigation/i });
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass('w-64', 'bg-white', 'border-r', 'border-gray-200');
  });

  it('has fixed positioning and proper height', () => {
    mockUsePathname.mockReturnValue('/sessions');
    render(<Sidebar />);
    
    const sidebar = screen.getByRole('navigation', { name: /sidebar navigation/i });
    expect(sidebar).toHaveClass('fixed', 'left-0', 'top-16', 'h-full');
  });

  it('renders navigation links in correct order', () => {
    mockUsePathname.mockReturnValue('/sessions');
    render(<Sidebar />);
    
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('View Sessions');
    expect(links[1]).toHaveTextContent('Analyze Sessions');
  });
});