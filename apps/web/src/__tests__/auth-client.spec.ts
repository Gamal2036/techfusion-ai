import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  getAuthHeaders,
  decodeJwt,
  isAuthenticated,
  logout,
  canAccess,
  isOwner,
  isAdminOrAbove,
  isTechnicianOrAbove,
  type JwtPayload,
} from '@/lib/auth-client';

const mockJwtPayload: JwtPayload = {
  sub: 'user-123',
  orgId: 'org-456',
  role: 'Owner',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
};

function createMockJwt(payload: JwtPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock-signature';
  return `${header}.${body}.${signature}`;
}

describe('Auth Client', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Token Storage', () => {
    it('stores and retrieves access token', () => {
      setTokens('access-123', 'refresh-456');
      expect(getAccessToken()).toBe('access-123');
    });

    it('stores and retrieves refresh token', () => {
      setTokens('access-123', 'refresh-456');
      expect(getRefreshToken()).toBe('refresh-456');
    });

    it('clears all tokens', () => {
      setTokens('access-123', 'refresh-456');
      clearTokens();
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });
  });

  describe('Auth Headers', () => {
    it('includes Authorization header when token exists', () => {
      setTokens('test-token', 'refresh');
      const headers = getAuthHeaders();
      expect(headers['Authorization']).toBe('Bearer test-token');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('omits Authorization header when no token', () => {
      const headers = getAuthHeaders();
      expect(headers['Authorization']).toBeUndefined();
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('JWT Decoding', () => {
    it('decodes valid JWT payload', () => {
      const jwt = createMockJwt(mockJwtPayload);
      const decoded = decodeJwt(jwt);
      expect(decoded).toEqual(mockJwtPayload);
    });

    it('returns null for invalid JWT', () => {
      const decoded = decodeJwt('invalid-token');
      expect(decoded).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true for valid unexpired token', () => {
      const jwt = createMockJwt(mockJwtPayload);
      setTokens(jwt, 'refresh');
      expect(isAuthenticated()).toBe(true);
    });

    it('returns false for expired token', () => {
      const expiredPayload: JwtPayload = {
        ...mockJwtPayload,
        exp: Math.floor(Date.now() / 1000) - 100,
      };
      const jwt = createMockJwt(expiredPayload);
      setTokens(jwt, 'refresh');
      expect(isAuthenticated()).toBe(false);
    });

    it('returns false when no token', () => {
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('Role Helpers', () => {
    it('isOwner returns true for Owner role', () => {
      expect(isOwner({ ...mockJwtPayload, role: 'Owner' })).toBe(true);
      expect(isOwner({ ...mockJwtPayload, role: 'Admin' })).toBe(false);
    });

    it('isAdminOrAbove returns true for Owner and Admin', () => {
      expect(isAdminOrAbove({ ...mockJwtPayload, role: 'Owner' })).toBe(true);
      expect(isAdminOrAbove({ ...mockJwtPayload, role: 'Admin' })).toBe(true);
      expect(isAdminOrAbove({ ...mockJwtPayload, role: 'Technician' })).toBe(false);
      expect(isAdminOrAbove({ ...mockJwtPayload, role: 'Viewer' })).toBe(false);
    });

    it('isTechnicianOrAbove returns true for Owner, Admin, Technician', () => {
      expect(isTechnicianOrAbove({ ...mockJwtPayload, role: 'Owner' })).toBe(true);
      expect(isTechnicianOrAbove({ ...mockJwtPayload, role: 'Admin' })).toBe(true);
      expect(isTechnicianOrAbove({ ...mockJwtPayload, role: 'Technician' })).toBe(true);
      expect(isTechnicianOrAbove({ ...mockJwtPayload, role: 'Viewer' })).toBe(false);
    });

    it('canAccess checks role array', () => {
      expect(canAccess({ ...mockJwtPayload, role: 'Owner' }, ['Owner', 'Admin'])).toBe(true);
      expect(canAccess({ ...mockJwtPayload, role: 'Viewer' }, ['Owner', 'Admin'])).toBe(false);
      expect(canAccess(null, ['Owner'])).toBe(false);
      expect(canAccess({ ...mockJwtPayload, role: 'Owner' }, [])).toBe(true);
    });
  });

  describe('Token Refresh', () => {
    it('single refresh attempt on 401', async () => {
      setTokens('expired-token', 'valid-refresh');
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return new Response('', { status: 401 });
        if (callCount === 2) return new Response(JSON.stringify({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        }), { status: 201 });
        return new Response(JSON.stringify({ data: 'ok' }), { status: 200 });
      });

      const { apiFetch } = require('@/lib/auth-client');
      const res = await apiFetch('/test-endpoint');
      expect(res.status).toBe(200);
      expect(getAccessToken()).toBe('new-access');
      expect(callCount).toBe(3);
    });

    it('clears tokens when refresh fails', async () => {
      setTokens('expired-token', 'bad-refresh');
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(async () => {
        callCount++;
        return new Response('', { status: 401 });
      });

      const { apiFetch } = require('@/lib/auth-client');
      await apiFetch('/test-endpoint');
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('shares refresh promise for concurrent 401s', async () => {
      setTokens('expired-token', 'valid-refresh');
      let refreshCallCount = 0;

      global.fetch = jest.fn().mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input.url || '';
        if (url.includes('/auth/refresh')) {
          refreshCallCount++;
          await new Promise(r => setTimeout(r, 50));
          return new Response(JSON.stringify({
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
          }), { status: 201 });
        }
        return new Response('', { status: 401 });
      });

      const { apiFetch } = require('@/lib/auth-client');
      await Promise.all([
        apiFetch('/endpoint-1'),
        apiFetch('/endpoint-2'),
      ]);

      expect(refreshCallCount).toBe(1);
    });
  });

  describe('Logout', () => {
    it('clears local authentication state', async () => {
      setTokens('access-token', 'refresh-token');
      expect(getAccessToken()).toBe('access-token');
      expect(getRefreshToken()).toBe('refresh-token');

      global.fetch = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Logged out' }), { status: 201 })
      );

      try {
        await logout();
      } catch {
        // logout redirects via location.href which throws in jsdom
      }

      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('clears tokens even when backend logout fails', async () => {
      setTokens('access-token', 'refresh-token');
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        await logout();
      } catch {
        // logout redirects via location.href which throws in jsdom
      }

      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });
  });
});
