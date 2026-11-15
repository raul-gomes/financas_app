import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateTransactionData } from './useTransactionQueries';

/**
 * Refreshes everything a recurring-account mutation touches: the accounts themselves and the
 * transactions they generate or cancel (list, dashboards, overview, limits, goals). Call it
 * after any recurring account create/update/delete/renew.
 */
export async function invalidateRecurringData(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all }),
    invalidateTransactionData(queryClient),
  ]);
}
