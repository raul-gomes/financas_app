import { QueryClient, useQuery } from '@tanstack/react-query';
import { format, startOfMonth } from 'date-fns';
import { FinancialService } from '@/services/financialService';
import { ContaRecorrenteService } from '@/services/recurringAccountService';
import { MetasService } from '@/services/goalsService';
import { ShoppingService } from '@/services/shoppingService';
import { queryKeys } from '@/lib/queryKeys';

/** Backend date of the first day of a month (shopping lists are keyed by it). */
const REFERENCE_MONTH_FORMAT = 'yyyy-MM-dd';

/** Maps the screens' PF/PJ toggle to the backend entity type (undefined = both). */
export function toBackendEntityType(filter: string | undefined): 'individual' | 'business' | undefined {
  if (!filter || filter === 'all') return undefined;
  return filter === 'pf' ? 'individual' : 'business';
}

/** First day of the current month, e.g. "2026-05-01". */
export function currentReferenceMonth(now: Date = new Date()): string {
  return format(startOfMonth(now), REFERENCE_MONTH_FORMAT);
}

/** Category limits (raw payload; the tab maps it to its editable model). */
export function useLimitCategories() {
  return useQuery({
    queryKey: queryKeys.limits.categories(),
    queryFn: () => FinancialService.getLimits(),
  });
}

/** Month spending per category (drives the pre-save "% used" warning). */
export function useLimitsWithSpending(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.limits.withSpending(year, month),
    queryFn: () => FinancialService.getLimitsWithSpending(year, month),
  });
}

/** Recurring accounts, optionally filtered by PF/PJ. */
export function useRecurringAccounts(entityTypeFilter: string | undefined) {
  const entityType = toBackendEntityType(entityTypeFilter);
  return useQuery({
    queryKey: queryKeys.recurring.list(entityType),
    queryFn: () => ContaRecorrenteService.getAll(entityType),
  });
}

/** Goals (definitions), optionally filtered by PF/PJ. */
export function useGoals(entityTypeFilter: string | undefined) {
  const entityType = toBackendEntityType(entityTypeFilter);
  return useQuery({
    queryKey: queryKeys.goals.list(entityType),
    queryFn: () => MetasService.list(entityType),
  });
}

/** Goal progress of the current month (sidebar), optionally filtered by PF/PJ. */
export function useGoalsProgress(entityTypeFilter: string | undefined, now: Date = new Date()) {
  const entityType = toBackendEntityType(entityTypeFilter);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return useQuery({
    queryKey: queryKeys.goals.progress(year, month, entityType),
    queryFn: () => MetasService.progresso(year, month, undefined, entityType),
  });
}

/** Shopping list of the current month, optionally filtered by PF/PJ. */
export function useShoppingItems(entityTypeFilter: string | undefined) {
  const entityType = toBackendEntityType(entityTypeFilter);
  const referenceMonth = currentReferenceMonth();
  return useQuery({
    queryKey: queryKeys.shopping.month(referenceMonth, entityType),
    queryFn: () => ShoppingService.listByMonth(referenceMonth, entityType),
  });
}

/** Refreshes a domain after one of its mutations (create/update/delete). */
export function invalidateDomain(
  queryClient: QueryClient,
  domain: 'limits' | 'recurring' | 'goals' | 'shopping' | 'settings',
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys[domain].all });
}
