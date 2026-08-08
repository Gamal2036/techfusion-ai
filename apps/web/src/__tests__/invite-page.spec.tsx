import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvitePage from '@/app/invite/[token]/page';
import {
  acceptInvitation,
  inspectInvitation,
  switchToOrganization,
} from '@/lib/org-client';
import { isAuthenticated } from '@/lib/auth-client';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ token: 'raw-invite-token' }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('@/lib/org-client', () => ({
  inspectInvitation: jest.fn(),
  acceptInvitation: jest.fn(),
  switchToOrganization: jest.fn(),
}));

jest.mock('@/lib/auth-client', () => ({
  isAuthenticated: jest.fn(),
}));

jest.mock('@techfusion/ui', () => {
  const ReactUi = require('react');
  return {
    Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    Button: ReactUi.forwardRef(
      (
        {
          children,
          loading,
          loadingText,
          disabled,
          fullWidth,
          variant,
          size,
          ...props
        }: any,
        ref: any,
      ) => (
        <button ref={ref} disabled={disabled || loading} {...props}>
          {loading ? loadingText || children : children}
        </button>
      ),
    ),
  };
});

jest.mock('lucide-react', () => {
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    Building2: MockIcon,
    CircleAlert: MockIcon,
    Clock: MockIcon,
    Loader2: MockIcon,
    Mail: MockIcon,
    Shield: MockIcon,
  };
});

const mockInspect = inspectInvitation as jest.MockedFunction<typeof inspectInvitation>;
const mockAccept = acceptInvitation as jest.MockedFunction<typeof acceptInvitation>;
const mockSwitch = switchToOrganization as jest.MockedFunction<typeof switchToOrganization>;
const mockIsAuthenticated = isAuthenticated as jest.MockedFunction<typeof isAuthenticated>;

const PENDING = {
  organization: { id: 'org-1', name: 'Acme Corp' },
  role: 'Technician' as const,
  email: 'a***@test.com',
  status: 'PENDING' as const,
  expiresAt: '2026-08-10T00:00:00Z',
};

const ACCEPT_RESULT = {
  organization: { id: 'org-1', name: 'Acme Corp', slug: 'acme-corp' },
  membership: { id: 'mem-1', userId: 'u1', orgId: 'org-1', role: 'Technician' as const },
};

describe('Invite page contract (V1-TEAM-01)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    mockInspect.mockResolvedValue(PENDING);
    mockIsAuthenticated.mockReturnValue(false);
  });

  it('shows safe invitation metadata for a valid token', async () => {
    render(<InvitePage />);

    expect(await screen.findByText(/You're invited to Acme Corp/i)).toBeInTheDocument();
    expect(screen.getByText('Technician')).toBeInTheDocument();
    expect(screen.getByText('a***@test.com')).toBeInTheDocument();
    expect(screen.queryByText('raw-invite-token')).not.toBeInTheDocument();
  });

  it('shows a sign-in continuation for unauthenticated users preserving the token', async () => {
    render(<InvitePage />);

    const signIn = await screen.findByRole('button', { name: /sign in to accept/i });
    await userEvent.click(signIn);

    expect(mockPush).toHaveBeenCalledWith('/login?next=%2Finvite%2Fraw-invite-token');
    const createLink = screen.getByRole('link', { name: /create account/i });
    expect(createLink).toHaveAttribute('href', '/signup?next=%2Finvite%2Fraw-invite-token');
  });

  it('authenticated users can accept the invitation and land on the joined org', async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockAccept.mockResolvedValue(ACCEPT_RESULT);
    mockSwitch.mockResolvedValue({
      user: { id: 'u1', email: 'a@test.com', displayName: 'A', role: 'Technician', orgId: 'org-1' },
      accessToken: 'at',
      refreshToken: 'rt',
    });

    render(<InvitePage />);

    const accept = await screen.findByRole('button', { name: /accept invitation/i });
    await userEvent.click(accept);

    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith('raw-invite-token'));
    await waitFor(() => expect(mockSwitch).toHaveBeenCalledWith('org-1'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows the acceptance error without redirecting', async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockAccept.mockRejectedValue(new Error('This invitation is for a different email address'));

    render(<InvitePage />);

    const accept = await screen.findByRole('button', { name: /accept invitation/i });
    await userEvent.click(accept);

    expect(
      await screen.findByText('This invitation is for a different email address'),
    ).toBeInTheDocument();
    expect(mockSwitch).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles expired, revoked, and unknown invitations gracefully', async () => {
    mockInspect.mockRejectedValue(new Error('Invitation not found or expired'));

    render(<InvitePage />);

    expect(
      await screen.findByText(/This invitation is no longer available/i),
    ).toBeInTheDocument();
  });

  it('treats a non-PENDING inspection as unavailable', async () => {
    mockInspect.mockResolvedValue({
      organization: { id: 'org-1', name: 'Acme Corp' },
      role: 'Viewer',
      email: 'a***@test.com',
      status: 'REVOKED' as const,
      expiresAt: '2026-08-10T00:00:00Z',
    });

    render(<InvitePage />);

    expect(
      await screen.findByText(/This invitation is no longer available/i),
    ).toBeInTheDocument();
  });
});
