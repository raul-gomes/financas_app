import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Limits, { } from './Limits';

vi.mock('@/contexts/RoleContext', () => ({
  useRole: () => ({ isAdmin: mockIsAdmin }),
}));

let mockIsAdmin = false;

vi.mock('@/components/limits/LimitsTab', () => ({
  LimitsTab: () => <div>LimitsTab</div>,
}));
vi.mock('@/components/limits/RecorrentesTab', () => ({
  RecorrentesTab: () => <div>RecorrentesTab</div>,
}));
vi.mock('@/components/limits/MetasTab', () => ({
  MetasTab: () => <div>MetasTab</div>,
}));
vi.mock('@/components/limits/ComprasTab', () => ({
  ComprasTab: () => <div>ComprasTab</div>,
}));

describe('Limits page', () => {
  it('mostra aba Recorrentes para user (não-admin)', () => {
    mockIsAdmin = false;
    render(<Limits />);
    expect(screen.getByRole('heading', { name: 'Limites' })).toBeInTheDocument();
    expect(screen.getByText('Recorrentes')).toBeInTheDocument();
    expect(screen.queryByText('Metas')).not.toBeInTheDocument();
    expect(screen.queryByText('Compras')).not.toBeInTheDocument();
  });

  it('mostra todas as abas para admin', () => {
    mockIsAdmin = true;
    render(<Limits />);
    expect(screen.getByRole('heading', { name: 'Limites' })).toBeInTheDocument();
    expect(screen.getByText('Recorrentes')).toBeInTheDocument();
    expect(screen.getByText('Metas')).toBeInTheDocument();
    expect(screen.getByText('Compras')).toBeInTheDocument();
  });
});