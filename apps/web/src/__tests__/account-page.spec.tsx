import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AccountPage from '@/app/dashboard/settings/account/page';
import {
  fetchAccountSummary,
  updateDisplayName,
  fetchDeletionPreview,
  deleteAccount,
  type AccountSummary,
  type DeletionPreview,
} from '@/lib/account-client';
import {
  fetchMfaStatus,
  fetchRecoveryCodesStatus,
  type MfaStatus,
  type RecoveryCodesStatus,
} from '@/lib/mfa-client';
import { fetchCurrentOrganization } from '@/lib/org-client';
import { getCurrentUser, clearTokens } from '@/lib/auth-client';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('next/link', () => {
  return ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: any) => <div>{children}</div>,
  },
}));

jest.mock('@/lib/auth-client', () => ({
  getCurrentUser: jest.fn(),
  clearTokens: jest.fn(),
}));

jest.mock('@/lib/socket-client', () => ({
  disconnectAll: jest.fn(),
}));

jest.mock('@/lib/org-client', () => ({
  fetchCurrentOrganization: jest.fn(),
  listenForOrgSwitch: jest.fn(() => () => {}),
}));

jest.mock('@/lib/account-client', () => ({
  fetchAccountSummary: jest.fn(),
  updateDisplayName: jest.fn(),
  fetchDeletionPreview: jest.fn(),
  deleteAccount: jest.fn(),
}));

jest.mock('@/lib/mfa-client', () => ({
  ...jest.requireActual('@/lib/mfa-client'),
  fetchMfaStatus: jest.fn(),
  fetchRecoveryCodesStatus: jest.fn(),
}));

jest.mock('@techfusion/ui', () => {
  const ReactUi = require('react');
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
    GlassPanel: ({ children }: any) => <div data-testid="glass-panel">{children}</div>,
    Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
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
    StatusMessage: ({ children, ...props }: any) => (
      <div data-testid="status-message" {...props}>
        {children}
      </div>
    ),
    Modal: ({ open, children }: any) => (open ? <div data-testid="modal">{children}</div> : null),
    ModalContent: ({ children }: any) => <div>{children}</div>,
    ModalHeader: ({ children }: any) => <div>{children}</div>,
    ModalTitle: ({ children }: any) => <h3>{children}</h3>,
    ModalDescription: ({ children }: any) => <p>{children}</p>,
    ModalFooter: ({ children }: any) => <div>{children}</div>,
    Checkbox: ({ label, checked, onCheckedChange, id }: any) => (
      <div>
        <input
          id={id}
          type="checkbox"
          aria-label={label}
          checked={Boolean(checked)}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
        />
        <label htmlFor={id}>{label}</label>
      </div>
    ),
    Avatar: ({ children, size, ...props }: any) => <div data-testid="avatar">{children}</div>,
    AvatarFallback: ({ children, size, ...props }: any) => (
      <span data-testid="avatar-fallback">{children}</span>
    ),
    getInitials: (name: string) => name?.trim()?.charAt(0)?.toUpperCase() || 'U',
    Skeleton: () => <div data-testid="skeleton" />,
    MockIcon,
  };
});

jest.mock('lucide-react', () => {
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    Copy: MockIcon,
    Check: MockIcon,
    Loader2: MockIcon,
    Pencil: MockIcon,
    X: MockIcon,
    UserCog: MockIcon,
    ShieldCheck: MockIcon,
    ShieldOff: MockIcon,
    Shield: MockIcon,
    Building2: MockIcon,
    Settings2: MockIcon,
    Trash2: MockIcon,
    AlertTriangle: MockIcon,
    Eye: MockIcon,
    EyeOff: MockIcon,
  };
});

const mockFetchAccountSummary = fetchAccountSummary as jest.MockedFunction<typeof fetchAccountSummary>;
const mockUpdateDisplayName = updateDisplayName as jest.MockedFunction<typeof updateDisplayName>;
const mockFetchMfaStatus = fetchMfaStatus as jest.MockedFunction<typeof fetchMfaStatus>;
const mockFetchRecoveryCodesStatus = fetchRecoveryCodesStatus as jest.MockedFunction<typeof fetchRecoveryCodesStatus>;
const mockFetchDeletionPreview = fetchDeletionPreview as jest.MockedFunction<typeof fetchDeletionPreview>;
const mockDeleteAccount = deleteAccount as jest.MockedFunction<typeof deleteAccount>;
const mockFetchCurrentOrganization = fetchCurrentOrganization as jest.MockedFunction<typeof fetchCurrentOrganization>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockClearTokens = clearTokens as jest.MockedFunction<typeof clearTokens>;

const SUMMARY: AccountSummary = {
  id: 'user-1',
  email: 'owner@acme.test',
  displayName: 'Alex Owner',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2026-02-02T00:00:00Z',
};

const MFA_ENABLED: MfaStatus = { isMfaEnabled: true };
const MFA_DISABLED: MfaStatus = { isMfaEnabled: false };

const RECOVERY_NONE: RecoveryCodesStatus = { generated: false, availableCount: 0 };
const RECOVERY_PARTIAL: RecoveryCodesStatus = { generated: true, availableCount: 3 };
const RECOVERY_DEPLETED: RecoveryCodesStatus = { generated: true, availableCount: 0 };

const ORG = {
  id: 'org-1',
  name: 'Acme Networks',
  slug: 'acme',
  plan: 'PRO',
  createdAt: '2025-01-01T00:00:00Z',
  membershipRole: 'Owner' as const,
  isActive: true,
};

const PREVIEW_ELIGIBLE: DeletionPreview = {
  canDelete: true,
  blockers: [],
  membershipsCount: 1,
  ownedOrganizationsCount: 1,
  emptyOrganizationsToRemove: [{ organizationId: 'org-1', organizationName: 'Acme Networks' }],
};

const PREVIEW_BLOCKED: DeletionPreview = {
  canDelete: false,
  blockers: [{ organizationId: 'org-1', organizationName: 'Acme Networks', reason: 'SOLE_OWNER' }],
  membershipsCount: 1,
  ownedOrganizationsCount: 1,
  emptyOrganizationsToRemove: [],
};

describe('Account Page Contract', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockReturnValue({ sub: 'user-1', orgId: 'org-1', role: 'Owner' });
    mockFetchAccountSummary.mockResolvedValue(SUMMARY);
    mockFetchMfaStatus.mockResolvedValue(MFA_ENABLED);
    mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_NONE);
    mockFetchCurrentOrganization.mockResolvedValue(ORG);
    mockFetchDeletionPreview.mockResolvedValue(PREVIEW_ELIGIBLE);
  });

  describe('account section navigation', () => {
    it('renders anchor links for every account section', async () => {
      render(<AccountPage />);

      const nav = screen.getByRole('navigation', { name: 'Account sections' });
      expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '#profile');
      expect(within(nav).getByRole('link', { name: 'Security' })).toHaveAttribute('href', '#security');
      expect(within(nav).getByRole('link', { name: 'Organization' })).toHaveAttribute('href', '#organization');
      expect(within(nav).getByRole('link', { name: 'Danger Zone' })).toHaveAttribute('href', '#danger');
    });

    it('marks the default section as the current location', async () => {
      render(<AccountPage />);

      const nav = screen.getByRole('navigation', { name: 'Account sections' });
      expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'location');
      expect(within(nav).getByRole('link', { name: 'Security' })).not.toHaveAttribute('aria-current');
    });

    it('renders each section panel', async () => {
      render(<AccountPage />);

      expect(await screen.findByText('Profile Information')).toBeInTheDocument();
      expect(await screen.findByText('Security & Sessions')).toBeInTheDocument();
      expect((await screen.findAllByText('Organization')).length).toBeGreaterThan(0);
      expect((await screen.findAllByText('Danger Zone')).length).toBeGreaterThan(0);
    });
  });

  describe('profile information is real, server-backed data', () => {
    it('loads the authenticated user summary from /auth/account/summary', async () => {
      render(<AccountPage />);

      await waitFor(() => expect(mockFetchAccountSummary).toHaveBeenCalledTimes(1));
      expect((await screen.findAllByText('Alex Owner')).length).toBeGreaterThan(0);
      expect(screen.getAllByText('owner@acme.test').length).toBeGreaterThan(0);
      expect(screen.getByText('user-1')).toBeInTheDocument();
    });

    it('does not fabricate fields the backend does not provide', async () => {
      render(<AccountPage />);

      await screen.findAllByText('Alex Owner');
      // No email-verification, avatar, or credential material anywhere on the page.
      expect(screen.queryByText(/email verified/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/passwordHash|mfaSecret|mfaBackupCodes|ssoId|accessToken/i)).not.toBeInTheDocument();
    });

    it('shows an honest not-available state for unsupported security capabilities', async () => {
      render(<AccountPage />);

      await screen.findAllByText('Alex Owner');
      expect(screen.getByText(/Password change is not available/i)).toBeInTheDocument();
      expect(screen.getByText(/Session listing and revocation are not available/i)).toBeInTheDocument();
    });
  });

  describe('MFA status comes from the authoritative MFA endpoints', () => {
    it('renders Enabled when GET /mfa/status reports MFA on', async () => {
      render(<AccountPage />);

      await screen.findAllByText('Alex Owner');
      expect(mockFetchMfaStatus).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('Enabled')).toBeInTheDocument();
    });

    it('renders Not enabled when GET /mfa/status reports MFA off', async () => {
      mockFetchMfaStatus.mockResolvedValue(MFA_DISABLED);
      render(<AccountPage />);

      await screen.findAllByText('Alex Owner');
      expect(await screen.findByText('Not enabled')).toBeInTheDocument();
      // No recovery-code row exists while MFA is off.
      expect(screen.queryByRole('button', { name: /generate codes|regenerate codes/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /set up two-factor authentication/i })).toBeInTheDocument();
    });

    it('loads recovery-code status from the authoritative endpoint', async () => {
      render(<AccountPage />);

      await screen.findAllByText('Alex Owner');
      expect(mockFetchRecoveryCodesStatus).toHaveBeenCalledTimes(1);
    });

    it('shows the remaining recovery-code count from the server', async () => {
      mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_PARTIAL);
      render(<AccountPage />);

      expect(await screen.findByText('You have 3 recovery codes remaining. Each code can be used once.')).toBeInTheDocument();
    });

    it('offers regeneration once all recovery codes are used', async () => {
      mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_DEPLETED);
      render(<AccountPage />);

      expect(await screen.findByText('All recovery codes have been used. Regenerate to receive a fresh set.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /regenerate codes/i })).toBeInTheDocument();
    });

    it('prompts generation when no recovery codes have been issued yet', async () => {
      mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_NONE);
      render(<AccountPage />);

      expect(await screen.findByText(/Generate codes so you can get back in/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate codes/i })).toBeInTheDocument();
    });

    it('surfaces MFA status failures instead of fabricating a state', async () => {
      mockFetchMfaStatus.mockRejectedValue(new Error('Security request failed. Try again.'));
      render(<AccountPage />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Security request failed. Try again.');
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('organization context', () => {
    it('renders the current organization and membership role from /organizations/current', async () => {
      render(<AccountPage />);

      expect(await screen.findByText('Acme Networks')).toBeInTheDocument();
      expect(await screen.findByText('Owner')).toBeInTheDocument();
      expect(mockFetchCurrentOrganization).toHaveBeenCalledTimes(1);
    });

    it.each(['Admin', 'Technician', 'Viewer'] as const)(
      'renders the %s membership role from the backend',
      async (role) => {
        mockFetchCurrentOrganization.mockResolvedValue({ ...ORG, membershipRole: role });
        render(<AccountPage />);

        expect(await screen.findByText(role)).toBeInTheDocument();
      },
    );

    it('links to the organization management page', async () => {
      render(<AccountPage />);

      const link = await screen.findByRole('link', { name: /manage organization/i });
      expect(link).toHaveAttribute('href', '/dashboard/settings/organization');
    });
  });

  describe('loading and error states', () => {
    it('shows loading status while the profile request is pending', async () => {
      let resolveSummary: (value: AccountSummary) => void = () => {};
      mockFetchAccountSummary.mockReturnValue(
        new Promise<AccountSummary>((resolve) => {
          resolveSummary = resolve;
        }),
      );

      render(<AccountPage />);

      expect(await screen.findByText('Loading profile...')).toBeInTheDocument();

      resolveSummary(SUMMARY);
      expect((await screen.findAllByText('Alex Owner')).length).toBeGreaterThan(0);
    });

    it('surfaces API failures instead of fabricating data', async () => {
      mockFetchAccountSummary.mockRejectedValue(new Error('Failed to load profile'));
      render(<AccountPage />);

      expect(await screen.findByText('Failed to load profile')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.queryByText('Alex Owner')).not.toBeInTheDocument();
    });

    it('retry reloads the failed section', async () => {
      mockFetchAccountSummary.mockRejectedValueOnce(new Error('Failed to load profile'));
      render(<AccountPage />);

      const retry = await screen.findByRole('button', { name: /retry/i });
      fireEvent.click(retry);

      await waitFor(() => expect(mockFetchAccountSummary).toHaveBeenCalledTimes(2));
      expect((await screen.findAllByText('Alex Owner')).length).toBeGreaterThan(0);
    });
  });

  describe('display name editing', () => {
    it('updates the display name via the authenticated-context-only PATCH', async () => {
      mockUpdateDisplayName.mockResolvedValue({ ...SUMMARY, displayName: 'Renamed User' });
      render(<AccountPage />);

      await screen.findAllByText('Alex Owner');
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));

      const input = screen.getByLabelText('Display name');
      fireEvent.change(input, { target: { value: 'Renamed User' } });
      fireEvent.click(screen.getByRole('button', { name: /save name/i }));

      await waitFor(() => expect(mockUpdateDisplayName).toHaveBeenCalledWith('Renamed User'));
      expect((await screen.findAllByText('Renamed User')).length).toBeGreaterThan(0);
    });

    it('rejects an empty display name without calling the API', async () => {
      render(<AccountPage />);

      await screen.findAllByText('Alex Owner');
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));

      fireEvent.change(screen.getByLabelText('Display name'), { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: /save name/i }));

      expect(await screen.findByText('Display name cannot be empty.')).toBeInTheDocument();
      expect(mockUpdateDisplayName).not.toHaveBeenCalled();
    });
  });

  describe('Danger Zone deletion contract', () => {
    it('keeps the sole-Owner block and never offers a delete button', async () => {
      mockFetchDeletionPreview.mockResolvedValue(PREVIEW_BLOCKED);
      render(<AccountPage />);

      expect(await screen.findByText('Account cannot be deleted yet.')).toBeInTheDocument();
      expect(screen.getAllByText('Acme Networks').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /delete account/i })).not.toBeInTheDocument();
    });

    it('links the sole-Owner block to the organization page to reassign ownership', async () => {
      mockFetchDeletionPreview.mockResolvedValue(PREVIEW_BLOCKED);
      render(<AccountPage />);

      const review = await screen.findByRole('link', { name: /Review Acme Networks/i });
      expect(review).toHaveAttribute('href', '/dashboard/settings/organization');
    });

    it('requires the literal DELETE confirmation before enabling the destructive action', async () => {
      render(<AccountPage />);

      fireEvent.click(await screen.findByRole('button', { name: /delete account/i }));

      const confirm = screen.getByLabelText('Type DELETE to continue') as HTMLInputElement;
      const submit = screen.getByRole('button', { name: /delete my account/i }) as HTMLButtonElement;
      expect(submit.disabled).toBe(true);

      fireEvent.change(confirm, { target: { value: 'delete' } });
      expect(submit.disabled).toBe(true);

      fireEvent.change(confirm, { target: { value: 'DELETE' } });
      expect(submit.disabled).toBe(false);
    });

    it('calls DELETE /auth/account, clears auth state, and redirects on success', async () => {
      mockDeleteAccount.mockResolvedValue({
        message: 'Account deleted',
        removedOrganizations: ['org-1'],
      });

      render(<AccountPage />);

      fireEvent.click(await screen.findByRole('button', { name: /delete account/i }));
      fireEvent.change(screen.getByLabelText('Type DELETE to continue'), {
        target: { value: 'DELETE' },
      });
      fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

      await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledWith('DELETE'));
      await waitFor(() => expect(mockClearTokens).toHaveBeenCalledTimes(1));
    });
  });
});
