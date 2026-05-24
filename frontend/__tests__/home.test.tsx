import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '../app/page';

// Mock environment variables
process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:8000';

describe('Home Page', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('renders the meeting bot form', () => {
    render(<Home />);

    // Check for title
    expect(screen.getByText(/gemini meeting bot/i)).toBeInTheDocument();

    // Check for input
    expect(screen.getByPlaceholderText(/https:\/\/meet\.google\.com\/xxx\-yyy\-zzz/i)).toBeInTheDocument();

    // Check for submit button
    expect(screen.getByRole('button', { name: /join meeting/i })).toBeInTheDocument();
  });

  it('shows loading state when submitting form', async () => {
    render(<Home />);

    // Fill in the form
    const input = screen.getByPlaceholderText(/https:\/\/meet\.google\.com\/xxx\-yyy\-zzz/i);
    fireEvent.change(input, { target: { value: 'https://meet.google.com/abc-defg-hij' } });

    // Submit the form
    const form = screen.getByRole('form');
    fireEvent.submit(form);

    // Check for loading state
    expect(screen.getByRole('button')).toHaveTextContent(/joining.../i);

    // Check for status message
    expect(await screen.findByText(/requesting bot to join.../i)).toBeInTheDocument();
  });

  it('displays error for invalid meeting URL', async () => {
    render(<Home />);

    // Fill in the form with invalid URL
    const input = screen.getByPlaceholderText(/https:\/\/meet\.google\.com\/xxx\-yyy\-zzz/i);
    fireEvent.change(input, { target: { value: 'not-a-valid-url' } });

    // Submit the form
    const form = screen.getByRole('form');
    fireEvent.submit(form);

    // Check for error message
    expect(await screen.findByText(/error/i)).toBeInTheDocument();
  });

  it('displays success message for valid submission', async () => {
    // Mock fetch API
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'success',
        bot_id: 'test-bot-id-123'
      })
    }) as jest.Mock;

    render(<Home />);

    // Fill in the form
    const input = screen.getByPlaceholderText(/https:\/\/meet\.google\.com\/xxx\-yyy\-zzz/i);
    fireEvent.change(input, { target: { value: 'https://meet.google.com/abc-defg-hij' } });

    // Submit the form
    const form = screen.getByRole('form');
    fireEvent.submit(form);

    // Wait for success message
    expect(await screen.findByText(/success! bot id:/i)).toBeInTheDocument();
  });
});