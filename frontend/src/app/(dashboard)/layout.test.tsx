import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardLayout from './layout';

jest.mock('../../lib/utils', () => ({
  ...jest.requireActual('../../lib/utils'),
  redirectTo: jest.fn(),
}));
import { redirectTo } from '../../lib/utils';

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

describe('DashboardLayout - Navigation Bar', () => {
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

  it('displays the Bot ID in the nav bar', () => {
    render(<DashboardLayout> <div>Test Content</div> </DashboardLayout>);
    expect(screen.getByText(/Connected Bot ID:/i)).toBeInTheDocument();
    expect(screen.getByText('test-bot-id')).toBeInTheDocument();
  });

  it('shows a Disconnect link that clears credentials and redirects', () => {
    render(<DashboardLayout> <div>Test Content</div> </DashboardLayout>);
    const disconnectBtn = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectBtn);
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('botCredentials');
    expect(redirectTo).toHaveBeenCalledWith('/');
  });

  it('shows loading state if credentials are missing', () => {
    mockSessionStorage.getItem.mockReturnValueOnce(null);
    render(<DashboardLayout> <div>Test Content</div> </DashboardLayout>);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    expect(screen.getByText(/Setting up your dashboard/i)).toBeInTheDocument();
  });
}); 