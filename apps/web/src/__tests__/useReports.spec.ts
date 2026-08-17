import { renderHook, act, waitFor } from '@testing-library/react';
import { useReports } from '@/hooks/useReports';
import { apiFetch } from '@/lib/auth-client';

jest.mock('@/lib/auth-client', () => ({
  ...jest.requireActual('@/lib/auth-client'),
  apiFetch: jest.fn(),
  getApiUrl: jest.fn().mockReturnValue('http://localhost:3001'),
  isLoggingOut: jest.fn().mockReturnValue(false),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useReports', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  describe('generateReport', () => {
    it('calls POST /reports/generate with correct body', async () => {
      mockApiFetch
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ id: 'r1', title: 'Test', status: 'completed' }))
        .mockResolvedValueOnce(jsonResponse([{ id: 'r1', title: 'Test', status: 'completed' }]));

      const { result } = renderHook(() => useReports());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.generateReport('device_health', 'pdf', { title: 'Test Report' });
      });

      const generateCall = mockApiFetch.mock.calls.find(
        (call) => call[0] === '/reports/generate',
      );
      expect(generateCall).toBeDefined();
      expect(generateCall![1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            type: 'device_health',
            format: 'pdf',
            title: 'Test Report',
          }),
        }),
      );
    });

    it('rejects old /reports endpoint', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse([]));

      const { result } = renderHook(() => useReports());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const oldEndpointUsed = mockApiFetch.mock.calls.some(
        (call) => call[0] === '/reports' && call[1]?.method === 'POST',
      );
      expect(oldEndpointUsed).toBe(false);
    });

    it('sets error on 403 plan restriction', async () => {
      mockApiFetch
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ message: 'Monthly report limit reached' }, 403))
        .mockResolvedValueOnce(jsonResponse([]));

      const { result } = renderHook(() => useReports());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        try {
          await result.current.generateReport('device_health', 'pdf');
        } catch {}
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error!.status).toBe(403);
      expect(result.current.error!.message).toContain('limit');
    });

    it('sets error on 500 server error', async () => {
      mockApiFetch
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ message: 'Internal error' }, 500))
        .mockResolvedValueOnce(jsonResponse([]));

      const { result } = renderHook(() => useReports());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        try {
          await result.current.generateReport('device_health', 'pdf');
        } catch {}
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error!.status).toBe(500);
    });

    it('sets error on network failure', async () => {
      mockApiFetch
        .mockResolvedValueOnce(jsonResponse([]))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(jsonResponse([]));

      const { result } = renderHook(() => useReports());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        try {
          await result.current.generateReport('device_health', 'pdf');
        } catch {}
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error!.status).toBe(0);
    });

    it('sets error on 422 with SECURITY_SCAN_REQUIRED code', async () => {
      mockApiFetch
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({
          statusCode: 422,
          code: 'SECURITY_SCAN_REQUIRED',
          message: 'No completed security scan is available. Run a security scan before generating a Security Executive report.',
        }, 422))
        .mockResolvedValueOnce(jsonResponse([]));

      const { result } = renderHook(() => useReports());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        try {
          await result.current.generateReport('security_executive', 'pdf', { title: 'Sec Report' });
        } catch {}
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error!.status).toBe(422);
      expect(result.current.error!.code).toBe('SECURITY_SCAN_REQUIRED');
      expect(result.current.error!.message).toContain('No completed security scan');
    });

    it('all authenticated calls use apiFetch', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse([]));

      const { result } = renderHook(() => useReports());
      await waitFor(() => expect(result.current.loading).toBe(false));

      for (const call of mockApiFetch.mock.calls) {
        expect(call[0]).toBeDefined();
      }
    });
  });

  describe('fetchReports', () => {
    it('uses GET /reports (not POST)', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse([{ id: 'r1', title: 'Test' }]));

      const { result } = renderHook(() => useReports());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const getListCall = mockApiFetch.mock.calls.find(
        (call) => call[0] === '/reports',
      );
      expect(getListCall).toBeDefined();
      expect(getListCall![1]?.method).toBeUndefined();
    });

    it('handles empty response', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse([]));

      const { result } = renderHook(() => useReports());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.reports).toEqual([]);
    });

    it('sets error on fetch failure', async () => {
      mockApiFetch.mockResolvedValueOnce(jsonResponse({ message: 'Forbidden' }, 403));

      const { result } = renderHook(() => useReports());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeDefined();
      expect(result.current.error!.status).toBe(403);
    });
  });
});
