import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('Limits page no celular', () => {
  const originalWidth = window.innerWidth;
  afterEach(() => {
    window.innerWidth = originalWidth;
  });

  it('troca as abas por chips, sem o título duplicado da barra superior', () => {
    window.innerWidth = 390;
    mockIsAdmin = true;
    render(<Limits />);

    expect(screen.queryByRole('heading', { name: 'Limites' })).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Seções de limites' })).toBeInTheDocument();
    expect(screen.getByText('LimitsTab')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Metas' }));
    expect(screen.getByText('MetasTab')).toBeInTheDocument();
    expect(screen.queryByText('LimitsTab')).toBeNull();
    expect(screen.getByRole('radio', { name: 'PF' })).toBeInTheDocument();
  });

  it('não oferece Metas e Compras para quem não é admin', () => {
    window.innerWidth = 390;
    mockIsAdmin = false;
    render(<Limits />);
    expect(screen.queryByRole('tab', { name: 'Metas' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Compras' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Recorrentes' })).toBeInTheDocument();
  });
});

