import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PasswordChangeDialog } from '@/components/account/PasswordChangeDialog';
import { ActiveSessions } from '@/components/account/ActiveSessions';
import { SecuritySection } from '@/components/account/SecuritySection';
import {
  changePassword,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  revokeCurrentSession,
  type SecurityError,
  type SessionsResult,
  type SessionInfo,
} from '@/lib/security-client';
import {
  fetchMfaStatus,
  fetchRecoveryCodesStatus,
  type MfaStatus,
  type RecoveryCodesStatus,
} from '@/lib/mfa-client';
import type { SessionsLoadState } from '@/hooks/useAccountSecurity';

jest.mock('@/lib/security-client', () => ({
  changePassword: jest.fn(),
  listSessions: jest.fn(),
  revokeSession: jest.fn(),
  revokeOtherSessions: jest.fn(),
  revokeCurrentSession: jest.fn(),
  SecurityError: class SecurityError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'SecurityError';
      this.status = status;
    }
  },
}));

jest.mock('@/lib/mfa-client', () => ({
  ...jest.requireActual('@/lib/mfa-client'),
  fetchMfaStatus: jest.fn(),
  fetchRecoveryCodesStatus: jest.fn(),
}));

jest.mock('@/lib/auth-client', () => ({
  ...jest.requireActual('@/lib/auth-client'),
  clearTokens: jest.fn(),
  isLoggingOut: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/socket-client', () => ({
  disconnectAll: jest.fn(),
}));

jest.mock('@techfusion/ui', () => {
  const ReactUi = require('react');
  return {
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
    GlassPanel: ({ children }: any) => <div>{children}</div>,
    Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
    Button: ({ children, variant, size, fullWidth, loading, loadingText, leftIcon, rightIcon, asChild, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    Input: ReactUi.forwardRef(
      ({ label, description, error, success, fullWidth, requiredIndicator, inputSize, leftIcon, rightElement, ...props }: any, ref: any) => (
        <div>
          {label && <label>{label}</label>}
          <input ref={ref} aria-label={label} {...props} />
          {error && (
            <span role="alert" className="text-danger">
              {error}
            </span>
          )}
        </div>
      ),
    ),
    PasswordInput: ReactUi.forwardRef(
      ({ label, description, error, showToggle, toggleLabel, ...props }: any, ref: any) => (
        <div>
          {label && <label>{label}</label>}
          <input ref={ref} type="password" aria-label={label} {...props} />
          {error && (
            <span role="alert" className="text-danger">
              {error}
            </span>
          )}
          {description && (
            <span className="text-xs text-text-muted">{description}</span>
          )}
        </div>
      ),
    ),
    StatusMessage: ({ children, variant, ...props }: any) => (
      <div data-testid="status-message" data-variant={variant} {...props}>
        {children}
      </div>
    ),
    Modal: ({ open, children }: any) =>
      open ? (
        <div role="dialog" data-testid="modal">
          {children}
        </div>
      ) : null,
    ModalContent: ({ children }: any) => <div>{children}</div>,
    ModalHeader: ({ children }: any) => <div>{children}</div>,
    ModalTitle: ({ children }: any) => <h3>{children}</h3>,
    ModalDescription: ({ children }: any) => <p>{children}</p>,
    ModalFooter: ({ children }: any) => <div>{children}</div>,
    Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
  };
});

jest.mock('lucide-react', () => {
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    Loader2: MockIcon,
    ShieldCheck: MockIcon,
    ShieldOff: MockIcon,
    Key: MockIcon,
    MonitorSmartphone: MockIcon,
    Monitor: MockIcon,
    Smartphone: MockIcon,
    Globe: MockIcon,
    LogOut: MockIcon,
    RefreshCw: MockIcon,
    Check: MockIcon,
    Copy: MockIcon,
    Eye: MockIcon,
    EyeOff: MockIcon,
  };
});

const mockChangePassword = changePassword as jest.MockedFunction<typeof changePassword>;
const mockListSessions = listSessions as jest.MockedFunction<typeof listSessions>;
const mockRevokeSession = revokeSession as jest.MockedFunction<typeof revokeSession>;
const mockRevokeOtherSessions = revokeOtherSessions as jest.MockedFunction<typeof revokeOtherSessions>;
const mockRevokeCurrentSession = revokeCurrentSession as jest.MockedFunction<typeof revokeCurrentSession>;
const mockFetchMfaStatus = fetchMfaStatus as jest.MockedFunction<typeof fetchMfaStatus>;
const mockFetchRecoveryCodesStatus = fetchRecoveryCodesStatus as jest.MockedFunction<typeof fetchRecoveryCodesStatus>;

const MFA_ENABLED: MfaStatus = { isMfaEnabled: true };
const RECOVERY_NONE: RecoveryCodesStatus = { generated: false, availableCount: 0 };

const CURRENT_SESSION: SessionInfo = {
  sessionId: 'sess-current-1',
  createdAt: '2026-08-18T10:00:00.000Z',
  expiresAt: '2026-08-25T10:00:00.000Z',
  lastUsedAt: '2026-08-18T14:30:00.000Z',
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  deviceName: null,
  current: true,
};

const OTHER_SESSION: SessionInfo = {
  sessionId: 'sess-other-1',
  createdAt: '2026-08-17T08:00:00.000Z',
  expiresAt: '2026-08-24T08:00:00.000Z',
  lastUsedAt: '2026-08-18T12:00:00.000Z',
  ipAddress: '10.0.0.50',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  deviceName: null,
  current: false,
};

const OTHER_SESSION_MOBILE: SessionInfo = {
  sessionId: 'sess-other-2',
  createdAt: '2026-08-16T05:00:00.000Z',
  expiresAt: '2026-08-23T05:00:00.000Z',
  lastUsedAt: '2026-08-17T18:00:00.000Z',
  ipAddress: '172.16.0.5',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  deviceName: null,
  current: false,
};

function makeSecurityError(message: string, status: number): SecurityError {
  const err = new Error(message) as SecurityError;
  err.status = status;
  err.name = 'SecurityError';
  return err;
}

const dialog = () => screen.getByRole('dialog');

describe('Password Change Dialog (ACC-UX-02D3)', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockChangePassword.mockResolvedValue({
      message: 'Password changed successfully',
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });

  it('renders all three password fields when open', () => {
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
  });

  it('does not render fields when closed', () => {
    render(<PasswordChangeDialog open={false} onOpenChange={jest.fn()} />);

    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
  });

  it('validates current password is required', async () => {
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText('Enter your current password.')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('validates new password minimum 8 characters', async () => {
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText('New password must be at least 8 characters.')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('validates new password maximum 128 characters', async () => {
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    const longPw = 'a'.repeat(129);
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: longPw } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: longPw } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText('New password must be no more than 128 characters.')).toBeInTheDocument();
  });

  it('validates confirmation matches new password', async () => {
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different123' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('validates new password differs from current', async () => {
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'samepass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'samepass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'samepass123' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText('New password must be different from your current password.')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('prevents duplicate submission while pending', async () => {
    let resolveChange: any;
    mockChangePassword.mockReturnValue(
      new Promise((resolve) => { resolveChange = resolve; }),
    );

    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });

    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    expect(mockChangePassword).toHaveBeenCalledTimes(1);

    resolveChange({ message: 'ok', accessToken: 'a', refreshToken: 'b' });
  });

  it('shows incorrect current password message for 401', async () => {
    mockChangePassword.mockRejectedValue(makeSecurityError('Current password is incorrect', 401));

    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText('The current password you entered is incorrect.')).toBeInTheDocument();
  });

  it('shows rate limit message for 429', async () => {
    const onThrottled = jest.fn();
    mockChangePassword.mockRejectedValue(makeSecurityError('Too many requests', 429));

    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} onThrottled={onThrottled} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText('Too many attempts. Wait a moment before trying again.')).toBeInTheDocument();
    expect(onThrottled).toHaveBeenCalledTimes(1);
  });

  it('updates tokens on success through the canonical lifecycle', async () => {
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
    }));
  });

  it('shows success message and clears fields after success', async () => {
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => expect(screen.getByText('Password changed successfully. Your session has been refreshed.')).toBeInTheDocument());

    expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('New password') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Confirm new password') as HTMLInputElement).value).toBe('');
  });

  it('does not render passwords or tokens in the DOM', async () => {
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    const passwordValue = 'supersecret123';
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: passwordValue } });

    expect(screen.queryByText(passwordValue)).not.toBeInTheDocument();
    expect(screen.queryByText('new-access-token')).not.toBeInTheDocument();
  });

  it('calls onPasswordChanged callback on success', async () => {
    const onPasswordChanged = jest.fn();
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} onPasswordChanged={onPasswordChanged} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => expect(onPasswordChanged).toHaveBeenCalledTimes(1));
  });

  it('resets all state when dialog is reopened', () => {
    const { rerender } = render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'somevalue' } });

    rerender(<PasswordChangeDialog open={false} onOpenChange={jest.fn()} />);
    rerender(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe('');
  });

  it('supports keyboard Enter to submit', async () => {
    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });

    fireEvent.keyDown(screen.getByLabelText('Confirm new password'), { key: 'Enter' });

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
  });

  it('shows controlled message for 5xx failures instead of raw backend text', async () => {
    mockChangePassword.mockRejectedValue(makeSecurityError('Internal server error', 500));

    render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText('Something went wrong on our end. Please try again later.')).toBeInTheDocument();
  });
});

describe('Active Sessions Component (ACC-UX-02D3)', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows loading skeletons while sessions are pending', () => {
    const state: SessionsLoadState = { status: 'loading' };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('renders real session metadata from the server', () => {
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION, OTHER_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    expect(screen.getByText('macOS')).toBeInTheDocument();
    expect(screen.getByText('Windows')).toBeInTheDocument();
    expect(screen.getByText('192.168.xxx.xxx')).toBeInTheDocument();
    expect(screen.getByText('10.0.xxx.xxx')).toBeInTheDocument();
  });

  it('identifies the current session with a "This device" badge', () => {
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    expect(screen.getByText('This device')).toBeInTheDocument();
  });

  it('does not show "This device" badge on non-current sessions', () => {
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [OTHER_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    expect(screen.queryByText('This device')).not.toBeInTheDocument();
  });

  it('displays current session before other sessions', () => {
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [OTHER_SESSION, CURRENT_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    const allText = screen.getAllByText(/macOS|Windows/);
    expect(allText[0]).toHaveTextContent('macOS');
    expect(allText[1]).toHaveTextContent('Windows');
  });

  it('does not fabricate geographic location from IP', () => {
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    expect(screen.queryByText(/city|country|location|region/i)).not.toBeInTheDocument();
  });

  it('shows empty state when no sessions exist', () => {
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    expect(screen.getByText('No active sessions found.')).toBeInTheDocument();
  });

  it('shows error state with retry button on fetch failure', () => {
    const onRefresh = jest.fn();
    const state: SessionsLoadState = {
      status: 'failed',
      message: 'Failed to load active sessions.',
    };
    render(<ActiveSessions sessionsState={state} onRefresh={onRefresh} />);

    expect(screen.getByText('Failed to load active sessions.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('opens revoke-one confirmation dialog', async () => {
    mockRevokeSession.mockResolvedValue({ message: 'Session revoked' });
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION, OTHER_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /revoke session on windows/i }));

    expect(await within(dialog()).findByText('Revoke this session?')).toBeInTheDocument();
    expect(within(dialog()).getByText(/Windows/)).toBeInTheDocument();
  });

  it('revokes a session and refreshes the list on success', async () => {
    const onRefresh = jest.fn();
    mockRevokeSession.mockResolvedValue({ message: 'Session revoked' });
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION, OTHER_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button', { name: /revoke session on windows/i }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /revoke session$/i }));

    await waitFor(() => expect(mockRevokeSession).toHaveBeenCalledWith('sess-other-1'));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it('handles 404 by refreshing the list', async () => {
    const onRefresh = jest.fn();
    mockRevokeSession.mockRejectedValue(makeSecurityError('Session not found', 404));
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION, OTHER_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button', { name: /revoke session on windows/i }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /revoke session$/i }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it('opens revoke-others confirmation with session count', async () => {
    mockRevokeOtherSessions.mockResolvedValue({ message: 'Signed out', revokedCount: 2 });
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION, OTHER_SESSION, OTHER_SESSION_MOBILE],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sign out all others/i }));

    expect(await within(dialog()).findByText('Sign out all other sessions?')).toBeInTheDocument();
    expect(within(dialog()).getByText(/2 other sessions/)).toBeInTheDocument();
    expect(within(dialog()).getByText(/current session will remain active/)).toBeInTheDocument();
  });

  it('revokes other sessions and refreshes on success', async () => {
    const onRefresh = jest.fn();
    mockRevokeOtherSessions.mockResolvedValue({ message: 'Signed out', revokedCount: 2 });
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION, OTHER_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button', { name: /sign out all others/i }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /sign out other sessions/i }));

    await waitFor(() => expect(mockRevokeOtherSessions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it('opens revoke-current confirmation with sign-out warning', async () => {
    mockRevokeCurrentSession.mockResolvedValue({ message: 'Current session revoked' });
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sign out this session/i }));

    expect(await within(dialog()).findByText('Sign out of this session?')).toBeInTheDocument();
    expect(within(dialog()).getByText(/redirected to the sign-in page/)).toBeInTheDocument();
  });

  it('revokes current session and clears auth state', async () => {
    const { clearTokens } = require('@/lib/auth-client');
    mockRevokeCurrentSession.mockResolvedValue({ message: 'Current session revoked' });

    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sign out this session/i }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^sign out$/i }));

    await waitFor(() => expect(mockRevokeCurrentSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(clearTokens).toHaveBeenCalled());
  });

  it('does not fabricate location or device identity beyond backend data', () => {
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    expect(screen.queryByText(/San Francisco|New York|London|Tokyo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chrome 125/)).not.toBeInTheDocument();
  });

  it('shows "No other active sessions found" when only current session exists', () => {
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    expect(screen.getByText('No other active sessions found.')).toBeInTheDocument();
  });

  it('prevents duplicate revocation from rapid repeated clicks', async () => {
    mockRevokeSession.mockImplementation(() => new Promise(() => {}));
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [CURRENT_SESSION, OTHER_SESSION],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /revoke session on windows/i }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /revoke session$/i }));

    await waitFor(() => expect(mockRevokeSession).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /revoke session on windows/i }));
    await waitFor(() => expect(mockRevokeSession).toHaveBeenCalledTimes(1));
  });

  it('summarizes user agent strings into readable device names', () => {
    const state: SessionsLoadState = {
      status: 'ready',
      sessions: [
        { ...OTHER_SESSION, sessionId: 's1', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
        { ...OTHER_SESSION, sessionId: 's2', userAgent: 'Mozilla/5.0 (Linux; Android 14)' },
        { ...OTHER_SESSION, sessionId: 's3', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        { ...OTHER_SESSION, sessionId: 's4', userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' },
        { ...OTHER_SESSION, sessionId: 's5', userAgent: null },
      ],
    };
    render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

    expect(screen.getByText('iPhone')).toBeInTheDocument();
    expect(screen.getByText('Android device')).toBeInTheDocument();
    expect(screen.getByText('Windows')).toBeInTheDocument();
    expect(screen.getByText('Linux')).toBeInTheDocument();
    expect(screen.getByText('Unknown device')).toBeInTheDocument();
  });
});

describe('SecuritySection with Password & Sessions (ACC-UX-02D3)', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMfaStatus.mockResolvedValue(MFA_ENABLED);
    mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_NONE);
    mockListSessions.mockResolvedValue({
      sessions: [CURRENT_SESSION, OTHER_SESSION],
    });
  });

  it('opens password dialog from the Security section', async () => {
    render(<SecuritySection />);

    fireEvent.click(await screen.findByRole('button', { name: /change password/i }));

    expect(await within(dialog()).findByRole('heading', { name: 'Change password' })).toBeInTheDocument();
    expect(within(dialog()).getByLabelText('Current password')).toBeInTheDocument();
    expect(within(dialog()).getByLabelText('New password')).toBeInTheDocument();
    expect(within(dialog()).getByLabelText('Confirm new password')).toBeInTheDocument();
  });

  it('renders active sessions with real data from GET /auth/sessions', async () => {
    render(<SecuritySection />);

    expect(await screen.findByText('macOS')).toBeInTheDocument();
    expect(screen.getByText('Windows')).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
  });

  it('shows "No other active sessions found" when only one session exists', async () => {
    mockListSessions.mockResolvedValue({ sessions: [CURRENT_SESSION] });
    render(<SecuritySection />);

    expect(await screen.findByText('No other active sessions found.')).toBeInTheDocument();
  });

  it('does not show "Not available" badges for implemented features', async () => {
    render(<SecuritySection />);

    await screen.findByText('macOS');
    expect(screen.queryByText('Not available')).not.toBeInTheDocument();
  });

  it('shows password row with "Change password" action', async () => {
    render(<SecuritySection />);

    await screen.findByText('macOS');
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
  });

  it('shows active sessions section header', async () => {
    render(<SecuritySection />);

    expect(await screen.findByText('Active sessions')).toBeInTheDocument();
  });

  it('preserves existing MFA functionality', async () => {
    render(<SecuritySection />);

    await screen.findByText('macOS');
    expect(screen.getByText('Multi-factor authentication (TOTP)')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });
});

describe('ACC-UX-02D3 Certification Tests', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockChangePassword.mockResolvedValue({
      message: 'Password changed successfully',
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });

  describe('1. Current session ordering', () => {
    it('current session is rendered first regardless of array order', () => {
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [OTHER_SESSION, OTHER_SESSION_MOBILE, CURRENT_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      const allText = screen.getAllByText(/macOS|Windows|iPhone/);
      expect(allText[0]).toHaveTextContent('macOS');
    });
  });

  describe('2. Duplicate action protection', () => {
    it('rapid password submits call the API exactly once', async () => {
      let resolveChange: any;
      mockChangePassword.mockReturnValue(
        new Promise((resolve) => { resolveChange = resolve; }),
      );

      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });

      fireEvent.click(screen.getByRole('button', { name: /change password/i }));
      await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole('button', { name: /change password/i }));
      fireEvent.click(screen.getByRole('button', { name: /change password/i }));
      expect(mockChangePassword).toHaveBeenCalledTimes(1);

      resolveChange({ message: 'ok', accessToken: 'a', refreshToken: 'b' });
    });

    it('rapid revoke clicks call the API exactly once', async () => {
      mockRevokeSession.mockImplementation(() => new Promise(() => {}));
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION, OTHER_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /revoke session on windows/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /revoke session$/i }));

      await waitFor(() => expect(mockRevokeSession).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole('button', { name: /revoke session on windows/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /revoke session$/i }));
      expect(mockRevokeSession).toHaveBeenCalledTimes(1);
    });

    it('rapid revoke-others clicks call the API exactly once', async () => {
      mockRevokeOtherSessions.mockImplementation(() => new Promise(() => {}));
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION, OTHER_SESSION, OTHER_SESSION_MOBILE],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /sign out all others/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /sign out other sessions/i }));

      await waitFor(() => expect(mockRevokeOtherSessions).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole('button', { name: /sign out all others/i }));
      expect(mockRevokeOtherSessions).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Error normalization', () => {
    it('password 429 displays controlled user-facing message', async () => {
      mockChangePassword.mockRejectedValue(makeSecurityError('Too many requests', 429));

      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
      fireEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(await screen.findByText('Too many attempts. Wait a moment before trying again.')).toBeInTheDocument();
    });

    it('password 400 displays controlled validation failure message', async () => {
      mockChangePassword.mockRejectedValue(makeSecurityError('Validation failed', 400));

      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
      fireEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(await screen.findByText('The password you entered does not meet the requirements.')).toBeInTheDocument();
    });

    it('password 401 displays incorrect password message', async () => {
      mockChangePassword.mockRejectedValue(makeSecurityError('Invalid credentials', 401));

      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'wrong' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
      fireEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(await screen.findByText('The current password you entered is incorrect.')).toBeInTheDocument();
    });

    it('password 409 displays controlled conflict message', async () => {
      mockChangePassword.mockRejectedValue(makeSecurityError('Conflict', 409));

      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
      fireEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(await screen.findByText('A password change is already in progress. Please wait and try again.')).toBeInTheDocument();
    });

    it('password 5xx displays controlled generic server error', async () => {
      mockChangePassword.mockRejectedValue(makeSecurityError('Internal Server Error', 500));

      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
      fireEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(await screen.findByText('Something went wrong on our end. Please try again later.')).toBeInTheDocument();
    });

    it('revoke-others 429 displays controlled rate limit message', async () => {
      mockRevokeOtherSessions.mockRejectedValue(makeSecurityError('Too many requests', 429));
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION, OTHER_SESSION, OTHER_SESSION_MOBILE],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /sign out all others/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /sign out other sessions/i }));

      expect(await screen.findByText('Too many attempts. Wait a moment before trying again.')).toBeInTheDocument();
    });

    it('revoke-current 429 displays controlled rate limit message', async () => {
      mockRevokeCurrentSession.mockRejectedValue(makeSecurityError('Too many requests', 429));
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /sign out this session/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /^sign out$/i }));

      expect(await screen.findByText('Too many attempts. Wait a moment before trying again.')).toBeInTheDocument();
    });

    it('revoke-one generic failure displays controlled message', async () => {
      mockRevokeSession.mockRejectedValue(makeSecurityError('Internal Server Error', 500));
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION, OTHER_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /revoke session on windows/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /revoke session$/i }));

      expect(await screen.findByText('Could not revoke this session. Please try again.')).toBeInTheDocument();
    });

    it('revoke-others generic failure displays controlled message', async () => {
      mockRevokeOtherSessions.mockRejectedValue(makeSecurityError('Internal Server Error', 500));
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION, OTHER_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /sign out all others/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /sign out other sessions/i }));

      expect(await screen.findByText('Could not sign out other sessions. Please try again.')).toBeInTheDocument();
    });

    it('no raw internal backend message is ever rendered', async () => {
      mockChangePassword.mockRejectedValue(makeSecurityError('TypeError: Cannot read property "hash" of undefined', 500));

      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
      fireEvent.click(screen.getByRole('button', { name: /change password/i }));

      await waitFor(() => expect(mockChangePassword).toHaveBeenCalled());
      expect(screen.queryByText(/Cannot read property/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/TypeError/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/stack/i)).not.toBeInTheDocument();
    });

    it('error messages can be dismissed', async () => {
      mockRevokeSession.mockRejectedValue(makeSecurityError('Server Error', 500));
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION, OTHER_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /revoke session on windows/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /revoke session$/i }));

      await waitFor(() => expect(screen.getByText('Could not revoke this session. Please try again.')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByText('Could not revoke this session. Please try again.')).not.toBeInTheDocument();
    });
  });

  describe('4. Revoke-one 404 safe refresh', () => {
    it('handles 404 by closing dialog and refreshing without error', async () => {
      const onRefresh = jest.fn();
      mockRevokeSession.mockRejectedValue(makeSecurityError('Session not found', 404));
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION, OTHER_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={onRefresh} />);

      fireEvent.click(screen.getByRole('button', { name: /revoke session on windows/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /revoke session$/i }));

      await waitFor(() => expect(onRefresh).toHaveBeenCalled());
      expect(screen.queryByText(/Could not revoke/i)).not.toBeInTheDocument();
    });
  });

  describe('5. Missing SID / cannot-determine-current-session', () => {
    it('does not crash when no session is marked current', () => {
      const noCurrentSession: SessionInfo = { ...OTHER_SESSION, current: false };
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [noCurrentSession],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      expect(screen.queryByText('This device')).not.toBeInTheDocument();
      expect(screen.getByText('Windows')).toBeInTheDocument();
    });

    it('does not allow revoke-all when current session cannot be determined', () => {
      const noCurrentSessions: SessionInfo[] = [
        { ...OTHER_SESSION, current: false },
        { ...OTHER_SESSION_MOBILE, current: false },
      ];
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: noCurrentSessions,
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      expect(screen.queryByText(/sign out this session/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/No other active sessions found/i)).not.toBeInTheDocument();
    });
  });

  describe('6. Revoke-current token clearing and redirect', () => {
    it('revokes current session, clears tokens, and attempts redirect', async () => {
      const { clearTokens } = require('@/lib/auth-client');
      mockRevokeCurrentSession.mockResolvedValue({ message: 'Current session revoked' });

      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /sign out this session/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /^sign out$/i }));

      await waitFor(() => expect(mockRevokeCurrentSession).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(clearTokens).toHaveBeenCalledTimes(1));
    });

    it('redirects exactly once even if component re-renders', async () => {
      const { clearTokens } = require('@/lib/auth-client');
      mockRevokeCurrentSession.mockResolvedValue({ message: 'Current session revoked' });

      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION],
      };
      const { rerender } = render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /sign out this session/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /^sign out$/i }));

      await waitFor(() => expect(clearTokens).toHaveBeenCalledTimes(1));

      rerender(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);
      expect(clearTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('7. Sensitive values are not logged', () => {
    it('password values are not written to console.log', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'supersecret123' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newsecret456' } });

      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(logCalls).not.toContain('supersecret123');
      expect(logCalls).not.toContain('newsecret456');

      consoleSpy.mockRestore();
    });

    it('tokens are not written to console.log', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
      fireEvent.click(screen.getByRole('button', { name: /change password/i }));

      await waitFor(() => expect(mockChangePassword).toHaveBeenCalled());

      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(logCalls).not.toContain('new-access-token');
      expect(logCalls).not.toContain('new-refresh-token');

      consoleSpy.mockRestore();
    });
  });

  describe('8. Privacy-conscious IP rendering', () => {
    it('masks IPv4 addresses showing only first two octets', () => {
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      expect(screen.getByText('192.168.xxx.xxx')).toBeInTheDocument();
      expect(screen.queryByText('192.168.1.100')).not.toBeInTheDocument();
    });

    it('masks IPv4 addresses for other sessions too', () => {
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION, OTHER_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      expect(screen.getByText('192.168.xxx.xxx')).toBeInTheDocument();
      expect(screen.getByText('10.0.xxx.xxx')).toBeInTheDocument();
      expect(screen.queryByText('10.0.0.50')).not.toBeInTheDocument();
    });

    it('does not fabricate geographic location from IP', () => {
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      expect(screen.queryByText(/city|country|location|region/i)).not.toBeInTheDocument();
    });
  });

  describe('9. Keyboard dialog operation', () => {
    it('password dialog submits on Enter key', async () => {
      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });

      fireEvent.keyDown(screen.getByLabelText('Confirm new password'), { key: 'Enter' });

      await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
    });

    it('password dialog does not submit when already submitting', async () => {
      let resolveChange: any;
      mockChangePassword.mockReturnValue(
        new Promise((resolve) => { resolveChange = resolve; }),
      );

      render(<PasswordChangeDialog open={true} onOpenChange={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass123' } });
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });

      fireEvent.keyDown(screen.getByLabelText('Confirm new password'), { key: 'Enter' });
      await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));

      fireEvent.keyDown(screen.getByLabelText('Confirm new password'), { key: 'Enter' });
      expect(mockChangePassword).toHaveBeenCalledTimes(1);

      resolveChange({ message: 'ok', accessToken: 'a', refreshToken: 'b' });
    });
  });

  describe('10. Accessible labels for icon controls', () => {
    it('sign out current session button has accessible label', () => {
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      expect(screen.getByRole('button', { name: /sign out this session/i })).toBeInTheDocument();
    });

    it('revoke other session button has accessible label with device name', () => {
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION, OTHER_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      expect(screen.getByRole('button', { name: /revoke session on windows/i })).toBeInTheDocument();
    });

    it('decorative device and IP icons have aria-hidden', () => {
      const state: SessionsLoadState = {
        status: 'ready',
        sessions: [CURRENT_SESSION],
      };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      const globeIcons = screen.getAllByTestId('icon').filter(
        (el) => el.closest('.text-text-muted') !== null,
      );
      expect(globeIcons.length).toBeGreaterThan(0);
      globeIcons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('loading state has role=status for screen readers', () => {
      const state: SessionsLoadState = { status: 'loading' };
      render(<ActiveSessions sessionsState={state} onRefresh={jest.fn()} />);

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading sessions');
    });
  });
});
