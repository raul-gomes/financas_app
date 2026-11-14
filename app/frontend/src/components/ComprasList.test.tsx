import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { ComprasList } from './ComprasList';

const mockListByMonth = vi.fn();
const mockCreate = vi.fn();

const mockToast = vi.fn();

vi.mock('@/services/shoppingService', () => ({
  ShoppingService: {
    listByMonth: (...args: unknown[]) => mockListByMonth(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const item = {
  id: 1,
  name: 'Leite',
  reference_month: '2026-09-01',
  checked: false,
  completed_at: null,
  entity_type: 'individual' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListByMonth.mockResolvedValue([]);
});

describe('ComprasList', () => {
  it('refaz o fetch com o novo tipo de entidade ao mudar de pf para pj', async () => {
    const { rerender } = renderWithQuery(<ComprasList entityType="pf" />);

    await waitFor(() => {
      expect(mockListByMonth).toHaveBeenLastCalledWith(expect.any(String), 'individual');
    });

    rerender(<ComprasList entityType="pj" />);

    await waitFor(() => {
      expect(mockListByMonth).toHaveBeenLastCalledWith(expect.any(String), 'business');
    });
  });

  it('lista os itens do mês', async () => {
    mockListByMonth.mockResolvedValue([item]);

    renderWithQuery(<ComprasList entityType="pf" />);

    await waitFor(() => expect(screen.getByText('Leite')).toBeTruthy());
  });

  it('recarrega a lista depois de adicionar um item', async () => {
    mockCreate.mockResolvedValue(item);
    renderWithQuery(<ComprasList entityType="pf" />);
    await waitFor(() => expect(mockListByMonth).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Leite' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ name: 'Leite', entity_type: 'individual' });
    await waitFor(() => expect(mockListByMonth).toHaveBeenCalledTimes(2));
  });

  it('avisa com um toast quando a busca falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockListByMonth.mockRejectedValue(new Error('falhou'));

    renderWithQuery(<ComprasList entityType="pf" />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Falha ao carregar compras.', variant: 'destructive' }),
      );
    });
  });
});
