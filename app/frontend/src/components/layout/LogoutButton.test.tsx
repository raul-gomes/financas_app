import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LogoutButton } from './LogoutButton';

const mockSignOut = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LogoutButton', () => {
  it('chama signOut e navega para /login ao clicar', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <LogoutButton />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /sair/i }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});