import '@testing-library/jest-dom';
import { requestPasswordReset, resetPassword } from '@/lib/recovery-client';

const fetchMock = jest.fn();
global.fetch = fetchMock as any;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
});

describe('recovery-client -- contract tests', () => {
  describe('requestPasswordReset', () => {
    it('sends POST to /auth/forgot-password with normalized email', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
      await requestPasswordReset('USER@Example.COM');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain('/auth/forgot-password');
      expect(fetchMock.mock.calls[0][1].method).toBe('POST');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({ email: 'user@example.com' });
    });

    it('trims whitespace and lowercases', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
      await requestPasswordReset('  Test@Email.COM  ');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.email).toBe('test@email.com');
    });

    it('throws rate_limited on 429', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'rate limited' }), { status: 429 }));
      try {
        await requestPasswordReset('user@example.com');
        fail('should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('rate_limited');
      }
    });

    it('throws network on fetch failure', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      try {
        await requestPasswordReset('user@example.com');
        fail('should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('network');
      }
    });

    it('throws server on non-200 non-429', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'err' }), { status: 500 }));
      try {
        await requestPasswordReset('user@example.com');
        fail('should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('server');
      }
    });
  });

  describe('resetPassword', () => {
    it('sends POST to /auth/reset-password with token and newPassword', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
      await resetPassword('opaque-token', 'NewPass123!');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain('/auth/reset-password');
      expect(fetchMock.mock.calls[0][1].method).toBe('POST');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({ token: 'opaque-token', newPassword: 'NewPass123!' });
    });

    it('throws invalid_token on 400 with expired message', async () => {
      fetchMock.mockResolvedValueOnce(new Response(
        JSON.stringify({ message: 'Invalid or expired reset token' }),
        { status: 400 },
      ));
      try {
        await resetPassword('bad-token', 'NewPass123!');
        fail('should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('unknown');
        expect(err.message).toBe('invalid_token');
      }
    });

    it('throws rate_limited on 429', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'rate limited' }), { status: 429 }));
      try {
        await resetPassword('token', 'NewPass123!');
        fail('should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('rate_limited');
      }
    });

    it('throws network on fetch failure', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      try {
        await resetPassword('token', 'NewPass123!');
        fail('should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('network');
      }
    });

    it('throws server on unexpected error', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'err' }), { status: 500 }));
      try {
        await resetPassword('token', 'NewPass123!');
        fail('should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('server');
      }
    });

    it('returns ok on success', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Password has been reset successfully' }), { status: 200 }));
      const result = await resetPassword('valid-token', 'NewPass123!');
      expect(result).toEqual({ ok: true });
    });
  });
});
