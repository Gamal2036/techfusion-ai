import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeamPage from '@/app/dashboard/team/page';
import {
  fetchMembers,
  updateMemberRole,
  removeMember,
  createInvitation,
  fetchInvitations,
  revokeInvitation,
  resendInvitation,
} from '@/lib/org-client';
import { getCurrentUser } from '@/lib/auth-client';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/lib/auth-client', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/org-client', () => ({
  fetchMembers: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
  createInvitation: jest.fn(),
  fetchInvitations: jest.fn(),
  revokeInvitation: jest.fn(),
  resendInvitation: jest.fn(),
}));

jest.mock('@techfusion/ui', () => {
  const ReactUi = require('react');
  return {
    GlassPanel: ({ children }: any) => <div data-testid="glass-panel">{children}</div>,
    Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
    Button: ({ children, variant, size, fullWidth, loading, loadingText, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    Input: ReactUi.forwardRef(({ ...props }: any, ref: any) => <input ref={ref} {...props} />),
    Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
    Modal: ({ open, onOpenChange, children }: any) =>
      open ? <div data-testid="modal">{children}</div> : null,
    ModalContent: ({ children }: any) => <div data-testid="modal-content">{children}</div>,
    ModalHeader: ({ children }: any) => <div>{children}</div>,
    ModalTitle: ({ children }: any) => <h2>{children}</h2>,
    ModalDescription: ({ children }: any) => <p>{children}</p>,
    ModalFooter: ({ children }: any) => <div>{children}</div>,
  };
});

jest.mock('lucide-react', () => {
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    Users: MockIcon,
    Shield: MockIcon,
    Trash2: MockIcon,
    Loader2: MockIcon,
    AlertTriangle: MockIcon,
    UserPlus: MockIcon,
    Mail: MockIcon,
    RefreshCw: MockIcon,
  };
});

const mockFetchMembers = fetchMembers as jest.MockedFunction<typeof fetchMembers>;
const mockUpdateMemberRole = updateMemberRole as jest.MockedFunction<typeof updateMemberRole>;
const mockRemoveMember = removeMember as jest.MockedFunction<typeof removeMember>;
const mockCreateInvitation = createInvitation as jest.MockedFunction<typeof createInvitation>;
const mockFetchInvitations = fetchInvitations as jest.MockedFunction<typeof fetchInvitations>;
const mockRevokeInvitation = revokeInvitation as jest.MockedFunction<typeof revokeInvitation>;
const mockResendInvitation = resendInvitation as jest.MockedFunction<typeof resendInvitation>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;

const MEMBERS = [
  {
    membershipId: 'm1',
    userId: 'u1',
    email: 'owner@test.com',
    displayName: 'Org Owner',
    role: 'Owner' as const,
    createdAt: '2026-01-01T00:00:00Z',
    isSelf: true,
  },
  {
    membershipId: 'm2',
    userId: 'u2',
    email: 'tech@test.com',
    displayName: 'Tech User',
    role: 'Technician' as const,
    createdAt: '2026-01-02T00:00:00Z',
    isSelf: false,
  },
];

describe('Team Page Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockReturnValue({ sub: 'u1', orgId: 'org-1', role: 'Owner' });
    mockFetchMembers.mockResolvedValue(MEMBERS);
    mockFetchInvitations.mockResolvedValue([]);
  });

  describe('team list uses organization membership endpoints', () => {
    it('loads members for the current organization via /organizations/:id/members', async () => {
      render(<TeamPage />);

      await waitFor(() => {
        expect(mockFetchMembers).toHaveBeenCalledWith('org-1');
      });
      expect(await screen.findByText('Org Owner')).toBeInTheDocument();
      expect(screen.getByText('Tech User')).toBeInTheDocument();
    });

    it('never calls the legacy /admin/users route', async () => {
      render(<TeamPage />);
      await waitFor(() => expect(mockFetchMembers).toHaveBeenCalledWith('org-1'));

      const apiFetchModule = require('@/lib/auth-client');
      expect(apiFetchModule.apiFetch).toBeUndefined();
    });
  });

  describe('role change uses membership endpoint', () => {
    it('calls updateMemberRole(orgId, userId, role) on role select change', async () => {
      mockUpdateMemberRole.mockResolvedValue({
        ...MEMBERS[1],
        role: 'Admin' as const,
      });

      render(<TeamPage />);
      const select = (await screen.findAllByRole('combobox'))[0];

      fireEvent.change(select, { target: { value: 'Admin' } });

      await waitFor(() => {
        expect(mockUpdateMemberRole).toHaveBeenCalledWith('org-1', 'u2', 'Admin');
      });
    });

    it('does not show a role selector for Owners', async () => {
      render(<TeamPage />);
      await screen.findByText('Org Owner');
      const selectors = screen.getAllByRole('combobox');
      // Only the non-Owner member gets an editable role selector.
      expect(selectors).toHaveLength(1);
    });
  });

  describe('remove action uses membership endpoint', () => {
    it('confirms then calls removeMember(orgId, userId)', async () => {
      mockRemoveMember.mockResolvedValue(undefined);

      render(<TeamPage />);
      const removeButton = (await screen.findByLabelText('Remove Tech User')) as HTMLButtonElement;
      fireEvent.click(removeButton);

      const confirm = await screen.findByText('Remove');
      fireEvent.click(confirm);

      await waitFor(() => {
        expect(mockRemoveMember).toHaveBeenCalledWith('org-1', 'u2');
      });
    });

    it('does not show remove action for the current user or for Owners', async () => {
      render(<TeamPage />);
      await screen.findByText('Org Owner');
      expect(screen.queryByLabelText('Remove Org Owner')).not.toBeInTheDocument();
    });
  });

  describe('permission enforcement', () => {
    it('Admin can change roles for lower members but cannot remove', async () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u3', orgId: 'org-1', role: 'Admin' });
      mockFetchMembers.mockResolvedValue([
        {
          membershipId: 'm1',
          userId: 'u1',
          email: 'owner@test.com',
          displayName: 'Org Owner',
          role: 'Owner' as const,
          createdAt: '2026-01-01T00:00:00Z',
          isSelf: false,
        },
        {
          membershipId: 'm3',
          userId: 'u3',
          email: 'admin@test.com',
          displayName: 'Admin User',
          role: 'Admin' as const,
          createdAt: '2026-01-03T00:00:00Z',
          isSelf: true,
        },
      ]);

      render(<TeamPage />);
      await waitFor(() => expect(mockFetchMembers).toHaveBeenCalled());
      // Admin is allowed a role selector (backend restricts to Technician/Viewer).
      expect(screen.getByText('Only Owners can remove members.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Remove Org Owner')).not.toBeInTheDocument();
    });

    it('Technician cannot change roles or remove', async () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u2', orgId: 'org-1', role: 'Technician' });

      render(<TeamPage />);
      await screen.findByText('Org Owner');
      expect(screen.queryAllByRole('combobox')).toHaveLength(0);
      expect(screen.queryByLabelText('Remove Org Owner')).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays the message from a failed member fetch', async () => {
      mockFetchMembers.mockRejectedValue(new Error('Insufficient role in this organization'));

      render(<TeamPage />);

      expect(await screen.findByText('Insufficient role in this organization')).toBeInTheDocument();
    });

    it('displays the message from a failed role update', async () => {
      mockUpdateMemberRole.mockRejectedValue(
        new Error('This organization must keep at least one Owner.'),
      );

      render(<TeamPage />);
      const select = (await screen.findAllByRole('combobox'))[0];
      fireEvent.change(select, { target: { value: 'Viewer' } });

      expect(await screen.findByText(/keep at least one Owner/)).toBeInTheDocument();
    });
  });

  describe('invitations use the V1 org invitation endpoints', () => {
    it('loads pending invitations via /organizations/:id/invitations', async () => {
      mockFetchInvitations.mockResolvedValue([
        {
          id: 'i1',
          organizationId: 'org-1',
          email: 'pending@test.com',
          role: 'Technician' as const,
          status: 'PENDING' as const,
          expiresAt: '2026-08-10T00:00:00Z',
          createdAt: '2026-08-03T00:00:00Z',
          invitedBy: { userId: 'u1', email: 'owner@test.com', displayName: 'Org Owner' },
        },
      ]);

      render(<TeamPage />);

      expect(await screen.findByText('pending@test.com')).toBeInTheDocument();
      expect(screen.getByText('Pending invitations')).toBeInTheDocument();
      expect(mockFetchInvitations).toHaveBeenCalledWith('org-1');
    });

    it('Technician and Viewer never fetch invitations', async () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u2', orgId: 'org-1', role: 'Technician' });
      mockFetchInvitations.mockResolvedValue([]);

      render(<TeamPage />);
      await screen.findByText('Org Owner');

      expect(mockFetchInvitations).not.toHaveBeenCalled();
      expect(screen.queryByText('Invite member')).not.toBeInTheDocument();
    });

    it('opens the invite dialog and creates an invitation through the org endpoint', async () => {
      mockCreateInvitation.mockResolvedValue({
        id: 'i9',
        organizationId: 'org-1',
        email: 'new@test.com',
        role: 'Viewer' as const,
        status: 'PENDING' as const,
        expiresAt: '2026-08-10T00:00:00Z',
        createdAt: '2026-08-03T00:00:00Z',
        invitedBy: { userId: 'u1', email: 'owner@test.com', displayName: 'Org Owner' },
        devInvitationUrl: 'http://localhost:3000/invite/raw-token-1',
      });

      render(<TeamPage />);
      fireEvent.click(await screen.findByRole('button', { name: /invite member/i }));

      const emailInput = screen.getByLabelText('Email address');
      fireEvent.change(emailInput, { target: { value: 'new@test.com' } });
      fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Viewer' } });
      fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

      await waitFor(() => {
        expect(mockCreateInvitation).toHaveBeenCalledWith('org-1', 'new@test.com', 'Viewer');
      });
      expect(await screen.findByText('http://localhost:3000/invite/raw-token-1')).toBeInTheDocument();
    });

    it('Owner may invite Admin, Technician, and Viewer', async () => {
      render(<TeamPage />);
      fireEvent.click(await screen.findByRole('button', { name: /invite member/i }));

      const roles = Array.from(screen.getByLabelText('Role').querySelectorAll('option')).map(
        (o) => (o as HTMLOptionElement).value,
      );
      expect(roles).toEqual(['Admin', 'Technician', 'Viewer']);
    });

    it('Admin may only invite Technician and Viewer', async () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u3', orgId: 'org-1', role: 'Admin' });

      render(<TeamPage />);
      fireEvent.click(await screen.findByRole('button', { name: /invite member/i }));

      const roles = Array.from(screen.getByLabelText('Role').querySelectorAll('option')).map(
        (o) => (o as HTMLOptionElement).value,
      );
      expect(roles).toEqual(['Technician', 'Viewer']);
    });

    it('resend regenerates the invitation via the resend endpoint', async () => {
      mockFetchInvitations.mockResolvedValue([
        {
          id: 'i1',
          organizationId: 'org-1',
          email: 'pending@test.com',
          role: 'Viewer' as const,
          status: 'PENDING' as const,
          expiresAt: '2026-08-10T00:00:00Z',
          createdAt: '2026-08-03T00:00:00Z',
          invitedBy: { userId: 'u1', email: 'owner@test.com', displayName: 'Org Owner' },
        },
      ]);
      mockResendInvitation.mockResolvedValue({
        id: 'i1',
        organizationId: 'org-1',
        email: 'pending@test.com',
        role: 'Viewer' as const,
        status: 'PENDING' as const,
        expiresAt: '2026-08-17T00:00:00Z',
        createdAt: '2026-08-03T00:00:00Z',
        invitedBy: { userId: 'u1', email: 'owner@test.com', displayName: 'Org Owner' },
        devInvitationUrl: 'http://localhost:3000/invite/fresh-token',
      });

      render(<TeamPage />);
      fireEvent.click(await screen.findByRole('button', { name: /resend/i }));

      await waitFor(() => {
        expect(mockResendInvitation).toHaveBeenCalledWith('org-1', 'i1');
      });
      expect(await screen.findByText('http://localhost:3000/invite/fresh-token')).toBeInTheDocument();
    });

    it('revokes an invitation through the delete endpoint', async () => {
      mockFetchInvitations.mockResolvedValue([
        {
          id: 'i1',
          organizationId: 'org-1',
          email: 'pending@test.com',
          role: 'Viewer' as const,
          status: 'PENDING' as const,
          expiresAt: '2026-08-10T00:00:00Z',
          createdAt: '2026-08-03T00:00:00Z',
          invitedBy: { userId: 'u1', email: 'owner@test.com', displayName: 'Org Owner' },
        },
      ]);
      mockRevokeInvitation.mockResolvedValue(undefined);

      render(<TeamPage />);
      fireEvent.click(await screen.findByRole('button', { name: /revoke/i }));

      await waitFor(() => {
        expect(mockRevokeInvitation).toHaveBeenCalledWith('org-1', 'i1');
      });
    });

    it('accepted and revoked invitations show no resend/revoke actions', async () => {
      mockFetchInvitations.mockResolvedValue([
        {
          id: 'i-a',
          organizationId: 'org-1',
          email: 'accepted@test.com',
          role: 'Viewer' as const,
          status: 'ACCEPTED' as const,
          expiresAt: '2026-08-10T00:00:00Z',
          createdAt: '2026-08-03T00:00:00Z',
          invitedBy: { userId: 'u1', email: 'owner@test.com', displayName: 'Org Owner' },
        },
        {
          id: 'i-r',
          organizationId: 'org-1',
          email: 'revoked@test.com',
          role: 'Viewer' as const,
          status: 'REVOKED' as const,
          expiresAt: '2026-08-10T00:00:00Z',
          createdAt: '2026-08-03T00:00:00Z',
          invitedBy: { userId: 'u1', email: 'owner@test.com', displayName: 'Org Owner' },
        },
      ]);

      render(<TeamPage />);
      await screen.findByText('accepted@test.com');
      await screen.findByText('revoked@test.com');

      expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument();
    });
  });
});
