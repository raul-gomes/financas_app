import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { TransactionList } from './TransactionList';
import type { Transaction, TransactionPage } from '@/types/financial';

const mockGetTransactionsPage = vi.fn();
const mockListBanks = vi.fn();

vi.mock('@/services/financialService', () => ({
  TRANSACTIONS_PAGE_SIZE: 30,
  FinancialService: {
    getTransactionsPage: (...args: unknown[]) => mockGetTransactionsPage(...args),
  },
}));

vi.mock('@/services/settingsService', () => ({
  SettingsService: { listBanks: () => mockListBanks() },
}));

vi.mock('@/contexts/RoleContext', () => ({
  useRole: () => ({ isAdmin: false }),
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/components/dialogs/AddTransactionDialog', () => ({
  AddTransactionDialog: () => null,
}));
vi.mock('@/components/dialogs/EditTransactionDialog', () => ({
  EditTransactionDialog: () => null,
}));
vi.mock('@/components/dialogs/ExtratoUploadModal', () => ({
  ExtratoUploadModal: () => null,
}));

function tx(id: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amount: 10,
    description: `Compra ${id}`,
    category_id: 1,
    subcategory_id: 1,
    category_name: 'Alimentacao',
    subcategory_name: 'Mercado',
    payment_method: 'pix',
    installment_number: null,
    total_installments: null,
    is_installment: false,
    bank_code: null,
    entity_type: 'individual',
    transaction_date: '2026-05-10T00:00:00',
    recurring_account_id: null,
    ...overrides,
  };
}

function page(ids: number[], nextCursor: string | null, total: number): TransactionPage {
  return { items: ids.map((id) => tx(id)), total, limit: 30, has_more: nextCursor !== null, next_cursor: nextCursor };
}

const baseProps = {
  monthlyBalance: { income: 100, expenses: 40, balance: 60 },
  onAddTransaction: vi.fn(),
  onEditTransaction: vi.fn(),
  onDeleteTransaction: vi.fn(),
  dateRange: { from: new Date(2026, 4, 1), to: new Date(2026, 4, 31) },
  selectedEntityType: 'pf' as const,
  onEntityTypeChange: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListBanks.mockResolvedValue([]);
});

describe('TransactionList (paginated)', () => {
  it('shows the first page with the total and loads more on demand', async () => {
    mockGetTransactionsPage
      .mockResolvedValueOnce(page([3, 2], 'cursor-1', 3))
      .mockResolvedValueOnce(page([1], null, 3));
    renderWithQuery(<TransactionList {...baseProps} />);

    await waitFor(() => expect(screen.getByText('Compra 3')).toBeTruthy());
    expect(screen.getByText('Mostrando 2 de 3')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    await waitFor(() => expect(screen.getByText('Compra 1')).toBeTruthy());
    expect(mockGetTransactionsPage.mock.calls[1][1]).toBe('cursor-1');
    expect(screen.getByText('Mostrando 3 de 3')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('requests the period and PF/PJ scope from the server', async () => {
    mockGetTransactionsPage.mockResolvedValue(page([1], null, 1));
    renderWithQuery(<TransactionList {...baseProps} selectedEntityType="pj" />);

    await waitFor(() => expect(mockGetTransactionsPage).toHaveBeenCalled());
    const [filters, cursor] = mockGetTransactionsPage.mock.calls[0];
    expect(filters.entityType).toBe('pj');
    expect(filters.dateRange).toEqual(baseProps.dateRange);
    expect(filters.search).toBe('');
    expect(cursor).toBeNull();
  });

  it('searches on the server, once, after the user stops typing', async () => {
    mockGetTransactionsPage.mockResolvedValue(page([1], null, 1));
    renderWithQuery(<TransactionList {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Compra 1')).toBeTruthy());

    const input = screen.getByPlaceholderText(/Pesquisar/);
    fireEvent.change(input, { target: { value: 'm' } });
    fireEvent.change(input, { target: { value: 'me' } });
    fireEvent.change(input, { target: { value: 'merc' } });

    await waitFor(() => expect(mockGetTransactionsPage).toHaveBeenCalledTimes(2));
    expect(mockGetTransactionsPage.mock.calls[1][0].search).toBe('merc');
  });

  it('shows an empty state when nothing matches', async () => {
    mockGetTransactionsPage.mockResolvedValue(page([], null, 0));
    renderWithQuery(<TransactionList {...baseProps} />);

    await waitFor(() => expect(screen.getByText('Nenhuma transação encontrada')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('shows the error with a retry action', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetTransactionsPage.mockRejectedValueOnce(new Error('boom'));
    mockGetTransactionsPage.mockResolvedValueOnce(page([1], null, 1));
    renderWithQuery(<TransactionList {...baseProps} />);

    await waitFor(() => expect(screen.getByText('Erro ao carregar as transações')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => expect(screen.getByText('Compra 1')).toBeTruthy());
  });
});
