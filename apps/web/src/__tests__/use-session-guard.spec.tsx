import { renderHook, waitFor } from '@testing-library/react';
import { useSessionGuard } from '@/hooks/useSessionGuard';
import { getAccessToken, getRefreshToken, setTokens } from '@/lib/auth-client';

jest.mock('@/lib/socket-client', () => ({
  disconnectAll: jest.fn(),
}));

function createJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.mock-signature`;
}

const baseClaims = { sub: 'user-1', orgId: 'org-1', role: 'Owner' };

function expiredAccess(): string {
  return createJwt({
    ...baseClaims,
    iat: Math.floor(Date.now() / 1000) - 2000,
    exp: Math.floor(Date.now() / 1000) - 100,
  });
}

function validAccess(): string {
  return createJwt({
    ...baseClaims,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  });
}

describe('useSessionGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('reports active immediately for a valid unexpired token without any refresh', async () => {
    setTokens(validAccess(), 'refresh-1');
    global.fetch = jest.fn();

    const { result } = renderHook(() => useSessionGuard(30000));

    await waitFor(() => expect(result.current).toBe('active'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renews an expired access token transparently and stays active', async () => {
    setTokens(expiredAccess(), 'refresh-1');
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: validAccess(), refreshToken: 'refresh-2' }), {
        status: 201,
      }),
    );

    const { result } = renderHook(() => useSessionGuard(30000));

    await waitFor(() => expect(result.current).toBe('active'));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(getRefreshToken()).toBe('refresh-2');
  });

  it('logs out only when the refresh session is definitively invalid', async () => {
    setTokens(expiredAccess(), 'revoked-refresh');
    global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 401 }));

    const { result } = renderHook(() => useSessionGuard(30000));

    await waitFor(() => expect(result.current).toBe('logged-out'));
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('stays active on a transient refresh failure and preserves the session', async () => {
    setTokens(expiredAccess(), 'refresh-1');
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useSessionGuard(30000));

    await waitFor(() => expect(result.current).toBe('active'));
    expect(getRefreshToken()).toBe('refresh-1');
    expect(getAccessToken()).toBeTruthy();
  });

  it('logs out when there is no token at all', async () => {
    global.fetch = jest.fn();

    const { result } = renderHook(() => useSessionGuard(30000));

    await waitFor(() => expect(result.current).toBe('logged-out'));
  });

  it('keeps the session alive across repeated access-expiry cycles', async () => {
    setTokens(expiredAccess(), 'refresh-1');
    let refreshCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      refreshCount++;
      return new Response(
        JSON.stringify({ accessToken: expiredAccess(), refreshToken: `refresh-${refreshCount + 1}` }),
        { status: 201 },
      );
    });

    const { result } = renderHook(() => useSessionGuard(25));

    // With a 25ms interval, the guard should renew the access token multiple
    // times (each renewing cycle re-expires immediately) and never log out.
    await waitFor(() => expect(refreshCount).toBeGreaterThanOrEqual(2));
    expect(result.current).toBe('active');
    expect(getAccessToken()).toBeTruthy();
  });
});
