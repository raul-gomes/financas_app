import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { queryKeys } from '@/lib/queryKeys';
import type { ContaRecorrente } from '@/types/recurringAccount';
import RecurrentBills from './RecurrentBills';

const mockGetAll = vi.fn();
const mockDelete = vi.fn();
const mockToast = vi.fn();

vi.mock('@/services/recurringAccountService', () => ({
  ContaRecorrenteService: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    create: vi.fn(),
    update: vi.fn(),
    delete: (...args: unknown[]) => mockDelete(...args),
    renew: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/dialogs/AddRecurrentBillDialog', () => ({
  AddRecurrentBillDialog: () => null,
}));
vi.mock('@/components/dialogs/EditRecurrentBillDialog', () => ({
  EditRecurrentBillDialog: () => null,
}));

function conta(id: number, description: string): ContaRecorrente {
  return {
    id,
    description,
    amount: 50,
    due_day: 10,
    entity_type: 'individual',
    payment_method: 'credito',
    bank_code: null,
    current_installment: 1,
    is_ending_soon: false,
    category_id: 1,
    subcategory_id: 1,
    category_name: 'Lazer',
    subcategory_name: 'Streaming',
    start_date: '2026-01-01',
    end_date: null,
    total_installments: 12,
    remaining_installments: 12,
    active: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAll.mockResolvedValue([conta(1, 'Netflix')]);
  mockDelete.mockResolvedValue(conta(1, 'Netflix'));
});

describe('RecurrentBills page - react-query', () => {
  it('loads the accounts once through the shared cache', async () => {
    const { client } = renderWithQuery(<RecurrentBills />);

    expect(await screen.findByText('Netflix')).toBeInTheDocument();
    expect(mockGetAll).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(queryKeys.recurring.list(undefined))).toHaveLength(1);
  });

  it('refreshes when the global "+" add invalidates every query', async () => {
    const { client } = renderWithQuery(<RecurrentBills />);
    await screen.findByText('Netflix');
    mockGetAll.mockResolvedValue([conta(1, 'Netflix'), conta(2, 'Aluguel')]);

    await client.invalidateQueries();

    expect(await screen.findByText('Aluguel')).toBeInTheDocument();
    expect(mockGetAll).toHaveBeenCalledTimes(2);
  });

  it('warns the user when the list fails to load', async () => {
    mockGetAll.mockRejectedValue(new Error('boom'));

    renderWithQuery(<RecurrentBills />);

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatchObject({ variant: 'destructive' });
  });

  it('after deleting, refetches the accounts and the transaction data they generated', async () => {
    const { client } = renderWithQuery(<RecurrentBills />);
    await screen.findByText('Netflix');
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    mockGetAll.mockResolvedValue([]);

    fireEvent.click(screen.getByRole('button', { name: 'Excluir Netflix' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2));
    const invalidated = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(invalidated).toContainEqual(queryKeys.recurring.all);
    expect(invalidated).toContainEqual(queryKeys.transactions.all);
    expect(await screen.findByText('Nenhuma conta recorrente cadastrada.')).toBeInTheDocument();
  });
});
