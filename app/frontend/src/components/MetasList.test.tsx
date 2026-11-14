import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { queryKeys } from '@/lib/queryKeys';
import { MetasList } from './MetasList';

const mockProgresso = vi.fn();
const mockConcluir = vi.fn();
const mockToast = vi.fn();

vi.mock('@/services/goalsService', () => ({
  MetasService: {
    progresso: (...args: unknown[]) => mockProgresso(...args),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    concluir: (...args: unknown[]) => mockConcluir(...args),
    reativar: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const meta = {
  subcategory_id: 1,
  subcategory_name: 'Viagem',
  target_amount: 1000,
  current_amount: 250,
  progress: 25,
  completed: false,
  completed_at: null,
  entity_type: 'individual' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockProgresso.mockResolvedValue([]);
});

describe('MetasList', () => {
  it('refaz o fetch quando os dados de transações são invalidados', async () => {
    const { client } = renderWithQuery(<MetasList entityType="pf" />);
    await waitFor(() => expect(mockProgresso).toHaveBeenCalledTimes(1));

    await client.invalidateQueries({ queryKey: queryKeys.goals.all });

    await waitFor(() => expect(mockProgresso).toHaveBeenCalledTimes(2));
  });

  it('usa o tipo de entidade do backend ao buscar o progresso', async () => {
    renderWithQuery(<MetasList entityType="pj" />);

    await waitFor(() => expect(mockProgresso).toHaveBeenCalled());
    expect(mockProgresso.mock.calls[0][3]).toBe('business');
  });

  it('conclui uma meta e recarrega a lista', async () => {
    mockProgresso.mockResolvedValue([meta]);
    mockConcluir.mockResolvedValue({});
    renderWithQuery(<MetasList entityType="pf" />);
    await waitFor(() => expect(screen.getByText('Viagem')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Concluir/ }));

    await waitFor(() => expect(mockConcluir).toHaveBeenCalledWith(1));
    await waitFor(() => expect(mockProgresso).toHaveBeenCalledTimes(2));
  });
});
