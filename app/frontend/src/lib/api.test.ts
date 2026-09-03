import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from './api';

const mockGetSession = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'test-token-123' } },
  });
  globalThis.fetch = vi.fn();
});

describe('apiFetch', () => {
  it('adds Authorization header with access_token', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await apiFetch('/dashboard/statement');

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/dashboard/statement`);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-token-123');
  });

  it('preserves existing headers when passed', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await apiFetch('/transacoes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50 }),
    });

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer test-token-123');
  });

  it('prepends API_BASE_URL to relative paths', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await apiFetch('/categories/');

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/categories/`);
  });

  it('does not prepend base URL to absolute URLs', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    );

    await apiFetch('https://brasilapi.com.br/api/banks/v1');

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe('https://brasilapi.com.br/api/banks/v1');
  });

  it('returns response on success', async () => {
    const mockData = { total_income: 1000 };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const result = await apiFetch('/dashboard/statement');

    expect(result).toBeInstanceOf(Response);
    expect(await result.json()).toEqual(mockData);
  });

  it('returns Response even on non-ok status (services check res.ok)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );

    const res = await apiFetch('/transacoes/999');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  it('sends no Authorization header when no session exists', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
    });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await apiFetch('/categories/');

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBeNull();
  });
});
