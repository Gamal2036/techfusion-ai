import { apiFetch, getAccessToken, setTokens } from '@/lib/auth-client';
import { switchToOrganization, listenForOrgSwitch, ORG_SWITCH_EVENT, getActiveOrgId, fetchMembers } from '@/lib/org-client';

jest.mock('@/lib/auth-client', () => ({
  apiFetch: jest.fn(),
  getAccessToken: jest.fn(),
  setTokens: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockGetAccessToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>;
const mockSetTokens = setTokens as jest.MockedFunction<typeof setTokens>;

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SWITCH_RESULT = {
  user: { id: 'u1', email: 'a@test.com', displayName: 'A', role: 'Owner', orgId: 'org-b' },
  accessToken: 'access-b',
  refreshToken: 'refresh-b',
};

describe('org-client organization switch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetTokens.mockImplementation(() => {});
  });

  describe('atomic token-pair replacement', () => {
    it('replaces access + refresh tokens in the same call after switch', async () => {
      mockApiFetch.mockResolvedValue(jsonResponse(SWITCH_RESULT));

      await switchToOrganization('org-b');

      expect(mockApiFetch).toHaveBeenCalledWith('/organizations/org-b/switch', { method: 'POST' });
      expect(mockSetTokens).toHaveBeenCalledWith('access-b', 'refresh-b');
    });

    it('throws when the response is missing a token pair', async () => {
      mockApiFetch.mockResolvedValue(jsonResponse({ user: SWITCH_RESULT.user }));

      await expect(switchToOrganization('org-b')).rejects.toThrow('missing a token pair');
      expect(mockSetTokens).not.toHaveBeenCalled();
    });

    it('throws OrgError with status when the switch is rejected', async () => {
      mockApiFetch.mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403));

      const err = await switchToOrganization('org-b').catch((e: any) => e);
      expect(err.name).toBe('OrgError');
      expect(err.status).toBe(403);
      expect(mockSetTokens).not.toHaveBeenCalled();
    });
  });

  describe('switch event dispatch', () => {
    it('dispatches ORG_SWITCH_EVENT with the target org after tokens are set', async () => {
      mockApiFetch.mockResolvedValue(jsonResponse(SWITCH_RESULT));

      const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

      let callbackOrg: string | null = null;
      const unsub = listenForOrgSwitch((orgId) => { callbackOrg = orgId; });

      await switchToOrganization('org-b');

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: ORG_SWITCH_EVENT }),
      );
      expect(callbackOrg).toBe('org-b');

      // setTokens must have run before the event fired so listeners read fresh state.
      expect(mockSetTokens.mock.invocationCallOrder[0]).toBeLessThan(
        dispatchSpy.mock.invocationCallOrder[0],
      );

      unsub();
    });
  });

  describe('active org id decoding', () => {
    it('returns the org id embedded in the access token', () => {
      const b64 = Buffer.from(JSON.stringify({ sub: 'u1', orgId: 'org-x' })).toString('base64');
      mockGetAccessToken.mockReturnValue(`header.${b64}.sig`);
      expect(getActiveOrgId()).toBe('org-x');
    });

    it('returns null when there is no token', () => {
      mockGetAccessToken.mockReturnValue(null);
      expect(getActiveOrgId()).toBeNull();
    });
  });
});

describe('org-client members endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches members from /organizations/:id/members', async () => {
    const body = [{ userId: 'u2', role: 'Viewer', isSelf: false }];
    mockApiFetch.mockResolvedValue(jsonResponse(body));
    const result = await fetchMembers('org-a');
    expect(mockApiFetch).toHaveBeenCalledWith('/organizations/org-a/members');
    expect(result).toEqual(body);
  });

  it('never calls legacy /admin/users for team data', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse([]));
    await fetchMembers('org-a');
    const legacy = mockApiFetch.mock.calls.some((c) => String(c[0]).startsWith('/admin/users'));
    expect(legacy).toBe(false);
  });
});
