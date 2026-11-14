import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { RoleProvider, useRole } from './RoleContext';
import { AuthProvider } from './AuthContext';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockGetProfile = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

vi.mock('@/services/settingsService', () => ({
  SettingsService: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RoleProvider>{children}</RoleProvider>
    </AuthProvider>
  );
}

interface Ctx {
  isAdmin: boolean;
  loading: boolean;
}

let authCallback: (event: string, session: unknown) => void = () => {};

beforeEach(() => {
  vi.clearAllMocks();
  authCallback = () => {};
  mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
    authCallback = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});

describe('RoleContext', () => {
  it('refetches profile when auth user changes after logout/login', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '1', email: 'admin@example.com' }, access_token: 'a-token' } },
    });
    mockGetProfile.mockResolvedValue({ role: 'admin' });

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);

    // Logout → login como user, sem desmontar o provider (mesmo que no fluxo real de troca de conta)
    mockGetProfile.mockResolvedValue({ role: 'user' });
    authCallback('SIGNED_OUT', null);
    authCallback('SIGNED_IN', { user: { id: '2', email: 'user@example.com' }, access_token: 'u-token' });

    await waitFor(() => expect(result.current.isAdmin).toBe(false));
    expect(mockGetProfile).toHaveBeenCalledTimes(2);
  });

  it('does not refetch profile when there is no authed user', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);

    mockGetProfile.mockClear();

    authCallback('SIGNED_OUT', null);

    // Sem usuário autenticado não há perfil para buscar
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it('starts as admin when profile role is admin', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '1', email: 'admin@example.com' }, access_token: 'a-token' } },
    });
    mockGetProfile.mockResolvedValue({ role: 'admin' });

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
  });

  it('starts as non-admin when profile role is user', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '2', email: 'user@example.com' }, access_token: 'u-token' } },
    });
    mockGetProfile.mockResolvedValue({ role: 'user' });

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });
  it('never reports loaded-as-non-admin while the profile of a restored session is still pending', async () => {
    // Regression: on a full page reload the session is restored asynchronously. For one render the
    // provider had a user id but had not started fetching the profile, so `loading` was false and
    // `isAdmin` false, and AdminRoute redirected admins away from /investments etc.
    let resolveProfile: (profile: { role: string }) => void = () => {};
    mockGetProfile.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '1', email: 'admin@example.com' }, access_token: 'a-token' } },
    });

    const snapshots: Ctx[] = [];
    const { result } = renderHook(() => {
      const ctx = useRole();
      snapshots.push({ isAdmin: ctx.isAdmin, loading: ctx.loading });
      return ctx;
    }, { wrapper });

    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled());
    // Profile still pending: every render so far must still be "loading".
    expect(snapshots.every((snap) => snap.loading)).toBe(true);

    resolveProfile({ role: 'admin' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
  });
});