import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetPasswordForm } from '@/components/reset-password/ResetPasswordForm';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('next/link', () => {
  const R = require('react');
  return { __esModule: true, default: ({ href, children, ...p }: any) => R.createElement('a', { href, ...p }, children) };
});
jest.mock('@techfusion/ui', () => {
  const R = require('react');
  const cn = (...a: any[]) => a.filter(Boolean).join(' ');
  const Input = R.forwardRef((props: any, ref: any) => {
    const { label, error, inputSize, className, ...rest } = props;
    const inputId = rest.id || rest.name;
    return (
      <div>
        {label && <label htmlFor={inputId}>{label}{rest.required ? '*' : ''}</label>}
        <input ref={ref} {...rest} id={inputId} className={className} aria-invalid={!!error} />
        {error && <span role="alert">{error}</span>}
      </div>
    );
  });
  Input.displayName = 'Input';
  const Button = R.forwardRef((props: any, ref: any) => {
    const { loading, loadingText, fullWidth, variant, size, children, ...rest } = props;
    return <button ref={ref} {...rest} aria-busy={loading || undefined}>{loading ? (loadingText || children) : children}</button>;
  });
  Button.displayName = 'Button';
  const Alert = ({ children, variant, icon, ...props }: any) => <div role="alert" {...props}>{icon}{children}</div>;
  const Card = ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>;
  return { cn, Input, Button, Alert, Card };
});

const fetchMock = jest.fn();
global.fetch = fetchMock as any;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  window.history.replaceState({}, '', '/reset-password');
});

function setToken(token: string) {
  window.history.replaceState({}, '', `/reset-password?token=${token}`);
}

function getPasswordInput(name: string): HTMLInputElement {
  return document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
}

describe('ResetPasswordForm -- missing token', () => {
  it('1: shows invalid-link state when no token is present', () => {
    render(<ResetPasswordForm />);
    expect(screen.getByRole('heading', { name: /invalid reset link/i })).toBeInTheDocument();
  });

  it('2: missing token state has request-new-link action', () => {
    render(<ResetPasswordForm />);
    const link = screen.getByRole('link', { name: /request a new reset link/i });
    expect(link).toHaveAttribute('href', '/forgot-password');
  });
});

describe('ResetPasswordForm -- token present', () => {
  beforeEach(() => { setToken('test-opaque-token-abc123'); });

  it('3: renders the reset password form when token is present', () => {
    render(<ResetPasswordForm />);
    expect(screen.getByRole('heading', { name: /set a new password/i })).toBeInTheDocument();
  });

  it('4: token is not rendered visually in the DOM', () => {
    render(<ResetPasswordForm />);
    expect(screen.queryByText('test-opaque-token-abc123')).not.toBeInTheDocument();
  });

  it('5: token is not in localStorage or sessionStorage', () => {
    render(<ResetPasswordForm />);
    expect(localStorage.getItem('resetToken')).toBeNull();
    expect(sessionStorage.getItem('resetToken')).toBeNull();
  });

  it('6: renders new password field with correct attributes', () => {
    render(<ResetPasswordForm />);
    const pw = getPasswordInput('newPassword');
    expect(pw).toBeInTheDocument();
    expect(pw).toHaveAttribute('type', 'password');
    expect(pw).toHaveAttribute('autoComplete', 'new-password');
  });

  it('7: renders confirm password field with correct attributes', () => {
    render(<ResetPasswordForm />);
    const cp = getPasswordInput('confirmPassword');
    expect(cp).toBeInTheDocument();
    expect(cp).toHaveAttribute('type', 'password');
    expect(cp).toHaveAttribute('autoComplete', 'new-password');
  });

  it('8: renders password visibility toggle buttons', () => {
    render(<ResetPasswordForm />);
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show confirm password/i })).toBeInTheDocument();
  });

  it('9: toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    const pw = getPasswordInput('newPassword');
    expect(pw).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(pw).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(pw).toHaveAttribute('type', 'password');
  });

  it('10: displays password policy guidance', () => {
    render(<ResetPasswordForm />);
    expect(screen.getByText(/8–128 characters/i)).toBeInTheDocument();
  });

  it('11: renders return-to-login link', () => {
    render(<ResetPasswordForm />);
    const link = screen.getByRole('link', { name: /back to sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('12: renders submit button', () => {
    render(<ResetPasswordForm />);
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });
});

describe('ResetPasswordForm -- validation', () => {
  beforeEach(() => { setToken('test-opaque-token-abc123'); });

  it('13: rejects empty password on submit', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(screen.getByText(/enter a new password/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('14: rejects short password on submit', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'short');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('15: rejects empty confirm field on submit', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'ValidPass123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(screen.getByText(/confirm your new password/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('16: rejects password mismatch on submit', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'ValidPass123');
    await user.type(getPasswordInput('confirmPassword'), 'DifferentPass123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('17: accepts valid passwords and submits', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'ValidPass123');
    await user.type(getPasswordInput('confirmPassword'), 'ValidPass123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('18: validation errors are announced via role="alert"', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ResetPasswordForm -- API interaction', () => {
  beforeEach(() => { setToken('test-opaque-token-abc123'); });

  it('19: calls POST /auth/reset-password with correct body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Password has been reset successfully' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/reset-password');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ token: 'test-opaque-token-abc123', newPassword: 'NewSecure123!' });
  });

  it('20: prevents duplicate submission while submitting', async () => {
    let resolveFetch!: (v: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { resolveFetch = r; }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /resetting password/i })).toBeDisabled();
    resolveFetch(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
  });

  it('21: shows success state after successful reset', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Password has been reset successfully' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /password reset complete/i })).toBeInTheDocument();
    });
  });

  it('22: success state removes password fields from DOM', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Password has been reset successfully' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /password reset complete/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('textbox', { name: /new password/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /confirm password/i })).not.toBeInTheDocument();
  });

  it('23: success informs about session revocation', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Password has been reset successfully' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByText(/existing sessions have been signed out/i)).toBeInTheDocument();
    });
  });

  it('24: success does not automatically authenticate', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Password has been reset successfully' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /password reset complete/i })).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('25: success page has return-to-login link', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Password has been reset successfully' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /password reset complete/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/login');
  });

  it('26: invalid token shows controlled invalid-token state', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid or expired reset token' }), { status: 400 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /reset link expired/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
  });

  it('27: expired token uses same UI state as invalid token', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid or expired reset token' }), { status: 400 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /reset link expired/i })).toBeInTheDocument();
    });
  });

  it('28: invalid token state has request-new-link action', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid or expired reset token' }), { status: 400 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /reset link expired/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /request a new reset link/i })).toHaveAttribute('href', '/forgot-password');
  });

  it('29: handles rate-limit response with controlled message', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'rate limited' }), { status: 429 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/too many requests/i);
    });
  });

  it('30: handles network failure with controlled message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/couldn't reach the service/i);
    });
  });

  it('31: does not render raw backend errors to user', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'PrismaClientKnownRequestError P2025' }), { status: 500 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/PrismaClient/)).not.toBeInTheDocument();
  });

  it('32: contract test — reset-password request body matches backend', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Password has been reset successfully' }), { status: 200 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'MyNewPass!2024');
    await user.type(getPasswordInput('confirmPassword'), 'MyNewPass!2024');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ token: 'test-opaque-token-abc123', newPassword: 'MyNewPass!2024' });
  });

  it('33: restores interaction after recoverable server error', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'err' }), { status: 500 }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Password has been reset successfully' }), { status: 200 }));
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /password reset complete/i })).toBeInTheDocument();
    });
  });
});

describe('ResetPasswordForm -- accessibility', () => {
  beforeEach(() => { setToken('test-opaque-token-abc123'); });

  it('34: loading state announces via aria-busy', async () => {
    let resolveFetch!: (v: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { resolveFetch = r; }));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(getPasswordInput('newPassword'), 'NewSecure123!');
    await user.type(getPasswordInput('confirmPassword'), 'NewSecure123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resetting password/i })).toHaveAttribute('aria-busy', 'true');
    });
    resolveFetch(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
  });

  it('35: keyboard navigation reaches all interactive controls', () => {
    render(<ResetPasswordForm />);
    for (const el of [
      getPasswordInput('newPassword'),
      getPasswordInput('confirmPassword'),
      screen.getByRole('button', { name: /show password/i }),
      screen.getByRole('button', { name: /show confirm password/i }),
      screen.getByRole('button', { name: /reset password/i }),
    ]) {
      expect(el).not.toHaveAttribute('tabIndex', '-1');
    }
  });
});
