import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AuthProvider, useSession } from './AuthContext';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});

describe('AuthContext', () => {
  it('starts with loading true', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current.loading).toBe(true);
  });

  it('provides session and user after loading', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com' },
      access_token: 'token-123',
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.session).toEqual(mockSession);
    expect(result.current.user).toEqual({ id: 'user-1', email: 'test@example.com' });
  });

  it('sets session to null when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('subscribes to auth state changes', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    renderHook(() => useSession(), { wrapper });

    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    expect(typeof mockOnAuthStateChange.mock.calls[0][0]).toBe('function');
  });

  it('updates session on auth state change', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    let authCallback: (event: string, session: unknown) => void = () => {};
    mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();

    const newSession = { user: { id: 'user-2', email: 'new@example.com' }, access_token: 'new-token' };
    authCallback('SIGNED_IN', newSession);

    await waitFor(() => expect(result.current.session).toEqual(newSession));
    expect(result.current.user).toEqual({ id: 'user-2', email: 'new@example.com' });
  });

  it('clears session on sign out event', async () => {
    const mockSession = { user: { id: 'user-1', email: 'test@example.com' }, access_token: 'token' };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    let authCallback: (event: string, session: unknown) => void = () => {};
    mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.session).toEqual(mockSession));

    authCallback('SIGNED_OUT', null);

    await waitFor(() => expect(result.current.session).toBeNull());
  });
});
