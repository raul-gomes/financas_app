import {
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { FinancialService, TRANSACTIONS_PAGE_SIZE } from '@/services/financialService';
import { queryKeys, type DateRangeInput } from '@/lib/queryKeys';
import type { Transaction } from '@/types/financial';

/** Filters of the transactions list screen. */
export interface TransactionListParams {
  dateRange: DateRangeInput;
  entityType: string;
  search: string;
}

/**
 * Infinite list of transactions (newest first), one page per request.
 *
 * The cursor returned by the backend is the page param, so inserts between pages never
 * shift the next page. `data.pages[0].total` is the total for the active filters.
 */
export function useTransactionsInfinite(params: TransactionListParams) {
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(params),
    queryFn: ({ pageParam }) =>
      FinancialService.getTransactionsPage(
        { dateRange: params.dateRange, entityType: params.entityType, search: params.search },
        pageParam,
        TRANSACTIONS_PAGE_SIZE,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : undefined),
  });
}

/** Every investment of the year (feeds the investment bars of the yearly chart). */
export function useYearInvestments(year: number, entityType: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.transactions.yearInvestments(year, entityType),
    queryFn: () => FinancialService.getYearInvestments(year, entityType),
    enabled,
  });
}

/**
 * Refreshes everything derived from the user's transactions: the list, dashboards, overview,
 * limit spending and goal progress (not the limits being edited). Call it after any transaction create/update/delete.
 */
export function invalidateTransactionData(queryClient: QueryClient): Promise<void[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.financial.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.overview.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.limits.spendingAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.goals.all }),
  ]);
}

/** Update/delete mutations for transactions; both refresh the derived data on success. */
export function useTransactionMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => invalidateTransactionData(queryClient);

  const update = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<Transaction> }) =>
      FinancialService.updateTransaction(id, changes),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (id: number) => FinancialService.deleteTransaction(id),
    onSuccess,
  });

  return {
    updateTransaction: (id: number, changes: Partial<Transaction>) =>
      update.mutateAsync({ id, changes }),
    deleteTransaction: (id: number) => remove.mutateAsync(id),
    /** Refreshes the data after a transaction was created elsewhere (the add dialog). */
    onTransactionCreated: onSuccess,
  };
}
