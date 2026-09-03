import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useSession } from '@/contexts/AuthContext';
import { AuthGuard } from './AuthGuard';

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

beforeEach(() => {
  vi.clearAllMocks();
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});

function ProtectedPage() {
  const { user } = useSession();
  return <div>Conteúdo protegido {user?.email ?? ''}</div>;
}

function renderWithGuard({
  initialPath,
  session,
}: {
  initialPath: string;
  session: unknown;
}) {
  mockGetSession.mockResolvedValue({ data: { session } });
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/"
            element={
              <AuthGuard>
                <ProtectedPage />
              </AuthGuard>
            }
          />
          <Route path="/login" element={<div>Tela de Login</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('AuthGuard', () => {
  it('redireciona para /login quando não há sessão', async () => {
    renderWithGuard({ initialPath: '/', session: null });

    await waitFor(() => {
      expect(screen.getByText('Tela de Login')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Conteúdo protegido/i)).not.toBeInTheDocument();
  });

  it('renderiza o conteúdo protegido quando há sessão', async () => {
    const session = {
      user: { id: 'u1', email: 'user@example.com' },
      access_token: 'token',
    };
    renderWithGuard({ initialPath: '/', session });

    await waitFor(() => {
      expect(screen.getByText(/Conteúdo protegido user@example.com/i)).toBeInTheDocument();
    });
  });
});