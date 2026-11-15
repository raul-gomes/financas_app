import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { endOfMonth } from 'date-fns';
import { OverviewService } from '@/services/overviewService';
import { queryKeys } from '@/lib/queryKeys';
import { useRecurringGeneration } from '@/hooks/queries/useFinancialQueries';

/** Entity scope accepted by the overview endpoint. */
export type OverviewEntityType = 'individual' | 'business' | 'all';

/**
 * Main-screen overview for a month; keeps the previous month visible while the next loads.
 *
 * When `generateRecurring` is true (admins: recurring bills are admin only) the month's
 * recurring bills are generated first, so the totals already include them. The generation
 * shares its cache key with the Financial page, so it runs once per month per session.
 *
 * @param year - Calendar year of the month.
 * @param month - Month number, 1-12.
 * @param entityType - PF, PJ or both.
 * @param generateRecurring - Generate the month's recurring bills before reading the totals.
 */
export function useOverviewQuery(
  year: number,
  month: number,
  entityType: OverviewEntityType,
  generateRecurring = false,
) {
  const from = new Date(year, month - 1, 1);
  const { isSettled: recurringReady } = useRecurringGeneration(
    { from, to: endOfMonth(from) },
    generateRecurring,
  );
  return useQuery({
    queryKey: queryKeys.overview.detail(year, month, entityType),
    queryFn: () => OverviewService.getOverview(year, month, entityType),
    placeholderData: keepPreviousData,
    enabled: recurringReady,
  });
}
