import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import More from './More';

let mockIsAdmin = false;
const mockSignOut = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/contexts/RoleContext', () => ({
  useRole: () => ({ isAdmin: mockIsAdmin, loading: false }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: (...args: unknown[]) => mockSignOut(...args) } },
}));

vi.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <More />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdmin = false;
});

describe('More page', () => {
  it('shows only the general entries to a regular user', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /Configurações/ })).toHaveAttribute('href', '/configuracoes');
    expect(screen.getByRole('button', { name: /Notificações/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sair/ })).toBeInTheDocument();
    expect(screen.queryByText('Contas recorrentes')).not.toBeInTheDocument();
    expect(screen.queryByText('Extrato bancário')).not.toBeInTheDocument();
    expect(screen.queryByText('Investimentos')).not.toBeInTheDocument();
  });

  it('adds the admin-only entries for admins', () => {
    mockIsAdmin = true;
    renderPage();

    expect(screen.getByRole('link', { name: /Contas recorrentes/ })).toHaveAttribute('href', '/recorrentes');
    expect(screen.getByRole('link', { name: /Extrato bancário/ })).toHaveAttribute('href', '/extrato-bancario');
    expect(screen.getByRole('link', { name: /Investimentos/ })).toHaveAttribute('href', '/investments');
  });

  it('signs out and goes to /login', async () => {
    mockSignOut.mockResolvedValue({ error: null });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Sair/ }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  it('stays on the page when sign out fails', async () => {
    mockSignOut.mockResolvedValue({ error: new Error('boom') });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Sair/ }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
