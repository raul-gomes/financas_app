import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { FinancialService } from '@/services/financialService';
import { queryKeys } from '@/lib/queryKeys';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryWrapper';
import {
  invalidateTransactionData,
  useTransactionMutations,
  useTransactionsInfinite,
} from './useTransactionQueries';
import type { Transaction, TransactionPage } from '@/types/financial';

vi.mock('@/services/financialService', () => ({
  TRANSACTIONS_PAGE_SIZE: 30,
  FinancialService: {
    getTransactionsPage: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
  },
}));

const mockedService = vi.mocked(FinancialService);

function tx(id: number): Transaction {
  return {
    id,
    type: 'expense',
    amount: 10,
    description: `Tx ${id}`,
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
    transaction_date: '2026-05-01T00:00:00',
    recurring_account_id: null,
  };
}

function page(ids: number[], nextCursor: string | null, total: number): TransactionPage {
  return { items: ids.map(tx), total, limit: 2, has_more: nextCursor !== null, next_cursor: nextCursor };
}

const params = {
  dateRange: { from: new Date(2026, 4, 1), to: new Date(2026, 4, 31) },
  entityType: 'pf',
  search: '',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTransactionsInfinite', () => {
  it('loads the first page and then follows the cursor on fetchNextPage', async () => {
    mockedService.getTransactionsPage
      .mockResolvedValueOnce(page([3, 2], 'cursor-1', 3))
      .mockResolvedValueOnce(page([1], null, 3));
    const { result } = renderHook(() => useTransactionsInfinite(params), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].items.map((t) => t.id)).toEqual([3, 2]);
    expect(result.current.hasNextPage).toBe(true);
    expect(mockedService.getTransactionsPage.mock.calls[0][1]).toBeNull();

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockedService.getTransactionsPage.mock.calls[1][1]).toBe('cursor-1');
    await waitFor(() =>
      expect(result.current.data?.pages.flatMap((p) => p.items.map((t) => t.id))).toEqual([3, 2, 1]),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it('passes the filters to the service and restarts from page one when they change', async () => {
    mockedService.getTransactionsPage.mockResolvedValue(page([1], null, 1));
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) => useTransactionsInfinite({ ...params, search }),
      { wrapper: createQueryWrapper(), initialProps: { search: '' } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ search: 'mercado' });

    await waitFor(() => expect(mockedService.getTransactionsPage).toHaveBeenCalledTimes(2));
    const [filters, cursor] = mockedService.getTransactionsPage.mock.calls[1];
    expect(filters).toMatchObject({ entityType: 'pf', search: 'mercado' });
    expect(cursor).toBeNull();
  });

  it('exposes a failed request as an error state without retrying', async () => {
    mockedService.getTransactionsPage.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useTransactionsInfinite(params), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedService.getTransactionsPage).toHaveBeenCalledTimes(1);
  });
});

describe('transaction mutations and invalidation', () => {
  it('invalidateTransactionData refreshes the list, dashboards, overview, limits and goals', async () => {
    const client = createTestQueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');

    await invalidateTransactionData(client);

    const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toEqual([
      queryKeys.transactions.all,
      queryKeys.financial.all,
      queryKeys.overview.all,
      queryKeys.limits.spendingAll,
      queryKeys.goals.all,
    ]);
  });

  it('refetches the list after an update succeeds', async () => {
    mockedService.getTransactionsPage.mockResolvedValue(page([1], null, 1));
    mockedService.updateTransaction.mockResolvedValue(undefined);
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);
    const list = renderHook(() => useTransactionsInfinite(params), { wrapper });
    const mutations = renderHook(() => useTransactionMutations(), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    await act(async () => {
      await mutations.result.current.updateTransaction(1, { description: 'novo' });
    });

    expect(mockedService.updateTransaction).toHaveBeenCalledWith(1, { description: 'novo' });
    await waitFor(() => expect(mockedService.getTransactionsPage).toHaveBeenCalledTimes(2));
  });

  it('refetches the list after a delete succeeds and not after it fails', async () => {
    mockedService.getTransactionsPage.mockResolvedValue(page([1], null, 1));
    mockedService.deleteTransaction.mockRejectedValueOnce(new Error('nope'));
    mockedService.deleteTransaction.mockResolvedValueOnce(undefined);
    const wrapper = createQueryWrapper();
    const list = renderHook(() => useTransactionsInfinite(params), { wrapper });
    const mutations = renderHook(() => useTransactionMutations(), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    await act(async () => {
      await expect(mutations.result.current.deleteTransaction(1)).rejects.toThrow('nope');
    });
    expect(mockedService.getTransactionsPage).toHaveBeenCalledTimes(1);

    await act(async () => {
      await mutations.result.current.deleteTransaction(1);
    });
    await waitFor(() => expect(mockedService.getTransactionsPage).toHaveBeenCalledTimes(2));
  });
});

describe('queryKeys', () => {
  it('builds equal keys for the same filters and distinct keys otherwise', () => {
    const a = queryKeys.transactions.list(params);
    const sameDay = queryKeys.transactions.list({
      ...params,
      dateRange: { from: new Date(2026, 4, 1, 15), to: new Date(2026, 4, 31, 3) },
    });
    const other = queryKeys.transactions.list({ ...params, entityType: 'pj' });

    expect(JSON.stringify(a)).toBe(JSON.stringify(sameDay));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(other));
  });

  it('keeps each domain under its own prefix so invalidating one leaves the others', () => {
    expect(queryKeys.transactions.list(params)[0]).toBe(queryKeys.transactions.all[0]);
    expect(queryKeys.overview.detail(2026, 5, 'all')[0]).toBe(queryKeys.overview.all[0]);
    expect(queryKeys.overview.all[0]).not.toBe(queryKeys.financial.all[0]);
  });
});
