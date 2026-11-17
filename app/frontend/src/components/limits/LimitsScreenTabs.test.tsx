import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { queryKeys } from '@/lib/queryKeys';
import { RecorrentesTab } from './RecorrentesTab';
import { MetasTab } from './MetasTab';
import { ComprasTab } from './ComprasTab';

const mockGetAll = vi.fn();
const mockMetasList = vi.fn();
const mockMetasCreate = vi.fn();
const mockMetasDelete = vi.fn();
const mockShoppingList = vi.fn();
const mockShoppingCreate = vi.fn();
const mockToast = vi.fn();

vi.mock('@/services/recurringAccountService', () => ({
  ContaRecorrenteService: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    renew: vi.fn(),
  },
}));

vi.mock('@/services/goalsService', () => ({
  GoalDeleteRefusedError: class GoalDeleteRefusedError extends Error {},
  MetasService: {
    list: (...args: unknown[]) => mockMetasList(...args),
    create: (...args: unknown[]) => mockMetasCreate(...args),
    update: vi.fn(),
    delete: (...args: unknown[]) => mockMetasDelete(...args),
    concluir: vi.fn(),
    reativar: vi.fn(),
  },
}));

vi.mock('@/services/shoppingService', () => ({
  ShoppingService: {
    listByMonth: (...args: unknown[]) => mockShoppingList(...args),
    create: (...args: unknown[]) => mockShoppingCreate(...args),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('./ContaForm', () => ({ ContaForm: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAll.mockResolvedValue([]);
  mockMetasList.mockResolvedValue([]);
  mockShoppingList.mockResolvedValue([]);
});

describe('RecorrentesTab', () => {
  it('busca as contas do tipo PF/PJ do filtro e refaz ao invalidar', async () => {
    const { client } = renderWithQuery(<RecorrentesTab entityTypeFilter="pj" />);

    await waitFor(() => expect(mockGetAll).toHaveBeenCalledWith('business'));
    await client.invalidateQueries({ queryKey: queryKeys.recurring.all });

    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2));
  });

  it('avisa com um toast quando a busca falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetAll.mockRejectedValue(new Error('falhou'));

    renderWithQuery(<RecorrentesTab entityTypeFilter="pf" />);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Falha ao carregar contas recorrentes.' }),
      ),
    );
  });
});

describe('MetasTab', () => {
  it('cria uma meta com o tipo do filtro e recarrega a lista', async () => {
    mockMetasCreate.mockResolvedValue({});
    renderWithQuery(<MetasTab entityTypeFilter="pf" />);
    await waitFor(() => expect(mockMetasList).toHaveBeenCalledWith('individual'));

    fireEvent.change(screen.getByPlaceholderText('Ex: Viagem Europa'), { target: { value: 'Casa' } });
    fireEvent.change(screen.getByPlaceholderText('30000'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar meta/ }));

    await waitFor(() => expect(mockMetasCreate).toHaveBeenCalled());
    expect(mockMetasCreate.mock.calls[0][0]).toMatchObject({
      subcategory_name: 'Casa',
      target_amount: 5000,
      entity_type: 'individual',
    });
    await waitFor(() => expect(mockMetasList).toHaveBeenCalledTimes(2));
  });
});

describe('MetasTab exclusão recusada', () => {
  it('mostra o motivo quando a meta tem lançamentos', async () => {
    mockMetasList.mockResolvedValue([
      { id: 7, subcategory_name: 'Viagem', target_amount: 2000, category_id: 3, completed: false, completed_at: null },
    ]);
    const { GoalDeleteRefusedError } = await import('@/services/goalsService');
    mockMetasDelete.mockRejectedValue(new GoalDeleteRefusedError('Meta possui lançamentos vinculados'));
    renderWithQuery(<MetasTab entityTypeFilter="pf" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Excluir meta' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Meta possui lançamentos vinculados', variant: 'destructive' }),
      ),
    );
  });
});

describe('ComprasTab', () => {
  it('adiciona um item e recarrega a lista do mês', async () => {
    mockShoppingCreate.mockResolvedValue({});
    renderWithQuery(<ComprasTab entityTypeFilter="pj" />);
    await waitFor(() => expect(mockShoppingList).toHaveBeenCalledWith(expect.any(String), 'business'));

    fireEvent.change(screen.getByPlaceholderText(/Arroz/), { target: { value: 'Papel' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));

    await waitFor(() => expect(mockShoppingCreate).toHaveBeenCalled());
    expect(mockShoppingCreate.mock.calls[0][0]).toMatchObject({ name: 'Papel', entity_type: 'business' });
    await waitFor(() => expect(mockShoppingList).toHaveBeenCalledTimes(2));
  });
});
