import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { LimitsTab } from './LimitsTab';

const mockGetLimits = vi.fn();
const mockGetLimitsWithSpending = vi.fn();
const mockSaveLimits = vi.fn();
const mockToast = vi.fn();

vi.mock('@/services/financialService', () => ({
  FinancialService: {
    getLimits: (...args: unknown[]) => mockGetLimits(...args),
    getLimitsWithSpending: (...args: unknown[]) => mockGetLimitsWithSpending(...args),
    saveLimits: (...args: unknown[]) => mockSaveLimits(...args),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const limits = [
  { id: 1, name: 'Alimentacao', entity_type: 'individual', limit: 500, subcategories: [{ id: 1, name: 'Mercado' }] },
  { id: 2, name: 'Lazer', entity_type: 'individual', limit: 1000, subcategories: [] },
  { id: 3, name: 'Compras', entity_type: 'individual', limit: 1000, subcategories: [] },
];

const spending = {
  month: '2026-09',
  categories: [
    { id: 1, category_name: 'Alimentacao', entity_type: 'individual', limit: 500, spent: 400, remaining: 100, percent_used: 80, subcategories: [] },
    { id: 2, category_name: 'Lazer', entity_type: 'individual', limit: 1000, spent: 900, remaining: 100, percent_used: 90, subcategories: [] },
    { id: 3, category_name: 'Compras', entity_type: 'individual', limit: 1000, spent: 1200, remaining: -200, percent_used: 120, subcategories: [] },
  ],
  total_limit: 2500,
  total_spent: 2500,
  total_remaining: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLimits.mockResolvedValue(limits);
  mockGetLimitsWithSpending.mockResolvedValue(spending);
  mockSaveLimits.mockResolvedValue({ success: true, message: 'Limites atualizados com sucesso!' });
});

describe('LimitsTab', () => {
  it('mostra o % de uso pré-save por categoria e some ao aumentar o limite', async () => {
    renderWithQuery(<LimitsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('limit-alert-alimentacao')).toBeTruthy();
    });
    const banner = screen.getByText(/Alimentacao/);
    expect(banner.textContent).toMatch(/80%/);

    const limitInput = screen.getByDisplayValue('500');
    fireEvent.change(limitInput, { target: { value: '1000' } });

    expect(screen.queryByTestId('limit-alert-alimentacao')).toBeNull();
  });

  it('aplica cor por threshold: 80=alerta, 90=crítico, 120=estourado', async () => {
    renderWithQuery(<LimitsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('limit-alert-alimentacao')).toBeTruthy();
    });
    expect(screen.getByTestId('limit-alert-alimentacao').dataset.severity).toBe('warning');
    expect(screen.getByTestId('limit-alert-lazer').dataset.severity).toBe('critical');
    expect(screen.getByTestId('limit-alert-compras').dataset.severity).toBe('destructive');
  });

  it('avisa antes de persistir com toast listando categorias perto/estouradas', async () => {
    renderWithQuery(<LimitsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('limit-alert-compras')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/ }));

    await waitFor(() => {
      expect(mockSaveLimits).toHaveBeenCalled();
    });
    const toastPayloads = mockToast.mock.calls.map(call => JSON.stringify(call[0]));
    expect(toastPayloads.some(t => t.includes('Alimentacao') && t.includes('80'))).toBe(true);
    expect(toastPayloads.some(t => t.includes('Compras') && t.includes('120'))).toBe(true);
  });

  it('recarrega limites e gastos depois de salvar', async () => {
    renderWithQuery(<LimitsTab />);
    await waitFor(() => expect(screen.getByTestId('limit-alert-compras')).toBeTruthy());
    expect(mockGetLimits).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/ }));

    await waitFor(() => expect(mockGetLimits).toHaveBeenCalledTimes(2));
    expect(mockGetLimitsWithSpending).toHaveBeenCalledTimes(2);
  });

  it('avisa com um toast quando os limites não carregam', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetLimits.mockRejectedValue(new Error('falhou'));

    renderWithQuery(<LimitsTab />);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Nao foi possivel carregar limites' }),
      ),
    );
  });
});

describe('LimitsTab no celular', () => {
  const originalWidth = window.innerWidth;
  beforeEach(() => {
    window.innerWidth = 390;
  });
  afterEach(() => {
    window.innerWidth = originalWidth;
  });

  it('mostra um card por categoria com o que resta ou o que passou do limite', async () => {
    renderWithQuery(<LimitsTab entityTypeFilter="pf" />);

    await waitFor(() => expect(screen.getByText('Compras')).toBeTruthy());
    expect(screen.getAllByText('Restam R$ 100,00')).toHaveLength(2);
    expect(screen.getByText('Passou R$ 200,00 do limite')).toBeTruthy();
    // no desktop table fields and no fixed-width inputs on the page
    expect(screen.queryByDisplayValue('500')).toBeNull();
  });

  it('toca no card, edita o limite na folha e salva só essa categoria', async () => {
    renderWithQuery(<LimitsTab entityTypeFilter="pf" />);
    await waitFor(() => expect(screen.getByText('Alimentacao')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Alimentacao/ }));
    const limit = await screen.findByLabelText('Limite mensal');
    expect(limit.getAttribute('inputmode')).toBe('decimal');
    fireEvent.focus(limit);
    fireEvent.change(limit, { target: { value: '1000' } });
    fireEvent.blur(limit);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockSaveLimits).toHaveBeenCalledTimes(1));
    const payload = mockSaveLimits.mock.calls[0][0];
    expect(payload.modified).toHaveLength(1);
    expect(payload.modified[0]).toMatchObject({ id: 1, category_name: 'Alimentacao', limit: 1000 });
    expect(payload.new).toEqual([]);
  });
});

