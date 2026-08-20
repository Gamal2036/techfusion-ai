import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from '@/components/forgot-password/ForgotPasswordForm';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/link', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: any) =>
      React.createElement('a', { href, ...props }, children),
  };
});
jest.mock('@techfusion/ui', () => {
  const React = require('react');
  const cn = (...args: any[]) => args.filter(Boolean).join(' ');
  const Input = React.forwardRef((props: any, ref: any) => {
    const { label, error, inputSize, className, ...rest } = props;
    return (
      <div>
        {label && <label htmlFor={rest.id || rest.name}>{label}{rest.required ? '*' : ''}</label>}
        <input ref={ref} {...rest} className={className} aria-invalid={!!error} aria-describedby={error ? `${rest.id}-error` : undefined} />
        {error && <span id={`${rest.id}-error`} role="alert">{error}</span>}
      </div>
    );
  });
  Input.displayName = 'Input';
  const Button = React.forwardRef((props: any, ref: any) => {
    const { loading, loadingText, fullWidth, variant, size, children, ...rest } = props;
    return (
      <button ref={ref} {...rest} aria-busy={loading || undefined}>
        {loading ? (loadingText || children) : children}
      </button>
    );
  });
  Button.displayName = 'Button';
  const Alert = ({ children, variant, icon, ...props }: any) => (
    <div role="alert" {...props}>{icon}{children}</div>
  );
  const Card = ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  );
  return { cn, Input, Button, Alert, Card };
});

const fetchMock = jest.fn();
global.fetch = fetchMock as any;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
});

describe('ForgotPasswordForm -- route rendering', () => {
  it('1: renders the forgot password form', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
  });

  it('2: renders email field with correct attributes', () => {
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autoComplete', 'email');
    expect(email).toHaveAttribute('inputMode', 'email');
    expect(email).not.toBeDisabled();
  });

  it('3: renders submit button', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByRole('button', { name: /send reset instructions/i })).toBeInTheDocument();
  });

  it('4: renders return-to-login link', () => {
    render(<ForgotPasswordForm />);
    const link = screen.getByRole('link', { name: /back to sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('5: renders page description mentioning email', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByText(/enter the email address associated with your account/i)).toBeInTheDocument();
  });

  it('6: renders password recovery context label', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByText(/password recovery/i)).toBeInTheDocument();
  });
});

describe('ForgotPasswordForm -- client-side validation', () => {
  it('7: rejects empty email on submit', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/enter your email address/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('8: rejects invalid email format on submit', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/enter a valid email address/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('9: trims whitespace from email before validation and submission', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, '  user@example.com  ');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.email).toBe('user@example.com');
  });

  it('10: normalizes email to lowercase', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'USER@EXAMPLE.COM');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.email).toBe('user@example.com');
  });

  it('11: clears field error when user types after blur', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(email, 'a');
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});

describe('ForgotPasswordForm -- API interaction', () => {
  it('12: calls POST /auth/forgot-password with correct body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/forgot-password');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ email: 'user@example.com' });
  });

  it('13: prevents duplicate submission while loading', async () => {
    let resolveFetch: (v: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { resolveFetch = r; }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const btn = screen.getByRole('button', { name: /sending instructions/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    resolveFetch!(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
  });

  it('14: shows generic success for accepted response (existing account)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/if an account exists for this email/i)).toBeInTheDocument();
  });

  it('15: shows same success for unknown account (enumeration-resistant)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'unknown@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/if an account exists for this email/i)).toBeInTheDocument();
  });

  it('16: handles rate-limit response with controlled message', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'rate limited' }), { status: 429 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/too many requests/i);
    });
    expect(screen.queryByText(/rate limited/i)).not.toBeInTheDocument();
  });

  it('17: handles network failure with controlled message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/couldn't reach the service/i);
    });
  });

  it('18: handles server error with controlled message', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/couldn't process your request/i);
    });
  });

  it('19: does not render raw backend errors to user', async () => {
    fetchMock.mockResolvedValueOnce(new Response(
      JSON.stringify({ message: 'PrismaClientKnownRequestError P2025' }),
      { status: 500 },
    ));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByText(/PrismaClient/)).not.toBeInTheDocument();
  });

  it('20: restores interaction after recoverable failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'err' }), { status: 500 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
    });
  });
});

describe('ForgotPasswordForm -- accessibility and behavior', () => {
  it('21: loading state announces via aria-busy', async () => {
    let resolveFetch!: (v: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { resolveFetch = r; }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /sending instructions/i });
      expect(btn).toHaveAttribute('aria-busy', 'true');
    });
    resolveFetch(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
  });

  it('22: success page has return-to-login link', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
    });
    const link = screen.getByRole('link', { name: /back to sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('23: email field uses correct input type', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('type', 'email');
  });

  it('24: field errors are announced via role="alert"', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it('25: returns form to ready state after failed submission', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'err' }), { status: 500 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const btn = screen.getByRole('button', { name: /send reset instructions/i });
    expect(btn).not.toBeDisabled();
  });

  it('26: contract test — forgot-password request body matches backend', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'Test@Example.COM');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ email: 'test@example.com' });
    expect(typeof body.email).toBe('string');
    expect(body.email).not.toContain(' ');
  });
});
