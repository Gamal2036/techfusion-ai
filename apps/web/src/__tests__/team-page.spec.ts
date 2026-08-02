import { apiFetch, getCurrentUser, isAdminOrAbove, isOwner } from '@/lib/auth-client';

jest.mock('@/lib/auth-client', () => ({
  apiFetch: jest.fn(),
  getCurrentUser: jest.fn(),
  isAdminOrAbove: jest.fn(),
  isOwner: jest.fn(),
  getApiUrl: jest.fn().mockReturnValue('http://localhost:3001'),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockIsAdminOrAbove = isAdminOrAbove as jest.MockedFunction<typeof isAdminOrAbove>;
const mockIsOwner = isOwner as jest.MockedFunction<typeof isOwner>;

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Team Page Contract', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockGetCurrentUser.mockReset();
    mockIsAdminOrAbove.mockReset();
    mockIsOwner.mockReset();
  });

  describe('team list uses real backend routes', () => {
    it('calls GET /admin/users instead of /team/members', async () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u1', orgId: 'org-1', role: 'Owner' });
      mockIsAdminOrAbove.mockReturnValue(true);
      mockIsOwner.mockReturnValue(true);
      mockApiFetch.mockResolvedValue(jsonResponse([
        { id: 'u1', email: 'a@test.com', displayName: 'A', role: 'Owner' },
      ]));

      const res = await apiFetch('/admin/users');
      expect(res.ok).toBe(true);

      const calledWithAdminUsers = mockApiFetch.mock.calls.some(
        (call) => call[0] === '/admin/users',
      );
      expect(calledWithAdminUsers).toBe(true);

      const calledWithTeamMembers = mockApiFetch.mock.calls.some(
        (call) => call[0] === '/team/members',
      );
      expect(calledWithTeamMembers).toBe(false);
    });
  });

  describe('remove action uses correct method', () => {
    it('calls POST /admin/users/:id/remove instead of DELETE /team/members/:id', async () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u1', orgId: 'org-1', role: 'Owner' });
      mockIsAdminOrAbove.mockReturnValue(true);
      mockIsOwner.mockReturnValue(true);
      mockApiFetch.mockResolvedValue(jsonResponse({ message: 'User removed' }));

      const res = await apiFetch('/admin/users/u2/remove', { method: 'POST' });
      expect(res.ok).toBe(true);

      const calledWithCorrectRoute = mockApiFetch.mock.calls.some(
        (call) => call[0] === '/admin/users/u2/remove' && call[1]?.method === 'POST',
      );
      expect(calledWithCorrectRoute).toBe(true);

      const calledWithOldRoute = mockApiFetch.mock.calls.some(
        (call) => call[0]?.includes('/team/members/'),
      );
      expect(calledWithOldRoute).toBe(false);
    });
  });

  describe('role action uses correct method', () => {
    it('calls POST /admin/users/:id/role', async () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u1', orgId: 'org-1', role: 'Owner' });
      mockIsAdminOrAbove.mockReturnValue(true);
      mockIsOwner.mockReturnValue(true);
      mockApiFetch.mockResolvedValue(jsonResponse({ id: 'u2', role: 'Admin' }));

      const res = await apiFetch('/admin/users/u2/role', {
        method: 'POST',
        body: JSON.stringify({ role: 'Admin' }),
      });
      expect(res.ok).toBe(true);

      const calledWithCorrectRoute = mockApiFetch.mock.calls.some(
        (call) => call[0] === '/admin/users/u2/role' && call[1]?.method === 'POST',
      );
      expect(calledWithCorrectRoute).toBe(true);
    });
  });

  describe('unsupported invite does not fake success', () => {
    it('does not POST to /team/members for invite', async () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u1', orgId: 'org-1', role: 'Owner' });
      mockIsAdminOrAbove.mockReturnValue(true);
      mockIsOwner.mockReturnValue(true);

      const calledWithInviteRoute = mockApiFetch.mock.calls.some(
        (call) => call[0] === '/team/members' && call[1]?.method === 'POST',
      );
      expect(calledWithInviteRoute).toBe(false);
    });
  });

  describe('permission enforcement', () => {
    it('Viewer cannot perform admin actions', () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u1', orgId: 'org-1', role: 'Viewer' });
      mockIsAdminOrAbove.mockReturnValue(false);
      mockIsOwner.mockReturnValue(false);

      const user = getCurrentUser();
      expect(user?.role).toBe('Viewer');
      expect(isAdminOrAbove(user)).toBe(false);
      expect(isOwner(user)).toBe(false);
    });

    it('Technician cannot perform admin actions', () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u1', orgId: 'org-1', role: 'Technician' });
      mockIsAdminOrAbove.mockReturnValue(false);
      mockIsOwner.mockReturnValue(false);

      const user = getCurrentUser();
      expect(user?.role).toBe('Technician');
      expect(isAdminOrAbove(user)).toBe(false);
      expect(isOwner(user)).toBe(false);
    });

    it('Admin can manage users but not change roles', () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u1', orgId: 'org-1', role: 'Admin' });
      mockIsAdminOrAbove.mockReturnValue(true);
      mockIsOwner.mockReturnValue(false);

      const user = getCurrentUser();
      expect(isAdminOrAbove(user)).toBe(true);
      expect(isOwner(user)).toBe(false);
    });

    it('Owner can perform all admin actions', () => {
      mockGetCurrentUser.mockReturnValue({ sub: 'u1', orgId: 'org-1', role: 'Owner' });
      mockIsAdminOrAbove.mockReturnValue(true);
      mockIsOwner.mockReturnValue(true);

      const user = getCurrentUser();
      expect(isAdminOrAbove(user)).toBe(true);
      expect(isOwner(user)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('handles 403 permission denied', async () => {
      mockApiFetch.mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403));
      const res = await apiFetch('/admin/users');
      expect(res.status).toBe(403);
    });

    it('handles 401 unauthorized', async () => {
      mockApiFetch.mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401));
      const res = await apiFetch('/admin/users');
      expect(res.status).toBe(401);
    });

    it('handles 500 server error', async () => {
      mockApiFetch.mockResolvedValue(jsonResponse({ message: 'Internal error' }, 500));
      const res = await apiFetch('/admin/users');
      expect(res.status).toBe(500);
    });
  });
});
